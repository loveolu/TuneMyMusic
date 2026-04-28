import { randomBytes } from 'node:crypto';

/**
 * OAuth `state` parameter store.
 *
 * Used to bind the OAuth authorization request (issued by `getAuthUrl`) to the
 * eventual callback. Without this, the `state` query param can be forged and
 * the callback handler would accept any code → CSRF / account-linking attack.
 *
 * Each entry is single-use (consume() deletes it) and expires after TTL_MS.
 *
 * In-memory only: for horizontally scaled deployments swap to a Redis-backed
 * store keyed `oauth-state:<state>` with the same API.
 */

const TTL_MS = 10 * 60 * 1000; // 10 minutes — generous OAuth flow window

interface StateEntry {
  userId: string;
  platform: string;
  redirectUri: string;
  expiresAt: number;
}

const store = new Map<string, StateEntry>();

// Periodic cleanup of expired entries. .unref() so it doesn't block shutdown.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}, 60_000);
cleanupTimer.unref?.();

export function generateOAuthState(params: {
  userId: string;
  platform: string;
  redirectUri: string;
}): string {
  // 256-bit random nonce, base64url-encoded.
  const nonce = randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  store.set(nonce, {
    userId: params.userId,
    platform: params.platform,
    redirectUri: params.redirectUri,
    expiresAt: Date.now() + TTL_MS,
  });
  return nonce;
}

/**
 * Consume a state token. Returns the entry on success and removes it from the
 * store (one-shot). Returns null if the token is missing, expired, or already
 * consumed.
 */
export function consumeOAuthState(state: string): StateEntry | null {
  const entry = store.get(state);
  if (!entry) return null;
  store.delete(state);
  if (entry.expiresAt <= Date.now()) return null;
  return entry;
}

/** Test-only helper to flush the store between tests. */
export function _resetOAuthStateStoreForTests(): void {
  store.clear();
}
