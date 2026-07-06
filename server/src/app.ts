import Fastify from 'fastify';
import cors from '@fastify/cors';
import rawBody from 'fastify-raw-body';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { prisma } from './prisma.js';
import { authRoutes } from './routes/auth.js';
import { connectionRoutes } from './routes/connections.js';
import { transferRoutes } from './routes/transfers.js';
import { playlistRoutes } from './routes/playlists.js';
import { billingRoutes, stripeWebhookRoute } from './routes/billing.js';
import { notificationRoutes } from './routes/notifications.js';
import { userRoutes } from './routes/user.js';
import { registerRateLimit } from './plugins/rate-limit.js';
import { scheduleRoutes } from './routes/schedules.js';
import { toolRoutes } from './routes/tools.js';
import { likedSongsRoutes } from './routes/liked-songs.js';
import { exportImportRoutes } from './routes/export-import.js';
import { statsRoutes } from './routes/stats.js';
import { pingRedis } from './services/redis-health.js';

export async function buildApp() {
  const app = Fastify({
    // genReqId: prefer an inbound `x-request-id` header (so a load balancer or
    // upstream gateway can correlate logs), otherwise mint a random UUID.
    // The id is logged on every request line and is also surfaced as a
    // response header below for client-side debugging.
    genReqId: (req) => {
      const incoming = req.headers['x-request-id'];
      if (typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128) {
        return incoming;
      }
      return randomUUID();
    },
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      // Redact common secret-bearing fields so a 4xx/5xx with downstream-API
      // payloads can't leak bearer tokens to wherever logs end up.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["stripe-signature"]',
          '*.accessToken',
          '*.refreshToken',
          '*.password',
          '*.passwordHash',
        ],
        censor: '[REDACTED]',
      },
    },
    // Disable Fastify's default request log line; we emit our own structured
    // line in onResponse with the request id and duration.
    disableRequestLogging: true,
  });

  // Echo the request id on the response so the browser/client can include it
  // in any bug report or support ticket. Clients can also pre-set
  // x-request-id and we'll honor it (see genReqId above).
  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  // Structured per-request log line correlating method, path, status, ms.
  // BullMQ workers should grab `request.id` from job data and log under the
  // same key so a single transfer can be traced end-to-end.
  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: reply.elapsedTime,
        userId: (request as { userId?: string }).userId,
      },
      'request completed',
    );
  });

  await app.register(cors, { origin: config.corsOrigin, credentials: true });

  // Register raw-body plugin so Stripe webhook handler can verify signatures.
  // `global: false` means routes opt in via { config: { rawBody: true } }.
  await app.register(rawBody, {
    field: 'rawBody',
    global: false,
    runFirst: true,
    encoding: false, // keep raw Buffer (required by stripe.webhooks.constructEvent)
  });

  // Register rate limiting (in-memory, no extra deps)
  await registerRateLimit(app);

  // Cheap liveness probe — no DB/Redis touch. Use this for k8s liveness.
  app.get('/api/health', async () => ({ status: 'ok' }));

  // Deeper readiness probe — pings DB + Redis. Use this for k8s readiness or
  // an external uptime check. Returns 200 only when ALL critical
  // dependencies are reachable, otherwise 503 with a per-component breakdown
  // so on-call can identify the failing piece without shelling in.
  app.get('/healthz', async (_request, reply) => {
    const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};
    let allOk = true;

    // Postgres: SELECT 1 with a soft 2s timeout.
    {
      const t0 = Date.now();
      try {
        await Promise.race([
          prisma.$queryRaw`SELECT 1`,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
        ]);
        checks.postgres = { ok: true, latencyMs: Date.now() - t0 };
      } catch (err: any) {
        allOk = false;
        checks.postgres = { ok: false, error: err?.message ?? 'unknown' };
      }
    }

    // Redis: PING with a soft 2s timeout.
    {
      const t0 = Date.now();
      try {
        await Promise.race([
          pingRedis(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
        ]);
        checks.redis = { ok: true, latencyMs: Date.now() - t0 };
      } catch (err: any) {
        allOk = false;
        checks.redis = { ok: false, error: err?.message ?? 'unknown' };
      }
    }

    return reply.status(allOk ? 200 : 503).send({
      status: allOk ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    });
  });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(connectionRoutes, { prefix: '/api/connections' });
  await app.register(transferRoutes, { prefix: '/api/transfers' });
  await app.register(playlistRoutes, { prefix: '/api/playlists' });
  await app.register(billingRoutes, { prefix: '/api/billing' });
  await app.register(stripeWebhookRoute, { prefix: '/api/stripe' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });
  await app.register(userRoutes, { prefix: '/api/user' });
  await app.register(scheduleRoutes, { prefix: '/api/schedules' });
  await app.register(toolRoutes, { prefix: '/api/tools' });
  await app.register(likedSongsRoutes, { prefix: '/api/liked-songs' });
  await app.register(exportImportRoutes, { prefix: '/api' });
  await app.register(statsRoutes, { prefix: '/api/user' });

  return app;
}
