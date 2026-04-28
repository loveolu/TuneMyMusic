import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest config for the Next.js web app. Runs in `jsdom` so React Testing
 * Library has a DOM, but doesn't try to bundle Next-specific things — tests
 * should target pure utilities (`src/lib/*`) and presentational components
 * that can be imported standalone.
 *
 * To add component tests, install (NOT in this commit):
 *   pnpm add -DF web @testing-library/react @testing-library/jest-dom \
 *     @testing-library/user-event jsdom happy-dom
 * and import them in `tests/setup.ts`.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
