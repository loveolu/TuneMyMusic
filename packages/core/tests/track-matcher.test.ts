import { describe, it, expect } from 'vitest';
import { TrackMatcher } from '../src/matching/track-matcher.js';
import type { Track, TrackSearchResult } from '@tunemymusic/types';

const makeTrack = (overrides: Partial<Track> = {}): Track => ({
  id: '1',
  name: 'Bohemian Rhapsody',
  artists: ['Queen'],
  album: 'A Night at the Opera',
  durationMs: 354000,
  isrc: 'GBAYE0601498',
  ...overrides,
});

describe('TrackMatcher', () => {
  it('finds best match from candidates', () => {
    const matcher = new TrackMatcher({ confidenceThreshold: 70 });
    const source = makeTrack();
    const candidates: TrackSearchResult[] = [
      { track: makeTrack({ id: '2', isrc: 'GBAYE0601498' }), score: 0 },
      { track: makeTrack({ id: '3', isrc: undefined, name: 'Something Else' }), score: 0 },
    ];

    const result = matcher.findBestMatch(source, candidates);
    expect(result).not.toBeNull();
    expect(result!.track.id).toBe('2');
    expect(result!.score).toBe(100);
    expect(result!.method).toBe('ISRC');
  });

  it('returns null when no candidate meets threshold', () => {
    const matcher = new TrackMatcher({ confidenceThreshold: 90 });
    const source = makeTrack({ isrc: undefined });
    const candidates: TrackSearchResult[] = [
      {
        track: makeTrack({ id: '2', isrc: undefined, name: 'Totally Different', artists: ['Nobody'] }),
        score: 0,
      },
    ];

    const result = matcher.findBestMatch(source, candidates);
    expect(result).toBeNull();
  });

  it('prefers higher confidence matches', () => {
    const matcher = new TrackMatcher({ confidenceThreshold: 50 });
    const source = makeTrack({ isrc: undefined });
    const candidates: TrackSearchResult[] = [
      {
        track: makeTrack({ id: '2', isrc: undefined, name: 'Bohemian Rapsody', artists: ['Queen'] }),
        score: 0,
      },
      {
        track: makeTrack({ id: '3', isrc: undefined, name: 'Bohemian Rhapsody', artists: ['Queen'] }),
        score: 0,
      },
    ];

    const result = matcher.findBestMatch(source, candidates);
    expect(result).not.toBeNull();
    expect(result!.track.id).toBe('3');
  });
});
