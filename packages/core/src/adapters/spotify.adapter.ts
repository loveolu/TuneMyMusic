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

interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
}

// ---- Spotify API response shapes ----

interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

interface SpotifyTrackObject {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: SpotifyImage[];
    release_date: string;
  };
  duration_ms: number;
  external_ids?: { isrc?: string };
  preview_url?: string | null;
}

interface SpotifyPlaylistObject {
  id: string;
  name: string;
  description: string | null;
  images: SpotifyImage[];
  public: boolean | null;
  owner: { display_name: string; id: string };
  tracks: { total: number };
  external_urls: { spotify: string };
}

interface SpotifyAlbumObject {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  images: SpotifyImage[];
  release_date: string;
  total_tracks: number;
}

interface SpotifyPagingObject<T> {
  items: T[];
  next: string | null;
  total: number;
  limit: number;
  offset: number;
}

// ---- Helper ----

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function spotifyFetch(url: string, options: RequestInit): Promise<Response> {
  const res = await fetch(url, options);
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '1', 10);
    await sleep(retryAfter * 1000);
    return fetch(url, options);
  }
  return res;
}

function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch {
      // ignore
    }
    throw new Error(`Spotify API error ${res.status}: ${body}`);
  }
}

function mapSpotifyTrack(t: SpotifyTrackObject): Track {
  const releaseYear = t.album?.release_date
    ? parseInt(t.album.release_date.slice(0, 4), 10)
    : undefined;
  return {
    id: t.id,
    name: t.name,
    artists: t.artists.map((a) => a.name),
    album: t.album?.name,
    albumArtUrl: t.album?.images?.[0]?.url,
    durationMs: t.duration_ms,
    isrc: t.external_ids?.isrc,
    previewUrl: t.preview_url ?? undefined,
    platformId: 'SPOTIFY',
    platformTrackId: t.id,
    releaseYear: Number.isNaN(releaseYear) ? undefined : releaseYear,
  };
}

// ---- Adapter ----

export class SpotifyAdapter extends BasePlatformAdapter {
  readonly platformId = 'SPOTIFY' as const;
  readonly displayName = 'Spotify';

  private readonly BASE_URL = 'https://api.spotify.com/v1';
  private readonly AUTH_URL = 'https://accounts.spotify.com/authorize';
  private readonly TOKEN_URL = 'https://accounts.spotify.com/api/token';
  private readonly SCOPES = [
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-library-read',
    'user-library-modify',
    'user-read-private',
  ].join(' ');

