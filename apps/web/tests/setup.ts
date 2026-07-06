/**
 * Test environment bootstrapping for the web app.
 *
 * Kept intentionally minimal: only the polyfills and mocks needed for pure
 * utility / presentational-component tests. Heavier setup (e.g.
 * @testing-library/jest-dom matchers) is left to opt-in inside individual
 * test files until the relevant deps are installed.
 */

// Stub out `window.matchMedia` for components that touch it (next-themes,
// motion reduced-motion checks, etc.) so jsdom doesn't throw.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
