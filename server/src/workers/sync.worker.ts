import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config.js';
import { prisma } from '../prisma.js';
import { createTransfer } from '../services/transfer-service.js';
import { sseManager } from '../services/sse-manager.js';

export interface SyncJobData {
  scheduleId: string;
  userId: string;
}

const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

export const syncQueue = new Queue<SyncJobData>('sync', { connection });

/**
 * Add or update a repeatable cron job for a given schedule.
 */
export async function upsertSyncJob(scheduleId: string, cronExpression: string): Promise<void> {
  // Remove any existing repeatable job for this schedule first
  await removeSyncJob(scheduleId);

  await syncQueue.add(
    'run-sync',
    { scheduleId, userId: '' }, // userId resolved at runtime from DB
    {
      jobId: `sync-${scheduleId}`,
      repeat: { pattern: cronExpression },
    },
  );
}

/**
 * Remove the repeatable job for a schedule.
 */
export async function removeSyncJob(scheduleId: string): Promise<void> {
  try {
    const repeatableJobs = await syncQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.key.includes(scheduleId)) {
        await syncQueue.removeRepeatableByKey(job.key);
      }
    }
  } catch {
    // ignore – job may not exist
  }
}

/**
 * Trigger an immediate sync for a schedule (non-repeating).
 */
export async function triggerSyncNow(scheduleId: string, userId: string): Promise<void> {
  await syncQueue.add(
    'run-sync',
    { scheduleId, userId },
    {
      jobId: `sync-now-${scheduleId}-${Date.now()}`,
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
    },
  );
}

async function processSync(data: SyncJobData): Promise<void> {
  const { scheduleId } = data;

  const schedule = await prisma.transferSchedule.findUnique({
    where: { id: scheduleId },
    include: { savedPlaylist: true, user: true },
  });

  if (!schedule || !schedule.isActive) return;

  const userId = schedule.userId;

  try {
    // Build transfer input from schedule config
    const transfer = await createTransfer(userId, {
      sourcePlatform: schedule.savedPlaylist.platform as any,
      destinationPlatform: schedule.destinationPlatform as any,
      sourcePlaylistId: schedule.savedPlaylist.platformPlaylistId,
      sourcePlaylistName: schedule.savedPlaylist.name,
      options: {
        createNew: schedule.destinationPlaylistId ? false : true,
        addToExisting: !!schedule.destinationPlaylistId,
        existingPlaylistId: schedule.destinationPlaylistId ?? undefined,
        keepOrder: true,
        makePublic: true,
        copyDescription: true,
        skipDuplicates: true,
        confidenceThreshold: 70,
        transferLiked: false,
      },
    });

    // Update schedule's lastRanAt
    await prisma.transferSchedule.update({
      where: { id: scheduleId },
      data: { lastRanAt: new Date() },
    });

    // Emit notification
    await prisma.notification.create({
      data: {
        userId,
        type: 'SYNC_STARTED',
        title: 'Scheduled Sync Started',
        body: `Sync for "${schedule.savedPlaylist.name}" has started.`,
        data: { transferId: transfer.id, scheduleId },
      },
    });
  } catch (err: any) {
    await prisma.notification.create({
      data: {
        userId,
        type: 'SYNC_FAILED',
        title: 'Scheduled Sync Failed',
        body: `Sync for "${schedule.savedPlaylist.name}" failed: ${err?.message ?? 'Unknown error'}`,
        data: { scheduleId },
      },
    });
    throw err;
  }
}

export function startSyncWorker(): Worker<SyncJobData> {
  const worker = new Worker<SyncJobData>(
    'sync',
    async (job) => {
      await processSync(job.data);
    },
    { connection, concurrency: 3 },
  );

  worker.on('failed', (job, err) => {
    console.error(`Sync job ${job?.id} failed:`, err);
  });

  worker.on('completed', (job) => {
    console.log(`Sync job ${job.id} completed`);
  });

  return worker;
}
