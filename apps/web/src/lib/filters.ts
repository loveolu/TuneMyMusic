/**
 * Pure utility helpers for filtering / matching client-side playlist and track
 * lists. Extracted from `app/dashboard/*` page components so they can be unit
 * tested without spinning up React.
 *
 * Conventions:
 * - All functions are case-insensitive and trim whitespace.
 * - Empty / whitespace-only queries return the input unchanged (rather than
 *   filtering everything out, which would be surprising UX).
 * - Functions are non-mutating: they return new arrays.
 */

export interface PlaylistLike {
  name: string;
  description?: string;
}

export interface TrackLike {
  sourceTrackName?: string;
  sourceArtist?: string;
  destinationTrackName?: string;
  destinationArtist?: string;
}

/**
 * Filter playlists by a free-text query. Matches against `name` (always) and
 * `description` (if present). Returns the original array unchanged when the
 * query is empty.
 */
export function filterPlaylists<T extends PlaylistLike>(playlists: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return playlists;
  return playlists.filter((p) => {
    if (p.name.toLowerCase().includes(q)) return true;
    if (p.description && p.description.toLowerCase().includes(q)) return true;
    return false;
  });
}

/**
 * Filter transfer tracks by a status enum. Pass `'ALL'` (or `undefined`) to
 * skip filtering. Centralized so the same predicate can be exercised by the
 * detail page, history filters, and tests.
 */
export type TrackStatusFilter = 'ALL' | 'MATCHED' | 'PARTIAL_MATCH' | 'NOT_FOUND' | 'SKIPPED' | 'FAILED';

export function filterTracksByStatus<T extends { status: string }>(
  tracks: T[],
  filter: TrackStatusFilter | undefined,
): T[] {
  if (!filter || filter === 'ALL') return tracks;
  return tracks.filter((t) => t.status === filter);
}

/**
 * Free-text search across a transfer's track results. Matches against the
 * source AND destination track name + artist so a user can find a track by
 * either the title they had in the source playlist or whatever the
 * destination service returned.
 */
export function searchTracks<T extends TrackLike>(tracks: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return tracks;
  return tracks.filter((t) => {
    const haystack = [
      t.sourceTrackName,
      t.sourceArtist,
      t.destinationTrackName,
      t.destinationArtist,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

/**
 * Return a sensible "ETA" string for a long-running transfer. Used in the
 * progress UI when we know how many tracks have been processed and how long
 * it's been since `startedAt`.
 *
 * - Returns `null` if we don't have enough data to estimate (no progress yet,
 *   no start time, or zero/negative elapsed time).
 * - Returns a short human-readable string like `"~3m left"` or `"<1m left"`.
 */
export function estimateRemainingTime(args: {
  processed: number;
  total: number;
  startedAtMs: number;
  nowMs: number;
}): string | null {
  const { processed, total, startedAtMs, nowMs } = args;
  if (processed <= 0 || total <= 0 || processed > total) return null;
  const elapsedMs = nowMs - startedAtMs;
  if (elapsedMs <= 0) return null;
  const msPerTrack = elapsedMs / processed;
  const remainingTracks = total - processed;
  const remainingMs = msPerTrack * remainingTracks;
  if (remainingMs < 60_000) return '<1m left';
  const minutes = Math.round(remainingMs / 60_000);
  if (minutes < 60) return `~${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin > 0 ? `~${hours}h ${remMin}m left` : `~${hours}h left`;
}

/**
 * Sort connections by a fixed display priority. The audit-recommended Tier 1
 * platforms come first, then alphabetical by display name. Pure so we can
 * snapshot-test the order.
 */
const PLATFORM_PRIORITY = [
  'SPOTIFY',
  'APPLE_MUSIC',
  'YOUTUBE_MUSIC',
  'AMAZON_MUSIC',
  'TIDAL',
  'DEEZER',
  'SOUNDCLOUD',
  'PANDORA',
  'QOBUZ',
  'NAPSTER',
  'LASTFM',
  'CSV',
  'ITUNES_XML',
];

export function sortPlatformsByPriority<T extends { platform: string }>(items: T[]): T[] {
  const ordered = [...items];
  ordered.sort((a, b) => {
    const ai = PLATFORM_PRIORITY.indexOf(a.platform);
    const bi = PLATFORM_PRIORITY.indexOf(b.platform);
    const aRank = ai === -1 ? PLATFORM_PRIORITY.length : ai;
    const bRank = bi === -1 ? PLATFORM_PRIORITY.length : bi;
    if (aRank !== bRank) return aRank - bRank;
    return a.platform.localeCompare(b.platform);
  });
  return ordered;
}