  constructor(private config: SpotifyConfig) {
    super();
  }

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: this.SCOPES,
      state,
    });
    return `${this.AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString('base64');
    const res = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: body.toString(),
    });
    await assertOk(res);
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString('base64');
    const res = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: body.toString(),
    });
    await assertOk(res);
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  async getUserProfile(accessToken: string): Promise<PlatformUserProfile> {
    const res = await spotifyFetch(`${this.BASE_URL}/me`, {
      headers: authHeaders(accessToken),
    });
    await assertOk(res);
    const data = (await res.json()) as {
      id: string;
      display_name: string | null;
      email?: string;
      images?: SpotifyImage[];
    };
    return {
      platformUserId: data.id,
      displayName: data.display_name ?? data.id,
      email: data.email,
      avatarUrl: data.images?.[0]?.url,
    };
  }

  async getUserPlaylists(accessToken: string): Promise<Playlist[]> {
    const playlists: Playlist[] = [];
    let offset = 0;
    const limit = 50;

    while (true) {
      const url = `${this.BASE_URL}/me/playlists?limit=${limit}&offset=${offset}`;
      const res = await spotifyFetch(url, { headers: authHeaders(accessToken) });
      await assertOk(res);
      const data = (await res.json()) as SpotifyPagingObject<SpotifyPlaylistObject>;

      for (const item of data.items) {
        playlists.push({
          id: item.id,
          name: item.name,
          description: item.description ?? undefined,
          platform: 'SPOTIFY',
          trackCount: item.tracks.total,
          artworkUrl: item.images?.[0]?.url,
          isPublic: item.public ?? true,
          owner: item.owner?.display_name,
          externalUrl: item.external_urls?.spotify,
        });
      }

      if (!data.next) break;
      offset += limit;
    }

    return playlists;
  }

  async getPlaylistTracks(accessToken: string, playlistId: string): Promise<Track[]> {
    const tracks: Track[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const url = `${this.BASE_URL}/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`;
      const res = await spotifyFetch(url, { headers: authHeaders(accessToken) });
      await assertOk(res);
      const data = (await res.json()) as SpotifyPagingObject<{
        track: SpotifyTrackObject | null;
      }>;

      for (const item of data.items) {
        if (item.track) {
          tracks.push(mapSpotifyTrack(item.track));
        }
      }

      if (!data.next) break;
      offset += limit;
    }

    return tracks;
  }

  async createPlaylist(
    accessToken: string,
    name: string,
    description?: string,
    isPublic?: boolean,
  ): Promise<Playlist> {
    // Need user ID first
    const profile = await this.getUserProfile(accessToken);
    const res = await spotifyFetch(
      `${this.BASE_URL}/users/${profile.platformUserId}/playlists`,
      {
        method: 'POST',
        headers: {
          ...authHeaders(accessToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description: description ?? '',
          public: isPublic ?? false,
        }),
      },
    );
    await assertOk(res);
    const data = (await res.json()) as SpotifyPlaylistObject;
    return {
      id: data.id,
      name: data.name,
      description: data.description ?? undefined,
      platform: 'SPOTIFY',
      trackCount: 0,
      artworkUrl: data.images?.[0]?.url,
      isPublic: data.public ?? false,
      owner: data.owner?.display_name,
      externalUrl: data.external_urls?.spotify,
    };
  }

  async addTracksToPlaylist(
    accessToken: string,
    playlistId: string,
    trackIds: string[],
  ): Promise<void> {
    // Spotify allows max 100 tracks per request
    const BATCH_SIZE = 100;
    for (let i = 0; i < trackIds.length; i += BATCH_SIZE) {
      const batch = trackIds.slice(i, i + BATCH_SIZE);
      const uris = batch.map((id) => `spotify:track:${id}`);
      const res = await spotifyFetch(
        `${this.BASE_URL}/playlists/${playlistId}/tracks`,
        {
          method: 'POST',
          headers: {
            ...authHeaders(accessToken),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uris }),
        },
      );
      await assertOk(res);
    }
  }

  async searchTrack(accessToken: string, query: TrackQuery): Promise<TrackSearchResult[]> {
    let q: string;
    if (query.isrc) {
      q = `isrc:${query.isrc}`;
    } else {
      q = `track:${query.name} artist:${query.artist}`;
    }
    const params = new URLSearchParams({ type: 'track', q, limit: '10' });
    const url = `${this.BASE_URL}/search?${params.toString()}`;
    const res = await spotifyFetch(url, { headers: authHeaders(accessToken) });
    await assertOk(res);
    const data = (await res.json()) as {
      tracks: SpotifyPagingObject<SpotifyTrackObject>;
    };
    return (data.tracks?.items ?? []).map((t) => ({
      track: mapSpotifyTrack(t),
      score: 100,
    }));
  }

  async searchAlbum(accessToken: string, query: AlbumQuery): Promise<Album[]> {
    const q = `album:${query.name} artist:${query.artist}`;
    const params = new URLSearchParams({ type: 'album', q, limit: '10' });
    const url = `${this.BASE_URL}/search?${params.toString()}`;
    const res = await spotifyFetch(url, { headers: authHeaders(accessToken) });
    await assertOk(res);
    const data = (await res.json()) as {
      albums: SpotifyPagingObject<SpotifyAlbumObject>;
    };
    return (data.albums?.items ?? []).map((a) => {
      const releaseYear = a.release_date
        ? parseInt(a.release_date.slice(0, 4), 10)
        : undefined;
      return {
        id: a.id,
        name: a.name,
        artist: a.artists?.[0]?.name ?? '',
        artworkUrl: a.images?.[0]?.url,
        releaseYear: releaseYear !== undefined && !Number.isNaN(releaseYear) ? releaseYear : undefined,
        trackCount: a.total_tracks,
      };
    });
  }

  async getLikedSongs(accessToken: string, limit?: number): Promise<Track[]> {
    const tracks: Track[] = [];
    let offset = 0;
    const pageLimit = 50;

    while (true) {
      const url = `${this.BASE_URL}/me/tracks?limit=${pageLimit}&offset=${offset}`;
      const res = await spotifyFetch(url, { headers: authHeaders(accessToken) });
      await assertOk(res);
      const data = (await res.json()) as SpotifyPagingObject<{
        track: SpotifyTrackObject;
      }>;

      for (const item of data.items) {
        tracks.push(mapSpotifyTrack(item.track));
        if (limit !== undefined && tracks.length >= limit) {
          return tracks;
        }
      }

      if (!data.next) break;
      offset += pageLimit;
    }

    return tracks;
  }

  async likeTrack(accessToken: string, trackId: string): Promise<void> {
    const url = `${this.BASE_URL}/me/tracks?ids=${encodeURIComponent(trackId)}`;
    const res = await spotifyFetch(url, {
      method: 'PUT',
      headers: authHeaders(accessToken),
    });
    await assertOk(res);
  }
}
