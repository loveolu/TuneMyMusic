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

interface YouTubeConfig {
  clientId: string;
  clientSecret: string;
  /**
   * Daily quota cap (units). YouTube Data API v3 default is 10,000 / day.
   * The adapter soft-fails at `quotaSoftCap` (default 90%) so callers see a
   * graceful error before Google starts returning 403 quotaExceeded.
   */
  dailyQuotaLimit?: number;
  quotaSoftCap?: number;
  /**
   * Optional hook fired after each quota-costing call. Use this to persist
   * usage to a DB row keyed by `(date, userId)` from the server side.
   * The adapter itself only keeps an in-memory counter.
   */
  onQuotaUsage?: (info: {
    cost: number;
    operation: string;
    totalUsedToday: number;
    dateUtc: string; // YYYY-MM-DD
  }) => void | Promise<void>;
}

// ---- YouTube Data API v3 quota costs (units per call). See:
//      https://developers.google.com/youtube/v3/determine_quota_cost
const QUOTA_COSTS = {
  search: 100, // search.list
  list: 1, // {playlists,playlistItems,videos,channels}.list
  insert: 50, // playlists.insert, playlistItems.insert
  videosRate: 50, // videos.rate
} as const;

type QuotaOperation = keyof typeof QUOTA_COSTS;

/**
 * Daily YouTube Data API quota tracker. In-memory; resets at UTC midnight.
 * Throws a user-friendly error once usage hits the soft cap so we surface a
 * clean failure to the user before Google starts returning 403 quotaExceeded.
 */
export class YouTubeQuotaTracker {
  private dateUtc: string = todayUtc();
  private usedToday = 0;

  constructor(
    private readonly limit: number,
    private readonly softCap: number,
    private readonly onUsage?: YouTubeConfig['onQuotaUsage'],
  ) {}

  /** Throws if recording the next call would exceed the soft cap. */
  preflight(operation: QuotaOperation): void {
    this.rollIfNewDay();
    const cost = QUOTA_COSTS[operation];
    if (this.usedToday + cost > this.softCap) {
      const err = new Error(
        `YouTube daily quota nearly exhausted (${this.usedToday}/${this.limit} units used today). ` +
          `Please try again after UTC midnight, or upgrade your YouTube Data API quota.`,
      );
      (err as Error & { code?: string }).code = 'YOUTUBE_QUOTA_EXHAUSTED';
      throw err;
    }
  }

  /** Records the spend and fires onUsage hook (fire-and-forget). */
  record(operation: QuotaOperation): void {
    this.rollIfNewDay();
    const cost = QUOTA_COSTS[operation];
    this.usedToday += cost;
    if (this.onUsage) {
      // Don't await — adapter callers should not block on persistence.
      void Promise.resolve(
        this.onUsage({
          cost,
          operation,
          totalUsedToday: this.usedToday,
          dateUtc: this.dateUtc,
        }),
      ).catch(() => {
        // Swallow persistence errors. The in-memory counter is still correct.
      });
    }
  }

  /** Test/inspection helper. */
  snapshot(): { dateUtc: string; usedToday: number; limit: number; softCap: number } {
    this.rollIfNewDay();
    return {
      dateUtc: this.dateUtc,
      usedToday: this.usedToday,
      limit: this.limit,
      softCap: this.softCap,
    };
  }

