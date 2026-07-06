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

export interface SoundCloudConfig {
  clientId: string;
  clientSecret: string;
}

interface SoundCloudUser {
  id: number;
  username: string;
  full_name?: string;
  avatar_url?: string;
  email?: string;
}

interface SoundCloudTrack {
  id: number;
  title: string;
  user?: { username?: string; full_name?: string };
  permalink_url?: string;
  artwork_url?: string;
  duration?: number; // milliseconds
  purchase_url?: string;
  stream_url?: string;
  publisher_metadata?: { isrc?: string };
  release_year?: number;
}

interface SoundCloudPlaylist {
  id: number;
  title: string;
  description?: string;
  sharing?: string;
  user?: { username?: string };
  artwork_url?: string;
  permalink_url?: string;
  tracks?: SoundCloudTrack[];
  track_count?: number;
}

interface SoundCloudPaginatedTracks {
  collection: SoundCloudTrack[];
  next_href?: string;
}

export class SoundCloudAdapter extends BasePlatformAdapter {
  readonly platformId = 'SOUNDCLOUD' as const;
  readonly displayName = 'SoundCloud';
  readonly supportsWrite = true;

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl = 'https://api.soundcloud.com';
  private readonly authUrl = 'https://api.soundcloud.com/connect';
  private readonly tokenUrl = 'https://api.soundcloud.com/oauth2/token';

