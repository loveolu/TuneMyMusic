import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppleMusicAdapter } from '../src/adapters/apple-music.adapter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSong(overrides: Record<string, unknown> = {}) {
  return {
    id: 'song-1',
    attributes: {
      name: 'Bohemian Rhapsody',
      artistName: 'Queen',
      albumName: 'A Night at the Opera',
      durationInMillis: 354000,
      isrc: 'GBAYE0601498',
      artwork: {
        url: 'https://example.com/{w}x{h}bb.jpg',
        width: 3000,
        height: 3000,
      },
      previews: [{ url: 'https://example.com/preview.mp3' }],
      releaseDate: '1975-10-31',
    },
    ...overrides,
  };
}

function makePlaylist(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pl-1',
    attributes: {
      name: 'My Playlist',
      description: { standard: 'A great playlist' },
      isPublic: false,
      curatorName: 'Queen Fan',
      artwork: {
        url: 'https://example.com/{w}x{h}pl.jpg',
        width: 1500,
        height: 1500,
      },
    },
    ...overrides,
  };
}

function mockFetch(body: unknown, status = 200): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

// Minimal adapter config — generateDeveloperToken will be bypassed in tests
// by mocking crypto.subtle so we don't need real Apple keys.
const TEST_CONFIG = {
  keyId: 'TESTKEYID',
  teamId: 'TESTTEAMID',
  privateKey:
    '-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgFAKE\n-----END PRIVATE KEY-----',
  storefront: 'us',
};

const USER_TOKEN = 'test-music-user-token';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let adapter: AppleMusicAdapter;

