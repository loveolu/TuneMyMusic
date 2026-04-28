import { describe, it, expect } from 'vitest';
import {
  filterPlaylists,
  filterTracksByStatus,
  searchTracks,
  estimateRemainingTime,
  sortPlatformsByPriority,
} from '@/lib/filters';

describe('filterPlaylists', () => {
  const playlists = [
    { id: '1', name: 'Workout Mix', description: 'High-energy tracks' },
    { id: '2', name: 'Chill Vibes', description: 'Lo-fi for studying' },
    { id: '3', name: 'Roadtrip', description: undefined },
  ];

  it('returns the original list when query is empty', () => {
    expect(filterPlaylists(playlists, '')).toBe(playlists);
    expect(filterPlaylists(playlists, '   ')).toBe(playlists);
  });

  it('filters by name (case-insensitive)', () => {
    expect(filterPlaylists(playlists, 'workout').map((p) => p.id)).toEqual(['1']);
    expect(filterPlaylists(playlists, 'WORKOUT').map((p) => p.id)).toEqual(['1']);
  });

  it('filters by description when name does not match', () => {
    expect(filterPlaylists(playlists, 'lo-fi').map((p) => p.id)).toEqual(['2']);
  });

  it('matches partial substrings', () => {
    expect(filterPlaylists(playlists, 'road').map((p) => p.id)).toEqual(['3']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterPlaylists(playlists, 'nonexistent')).toEqual([]);
  });

  it('does not mutate the input', () => {
    const before = [...playlists];
    filterPlaylists(playlists, 'workout');
    expect(playlists).toEqual(before);
  });
});

describe('filterTracksByStatus', () => {
  const tracks = [
    { id: 't1', status: 'MATCHED' },
    { id: 't2', status: 'NOT_FOUND' },
    { id: 't3', status: 'MATCHED' },
    { id: 't4', status: 'PARTIAL_MATCH' },
    { id: 't5', status: 'FAILED' },
  ];

  it('returns the input when filter is ALL', () => {
    expect(filterTracksByStatus(tracks, 'ALL')).toBe(tracks);
  });

  it('returns the input when filter is undefined', () => {
    expect(filterTracksByStatus(tracks, undefined)).toBe(tracks);
  });

  it('filters by exact status', () => {
    expect(filterTracksByStatus(tracks, 'MATCHED').map((t) => t.id)).toEqual(['t1', 't3']);
    expect(filterTracksByStatus(tracks, 'FAILED').map((t) => t.id)).toEqual(['t5']);
  });

  it('returns an empty array when no track has the requested status', () => {
    expect(filterTracksByStatus(tracks, 'SKIPPED')).toEqual([]);
  });
});

describe('searchTracks', () => {
  const tracks = [
    { id: '1', sourceTrackName: 'Smells Like Teen Spirit', sourceArtist: 'Nirvana' },
    {
      id: '2',
      sourceTrackName: 'Bohemian Rhapsody',
      sourceArtist: 'Queen',
      destinationTrackName: 'Bohemian Rhapsody (2011 Remaster)',
    },
    { id: '3', sourceTrackName: 'Imagine', sourceArtist: 'John Lennon' },
  ];

  it('returns input unchanged for empty query', () => {
    expect(searchTracks(tracks, '')).toBe(tracks);
  });

  it('matches against source track name', () => {
    expect(searchTracks(tracks, 'imagine').map((t) => t.id)).toEqual(['3']);
  });

  it('matches against source artist', () => {
    expect(searchTracks(tracks, 'queen').map((t) => t.id)).toEqual(['2']);
  });

  it('matches against destination track name (renamed/remastered tracks)', () => {
    expect(searchTracks(tracks, 'remaster').map((t) => t.id)).toEqual(['2']);
  });

  it('is case-insensitive and order-agnostic', () => {
    expect(searchTracks(tracks, 'NIRVANA').map((t) => t.id)).toEqual(['1']);
  });
});

describe('estimateRemainingTime', () => {
  const start = 1_700_000_000_000; // arbitrary fixed epoch ms
  const sec = (s: number) => start + s * 1000;

  it('returns null when no tracks have been processed', () => {
    expect(
      estimateRemainingTime({ processed: 0, total: 100, startedAtMs: start, nowMs: sec(10) }),
    ).toBeNull();
  });

  it('returns null when total is zero', () => {
    expect(
      estimateRemainingTime({ processed: 5, total: 0, startedAtMs: start, nowMs: sec(10) }),
    ).toBeNull();
  });

  it('returns null when processed exceeds total (data inconsistency)', () => {
    expect(
      estimateRemainingTime({ processed: 110, total: 100, startedAtMs: start, nowMs: sec(10) }),
    ).toBeNull();
  });

  it('returns null when no time has elapsed', () => {
    expect(
      estimateRemainingTime({ processed: 5, total: 100, startedAtMs: start, nowMs: start }),
    ).toBeNull();
  });

  it('formats sub-minute estimates as <1m', () => {
    // 10 processed in 10 seconds → 1s/track → 90 remaining → 90s → still <1m? No, 90s = 1m round up.
    // Use a smaller remaining: 10 processed in 1 second → 0.1s/track → 5 left → 0.5s
    expect(
      estimateRemainingTime({ processed: 10, total: 15, startedAtMs: start, nowMs: sec(1) }),
    ).toBe('<1m left');
  });

  it('formats minute-level estimates', () => {
    // 10 processed in 30 seconds → 3s/track → 100 remaining → 300s = 5m
    expect(
      estimateRemainingTime({ processed: 10, total: 110, startedAtMs: start, nowMs: sec(30) }),
    ).toBe('~5m left');
  });

  it('formats hour-level estimates', () => {
    // 10 processed in 60s → 6s/track → 990 remaining → ~5940s = ~99m → 1h 39m
    expect(
      estimateRemainingTime({ processed: 10, total: 1000, startedAtMs: start, nowMs: sec(60) }),
    ).toMatch(/^~1h \d+m left$/);
  });
});

describe('sortPlatformsByPriority', () => {
  it('orders Tier 1 platforms before Tier 2/3', () => {
    const input = [
      { platform: 'CSV' },
      { platform: 'SPOTIFY' },
      { platform: 'PANDORA' },
      { platform: 'APPLE_MUSIC' },
    ];
    const sorted = sortPlatformsByPriority(input).map((p) => p.platform);
    expect(sorted).toEqual(['SPOTIFY', 'APPLE_MUSIC', 'PANDORA', 'CSV']);
  });

  it('does not mutate the input array', () => {
    const input = [{ platform: 'TIDAL' }, { platform: 'SPOTIFY' }];
    const before = [...input];
    sortPlatformsByPriority(input);
    expect(input).toEqual(before);
  });

  it('falls back to alphabetical for unknown platforms', () => {
    const input = [{ platform: 'ZUNE' }, { platform: 'BANDCAMP' }];
    expect(sortPlatformsByPriority(input).map((p) => p.platform)).toEqual(['BANDCAMP', 'ZUNE']);
  });
});
