import { describe, it, expect } from 'vitest';
import { jaroWinkler, levenshteinDistance, fuzzyMatch } from '../src/matching/fuzzy-matcher.js';

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('returns length for empty vs non-empty', () => {
    expect(levenshteinDistance('', 'hello')).toBe(5);
  });

  it('computes correct distance', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('jaroWinkler', () => {
  it('returns 1 for identical strings', () => {
    expect(jaroWinkler('hello', 'hello')).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    expect(jaroWinkler('', 'hello')).toBe(0);
  });

  it('returns high score for similar strings', () => {
    expect(jaroWinkler('bohemian rhapsody', 'bohemian rapsody')).toBeGreaterThan(0.95);
  });

  it('returns lower score for dissimilar strings', () => {
    expect(jaroWinkler('hello', 'world')).toBeLessThan(0.5);
  });
});

describe('fuzzyMatch', () => {
  it('returns 100 for exact match', () => {
    expect(fuzzyMatch('bohemian rhapsody', 'bohemian rhapsody')).toBe(100);
  });

  it('returns high score for close match', () => {
    const score = fuzzyMatch('bohemian rhapsody', 'bohemian rapsody');
    expect(score).toBeGreaterThan(90);
  });

  it('returns low score for poor match', () => {
    const score = fuzzyMatch('bohemian rhapsody', 'stairway to heaven');
    expect(score).toBeLessThan(50);
  });
});
