import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/require-auth.js';
import {
  PLANS,
  createCheckoutSession,
  createBillingPortalSession,
  handleWebhook,
} from '../services/billing-service.js';
import { z } from 'zod';

const SubscribeBodySchema = z.object({
  planId: z.enum(['PRO', 'UNLIMITED']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const PortalBodySchema = z.object({
  returnUrl: z.string().url(),
});

export async function billingRoutes(app: FastifyInstance) {
  // GET /api/billing/plans — public, no auth needed
  app.get('/plans', async (_request, reply) => {
    return reply.send({ plans: PLANS });
  });

  // POST /api/billing/subscribe — create Stripe checkout session
  app.post('/subscribe', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = SubscribeBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    try {
      const result = await createCheckoutSession(
        request.userId,
        parsed.data.planId,
        parsed.data.successUrl,
        parsed.data.cancelUrl,
      );
      return reply.send(result);
    } catch (err: any) {
      if (err?.message?.includes('STRIPE_SECRET_KEY')) {
        return reply.status(503).send({ error: 'Billing is not configured' });
      }
      return reply.status(500).send({ error: err?.message ?? 'Failed to create checkout session' });
    }
  });

  // POST /api/billing/portal — create Stripe billing portal session
  app.post('/portal', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = PortalBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    try {
      const result = await createBillingPortalSession(request.userId, parsed.data.returnUrl);
      return reply.send(result);
    } catch (err: any) {
      if (err?.message?.includes('STRIPE_SECRET_KEY')) {
        return reply.status(503).send({ error: 'Billing is not configured' });
      }
      if (err?.message === 'No billing account found') {
        return reply.status(404).send({ error: 'No billing account found' });
      }
      return reply.status(500).send({ error: err?.message ?? 'Failed to create portal session' });
    }
  });
}

export async function stripeWebhookRoute(app: FastifyInstance) {
  // POST /api/stripe/webhook — raw body required
  app.post(
    '/webhook',
    {
      config: { rawBody: true },
    },
    async (request, reply) => {
      const signature = request.headers['stripe-signature'];
      if (!signature || typeof signature !== 'string') {
        return reply.status(400).send({ error: 'Missing stripe-signature header' });
      }

      // Access raw body provided by `fastify-raw-body` plugin (registered in app.ts).
      // Must be the exact bytes Stripe signed; do NOT fall back to JSON.stringify.
      const rawBody = (request as unknown as { rawBody?: Buffer }).rawBody;
      if (!rawBody || !Buffer.isBuffer(rawBody)) {
        request.log.error('Stripe webhook received without rawBody — fastify-raw-body not registered correctly');
        return reply.status(500).send({ error: 'Server misconfigured: raw body not available' });
      }

      try {
        await handleWebhook(rawBody, signature);
        return reply.send({ received: true });
      } catch (err: any) {
        if (err?.message === 'Invalid webhook signature') {
          return reply.status(400).send({ error: 'Invalid webhook signature' });
        }
        if (err?.message?.includes('STRIPE_WEBHOOK_SECRET')) {
          return reply.status(503).send({ error: 'Webhook not configured' });
        }
        return reply.status(500).send({ error: err?.message ?? 'Webhook processing failed' });
      }
    },
  );
}
