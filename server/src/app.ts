import Fastify from 'fastify';
import cors from '@fastify/cors';
import rawBody from 'fastify-raw-body';
import { config } from './config.js';
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

export async function buildApp() {
  const app = Fastify({ logger: true });

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

  app.get('/api/health', async () => ({ status: 'ok' }));

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
