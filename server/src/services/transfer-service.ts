import { prisma } from '../prisma.js';
import { transferQueue } from '../workers/transfer.worker.js';
import type { CreateTransfer } from '@tunemymusic/types';

/**
 * Window during which an identical-looking transfer request from the same
 * user is treated as a duplicate (e.g. double-clicked submit button, retry
 * after spotty network) and we return the existing in-flight transfer
 * instead of creating a new one.
 *
 * Defensible default: 60 seconds. Long enough to cover network retries and
 * accidental refreshes, short enough that a user who legitimately wants to
 * re-transfer the same playlist can do so within a minute.
 */
const IDEMPOTENCY_WINDOW_MS = 60_000;

const ACTIVE_STATUSES = ['PENDING', 'QUEUED', 'PROCESSING', 'MATCHING', 'IMPORTING'] as const;

export async function createTransfer(userId: string, input: CreateTransfer) {
  // Validate source connection exists
  const sourceConnection = await prisma.platformConnection.findFirst({
    where: {
      userId,
      platform: input.sourcePlatform as any,
      isActive: true,
    },
  });

  if (!sourceConnection) {
    throw new Error(`No active connection found for source platform: ${input.sourcePlatform}`);
  }

  // Validate destination connection exists
  const destConnection = await prisma.platformConnection.findFirst({
    where: {
      userId,
      platform: input.destinationPlatform as any,
      isActive: true,
    },
  });

  if (!destConnection) {
    throw new Error(
      `No active connection found for destination platform: ${input.destinationPlatform}`,
    );
  }

  // Idempotency / double-click guard.
  //
  // Look for a recent transfer for the same (userId, sourcePlatform,
  // destinationPlatform, sourcePlaylistId) tuple. If one is still active OR
  // was created within IDEMPOTENCY_WINDOW_MS, return it instead of queuing
  // another job.
  //
  // Why this matters: the Stripe-style "natural key" approach prevents
  // 1. accidental double-charge on plan-limited users (createTransfer
  //    increments their usage counter via plan-limits middleware),
  // 2. duplicate playlist creations on the destination (which are a pain to
  //    clean up because they're real, populated playlists), and
  // 3. duplicated BullMQ jobs racing on the same Transfer row.
  //
  // We don't dedupe on `options` — re-submitting with different toggles is a
  // legitimate "I changed my mind" action.
  const recentCutoff = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS);
  const existing = await prisma.transfer.findFirst({
    where: {
      userId,
      sourcePlatform: input.sourcePlatform as any,
      destinationPlatform: input.destinationPlatform as any,
      sourcePlaylistId: input.sourcePlaylistId,
      OR: [
        { status: { in: ACTIVE_STATUSES as any } },
        { createdAt: { gte: recentCutoff } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    // Return the existing transfer with an `idempotent: true` marker so the
    // route handler can surface it (200 instead of 201, optionally).
    return Object.assign(existing, { idempotent: true as const });
  }

  // Create Transfer record in DB
  const transfer = await prisma.transfer.create({
    data: {
      userId,
      sourcePlatform: input.sourcePlatform as any,
      destinationPlatform: input.destinationPlatform as any,
      sourcePlaylistId: input.sourcePlaylistId,
      sourcePlaylistName: input.sourcePlaylistName,
      status: 'QUEUED',
      options: input.options as any,
    },
  });

  // Queue BullMQ job
  const job = await transferQueue.add(
    'process-transfer',
    {
      transferId: transfer.id,
      userId,
      sourceConnectionId: sourceConnection.id,
      destConnectionId: destConnection.id,
      input,
    },
    {
      jobId: transfer.id,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      // Cap retention so a high-volume user doesn't fill Redis with their
      // own job graveyard. Failures stay around longer for debugging.
      removeOnComplete: { count: 1000, age: 24 * 3600 },
      removeOnFail: { count: 5000, age: 7 * 24 * 3600 },
    },
  );

  // Save jobId back to transfer
  await prisma.transfer.update({
    where: { id: transfer.id },
    data: { jobId: job.id ?? null },
  });

  return Object.assign(transfer, { idempotent: false as const });
}

export async function cancelTransfer(transferId: string, userId: string): Promise<void> {
  const transfer = await prisma.transfer.findFirst({
    where: { id: transferId, userId },
  });

  if (!transfer) {
    throw new Error('Transfer not found');
  }

  const terminal = ['COMPLETED', 'FAILED', 'CANCELLED'];
  if (terminal.includes(transfer.status)) {
    throw new Error(`Cannot cancel a transfer in status: ${transfer.status}`);
  }

  await prisma.transfer.update({
    where: { id: transferId },
    data: { status: 'CANCELLED' },
  });

  // Try to remove the job from the queue
  try {
    if (transfer.jobId) {
      const job = await transferQueue.getJob(transfer.jobId);
      if (job) {
        await job.remove();
      }
    }
  } catch {
    // Job may already be processing or completed, ignore errors
  }
}

export async function retryTransfer(transferId: string, userId: string) {
  const transfer = await prisma.transfer.findFirst({
    where: { id: transferId, userId },
  });

  if (!transfer) {
    throw new Error('Transfer not found');
  }

  const retryableStatuses = ['FAILED', 'CANCELLED'];
  if (!retryableStatuses.includes(transfer.status)) {
    throw new Error(`Cannot retry a transfer in status: ${transfer.status}`);
  }

  const options = transfer.options as any;

  return createTransfer(userId, {
    sourcePlatform: transfer.sourcePlatform as any,
    destinationPlatform: transfer.destinationPlatform as any,
    sourcePlaylistId: transfer.sourcePlaylistId,
    sourcePlaylistName: transfer.sourcePlaylistName,
    options,
  });
}