beforeEach(() => {
  adapter = new AppleMusicAdapter(TEST_CONFIG);

  // Stub out crypto.subtle so developer token generation always succeeds
  // without needing a real EC private key.
  vi.stubGlobal('crypto', {
    subtle: {
      importKey: vi.fn().mockResolvedValue({ type: 'private' }),
      sign: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer),
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppleMusicAdapter', () => {
  it('has correct platformId and displayName', () => {
    expect(adapter.platformId).toBe('APPLE_MUSIC');
    expect(adapter.displayName).toBe('Apple Music');
    expect(adapter.supportsWrite).toBe(true);
  });

  // ---- Auth ----------------------------------------------------------------

  describe('getAuthUrl', () => {
    it('returns apple-music://authorize placeholder', () => {
      const url = adapter.getAuthUrl('state123', 'https://app.example.com/callback');
      expect(url).toBe('apple-music://authorize');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('wraps the music user token as the accessToken', async () => {
      const tokens = await adapter.exchangeCodeForTokens('my-user-token', 'https://redirect');
      expect(tokens.accessToken).toBe('my-user-token');
      expect(tokens.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('refreshTokens', () => {
    it('returns the existing token as-is', async () => {
      const tokens = await adapter.refreshTokens('existing-token');
      expect(tokens.accessToken).toBe('existing-token');
    });
  });

  // ---- User profile --------------------------------------------------------

  describe('getUserProfile', () => {
    it('returns a profile with platformUserId derived from the token', async () => {
      const profile = await adapter.getUserProfile('abcdefghijklmnop');
      expect(profile.platformUserId).toContain('abcdefgh');
      expect(typeof profile.displayName).toBe('string');
    });
  });

  // ---- Playlists -----------------------------------------------------------

  describe('getUserPlaylists', () => {
    it('maps Apple Music playlists to Playlist type', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch({ data: [makePlaylist()], next: undefined }),
      );

      const playlists = await adapter.getUserPlaylists(USER_TOKEN);

      expect(playlists).toHaveLength(1);
      const [pl] = playlists;
      expect(pl.id).toBe('pl-1');
      expect(pl.name).toBe('My Playlist');
      expect(pl.platform).toBe('APPLE_MUSIC');
      expect(pl.description).toBe('A great playlist');
      expect(pl.isPublic).toBe(false);
      expect(pl.owner).toBe('Queen Fan');
      // Artwork URL should have {w}/{h} substituted
      expect(pl.artworkUrl).toContain('300');
    });

    it('follows pagination via `next` field', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () =>
            Promise.resolve({
              data: [makePlaylist()],
              next: 'https://api.music.apple.com/v1/me/library/playlists?offset=100',
            }),
          text: () => Promise.resolve(''),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () =>
            Promise.resolve({
              data: [makePlaylist({ id: 'pl-2', attributes: { name: 'Second', isPublic: true } })],
              next: undefined,
            }),
          text: () => Promise.resolve(''),
        });

      vi.stubGlobal('fetch', fetchFn);

      const playlists = await adapter.getUserPlaylists(USER_TOKEN);
      expect(playlists).toHaveLength(2);
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('getPlaylistTracks', () => {
    it('maps songs to Track type', async () => {
      vi.stubGlobal('fetch', mockFetch({ data: [makeSong()], next: undefined }));

      const tracks = await adapter.getPlaylistTracks(USER_TOKEN, 'pl-1');

      expect(tracks).toHaveLength(1);
      const [t] = tracks;
      expect(t.id).toBe('song-1');
      expect(t.name).toBe('Bohemian Rhapsody');
      expect(t.artists).toEqual(['Queen']);
      expect(t.album).toBe('A Night at the Opera');
      expect(t.durationMs).toBe(354000);
      expect(t.isrc).toBe('GBAYE0601498');
      expect(t.platformId).toBe('APPLE_MUSIC');
      expect(t.releaseYear).toBe(1975);
    });
  });

  describe('createPlaylist', () => {
    it('posts correct body and maps response', async () => {
      const created = makePlaylist({ id: 'new-pl', attributes: { name: 'New Playlist', isPublic: false } });
      vi.stubGlobal('fetch', mockFetch({ data: [created] }));

      const pl = await adapter.createPlaylist(USER_TOKEN, 'New Playlist', 'desc');

      expect(pl.id).toBe('new-pl');
      expect(pl.name).toBe('New Playlist');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.attributes.name).toBe('New Playlist');
      expect(body.attributes.description).toBe('desc');
    });
  });

  describe('addTracksToPlaylist', () => {
    it('sends track IDs as library-songs type', async () => {
      vi.stubGlobal('fetch', mockFetch(undefined, 204));

      await adapter.addTracksToPlaylist(USER_TOKEN, 'pl-1', ['s1', 's2']);

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.data).toHaveLength(2);
      expect(body.data[0]).toEqual({ id: 's1', type: 'library-songs' });
    });

    it('batches more than 100 tracks into multiple requests', async () => {
      vi.stubGlobal('fetch', mockFetch(undefined, 204));

      const ids = Array.from({ length: 150 }, (_, i) => `track-${i}`);
      await adapter.addTracksToPlaylist(USER_TOKEN, 'pl-1', ids);

      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    });
  });

  // ---- Search --------------------------------------------------------------

  describe('searchTrack', () => {
    it('builds correct catalog search URL with encoded query', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch({ results: { songs: { data: [makeSong()] } } }),
      );

      const results = await adapter.searchTrack(USER_TOKEN, {
        name: 'Bohemian Rhapsody',
        artist: 'Queen',
      });

      expect(results).toHaveLength(1);
      expect(results[0].track.name).toBe('Bohemian Rhapsody');
      expect(results[0].score).toBe(0);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('/catalog/us/search');
      expect(url).toContain('types=songs');
      expect(url).toContain('Queen');
      expect(url).toContain('Bohemian');
    });

    it('returns empty array when no songs in results', async () => {
      vi.stubGlobal('fetch', mockFetch({ results: {} }));
      const results = await adapter.searchTrack(USER_TOKEN, { name: 'X', artist: 'Y' });
      expect(results).toEqual([]);
    });
  });

  describe('searchAlbum', () => {
    it('builds correct catalog search URL for albums', async () => {
      const album = {
        id: 'al-1',
        attributes: {
          name: 'A Night at the Opera',
          artistName: 'Queen',
          releaseDate: '1975-11-21',
          trackCount: 12,
          artwork: { url: 'https://example.com/{w}x{h}.jpg', width: 3000, height: 3000 },
        },
      };
      vi.stubGlobal('fetch', mockFetch({ results: { albums: { data: [album] } } }));

      const albums = await adapter.searchAlbum(USER_TOKEN, {
        name: 'A Night at the Opera',
        artist: 'Queen',
      });

      expect(albums).toHaveLength(1);
      expect(albums[0].id).toBe('al-1');
      expect(albums[0].name).toBe('A Night at the Opera');
      expect(albums[0].artist).toBe('Queen');
      expect(albums[0].releaseYear).toBe(1975);
      expect(albums[0].trackCount).toBe(12);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('types=albums');
    });
  });

  // ---- Liked songs ---------------------------------------------------------

  describe('getLikedSongs', () => {
    it('returns mapped tracks from library songs endpoint', async () => {
      vi.stubGlobal('fetch', mockFetch({ data: [makeSong()], next: undefined }));

      const tracks = await adapter.getLikedSongs(USER_TOKEN);
      expect(tracks).toHaveLength(1);
      expect(tracks[0].name).toBe('Bohemian Rhapsody');

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('/me/library/songs');
    });

    it('respects limit parameter', async () => {
      const songs = Array.from({ length: 5 }, (_, i) => makeSong({ id: `s${i}` }));
      vi.stubGlobal('fetch', mockFetch({ data: songs, next: undefined }));

      const tracks = await adapter.getLikedSongs(USER_TOKEN, 3);
      expect(tracks).toHaveLength(3);
    });
  });

  describe('likeTrack', () => {
    it('posts to /me/library with correct song type', async () => {
      vi.stubGlobal('fetch', mockFetch(undefined, 204));

      await adapter.likeTrack(USER_TOKEN, 'song-999');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain('/me/library');
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.data[0]).toEqual({ id: 'song-999', type: 'songs' });
    });
  });

  // ---- Error handling ------------------------------------------------------

  describe('error handling', () => {
    it('throws descriptive error on non-200 response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          headers: { get: () => null },
          text: () => Promise.resolve('Unauthorized'),
        }),
      );

      await expect(adapter.getUserPlaylists(USER_TOKEN)).rejects.toThrow(
        'Apple Music API error 401',
      );
    });

    it('retries once on 429 and respects Retry-After', async () => {
      vi.useFakeTimers();

      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: (h: string) => (h === 'Retry-After' ? '1' : null) },
          text: () => Promise.resolve(''),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () => Promise.resolve({ data: [], next: undefined }),
          text: () => Promise.resolve(''),
        });

      vi.stubGlobal('fetch', fetchFn);

      const promise = adapter.getUserPlaylists(USER_TOKEN);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual([]);
      expect(fetchFn).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });
});
