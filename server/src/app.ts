import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { authRoutes } from './routes/auth.js';
import { connectionRoutes } from './routes/connections.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: config.corsOrigin, credentials: true });

  app.get('/api/health', async () => ({ status: 'ok' }));

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(connectionRoutes, { prefix: '/api/connections' });

  return app;
}
