import type { Track } from '@tunemymusic/types';
import { adapterRegistry } from './adapter-registry.js';
import { getValidTokens } from './token-service.js';
import { prisma } from '../prisma.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlaylistRef {
  platform: string;
  playlistId: string;
}

export interface MergeResult {
  tracks: Track[];
  totalFetched: number;
  duplicatesRemoved: number;
}

export type SplitMode = 'count' | 'decade' | 'genre';

export interface SplitBucket {
  name: string;
  tracks: Track[];
}

export interface SplitResult {
  buckets: SplitBucket[];
}

export interface DuplicateGroup {
  tracks: Track[];
  recommended: Track;
}

export interface DedupResult {
  duplicateGroups: DuplicateGroup[];
  totalDuplicates: number;
}

export interface TrackHealthIssue {
  track: Track;
  issues: string[];
}

export interface HealthCheckResult {
  totalTracks: number;
  healthyTracks: number;
  issueCount: number;
  issues: TrackHealthIssue[];
}

export interface PlaylistAnalysis {
  totalTracks: number;
  totalDurationMs: number;
  avgDurationMs: number;
  genreDistribution: Record<string, number>;
  decadeDistribution: Record<string, number>;
  description: string;
}

// ─── Merge ───────────────────────────────────────────────────────────────────

export async function mergePlaylists(
  userId: string,
  sources: PlaylistRef[],
): Promise<MergeResult> {
  const allTracks: Track[] = [];

  await Promise.all(
    sources.map(async (src) => {
      const connection = await prisma.platformConnection.findFirst({
        where: { userId, platform: src.platform as any, isActive: true },
      });
      if (!connection) return;

      try {
        const adapter = adapterRegistry.getAdapter(src.platform as any);
        const token = await getValidTokens(connection.id);
        const tracks = await adapter.getPlaylistTracks(token, src.playlistId);
        allTracks.push(...tracks);
      } catch {
        // Skip inaccessible playlists
      }
    }),
  );

  const totalFetched = allTracks.length;
  const deduped = deduplicateTracks(allTracks);
  const duplicatesRemoved = totalFetched - deduped.length;

  return { tracks: deduped, totalFetched, duplicatesRemoved };
}

// ─── Split ───────────────────────────────────────────────────────────────────

export async function splitPlaylist(
  userId: string,
  source: PlaylistRef,
  mode: SplitMode,
  chunkSize?: number,
): Promise<SplitResult> {
  const connection = await prisma.platformConnection.findFirst({
    where: { userId, platform: source.platform as any, isActive: true },
  });
  if (!connection) {
    throw new Error(`No active connection for platform: ${source.platform}`);
  }

  const adapter = adapterRegistry.getAdapter(source.platform as any);
  const token = await getValidTokens(connection.id);
  const tracks = await adapter.getPlaylistTracks(token, source.playlistId);

  switch (mode) {
    case 'count':
      return splitByCount(tracks, chunkSize ?? 50);
    case 'decade':
      return splitByDecade(tracks);
    case 'genre':
      return splitByGenre(tracks);
    default:
      throw new Error(`Unknown split mode: ${mode}`);
  }
}

function splitByCount(tracks: Track[], chunkSize: number): SplitResult {
  const buckets: SplitBucket[] = [];
  for (let i = 0; i < tracks.length; i += chunkSize) {
    const chunk = tracks.slice(i, i + chunkSize);
    buckets.push({ name: `Part ${Math.floor(i / chunkSize) + 1}`, tracks: chunk });
  }
  return { buckets };
}

function splitByDecade(tracks: Track[]): SplitResult {
  const map = new Map<string, Track[]>();

  for (const track of tracks) {
    const year = track.releaseYear;
    const decade = year ? `${Math.floor(year / 10) * 10}s` : 'Unknown';
    if (!map.has(decade)) map.set(decade, []);
    map.get(decade)!.push(track);
  }

  const buckets = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, tracks]) => ({ name, tracks }));

  return { buckets };
}

function splitByGenre(tracks: Track[]): SplitResult {
  // Genre metadata is rarely available from platform APIs; fall back to a single bucket
  return {
    buckets: [{ name: 'All Tracks', tracks }],
  };
}

// ─── Dedup ───────────────────────────────────────────────────────────────────

export async function deduplicatePlaylist(
  userId: string,
  source: PlaylistRef,
): Promise<DedupResult> {
  const connection = await prisma.platformConnection.findFirst({
    where: { userId, platform: source.platform as any, isActive: true },
  });
  if (!connection) {
    throw new Error(`No active connection for platform: ${source.platform}`);
  }

  const adapter = adapterRegistry.getAdapter(source.platform as any);
  const token = await getValidTokens(connection.id);
  const tracks = await adapter.getPlaylistTracks(token, source.playlistId);

  return findDuplicates(tracks);
}

