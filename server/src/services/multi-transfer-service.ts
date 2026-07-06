import { prisma } from '../prisma.js';
import { transferQueue } from '../workers/transfer.worker.js';
import type { TransferOptions } from '@tunemymusic/types';

export interface MultiTransferDestination {
  platform: string;
  options?: Partial<TransferOptions>;
}

export interface MultiTransferInput {
  sourcePlatform: string;
  sourcePlaylistId: string;
  sourcePlaylistName: string;
  destinations: MultiTransferDestination[];
}

/**
 * Create one transfer record + queue one BullMQ job per destination platform,
 * all in parallel. Returns the array of created transfer IDs.
 */
export async function createMultiTransfer(
  userId: string,
  input: MultiTransferInput,
): Promise<string[]> {
  const { sourcePlatform, sourcePlaylistId, sourcePlaylistName, destinations } = input;

  // Validate source connection
  const sourceConnection = await prisma.platformConnection.findFirst({
    where: { userId, platform: sourcePlatform as any, isActive: true },
  });
  if (!sourceConnection) {
    throw new Error(`No active connection found for source platform: ${sourcePlatform}`);
  }

  // Create all transfer records + queue jobs in parallel
  const results = await Promise.all(
    destinations.map(async (dest) => {
      const destConnection = await prisma.platformConnection.findFirst({
        where: { userId, platform: dest.platform as any, isActive: true },
      });
      if (!destConnection) {
        return {
          platform: dest.platform,
          error: `No active connection found for platform: ${dest.platform}`,
        };
      }

      const mergedOptions = {
        createNew: true,
        addToExisting: false,
        keepOrder: true,
        makePublic: true,
        copyDescription: true,
        skipDuplicates: true,
        confidenceThreshold: 70,
        transferLiked: false,
        ...(dest.options ?? {}),
      };

      const transfer = await prisma.transfer.create({
        data: {
          userId,
          sourcePlatform: sourcePlatform as any,
          destinationPlatform: dest.platform as any,
          sourcePlaylistId,
          sourcePlaylistName,
          status: 'QUEUED',
          options: mergedOptions as any,
        },
      });

      const job = await transferQueue.add(
        'process-transfer',
        {
          transferId: transfer.id,
          userId,
          sourceConnectionId: sourceConnection.id,
          destConnectionId: destConnection.id,
          input: {
            sourcePlatform: sourcePlatform as any,
            destinationPlatform: dest.platform as any,
            sourcePlaylistId,
            sourcePlaylistName,
            options: mergedOptions as any,
          },
        },
        {
          jobId: transfer.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );

      await prisma.transfer.update({
        where: { id: transfer.id },
        data: { jobId: job.id ?? null },
      });

      return { platform: dest.platform, transferId: transfer.id };
    }),
  );

  // Collect successful IDs and surface errors
  const transferIds: string[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if ('error' in result) {
      errors.push(`${result.platform}: ${result.error}`);
    } else {
      transferIds.push(result.transferId);
    }
  }

  if (transferIds.length === 0) {
    throw new Error(`All destinations failed:\n${errors.join('\n')}`);
  }

  return transferIds;
}
