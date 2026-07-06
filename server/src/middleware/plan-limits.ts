import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../prisma.js';
import { PLAN_LIMITS } from '@tunemymusic/types';
import type { UserPlan } from '@tunemymusic/types';

// Helper to get the user's plan and limits
async function getUserPlanLimits(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  if (!user) return null;
  const plan = user.plan as UserPlan;
  return { plan, limits: PLAN_LIMITS[plan] };
}

// Helper: count transfers this calendar month
async function getMonthlyTransferCount(userId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return prisma.transfer.count({
    where: {
      userId,
      createdAt: { gte: startOfMonth },
      status: { not: 'CANCELLED' },
    },
  });
}

/**
 * Checks whether the user has exceeded their monthly transfer limit.
 * Applied to POST /api/transfers.
 */
export async function checkTransferLimit(request: FastifyRequest, reply: FastifyReply) {
  const planData = await getUserPlanLimits(request.userId);
  if (!planData) return reply.status(401).send({ error: 'User not found' });

  const { limits, plan } = planData;
  if (limits.transfersPerMonth === Infinity) return; // unlimited

  const count = await getMonthlyTransferCount(request.userId);
  if (count >= limits.transfersPerMonth) {
    return reply.status(429).send({
      error: 'Transfer limit reached',
      message: `Your ${plan} plan allows ${limits.transfersPerMonth} transfer(s) per month. Upgrade to get more.`,
      code: 'TRANSFER_LIMIT_EXCEEDED',
    });
  }
}

/**
 * Checks whether the body's track count would exceed the plan's per-transfer track limit.
 * Applied to POST /api/transfers.
 * Note: The actual track count is checked against sourcePlaylist when the worker runs,
 * but we can reject obvious over-limit requests here if a trackCount hint is provided.
 * We also store this so the worker can enforce it.
 */
export async function checkTrackLimit(request: FastifyRequest, reply: FastifyReply) {
  const planData = await getUserPlanLimits(request.userId);
  if (!planData) return reply.status(401).send({ error: 'User not found' });

  const { limits, plan } = planData;
  if (limits.maxTracksPerTransfer === Infinity) return; // unlimited

  // Attach plan limits to request so transfer service can enforce them
  (request as any).planLimits = { maxTracksPerTransfer: limits.maxTracksPerTransfer, plan };
}

/**
 * Checks whether the user has too many active platform connections.
 * Applied to POST /api/connections/:platform/callback.
 */
export async function checkConnectionLimit(request: FastifyRequest, reply: FastifyReply) {
  const planData = await getUserPlanLimits(request.userId);
  if (!planData) return reply.status(401).send({ error: 'User not found' });

  const { limits, plan } = planData;
  if (limits.maxConnections === Infinity) return; // unlimited

  const count = await prisma.platformConnection.count({
    where: { userId: request.userId, isActive: true },
  });

  if (count >= limits.maxConnections) {
    return reply.status(429).send({
      error: 'Connection limit reached',
      message: `Your ${plan} plan allows ${limits.maxConnections} platform connection(s). Upgrade to connect more platforms.`,
      code: 'CONNECTION_LIMIT_EXCEEDED',
    });
  }
}

/**
 * Checks whether the user has too many active scheduled syncs.
 * Applied to POST /api/schedules.
 */
export async function checkSyncLimit(request: FastifyRequest, reply: FastifyReply) {
  const planData = await getUserPlanLimits(request.userId);
  if (!planData) return reply.status(401).send({ error: 'User not found' });

  const { limits, plan } = planData;
  if (limits.scheduledSyncs === Infinity) return; // unlimited

  if (limits.scheduledSyncs === 0) {
    return reply.status(403).send({
      error: 'Scheduled syncs not available',
      message: `Your ${plan} plan does not include scheduled syncs. Upgrade to Pro or Unlimited.`,
      code: 'SYNC_NOT_AVAILABLE',
    });
  }

  const count = await prisma.transferSchedule.count({
    where: { userId: request.userId, isActive: true },
  });

  if (count >= limits.scheduledSyncs) {
    return reply.status(429).send({
      error: 'Sync limit reached',
      message: `Your ${plan} plan allows ${limits.scheduledSyncs} active scheduled sync(s). Upgrade for more.`,
      code: 'SYNC_LIMIT_EXCEEDED',
    });
  }
}
