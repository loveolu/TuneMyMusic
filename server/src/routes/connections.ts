import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/require-auth.js';
import { prisma } from '../prisma.js';

export async function connectionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/', async (request, reply) => {
    const connections = await prisma.platformConnection.findMany({
      where: { userId: request.userId, isActive: true },
      select: {
        id: true,
        platform: true,
        platformUserId: true,
        platformUsername: true,
        connectedAt: true,
        isActive: true,
      },
    });

    return reply.send({ connections });
  });
}
