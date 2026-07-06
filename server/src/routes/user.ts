import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/require-auth.js';
import { prisma } from '../prisma.js';
import { z } from 'zod';

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /api/user/profile
  app.get('/profile', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        plan: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({ user });
  });

  // PATCH /api/user/profile
  app.patch('/profile', async (request, reply) => {
    const parsed = UpdateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const updateData: { name?: string; avatarUrl?: string | null } = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.avatarUrl !== undefined) updateData.avatarUrl = parsed.data.avatarUrl;

    if (Object.keys(updateData).length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    const user = await prisma.user.update({
      where: { id: request.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        plan: true,
        createdAt: true,
      },
    });

    return reply.send({ user });
  });

  // DELETE /api/user — delete account (cascade deletes all data via Prisma schema)
  app.delete('/', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { id: true },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Cascade delete is set up in the Prisma schema (onDelete: Cascade)
    await prisma.user.delete({ where: { id: request.userId } });

    return reply.send({ message: 'Account deleted successfully' });
  });
}