function findDuplicates(tracks: Track[]): DedupResult {
  const isrcMap = new Map<string, Track[]>();
  const fuzzyMap = new Map<string, Track[]>();
  const noIsrc: Track[] = [];

  for (const track of tracks) {
    if (track.isrc) {
      const key = track.isrc.toUpperCase();
      if (!isrcMap.has(key)) isrcMap.set(key, []);
      isrcMap.get(key)!.push(track);
    } else {
      noIsrc.push(track);
    }
  }

  // Fuzzy-match tracks without ISRC
  for (const track of noIsrc) {
    const key = normalizeForKey(track);
    if (!fuzzyMap.has(key)) fuzzyMap.set(key, []);
    fuzzyMap.get(key)!.push(track);
  }

  const duplicateGroups: DuplicateGroup[] = [];
  let totalDuplicates = 0;

  for (const group of [...isrcMap.values(), ...fuzzyMap.values()]) {
    if (group.length > 1) {
      // Recommend the track with the most metadata
      const recommended = group.reduce((best, t) =>
        metadataScore(t) >= metadataScore(best) ? t : best,
      );
      duplicateGroups.push({ tracks: group, recommended });
      totalDuplicates += group.length - 1;
    }
  }

  return { duplicateGroups, totalDuplicates };
}

// ─── Health Check ─────────────────────────────────────────────────────────────

export async function checkPlaylistHealth(
  userId: string,
  source: PlaylistRef,
): Promise<HealthCheckResult> {
  const connection = await prisma.platformConnection.findFirst({
    where: { userId, platform: source.platform as any, isActive: true },
  });
  if (!connection) {
    throw new Error(`No active connection for platform: ${source.platform}`);
  }

  const adapter = adapterRegistry.getAdapter(source.platform as any);
  const token = await getValidTokens(connection.id);
  const tracks = await adapter.getPlaylistTracks(token, source.playlistId);

  const issuesList: TrackHealthIssue[] = [];

  for (const track of tracks) {
    const issues: string[] = [];

    if (!track.isrc) issues.push('Missing ISRC');
    if (!track.durationMs || track.durationMs < 5000) issues.push('Duration too short or missing');
    if (track.durationMs && track.durationMs > 60 * 60 * 1000) issues.push('Duration unusually long');
    if (!track.artists || track.artists.length === 0) issues.push('Missing artist');
    if (!track.album) issues.push('Missing album');
    if (!track.releaseYear) issues.push('Missing release year');

    if (issues.length > 0) {
      issuesList.push({ track, issues });
    }
  }

  return {
    totalTracks: tracks.length,
    healthyTracks: tracks.length - issuesList.length,
    issueCount: issuesList.length,
    issues: issuesList,
  };
}

// ─── AI Analysis (stub) ───────────────────────────────────────────────────────

export function analyzePlaylist(tracks: Track[]): PlaylistAnalysis {
  const totalTracks = tracks.length;

  // Duration stats
  const durations = tracks.map((t) => t.durationMs ?? 0).filter((d) => d > 0);
  const totalDurationMs = durations.reduce((a, b) => a + b, 0);
  const avgDurationMs = durations.length > 0 ? Math.round(totalDurationMs / durations.length) : 0;

  // Decade distribution
  const decadeDistribution: Record<string, number> = {};
  for (const track of tracks) {
    const year = track.releaseYear;
    const decade = year ? `${Math.floor(year / 10) * 10}s` : 'Unknown';
    decadeDistribution[decade] = (decadeDistribution[decade] ?? 0) + 1;
  }

  // Genre distribution (stub – no real genre data available without extra API calls)
  const genreDistribution: Record<string, number> = {
    'Unknown (genre metadata unavailable)': totalTracks,
  };

  // Generate description (stub — replace with a real generator when needed)
  const topDecade = Object.entries(decadeDistribution).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'Unknown';
  const avgMinutes = Math.round(avgDurationMs / 60000);
  const description =
    `This playlist contains ${totalTracks} tracks with an average duration of ~${avgMinutes} minutes. ` +
    `Most tracks are from the ${topDecade}.`;

  return {
    totalTracks,
    totalDurationMs,
    avgDurationMs,
    genreDistribution,
    decadeDistribution,
    description,
  };
}

// ─── Cross-Platform Search ────────────────────────────────────────────────────

export interface SearchResult {
  platform: string;
  track: Track;
}

export async function crossPlatformSearch(
  userId: string,
  query: string,
  platforms?: string[],
): Promise<SearchResult[]> {
  const connections = await prisma.platformConnection.findMany({
    where: {
      userId,
      isActive: true,
      ...(platforms && platforms.length > 0 ? { platform: { in: platforms as any[] } } : {}),
    },
  });

  const allResults: SearchResult[] = [];

  await Promise.allSettled(
    connections.map(async (conn) => {
      try {
        const adapter = adapterRegistry.getAdapter(conn.platform as any);
        const token = await getValidTokens(conn.id);
        const results = await adapter.searchTrack(token, {
          name: query,
          artist: '',
        });

        for (const r of results.slice(0, 5)) {
          allResults.push({ platform: conn.platform, track: r.track });
        }
      } catch {
        // Skip failed platforms
      }
    }),
  );

  // Deduplicate by ISRC
  return deduplicateSearchResults(allResults);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deduplicateTracks(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    const key = track.isrc ? track.isrc.toUpperCase() : normalizeForKey(track);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicateSearchResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.track.isrc
      ? r.track.isrc.toUpperCase()
      : `${r.platform}:${normalizeForKey(r.track)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeForKey(track: Track): string {
  const name = track.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const artist = (track.artists[0] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${name}::${artist}`;
}

function metadataScore(track: Track): number {
  let score = 0;
  if (track.isrc) score += 3;
  if (track.durationMs) score += 2;
  if (track.album) score += 1;
  if (track.releaseYear) score += 1;
  if (track.albumArtUrl) score += 1;
  return score;
}
