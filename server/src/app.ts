import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: config.corsOrigin, credentials: true });

  app.get('/api/health', async () => ({ status: 'ok' }));

  return app;
}