  constructor(config: SoundCloudConfig) {
    super();
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'non-expiring',
      state,
    });
    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    await this.assertOk(response, 'exchangeCodeForTokens');

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
      tokenType: 'OAuth',
      scope: data.scope,
    };
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    await this.assertOk(response, 'refreshTokens');

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
      tokenType: 'OAuth',
      scope: data.scope,
    };
  }

  async getUserProfile(accessToken: string): Promise<PlatformUserProfile> {
    const data = await this.get<SoundCloudUser>(accessToken, '/me');
    return {
      platformUserId: String(data.id),
      displayName: data.full_name || data.username,
      avatarUrl: data.avatar_url,
      email: data.email,
    };
  }

  async getUserPlaylists(accessToken: string): Promise<Playlist[]> {
    const sets = await this.get<SoundCloudPlaylist[]>(accessToken, '/me/playlists');
    return sets.map((s) => this.mapPlaylist(s));
  }

  async getPlaylistTracks(accessToken: string, playlistId: string): Promise<Track[]> {
    const playlist = await this.get<SoundCloudPlaylist>(accessToken, `/playlists/${playlistId}/tracks`);
    // The endpoint returns an array directly when fetching tracks
    const tracks = Array.isArray(playlist)
      ? (playlist as unknown as SoundCloudTrack[])
      : (playlist.tracks ?? []);
    return tracks.map((t) => this.mapTrack(t));
  }

  async createPlaylist(
    accessToken: string,
    name: string,
    description?: string,
    isPublic?: boolean,
  ): Promise<Playlist> {
    const response = await fetch(`${this.baseUrl}/playlists`, {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        playlist: {
          title: name,
          description: description ?? '',
          sharing: isPublic ? 'public' : 'private',
        },
      }),
    });

    await this.assertOk(response, 'createPlaylist');
    const data = await response.json() as SoundCloudPlaylist;
    return this.mapPlaylist(data);
  }

  async addTracksToPlaylist(
    accessToken: string,
    playlistId: string,
    trackIds: string[],
  ): Promise<void> {
    const tracks = trackIds.map((id) => ({ id: Number(id) }));

    const response = await fetch(`${this.baseUrl}/playlists/${playlistId}`, {
      method: 'PUT',
      headers: {
        Authorization: `OAuth ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        playlist: { tracks },
      }),
    });

    await this.assertOk(response, 'addTracksToPlaylist');
  }

  async searchTrack(accessToken: string, query: TrackQuery): Promise<TrackSearchResult[]> {
    const q = [query.artist, query.name].filter(Boolean).join(' ');
    const data = await this.get<SoundCloudTrack[] | SoundCloudPaginatedTracks>(
      accessToken,
      `/tracks?q=${encodeURIComponent(q)}&linked_partitioning=1`,
    );

    const tracks = Array.isArray(data)
      ? data
      : (data as SoundCloudPaginatedTracks).collection ?? [];

    return tracks.map((t) => ({ track: this.mapTrack(t), score: 0 }));
  }

  async searchAlbum(accessToken: string, query: AlbumQuery): Promise<Album[]> {
    const q = [query.artist, query.name].filter(Boolean).join(' ');
    const data = await this.get<SoundCloudPlaylist[]>(
      accessToken,
      `/playlists?q=${encodeURIComponent(q)}&representation=compact`,
    );

    const playlists = Array.isArray(data) ? data : [];

    return playlists.map((p) => ({
      id: String(p.id),
      name: p.title,
      artist: p.user?.username ?? 'Unknown',
      artworkUrl: p.artwork_url ?? undefined,
    }));
  }

  async getLikedSongs(accessToken: string, limit?: number): Promise<Track[]> {
    const tracks: Track[] = [];
    let url: string | undefined = `${this.baseUrl}/me/likes/tracks?linked_partitioning=1&limit=200`;

    while (url) {
      const response = await fetch(url, {
        headers: {
          Authorization: `OAuth ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (response.status === 429) {
        throw new Error('SoundCloud rate limit exceeded (429). Please retry later.');
      }
      await this.assertOk(response, 'getLikedSongs');

      const data = await response.json() as SoundCloudPaginatedTracks;
      const collection = data.collection ?? [];

      for (const t of collection) {
        tracks.push(this.mapTrack(t));
        if (limit !== undefined && tracks.length >= limit) return tracks;
      }

      url = data.next_href;
    }

    return tracks;
  }

  async likeTrack(accessToken: string, trackId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/me/likes/tracks/${trackId}`, {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${accessToken}`,
        Accept: 'application/json',
      },
    });

    await this.assertOk(response, 'likeTrack');
  }

  // ---- private helpers ----

  private async get<T>(accessToken: string, path: string): Promise<T> {
    // path may already contain query params
    const separator = path.includes('?') ? '&' : '?';
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}${separator}client_id=${this.clientId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `OAuth ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (response.status === 429) {
      throw new Error('SoundCloud rate limit exceeded (429). Please retry later.');
    }
    await this.assertOk(response, `GET ${path}`);
    return response.json() as Promise<T>;
  }

  private async assertOk(response: Response, context: string): Promise<void> {
    if (!response.ok) {
      let body = '';
      try {
        body = await response.text();
      } catch {
        // ignore
      }
      throw new Error(
        `SoundCloud API error in ${context}: ${response.status} ${response.statusText}${body ? ` — ${body}` : ''}`,
      );
    }
  }

  private mapTrack(t: SoundCloudTrack): Track {
    return {
      id: String(t.id),
      name: t.title,
      artists: [t.user?.full_name ?? t.user?.username ?? 'Unknown'],
      durationMs: t.duration,
      albumArtUrl: t.artwork_url ?? undefined,
      previewUrl: t.stream_url ?? undefined,
      platformId: 'SOUNDCLOUD',
      platformTrackId: String(t.id),
      isrc: undefined,
      releaseYear: t.release_year ?? undefined,
    };
  }

  private mapPlaylist(p: SoundCloudPlaylist): Playlist {
    return {
      id: String(p.id),
      name: p.title,
      description: p.description ?? undefined,
      platform: 'SOUNDCLOUD',
      trackCount: p.track_count ?? p.tracks?.length ?? 0,
      artworkUrl: p.artwork_url ?? undefined,
      isPublic: p.sharing === 'public',
      owner: p.user?.username,
      externalUrl: p.permalink_url ?? undefined,
    };
  }
}
