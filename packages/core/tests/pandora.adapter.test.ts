import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PandoraAdapter } from '../src/adapters/pandora.adapter.js';

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

const config = { clientId: 'pandora-client-id', clientSecret: 'pandora-client-secret' };

describe('PandoraAdapter', () => {
  let adapter: PandoraAdapter;

  beforeEach(() => {
    adapter = new PandoraAdapter(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAuthUrl', () => {
    it('returns the correct Pandora auth URL', () => {
      const url = adapter.getAuthUrl('some-state', 'https://app.example.com/callback');
      expect(url).toContain('https://www.pandora.com/account/sign-in');
      expect(url).toContain('client_id=pandora-client-id');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback');
      expect(url).toContain('response_type=code');
      expect(url).toContain('state=some-state');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('returns tokens with Bearer tokenType', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        mockResponse({
          access_token: 'pandora-access',
          refresh_token: 'pandora-refresh',
          expires_in: 7200,
        }),
      ));

      const tokens = await adapter.exchangeCodeForTokens('code123', 'https://example.com/cb');
      expect(tokens.accessToken).toBe('pandora-access');
      expect(tokens.refreshToken).toBe('pandora-refresh');
      expect(tokens.tokenType).toBe('Bearer');
    });

    it('sends Basic auth header with base64-encoded credentials', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        mockResponse({ access_token: 'tok', expires_in: 3600 }),
      );
      vi.stubGlobal('fetch', mockFetch);

      await adapter.exchangeCodeForTokens('code', 'https://example.com/cb');

      const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
      const expected = `Basic ${Buffer.from('pandora-client-id:pandora-client-secret').toString('base64')}`;
      expect(headers['Authorization']).toBe(expected);
    });
  });

  describe('getUserProfile', () => {
    it('maps Pandora settings to PlatformUserProfile', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        mockResponse({
          pandoraId: 'PID-001',
          displayName: 'Jane Pandora',
          email: 'jane@example.com',
          profileImage: { url: 'https://pandora.com/avatar.jpg' },
        }),
      ));

      const profile = await adapter.getUserProfile('token');
      expect(profile.platformUserId).toBe('PID-001');
      expect(profile.displayName).toBe('Jane Pandora');
      expect(profile.email).toBe('jane@example.com');
      expect(profile.avatarUrl).toBe('https://pandora.com/avatar.jpg');
    });

    it('falls back to listenerId when pandoraId is missing', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        mockResponse({ listenerId: 'LID-999', username: 'fallback' }),
      ));

      const profile = await adapter.getUserProfile('token');
      expect(profile.platformUserId).toBe('LID-999');
    });
  });

  describe('getUserPlaylists', () => {
    it('maps playlists array correctly', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        mockResponse({
          playlists: [
            {
              pandoraId: 'PL-100',
              name: 'Chill Vibes',
              description: 'Relaxing tunes',
              isPublic: true,
              trackCount: 12,
              artUrl: 'https://art.url/img.jpg',
            },
          ],
        }),
      ));

      const playlists = await adapter.getUserPlaylists('token');
      expect(playlists).toHaveLength(1);
      expect(playlists[0].id).toBe('PL-100');
      expect(playlists[0].name).toBe('Chill Vibes');
      expect(playlists[0].platform).toBe('PANDORA');
      expect(playlists[0].trackCount).toBe(12);
      expect(playlists[0].isPublic).toBe(true);
    });

    it('handles empty playlists response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({ playlists: [] })));
      const playlists = await adapter.getUserPlaylists('token');
      expect(playlists).toHaveLength(0);
    });
  });

  describe('getPlaylistTracks', () => {
    it('maps track items with ISRC when present', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        mockResponse({
          tracks: [
            {
              pandoraId: 'TR-200',
              songTitle: 'Great Song',
              artistName: 'Best Artist',
              albumTitle: 'Best Album',
              durationSeconds: 210,
              isrc: 'USRC12345678',
              releaseYear: 2020,
            },
          ],
        }),
      ));

      const tracks = await adapter.getPlaylistTracks('token', 'PL-100');
      expect(tracks).toHaveLength(1);
      expect(tracks[0].id).toBe('TR-200');
      expect(tracks[0].name).toBe('Great Song');
      expect(tracks[0].artists).toContain('Best Artist');
      expect(tracks[0].album).toBe('Best Album');
      expect(tracks[0].durationMs).toBe(210000);
      expect(tracks[0].isrc).toBe('USRC12345678');
      expect(tracks[0].platformId).toBe('PANDORA');
    });

    it('includes playlistId in the GET request URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockResponse({ tracks: [] }));
      vi.stubGlobal('fetch', mockFetch);

      await adapter.getPlaylistTracks('token', 'PL-abc-123');
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('playlistId=PL-abc-123');
    });
  });

  describe('searchTrack', () => {
    it('builds query URL with correct types=TR parameter', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        mockResponse({ results: [{ pandoraId: 'T1', songTitle: 'Hit Song', artistName: 'Pop Star' }] }),
      );
      vi.stubGlobal('fetch', mockFetch);

      const results = await adapter.searchTrack('token', { name: 'Hit Song', artist: 'Pop Star' });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/search');
      expect(url).toContain('types=TR');
      expect(url).toContain('query=');
      expect(results[0].track.name).toBe('Hit Song');
    });

    it('handles items array format in search results', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        mockResponse({ items: [{ pandoraId: 'T2', songTitle: 'Another Song', artistName: 'Someone' }] }),
      ));

      const results = await adapter.searchTrack('token', { name: 'Another Song', artist: 'Someone' });
      expect(results).toHaveLength(1);
    });
  });

  describe('searchAlbum', () => {
    it('builds query URL with correct types=AL parameter', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        mockResponse({
          results: [
            { pandoraId: 'AL-50', name: 'Greatest Hits', artistName: 'Queen', releaseYear: 1981 },
          ],
        }),
      );
      vi.stubGlobal('fetch', mockFetch);

      const albums = await adapter.searchAlbum('token', { name: 'Greatest Hits', artist: 'Queen' });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/search');
      expect(url).toContain('types=AL');
      expect(albums[0].id).toBe('AL-50');
      expect(albums[0].artist).toBe('Queen');
      expect(albums[0].releaseYear).toBe(1981);
    });
  });

  describe('getLikedSongs', () => {
    it('returns mapped tracks from thumbsUp field', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        mockResponse({
          thumbsUp: [
            { pandoraId: 'T10', songTitle: 'Liked Track', artistName: 'Someone', durationSeconds: 180 },
          ],
        }),
      ));

      const tracks = await adapter.getLikedSongs('token');
      expect(tracks).toHaveLength(1);
      expect(tracks[0].name).toBe('Liked Track');
      expect(tracks[0].durationMs).toBe(180000);
    });

    it('respects limit parameter', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        mockResponse({
          thumbsUp: [
            { pandoraId: 'T1', songTitle: 'S1', artistName: 'A' },
            { pandoraId: 'T2', songTitle: 'S2', artistName: 'B' },
            { pandoraId: 'T3', songTitle: 'S3', artistName: 'C' },
          ],
        }),
      ));

      const tracks = await adapter.getLikedSongs('token', 2);
      expect(tracks).toHaveLength(2);
    });
  });

  describe('likeTrack', () => {
    it('sends POST to addThumbUp endpoint with trackId', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockResponse({}));
      vi.stubGlobal('fetch', mockFetch);

      await adapter.likeTrack('token', 'TR-999');

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/listener/addThumbUp');
      expect(mockFetch.mock.calls[0][1]?.method).toBe('POST');
      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.trackId).toBe('TR-999');
    });
  });

  describe('createPlaylist', () => {
    it('sends POST and returns mapped Playlist', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        mockResponse({
          pandoraId: 'PL-NEW',
          name: 'My New Playlist',
          isPublic: false,
          trackCount: 0,
        }),
      );
      vi.stubGlobal('fetch', mockFetch);

      const playlist = await adapter.createPlaylist('token', 'My New Playlist', 'desc', false);
      expect(playlist.id).toBe('PL-NEW');
      expect(playlist.name).toBe('My New Playlist');
      expect(playlist.platform).toBe('PANDORA');
    });
  });

  describe('addTracksToPlaylist', () => {
    it('sends POST with playlistId and trackIds', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockResponse({}));
      vi.stubGlobal('fetch', mockFetch);

      await adapter.addTracksToPlaylist('token', 'PL-100', ['T1', 'T2', 'T3']);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.playlistId).toBe('PL-100');
      expect(body.trackIds).toEqual(['T1', 'T2', 'T3']);
    });
  });

  describe('Error handling', () => {
    it('throws a descriptive error on non-2xx responses', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({ message: 'Forbidden' }, 403)));
      await expect(adapter.getUserProfile('bad-token')).rejects.toThrow(/Pandora API error.*403/);
    });

    it('throws on 429 rate limit', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({}, 429)));
      await expect(adapter.getUserProfile('token')).rejects.toThrow(/rate limit.*429/i);
    });
  });
});
