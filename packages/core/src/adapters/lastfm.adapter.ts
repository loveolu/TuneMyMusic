import type { Track } from '@tunemymusic/types';

export interface LastFmConfig {
  apiKey: string;
}

export interface LastFmLovedTracksOptions {
  user: string;
  limit?: number;
  page?: number;
}

export interface LastFmRecentTracksOptions {
  user: string;
  limit?: number;
  page?: number;
  from?: number; // Unix timestamp
  to?: number;   // Unix timestamp
}

/**
 * Fetch a user's loved tracks from Last.fm.
 * Uses the public Last.fm API (API key only, no OAuth required).
 */
export async function getLastFmLovedTracks(
  config: LastFmConfig,
  options: LastFmLovedTracksOptions,
): Promise<Track[]> {
  const { user, limit = 200, page = 1 } = options;

  const url = new URL('https://ws.audioscrobbler.com/2.0/');
  url.searchParams.set('method', 'user.getlovedtracks');
  url.searchParams.set('api_key', config.apiKey);
  url.searchParams.set('user', user);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('page', String(page));
  url.searchParams.set('format', 'json');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Last.fm API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as any;

  if (data.error) {
    throw new Error(`Last.fm error ${data.error}: ${data.message}`);
  }

  const lovedTracks: any[] = data?.lovedtracks?.track ?? [];
  return lovedTracks.map((t: any, idx: number) => mapLastFmTrack(t, idx));
}

/**
 * Fetch a user's recent scrobbles from Last.fm.
 */
export async function getLastFmRecentTracks(
  config: LastFmConfig,
  options: LastFmRecentTracksOptions,
): Promise<Track[]> {
  const { user, limit = 200, page = 1, from, to } = options;

  const url = new URL('https://ws.audioscrobbler.com/2.0/');
  url.searchParams.set('method', 'user.getrecenttracks');
  url.searchParams.set('api_key', config.apiKey);
  url.searchParams.set('user', user);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('page', String(page));
  url.searchParams.set('format', 'json');
  if (from !== undefined) url.searchParams.set('from', String(from));
  if (to !== undefined) url.searchParams.set('to', String(to));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Last.fm API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as any;

  if (data.error) {
    throw new Error(`Last.fm error ${data.error}: ${data.message}`);
  }

  const recentTracks: any[] = data?.recenttracks?.track ?? [];

  // Filter out the "now playing" placeholder entry
  return recentTracks
    .filter((t: any) => !t['@attr']?.nowplaying)
    .map((t: any, idx: number) => mapLastFmTrack(t, idx));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapLastFmTrack(track: any, idx: number): Track {
  const name: string = track.name ?? '';
  const artist: string = track.artist?.name ?? track.artist?.['#text'] ?? '';
  const album: string = track.album?.['#text'] ?? track.album?.name ?? '';
  const mbid: string = track.mbid ?? '';

  return {
    id: `lastfm-${mbid || idx}`,
    name,
    artists: artist ? [artist] : [],
    album: album || undefined,
    // Last.fm doesn't provide ISRC directly; MusicBrainz ID stored as isrc field for dedup hints
    isrc: mbid || undefined,
    platformId: 'LASTFM',
  };
}
