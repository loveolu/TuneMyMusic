import { describe, it, expect, beforeAll } from 'vitest';
import { getApp } from './setup.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(() => {
  app = getApp();
});

describe('GET /api/billing/plans', () => {
  it('returns a list of plans', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/billing/plans',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.plans)).toBe(true);
    expect(body.plans.length).toBe(3);
  });

  it('returns FREE, PRO, UNLIMITED plans', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/billing/plans',
    });

    const body = res.json();
    const ids = body.plans.map((p: any) => p.id);
    expect(ids).toContain('FREE');
    expect(ids).toContain('PRO');
    expect(ids).toContain('UNLIMITED');
  });

  it('FREE plan has zero price', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/billing/plans',
    });

    const body = res.json();
    const freePlan = body.plans.find((p: any) => p.id === 'FREE');
    expect(freePlan).toBeDefined();
    expect(freePlan.price).toBe(0);
    expect(freePlan.interval).toBeNull();
  });

  it('PRO plan has a monthly price', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/billing/plans',
    });

    const body = res.json();
    const proPlan = body.plans.find((p: any) => p.id === 'PRO');
    expect(proPlan).toBeDefined();
    expect(proPlan.price).toBeGreaterThan(0);
    expect(proPlan.interval).toBe('month');
    expect(Array.isArray(proPlan.features)).toBe(true);
  });

  it('UNLIMITED plan has higher price than PRO', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/billing/plans',
    });

    const body = res.json();
    const proPlan = body.plans.find((p: any) => p.id === 'PRO');
    const unlimitedPlan = body.plans.find((p: any) => p.id === 'UNLIMITED');
    expect(unlimitedPlan.price).toBeGreaterThan(proPlan.price);
  });

  it('each plan has a features array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/billing/plans',
    });

    const body = res.json();
    for (const plan of body.plans) {
      expect(Array.isArray(plan.features)).toBe(true);
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });
});

describe('POST /api/billing/subscribe (no Stripe key configured)', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/subscribe',
      payload: {
        planId: 'PRO',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      },
    });

    expect(res.statusCode).toBe(401);
  });
});
