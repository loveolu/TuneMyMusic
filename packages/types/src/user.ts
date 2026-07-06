import { z } from 'zod';

export const UserPlan = z.enum(['FREE', 'PRO', 'UNLIMITED']);
export type UserPlan = z.infer<typeof UserPlan>;

export const PLAN_LIMITS: Record<UserPlan, {
  maxConnections: number;
  transfersPerMonth: number;
  maxTracksPerTransfer: number;
  scheduledSyncs: number;
  multiDestination: number;
  historyDays: number;
}> = {
  FREE: {
    maxConnections: 2,
    transfersPerMonth: 3,
    maxTracksPerTransfer: 200,
    scheduledSyncs: 0,
    multiDestination: 0,
    historyDays: 7,
  },
  PRO: {
    maxConnections: 5,
    transfersPerMonth: Infinity,
    maxTracksPerTransfer: 5000,
    scheduledSyncs: 3,
    multiDestination: 3,
    historyDays: 90,
  },
  UNLIMITED: {
    maxConnections: Infinity,
    transfersPerMonth: Infinity,
    maxTracksPerTransfer: Infinity,
    scheduledSyncs: Infinity,
    multiDestination: Infinity,
    historyDays: Infinity,
  },
};

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  plan: UserPlan,
  createdAt: z.date(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;
