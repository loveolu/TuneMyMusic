import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/require-auth.js';
import { prisma } from '../prisma.js';
import { adapterRegistry } from '../services/adapter-registry.js';
import { getValidTokens } from '../services/token-service.js';
import type { Track } from '@tunemymusic/types';

export async function likedSongsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /api/liked-songs — unified liked songs across all platforms
  app.get('/', async (request, reply) => {
    const connections = await prisma.platformConnection.findMany({
      where: { userId: request.userId, isActive: true },
    });

    const allLiked: Array<{ platform: string; track: Track }> = [];

    await Promise.allSettled(
      connections.map(async (conn) => {
        try {
          const adapter = adapterRegistry.getAdapter(conn.platform as any);
          const token = await getValidTokens(conn.id);
          const tracks = await adapter.getLikedSongs(token, 200);
          for (const track of tracks) {
            allLiked.push({ platform: conn.platform, track });
          }
        } catch {
          // Skip platforms that fail
        }
      }),
    );

    // Group by platform
    const byPlatform: Record<string, Track[]> = {};
    for (const { platform, track } of allLiked) {
      if (!byPlatform[platform]) byPlatform[platform] = [];
      byPlatform[platform].push(track);
    }

    return reply.send({
      total: allLiked.length,
      byPlatform,
    });
  });

  // POST /api/liked-songs/fill-gaps — like songs on platforms where missing
  app.post('/fill-gaps', async (request, reply) => {
    const Schema = z.object({
      sourcePlatform: z.string(),
      targetPlatforms: z.array(z.string()).min(1),
      limit: z.number().int().min(1).max(500).default(50),
    });

    const parsed = Schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const { sourcePlatform, targetPlatforms, limit } = parsed.data;

    const sourceConn = await prisma.platformConnection.findFirst({
      where: { userId: request.userId, platform: sourcePlatform as any, isActive: true },
    });
    if (!sourceConn) {
      return reply.status(422).send({ error: `No active connection for source: ${sourcePlatform}` });
    }

    try {
      const sourceAdapter = adapterRegistry.getAdapter(sourcePlatform as any);
      const sourceToken = await getValidTokens(sourceConn.id);
      const sourceLiked = await sourceAdapter.getLikedSongs(sourceToken, limit);

      const results: Array<{ platform: string; liked: number; failed: number }> = [];

      await Promise.all(
        targetPlatforms.map(async (platform) => {
          const conn = await prisma.platformConnection.findFirst({
            where: { userId: request.userId, platform: platform as any, isActive: true },
          });
          if (!conn) {
            results.push({ platform, liked: 0, failed: 0 });
            return;
          }

          const adapter = adapterRegistry.getAdapter(platform as any);
          const token = await getValidTokens(conn.id);

          // Get existing liked songs on target
          let existingIsrcs = new Set<string>();
          try {
            const existing = await adapter.getLikedSongs(token, 500);
            existingIsrcs = new Set(
              existing.filter((t) => t.isrc).map((t) => t.isrc!.toUpperCase()),
            );
          } catch {
            // Proceed without existing check
          }

          let liked = 0;
          let failed = 0;

          for (const track of sourceLiked) {
            // Skip if already liked (by ISRC)
            if (track.isrc && existingIsrcs.has(track.isrc.toUpperCase())) continue;

            try {
              // Search for the track on the target platform
              const results = await adapter.searchTrack(token, {
                name: track.name,
                artist: track.artists[0] ?? '',
                isrc: track.isrc,
                durationMs: track.durationMs,
              });

              if (results.length > 0 && results[0].track.platformTrackId) {
                await adapter.likeTrack(token, results[0].track.platformTrackId);
                liked++;
              } else {
                failed++;
              }
            } catch {
              failed++;
            }
          }

          results.push({ platform, liked, failed });
        }),
      );

      return reply.send({ results });
    } catch (err: any) {
      return reply.status(500).send({ error: err?.message ?? 'Fill gaps failed' });
    }
  });

  // GET /api/liked-songs/export?format=csv
  app.get('/export', async (request, reply) => {
    const QuerySchema = z.object({
      format: z.enum(['csv', 'json']).default('csv'),
      platform: z.string().optional(),
    });

    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query params' });
    }

    const { format, platform } = parsed.data;

    const connections = await prisma.platformConnection.findMany({
      where: {
        userId: request.userId,
        isActive: true,
        ...(platform ? { platform: platform as any } : {}),
      },
    });

    const allTracks: Array<{ platform: string; track: Track }> = [];

    await Promise.allSettled(
      connections.map(async (conn) => {
        try {
          const adapter = adapterRegistry.getAdapter(conn.platform as any);
          const token = await getValidTokens(conn.id);
          const tracks = await adapter.getLikedSongs(token, 500);
          for (const track of tracks) {
            allTracks.push({ platform: conn.platform, track });
          }
        } catch {
          // Skip
        }
      }),
    );

    if (format === 'json') {
      return reply
        .header('Content-Disposition', 'attachment; filename="liked-songs.json"')
        .header('Content-Type', 'application/json')
        .send(JSON.stringify(allTracks, null, 2));
    }

    // CSV format
    const header = 'Platform,Track Name,Artist,Album,ISRC,Duration (ms)';
    const rows = allTracks.map(({ platform, track }) => {
      const name = csvEscape(track.name);
      const artist = csvEscape(track.artists[0] ?? '');
      const album = csvEscape(track.album ?? '');
      const isrc = track.isrc ?? '';
      const duration = track.durationMs ?? '';
      return `${platform},${name},${artist},${album},${isrc},${duration}`;
    });

    const csv = [header, ...rows].join('\n');

    return reply
      .header('Content-Disposition', 'attachment; filename="liked-songs.csv"')
      .header('Content-Type', 'text/csv')
      .send(csv);
  });
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
