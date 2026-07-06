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

export interface AmazonMusicConfig {
  clientId: string;
  clientSecret: string;
}

const AMAZON_AUTH_URL = 'https://www.amazon.com/ap/oa';
const AMAZON_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
const AMAZON_MUSIC_BASE = 'https://api.music.amazon.com/v1';
const AMAZON_SCOPES = 'profile amazon_music:access';

// ---------------------------------------------------------------------------
// Response shape helpers
// ---------------------------------------------------------------------------

interface AmazonTrack {
  id: string;
  title: string;
  artists?: Array<{ name: string }>;
  album?: { title: string; imageUrl?: string };
  durationSeconds?: number;
  isrc?: string;
  previewUrl?: string;
  releaseDate?: string;
}

interface AmazonPlaylist {
  id: string;
  title: string;
  description?: string;
  trackCount?: number;
  imageUrl?: string;
  isPublic?: boolean;
  owner?: { name: string };
}

interface AmazonAlbum {
  id: string;
  title: string;
  artists?: Array<{ name: string }>;
  imageUrl?: string;
  releaseDate?: string;
  trackCount?: number;
}

interface AmazonUserProfile {
  user_id?: string;
  name?: string;
  email?: string;
  profile?: { name?: string; email?: string };
}

function mapTrack(t: AmazonTrack): Track {
  const releaseYear = t.releaseDate ? parseInt(t.releaseDate.slice(0, 4), 10) : undefined;
  return {
    id: t.id,
    name: t.title,
    artists: t.artists?.map((a) => a.name) ?? [],
    album: t.album?.title,
    albumArtUrl: t.album?.imageUrl,
    durationMs: t.durationSeconds != null ? t.durationSeconds * 1000 : undefined,
    isrc: t.isrc,
    previewUrl: t.previewUrl,
    platformId: 'AMAZON_MUSIC',
    platformTrackId: t.id,
    releaseYear,
  };
}

function mapPlaylist(p: AmazonPlaylist): Playlist {
  return {
    id: p.id,
    name: p.title,
    description: p.description,
    platform: 'AMAZON_MUSIC',
    trackCount: p.trackCount ?? 0,
    artworkUrl: p.imageUrl,
    isPublic: p.isPublic ?? false,
    owner: p.owner?.name,
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class AmazonMusicAdapter extends BasePlatformAdapter {
  readonly platformId = 'AMAZON_MUSIC' as const;
  readonly displayName = 'Amazon Music';

  private readonly config: AmazonMusicConfig;

  constructor(config: AmazonMusicConfig) {
    super();
    this.config = config;
  }

  // -------------------------------------------------------------------------
  // Internal fetch helper
  // -------------------------------------------------------------------------

  private async request<T>(
    path: string,
    accessToken: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = path.startsWith('http') ? path : `${AMAZON_MUSIC_BASE}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
      },
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') ?? '1', 10);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return this.request<T>(path, accessToken, options);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Amazon Music API error ${response.status} on ${options.method ?? 'GET'} ${path}: ${text}`,
      );
    }

    return response.json() as Promise<T>;
  }

  // -------------------------------------------------------------------------
  // Auth — Login with Amazon OAuth 2.0
  // -------------------------------------------------------------------------

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: AMAZON_SCOPES,
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
    });
    return `${AMAZON_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const response = await fetch(AMAZON_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Amazon Music token exchange failed ${response.status}: ${text}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
      scope?: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
      tokenType: data.token_type ?? 'Bearer',
      scope: data.scope,
    };
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const response = await fetch(AMAZON_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Amazon Music token refresh failed ${response.status}: ${text}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
      scope?: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
      tokenType: data.token_type ?? 'Bearer',
      scope: data.scope,
    };
  }

  // -------------------------------------------------------------------------
  // User profile
  // -------------------------------------------------------------------------

  async getUserProfile(accessToken: string): Promise<PlatformUserProfile> {
    const data = await this.request<AmazonUserProfile>('/me', accessToken);
    return {
      platformUserId: data.user_id ?? 'unknown',
      displayName: data.profile?.name ?? data.name ?? 'Amazon Music User',
      email: data.profile?.email ?? data.email,
    };
  }

  // -------------------------------------------------------------------------
  // Playlists
  // -------------------------------------------------------------------------

  async getUserPlaylists(accessToken: string): Promise<Playlist[]> {
    const data = await this.request<{ playlists: AmazonPlaylist[] }>(
      '/me/playlists',
      accessToken,
    );
    return (data.playlists ?? []).map(mapPlaylist);
  }

  async getPlaylistTracks(accessToken: string, playlistId: string): Promise<Track[]> {
    const data = await this.request<{ tracks: AmazonTrack[] }>(
      `/playlists/${playlistId}/tracks`,
      accessToken,
    );
    return (data.tracks ?? []).map(mapTrack);
  }

  async createPlaylist(
    accessToken: string,
    name: string,
    description?: string,
    isPublic?: boolean,
  ): Promise<Playlist> {
    const body = { title: name, description: description ?? '', isPublic: isPublic ?? false };
    const data = await this.request<{ playlist: AmazonPlaylist }>(
      '/me/playlists',
      accessToken,
      { method: 'POST', body: JSON.stringify(body) },
    );
    return mapPlaylist(data.playlist);
  }

  async addTracksToPlaylist(
    accessToken: string,
    playlistId: string,
    trackIds: string[],
  ): Promise<void> {
    const body = { trackIds };
    await this.request<void>(
      `/playlists/${playlistId}/tracks`,
      accessToken,
      { method: 'POST', body: JSON.stringify(body) },
    );
  }

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  async searchTrack(
    accessToken: string,
    query: TrackQuery,
  ): Promise<TrackSearchResult[]> {
    const q = encodeURIComponent(`${query.artist} ${query.name}`);
    const data = await this.request<{ tracks: AmazonTrack[] }>(
      `/search?query=${q}&type=track`,
      accessToken,
    );
    return (data.tracks ?? []).map((t) => ({ track: mapTrack(t), score: 0 }));
  }

  async searchAlbum(accessToken: string, query: AlbumQuery): Promise<Album[]> {
    const q = encodeURIComponent(`${query.artist} ${query.name}`);
    const data = await this.request<{ albums: AmazonAlbum[] }>(
      `/search?query=${q}&type=album`,
      accessToken,
    );
    return (data.albums ?? []).map((al) => ({
      id: al.id,
      name: al.title,
      artist: al.artists?.[0]?.name ?? '',
      artworkUrl: al.imageUrl,
      releaseYear: al.releaseDate ? parseInt(al.releaseDate.slice(0, 4), 10) : undefined,
      trackCount: al.trackCount,
    }));
  }

  // -------------------------------------------------------------------------
  // Liked songs
  // -------------------------------------------------------------------------

  async getLikedSongs(accessToken: string, limit?: number): Promise<Track[]> {
    const data = await this.request<{ tracks: AmazonTrack[] }>(
      '/me/tracks',
      accessToken,
    );
    const tracks = (data.tracks ?? []).map(mapTrack);
    return limit ? tracks.slice(0, limit) : tracks;
  }

  async likeTrack(accessToken: string, trackId: string): Promise<void> {
    await this.request<void>(`/me/tracks/${trackId}`, accessToken, { method: 'PUT' });
  }
}
