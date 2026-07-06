import { createHash, randomBytes } from 'node:crypto';
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

export interface TidalConfig {
  clientId: string;
  clientSecret: string;
  countryCode?: string;
}

const AUTH_URL = 'https://login.tidal.com/authorize';
const TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token';
const BASE_URL = 'https://openapi.tidal.com/v2';
const SCOPES = 'playlists.read playlists.write collection.read collection.write';
const BATCH_SIZE = 100;

// ─── Internal API response shapes ────────────────────────────────────────────

interface TidalArtist {
  id: string;
  name: string;
}

interface TidalAlbum {
  id: string;
  title: string;
  imagePath?: string;
  releaseDate?: string;
  numberOfTracks?: number;
  artists?: TidalArtist[];
}

interface TidalTrack {
  id: string;
  title: string;
  duration: number; // seconds
  isrc?: string;
  artists?: TidalArtist[];
  album?: TidalAlbum;
  audioQuality?: string;
}

interface TidalPlaylist {
  uuid: string;
  title: string;
  description?: string;
  numberOfTracks: number;
  squareImage?: string;
  publicPlaylist?: boolean;
  creator?: { id: number; name?: string };
  url?: string;
}

interface TidalPaginatedResponse<T> {
  data: T[];
  metadata?: {
    total?: number;
    cursor?: string;
    offset?: number;
    limit?: number;
  };
}

// ─── Helper: generate PKCE code_verifier / code_challenge ────────────────────

