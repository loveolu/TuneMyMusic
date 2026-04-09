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

export interface DeezerConfig {
  appId: string;
  appSecret: string;
}

const AUTH_URL = 'https://connect.deezer.com/oauth/auth.php';
const TOKEN_URL = 'https://connect.deezer.com/oauth/access_token.php';
const BASE_URL = 'https://api.deezer.com';
const PERMS = 'basic_access,manage_library,offline_access';

// ─── Internal API response shapes ────────────────────────────────────────────

interface DeezerArtist {
  id: number;
  name: string;
  picture_medium?: string;
}

interface DeezerAlbum {
  id: number;
  title: string;
  cover_medium?: string;
  release_date?: string;
  nb_tracks?: number;
  artist?: DeezerArtist;
}

interface DeezerTrack {
  id: number;
  title: string;
  duration: number; // seconds
  isrc?: string;
  artist?: DeezerArtist;
  album?: DeezerAlbum;
  preview?: string;
}

interface DeezerPlaylist {
  id: number;
  title: string;
  description?: string;
  nb_tracks: number;
  picture_medium?: string;
  public?: boolean;
  creator?: { id: number; name: string };
  link?: string;
}

interface DeezerPaginatedResponse<T> {
  data: T[];
  total?: number;
  next?: string;
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export class DeezerAdapter extends BasePlatformAdapter {
  readonly platformId = 'DEEZER' as const;
  readonly displayName = 'Deezer';
  readonly supportsWrite = true;

  private readonly appId: string;
  private readonly appSecret: string;

  constructor(config: DeezerConfig) {
    super();
    this.appId = config.appId;
    this.appSecret = config.appSecret;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      app_id: this.appId,
      redirect_uri: redirectUri,
      perms: PERMS,
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      app_id: this.appId,
      secret: this.appSecret,
      code,
      redirect_uri: redirectUri,
    });

    const response = await this.fetchWithRetry(`${TOKEN_URL}?${params.toString()}`, {
      method: 'POST',
    });

    // Deezer returns plain text: "access_token=xxx&expires=yyy"
    const text = await response.text();
    const parsed = new URLSearchParams(text);
    const accessToken = parsed.get('access_token');
    const expiresRaw = parsed.get('expires');

    if (!accessToken) {
      throw new Error(`[DeezerAdapter] Token exchange failed — unexpected response: ${text}`);
    }

    const expiresIn = expiresRaw ? Number(expiresRaw) : 3600 * 24 * 365; // Deezer offline token can be long-lived

