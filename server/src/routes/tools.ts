import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/require-auth.js';
import {
  mergePlaylists,
  splitPlaylist,
  deduplicatePlaylist,
  checkPlaylistHealth,
  analyzePlaylist,
  crossPlatformSearch,
} from '../services/playlist-tools.js';
import { adapterRegistry } from '../services/adapter-registry.js';
import { getValidTokens } from '../services/token-service.js';
import { prisma } from '../prisma.js';

const PlaylistRefSchema = z.object({
  platform: z.string(),
  playlistId: z.string(),
});

export async function toolRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // POST /api/tools/merge
  app.post('/merge', async (request, reply) => {
    const Schema = z.object({
      sources: z.array(PlaylistRefSchema).min(2),
    });
    const parsed = Schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    try {
      const result = await mergePlaylists(request.userId, parsed.data.sources);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err?.message ?? 'Merge failed' });
    }
  });

  // POST /api/tools/split
  app.post('/split', async (request, reply) => {
    const Schema = z.object({
      source: PlaylistRefSchema,
      mode: z.enum(['count', 'decade', 'genre']),
      chunkSize: z.number().int().min(1).max(500).optional(),
    });
    const parsed = Schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    try {
      const result = await splitPlaylist(
        request.userId,
        parsed.data.source,
        parsed.data.mode,
        parsed.data.chunkSize,
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err?.message ?? 'Split failed' });
    }
  });

  // POST /api/tools/deduplicate
  app.post('/deduplicate', async (request, reply) => {
    const Schema = z.object({ source: PlaylistRefSchema });
    const parsed = Schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    try {
      const result = await deduplicatePlaylist(request.userId, parsed.data.source);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err?.message ?? 'Dedup failed' });
    }
  });

  // POST /api/tools/analyze
  app.post('/analyze', async (request, reply) => {
    const Schema = z.object({
      source: PlaylistRefSchema.optional(),
      tracks: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            artists: z.array(z.string()),
            album: z.string().optional(),
            durationMs: z.number().optional(),
            releaseYear: z.number().optional(),
            isrc: z.string().optional(),
          }),
        )
        .optional(),
    });

    const parsed = Schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    try {
      let tracks = parsed.data.tracks ?? [];

      if (tracks.length === 0 && parsed.data.source) {
        const conn = await prisma.platformConnection.findFirst({
          where: { userId: request.userId, platform: parsed.data.source.platform as any, isActive: true },
        });
        if (!conn) {
          return reply.status(422).send({ error: `No active connection for platform: ${parsed.data.source.platform}` });
        }
        const adapter = adapterRegistry.getAdapter(parsed.data.source.platform as any);
        const token = await getValidTokens(conn.id);
        tracks = await adapter.getPlaylistTracks(token, parsed.data.source.playlistId);
      }

      const analysis = analyzePlaylist(tracks as any);
      return reply.send(analysis);
    } catch (err: any) {
      return reply.status(500).send({ error: err?.message ?? 'Analysis failed' });
    }
  });

  // POST /api/tools/health-check
  app.post('/health-check', async (request, reply) => {
    const Schema = z.object({ source: PlaylistRefSchema });
    const parsed = Schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    try {
      const result = await checkPlaylistHealth(request.userId, parsed.data.source);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err?.message ?? 'Health check failed' });
    }
  });

  // GET /api/tools/search?q=&platforms=
  app.get('/search', async (request, reply) => {
    const QuerySchema = z.object({
      q: z.string().min(1),
      platforms: z.string().optional(),
    });
    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const platforms = parsed.data.platforms
      ? parsed.data.platforms.split(',').map((p) => p.trim())
      : undefined;

    try {
      const results = await crossPlatformSearch(request.userId, parsed.data.q, platforms);
      return reply.send({ results });
    } catch (err: any) {
      return reply.status(500).send({ error: err?.message ?? 'Search failed' });
    }
  });
}
