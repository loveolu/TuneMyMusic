import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../plugins/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userEmail: string;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    request.userId = payload.userId;
    request.userEmail = payload.email;
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}
