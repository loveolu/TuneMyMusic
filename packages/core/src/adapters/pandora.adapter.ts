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

export interface PandoraConfig {
  clientId: string;
  clientSecret: string;
}

interface PandoraSettings {
  pandoraId?: string;
  listenerId?: string;
  username?: string;
  displayName?: string;
  profileImage?: { url?: string };
  email?: string;
}

interface PandoraPlaylistItem {
  pandoraId?: string;
  name?: string;
  description?: string;
  isPublic?: boolean;
  trackCount?: number;
  artUrl?: string;
  listenerIdToken?: string;
}

interface PandoraTrackItem {
  pandoraId?: string;
  songTitle?: string;
  artistName?: string;
  albumTitle?: string;
  albumArtUrl?: string;
  durationSeconds?: number;
  isrc?: string;
  releaseYear?: number;
  sampleUrl?: string;
}

interface PandoraSearchResult<T> {
  results?: T[];
  items?: T[];
}

export class PandoraAdapter extends BasePlatformAdapter {
  readonly platformId = 'PANDORA' as const;
  readonly displayName = 'Pandora';
  readonly supportsWrite = true;

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl = 'https://www.pandora.com/api/v1';
  private readonly authUrl = 'https://www.pandora.com/account/sign-in';
  private readonly tokenUrl = 'https://www.pandora.com/api/v1/auth/token';

  constructor(config: PandoraConfig) {
    super();
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    });
    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
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
      tokenType: 'Bearer',
      scope: data.scope,
    };
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
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
      tokenType: 'Bearer',
      scope: data.scope,
    };
  }

  async getUserProfile(accessToken: string): Promise<PlatformUserProfile> {
    const data = await this.get<PandoraSettings>(accessToken, '/listener/getSettings');
    return {
      platformUserId: data.pandoraId ?? data.listenerId ?? '',
      displayName: data.displayName ?? data.username ?? 'Pandora User',
      avatarUrl: data.profileImage?.url,
      email: data.email,
    };
  }

  async getUserPlaylists(accessToken: string): Promise<Playlist[]> {
    const data = await this.get<{ playlists?: PandoraPlaylistItem[] }>(
      accessToken,
      '/playlists/v7/getPlaylists',
    );
    const playlists = data.playlists ?? [];
    return playlists.map((p) => this.mapPlaylist(p));
  }

  async getPlaylistTracks(accessToken: string, playlistId: string): Promise<Track[]> {
    const data = await this.get<{ tracks?: PandoraTrackItem[] }>(
      accessToken,
      `/playlists/v7/getTracks?playlistId=${encodeURIComponent(playlistId)}`,
    );
    const tracks = data.tracks ?? [];
    return tracks.map((t) => this.mapTrack(t));
  }

  async createPlaylist(
    accessToken: string,
    name: string,
    description?: string,
    isPublic?: boolean,
  ): Promise<Playlist> {
    const response = await fetch(`${this.baseUrl}/playlists/v7/createPlaylist`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description: description ?? '',
        isPublic: isPublic ?? true,
      }),
    });

    await this.assertOk(response, 'createPlaylist');
    const data = await response.json() as PandoraPlaylistItem;
    return this.mapPlaylist(data);
  }

  async addTracksToPlaylist(
    accessToken: string,
    playlistId: string,
    trackIds: string[],
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/playlists/v7/addTracks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playlistId,
        trackIds,
      }),
    });

    await this.assertOk(response, 'addTracksToPlaylist');
  }

  async searchTrack(accessToken: string, query: TrackQuery): Promise<TrackSearchResult[]> {
    const q = [query.artist, query.name].filter(Boolean).join(' ');
    const data = await this.get<PandoraSearchResult<PandoraTrackItem>>(
      accessToken,
      `/search?query=${encodeURIComponent(q)}&types=TR`,
    );

    const tracks = data.results ?? data.items ?? [];
    return tracks.map((t) => ({ track: this.mapTrack(t), score: 0 }));
  }

  async searchAlbum(accessToken: string, query: AlbumQuery): Promise<Album[]> {
    const q = [query.artist, query.name].filter(Boolean).join(' ');

    interface PandoraAlbumItem {
      pandoraId?: string;
      name?: string;
      artistName?: string;
      artUrl?: string;
      releaseYear?: number;
      trackCount?: number;
    }

    const data = await this.get<PandoraSearchResult<PandoraAlbumItem>>(
      accessToken,
      `/search?query=${encodeURIComponent(q)}&types=AL`,
    );

    const albums = data.results ?? data.items ?? [];
    return albums.map((a) => ({
      id: a.pandoraId ?? '',
      name: a.name ?? '',
      artist: a.artistName ?? 'Unknown',
      artworkUrl: a.artUrl,
      releaseYear: a.releaseYear,
      trackCount: a.trackCount,
    }));
  }

  async getLikedSongs(accessToken: string, limit?: number): Promise<Track[]> {
    const data = await this.get<{ thumbsUp?: PandoraTrackItem[]; tracks?: PandoraTrackItem[] }>(
      accessToken,
      '/listener/getThumbsUp',
    );

    const tracks = (data.thumbsUp ?? data.tracks ?? []).map((t) => this.mapTrack(t));
    return limit !== undefined ? tracks.slice(0, limit) : tracks;
  }

  async likeTrack(accessToken: string, trackId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/listener/addThumbUp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trackId }),
    });

    await this.assertOk(response, 'likeTrack');
  }

  // ---- private helpers ----

  private async get<T>(accessToken: string, path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 429) {
      throw new Error('Pandora rate limit exceeded (429). Please retry later.');
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
        `Pandora API error in ${context}: ${response.status} ${response.statusText}${body ? ` — ${body}` : ''}`,
      );
    }
  }

  private mapTrack(t: PandoraTrackItem): Track {
    return {
      id: t.pandoraId ?? '',
      name: t.songTitle ?? '',
      artists: [t.artistName ?? 'Unknown'],
      album: t.albumTitle,
      albumArtUrl: t.albumArtUrl,
      durationMs: t.durationSeconds !== undefined ? t.durationSeconds * 1000 : undefined,
      isrc: t.isrc,
      previewUrl: t.sampleUrl,
      platformId: 'PANDORA',
      platformTrackId: t.pandoraId,
      releaseYear: t.releaseYear,
    };
  }

  private mapPlaylist(p: PandoraPlaylistItem): Playlist {
    return {
      id: p.pandoraId ?? '',
      name: p.name ?? '',
      description: p.description,
      platform: 'PANDORA',
      trackCount: p.trackCount ?? 0,
      artworkUrl: p.artUrl,
      isPublic: p.isPublic ?? true,
      owner: p.listenerIdToken,
    };
  }
}
