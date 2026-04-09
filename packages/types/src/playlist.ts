import { z } from 'zod';
import { PlatformId } from './platform.js';

export const TrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  artists: z.array(z.string()),
  album: z.string().optional(),
  albumArtUrl: z.string().optional(),
  durationMs: z.number().int().optional(),
  isrc: z.string().optional(),
  previewUrl: z.string().optional(),
  platformId: PlatformId.optional(),
  platformTrackId: z.string().optional(),
  releaseYear: z.number().int().optional(),
});
export type Track = z.infer<typeof TrackSchema>;

export const PlaylistSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  platform: PlatformId,
  trackCount: z.number().int(),
  artworkUrl: z.string().optional(),
  isPublic: z.boolean().default(true),
  owner: z.string().optional(),
  externalUrl: z.string().optional(),
});
export type Playlist = z.infer<typeof PlaylistSchema>;

export const TrackQuerySchema = z.object({
  name: z.string(),
  artist: z.string(),
  album: z.string().optional(),
  isrc: z.string().optional(),
  durationMs: z.number().int().optional(),
});
export type TrackQuery = z.infer<typeof TrackQuerySchema>;

export const AlbumQuerySchema = z.object({
  name: z.string(),
  artist: z.string(),
});
export type AlbumQuery = z.infer<typeof AlbumQuerySchema>;

export const AlbumSchema = z.object({
  id: z.string(),
  name: z.string(),
  artist: z.string(),
  artworkUrl: z.string().optional(),
  releaseYear: z.number().int().optional(),
  trackCount: z.number().int().optional(),
});
export type Album = z.infer<typeof AlbumSchema>;

export const TrackSearchResultSchema = z.object({
  track: TrackSchema,
  score: z.number().min(0).max(100),
});
export type TrackSearchResult = z.infer<typeof TrackSearchResultSchema>;
