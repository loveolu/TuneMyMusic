import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/require-auth.js';
import { prisma } from '../prisma.js';
import { adapterRegistry } from '../services/adapter-registry.js';
import { getValidTokens } from '../services/token-service.js';
import { parseCsv, parseM3u } from '@tunemymusic/core';
import { parseItunesXml } from '@tunemymusic/core';
import type { Track } from '@tunemymusic/types';

export async function exportImportRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /api/export/:platform/:playlistId?format=csv|json|m3u
  app.get('/export/:platform/:playlistId', async (request, reply) => {
    const { platform, playlistId } = request.params as { platform: string; playlistId: string };

    const QuerySchema = z.object({
      format: z.enum(['csv', 'json', 'm3u']).default('csv'),
    });
    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid format' });
    }

    const connection = await prisma.platformConnection.findFirst({
      where: { userId: request.userId, platform: platform as any, isActive: true },
    });
    if (!connection) {
      return reply.status(422).send({ error: `No active connection for platform: ${platform}` });
    }

    let tracks: Track[];
    let playlistName = 'playlist';

    try {
      const adapter = adapterRegistry.getAdapter(platform as any);
      const token = await getValidTokens(connection.id);
      tracks = await adapter.getPlaylistTracks(token, playlistId);

      // Try to get playlist name
      try {
        const playlists = await adapter.getUserPlaylists(token);
        const match = playlists.find((p) => p.id === playlistId);
        if (match) playlistName = match.name;
      } catch {
        // Optional
      }
    } catch (err: any) {
      return reply.status(500).send({ error: err?.message ?? 'Failed to fetch tracks' });
    }

    const { format } = parsed.data;
    const safeFilename = playlistName.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'json') {
      return reply
        .header('Content-Disposition', `attachment; filename="${safeFilename}.json"`)
        .header('Content-Type', 'application/json')
        .send(JSON.stringify({ playlist: playlistName, platform, tracks }, null, 2));
    }

    if (format === 'm3u') {
      const lines = ['#EXTM3U'];
      for (const track of tracks) {
        const artist = track.artists[0] ?? 'Unknown Artist';
        const durationSec = track.durationMs ? Math.round(track.durationMs / 1000) : -1;
        lines.push(`#EXTINF:${durationSec},${artist} - ${track.name}`);
        lines.push(track.platformTrackId ?? track.id);
      }
      return reply
        .header('Content-Disposition', `attachment; filename="${safeFilename}.m3u"`)
        .header('Content-Type', 'audio/x-mpegurl')
        .send(lines.join('\n'));
    }

    // CSV format (default)
    const header = 'Track Name,Artist,Album,ISRC,Duration (ms),Release Year';
    const rows = tracks.map((track) => {
      const name = csvEscape(track.name);
      const artist = csvEscape(track.artists[0] ?? '');
      const album = csvEscape(track.album ?? '');
      const isrc = track.isrc ?? '';
      const duration = track.durationMs ?? '';
      const year = track.releaseYear ?? '';
      return `${name},${artist},${album},${isrc},${duration},${year}`;
    });

    return reply
      .header('Content-Disposition', `attachment; filename="${safeFilename}.csv"`)
      .header('Content-Type', 'text/csv')
      .send([header, ...rows].join('\n'));
  });

  // POST /api/import/file — accept CSV, M3U, or iTunes XML upload
  app.post('/import/file', async (request, reply) => {
    // We accept raw body as text with a content-type header indicating format
    const contentType = request.headers['content-type'] ?? '';
    const fileType = (request.query as any).type as string | undefined;

    let rawContent: string;
    if (typeof request.body === 'string') {
      rawContent = request.body;
    } else if (Buffer.isBuffer(request.body)) {
      rawContent = request.body.toString('utf-8');
    } else {
      rawContent = JSON.stringify(request.body);
    }

    let tracks: Track[];

    const detectedType = fileType ?? detectFileType(contentType, rawContent);

    try {
      switch (detectedType) {
        case 'm3u':
          tracks = parseM3u(rawContent);
          break;
        case 'itunes':
          tracks = parseItunesXml(rawContent);
          break;
        case 'csv':
        default:
          tracks = parseCsv(rawContent);
          break;
      }
    } catch (err: any) {
      return reply.status(400).send({ error: `Failed to parse file: ${err?.message}` });
    }

    return reply.send({
      type: detectedType,
      trackCount: tracks.length,
      tracks,
    });
  });
}

function detectFileType(contentType: string, content: string): string {
  if (contentType.includes('audio/x-mpegurl') || contentType.includes('audio/mpegurl')) {
    return 'm3u';
  }
  if (contentType.includes('text/xml') || contentType.includes('application/xml')) {
    return 'itunes';
  }
  if (content.trimStart().startsWith('#EXTM3U') || content.trimStart().startsWith('#EXTINF')) {
    return 'm3u';
  }
  if (content.trimStart().startsWith('<?xml') || content.includes('<plist')) {
    return 'itunes';
  }
  return 'csv';
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
