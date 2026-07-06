import { prisma } from '../prisma.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { config } from '../config.js';
import { adapterRegistry } from './adapter-registry.js';
import type { OAuthTokens } from '@tunemymusic/types';

export async function getTokens(
  connectionId: string,
): Promise<{ accessToken: string; refreshToken?: string }> {
  const connection = await prisma.platformConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw new Error(`Connection not found: ${connectionId}`);
  }

  const accessToken = decrypt(connection.accessToken, config.encryptionKey);
  const refreshToken = connection.refreshToken
    ? decrypt(connection.refreshToken, config.encryptionKey)
    : undefined;

  return { accessToken, refreshToken };
}

export async function saveTokens(connectionId: string, tokens: OAuthTokens): Promise<void> {
  const encryptedAccessToken = encrypt(tokens.accessToken, config.encryptionKey);
  const encryptedRefreshToken = tokens.refreshToken
    ? encrypt(tokens.refreshToken, config.encryptionKey)
    : undefined;

  await prisma.platformConnection.update({
    where: { id: connectionId },
    data: {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiresAt: tokens.expiresAt,
    },
  });
}

export async function getValidTokens(connectionId: string): Promise<string> {
  const connection = await prisma.platformConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw new Error(`Connection not found: ${connectionId}`);
  }

  const accessToken = decrypt(connection.accessToken, config.encryptionKey);

  // Check if token is still valid (with 5-minute buffer)
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  if (connection.expiresAt && connection.expiresAt > fiveMinutesFromNow) {
    return accessToken;
  }

  // Token is expired or expiring soon — try to refresh
  if (!connection.refreshToken) {
    // No refresh token, return current access token and hope for the best
    return accessToken;
  }

  const refreshToken = decrypt(connection.refreshToken, config.encryptionKey);

  // Get the adapter for this platform
  const adapter = adapterRegistry.getAdapter(connection.platform as Parameters<typeof adapterRegistry.getAdapter>[0]);
  const newTokens = await adapter.refreshTokens(refreshToken);

  // Save the new tokens
  await saveTokens(connectionId, newTokens);

  return newTokens.accessToken;
}
