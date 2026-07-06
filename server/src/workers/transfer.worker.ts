import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config.js';
import { prisma } from '../prisma.js';
import { adapterRegistry } from '../services/adapter-registry.js';
import { getValidTokens } from '../services/token-service.js';
import { sseManager } from '../services/sse-manager.js';
import { TrackMatcher } from '@tunemymusic/core';
import type { CreateTransfer, TransferProgress } from '@tunemymusic/types';

export interface TransferJobData {
  transferId: string;
  userId: string;
  sourceConnectionId: string;
  destConnectionId: string;
  input: CreateTransfer;
}

// Create Redis connection for BullMQ
const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

// Export the queue so transfer-service can add jobs
export const transferQueue = new Queue<TransferJobData>('transfers', { connection });

/**
 * Dead-letter queue for transfer jobs that fail all retry attempts.
 *
 * BullMQ doesn't have a first-class DLQ — by convention you push the failed
 * job's payload + error info onto a separate queue so an operator can
 * inspect it, replay it, or just observe an alert metric on its depth.
 *
 * Jobs land here from the worker's `failed` event when `attemptsMade >=
 * opts.attempts` (i.e. truly exhausted, not just transient retries).
 *
 * To replay a DLQ entry:
 *   const job = await transferDlq.getJob(<id>);
 *   await transferQueue.add('process-transfer', job.data, { jobId: ... });
 */