    return {
      accessToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      tokenType: 'Bearer',
    };
  }

  async refreshTokens(_refreshToken: string): Promise<OAuthTokens> {
    // Deezer's simpler OAuth flow does not support refresh tokens.
    // Callers should redirect the user through getAuthUrl() again.
    throw new Error(
      '[DeezerAdapter] Deezer does not support token refresh. Re-authenticate via getAuthUrl().',
    );
  }

  // ── User ──────────────────────────────────────────────────────────────────

  async getUserProfile(accessToken: string): Promise<PlatformUserProfile> {
    const data = await this.get<{
      id: number;
      name: string;
      email?: string;
      picture_medium?: string;
    }>(accessToken, '/user/me');

    return {
      platformUserId: String(data.id),
      displayName: data.name,
      email: data.email,
      avatarUrl: data.picture_medium,
    };
  }

  // ── Playlists ─────────────────────────────────────────────────────────────

  async getUserPlaylists(accessToken: string): Promise<Playlist[]> {
    const playlists: Playlist[] = [];
    let url: string | null = `/user/me/playlists`;

    while (url !== null) {
      const data: DeezerPaginatedResponse<DeezerPlaylist> = await this.get<DeezerPaginatedResponse<DeezerPlaylist>>(accessToken, url);
      playlists.push(...data.data.map((p: DeezerPlaylist) => this.mapPlaylist(p)));

      // Deezer provides a "next" full URL for pagination
      url = data.next ? this.relativeOrAbsolute(data.next) : null;
    }

    return playlists;
  }

  async getPlaylistTracks(accessToken: string, playlistId: string): Promise<Track[]> {
    const tracks: Track[] = [];
    let url: string | null = `/playlist/${playlistId}/tracks`;

    while (url !== null) {
      const data: DeezerPaginatedResponse<DeezerTrack> = await this.get<DeezerPaginatedResponse<DeezerTrack>>(accessToken, url);
      tracks.push(...data.data.map((t: DeezerTrack) => this.mapTrack(t)));
      url = data.next ? this.relativeOrAbsolute(data.next) : null;
    }

    return tracks;
  }

  async createPlaylist(
    accessToken: string,
    name: string,
    _description?: string,
    _isPublic?: boolean,
  ): Promise<Playlist> {
    const data = await this.post<{ id: number }>(
      accessToken,
      `/user/me/playlists?title=${encodeURIComponent(name)}`,
      {},
    );

    // Fetch the full playlist to return a complete Playlist object
    const full = await this.get<DeezerPlaylist>(accessToken, `/playlist/${data.id}`);
    return this.mapPlaylist(full);
  }

  async addTracksToPlaylist(
    accessToken: string,
    playlistId: string,
    trackIds: string[],
  ): Promise<void> {
    // Deezer accepts comma-separated track IDs
    await this.post<boolean>(
      accessToken,
      `/playlist/${playlistId}/tracks`,
      {},
      { songs: trackIds.join(',') },
    );
  }

  // ── Search ────────────────────────────────────────────────────────────────

  async searchTrack(accessToken: string, query: TrackQuery): Promise<TrackSearchResult[]> {
    const q = [query.artist, query.name, query.album].filter(Boolean).join(' ');
    const data = await this.get<DeezerPaginatedResponse<DeezerTrack>>(
      accessToken,
      `/search/track?q=${encodeURIComponent(q)}`,
    );

    return data.data.map((track) => ({
      track: this.mapTrack(track),
      score: 0,
    }));
  }

  async searchAlbum(accessToken: string, query: AlbumQuery): Promise<Album[]> {
    const q = [query.artist, query.name].filter(Boolean).join(' ');
    const data = await this.get<DeezerPaginatedResponse<DeezerAlbum>>(
      accessToken,
      `/search/album?q=${encodeURIComponent(q)}`,
    );

    return data.data.map((album) => this.mapAlbum(album));
  }

  // ── Liked songs ───────────────────────────────────────────────────────────

  async getLikedSongs(accessToken: string, limit = 100): Promise<Track[]> {
    const tracks: Track[] = [];
    let url: string | null = `/user/me/tracks?limit=50`;

    while (url !== null && tracks.length < limit) {
      const data: DeezerPaginatedResponse<DeezerTrack> = await this.get<DeezerPaginatedResponse<DeezerTrack>>(accessToken, url);
      tracks.push(...data.data.map((t: DeezerTrack) => this.mapTrack(t)));
      url = data.next ? this.relativeOrAbsolute(data.next) : null;
    }

    return tracks.slice(0, limit);
  }

  async likeTrack(accessToken: string, trackId: string): Promise<void> {
    await this.post<boolean>(accessToken, `/user/me/tracks`, {}, { track_id: trackId });
  }

  // ── Internal HTTP helpers ─────────────────────────────────────────────────

  /**
   * Deezer requires access_token as a query parameter, NOT in the Authorization header.
   */
  private appendToken(url: string, accessToken: string): string {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}access_token=${encodeURIComponent(accessToken)}`;
  }

  /**
   * If the URL returned by Deezer's "next" field is already absolute, strip the base
   * and return the path+query so our helper can re-attach the token.
   */
  private relativeOrAbsolute(next: string): string {
    if (next.startsWith(BASE_URL)) {
      return next.slice(BASE_URL.length);
    }
    return next;
  }

  private async get<T>(accessToken: string, path: string): Promise<T> {
    const url = this.appendToken(`${BASE_URL}${path}`, accessToken);
    const response = await this.fetchWithRetry(url, {
      headers: { Accept: 'application/json' },
    });
    return response.json() as Promise<T>;
  }

  /**
   * POST to Deezer. Extra query params (like title, songs) go in the URL.
   * The body can also contain fields (Deezer typically ignores the JSON body).
   */
  private async post<T>(
    accessToken: string,
    path: string,
    body: Record<string, string>,
    queryParams: Record<string, string> = {},
  ): Promise<T> {
    const params = new URLSearchParams({ ...queryParams });
    const sep = path.includes('?') ? '&' : '?';
    const urlWithToken = this.appendToken(
      `${BASE_URL}${path}${params.toString() ? `${sep}${params.toString()}` : ''}`,
      accessToken,
    );

    const response = await this.fetchWithRetry(urlWithToken, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: Object.keys(body).length
        ? new URLSearchParams(body).toString()
        : undefined,
    });

    return response.json() as Promise<T>;
  }

  /**
   * Fetch with automatic 429 retry (exponential back-off, max 3 attempts).
   */
  private async fetchWithRetry(url: string, init?: RequestInit, attempt = 0): Promise<Response> {
    const response = await fetch(url, init);

    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get('Retry-After') ?? 1);
      const delay = (retryAfter > 0 ? retryAfter : 1) * 1000 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, delay));
      return this.fetchWithRetry(url, init, attempt + 1);
    }

    if (!response.ok) {
      let message = `Deezer API error ${response.status}`;
      try {
        const err = await response.json() as { error?: { message?: string } };
        message = err.error?.message ?? message;
      } catch {
        // ignore JSON parse errors
      }
      throw new Error(`[DeezerAdapter] ${message} (${response.status}) for ${url}`);
    }

    return response;
  }

  // ── Mapping helpers ───────────────────────────────────────────────────────

  private mapTrack(t: DeezerTrack): Track {
    return {
      id: String(t.id),
      name: t.title,
      artists: t.artist ? [t.artist.name] : [],
      album: t.album?.title,
      albumArtUrl: t.album?.cover_medium,
      durationMs: t.duration != null ? t.duration * 1000 : undefined,
      isrc: t.isrc,
      previewUrl: t.preview,
      platformId: 'DEEZER',
      platformTrackId: String(t.id),
      releaseYear: t.album?.release_date
        ? new Date(t.album.release_date).getFullYear()
        : undefined,
    };
  }

  private mapPlaylist(p: DeezerPlaylist): Playlist {
    return {
      id: String(p.id),
      name: p.title,
      description: p.description,
      platform: 'DEEZER',
      trackCount: p.nb_tracks,
      artworkUrl: p.picture_medium,
      isPublic: p.public ?? true,
      owner: p.creator?.name ?? (p.creator ? String(p.creator.id) : undefined),
      externalUrl: p.link,
    };
  }

  private mapAlbum(a: DeezerAlbum): Album {
    return {
      id: String(a.id),
      name: a.title,
      artist: a.artist?.name ?? '',
      artworkUrl: a.cover_medium,
      releaseYear: a.release_date ? new Date(a.release_date).getFullYear() : undefined,
      trackCount: a.nb_tracks,
    };
  }
}
