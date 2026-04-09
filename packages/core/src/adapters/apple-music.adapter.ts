import type {
  OAuthTokens,
  Playlist,
  Track,
  TrackQuery,
  TrackSearchResult,
  AlbumQuery,
  Album,
} from '@tunemymusic/types';
import { BasePlatformAdapter, type PlatformUserProfile } from './base.js';

export interface AppleMusicConfig {
  keyId: string;
  teamId: string;
  privateKey: string;
  storefront?: string;
}

const APPLE_MUSIC_BASE = 'https://api.music.apple.com/v1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate a developer JWT for Apple Music API requests.
 * Signs with PKCS#8 ES256 private key using the Web Crypto API (Node 18+).
 */
async function generateDeveloperToken(
  keyId: string,
  teamId: string,
  privateKey: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 12; // 12-hour expiry

  const header = base64UrlEncode(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const payload = base64UrlEncode(
    JSON.stringify({ iss: teamId, iat: now, exp }),
  );
  const signingInput = `${header}.${payload}`;

  // Strip PEM headers/footers and decode the raw key bytes
  const pemBody = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const keyBytes = Buffer.from(pemBody, 'base64');

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const sigBuffer = await globalThis.crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    cryptoKey,
    Buffer.from(signingInput),
  );

  const signature = Buffer.from(sigBuffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${signingInput}.${signature}`;
}

// ---------------------------------------------------------------------------
// Response shape helpers
// ---------------------------------------------------------------------------

interface AppleMusicSongAttributes {
  name: string;
  artistName: string;
  albumName?: string;
  artwork?: { url: string; width: number; height: number };
  durationInMillis?: number;
  isrc?: string;
  previews?: Array<{ url: string }>;
  releaseDate?: string;
}

interface AppleMusicSong {
  id: string;
  attributes: AppleMusicSongAttributes;
}

interface AppleMusicPlaylistAttributes {
  name: string;
  description?: { standard?: string };
  artwork?: { url: string; width: number; height: number };
  isPublic?: boolean;
  curatorName?: string;
  playParams?: { id: string };
}

interface AppleMusicPlaylist {
  id: string;
  attributes: AppleMusicPlaylistAttributes;
}

interface AppleMusicPagedResponse<T> {
  data: T[];
  next?: string;
}

function artworkUrl(artwork: { url: string; width: number; height: number } | undefined, size = 300): string | undefined {
  if (!artwork) return undefined;
  return artwork.url.replace('{w}', String(size)).replace('{h}', String(size));
}

function mapSong(song: AppleMusicSong): Track {
  const a = song.attributes;
  const releaseYear = a.releaseDate ? parseInt(a.releaseDate.slice(0, 4), 10) : undefined;
  return {
    id: song.id,
    name: a.name,
    artists: [a.artistName],
    album: a.albumName,
    albumArtUrl: artworkUrl(a.artwork),
    durationMs: a.durationInMillis,
    isrc: a.isrc,
    previewUrl: a.previews?.[0]?.url,
    platformId: 'APPLE_MUSIC',
    platformTrackId: song.id,
    releaseYear,
  };
}

function mapPlaylist(pl: AppleMusicPlaylist): Playlist {
  return {
    id: pl.id,
    name: pl.attributes.name,
    description: pl.attributes.description?.standard,
    platform: 'APPLE_MUSIC',
    trackCount: 0, // Apple doesn't return track count in list responses
    artworkUrl: artworkUrl(pl.attributes.artwork),
    isPublic: pl.attributes.isPublic ?? false,
    owner: pl.attributes.curatorName,
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class AppleMusicAdapter extends BasePlatformAdapter {
  readonly platformId = 'APPLE_MUSIC' as const;
  readonly displayName = 'Apple Music';

  private readonly config: Required<AppleMusicConfig>;
  private cachedDeveloperToken: string | null = null;

  constructor(config: AppleMusicConfig) {
    super();
    this.config = {
      storefront: 'us',
      ...config,
    };
  }

  // -------------------------------------------------------------------------
  // Internal fetch helper
  // -------------------------------------------------------------------------

  private async getDeveloperToken(): Promise<string> {
    if (!this.cachedDeveloperToken) {
      this.cachedDeveloperToken = await generateDeveloperToken(
        this.config.keyId,
        this.config.teamId,
        this.config.privateKey,
      );
    }
    return this.cachedDeveloperToken;
  }

  private async request<T>(
    path: string,
    musicUserToken: string,
    options: RequestInit = {},
  ): Promise<T> {
    const developerToken = await this.getDeveloperToken();
    const url = path.startsWith('http') ? path : `${APPLE_MUSIC_BASE}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${developerToken}`,
        'Music-User-Token': musicUserToken,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
      },
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') ?? '1', 10);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return this.request<T>(path, musicUserToken, options);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Apple Music API error ${response.status} on ${options.method ?? 'GET'} ${path}: ${text}`,
      );
    }

    return response.json() as Promise<T>;
  }

  /** Paginate through all pages of an Apple Music collection. */
  private async paginate<T>(
    firstPath: string,
    musicUserToken: string,
  ): Promise<T[]> {
    const results: T[] = [];
    let path: string | undefined = firstPath;

    while (path) {
      const page = await this.request<AppleMusicPagedResponse<T>>(path, musicUserToken);
      results.push(...page.data);
      path = page.next;
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Auth — Apple Music uses MusicKit JS on the client side
  // -------------------------------------------------------------------------

  getAuthUrl(_state: string, _redirectUri: string): string {
    // Apple Music auth happens client-side via MusicKit JS. We return a
    // placeholder so callers know to trigger MusicKit JS instead.
    return 'apple-music://authorize';
  }

  async exchangeCodeForTokens(
    musicUserToken: string,
    _redirectUri: string,
  ): Promise<OAuthTokens> {
    // The "code" passed here is actually the music user token obtained from MusicKit JS.
    return {
      accessToken: musicUserToken,
      // Music user tokens are long-lived; use a far-future expiry
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      tokenType: 'Bearer',
    };
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    // Apple Music user tokens don't expire in the traditional sense.
    return {
      accessToken: refreshToken,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      tokenType: 'Bearer',
    };
  }

  // -------------------------------------------------------------------------
  // User profile
  // -------------------------------------------------------------------------

  async getUserProfile(accessToken: string): Promise<PlatformUserProfile> {
    // Apple Music API does not expose a user profile endpoint at this scope.
    // Return a minimal profile using the token as an identifier.
    return {
      platformUserId: `apple-music-user-${accessToken.slice(0, 8)}`,
      displayName: 'Apple Music User',
    };
  }

  // -------------------------------------------------------------------------
  // Playlists
  // -------------------------------------------------------------------------

  async getUserPlaylists(accessToken: string): Promise<Playlist[]> {
    const items = await this.paginate<AppleMusicPlaylist>(
      '/me/library/playlists?limit=100',
      accessToken,
    );
    return items.map(mapPlaylist);
  }

  async getPlaylistTracks(accessToken: string, playlistId: string): Promise<Track[]> {
    const items = await this.paginate<AppleMusicSong>(
      `/me/library/playlists/${playlistId}/tracks?limit=100`,
      accessToken,
    );
    return items.map(mapSong);
  }

  async createPlaylist(
    accessToken: string,
    name: string,
    description?: string,
    _isPublic?: boolean,
  ): Promise<Playlist> {
    const body: Record<string, unknown> = {
      attributes: { name, description: description ?? '' },
    };

    const response = await this.request<AppleMusicPagedResponse<AppleMusicPlaylist>>(
      '/me/library/playlists',
      accessToken,
      { method: 'POST', body: JSON.stringify(body) },
    );

    const created = response.data[0];
    return mapPlaylist(created);
  }

  async addTracksToPlaylist(
    accessToken: string,
    playlistId: string,
    trackIds: string[],
  ): Promise<void> {
    const BATCH_SIZE = 100;
    for (let i = 0; i < trackIds.length; i += BATCH_SIZE) {
      const batch = trackIds.slice(i, i + BATCH_SIZE);
      const body = {
        data: batch.map((id) => ({ id, type: 'library-songs' })),
      };
      await this.request<void>(
        `/me/library/playlists/${playlistId}/tracks`,
        accessToken,
        { method: 'POST', body: JSON.stringify(body) },
      );
    }
  }

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  async searchTrack(
    accessToken: string,
    query: TrackQuery,
  ): Promise<TrackSearchResult[]> {
    const term = encodeURIComponent(`${query.artist} ${query.name}`);
    const path = `/catalog/${this.config.storefront}/search?types=songs&term=${term}&limit=25`;

    const response = await this.request<{
      results: { songs?: AppleMusicPagedResponse<AppleMusicSong> };
    }>(path, accessToken);

    const songs = response.results.songs?.data ?? [];
    return songs.map((song) => ({ track: mapSong(song), score: 0 }));
  }

  async searchAlbum(accessToken: string, query: AlbumQuery): Promise<Album[]> {
    const term = encodeURIComponent(`${query.artist} ${query.name}`);
    const path = `/catalog/${this.config.storefront}/search?types=albums&term=${term}&limit=25`;

    interface AppleMusicAlbumAttributes {
      name: string;
      artistName: string;
      artwork?: { url: string; width: number; height: number };
      releaseDate?: string;
      trackCount?: number;
    }
    interface AppleMusicAlbum {
      id: string;
      attributes: AppleMusicAlbumAttributes;
    }

    const response = await this.request<{
      results: { albums?: AppleMusicPagedResponse<AppleMusicAlbum> };
    }>(path, accessToken);

    const albums = response.results.albums?.data ?? [];
    return albums.map((al) => ({
      id: al.id,
      name: al.attributes.name,
      artist: al.attributes.artistName,
      artworkUrl: artworkUrl(al.attributes.artwork),
      releaseYear: al.attributes.releaseDate
        ? parseInt(al.attributes.releaseDate.slice(0, 4), 10)
        : undefined,
      trackCount: al.attributes.trackCount,
    }));
  }

  // -------------------------------------------------------------------------
  // Liked songs
  // -------------------------------------------------------------------------

  async getLikedSongs(accessToken: string, limit?: number): Promise<Track[]> {
    const songs = await this.paginate<AppleMusicSong>(
      '/me/library/songs?limit=100',
      accessToken,
    );
    return limit ? songs.slice(0, limit).map(mapSong) : songs.map(mapSong);
  }

  async likeTrack(accessToken: string, trackId: string): Promise<void> {
    const body = {
      data: [{ id: trackId, type: 'songs' }],
    };
    await this.request<void>('/me/library', accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}
