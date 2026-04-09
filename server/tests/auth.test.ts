import { describe, it, expect, beforeAll } from 'vitest';
import { getApp } from './setup.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(() => {
  app = getApp();
});

describe('POST /api/auth/register', () => {
  const uniqueEmail = `test-${Date.now()}@example.com`;

  it('registers a new user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: uniqueEmail, password: 'password123', name: 'Test User' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe(uniqueEmail);
    expect(body.user.plan).toBe('FREE');
  });

  it('rejects duplicate email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: uniqueEmail, password: 'password123', name: 'Dupe' },
    });

    expect(res.statusCode).toBe(409);
  });

  it('validates input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'bad-email', password: '123', name: '' },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  const email = `login-test-${Date.now()}@example.com`;

  beforeAll(async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password: 'mypassword', name: 'Login Test' },
    });
  });

  it('logs in with correct credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'mypassword' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().token).toBeDefined();
  });

  it('rejects wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'wrongpassword' },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns user with valid token', async () => {
    const email = `me-test-${Date.now()}@example.com`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password: 'password123', name: 'Me Test' },
    });
    const { token } = regRes.json();

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe(email);
  });

  it('rejects without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
