import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpotifyAdapter } from '../src/adapters/spotify.adapter.js';

const TOKEN = 'test-access-token';
const adapter = new SpotifyAdapter({ clientId: 'client-id', clientSecret: 'client-secret' });

function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function makeSpotifyTrack(overrides: Record<string, unknown> = {}) {
  return {
    id: 'track-1',
    name: 'Test Song',
    artists: [{ name: 'Test Artist' }],
    album: {
      name: 'Test Album',
      images: [{ url: 'https://example.com/art.jpg', height: 300, width: 300 }],
      release_date: '2023-01-15',
    },
    duration_ms: 180000,
    external_ids: { isrc: 'USAT12345678' },
    preview_url: 'https://preview.example.com/track1',
    ...overrides,
  };
}

describe('SpotifyAdapter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- getAuthUrl ----
  describe('getAuthUrl', () => {
    it('returns a URL pointing to accounts.spotify.com/authorize', () => {
      const url = adapter.getAuthUrl('my-state', 'https://app.example.com/callback');
      expect(url).toContain('https://accounts.spotify.com/authorize');
    });

    it('includes all required scopes', () => {
      const url = adapter.getAuthUrl('state', 'https://redirect.example.com');
      const parsed = new URL(url);
      const scope = parsed.searchParams.get('scope') ?? '';
      expect(scope).toContain('playlist-read-private');
      expect(scope).toContain('playlist-modify-public');
      expect(scope).toContain('playlist-modify-private');
      expect(scope).toContain('user-library-read');
      expect(scope).toContain('user-library-modify');
      expect(scope).toContain('user-read-private');
    });

    it('includes state and redirect_uri in the URL', () => {
      const state = 'random-state-123';
      const redirectUri = 'https://app.example.com/callback';
      const url = adapter.getAuthUrl(state, redirectUri);
      const parsed = new URL(url);
      expect(parsed.searchParams.get('state')).toBe(state);
      expect(parsed.searchParams.get('redirect_uri')).toBe(redirectUri);
    });

    it('sets response_type=code', () => {
      const url = adapter.getAuthUrl('s', 'https://r.example.com');
      const parsed = new URL(url);
      expect(parsed.searchParams.get('response_type')).toBe('code');
    });
  });

  // ---- getUserPlaylists ----
  describe('getUserPlaylists', () => {
    it('maps Spotify playlist objects to Playlist type', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        makeResponse({
          items: [
            {
              id: 'pl-1',
              name: 'My Playlist',
              description: 'Cool playlist',
              images: [{ url: 'https://example.com/cover.jpg', height: 300, width: 300 }],
              public: true,
              owner: { display_name: 'Test User', id: 'user-1' },
              tracks: { total: 42 },
              external_urls: { spotify: 'https://open.spotify.com/playlist/pl-1' },
            },
          ],
          next: null,
          total: 1,
          limit: 50,
          offset: 0,
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const playlists = await adapter.getUserPlaylists(TOKEN);

      expect(playlists).toHaveLength(1);
      expect(playlists[0]).toMatchObject({
        id: 'pl-1',
        name: 'My Playlist',
        description: 'Cool playlist',
        platform: 'SPOTIFY',
        trackCount: 42,
        artworkUrl: 'https://example.com/cover.jpg',
        isPublic: true,
        owner: 'Test User',
        externalUrl: 'https://open.spotify.com/playlist/pl-1',
      });
    });

    it('paginates through all pages', async () => {
      const fetchMock = vi.fn();

      const makePage = (id: string, next: string | null) => ({
        items: [
          {
            id,
            name: `Playlist ${id}`,
            description: '',
            images: [],
            public: false,
            owner: { display_name: 'User', id: 'u' },
            tracks: { total: 1 },
            external_urls: { spotify: '' },
          },
        ],
        next,
        total: 2,
        limit: 50,
        offset: 0,
      });

      fetchMock
        .mockResolvedValueOnce(makeResponse(makePage('p1', 'https://next-page')))
        .mockResolvedValueOnce(makeResponse(makePage('p2', null)));
      vi.stubGlobal('fetch', fetchMock);

      const playlists = await adapter.getUserPlaylists(TOKEN);
      expect(playlists).toHaveLength(2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  // ---- searchTrack ----
  describe('searchTrack', () => {
    it('builds query from name + artist when no ISRC', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        makeResponse({ tracks: { items: [], next: null, total: 0, limit: 10, offset: 0 } }),
      );
      vi.stubGlobal('fetch', fetchMock);

      await adapter.searchTrack(TOKEN, { name: 'Bohemian Rhapsody', artist: 'Queen' });

      const calledUrl: string = fetchMock.mock.calls[0][0];
      const parsed = new URL(calledUrl);
      const q = parsed.searchParams.get('q') ?? '';
      expect(q).toContain('track:Bohemian Rhapsody');
      expect(q).toContain('artist:Queen');
      expect(parsed.searchParams.get('type')).toBe('track');
    });

    it('uses isrc: prefix when ISRC is provided', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        makeResponse({ tracks: { items: [], next: null, total: 0, limit: 10, offset: 0 } }),
      );
      vi.stubGlobal('fetch', fetchMock);

      await adapter.searchTrack(TOKEN, {
        name: 'Bohemian Rhapsody',
        artist: 'Queen',
        isrc: 'GBAYE0601498',
      });

      const calledUrl: string = fetchMock.mock.calls[0][0];
      const parsed = new URL(calledUrl);
      const q = parsed.searchParams.get('q') ?? '';
      expect(q).toBe('isrc:GBAYE0601498');
    });

    it('maps returned tracks including ISRC', async () => {
      const spotifyTrack = makeSpotifyTrack();
      const fetchMock = vi.fn().mockResolvedValueOnce(
        makeResponse({
          tracks: {
            items: [spotifyTrack],
            next: null,
            total: 1,
            limit: 10,
            offset: 0,
          },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const results = await adapter.searchTrack(TOKEN, {
        name: 'Test Song',
        artist: 'Test Artist',
      });

      expect(results).toHaveLength(1);
      expect(results[0].track).toMatchObject({
        id: 'track-1',
        name: 'Test Song',
        artists: ['Test Artist'],
        album: 'Test Album',
        durationMs: 180000,
        isrc: 'USAT12345678',
        platformId: 'SPOTIFY',
      });
    });
  });

  // ---- addTracksToPlaylist (batching) ----
  describe('addTracksToPlaylist', () => {
    it('sends a single request for <= 100 tracks', async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeResponse({ snapshot_id: 'snap1' }));
      vi.stubGlobal('fetch', fetchMock);

      const ids = Array.from({ length: 50 }, (_, i) => `track-${i}`);
      await adapter.addTracksToPlaylist(TOKEN, 'pl-1', ids);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.uris).toHaveLength(50);
      expect(body.uris[0]).toBe('spotify:track:track-0');
    });

    it('batches 101 tracks into 2 requests', async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeResponse({ snapshot_id: 'snap1' }));
      vi.stubGlobal('fetch', fetchMock);

      const ids = Array.from({ length: 101 }, (_, i) => `track-${i}`);
      await adapter.addTracksToPlaylist(TOKEN, 'pl-1', ids);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
      expect(firstBody.uris).toHaveLength(100);
      expect(secondBody.uris).toHaveLength(1);
    });

    it('batches 250 tracks into 3 requests', async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeResponse({ snapshot_id: 'snap1' }));
      vi.stubGlobal('fetch', fetchMock);

      const ids = Array.from({ length: 250 }, (_, i) => `track-${i}`);
      await adapter.addTracksToPlaylist(TOKEN, 'pl-1', ids);

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  // ---- error handling ----
  describe('error handling', () => {
    it('throws a descriptive error on non-200 response', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(makeResponse({ error: 'Unauthorized' }, 401));
      vi.stubGlobal('fetch', fetchMock);

      await expect(adapter.getUserPlaylists(TOKEN)).rejects.toThrow('Spotify API error 401');
    });

    it('retries once on 429 with Retry-After header', async () => {
      const headers = new Headers({ 'Retry-After': '0' });
      const rateLimitResponse = {
        ok: false,
        status: 429,
        headers,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      } as unknown as Response;
      const successResponse = makeResponse({
        items: [],
        next: null,
        total: 0,
        limit: 50,
        offset: 0,
      });

      const fetchMock = vi.fn()
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(successResponse);
      vi.stubGlobal('fetch', fetchMock);

      const result = await adapter.getUserPlaylists(TOKEN);
      expect(result).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  // ---- getPlaylistTracks ----
  describe('getPlaylistTracks', () => {
    it('maps track objects and filters null tracks', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        makeResponse({
          items: [
            { track: makeSpotifyTrack() },
            { track: null }, // deleted / unavailable track
          ],
          next: null,
          total: 2,
          limit: 100,
          offset: 0,
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const tracks = await adapter.getPlaylistTracks(TOKEN, 'pl-1');
      expect(tracks).toHaveLength(1);
      expect(tracks[0].id).toBe('track-1');
    });
  });

  // ---- getLikedSongs ----
  describe('getLikedSongs', () => {
    it('respects the limit parameter', async () => {
      const items = Array.from({ length: 10 }, (_, i) =>
        ({ track: makeSpotifyTrack({ id: `track-${i}` }) }),
      );
      const fetchMock = vi.fn().mockResolvedValue(
        makeResponse({ items, next: null, total: 10, limit: 50, offset: 0 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const songs = await adapter.getLikedSongs(TOKEN, 3);
      expect(songs).toHaveLength(3);
    });
  });
});