function base64UrlEncode(buffer: Uint8Array | Buffer): string {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Synchronous PKCE generation. Server-side (Node), so we use the synchronous
 * `crypto.createHash` API rather than the async `crypto.subtle.digest`.
 */
function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64UrlEncode(randomBytes(32));
  const codeChallenge = base64UrlEncode(createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

// PKCE verifier TTL — Tidal flows must complete within this window.
const PKCE_VERIFIER_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── Adapter ─────────────────────────────────────────────────────────────────

export class TidalAdapter extends BasePlatformAdapter {
  readonly platformId = 'TIDAL' as const;
  readonly displayName = 'Tidal';
  readonly supportsWrite = true;

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly countryCode: string;

  // PKCE verifier store, keyed by OAuth `state` so concurrent auth flows
  // (multiple users hitting the same singleton adapter) don't trample each
  // other. Entries auto-expire after PKCE_VERIFIER_TTL_MS.
  private readonly pkceStore = new Map<string, { verifier: string; expiresAt: number }>();

  constructor(config: TidalConfig) {
    super();
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.countryCode = config.countryCode ?? 'US';
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  getAuthUrl(state: string, redirectUri: string): string {
    // Generate PKCE pair synchronously (Node SHA-256). Verifier is stashed
    // keyed by `state` so the callback handler can pass `state` to
    // exchangeCodeForTokens and we can pull the matching verifier out.
    this.cleanupExpiredPkce();
    const { codeVerifier, codeChallenge } = generatePKCE();
    this.pkceStore.set(state, {
      verifier: codeVerifier,
      expiresAt: Date.now() + PKCE_VERIFIER_TTL_MS,
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: SCOPES,
      state,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    state?: string,
  ): Promise<OAuthTokens> {
    this.cleanupExpiredPkce();

    // Look up the PKCE verifier that was stored when getAuthUrl was called.
    // Without it Tidal will reject the exchange with `invalid_grant`.
    const codeVerifier = state ? this.pkceStore.get(state)?.verifier : undefined;
    if (state) this.pkceStore.delete(state); // one-shot

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.clientId,
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    });

    const response = await this.fetchWithRetry(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`,
      },
      body: body.toString(),
    });

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type?: string;
      scope?: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type ?? 'Bearer',
      scope: data.scope,
    };
  }

  private cleanupExpiredPkce(): void {
    const now = Date.now();
    for (const [state, entry] of this.pkceStore.entries()) {
      if (entry.expiresAt <= now) this.pkceStore.delete(state);
    }
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
    });

    const response = await this.fetchWithRetry(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`,
      },
      body: body.toString(),
    });

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type?: string;
      scope?: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type ?? 'Bearer',
      scope: data.scope,
    };
  }

  // ── User ──────────────────────────────────────────────────────────────────

  async getUserProfile(accessToken: string): Promise<PlatformUserProfile> {
    const data = await this.get<{
      id: string;
      username: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      picture?: string;
    }>(accessToken, '/users/me');

    return {
      platformUserId: String(data.id),
      displayName: data.username ?? [data.firstName, data.lastName].filter(Boolean).join(' ') ?? data.id,
      email: data.email,
      avatarUrl: data.picture,
    };
  }

  // ── Playlists ─────────────────────────────────────────────────────────────

  async getUserPlaylists(accessToken: string): Promise<Playlist[]> {
    const playlists: Playlist[] = [];
    let offset = 0;
    const limit = 50;

    while (true) {
      const data = await this.get<TidalPaginatedResponse<TidalPlaylist>>(
        accessToken,
        `/users/me/playlists?offset=${offset}&limit=${limit}`,
      );

      playlists.push(...data.data.map((p) => this.mapPlaylist(p)));

      const total = data.metadata?.total ?? data.data.length;
      offset += data.data.length;
      if (data.data.length < limit || offset >= total) break;
    }

    return playlists;
  }

  async getPlaylistTracks(accessToken: string, playlistId: string): Promise<Track[]> {
    const tracks: Track[] = [];
    let offset = 0;
    const limit = 50;

    while (true) {
      const data = await this.get<TidalPaginatedResponse<{ item: TidalTrack; type: string }>>(
        accessToken,
        `/playlists/${playlistId}/items?offset=${offset}&limit=${limit}`,
      );

      tracks.push(...data.data.map((entry) => this.mapTrack(entry.item)));

      const total = data.metadata?.total ?? data.data.length;
      offset += data.data.length;
      if (data.data.length < limit || offset >= total) break;
    }

    return tracks;
  }

  async createPlaylist(
    accessToken: string,
    name: string,
    description?: string,
    isPublic?: boolean,
  ): Promise<Playlist> {
    const data = await this.post<TidalPlaylist>(accessToken, '/users/me/playlists', {
      title: name,
      description: description ?? '',
      isPublic: isPublic ?? true,
    });

    return this.mapPlaylist(data);
  }

  async addTracksToPlaylist(
    accessToken: string,
    playlistId: string,
    trackIds: string[],
  ): Promise<void> {
    // Batch into chunks of BATCH_SIZE (max 100)
    for (let i = 0; i < trackIds.length; i += BATCH_SIZE) {
      const chunk = trackIds.slice(i, i + BATCH_SIZE);
      await this.post(accessToken, `/playlists/${playlistId}/items`, {
        trackIds: chunk,
        onArtifact: 'ADD',
        onDuplicate: 'ADD',
      });
    }
  }

  // ── Search ────────────────────────────────────────────────────────────────

  async searchTrack(accessToken: string, query: TrackQuery): Promise<TrackSearchResult[]> {
    const q = [query.artist, query.name, query.album].filter(Boolean).join(' ');
    const encoded = encodeURIComponent(q);
    const data = await this.get<TidalPaginatedResponse<TidalTrack>>(
      accessToken,
      `/searchresults/${encoded}/tracks?limit=10`,
    );

    return data.data.map((track) => ({
      track: this.mapTrack(track),
      score: 0,
    }));
  }

  async searchAlbum(accessToken: string, query: AlbumQuery): Promise<Album[]> {
    const q = [query.artist, query.name].filter(Boolean).join(' ');
    const encoded = encodeURIComponent(q);
    const data = await this.get<TidalPaginatedResponse<TidalAlbum>>(
      accessToken,
      `/searchresults/${encoded}/albums?limit=10`,
    );

    return data.data.map((album) => this.mapAlbum(album));
  }

  // ── Liked songs ───────────────────────────────────────────────────────────

  async getLikedSongs(accessToken: string, limit = 100): Promise<Track[]> {
    const tracks: Track[] = [];
    let offset = 0;
    const pageSize = Math.min(limit, 50);

    while (tracks.length < limit) {
      const data = await this.get<TidalPaginatedResponse<TidalTrack>>(
        accessToken,
        `/users/me/favorites/tracks?offset=${offset}&limit=${pageSize}`,
      );

      tracks.push(...data.data.map((t) => this.mapTrack(t)));

      const total = data.metadata?.total ?? data.data.length;
      offset += data.data.length;
      if (data.data.length < pageSize || offset >= total) break;
    }

    return tracks.slice(0, limit);
  }

  async likeTrack(accessToken: string, trackId: string): Promise<void> {
    await this.post(accessToken, '/users/me/favorites/tracks', { trackIds: [trackId] });
  }

  // ── Internal HTTP helpers ─────────────────────────────────────────────────

  private authHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.tidal.v1+json',
      Accept: 'application/vnd.tidal.v1+json',
      countryCode: this.countryCode,
    };
  }

  private async get<T>(accessToken: string, path: string): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const response = await this.fetchWithRetry(url, {
      headers: this.authHeaders(accessToken),
    });
    return response.json() as Promise<T>;
  }

  private async post<T>(accessToken: string, path: string, body: unknown): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.authHeaders(accessToken),
      body: JSON.stringify(body),
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
      let message = `Tidal API error ${response.status}`;
      try {
        const err = await response.json() as { userMessage?: string; title?: string };
        message = err.userMessage ?? err.title ?? message;
      } catch {
        // ignore JSON parse errors
      }
      throw new Error(`[TidalAdapter] ${message} (${response.status}) for ${url}`);
    }

    return response;
  }

  // ── Mapping helpers ───────────────────────────────────────────────────────

  private mapTrack(t: TidalTrack): Track {
    return {
      id: String(t.id),
      name: t.title,
      artists: t.artists?.map((a) => a.name) ?? [],
      album: t.album?.title,
      albumArtUrl: t.album?.imagePath,
      durationMs: t.duration != null ? t.duration * 1000 : undefined,
      isrc: t.isrc,
      platformId: 'TIDAL',
      platformTrackId: String(t.id),
      releaseYear: t.album?.releaseDate
        ? new Date(t.album.releaseDate).getFullYear()
        : undefined,
    };
  }

  private mapPlaylist(p: TidalPlaylist): Playlist {
    return {
      id: p.uuid,
      name: p.title,
      description: p.description,
      platform: 'TIDAL',
      trackCount: p.numberOfTracks,
      artworkUrl: p.squareImage,
      isPublic: p.publicPlaylist ?? true,
      owner: p.creator?.name ?? (p.creator ? String(p.creator.id) : undefined),
      externalUrl: p.url,
    };
  }

  private mapAlbum(a: TidalAlbum): Album {
    return {
      id: String(a.id),
      name: a.title,
      artist: a.artists?.[0]?.name ?? '',
      artworkUrl: a.imagePath,
      releaseYear: a.releaseDate ? new Date(a.releaseDate).getFullYear() : undefined,
      trackCount: a.numberOfTracks,
    };
  }
}
