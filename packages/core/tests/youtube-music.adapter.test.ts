import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { YouTubeMusicAdapter } from '../src/adapters/youtube-music.adapter.js';

const TOKEN = 'test-access-token';
const adapter = new YouTubeMusicAdapter({ clientId: 'yt-client-id', clientSecret: 'yt-client-secret' });

function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function makeVideoResource(overrides: Record<string, unknown> = {}) {
  return {
    id: 'video-1',
    snippet: {
      title: 'Test Song - Test Artist',
      channelTitle: 'Test Artist',
      thumbnails: {
        high: { url: 'https://example.com/thumb.jpg', width: 480, height: 360 },
      },
      publishedAt: '2023-05-20T00:00:00Z',
    },
    contentDetails: {
      duration: 'PT3M45S',
    },
    ...overrides,
  };
}

describe('YouTubeMusicAdapter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- getAuthUrl ----
  describe('getAuthUrl', () => {
    it('returns a URL pointing to accounts.google.com', () => {
      const url = adapter.getAuthUrl('my-state', 'https://app.example.com/callback');
      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    });

    it('includes required YouTube scopes', () => {
      const url = adapter.getAuthUrl('state', 'https://redirect.example.com');
      const scope = new URL(url).searchParams.get('scope') ?? '';
      expect(scope).toContain('https://www.googleapis.com/auth/youtube');
      expect(scope).toContain('https://www.googleapis.com/auth/youtube.readonly');
    });

    it('includes state, redirect_uri, and response_type=code', () => {
      const state = 'yt-state-456';
      const redirectUri = 'https://app.example.com/callback';
      const url = adapter.getAuthUrl(state, redirectUri);
      const parsed = new URL(url);
      expect(parsed.searchParams.get('state')).toBe(state);
      expect(parsed.searchParams.get('redirect_uri')).toBe(redirectUri);
      expect(parsed.searchParams.get('response_type')).toBe('code');
    });

    it('requests offline access', () => {
      const url = adapter.getAuthUrl('s', 'https://r.example.com');
      const parsed = new URL(url);
      expect(parsed.searchParams.get('access_type')).toBe('offline');
    });
  });

  // ---- getUserPlaylists ----
  describe('getUserPlaylists', () => {
    it('maps YouTube playlist objects to Playlist type', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        makeResponse({
          items: [
            {
              id: 'pl-yt-1',
              snippet: {
                title: 'My YT Playlist',
                description: 'A YouTube playlist',
                thumbnails: {
                  high: { url: 'https://example.com/yt-cover.jpg' },
                },
                channelTitle: 'My Channel',
              },
              contentDetails: { itemCount: 15 },
              status: { privacyStatus: 'public' },
            },
          ],
          nextPageToken: undefined,
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const playlists = await adapter.getUserPlaylists(TOKEN);

      expect(playlists).toHaveLength(1);
      expect(playlists[0]).toMatchObject({
        id: 'pl-yt-1',
        name: 'My YT Playlist',
        description: 'A YouTube playlist',
        platform: 'YOUTUBE_MUSIC',
        trackCount: 15,
        artworkUrl: 'https://example.com/yt-cover.jpg',
        isPublic: true,
        owner: 'My Channel',
      });
    });

    it('paginates using nextPageToken', async () => {
      const fetchMock = vi.fn();

      const makePage = (id: string, nextPageToken?: string) => ({
        items: [
          {
            id,
            snippet: {
              title: `Playlist ${id}`,
              description: '',
              thumbnails: {},
              channelTitle: 'Channel',
            },
            contentDetails: { itemCount: 0 },
            status: { privacyStatus: 'private' },
          },
        ],
        nextPageToken,
      });

      fetchMock
        .mockResolvedValueOnce(makeResponse(makePage('p1', 'token-page-2')))
        .mockResolvedValueOnce(makeResponse(makePage('p2')));
      vi.stubGlobal('fetch', fetchMock);

      const playlists = await adapter.getUserPlaylists(TOKEN);
      expect(playlists).toHaveLength(2);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Second call should include pageToken
      const secondUrl: string = fetchMock.mock.calls[1][0];
      expect(secondUrl).toContain('pageToken=token-page-2');
    });
  });

  // ---- searchTrack ----
  describe('searchTrack', () => {
    it('builds query from name + artist and searches videos with category 10', async () => {
      const fetchMock = vi.fn()
        // First call: search
        .mockResolvedValueOnce(
          makeResponse({
            items: [{ id: { videoId: 'v1' }, snippet: { title: 'Result' } }],
          }),
        )
        // Second call: video details
        .mockResolvedValueOnce(
          makeResponse({ items: [makeVideoResource()] }),
        );
      vi.stubGlobal('fetch', fetchMock);

      await adapter.searchTrack(TOKEN, { name: 'Lose Yourself', artist: 'Eminem' });

      const searchUrl: string = fetchMock.mock.calls[0][0];
      const parsed = new URL(searchUrl);
      expect(parsed.searchParams.get('type')).toBe('video');
      expect(parsed.searchParams.get('videoCategoryId')).toBe('10');
      const q = parsed.searchParams.get('q') ?? '';
      expect(q).toContain('Lose Yourself');
      expect(q).toContain('Eminem');
    });

    it('maps video details to Track (no ISRC)', async () => {
      const video = makeVideoResource();
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(
          makeResponse({ items: [{ id: { videoId: 'video-1' }, snippet: {} }] }),
        )
        .mockResolvedValueOnce(makeResponse({ items: [video] }));
      vi.stubGlobal('fetch', fetchMock);

      const results = await adapter.searchTrack(TOKEN, { name: 'Test Song', artist: 'Test Artist' });

      expect(results).toHaveLength(1);
      expect(results[0].track).toMatchObject({
        id: 'video-1',
        name: 'Test Song - Test Artist',
        platformId: 'YOUTUBE_MUSIC',
        durationMs: 225000, // PT3M45S = 225s
      });
      expect(results[0].track.isrc).toBeUndefined();
    });

    it('returns empty array when search yields no results', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(makeResponse({ items: [] }));
      vi.stubGlobal('fetch', fetchMock);

      const results = await adapter.searchTrack(TOKEN, { name: 'X', artist: 'Y' });
      expect(results).toEqual([]);
    });
  });

  // ---- addTracksToPlaylist ----
  describe('addTracksToPlaylist', () => {
    it('sends one request per track (YouTube API limitation)', async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeResponse({ id: 'item-1' }));
      vi.stubGlobal('fetch', fetchMock);

      await adapter.addTracksToPlaylist(TOKEN, 'pl-1', ['v1', 'v2', 'v3']);

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('sends correct payload for each track', async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeResponse({ id: 'item-1' }));
      vi.stubGlobal('fetch', fetchMock);

      await adapter.addTracksToPlaylist(TOKEN, 'my-playlist', ['video-abc']);

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(callBody.snippet.playlistId).toBe('my-playlist');
      expect(callBody.snippet.resourceId.videoId).toBe('video-abc');
      expect(callBody.snippet.resourceId.kind).toBe('youtube#video');
    });
  });

  // ---- error handling ----
  describe('error handling', () => {
    it('throws a descriptive error on non-200 response', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(makeResponse({ error: 'Forbidden' }, 403));
      vi.stubGlobal('fetch', fetchMock);

      await expect(adapter.getUserPlaylists(TOKEN)).rejects.toThrow('YouTube API error 403');
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

      const successResponse = makeResponse({ items: [], nextPageToken: undefined });
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
    it('fetches playlist items then retrieves video details', async () => {
      const fetchMock = vi.fn()
        // First call: playlistItems
        .mockResolvedValueOnce(
          makeResponse({
            items: [
              {
                id: 'item-1',
                snippet: {
                  title: 'Test Video',
                  resourceId: { kind: 'youtube#video', videoId: 'v-abc' },
                },
              },
            ],
            nextPageToken: undefined,
          }),
        )
        // Second call: videos details
        .mockResolvedValueOnce(
          makeResponse({ items: [makeVideoResource({ id: 'v-abc' })] }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const tracks = await adapter.getPlaylistTracks(TOKEN, 'pl-yt-1');

      expect(tracks).toHaveLength(1);
      expect(tracks[0].platformTrackId).toBe('v-abc');
      expect(tracks[0].platformId).toBe('YOUTUBE_MUSIC');
    });

    it('returns empty array for empty playlist', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        makeResponse({ items: [], nextPageToken: undefined }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const tracks = await adapter.getPlaylistTracks(TOKEN, 'empty-pl');
      expect(tracks).toEqual([]);
    });
  });

  // ---- getLikedSongs ----
  describe('getLikedSongs', () => {
    it('fetches videos with myRating=like', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        makeResponse({ items: [makeVideoResource()], nextPageToken: undefined }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const songs = await adapter.getLikedSongs(TOKEN);

      const calledUrl: string = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain('myRating=like');
      expect(songs).toHaveLength(1);
    });

    it('respects the limit parameter', async () => {
      const items = Array.from({ length: 10 }, (_, i) => makeVideoResource({ id: `v-${i}` }));
      const fetchMock = vi.fn().mockResolvedValue(
        makeResponse({ items, nextPageToken: undefined }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const songs = await adapter.getLikedSongs(TOKEN, 4);
      expect(songs).toHaveLength(4);
    });
  });
});