export const transferDlq = new Queue<TransferJobData & { failureReason: string; failedAt: string }>(
  'transfers-dlq',
  { connection },
);

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processTransfer(data: TransferJobData): Promise<void> {
  const { transferId, sourceConnectionId, destConnectionId, input } = data;

  // Helper to emit SSE progress
  function emitProgress(progress: Omit<TransferProgress, 'transferId'>): void {
    sseManager.sendEvent(transferId, { transferId, ...progress });
  }

  // Step 1: Update status to PROCESSING
  await prisma.transfer.update({
    where: { id: transferId },
    data: { status: 'PROCESSING', startedAt: new Date() },
  });

  emitProgress({
    status: 'PROCESSING',
    totalTracks: 0,
    processedTracks: 0,
    matchedTracks: 0,
    failedTracks: 0,
    matchRate: 0,
    phase: 'FETCHING',
  });

  // Step 2: Fetch source tracks
  const sourceAdapter = adapterRegistry.getAdapter(input.sourcePlatform);
  const sourceToken = await getValidTokens(sourceConnectionId);

  let sourceTracks;
  if (input.options.transferLiked) {
    sourceTracks = await sourceAdapter.getLikedSongs(sourceToken);
  } else {
    sourceTracks = await sourceAdapter.getPlaylistTracks(sourceToken, input.sourcePlaylistId);
  }

  const totalTracks = sourceTracks.length;

  await prisma.transfer.update({
    where: { id: transferId },
    data: { totalTracks, status: 'MATCHING' },
  });

  emitProgress({
    status: 'MATCHING',
    totalTracks,
    processedTracks: 0,
    matchedTracks: 0,
    failedTracks: 0,
    matchRate: 0,
    phase: 'MATCHING',
  });

  // Step 3: Match tracks
  const destAdapter = adapterRegistry.getAdapter(input.destinationPlatform);
  const destToken = await getValidTokens(destConnectionId);

  const matcher = new TrackMatcher({
    confidenceThreshold: input.options.confidenceThreshold,
  });

  let matchedCount = 0;
  let failedCount = 0;
  const matchedTrackIds: string[] = [];

  for (let i = 0; i < sourceTracks.length; i++) {
    const sourceTrack = sourceTracks[i];

    try {
      // Build query from source track
      const query = {
        name: sourceTrack.name,
        artist: sourceTrack.artists[0] ?? '',
        album: sourceTrack.album,
        isrc: sourceTrack.isrc,
        durationMs: sourceTrack.durationMs,
      };

      // Search destination platform
      let candidates;
      let retries = 0;
      while (true) {
        try {
          candidates = await destAdapter.searchTrack(destToken, query);
          break;
        } catch (err: any) {
          if (err?.message?.includes('429') && retries < 3) {
            retries++;
            await sleep(Math.pow(2, retries) * 1000);
          } else {
            throw err;
          }
        }
      }

      // Find best match
      const bestMatch = matcher.findBestMatch(sourceTrack, candidates);

      if (bestMatch) {
        matchedCount++;
        if (bestMatch.track.platformTrackId) {
          matchedTrackIds.push(bestMatch.track.platformTrackId);
        }

        await prisma.transferTrack.create({
          data: {
            transferId,
            sourceTrackId: sourceTrack.id,
            sourceTrackName: sourceTrack.name,
            sourceArtist: sourceTrack.artists[0] ?? '',
            sourceAlbum: sourceTrack.album,
            sourceDuration: sourceTrack.durationMs,
            sourceIsrc: sourceTrack.isrc,
            destinationTrackId: bestMatch.track.platformTrackId,
            destinationTrackName: bestMatch.track.name,
            destinationArtist: bestMatch.track.artists[0] ?? '',
            status: bestMatch.score >= 90 ? 'MATCHED' : 'PARTIAL_MATCH',
            confidenceScore: bestMatch.score,
            matchMethod: bestMatch.method,
          },
        });
      } else {
        failedCount++;
        await prisma.transferTrack.create({
          data: {
            transferId,
            sourceTrackId: sourceTrack.id,
            sourceTrackName: sourceTrack.name,
            sourceArtist: sourceTrack.artists[0] ?? '',
            sourceAlbum: sourceTrack.album,
            sourceDuration: sourceTrack.durationMs,
            sourceIsrc: sourceTrack.isrc,
            status: 'NOT_FOUND',
            confidenceScore: 0,
          },
        });
      }
    } catch (trackErr) {
      failedCount++;
      // Per-track error: mark as failed and continue
      await prisma.transferTrack.create({
        data: {
          transferId,
          sourceTrackId: sourceTrack.id ?? undefined,
          sourceTrackName: sourceTrack.name,
          sourceArtist: sourceTrack.artists[0] ?? '',
          sourceAlbum: sourceTrack.album,
          status: 'FAILED',
          confidenceScore: 0,
        },
      });
    }

    const processedTracks = i + 1;
    const matchRate = totalTracks > 0 ? (matchedCount / processedTracks) * 100 : 0;

    emitProgress({
      status: 'MATCHING',
      totalTracks,
      processedTracks,
      matchedTracks: matchedCount,
      failedTracks: failedCount,
      currentTrack: sourceTrack.name,
      matchRate,
      phase: 'MATCHING',
    });
  }

  // Step 4: Import tracks to destination
  await prisma.transfer.update({
    where: { id: transferId },
    data: { status: 'IMPORTING', matchedTracks: matchedCount, failedTracks: failedCount },
  });

  emitProgress({
    status: 'IMPORTING',
    totalTracks,
    processedTracks: totalTracks,
    matchedTracks: matchedCount,
    failedTracks: failedCount,
    matchRate: totalTracks > 0 ? (matchedCount / totalTracks) * 100 : 0,
    phase: 'IMPORTING',
  });

  let destinationPlaylistId: string | undefined;
  let destinationPlaylistName: string | undefined;

  if (matchedTrackIds.length > 0) {
    if (input.options.createNew) {
      // Create new playlist on destination
      const playlistName = `${input.sourcePlaylistName} (via TuneMyMusic)`;
      const newPlaylist = await destAdapter.createPlaylist(
        destToken,
        playlistName,
        `Transferred from ${input.sourcePlatform} via TuneMyMusic`,
        input.options.makePublic,
      );
      destinationPlaylistId = newPlaylist.id;
      destinationPlaylistName = newPlaylist.name;

      await destAdapter.addTracksToPlaylist(destToken, newPlaylist.id, matchedTrackIds);
    } else if (input.options.addToExisting && input.options.existingPlaylistId) {
      destinationPlaylistId = input.options.existingPlaylistId;
      await destAdapter.addTracksToPlaylist(
        destToken,
        input.options.existingPlaylistId,
        matchedTrackIds,
      );
    }
  }

  // Step 5: Mark as COMPLETED
  const matchRate = totalTracks > 0 ? (matchedCount / totalTracks) * 100 : 0;

  await prisma.transfer.update({
    where: { id: transferId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      matchedTracks: matchedCount,
      failedTracks: failedCount,
      matchRate,
      destinationPlaylistId: destinationPlaylistId ?? null,
      destinationPlaylistName: destinationPlaylistName ?? null,
    },
  });

  emitProgress({
    status: 'COMPLETED',
    totalTracks,
    processedTracks: totalTracks,
    matchedTracks: matchedCount,
    failedTracks: failedCount,
    matchRate,
    phase: 'DONE',
  });
}

