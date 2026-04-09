import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { authRoutes } from './routes/auth.js';
import { connectionRoutes } from './routes/connections.js';
import { transferRoutes } from './routes/transfers.js';
import { playlistRoutes } from './routes/playlists.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: config.corsOrigin, credentials: true });

  app.get('/api/health', async () => ({ status: 'ok' }));

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(connectionRoutes, { prefix: '/api/connections' });
  await app.register(transferRoutes, { prefix: '/api/transfers' });
  await app.register(playlistRoutes, { prefix: '/api/playlists' });

  return app;
}
