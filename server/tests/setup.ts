import { beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://tunemymusic:tunemymusic@localhost:5433/tunemymusic';
  process.env.JWT_SECRET = 'test-secret-for-testing-only';
  process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.REDIS_URL = 'redis://localhost:6379';

  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

export function getApp() {
  return app;
}
