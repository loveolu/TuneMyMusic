import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/require-auth.js';
import { prisma } from '../prisma.js';
import { adapterRegistry } from '../services/adapter-registry.js';
import { getValidTokens } from '../services/token-service.js';
import { PlatformId } from '@tunemymusic/types';
import { z } from 'zod';

const PlatformQuerySchema = z.object({
  platform: PlatformId,
});

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

async function getConnectionForPlatform(userId: string, platform: string) {
  const connection = await prisma.platformConnection.findFirst({
    where: {
      userId,
      platform: platform as any,
      isActive: true,
    },
  });

  if (!connection) {
    throw new Error(`No active connection for platform: ${platform}`);
  }

  return connection;
}

export async function playlistRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /api/playlists?platform=SPOTIFY
  app.get('/', async (request, reply) => {
    const parsed = PlatformQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: 'Missing or invalid platform query parameter', details: parsed.error.issues });
    }

    const { platform } = parsed.data;

    try {
      const connection = await getConnectionForPlatform(request.userId, platform);
      const adapter = adapterRegistry.getAdapter(platform);
      const accessToken = await getValidTokens(connection.id);
      const playlists = await adapter.getUserPlaylists(accessToken);
      return reply.send({ playlists });
    } catch (err: any) {
      if (err?.message?.includes('No active connection')) {
        return reply.status(404).send({ error: err.message });
      }
      if (err?.message?.includes('unavailable')) {
        return reply.status(503).send({ error: err.message });
      }
      return reply.status(500).send({ error: err?.message ?? 'Failed to fetch playlists' });
    }
  });

  // GET /api/playlists/:platform/:playlistId — playlist metadata
  app.get('/:platform/:playlistId', async (request, reply) => {
    const { platform, playlistId } = request.params as { platform: string; playlistId: string };

    const platformParsed = PlatformId.safeParse(platform.toUpperCase());
    if (!platformParsed.success) {
      return reply.status(400).send({ error: `Invalid platform: ${platform}` });
    }

    try {
      const connection = await getConnectionForPlatform(request.userId, platformParsed.data);
      const adapter = adapterRegistry.getAdapter(platformParsed.data);
      const accessToken = await getValidTokens(connection.id);
      const playlists = await adapter.getUserPlaylists(accessToken);

      const playlist = playlists.find((p) => p.id === playlistId);
      if (!playlist) {
        return reply.status(404).send({ error: 'Playlist not found' });
      }

      return reply.send({ playlist });
    } catch (err: any) {
      if (err?.message?.includes('No active connection')) {
        return reply.status(404).send({ error: err.message });
      }
      return reply.status(500).send({ error: err?.message ?? 'Failed to fetch playlist' });
    }
  });

  // GET /api/playlists/:platform/:playlistId/tracks — tracks (paginated)
  app.get('/:platform/:playlistId/tracks', async (request, reply) => {
    const { platform, playlistId } = request.params as { platform: string; playlistId: string };

    const platformParsed = PlatformId.safeParse(platform.toUpperCase());
    if (!platformParsed.success) {
      return reply.status(400).send({ error: `Invalid platform: ${platform}` });
    }

    const paginationParsed = PaginationSchema.safeParse(request.query);
    if (!paginationParsed.success) {
      return reply.status(400).send({ error: 'Invalid pagination params' });
    }

    const { page, limit } = paginationParsed.data;

    try {
      const connection = await getConnectionForPlatform(request.userId, platformParsed.data);
      const adapter = adapterRegistry.getAdapter(platformParsed.data);
      const accessToken = await getValidTokens(connection.id);
      const allTracks = await adapter.getPlaylistTracks(accessToken, playlistId);

      const start = (page - 1) * limit;
      const tracks = allTracks.slice(start, start + limit);
      const total = allTracks.length;

      return reply.send({
        tracks,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err: any) {
      if (err?.message?.includes('No active connection')) {
        return reply.status(404).send({ error: err.message });
      }
      return reply.status(500).send({ error: err?.message ?? 'Failed to fetch tracks' });
    }
  });

  // GET /api/playlists/liked?platform=SPOTIFY
  app.get('/liked', async (request, reply) => {
    const parsed = PlatformQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: 'Missing or invalid platform query parameter', details: parsed.error.issues });
    }

    const { platform } = parsed.data;

    const paginationParsed = PaginationSchema.safeParse(request.query);
    const { page, limit } = paginationParsed.success
      ? paginationParsed.data
      : { page: 1, limit: 50 };

    try {
      const connection = await getConnectionForPlatform(request.userId, platform);
      const adapter = adapterRegistry.getAdapter(platform);
      const accessToken = await getValidTokens(connection.id);
      const allTracks = await adapter.getLikedSongs(accessToken);

      const start = (page - 1) * limit;
      const tracks = allTracks.slice(start, start + limit);
      const total = allTracks.length;

      return reply.send({
        tracks,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err: any) {
      if (err?.message?.includes('No active connection')) {
        return reply.status(404).send({ error: err.message });
      }
      if (err?.message?.includes('unavailable')) {
        return reply.status(503).send({ error: err.message });
      }
      return reply.status(500).send({ error: err?.message ?? 'Failed to fetch liked songs' });
    }
  });
}
