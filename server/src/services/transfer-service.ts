import { prisma } from '../prisma.js';
import { transferQueue } from '../workers/transfer.worker.js';
import type { CreateTransfer } from '@tunemymusic/types';

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
    },
  );

  // Save jobId back to transfer
  await prisma.transfer.update({
    where: { id: transfer.id },
    data: { jobId: job.id ?? null },
  });

  return transfer;
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
