import { describe, it, expect, beforeAll } from 'vitest';
import { getApp } from './setup.js';
import { prisma } from '../src/prisma.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

// Helper: register a user and return token + userId
async function registerUser(email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password: 'password123', name: 'Plan Limit Test' },
  });
  expect(res.statusCode).toBe(201);
  return res.json() as { token: string; user: { id: string } };
}

// Helper: create a fake completed transfer for a user (bypass the queue)
async function createFakeTransfer(userId: string) {
  return prisma.transfer.create({
    data: {
      userId,
      sourcePlatform: 'SPOTIFY',
      destinationPlatform: 'DEEZER',
      sourcePlaylistId: 'fake-id',
      sourcePlaylistName: 'Test Playlist',
      status: 'COMPLETED',
      totalTracks: 10,
      matchedTracks: 8,
    },
  });
}

beforeAll(() => {
  app = getApp();
});

describe('Plan limit enforcement — FREE user transfer limit', () => {
  it('allows a FREE user to make up to 3 transfers per month', async () => {
    const email = `free-limit-${Date.now()}@example.com`;
    const { token, user } = await registerUser(email);

    // Create 3 fake transfers (at the limit)
    await createFakeTransfer(user.id);
    await createFakeTransfer(user.id);
    await createFakeTransfer(user.id);

    // The 4th attempt (via API, which will hit the middleware) should be blocked
    const res = await app.inject({
      method: 'POST',
      url: '/api/transfers',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        sourcePlatform: 'SPOTIFY',
        destinationPlatform: 'DEEZER',
        sourcePlaylistId: 'some-playlist-id',
        sourcePlaylistName: 'My Playlist',
        options: {
          createNew: true,
          addToExisting: false,
          keepOrder: true,
          makePublic: true,
          copyDescription: true,
          skipDuplicates: true,
          confidenceThreshold: 70,
          transferLiked: false,
        },
      },
    });

    expect(res.statusCode).toBe(429);
    const body = res.json();
    expect(body.code).toBe('TRANSFER_LIMIT_EXCEEDED');
  });

  it('allows a FREE user with 2 transfers to still create another', async () => {
    const email = `free-limit-2-${Date.now()}@example.com`;
    const { token, user } = await registerUser(email);

    // Create only 2 out of 3 allowed transfers
    await createFakeTransfer(user.id);
    await createFakeTransfer(user.id);

    // Attempting the 3rd — the service will fail due to no connections, not the limit
    const res = await app.inject({
      method: 'POST',
      url: '/api/transfers',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        sourcePlatform: 'SPOTIFY',
        destinationPlatform: 'DEEZER',
        sourcePlaylistId: 'some-playlist-id',
        sourcePlaylistName: 'My Playlist',
        options: {
          createNew: true,
          addToExisting: false,
          keepOrder: true,
          makePublic: true,
          copyDescription: true,
          skipDuplicates: true,
          confidenceThreshold: 70,
          transferLiked: false,
        },
      },
    });

    // Should NOT be 429 (limit) — will be 422 (no connection) or some other error
    expect(res.statusCode).not.toBe(429);
  });

  it('blocks FREE user connection beyond 2 platforms', async () => {
    const email = `conn-limit-${Date.now()}@example.com`;
    const { token, user } = await registerUser(email);

    // Manually insert 2 active connections into DB
    await prisma.platformConnection.create({
      data: {
        userId: user.id,
        platform: 'SPOTIFY',
        accessToken: 'encrypted-token-1',
        expiresAt: new Date(Date.now() + 3600_000),
        platformUserId: 'spotify-user-1',
        isActive: true,
      },
    });
    await prisma.platformConnection.create({
      data: {
        userId: user.id,
        platform: 'DEEZER',
        accessToken: 'encrypted-token-2',
        expiresAt: new Date(Date.now() + 3600_000),
        platformUserId: 'deezer-user-1',
        isActive: true,
      },
    });

    // Attempting to connect a 3rd platform — the callback will fail at limit check
    const res = await app.inject({
      method: 'POST',
      url: '/api/connections/youtube_music/callback',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        code: 'some-oauth-code',
        redirectUri: 'https://example.com/callback',
      },
    });

    expect(res.statusCode).toBe(429);
    const body = res.json();
    expect(body.code).toBe('CONNECTION_LIMIT_EXCEEDED');
  });

  it('does NOT block FREE user with 0 connections from connecting', async () => {
    const email = `conn-ok-${Date.now()}@example.com`;
    const { token } = await registerUser(email);

    // Should NOT be 429 — will fail elsewhere (OAuth exchange), not at the limit
    const res = await app.inject({
      method: 'POST',
      url: '/api/connections/spotify/callback',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        code: 'some-oauth-code',
        redirectUri: 'https://example.com/callback',
      },
    });

    expect(res.statusCode).not.toBe(429);
  });
});
