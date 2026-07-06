import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/require-auth.js';
import { checkSyncLimit } from '../middleware/plan-limits.js';
import { prisma } from '../prisma.js';
import { upsertSyncJob, removeSyncJob, triggerSyncNow } from '../workers/sync.worker.js';

// Validate cron expression (5 or 6 fields)
function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  return parts.length >= 5 && parts.length <= 6;
}

const CreateScheduleSchema = z.object({
  savedPlaylistId: z.string(),
  destinationPlatform: z.string(),
  destinationPlaylistId: z.string().optional(),
  cronExpression: z.string(),
  timezone: z.string().default('UTC'),
});

const UpdateScheduleSchema = z.object({
  isActive: z.boolean().optional(),
  cronExpression: z.string().optional(),
  timezone: z.string().optional(),
  destinationPlaylistId: z.string().optional(),
});

export async function scheduleRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /api/schedules — list user's schedules
  app.get('/', async (request, reply) => {
    const schedules = await prisma.transferSchedule.findMany({
      where: { userId: request.userId },
      include: { savedPlaylist: true },
      orderBy: { id: 'desc' },
    });

    return reply.send({ schedules });
  });

  // POST /api/schedules — create schedule
  app.post('/', { preHandler: checkSyncLimit }, async (request, reply) => {
    const parsed = CreateScheduleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const { savedPlaylistId, destinationPlatform, destinationPlaylistId, cronExpression, timezone } =
      parsed.data;

    if (!isValidCron(cronExpression)) {
      return reply.status(400).send({ error: 'Invalid cron expression' });
    }

    // Verify the saved playlist belongs to the user
    const playlist = await prisma.savedPlaylist.findFirst({
      where: { id: savedPlaylistId, userId: request.userId },
    });
    if (!playlist) {
      return reply.status(404).send({ error: 'Saved playlist not found' });
    }

    const schedule = await prisma.transferSchedule.create({
      data: {
        userId: request.userId,
        savedPlaylistId,
        destinationPlatform: destinationPlatform as any,
        destinationPlaylistId: destinationPlaylistId ?? null,
        cronExpression,
        timezone,
        isActive: true,
      },
      include: { savedPlaylist: true },
    });

    // Register repeatable job
    await upsertSyncJob(schedule.id, cronExpression);

    return reply.status(201).send({ schedule });
  });

  // PATCH /api/schedules/:id — update schedule
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = UpdateScheduleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const existing = await prisma.transferSchedule.findFirst({
      where: { id, userId: request.userId },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Schedule not found' });
    }

    const { cronExpression } = parsed.data;
    if (cronExpression && !isValidCron(cronExpression)) {
      return reply.status(400).send({ error: 'Invalid cron expression' });
    }

    const updated = await prisma.transferSchedule.update({
      where: { id },
      data: {
        ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
        ...(cronExpression && { cronExpression }),
        ...(parsed.data.timezone && { timezone: parsed.data.timezone }),
        ...(parsed.data.destinationPlaylistId !== undefined && {
          destinationPlaylistId: parsed.data.destinationPlaylistId,
        }),
      },
      include: { savedPlaylist: true },
    });

    // Re-register repeatable job if cron changed or toggle active state
    if (cronExpression || parsed.data.isActive !== undefined) {
      if (updated.isActive) {
        await upsertSyncJob(updated.id, updated.cronExpression);
      } else {
        await removeSyncJob(updated.id);
      }
    }

    return reply.send({ schedule: updated });
  });

  // DELETE /api/schedules/:id — delete schedule
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.transferSchedule.findFirst({
      where: { id, userId: request.userId },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Schedule not found' });
    }

    await removeSyncJob(id);
    await prisma.transferSchedule.delete({ where: { id } });

    return reply.send({ message: 'Schedule deleted' });
  });

  // POST /api/schedules/:id/run-now — trigger immediately
  app.post('/:id/run-now', async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.transferSchedule.findFirst({
      where: { id, userId: request.userId },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Schedule not found' });
    }

    await triggerSyncNow(id, request.userId);

    return reply.send({ message: 'Sync triggered' });
  });
}
