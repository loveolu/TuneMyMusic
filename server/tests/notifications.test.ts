import { describe, it, expect, beforeAll } from 'vitest';
import { getApp } from './setup.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let token: string;
let userId: string;

async function registerAndLogin(email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password: 'password123', name: 'Notif Test' },
  });
  expect(res.statusCode).toBe(201);
  const body = res.json();
  return { token: body.token, userId: body.user.id };
}

beforeAll(async () => {
  app = getApp();
  const email = `notif-test-${Date.now()}@example.com`;
  const creds = await registerAndLogin(email);
  token = creds.token;
  userId = creds.userId;
});

describe('GET /api/notifications', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/notifications',
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns empty notifications for new user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.notifications)).toBe(true);
    expect(body.total).toBe(0);
    expect(body.unreadCount).toBe(0);
  });
});

describe('Notification CRUD flow', () => {
  let notificationId: string;

  it('creates a notification via service and returns it', async () => {
    const { createNotification } = await import('../src/services/notification-service.js');
    const notif = await createNotification(
      userId,
      'INFO',
      'Test notification',
      'This is a test notification body',
      { transferId: 'test-123' },
    );
    expect(notif.id).toBeDefined();
    expect(notif.title).toBe('Test notification');
    expect(notif.read).toBe(false);
    notificationId = notif.id;
  });

  it('GET /api/notifications returns the created notification', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.notifications.length).toBeGreaterThan(0);
    expect(body.unreadCount).toBeGreaterThan(0);
  });

  it('GET /api/notifications?unreadOnly=true returns only unread', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/notifications?unreadOnly=true',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const allRead = body.notifications.every((n: any) => !n.read);
    expect(allRead).toBe(true);
  });

  it('PATCH /api/notifications/:id/read marks a notification as read', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/notifications/${notificationId}/read`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBeTruthy();
  });

  it('PATCH /api/notifications/:id/read returns 404 for wrong user notification', async () => {
    // Register another user
    const otherEmail = `notif-other-${Date.now()}@example.com`;
    const other = await registerAndLogin(otherEmail);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/notifications/${notificationId}/read`,
      headers: { Authorization: `Bearer ${other.token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('POST /api/notifications/read-all marks all as read', async () => {
    // Create a couple more notifications
    const { createNotification } = await import('../src/services/notification-service.js');
    await createNotification(userId, 'INFO', 'Notif 2', 'Body 2');
    await createNotification(userId, 'INFO', 'Notif 3', 'Body 3');

    const res = await app.inject({
      method: 'POST',
      url: '/api/notifications/read-all',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBeGreaterThanOrEqual(0);

    // Verify all are now read
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/notifications?unreadOnly=true',
      headers: { Authorization: `Bearer ${token}` },
    });
    const listBody = listRes.json();
    expect(listBody.notifications.length).toBe(0);
  });
});
