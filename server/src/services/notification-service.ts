import { prisma } from '../prisma.js';

export type NotificationType =
  | 'TRANSFER_COMPLETE'
  | 'TRANSFER_FAILED'
  | 'SYNC_COMPLETE'
  | 'PLAN_UPGRADED'
  | 'PLAN_DOWNGRADED'
  | 'WELCOME'
  | 'INFO';

export interface NotificationData {
  [key: string]: unknown;
}

export async function createNotification(
  userId: string,
  type: NotificationType | string,
  title: string,
  body: string,
  data?: NotificationData,
) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      data: data ?? {},
    },
  });
}

export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });
  if (!notification) return false;

  await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
  return true;
}

export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return result.count;
}

export async function getUserNotifications(
  userId: string,
  unreadOnly = false,
  limit = 50,
  offset = 0,
) {
  const where: any = { userId };
  if (unreadOnly) where.read = false;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  return { notifications, total, unreadCount };
}