  private rollIfNewDay(): void {
    const now = todayUtc();
    if (now !== this.dateUtc) {
      this.dateUtc = now;
      this.usedToday = 0;
    }
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---- YouTube API response shapes ----

interface YTThumbnail {
  url: string;
  width?: number;
  height?: number;
}

interface YTThumbnails {
  default?: YTThumbnail;
  medium?: YTThumbnail;
  high?: YTThumbnail;
  standard?: YTThumbnail;
  maxres?: YTThumbnail;
}

interface YTPlaylistSnippet {
  title: string;
  description: string;
  thumbnails?: YTThumbnails;
  channelTitle?: string;
  localized?: { title: string };
}

interface YTPlaylistContentDetails {
  itemCount: number;
}

interface YTPlaylistStatus {
  privacyStatus: string;
}

interface YTPlaylistItem {
  id: string;
  snippet: YTPlaylistSnippet;
  contentDetails: YTPlaylistContentDetails;
  status: YTPlaylistStatus;
}

interface YTPlaylistItemSnippet {
  title: string;
  videoOwnerChannelTitle?: string;
  thumbnails?: YTThumbnails;
  resourceId: {
    kind: string;
    videoId: string;
  };
}

interface YTPlaylistItemResource {
  id: string;
  snippet: YTPlaylistItemSnippet;
}

interface YTVideoSnippet {
  title: string;
  channelTitle?: string;
  thumbnails?: YTThumbnails;
  publishedAt?: string;
}

interface YTVideoContentDetails {
  duration?: string; // ISO 8601 duration e.g. PT3M45S
}

interface YTVideoResource {
  id: string;
  snippet: YTVideoSnippet;
  contentDetails?: YTVideoContentDetails;
}

interface YTListResponse<T> {
  items?: T[];
  nextPageToken?: string;
  pageInfo?: { totalResults: number; resultsPerPage: number };
}

// ---- Helpers ----

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ytFetch(url: string, options: RequestInit): Promise<Response> {
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
    throw new Error(`YouTube API error ${res.status}: ${body}`);
  }
}

/** Parse ISO 8601 duration string (PT3M45S) into milliseconds */
function parseDuration(duration: string): number | undefined {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return undefined;
  const hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  const seconds = parseInt(match[3] ?? '0', 10);
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

function bestThumbnail(thumbnails?: YTThumbnails): string | undefined {
  if (!thumbnails) return undefined;
  return (
    thumbnails.maxres?.url ??
    thumbnails.standard?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url
  );
}

function mapVideoToTrack(video: YTVideoResource): Track {
  const releaseYear = video.snippet.publishedAt
    ? parseInt(video.snippet.publishedAt.slice(0, 4), 10)
    : undefined;
  return {
    id: video.id,
    name: video.snippet.title,
    artists: video.snippet.channelTitle ? [video.snippet.channelTitle] : [],
    albumArtUrl: bestThumbnail(video.snippet.thumbnails),
    durationMs: video.contentDetails?.duration
      ? parseDuration(video.contentDetails.duration)
      : undefined,
    isrc: undefined, // YouTube does not expose ISRCs
    platformId: 'YOUTUBE_MUSIC',
    platformTrackId: video.id,
    releaseYear: releaseYear !== undefined && !Number.isNaN(releaseYear) ? releaseYear : undefined,
  };
}

// ---- Adapter ----

export class YouTubeMusicAdapter extends BasePlatformAdapter {
  readonly platformId = 'YOUTUBE_MUSIC' as const;
  readonly displayName = 'YouTube Music';

  private readonly BASE_URL = 'https://www.googleapis.com/youtube/v3';
  private readonly AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly TOKEN_URL = 'https://oauth2.googleapis.com/token';
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.readonly',
  ].join(' ');

  /** Public so server-side code can inspect / persist current usage. */
  readonly quota: YouTubeQuotaTracker;

  constructor(private config: YouTubeConfig) {
    super();
    const limit = config.dailyQuotaLimit ?? 10_000;
    const softCap = config.quotaSoftCap ?? 9_000;
    this.quota = new YouTubeQuotaTracker(limit, softCap, config.onQuotaUsage);
  }

  /**
   * Wrap a quota-costing API call: preflight the soft cap, run the call,
   * record the spend on success.
   */
  private async withQuota<T>(operation: QuotaOperation, fn: () => Promise<T>): Promise<T> {
    this.quota.preflight(operation);
    const result = await fn();
    this.quota.record(operation);
    return result;
  }

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: this.SCOPES,
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
    return `${this.AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });
    const res = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });
    const res = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
    return this.withQuota('list', async () => {
      const url = `${this.BASE_URL}/channels?part=snippet&mine=true`;
      const res = await ytFetch(url, { headers: authHeaders(accessToken) });
      await assertOk(res);
      const data = (await res.json()) as YTListResponse<{
        id: string;
        snippet: { title: string; thumbnails?: YTThumbnails };
      }>;
      const channel = data.items?.[0];
      if (!channel) {
        throw new Error('YouTube API: no channel found for authenticated user');
      }
      return {
        platformUserId: channel.id,
        displayName: channel.snippet.title,
        avatarUrl: bestThumbnail(channel.snippet.thumbnails),
      };
    });
  }

  async getUserPlaylists(accessToken: string): Promise<Playlist[]> {
    const playlists: Playlist[] = [];
    let pageToken: string | undefined;

    while (true) {
      this.quota.preflight('list');
      const params = new URLSearchParams({
        part: 'snippet,contentDetails,status',
        mine: 'true',
        maxResults: '50',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const url = `${this.BASE_URL}/playlists?${params.toString()}`;
      const res = await ytFetch(url, { headers: authHeaders(accessToken) });
      await assertOk(res);
      this.quota.record('list');
      const data = (await res.json()) as YTListResponse<YTPlaylistItem>;

      for (const item of data.items ?? []) {
        playlists.push({
          id: item.id,
          name: item.snippet.title,
          description: item.snippet.description || undefined,
          platform: 'YOUTUBE_MUSIC',
          trackCount: item.contentDetails.itemCount,
          artworkUrl: bestThumbnail(item.snippet.thumbnails),
          isPublic: item.status.privacyStatus === 'public',
          owner: item.snippet.channelTitle,
        });
      }

      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }

    return playlists;
  }

  async getPlaylistTracks(accessToken: string, playlistId: string): Promise<Track[]> {
    // Special case: "LM" = Liked Music — use getLikedSongs flow
    if (playlistId === 'LM') {
      return this.getLikedSongs(accessToken);
    }

    const videoIds: string[] = [];
    let pageToken: string | undefined;

    // Step 1: collect all video IDs from the playlist
    while (true) {
      this.quota.preflight('list');
      const params = new URLSearchParams({
        part: 'snippet',
        playlistId,
        maxResults: '50',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const url = `${this.BASE_URL}/playlistItems?${params.toString()}`;
      const res = await ytFetch(url, { headers: authHeaders(accessToken) });
      await assertOk(res);
      this.quota.record('list');
      const data = (await res.json()) as YTListResponse<YTPlaylistItemResource>;

      for (const item of data.items ?? []) {
        if (item.snippet.resourceId.kind === 'youtube#video') {
          videoIds.push(item.snippet.resourceId.videoId);
        }
      }

      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }

    if (videoIds.length === 0) return [];

    // Step 2: fetch video details in batches of 50
    const tracks: Track[] = [];
    const BATCH = 50;
    for (let i = 0; i < videoIds.length; i += BATCH) {
      this.quota.preflight('list');
      const ids = videoIds.slice(i, i + BATCH).join(',');
      const params = new URLSearchParams({
        part: 'snippet,contentDetails',
        id: ids,
      });
      const url = `${this.BASE_URL}/videos?${params.toString()}`;
      const res = await ytFetch(url, { headers: authHeaders(accessToken) });
      await assertOk(res);
      this.quota.record('list');
      const data = (await res.json()) as YTListResponse<YTVideoResource>;
      for (const video of data.items ?? []) {
        tracks.push(mapVideoToTrack(video));
      }
    }

    return tracks;
  }

  async createPlaylist(
    accessToken: string,
    name: string,
    description?: string,
    isPublic?: boolean,
  ): Promise<Playlist> {
    this.quota.preflight('insert');
    const url = `${this.BASE_URL}/playlists?part=snippet,status`;
    const res = await ytFetch(url, {
      method: 'POST',
      headers: {
        ...authHeaders(accessToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: { title: name, description: description ?? '' },
        status: { privacyStatus: isPublic ? 'public' : 'private' },
      }),
    });
    await assertOk(res);
    this.quota.record('insert');
    const data = (await res.json()) as YTPlaylistItem & { status: YTPlaylistStatus };
    return {
      id: data.id,
      name: data.snippet.title,
      description: data.snippet.description || undefined,
      platform: 'YOUTUBE_MUSIC',
      trackCount: 0,
      artworkUrl: bestThumbnail(data.snippet.thumbnails),
      isPublic: data.status.privacyStatus === 'public',
      owner: data.snippet.channelTitle,
    };
  }

  async addTracksToPlaylist(
    accessToken: string,
    playlistId: string,
    trackIds: string[],
  ): Promise<void> {
    // YouTube API requires one request per track. Each insert costs 50 units.
    for (const videoId of trackIds) {
      this.quota.preflight('insert');
      const url = `${this.BASE_URL}/playlistItems?part=snippet`;
      const res = await ytFetch(url, {
        method: 'POST',
        headers: {
          ...authHeaders(accessToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            playlistId,
            resourceId: { kind: 'youtube#video', videoId },
          },
        }),
      });
      await assertOk(res);
      this.quota.record('insert');
    }
  }

  async searchTrack(accessToken: string, query: TrackQuery): Promise<TrackSearchResult[]> {
    // search.list is 100 units — easily the most expensive call. Preflight
    // first so we abort BEFORE making the request when the quota is nearly
    // exhausted.
    this.quota.preflight('search');
    const q = `${query.name} ${query.artist}`;
    const searchParams = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      videoCategoryId: '10', // Music
      q,
      maxResults: '10',
    });
    const searchUrl = `${this.BASE_URL}/search?${searchParams.toString()}`;
    const searchRes = await ytFetch(searchUrl, { headers: authHeaders(accessToken) });
    await assertOk(searchRes);
    this.quota.record('search');
    const searchData = (await searchRes.json()) as {
      items?: Array<{ id: { videoId: string }; snippet: YTVideoSnippet }>;
    };

    if (!searchData.items?.length) return [];

    // Fetch video details for duration info (videos.list = 1 unit)
    this.quota.preflight('list');
    const ids = searchData.items.map((i) => i.id.videoId).join(',');
    const detailParams = new URLSearchParams({
      part: 'snippet,contentDetails',
      id: ids,
    });
    const detailUrl = `${this.BASE_URL}/videos?${detailParams.toString()}`;
    const detailRes = await ytFetch(detailUrl, { headers: authHeaders(accessToken) });
    await assertOk(detailRes);
    this.quota.record('list');
    const detailData = (await detailRes.json()) as YTListResponse<YTVideoResource>;

    return (detailData.items ?? []).map((video) => ({
      track: mapVideoToTrack(video),
      score: 100,
    }));
  }

  async searchAlbum(_accessToken: string, _query: AlbumQuery): Promise<Album[]> {
    // YouTube Music does not have a proper album concept via YouTube Data API v3.
    // Return empty array — callers should use track search instead.
    return [];
  }

  async getLikedSongs(accessToken: string, limit?: number): Promise<Track[]> {
    const tracks: Track[] = [];
    let pageToken: string | undefined;

    while (true) {
      this.quota.preflight('list');
      const params = new URLSearchParams({
        part: 'snippet,contentDetails',
        myRating: 'like',
        maxResults: '50',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const url = `${this.BASE_URL}/videos?${params.toString()}`;
      const res = await ytFetch(url, { headers: authHeaders(accessToken) });
      await assertOk(res);
      this.quota.record('list');
      const data = (await res.json()) as YTListResponse<YTVideoResource>;

      for (const video of data.items ?? []) {
        tracks.push(mapVideoToTrack(video));
        if (limit !== undefined && tracks.length >= limit) {
          return tracks;
        }
      }

      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }

    return tracks;
  }

  async likeTrack(accessToken: string, trackId: string): Promise<void> {
    this.quota.preflight('videosRate');
    const params = new URLSearchParams({ id: trackId, rating: 'like' });
    const url = `${this.BASE_URL}/videos/rate?${params.toString()}`;
    const res = await ytFetch(url, {
      method: 'POST',
      headers: authHeaders(accessToken),
    });
    await assertOk(res);
    this.quota.record('videosRate');
  }
}
