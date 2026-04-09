import type { FastifyInstance } from 'fastify';

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

// Periodically clean up expired entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}, 60_000);

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
        // Use first 33 chars of the bearer token as rate limit key
        const tokenKey = authHeader.slice(7, 40);
        const key = `auth:${tokenKey}`;
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
