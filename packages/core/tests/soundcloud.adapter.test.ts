import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SoundCloudAdapter } from '../src/adapters/soundcloud.adapter.js';

// Helper to create a mock Response
function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : status === 429 ? 'Too Many Requests' : 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

const config = { clientId: 'test-client-id', clientSecret: 'test-client-secret' };

describe('SoundCloudAdapter', () => {
  let adapter: SoundCloudAdapter;

  beforeEach(() => {
    adapter = new SoundCloudAdapter(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAuthUrl', () => {
    it('returns the correct SoundCloud OAuth URL', () => {
      const url = adapter.getAuthUrl('my-state', 'https://example.com/callback');
      expect(url).toContain('https://api.soundcloud.com/connect');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      expect(url).toContain('response_type=code');
      expect(url).toContain('state=my-state');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('returns tokens with OAuth tokenType', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        mockResponse({
          access_token: 'sc-access-token',
          refresh_token: 'sc-refresh-token',
          expires_in: 3600,
          scope: 'non-expiring',
        }),
      ));

      const tokens = await adapter.exchangeCodeForTokens('auth-code', 'https://example.com/callback');
      expect(tokens.accessToken).toBe('sc-access-token');
      expect(tokens.refreshToken).toBe('sc-refresh-token');
      expect(tokens.tokenType).toBe('OAuth');
    });
  });

  describe('getUserProfile', () => {
    it('maps SoundCloud user fields to PlatformUserProfile', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        mockResponse({
          id: 12345,
          username: 'cooluser',
          full_name: 'Cool User',
          avatar_url: 'https://i1.sndcdn.com/avatars-000.jpg',
          email: 'cool@example.com',
        }),
      ));

      const profile = await adapter.getUserProfile('token');
      expect(profile.platformUserId).toBe('12345');
      expect(profile.displayName).toBe('Cool User');
      expect(profile.avatarUrl).toBe('https://i1.sndcdn.com/avatars-000.jpg');
    });
  });

  describe('getUserPlaylists', () => {
    it('maps SoundCloud sets to Playlist objects', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        mockResponse([
          {
            id: 999,
            title: 'My Set',
            description: 'A great set',
            sharing: 'public',
            track_count: 5,
            artwork_url: 'https://i1.sndcdn.com/artworks-000.jpg',
            permalink_url: 'https://soundcloud.com/user/sets/my-set',
            user: { username: 'cooluser' },
          },
        ]),
      ));

      const playlists = await adapter.getUserPlaylists('token');
      expect(playlists).toHaveLength(1);
      expect(playlists[0].id).toBe('999');
      expect(playlists[0].name).toBe('My Set');
      expect(playlists[0].platform).toBe('SOUNDCLOUD');
      expect(playlists[0].isPublic).toBe(true);
      expect(playlists[0].trackCount).toBe(5);
    });

    it('marks private playlists correctly', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        mockResponse([
          { id: 1, title: 'Secret', sharing: 'private', track_count: 2 },
        ]),
      ));

      const playlists = await adapter.getUserPlaylists('token');
      expect(playlists[0].isPublic).toBe(false);
    });
  });

  describe('getPlaylistTracks', () => {
    it('maps track array to Track objects', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        mockResponse([
          {
            id: 111,
            title: 'Test Track',
            user: { username: 'artist1', full_name: 'Artist One' },
            duration: 240000,
            artwork_url: 'https://i1.sndcdn.com/artworks-001.jpg',
          },
        ]),
      ));

      const tracks = await adapter.getPlaylistTracks('token', '999');
      expect(tracks).toHaveLength(1);
      expect(tracks[0].id).toBe('111');
      expect(tracks[0].name).toBe('Test Track');
      expect(tracks[0].artists).toContain('Artist One');
      expect(tracks[0].durationMs).toBe(240000);
      expect(tracks[0].platformId).toBe('SOUNDCLOUD');
      expect(tracks[0].isrc).toBeUndefined();
    });
  });

  describe('searchTrack', () => {
    it('builds a query with artist and track name', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        mockResponse({
          collection: [
            { id: 42, title: 'Bohemian Rhapsody', user: { username: 'Queen' }, duration: 354000 },
          ],
          next_href: null,
        }),
      );
      vi.stubGlobal('fetch', mockFetch);

      const results = await adapter.searchTrack('token', {
        name: 'Bohemian Rhapsody',
        artist: 'Queen',
      });

      const calledUrl = (mockFetch.mock.calls[0][0] as string);
      expect(calledUrl).toContain('/tracks');
      expect(calledUrl).toContain('q=');
      expect(calledUrl).toContain('Queen');
      expect(results[0].track.name).toBe('Bohemian Rhapsody');
    });

    it('also handles plain array responses', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        mockResponse([
          { id: 77, title: 'Song', user: { username: 'Artist' }, duration: 180000 },
        ]),
      ));

      const results = await adapter.searchTrack('token', { name: 'Song', artist: 'Artist' });
      expect(results).toHaveLength(1);
    });
  });

  describe('searchAlbum', () => {
    it('queries playlists endpoint with compact representation', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        mockResponse([
          { id: 55, title: 'Greatest Hits', user: { username: 'Queen' }, artwork_url: 'https://img.url' },
        ]),
      );
      vi.stubGlobal('fetch', mockFetch);

      const albums = await adapter.searchAlbum('token', { name: 'Greatest Hits', artist: 'Queen' });
      const calledUrl = (mockFetch.mock.calls[0][0] as string);
      expect(calledUrl).toContain('/playlists');
      expect(calledUrl).toContain('representation=compact');
      expect(albums[0].id).toBe('55');
      expect(albums[0].name).toBe('Greatest Hits');
    });
  });

  describe('getLikedSongs', () => {
    it('follows pagination via next_href', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(mockResponse({
          collection: [{ id: 1, title: 'Track 1', user: { username: 'A' }, duration: 100000 }],
          next_href: 'https://api.soundcloud.com/me/likes/tracks?cursor=abc',
        }))
        .mockResolvedValueOnce(mockResponse({
          collection: [{ id: 2, title: 'Track 2', user: { username: 'B' }, duration: 200000 }],
          next_href: undefined,
        }));
      vi.stubGlobal('fetch', mockFetch);

      const tracks = await adapter.getLikedSongs('token');
      expect(tracks).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('respects the limit parameter', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        mockResponse({
          collection: [
            { id: 1, title: 'T1', user: { username: 'A' }, duration: 100000 },
            { id: 2, title: 'T2', user: { username: 'B' }, duration: 200000 },
            { id: 3, title: 'T3', user: { username: 'C' }, duration: 300000 },
          ],
          next_href: undefined,
        }),
      ));

      const tracks = await adapter.getLikedSongs('token', 2);
      expect(tracks).toHaveLength(2);
    });
  });

  describe('Authorization header format', () => {
    it('uses "OAuth" (not "Bearer") in the Authorization header', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        mockResponse({ id: 1, username: 'user', full_name: 'User' }),
      );
      vi.stubGlobal('fetch', mockFetch);

      await adapter.getUserProfile('my-access-token');

      const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('OAuth my-access-token');
    });
  });

  describe('Error handling', () => {
    it('throws a descriptive error on non-2xx responses', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        mockResponse({ error: 'Unauthorized' }, 401),
      ));

      await expect(adapter.getUserProfile('bad-token')).rejects.toThrow(
        /SoundCloud API error.*401/,
      );
    });

    it('throws on 429 rate limit in getLikedSongs', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({}, 429)));

      await expect(adapter.getLikedSongs('token')).rejects.toThrow(/rate limit.*429/i);
    });

    it('throws on 429 rate limit in getUserPlaylists', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({}, 429)));

      await expect(adapter.getUserPlaylists('token')).rejects.toThrow(/rate limit.*429/i);
    });
  });

  describe('createPlaylist', () => {
    it('sends POST with correct payload and returns Playlist', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        mockResponse({
          id: 777,
          title: 'New Playlist',
          sharing: 'private',
          track_count: 0,
          user: { username: 'testuser' },
        }),
      );
      vi.stubGlobal('fetch', mockFetch);

      const playlist = await adapter.createPlaylist('token', 'New Playlist', 'desc', false);
      expect(playlist.name).toBe('New Playlist');
      expect(playlist.isPublic).toBe(false);
      expect(playlist.platform).toBe('SOUNDCLOUD');

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.playlist.sharing).toBe('private');
    });
  });

  describe('addTracksToPlaylist', () => {
    it('sends PUT with track id array', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockResponse({}));
      vi.stubGlobal('fetch', mockFetch);

      await adapter.addTracksToPlaylist('token', '999', ['111', '222']);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.playlist.tracks).toEqual([{ id: 111 }, { id: 222 }]);
    });
  });

  describe('likeTrack', () => {
    it('sends POST to the correct endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockResponse({}));
      vi.stubGlobal('fetch', mockFetch);

      await adapter.likeTrack('token', '12345');

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/me/likes/tracks/12345');
      expect(mockFetch.mock.calls[0][1]?.method).toBe('POST');
    });
  });
});
