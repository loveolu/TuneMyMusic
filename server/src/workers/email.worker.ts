import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config.js';
import { prisma } from '../prisma.js';
import {
  sendTransferComplete,
  sendTransferFailed,
  sendSyncComplete,
  sendWeeklyDigest,
  sendWelcome,
} from '../services/email-service.js';

export type EmailJobType =
  | 'transfer_complete'
  | 'transfer_failed'
  | 'sync_complete'
  | 'weekly_digest'
  | 'welcome';

export interface EmailJobData {
  type: EmailJobType;
  userId: string;
  transferId?: string;
  scheduleId?: string;
  error?: string;
  stats?: {
    playlistsTransferred: number;
    totalTracks: number;
    matchedTracks: number;
  };
}

// Redis connection for BullMQ
const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

// Export queue so other services can enqueue email jobs
export const emailQueue = new Queue<EmailJobData>('email-queue', { connection });

async function processEmailJob(data: EmailJobData): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    console.warn(`[EmailWorker] User ${data.userId} not found, skipping email`);
    return;
  }

  switch (data.type) {
    case 'transfer_complete': {
      if (!data.transferId) break;
      const transfer = await prisma.transfer.findUnique({
        where: { id: data.transferId },
        select: {
          id: true,
          sourcePlaylistName: true,
          destinationPlaylistName: true,
          sourcePlatform: true,
          destinationPlatform: true,
          totalTracks: true,
          matchedTracks: true,
          failedTracks: true,
          matchRate: true,
        },
      });
      if (!transfer) break;
      await sendTransferComplete(user, {
        ...transfer,
        sourcePlatform: String(transfer.sourcePlatform),
        destinationPlatform: String(transfer.destinationPlatform),
      });
      break;
    }

    case 'transfer_failed': {
      if (!data.transferId) break;
      const transfer = await prisma.transfer.findUnique({
        where: { id: data.transferId },
        select: {
          id: true,
          sourcePlaylistName: true,
          destinationPlaylistName: true,
          sourcePlatform: true,
          destinationPlatform: true,
          totalTracks: true,
          matchedTracks: true,
          failedTracks: true,
          matchRate: true,
          errorMessage: true,
        },
      });
      if (!transfer) break;
      await sendTransferFailed(
        user,
        {
          ...transfer,
          sourcePlatform: String(transfer.sourcePlatform),
          destinationPlatform: String(transfer.destinationPlatform),
        },
        data.error ?? transfer.errorMessage ?? 'Unknown error',
      );
      break;
    }

    case 'sync_complete': {
      if (!data.scheduleId) break;
      const schedule = await prisma.transferSchedule.findUnique({
        where: { id: data.scheduleId },
        select: { id: true, savedPlaylist: { select: { name: true } } },
      });
      if (!schedule) break;
      await sendSyncComplete(
        user,
        { id: schedule.id, name: schedule.savedPlaylist?.name },
        {
          id: data.scheduleId,
          totalTracks: data.stats?.totalTracks ?? 0,
          matchedTracks: data.stats?.matchedTracks ?? 0,
        },
      );
      break;
    }

    case 'weekly_digest': {
      if (!data.stats) break;
      await sendWeeklyDigest(user, data.stats);
      break;
    }

    case 'welcome': {
      await sendWelcome(user);
      break;
    }

    default:
      console.warn(`[EmailWorker] Unknown email type: ${(data as any).type}`);
  }
}

export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    'email-queue',
    async (job) => {
      try {
        await processEmailJob(job.data);
      } catch (err) {
        console.error(`[EmailWorker] Job ${job.id} failed:`, err);
        throw err;
      }
    },
    {
      connection,
      concurrency: 3,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[EmailWorker] Job ${job?.id} permanently failed:`, err);
  });

  worker.on('completed', (job) => {
    console.log(`[EmailWorker] Job ${job.id} (${job.data.type}) completed`);
  });

  return worker;
}
