import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/require-auth.js';
import { checkConnectionLimit } from '../middleware/plan-limits.js';
import { prisma } from '../prisma.js';
import { adapterRegistry } from '../services/adapter-registry.js';
import { generateOAuthState, consumeOAuthState } from '../services/oauth-state-store.js';
import { encrypt } from '../utils/encryption.js';
import { config } from '../config.js';
import { PlatformId } from '@tunemymusic/types';
import { z } from 'zod';

const CallbackBodySchema = z.object({
  code: z.string(),
  redirectUri: z.string().url(),
  state: z.string().min(1),
});

const AuthUrlQuerySchema = z.object({
  redirectUri: z.string().url(),
});

export async function connectionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /api/connections — list all active connections
  app.get('/', async (request, reply) => {
    const connections = await prisma.platformConnection.findMany({
      where: { userId: request.userId, isActive: true },
      select: {
        id: true,
        platform: true,
        platformUserId: true,
        platformUsername: true,
        connectedAt: true,
        isActive: true,
      },
    });

    return reply.send({ connections });
  });

  // GET /api/connections/:platform/auth-url — get OAuth URL
  app.get('/:platform/auth-url', async (request, reply) => {
    const { platform } = request.params as { platform: string };
    const platformParsed = PlatformId.safeParse(platform.toUpperCase());

    if (!platformParsed.success) {
      return reply.status(400).send({ error: `Invalid platform: ${platform}` });
    }

    const queryParsed = AuthUrlQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      return reply.status(400).send({ error: 'Missing or invalid redirectUri query parameter' });
    }

    try {
      const adapter = adapterRegistry.getAdapter(platformParsed.data);
      // Generate a random one-shot state token bound to (userId, platform,
      // redirectUri). Stored server-side; verified on callback to prevent
      // CSRF and cross-account linking.
      const state = generateOAuthState({
        userId: request.userId,
        platform: platformParsed.data,
        redirectUri: queryParsed.data.redirectUri,
      });
      const url = adapter.getAuthUrl(state, queryParsed.data.redirectUri);
      return reply.send({ url });
    } catch (err: any) {
      if (err?.message?.includes('unavailable') || err?.message?.includes('not supported')) {
        return reply.status(503).send({ error: err.message });
      }
      return reply.status(500).send({ error: err?.message ?? 'Failed to get auth URL' });
    }
  });

  // POST /api/connections/:platform/callback — exchange code for tokens
  app.post('/:platform/callback', { preHandler: checkConnectionLimit }, async (request, reply) => {
    const { platform } = request.params as { platform: string };
    const platformParsed = PlatformId.safeParse(platform.toUpperCase());

    if (!platformParsed.success) {
      return reply.status(400).send({ error: `Invalid platform: ${platform}` });
    }

    const bodyParsed = CallbackBodySchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply
        .status(400)
        .send({ error: 'Validation failed', details: bodyParsed.error.issues });
    }

    const { code, redirectUri, state } = bodyParsed.data;

    // Verify state — must match a server-issued nonce for THIS user, platform,
    // and redirectUri. One-shot: consumeOAuthState removes it from the store.
    const stateEntry = consumeOAuthState(state);
    if (
      !stateEntry ||
      stateEntry.userId !== request.userId ||
      stateEntry.platform !== platformParsed.data ||
      stateEntry.redirectUri !== redirectUri
    ) {
      return reply.status(400).send({ error: 'Invalid or expired OAuth state' });
    }

    try {
      const adapter = adapterRegistry.getAdapter(platformParsed.data);

      // Exchange code for tokens. `state` is forwarded so adapters that store
      // per-flow secrets (e.g. Tidal PKCE code_verifier) can resolve them.
      const tokens = await adapter.exchangeCodeForTokens(code, redirectUri, state);

      // Get user profile from platform
      const profile = await adapter.getUserProfile(tokens.accessToken);

      // Encrypt tokens
      const encryptedAccessToken = encrypt(tokens.accessToken, config.encryptionKey);
      const encryptedRefreshToken = tokens.refreshToken
        ? encrypt(tokens.refreshToken, config.encryptionKey)
        : undefined;

      // Upsert the connection
      const connection = await prisma.platformConnection.upsert({
        where: {
          userId_platform_platformUserId: {
            userId: request.userId,
            platform: platformParsed.data as any,
            platformUserId: profile.platformUserId,
          },
        },
        create: {
          userId: request.userId,
          platform: platformParsed.data as any,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken ?? null,
          expiresAt: tokens.expiresAt,
          platformUserId: profile.platformUserId,
          platformUsername: profile.displayName,
          isActive: true,
        },
        update: {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken ?? undefined,
          expiresAt: tokens.expiresAt,
          platformUsername: profile.displayName,
          isActive: true,
        },
        select: {
          id: true,
          platform: true,
          platformUserId: true,
          platformUsername: true,
          connectedAt: true,
          isActive: true,
        },
      });

      return reply.status(201).send({ connection });
    } catch (err: any) {
      if (err?.message?.includes('unavailable') || err?.message?.includes('not supported')) {
        return reply.status(503).send({ error: err.message });
      }
      return reply.status(500).send({ error: err?.message ?? 'Failed to connect platform' });
    }
  });

  // DELETE /api/connections/:platform — disconnect (soft delete)
  app.delete('/:platform', async (request, reply) => {
    const { platform } = request.params as { platform: string };
    const platformParsed = PlatformId.safeParse(platform.toUpperCase());

    if (!platformParsed.success) {
      return reply.status(400).send({ error: `Invalid platform: ${platform}` });
    }

    const connection = await prisma.platformConnection.findFirst({
      where: {
        userId: request.userId,
        platform: platformParsed.data as any,
        isActive: true,
      },
    });

    if (!connection) {
      return reply.status(404).send({ error: `No active connection found for platform: ${platform}` });
    }

    await prisma.platformConnection.update({
      where: { id: connection.id },
      data: { isActive: false },
    });

    return reply.send({ message: `Disconnected from ${platform}` });
  });
}
