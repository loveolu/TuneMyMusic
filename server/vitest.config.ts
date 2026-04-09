import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://tunemymusic:tunemymusic@localhost:5433/tunemymusic',
      JWT_SECRET: 'test-secret-for-testing-only',
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      REDIS_URL: 'redis://localhost:6379',
    },
  },
});
