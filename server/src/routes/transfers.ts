import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/require-auth.js';
import { checkTransferLimit, checkTrackLimit } from '../middleware/plan-limits.js';
import { prisma } from '../prisma.js';
import { createTransfer, cancelTransfer, retryTransfer } from '../services/transfer-service.js';
import { createMultiTransfer } from '../services/multi-transfer-service.js';
import { sseManager } from '../services/sse-manager.js';
import { CreateTransferSchema } from '@tunemymusic/types';
import { z } from 'zod';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const TrackFilterSchema = z.object({
  status: z.enum(['MATCHED', 'NOT_FOUND', 'PARTIAL_MATCH', 'SKIPPED', 'FAILED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const ManualMatchSchema = z.object({
  destinationTrackId: z.string(),
  destinationTrackName: z.string(),
  destinationArtist: z.string(),
});

export async function transferRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // POST /api/transfers — create + queue transfer.
  //
  // Idempotency: createTransfer dedupes on
  //   (userId, sourcePlatform, destinationPlatform, sourcePlaylistId)
  // within a 60s window OR while an existing transfer is still active. When
  // a duplicate request hits this route we return 200 with the *existing*
  // transfer (and an `idempotent: true` flag) instead of 201. This protects
  // against double-clicks, retried POSTs, and tab-restored mutations.
  app.post('/', { preHandler: [checkTransferLimit, checkTrackLimit] }, async (request, reply) => {
    const parsed = CreateTransferSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    try {
      const transfer = await createTransfer(request.userId, parsed.data);
      const isIdempotent = (transfer as { idempotent?: boolean }).idempotent === true;
      return reply.status(isIdempotent ? 200 : 201).send({
        transfer,
        idempotent: isIdempotent,
      });
    } catch (err: any) {
      if (err?.message?.includes('No active connection')) {
        return reply.status(422).send({ error: err.message });
      }
      return reply.status(500).send({ error: err?.message ?? 'Failed to create transfer' });
    }
  });

  // GET /api/transfers — list user's transfers (paginated)
  app.get('/', async (request, reply) => {
    const parsed = PaginationSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query params' });
    }

    const { page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        where: { userId: request.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          sourcePlatform: true,
          destinationPlatform: true,
          sourcePlaylistName: true,
          destinationPlaylistName: true,
          status: true,
          totalTracks: true,
          matchedTracks: true,
          failedTracks: true,
          matchRate: true,
          createdAt: true,
          completedAt: true,
          errorMessage: true,
        },
      }),
      prisma.transfer.count({ where: { userId: request.userId } }),
    ]);

    return reply.send({
      transfers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // GET /api/transfers/:id — transfer detail
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const transfer = await prisma.transfer.findFirst({
      where: { id, userId: request.userId },
      include: {
        _count: {
          select: {
            tracks: true,
          },
        },
      },
    });

    if (!transfer) {
      return reply.status(404).send({ error: 'Transfer not found' });
    }

    return reply.send({ transfer });
  });

  // GET /api/transfers/:id/tracks — transfer track results (paginated)
  app.get('/:id/tracks', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = TrackFilterSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query params' });
    }

    // Verify ownership
    const transfer = await prisma.transfer.findFirst({
      where: { id, userId: request.userId },
      select: { id: true },
    });

    if (!transfer) {
      return reply.status(404).send({ error: 'Transfer not found' });
    }

    const { status, page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    const where: any = { transferId: id };
    if (status) where.status = status;

    const [tracks, total] = await Promise.all([
      prisma.transferTrack.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      prisma.transferTrack.count({ where }),
    ]);

    return reply.send({
      tracks,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // GET /api/transfers/:id/stream — SSE endpoint for live progress
  app.get('/:id/stream', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Verify ownership
    const transfer = await prisma.transfer.findFirst({
      where: { id, userId: request.userId },
      select: { id: true, status: true },
    });

    if (!transfer) {
      return reply.status(404).send({ error: 'Transfer not found' });
    }

    // Set SSE headers
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.flushHeaders();

    // If transfer is already in a terminal state, send final event and close
    const terminalStatuses = ['COMPLETED', 'FAILED', 'CANCELLED'];
    if (terminalStatuses.includes(transfer.status)) {
      const finalTransfer = await prisma.transfer.findUnique({ where: { id } });
      if (finalTransfer) {
        reply.raw.write(
          `data: ${JSON.stringify({
            transferId: id,
            status: finalTransfer.status,
            totalTracks: finalTransfer.totalTracks,
            processedTracks: finalTransfer.totalTracks,
            matchedTracks: finalTransfer.matchedTracks,
            failedTracks: finalTransfer.failedTracks,
            matchRate: finalTransfer.matchRate,
            phase: 'DONE',
          })}\n\n`,
        );
      }
      reply.raw.end();
      return reply;
    }

    // Register this client for SSE updates
    sseManager.addClient(id, reply);

    // Clean up on client disconnect
    request.raw.on('close', () => {
      sseManager.removeClient(id, reply);
    });

    // Keep connection open — worker will call sseManager.sendEvent to push updates
    return reply;
  });

  // POST /api/transfers/:id/cancel
  app.post('/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await cancelTransfer(id, request.userId);
      return reply.send({ message: 'Transfer cancelled' });
    } catch (err: any) {
      if (err?.message === 'Transfer not found') {
        return reply.status(404).send({ error: 'Transfer not found' });
      }
      return reply.status(400).send({ error: err?.message ?? 'Failed to cancel transfer' });
    }
  });

  // POST /api/transfers/:id/retry
  app.post('/:id/retry', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const transfer = await retryTransfer(id, request.userId);
      return reply.status(201).send({ transfer });
    } catch (err: any) {
      if (err?.message === 'Transfer not found') {
        return reply.status(404).send({ error: 'Transfer not found' });
      }
      return reply.status(400).send({ error: err?.message ?? 'Failed to retry transfer' });
    }
  });

  // POST /api/transfers/multi — create transfers to multiple destinations
  app.post('/multi', async (request, reply) => {
    const MultiTransferSchema = z.object({
      sourcePlatform: z.string(),
      sourcePlaylistId: z.string(),
      sourcePlaylistName: z.string(),
      destinations: z.array(
        z.object({
          platform: z.string(),
          options: z.record(z.any()).optional(),
        }),
      ).min(1),
    });

    const parsed = MultiTransferSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    try {
      const transferIds = await createMultiTransfer(request.userId, parsed.data as any);
      return reply.status(201).send({ transferIds });
    } catch (err: any) {
      if (err?.message?.includes('No active connection')) {
        return reply.status(422).send({ error: err.message });
      }
      return reply.status(500).send({ error: err?.message ?? 'Failed to create transfers' });
    }
  });

  // PATCH /api/transfers/:id/tracks/:trackId — manually set match
  app.patch('/:id/tracks/:trackId', async (request, reply) => {
    const { id, trackId } = request.params as { id: string; trackId: string };

    const parsed = ManualMatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    // Verify ownership
    const transfer = await prisma.transfer.findFirst({
      where: { id, userId: request.userId },
      select: { id: true },
    });

    if (!transfer) {
      return reply.status(404).send({ error: 'Transfer not found' });
    }

    const track = await prisma.transferTrack.findFirst({
      where: { id: trackId, transferId: id },
    });

    if (!track) {
      return reply.status(404).send({ error: 'Track not found' });
    }

    const updated = await prisma.transferTrack.update({
      where: { id: trackId },
      data: {
        destinationTrackId: parsed.data.destinationTrackId,
        destinationTrackName: parsed.data.destinationTrackName,
        destinationArtist: parsed.data.destinationArtist,
        status: 'MATCHED',
        matchMethod: 'MANUAL',
        manuallyReviewed: true,
        manuallySelectedId: parsed.data.destinationTrackId,
        confidenceScore: 100,
      },
    });

    return reply.send({ track: updated });
  });
}
