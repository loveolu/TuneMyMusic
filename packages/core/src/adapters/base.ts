import type {
  PlatformId,
  OAuthTokens,
  Playlist,
  Track,
  TrackQuery,
  TrackSearchResult,
  AlbumQuery,
  Album,
} from '@tunemymusic/types';

export interface PlatformUserProfile {
  platformUserId: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
}

export interface MusicPlatformAdapter {
  readonly platformId: PlatformId;
  readonly displayName: string;
  readonly supportsWrite: boolean;

  getAuthUrl(state: string, redirectUri: string): string;
  /**
   * Exchange the OAuth `code` for tokens.
   * `state` is forwarded so adapters that store per-flow secrets (e.g. PKCE
   * code_verifier) can look them up by state.
   */
  exchangeCodeForTokens(code: string, redirectUri: string, state?: string): Promise<OAuthTokens>;
  refreshTokens(refreshToken: string): Promise<OAuthTokens>;
  getUserProfile(accessToken: string): Promise<PlatformUserProfile>;
  getUserPlaylists(accessToken: string): Promise<Playlist[]>;
  getPlaylistTracks(accessToken: string, playlistId: string): Promise<Track[]>;
  createPlaylist(accessToken: string, name: string, description?: string, isPublic?: boolean): Promise<Playlist>;
  addTracksToPlaylist(accessToken: string, playlistId: string, trackIds: string[]): Promise<void>;
  searchTrack(accessToken: string, query: TrackQuery): Promise<TrackSearchResult[]>;
  searchAlbum(accessToken: string, query: AlbumQuery): Promise<Album[]>;
  getLikedSongs(accessToken: string, limit?: number): Promise<Track[]>;
  likeTrack(accessToken: string, trackId: string): Promise<void>;
}

export abstract class BasePlatformAdapter implements MusicPlatformAdapter {
  abstract readonly platformId: PlatformId;
  abstract readonly displayName: string;
  readonly supportsWrite: boolean = true;

  abstract getAuthUrl(state: string, redirectUri: string): string;
  abstract exchangeCodeForTokens(code: string, redirectUri: string, state?: string): Promise<OAuthTokens>;
  abstract refreshTokens(refreshToken: string): Promise<OAuthTokens>;
  abstract getUserProfile(accessToken: string): Promise<PlatformUserProfile>;
  abstract getUserPlaylists(accessToken: string): Promise<Playlist[]>;
  abstract getPlaylistTracks(accessToken: string, playlistId: string): Promise<Track[]>;
  abstract createPlaylist(accessToken: string, name: string, description?: string, isPublic?: boolean): Promise<Playlist>;
  abstract addTracksToPlaylist(accessToken: string, playlistId: string, trackIds: string[]): Promise<void>;
  abstract searchTrack(accessToken: string, query: TrackQuery): Promise<TrackSearchResult[]>;
  abstract searchAlbum(accessToken: string, query: AlbumQuery): Promise<Album[]>;
  abstract getLikedSongs(accessToken: string, limit?: number): Promise<Track[]>;
  abstract likeTrack(accessToken: string, trackId: string): Promise<void>;
}
