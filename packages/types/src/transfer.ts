import { z } from 'zod';
import { PlatformId } from './platform.js';

export const TransferStatus = z.enum([
  'PENDING',
  'QUEUED',
  'PROCESSING',
  'MATCHING',
  'IMPORTING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);
export type TransferStatus = z.infer<typeof TransferStatus>;

export const TrackMatchStatus = z.enum([
  'MATCHED',
  'NOT_FOUND',
  'PARTIAL_MATCH',
  'SKIPPED',
  'FAILED',
]);
export type TrackMatchStatus = z.infer<typeof TrackMatchStatus>;

export const MatchMethod = z.enum(['ISRC', 'EXACT', 'FUZZY', 'MANUAL']);
export type MatchMethod = z.infer<typeof MatchMethod>;

export const TransferOptionsSchema = z.object({
  createNew: z.boolean().default(true),
  addToExisting: z.boolean().default(false),
  existingPlaylistId: z.string().optional(),
  keepOrder: z.boolean().default(true),
  makePublic: z.boolean().default(true),
  copyDescription: z.boolean().default(true),
  skipDuplicates: z.boolean().default(true),
  confidenceThreshold: z.number().min(0).max(100).default(70),
  transferLiked: z.boolean().default(false),
});
export type TransferOptions = z.infer<typeof TransferOptionsSchema>;

export const CreateTransferSchema = z.object({
  sourcePlatform: PlatformId,
  destinationPlatform: PlatformId,
  sourcePlaylistId: z.string(),
  sourcePlaylistName: z.string(),
  options: TransferOptionsSchema,
});
export type CreateTransfer = z.infer<typeof CreateTransferSchema>;

export const TransferProgressSchema = z.object({
  transferId: z.string(),
  status: TransferStatus,
  totalTracks: z.number().int(),
  processedTracks: z.number().int(),
  matchedTracks: z.number().int(),
  failedTracks: z.number().int(),
  currentTrack: z.string().optional(),
  matchRate: z.number().min(0).max(100),
  phase: z.enum(['FETCHING', 'MATCHING', 'IMPORTING', 'DONE']),
});
export type TransferProgress = z.infer<typeof TransferProgressSchema>;

export const TransferTrackResultSchema = z.object({
  sourceTrackName: z.string(),
  sourceArtist: z.string(),
  destinationTrackName: z.string().optional(),
  destinationArtist: z.string().optional(),
  status: TrackMatchStatus,
  confidenceScore: z.number().min(0).max(100),
  matchMethod: MatchMethod.optional(),
});
export type TransferTrackResult = z.infer<typeof TransferTrackResultSchema>;
