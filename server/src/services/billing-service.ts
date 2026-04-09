import { prisma } from '../prisma.js';

// Plan definitions returned by the API
export const PLANS = [
  {
    id: 'FREE',
    name: 'Free',
    price: 0,
    currency: 'usd',
    interval: null,
    features: [
      '3 transfers per month',
      'Up to 200 tracks per transfer',
      '2 platform connections',
      '7-day transfer history',
    ],
    stripePriceId: null,
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 499,
    currency: 'usd',
    interval: 'month',
    features: [
      'Unlimited transfers',
      'Up to 5,000 tracks per transfer',
      '5 platform connections',
      '3 scheduled syncs',
      '90-day transfer history',
    ],
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
  },
  {
    id: 'UNLIMITED',
    name: 'Unlimited',
    price: 999,
    currency: 'usd',
    interval: 'month',
    features: [
      'Unlimited transfers',
      'Unlimited tracks per transfer',
      'Unlimited platform connections',
      'Unlimited scheduled syncs',
      'Full transfer history',
      'Priority support',
    ],
    stripePriceId: process.env.STRIPE_UNLIMITED_PRICE_ID ?? null,
  },
];

// Lazy-load Stripe to avoid crash if STRIPE_SECRET_KEY isn't set
let _stripe: any = null;
async function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  const { default: Stripe } = await import('stripe');
  _stripe = new Stripe(key, { apiVersion: '2025-01-27.acacia' });
  return _stripe;
}

export async function createCheckoutSession(
  userId: string,
  planId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string }> {
  const stripe = await getStripe();

  const plan = PLANS.find((p) => p.id === planId);
  if (!plan || !plan.stripePriceId) {
    throw new Error(`Invalid or unconfigured plan: ${planId}`);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  // Get or create Stripe customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId, planId },
  });

  return { url: session.url! };
}

export async function createBillingPortalSession(
  userId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const stripe = await getStripe();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  if (!user.stripeCustomerId) throw new Error('No billing account found');

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

export async function handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
  const stripe = await getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    throw new Error('Invalid webhook signature');
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId;
      if (userId && planId && (planId === 'PRO' || planId === 'UNLIMITED')) {
        await prisma.user.update({
          where: { id: userId },
          data: { plan: planId as any },
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      await handleSubscriptionChange(stripe, subscription);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      // Downgrade user to FREE when subscription is cancelled
      const customer = await stripe.customers.retrieve(subscription.customer);
      if (!customer.deleted && customer.metadata?.userId) {
        await prisma.user.update({
          where: { id: customer.metadata.userId },
          data: { plan: 'FREE' },
        });
      }
      break;
    }

    default:
      // Ignore unhandled events
      break;
  }
}

async function handleSubscriptionChange(stripe: any, subscription: any): Promise<void> {
  const customer = await stripe.customers.retrieve(subscription.customer);
  if (customer.deleted || !customer.metadata?.userId) return;

  const userId = customer.metadata.userId;
  const status = subscription.status;

  if (status === 'active' || status === 'trialing') {
    // Determine plan from price
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const plan = PLANS.find((p) => p.stripePriceId === priceId);
    if (plan && (plan.id === 'PRO' || plan.id === 'UNLIMITED')) {
      await prisma.user.update({
        where: { id: userId },
        data: { plan: plan.id as any },
      });
    }
  } else if (['canceled', 'unpaid', 'past_due'].includes(status)) {
    await prisma.user.update({
      where: { id: userId },
      data: { plan: 'FREE' },
    });
  }
}
