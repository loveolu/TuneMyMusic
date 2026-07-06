import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/require-auth.js';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
} from '../services/notification-service.js';
import { z } from 'zod';

const ListQuerySchema = z.object({
  unreadOnly: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /api/notifications
  app.get('/', async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query params' });
    }

    const { unreadOnly, limit, offset } = parsed.data;
    const result = await getUserNotifications(request.userId, unreadOnly, limit, offset);
    return reply.send(result);
  });

  // PATCH /api/notifications/:id/read
  app.patch('/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string };

    const updated = await markAsRead(id, request.userId);
    if (!updated) {
      return reply.status(404).send({ error: 'Notification not found' });
    }
    return reply.send({ message: 'Notification marked as read' });
  });

  // POST /api/notifications/read-all
  app.post('/read-all', async (request, reply) => {
    const count = await markAllAsRead(request.userId);
    return reply.send({ message: 'All notifications marked as read', count });
  });
}
