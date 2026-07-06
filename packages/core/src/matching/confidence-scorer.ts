import type { Track, MatchMethod } from '@tunemymusic/types';
import { normalizeTrackName, normalizeArtistName } from './normalizer.js';
import { fuzzyMatch } from './fuzzy-matcher.js';

export interface MatchResult {
  score: number;
  method: MatchMethod;
}

export function scoreMatch(source: Track, candidate: Track): MatchResult {
  if (source.isrc && candidate.isrc && source.isrc === candidate.isrc) {
    return { score: 100, method: 'ISRC' };
  }

  const srcName = normalizeTrackName(source.name);
  const candName = normalizeTrackName(candidate.name);
  const srcArtist = normalizeArtistName(source.artists[0] ?? '');
  const candArtist = normalizeArtistName(candidate.artists[0] ?? '');

  const nameScore = fuzzyMatch(srcName, candName);
  const artistScore = fuzzyMatch(srcArtist, candArtist);

  if (nameScore >= 98 && artistScore >= 98) {
    let score = 85 + Math.floor((nameScore + artistScore - 190) / 2);

    if (source.durationMs && candidate.durationMs) {
      const diff = Math.abs(source.durationMs - candidate.durationMs);
      if (diff <= 3000) score = Math.min(99, score + 5);
      else if (diff <= 5000) score = Math.min(99, score + 2);
    }

    if (source.album && candidate.album) {
      const albumScore = fuzzyMatch(normalizeTrackName(source.album), normalizeTrackName(candidate.album));
      if (albumScore >= 90) score = Math.min(99, score + 3);
    }

    return { score: Math.min(99, score), method: 'EXACT' };
  }

  const combinedScore = Math.round(nameScore * 0.6 + artistScore * 0.4);

  if (combinedScore >= 50) {
    let score = combinedScore;
    if (source.durationMs && candidate.durationMs) {
      const diff = Math.abs(source.durationMs - candidate.durationMs);
      if (diff <= 5000) score = Math.min(84, score + 3);
    }
    return { score: Math.min(84, score), method: 'FUZZY' };
  }

  return { score: combinedScore, method: 'FUZZY' };
}
