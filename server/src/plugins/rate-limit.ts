import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';

interface RateLimitOptions {
  // Public endpoints (auth): 10 req/min per IP
  publicMax?: number;
  publicWindowMs?: number;
  // Authenticated endpoints: 100 req/min per user
  authMax?: number;
  authWindowMs?: number;
}

// In-memory store: key -> { count, resetAt }
const store = new Map<string, { count: number; resetAt: number }>();

function checkLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }

  if (entry.count >= max) {
    return false; // rate limited
  }

  entry.count++;
  return true; // allowed
}

// Periodically clean up expired entries to prevent memory leaks.
// `.unref()` so the timer doesn't block process shutdown.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}, 60_000);
cleanupTimer.unref?.();

/**
 * Derive a per-user rate-limit key from a JWT.
 *
 * Strategy: decode (NOT verify) the payload and use `userId`/`sub` as the key.
 * If the token is malformed or doesn't contain a user id, fall back to the
 * SHA-256 of the full token — this is still per-token (not per-user) but
 * uniformly distributed, unlike the previous `slice(7, 40)` which keyed on
 * the JWT *header* and so collided across all authed users.
 */
function deriveAuthKey(jwtToken: string): string {
  const parts = jwtToken.split('.');
  if (parts.length === 3) {
    try {
      // base64url-decode payload
      const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson) as { userId?: string; sub?: string };
      const id = payload.userId ?? payload.sub;
      if (id && typeof id === 'string') return `user:${id}`;
    } catch {
      // fall through to hash fallback
    }
  }
  return `tok:${createHash('sha256').update(jwtToken).digest('hex').slice(0, 32)}`;
}

export async function registerRateLimit(app: FastifyInstance, opts: RateLimitOptions = {}) {
  const {
    publicMax = 10,
    publicWindowMs = 60_000,
    authMax = 100,
    authWindowMs = 60_000,
  } = opts;

  app.addHook('onRequest', async (request, reply) => {
    const url = request.url;

    // Apply public rate limit to auth endpoints
    if (url.startsWith('/api/auth/')) {
      const ip = request.ip ?? '127.0.0.1';
      const key = `public:${ip}`;
      if (!checkLimit(key, publicMax, publicWindowMs)) {
        return reply.status(429).send({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please wait before trying again.',
          retryAfter: Math.ceil(publicWindowMs / 1000),
        });
      }
      return;
    }

    // Apply auth rate limit to all other /api/ routes (skip stripe webhooks)
    if (url.startsWith('/api/') && !url.startsWith('/api/stripe/')) {
      const authHeader = request.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        // Key on the user id decoded from the JWT payload — NOT a fixed slice
        // of the bearer token. Previous `authHeader.slice(7, 40)` keyed on
        // the constant JWT *header*, so all authed users shared one bucket.
        const token = authHeader.slice(7);
        const key = `auth:${deriveAuthKey(token)}`;
        if (!checkLimit(key, authMax, authWindowMs)) {
          return reply.status(429).send({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please slow down.',
            retryAfter: Math.ceil(authWindowMs / 1000),
          });
        }
      }
    }
  });
}
