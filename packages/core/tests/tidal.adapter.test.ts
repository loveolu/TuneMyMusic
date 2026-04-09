import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TidalAdapter } from '../src/adapters/tidal.adapter.js';

// ─── Fetch mock helper ────────────────────────────────────────────────────────

function mockFetch(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  const status = options.status ?? 200;
  const headers = new Headers(options.headers ?? { 'Content-Type': 'application/json' });

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

describe('TidalAdapter', () => {
  let adapter: TidalAdapter;

  beforeEach(() => {
    adapter = new TidalAdapter({ clientId: 'test-client-id', clientSecret: 'test-secret', countryCode: 'US' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── getAuthUrl ─────────────────────────────────────────────────────────────

  describe('getAuthUrl', () => {
    it('returns a URL pointing to the Tidal authorize endpoint', () => {
      const url = adapter.getAuthUrl('my-state', 'https://app.example.com/callback');
      expect(url).toContain('https://login.tidal.com/authorize');
    });

    it('includes all required OAuth parameters', () => {
      const url = adapter.getAuthUrl('state123', 'https://app.example.com/callback');
      const parsed = new URL(url);
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
      expect(parsed.searchParams.get('redirect_uri')).toBe('https://app.example.com/callback');
      expect(parsed.searchParams.get('state')).toBe('state123');
    });

    it('includes the required scopes', () => {
      const url = adapter.getAuthUrl('s', 'https://cb.example.com');
      const parsed = new URL(url);
      const scope = parsed.searchParams.get('scope') ?? '';
      expect(scope).toContain('playlists.read');
      expect(scope).toContain('playlists.write');
      expect(scope).toContain('collection.read');
      expect(scope).toContain('collection.write');
    });

    it('includes PKCE code_challenge_method S256', () => {
      const url = adapter.getAuthUrl('s', 'https://cb.example.com');
      const parsed = new URL(url);
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    });
  });

  // ── exchangeCodeForTokens ──────────────────────────────────────────────────

  describe('exchangeCodeForTokens', () => {
    it('returns OAuthTokens from a successful token response', async () => {
      mockFetch({
        access_token: 'tidal-access-token',
        refresh_token: 'tidal-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'playlists.read',
      });

      const tokens = await adapter.exchangeCodeForTokens('auth-code', 'https://cb.example.com');
      expect(tokens.accessToken).toBe('tidal-access-token');
      expect(tokens.refreshToken).toBe('tidal-refresh-token');
      expect(tokens.expiresAt).toBeInstanceOf(Date);
    });

    it('POSTs to the token URL with Authorization Basic header', async () => {
      mockFetch({
        access_token: 'tok',
        refresh_token: 'ref',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      await adapter.exchangeCodeForTokens('code', 'https://cb.example.com');

      const fetchMock = vi.mocked(fetch);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://auth.tidal.com/v1/oauth2/token');
      expect((init.headers as Record<string, string>)['Authorization']).toContain('Basic ');
    });
  });

  // ── getUserPlaylists ───────────────────────────────────────────────────────

  describe('getUserPlaylists', () => {
    it('maps Tidal playlist response to Playlist type', async () => {
      mockFetch({
        data: [
          {
            uuid: 'playlist-uuid-1',
            title: 'My Playlist',
            description: 'A great playlist',
            numberOfTracks: 10,
            squareImage: 'https://cdn.tidal.com/art.jpg',
            publicPlaylist: true,
            creator: { id: 123, name: 'TestUser' },
            url: 'https://tidal.com/playlist/playlist-uuid-1',
          },
        ],
        metadata: { total: 1, offset: 0, limit: 50 },
      });

      const playlists = await adapter.getUserPlaylists('access-token');
      expect(playlists).toHaveLength(1);
      const p = playlists[0];
      expect(p.id).toBe('playlist-uuid-1');
      expect(p.name).toBe('My Playlist');
      expect(p.platform).toBe('TIDAL');
      expect(p.trackCount).toBe(10);
      expect(p.isPublic).toBe(true);
      expect(p.owner).toBe('TestUser');
    });

    it('sends Authorization Bearer header', async () => {
      mockFetch({ data: [], metadata: { total: 0 } });

      await adapter.getUserPlaylists('my-access-token');

      const fetchMock = vi.mocked(fetch);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-access-token');
    });

    it('sends countryCode header', async () => {
      mockFetch({ data: [], metadata: { total: 0 } });

      await adapter.getUserPlaylists('tok');

      const fetchMock = vi.mocked(fetch);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['countryCode']).toBe('US');
    });

    it('paginates until all playlists are fetched', async () => {
      // First page
      const firstPage = {
        data: Array.from({ length: 50 }, (_, i) => ({
          uuid: `uuid-${i}`,
          title: `Playlist ${i}`,
          numberOfTracks: i,
          publicPlaylist: true,
        })),
        metadata: { total: 60, offset: 0, limit: 50 },
      };
      // Second page
      const secondPage = {
        data: Array.from({ length: 10 }, (_, i) => ({
          uuid: `uuid-${50 + i}`,
          title: `Playlist ${50 + i}`,
          numberOfTracks: 0,
          publicPlaylist: true,
        })),
        metadata: { total: 60, offset: 50, limit: 50 },
      };

      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve(firstPage),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve(secondPage),
        }),
      );

      const playlists = await adapter.getUserPlaylists('tok');
      expect(playlists).toHaveLength(60);
    });
  });

  // ── getPlaylistTracks ──────────────────────────────────────────────────────

  describe('getPlaylistTracks', () => {
    it('maps Tidal track items to Track type with ISRC', async () => {
      mockFetch({
        data: [
          {
            item: {
              id: '99887766',
              title: 'Bohemian Rhapsody',
              duration: 354,
              isrc: 'GBAYE0601498',
              artists: [{ id: '1', name: 'Queen' }],
              album: { id: '123', title: 'A Night at the Opera', releaseDate: '1975-11-21' },
            },
            type: 'track',
          },
        ],
        metadata: { total: 1 },
      });

      const tracks = await adapter.getPlaylistTracks('tok', 'some-playlist-id');
      expect(tracks).toHaveLength(1);
      const t = tracks[0];
      expect(t.id).toBe('99887766');
      expect(t.name).toBe('Bohemian Rhapsody');
      expect(t.artists).toEqual(['Queen']);
      expect(t.isrc).toBe('GBAYE0601498');
      expect(t.durationMs).toBe(354_000);
      expect(t.platformId).toBe('TIDAL');
      expect(t.releaseYear).toBe(1975);
    });
  });

  // ── searchTrack ────────────────────────────────────────────────────────────

  describe('searchTrack', () => {
    it('builds the correct search URL from query fields', async () => {
      mockFetch({ data: [], metadata: { total: 0 } });

      await adapter.searchTrack('tok', { name: 'Rhapsody', artist: 'Queen', album: 'Opera' });

      const fetchMock = vi.mocked(fetch);
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('/searchresults/');
      expect(decodeURIComponent(url)).toContain('Queen');
      expect(decodeURIComponent(url)).toContain('Rhapsody');
      expect(decodeURIComponent(url)).toContain('Opera');
      expect(url).toContain('/tracks');
    });

    it('returns TrackSearchResult array', async () => {
      mockFetch({
        data: [
          {
            id: '111',
            title: 'Bohemian Rhapsody',
            duration: 354,
            isrc: 'GBAYE0601498',
            artists: [{ id: '1', name: 'Queen' }],
          },
        ],
        metadata: { total: 1 },
      });

      const results = await adapter.searchTrack('tok', { name: 'Bohemian Rhapsody', artist: 'Queen' });
      expect(results).toHaveLength(1);
      expect(results[0].track.name).toBe('Bohemian Rhapsody');
      expect(results[0].score).toBeTypeOf('number');
    });
  });

  // ── searchAlbum ────────────────────────────────────────────────────────────

  describe('searchAlbum', () => {
    it('returns Album array mapped from Tidal response', async () => {
      mockFetch({
        data: [
          {
            id: '456',
            title: 'A Night at the Opera',
            imagePath: 'https://cdn.tidal.com/art.jpg',
            releaseDate: '1975-11-21',
            numberOfTracks: 12,
            artists: [{ id: '1', name: 'Queen' }],
          },
        ],
        metadata: { total: 1 },
      });

      const albums = await adapter.searchAlbum('tok', { name: 'A Night at the Opera', artist: 'Queen' });
      expect(albums).toHaveLength(1);
      expect(albums[0].id).toBe('456');
      expect(albums[0].name).toBe('A Night at the Opera');
      expect(albums[0].artist).toBe('Queen');
      expect(albums[0].releaseYear).toBe(1975);
    });
  });

  // ── addTracksToPlaylist ────────────────────────────────────────────────────

  describe('addTracksToPlaylist', () => {
    it('batches track IDs into chunks of 100', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({}),
      }));

      const trackIds = Array.from({ length: 250 }, (_, i) => String(i + 1));
      await adapter.addTracksToPlaylist('tok', 'pl-id', trackIds);

      const fetchMock = vi.mocked(fetch);
      // 250 tracks / 100 per batch = 3 calls
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('throws a descriptive error on non-OK responses', async () => {
      mockFetchError(403, { userMessage: 'Forbidden' });

      await expect(adapter.getUserPlaylists('bad-token')).rejects.toThrow('[TidalAdapter]');
      await expect(adapter.getUserPlaylists('bad-token')).rejects.toThrow('403');
    });

    it('retries on 429 and then throws if still failing', async () => {
      vi.useFakeTimers();

      const rateLimitResponse = {
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '0' }),
        json: () => Promise.resolve({}),
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(rateLimitResponse));

      const assertion = expect(adapter.getUserPlaylists('tok')).rejects.toThrow('[TidalAdapter]');
      // Advance timers to skip retry delays
      await vi.runAllTimersAsync();
      await assertion;

      vi.useRealTimers();
    });
  });
});
