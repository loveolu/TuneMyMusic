import type { Track, TrackSearchResult, MatchMethod } from '@tunemymusic/types';
import { scoreMatch } from './confidence-scorer.js';

export interface TrackMatchResult {
  track: Track;
  score: number;
  method: MatchMethod;
}

export interface TrackMatcherOptions {
  confidenceThreshold: number;
}

export class TrackMatcher {
  private readonly threshold: number;

  constructor(options: TrackMatcherOptions) {
    this.threshold = options.confidenceThreshold;
  }

  findBestMatch(source: Track, candidates: TrackSearchResult[]): TrackMatchResult | null {
    let bestMatch: TrackMatchResult | null = null;

    for (const candidate of candidates) {
      const { score, method } = scoreMatch(source, candidate.track);
      if (score >= this.threshold && (bestMatch === null || score > bestMatch.score)) {
        bestMatch = { track: candidate.track, score, method };
      }
    }

    return bestMatch;
  }
}
