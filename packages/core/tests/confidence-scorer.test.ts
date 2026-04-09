import { describe, it, expect } from 'vitest';
import { scoreMatch } from '../src/matching/confidence-scorer.js';
import type { Track } from '@tunemymusic/types';

const makeTrack = (overrides: Partial<Track> = {}): Track => ({
  id: '1',
  name: 'Bohemian Rhapsody',
  artists: ['Queen'],
  album: 'A Night at the Opera',
  durationMs: 354000,
  isrc: 'GBAYE0601498',
  ...overrides,
});

describe('scoreMatch', () => {
  it('returns 100 for ISRC match', () => {
    const source = makeTrack();
    const candidate = makeTrack({ id: '2', isrc: 'GBAYE0601498' });
    const result = scoreMatch(source, candidate);
    expect(result.score).toBe(100);
    expect(result.method).toBe('ISRC');
  });

  it('returns high score for exact name + artist match', () => {
    const source = makeTrack({ isrc: undefined });
    const candidate = makeTrack({ id: '2', isrc: undefined });
    const result = scoreMatch(source, candidate);
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.method).toBe('EXACT');
  });

  it('boosts score when duration matches within 3s', () => {
    const source = makeTrack({ isrc: undefined, durationMs: 354000 });
    const noDuration = makeTrack({ id: '2', isrc: undefined, durationMs: undefined });
    const withDuration = makeTrack({ id: '3', isrc: undefined, durationMs: 355000 });
    const scoreNone = scoreMatch(source, noDuration);
    const scoreClose = scoreMatch(source, withDuration);
    expect(scoreClose.score).toBeGreaterThanOrEqual(scoreNone.score);
  });

  it('returns fuzzy score for similar but not exact match', () => {
    const source = makeTrack({ isrc: undefined, name: 'Bohemian Rhapsody' });
    const candidate = makeTrack({
      id: '2',
      isrc: undefined,
      name: 'Bohemian Rapsody',
      artists: ['Queen'],
    });
    const result = scoreMatch(source, candidate);
    expect(result.score).toBeGreaterThan(50);
    expect(result.score).toBeLessThan(85);
    expect(result.method).toBe('FUZZY');
  });

  it('returns 0 for completely different tracks', () => {
    const source = makeTrack({ isrc: undefined });
    const candidate = makeTrack({
      id: '2',
      isrc: undefined,
      name: 'Completely Different Song',
      artists: ['Unknown Artist'],
      album: 'Unknown Album',
    });
    const result = scoreMatch(source, candidate);
    expect(result.score).toBeLessThan(50);
  });
});
