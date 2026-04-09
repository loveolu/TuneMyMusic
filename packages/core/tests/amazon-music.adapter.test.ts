import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AmazonMusicAdapter } from '../src/adapters/amazon-music.adapter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrack(overrides: Record<string, unknown> = {}) {
  return {
    id: 'track-1',
    title: 'Bohemian Rhapsody',
    artists: [{ name: 'Queen' }],
    album: { title: 'A Night at the Opera', imageUrl: 'https://example.com/art.jpg' },
    durationSeconds: 354,
    isrc: 'GBAYE0601498',
    previewUrl: 'https://example.com/preview.mp3',
    releaseDate: '1975-10-31',
    ...overrides,
  };
}

function makePlaylist(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pl-1',
    title: 'My Playlist',
    description: 'A great playlist',
    trackCount: 10,
    imageUrl: 'https://example.com/pl.jpg',
    isPublic: true,
    owner: { name: 'JohnDoe' },
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

const TEST_CONFIG = { clientId: 'test-client-id', clientSecret: 'test-client-secret' };
const ACCESS_TOKEN = 'test-access-token';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let adapter: AmazonMusicAdapter;

beforeEach(() => {
  adapter = new AmazonMusicAdapter(TEST_CONFIG);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AmazonMusicAdapter', () => {
  it('has correct platformId and displayName', () => {
    expect(adapter.platformId).toBe('AMAZON_MUSIC');
    expect(adapter.displayName).toBe('Amazon Music');
    expect(adapter.supportsWrite).toBe(true);
  });

  // ---- Auth ----------------------------------------------------------------

  describe('getAuthUrl', () => {
    it('returns correct Amazon OAuth URL', () => {
      const url = adapter.getAuthUrl('mystate', 'https://app.example.com/callback');

      expect(url).toContain('https://www.amazon.com/ap/oa');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('state=mystate');
      expect(url).toContain(encodeURIComponent('https://app.example.com/callback'));
    });

    it('includes required scopes', () => {
      const url = adapter.getAuthUrl('s', 'https://redirect');
      expect(url).toContain('profile');
      expect(url).toContain('amazon_music');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('posts code to token endpoint and returns tokens', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch({
          access_token: 'acc-tok',
          refresh_token: 'ref-tok',
          expires_in: 3600,
          token_type: 'bearer',
          scope: 'profile amazon_music:access',
        }),
      );

      const tokens = await adapter.exchangeCodeForTokens('auth-code', 'https://redirect');

      expect(tokens.accessToken).toBe('acc-tok');
      expect(tokens.refreshToken).toBe('ref-tok');
      expect(tokens.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(tokens.scope).toBe('profile amazon_music:access');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toBe('https://api.amazon.com/auth/o2/token');
      expect(fetchCall[1].method).toBe('POST');
      const body = new URLSearchParams(fetchCall[1].body as string);
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('code')).toBe('auth-code');
      expect(body.get('client_id')).toBe('test-client-id');
      expect(body.get('client_secret')).toBe('test-client-secret');
    });

    it('throws on token exchange failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: () => Promise.resolve('invalid_grant'),
        }),
      );
      await expect(adapter.exchangeCodeForTokens('bad', 'https://r')).rejects.toThrow(
        'token exchange failed 400',
      );
    });
  });

  describe('refreshTokens', () => {
    it('posts refresh_token grant type and returns new tokens', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch({ access_token: 'new-acc', refresh_token: 'new-ref', expires_in: 3600 }),
      );

      const tokens = await adapter.refreshTokens('old-refresh-token');
      expect(tokens.accessToken).toBe('new-acc');
      expect(tokens.refreshToken).toBe('new-ref');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = new URLSearchParams(fetchCall[1].body as string);
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('refresh_token')).toBe('old-refresh-token');
    });

    it('falls back to existing refresh token if none returned', async () => {
      vi.stubGlobal('fetch', mockFetch({ access_token: 'new-acc', expires_in: 3600 }));
      const tokens = await adapter.refreshTokens('keep-this-refresh');
      expect(tokens.refreshToken).toBe('keep-this-refresh');
    });
  });

  // ---- User profile --------------------------------------------------------

  describe('getUserProfile', () => {
    it('maps Amazon user profile response', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch({ user_id: 'u-123', name: 'John Doe', email: 'john@example.com' }),
      );

      const profile = await adapter.getUserProfile(ACCESS_TOKEN);
      expect(profile.platformUserId).toBe('u-123');
      expect(profile.displayName).toBe('John Doe');
      expect(profile.email).toBe('john@example.com');
    });

    it('falls back to nested profile field', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch({ user_id: 'u-456', profile: { name: 'Jane', email: 'jane@example.com' } }),
      );

      const profile = await adapter.getUserProfile(ACCESS_TOKEN);
      expect(profile.displayName).toBe('Jane');
      expect(profile.email).toBe('jane@example.com');
    });
  });

  // ---- Playlists -----------------------------------------------------------

  describe('getUserPlaylists', () => {
    it('maps Amazon playlists to Playlist type', async () => {
      vi.stubGlobal('fetch', mockFetch({ playlists: [makePlaylist()] }));

      const playlists = await adapter.getUserPlaylists(ACCESS_TOKEN);

      expect(playlists).toHaveLength(1);
      const [pl] = playlists;
      expect(pl.id).toBe('pl-1');
      expect(pl.name).toBe('My Playlist');
      expect(pl.platform).toBe('AMAZON_MUSIC');
      expect(pl.description).toBe('A great playlist');
      expect(pl.trackCount).toBe(10);
      expect(pl.isPublic).toBe(true);
      expect(pl.owner).toBe('JohnDoe');
      expect(pl.artworkUrl).toBe('https://example.com/pl.jpg');
    });

    it('handles empty playlists array', async () => {
      vi.stubGlobal('fetch', mockFetch({ playlists: [] }));
      const playlists = await adapter.getUserPlaylists(ACCESS_TOKEN);
      expect(playlists).toEqual([]);
    });
  });

  describe('getPlaylistTracks', () => {
    it('maps tracks to Track type', async () => {
      vi.stubGlobal('fetch', mockFetch({ tracks: [makeTrack()] }));

      const tracks = await adapter.getPlaylistTracks(ACCESS_TOKEN, 'pl-1');

      expect(tracks).toHaveLength(1);
      const [t] = tracks;
      expect(t.id).toBe('track-1');
      expect(t.name).toBe('Bohemian Rhapsody');
      expect(t.artists).toEqual(['Queen']);
      expect(t.album).toBe('A Night at the Opera');
      expect(t.durationMs).toBe(354000);
      expect(t.isrc).toBe('GBAYE0601498');
      expect(t.platformId).toBe('AMAZON_MUSIC');
      expect(t.releaseYear).toBe(1975);
    });

    it('calls the correct endpoint', async () => {
      vi.stubGlobal('fetch', mockFetch({ tracks: [] }));

      await adapter.getPlaylistTracks(ACCESS_TOKEN, 'my-playlist-id');

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('/playlists/my-playlist-id/tracks');
    });
  });

  describe('createPlaylist', () => {
    it('posts correct body to /me/playlists and returns mapped playlist', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetch({ playlist: makePlaylist({ id: 'new-pl', title: 'Fresh Beats' }) }),
      );

      const pl = await adapter.createPlaylist(ACCESS_TOKEN, 'Fresh Beats', 'Hot new tracks', true);

      expect(pl.id).toBe('new-pl');
      expect(pl.name).toBe('Fresh Beats');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain('/me/playlists');
      expect(fetchCall[1].method).toBe('POST');
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.title).toBe('Fresh Beats');
      expect(body.description).toBe('Hot new tracks');
      expect(body.isPublic).toBe(true);
    });
  });

  describe('addTracksToPlaylist', () => {
    it('posts track IDs to correct endpoint', async () => {
      vi.stubGlobal('fetch', mockFetch(undefined, 204));

      await adapter.addTracksToPlaylist(ACCESS_TOKEN, 'pl-42', ['t1', 't2', 't3']);

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain('/playlists/pl-42/tracks');
      expect(fetchCall[1].method).toBe('POST');
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.trackIds).toEqual(['t1', 't2', 't3']);
    });
  });

  // ---- Search --------------------------------------------------------------

  describe('searchTrack', () => {
    it('builds correct query URL and maps results', async () => {
      vi.stubGlobal('fetch', mockFetch({ tracks: [makeTrack()] }));

      const results = await adapter.searchTrack(ACCESS_TOKEN, {
        name: 'Bohemian Rhapsody',
        artist: 'Queen',
      });

      expect(results).toHaveLength(1);
      expect(results[0].track.name).toBe('Bohemian Rhapsody');
      expect(results[0].score).toBe(0);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('/search');
      expect(url).toContain('type=track');
      expect(url).toContain('Queen');
      expect(url).toContain('Bohemian');
    });

    it('returns empty array when no tracks in response', async () => {
      vi.stubGlobal('fetch', mockFetch({ tracks: [] }));
      const results = await adapter.searchTrack(ACCESS_TOKEN, { name: 'X', artist: 'Y' });
      expect(results).toEqual([]);
    });
  });

  describe('searchAlbum', () => {
    it('builds correct query URL for album search', async () => {
      const album = {
        id: 'al-1',
        title: 'A Night at the Opera',
        artists: [{ name: 'Queen' }],
        imageUrl: 'https://example.com/al.jpg',
        releaseDate: '1975-11-21',
        trackCount: 12,
      };
      vi.stubGlobal('fetch', mockFetch({ albums: [album] }));

      const albums = await adapter.searchAlbum(ACCESS_TOKEN, {
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
      expect(url).toContain('type=album');
    });
  });

  // ---- Liked songs ---------------------------------------------------------

  describe('getLikedSongs', () => {
    it('returns mapped tracks from /me/tracks', async () => {
      vi.stubGlobal('fetch', mockFetch({ tracks: [makeTrack()] }));

      const tracks = await adapter.getLikedSongs(ACCESS_TOKEN);
      expect(tracks).toHaveLength(1);
      expect(tracks[0].name).toBe('Bohemian Rhapsody');

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('/me/tracks');
    });

    it('respects limit parameter', async () => {
      const trackList = Array.from({ length: 10 }, (_, i) => makeTrack({ id: `t${i}` }));
      vi.stubGlobal('fetch', mockFetch({ tracks: trackList }));

      const result = await adapter.getLikedSongs(ACCESS_TOKEN, 4);
      expect(result).toHaveLength(4);
    });
  });

  describe('likeTrack', () => {
    it('sends PUT request to /me/tracks/{id}', async () => {
      vi.stubGlobal('fetch', mockFetch(undefined, 204));

      await adapter.likeTrack(ACCESS_TOKEN, 'track-777');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain('/me/tracks/track-777');
      expect(fetchCall[1].method).toBe('PUT');
    });
  });

  // ---- Error handling ------------------------------------------------------

  describe('error handling', () => {
    it('throws descriptive error on non-200 API response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          headers: { get: () => null },
          text: () => Promise.resolve('Forbidden'),
        }),
      );

      await expect(adapter.getUserPlaylists(ACCESS_TOKEN)).rejects.toThrow(
        'Amazon Music API error 403',
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
          json: () => Promise.resolve({ playlists: [] }),
          text: () => Promise.resolve(''),
        });

      vi.stubGlobal('fetch', fetchFn);

      const promise = adapter.getUserPlaylists(ACCESS_TOKEN);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual([]);
      expect(fetchFn).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('sets Authorization header on all requests', async () => {
      vi.stubGlobal('fetch', mockFetch({ playlists: [] }));

      await adapter.getUserPlaylists('my-bearer-token');

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[1].headers['Authorization']).toBe('Bearer my-bearer-token');
    });
  });
});
