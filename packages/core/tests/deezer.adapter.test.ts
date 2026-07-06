import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeezerAdapter } from '../src/adapters/deezer.adapter.js';

// ─── Fetch mock helper ────────────────────────────────────────────────────────

function mockFetch(body: unknown, options: { status?: number; headers?: Record<string, string>; isText?: boolean } = {}) {
  const status = options.status ?? 200;
  const headers = new Headers(options.headers ?? {});

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  }));
}

function mockFetchError(status: number, errorBody: unknown = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status,
    headers,
    json: () => Promise.resolve(errorBody),
    text: () => Promise.resolve(JSON.stringify(errorBody)),
  }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DeezerAdapter', () => {
  let adapter: DeezerAdapter;

  beforeEach(() => {
    adapter = new DeezerAdapter({ appId: 'test-app-id', appSecret: 'test-app-secret' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── getAuthUrl ─────────────────────────────────────────────────────────────

  describe('getAuthUrl', () => {
    it('returns a URL pointing to Deezer authorize endpoint', () => {
      const url = adapter.getAuthUrl('my-state', 'https://app.example.com/callback');
      expect(url).toContain('https://connect.deezer.com/oauth/auth.php');
    });

    it('includes all required parameters', () => {
      const url = adapter.getAuthUrl('state123', 'https://app.example.com/callback');
      const parsed = new URL(url);
      expect(parsed.searchParams.get('app_id')).toBe('test-app-id');
      expect(parsed.searchParams.get('redirect_uri')).toBe('https://app.example.com/callback');
      expect(parsed.searchParams.get('state')).toBe('state123');
    });

    it('includes all required permissions', () => {
      const url = adapter.getAuthUrl('s', 'https://cb.example.com');
      const parsed = new URL(url);
      const perms = parsed.searchParams.get('perms') ?? '';
      expect(perms).toContain('basic_access');
      expect(perms).toContain('manage_library');
      expect(perms).toContain('offline_access');
    });

    it('does NOT include code_challenge (no PKCE for Deezer)', () => {
      const url = adapter.getAuthUrl('s', 'https://cb.example.com');
      const parsed = new URL(url);
      expect(parsed.searchParams.has('code_challenge')).toBe(false);
    });
  });

  // ── exchangeCodeForTokens ──────────────────────────────────────────────────

  describe('exchangeCodeForTokens', () => {
    it('parses plain-text token response', async () => {
      mockFetch('access_token=deezer-token-abc&expires=31536000');

      const tokens = await adapter.exchangeCodeForTokens('auth-code', 'https://cb.example.com');
      expect(tokens.accessToken).toBe('deezer-token-abc');
      expect(tokens.expiresAt).toBeInstanceOf(Date);
    });

    it('throws when token response does not contain access_token', async () => {
      mockFetch('error=invalid_grant&error_reason=bad_code');

      await expect(
        adapter.exchangeCodeForTokens('bad-code', 'https://cb.example.com'),
      ).rejects.toThrow('[DeezerAdapter]');
    });
  });

  // ── Access token as query param ────────────────────────────────────────────

  describe('access_token as query parameter', () => {
    it('passes access_token as query param NOT as Authorization header for getUserProfile', async () => {
      mockFetch({
        id: 12345,
        name: 'Test User',
        email: 'test@example.com',
        picture_medium: 'https://e-cdns-images.dzcdn.net/avatar.jpg',
      });

      await adapter.getUserProfile('my-deezer-token');

      const fetchMock = vi.mocked(fetch);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

      // Token must be in query string
      expect(url).toContain('access_token=my-deezer-token');

      // Must NOT have Authorization header
      const headers = (init.headers ?? {}) as Record<string, string>;
      expect(headers['Authorization']).toBeUndefined();
      expect(headers['authorization']).toBeUndefined();
    });

    it('passes access_token as query param for getUserPlaylists', async () => {
      mockFetch({ data: [], total: 0 });

      await adapter.getUserPlaylists('playlist-token');

      const fetchMock = vi.mocked(fetch);
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('access_token=playlist-token');
    });

    it('passes access_token as query param for searchTrack', async () => {
      mockFetch({ data: [], total: 0 });

      await adapter.searchTrack('search-token', { name: 'Song', artist: 'Artist' });

      const fetchMock = vi.mocked(fetch);
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('access_token=search-token');
    });

    it('passes access_token as query param for likeTrack', async () => {
      mockFetch(true);

      await adapter.likeTrack('like-token', '9876');

      const fetchMock = vi.mocked(fetch);
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('access_token=like-token');
    });
  });

  // ── getUserPlaylists ───────────────────────────────────────────────────────

  describe('getUserPlaylists', () => {
    it('maps Deezer playlist response to Playlist type', async () => {
      mockFetch({
        data: [
          {
            id: 9876543,
            title: 'Chill Vibes',
            description: 'Just vibing',
            nb_tracks: 42,
            picture_medium: 'https://e-cdns-images.dzcdn.net/art.jpg',
            public: true,
            creator: { id: 111, name: 'DeezerUser' },
            link: 'https://www.deezer.com/playlist/9876543',
          },
        ],
        total: 1,
      });

      const playlists = await adapter.getUserPlaylists('tok');
      expect(playlists).toHaveLength(1);
      const p = playlists[0];
      expect(p.id).toBe('9876543');
      expect(p.name).toBe('Chill Vibes');
      expect(p.platform).toBe('DEEZER');
      expect(p.trackCount).toBe(42);
      expect(p.isPublic).toBe(true);
      expect(p.owner).toBe('DeezerUser');
    });

    it('follows pagination via next URL', async () => {
      const page1 = {
        data: [
          { id: 1, title: 'Playlist 1', nb_tracks: 5, public: true },
        ],
        total: 2,
        next: 'https://api.deezer.com/user/me/playlists?index=1&limit=1',
      };
      const page2 = {
        data: [
          { id: 2, title: 'Playlist 2', nb_tracks: 3, public: false },
        ],
        total: 2,
      };

      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve(page1),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve(page2),
        }),
      );

      const playlists = await adapter.getUserPlaylists('tok');
      expect(playlists).toHaveLength(2);
    });
  });

  // ── getPlaylistTracks ──────────────────────────────────────────────────────

  describe('getPlaylistTracks', () => {
    it('maps Deezer track response with ISRC to Track type', async () => {
      mockFetch({
        data: [
          {
            id: 12345,
            title: 'Get Lucky',
            duration: 248,
            isrc: 'GBUM71307066',
            artist: { id: 10, name: 'Daft Punk' },
            album: {
              id: 20,
              title: 'Random Access Memories',
              cover_medium: 'https://e-cdns.dzcdn.net/cover.jpg',
              release_date: '2013-05-17',
            },
            preview: 'https://cdn.deezer.com/preview.mp3',
          },
        ],
        total: 1,
      });

      const tracks = await adapter.getPlaylistTracks('tok', '99999');
      expect(tracks).toHaveLength(1);
      const t = tracks[0];
      expect(t.id).toBe('12345');
      expect(t.name).toBe('Get Lucky');
      expect(t.artists).toEqual(['Daft Punk']);
      expect(t.isrc).toBe('GBUM71307066');
      expect(t.durationMs).toBe(248_000);
      expect(t.platformId).toBe('DEEZER');
      expect(t.releaseYear).toBe(2013);
      expect(t.previewUrl).toBe('https://cdn.deezer.com/preview.mp3');
    });
  });

  // ── searchTrack ────────────────────────────────────────────────────────────

  describe('searchTrack', () => {
    it('builds search URL with q parameter', async () => {
      mockFetch({ data: [], total: 0 });

      await adapter.searchTrack('tok', { name: 'Get Lucky', artist: 'Daft Punk' });

      const fetchMock = vi.mocked(fetch);
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('/search/track');
      expect(decodeURIComponent(url)).toContain('Daft Punk');
      expect(decodeURIComponent(url)).toContain('Get Lucky');
    });

    it('returns TrackSearchResult array', async () => {
      mockFetch({
        data: [
          {
            id: 12345,
            title: 'Get Lucky',
            duration: 248,
            isrc: 'GBUM71307066',
            artist: { id: 10, name: 'Daft Punk' },
          },
        ],
        total: 1,
      });

      const results = await adapter.searchTrack('tok', { name: 'Get Lucky', artist: 'Daft Punk' });
      expect(results).toHaveLength(1);
      expect(results[0].track.name).toBe('Get Lucky');
      expect(results[0].score).toBeTypeOf('number');
    });
  });

  // ── searchAlbum ────────────────────────────────────────────────────────────

  describe('searchAlbum', () => {
    it('builds search URL for albums', async () => {
      mockFetch({ data: [], total: 0 });

      await adapter.searchAlbum('tok', { name: 'Random Access Memories', artist: 'Daft Punk' });

      const fetchMock = vi.mocked(fetch);
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('/search/album');
    });

    it('maps Deezer album response to Album type', async () => {
      mockFetch({
        data: [
          {
            id: 888,
            title: 'Random Access Memories',
            cover_medium: 'https://e-cdns.dzcdn.net/cover.jpg',
            release_date: '2013-05-17',
            nb_tracks: 13,
            artist: { id: 10, name: 'Daft Punk' },
          },
        ],
        total: 1,
      });

      const albums = await adapter.searchAlbum('tok', { name: 'RAM', artist: 'Daft Punk' });
      expect(albums).toHaveLength(1);
      expect(albums[0].id).toBe('888');
      expect(albums[0].artist).toBe('Daft Punk');
      expect(albums[0].releaseYear).toBe(2013);
      expect(albums[0].trackCount).toBe(13);
    });
  });

  // ── createPlaylist ─────────────────────────────────────────────────────────

  describe('createPlaylist', () => {
    it('includes title as query param in POST URL', async () => {
      vi.stubGlobal('fetch', vi.fn()
        // First call: create returns { id }
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({ id: 55555 }),
        })
        // Second call: fetch full playlist
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({
            id: 55555,
            title: 'New Playlist',
            nb_tracks: 0,
            public: true,
          }),
        }),
      );

      const playlist = await adapter.createPlaylist('tok', 'New Playlist');
      const fetchMock = vi.mocked(fetch);

      const [firstUrl] = fetchMock.mock.calls[0] as [string];
      // encodeURIComponent encodes spaces as %20
      expect(firstUrl).toContain('title=New%20Playlist');

      expect(playlist.id).toBe('55555');
      expect(playlist.name).toBe('New Playlist');
      expect(playlist.platform).toBe('DEEZER');
    });
  });

  // ── addTracksToPlaylist ────────────────────────────────────────────────────

  describe('addTracksToPlaylist', () => {
    it('sends comma-separated track IDs in songs parameter', async () => {
      mockFetch(true);

      await adapter.addTracksToPlaylist('tok', '12345', ['1', '2', '3']);

      const fetchMock = vi.mocked(fetch);
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('songs=1%2C2%2C3');
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('throws a descriptive error on non-OK responses', async () => {
      mockFetchError(401, { error: { message: 'Unauthorized' } });

      await expect(adapter.getUserPlaylists('bad-token')).rejects.toThrow('[DeezerAdapter]');
      await expect(adapter.getUserPlaylists('bad-token')).rejects.toThrow('401');
    });

    it('refreshTokens throws explaining Deezer does not support refresh', async () => {
      await expect(adapter.refreshTokens('any-token')).rejects.toThrow('does not support token refresh');
    });

    it('retries on 429 and throws if all retries exhausted', async () => {
      vi.useFakeTimers();

      const rateLimitResponse = {
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '0' }),
        json: () => Promise.resolve({}),
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(rateLimitResponse));

      const assertion = expect(adapter.getUserPlaylists('tok')).rejects.toThrow('[DeezerAdapter]');
      await vi.runAllTimersAsync();
      await assertion;

      vi.useRealTimers();
    });
  });
});