export function startTransferWorker(): Worker<TransferJobData> {
  const worker = new Worker<TransferJobData>(
    'transfers',
    async (job) => {
      try {
        await processTransfer(job.data);
      } catch (err: any) {
        // Mark transfer as failed
        await prisma.transfer.update({
          where: { id: job.data.transferId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage: err?.message ?? 'Unknown error',
          },
        });

        sseManager.sendEvent(job.data.transferId, {
          transferId: job.data.transferId,
          status: 'FAILED',
          totalTracks: 0,
          processedTracks: 0,
          matchedTracks: 0,
          failedTracks: 0,
          matchRate: 0,
          phase: 'DONE',
        });

        throw err;
      }
    },
    {
      connection,
      concurrency: 5,
    },
  );

  // 'failed' fires on EVERY attempt (transient + final). Distinguish them by
  // comparing attemptsMade against the configured max — only the final
  // failure goes to the DLQ and emits a loud alert log line.
  worker.on('failed', async (job, err) => {
    if (!job) {
      console.error('[TransferWorker] failed event without job:', err);
      return;
    }

    const attemptsMade = job.attemptsMade ?? 0;
    const maxAttempts = job.opts?.attempts ?? 1;
    const isFinal = attemptsMade >= maxAttempts;

    if (!isFinal) {
      // Transient — will retry. Single line, structured.
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'transfer_job_attempt_failed',
          jobId: job.id,
          transferId: job.data?.transferId,
          attempt: attemptsMade,
          maxAttempts,
          error: err?.message,
        }),
      );
      return;
    }

    // FINAL failure — push to DLQ and emit a structured alert line. This
    // line is intentionally easy to grep/alert on (event=transfer_job_dlq)
    // because we don't have an external alerting service per the
    // launch-no-new-integrations constraint.
    try {
      await transferDlq.add(
        'failed-transfer',
        {
          ...job.data,
          failureReason: err?.message ?? 'unknown',
          failedAt: new Date().toISOString(),
        },
        {
          // Cap DLQ retention at 1k entries to bound Redis memory. Operators
          // should drain the DLQ regularly; this is a safety belt.
          removeOnComplete: false,
          removeOnFail: false,
        },
      );
    } catch (dlqErr) {
      console.error('[TransferWorker] FAILED to push job to DLQ:', dlqErr);
    }

    console.error(
      JSON.stringify({
        level: 'error',
        event: 'transfer_job_dlq',
        alert: true,
        jobId: job.id,
        transferId: job.data?.transferId,
        userId: job.data?.userId,
        attempts: attemptsMade,
        error: err?.message,
        stack: err?.stack,
      }),
    );
  });

  worker.on('completed', (job) => {
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'transfer_job_completed',
        jobId: job.id,
        transferId: job.data?.transferId,
      }),
    );
  });

  return worker;
}
