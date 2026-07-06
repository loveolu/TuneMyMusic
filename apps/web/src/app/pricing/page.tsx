'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Check, X, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const plans = [
  {
    id: 'FREE',
    name: 'Free',
    price: 0,
    color: '#8A8A8F',
    description: 'Try it out',
    features: [
      { label: '3 transfers per month', included: true },
      { label: 'Up to 100 tracks per playlist', included: true },
      { label: '2 connected platforms', included: true },
      { label: 'Basic track matching', included: true },
      { label: 'ISRC matching', included: false },
      { label: 'Scheduled sync', included: false },
      { label: 'Playlist merge & split', included: false },
      { label: 'Health scanner', included: false },
      { label: 'Priority support', included: false },
    ],
    cta: 'Get started free',
    ctaVariant: 'secondary' as const,
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 4.99,
    color: '#E8FF47',
    description: 'For music enthusiasts',
    popular: true,
    features: [
      { label: '50 transfers per month', included: true },
      { label: 'Up to 1,000 tracks per playlist', included: true },
      { label: '5 connected platforms', included: true },
      { label: 'Smart + ISRC matching', included: true },
      { label: '1 scheduled sync', included: true },
      { label: 'Playlist merge & split', included: false },
      { label: 'Health scanner', included: false },
      { label: 'Priority support', included: true },
      { label: 'API access', included: false },
    ],
    cta: 'Get Pro',
    ctaVariant: 'primary' as const,
  },
  {
    id: 'UNLIMITED',
    name: 'Unlimited',
    price: 9.99,
    color: '#4ADE80',
    description: 'Power users & DJs',
    features: [
      { label: 'Unlimited transfers', included: true },
      { label: 'Unlimited tracks', included: true },
      { label: 'All 13 platforms', included: true },
      { label: 'Smart + ISRC matching', included: true },
      { label: 'Unlimited scheduled sync', included: true },
      { label: 'Playlist merge & split', included: true },
      { label: 'Health scanner', included: true },
      { label: 'Priority support', included: true },
      { label: 'API access', included: true },
    ],
    cta: 'Get Unlimited',
    ctaVariant: 'secondary' as const,
  },
];

const faqs = [
  {
    q: 'Can I change plans at any time?',
    a: 'Yes, you can upgrade or downgrade at any time. Changes take effect immediately.',
  },
  {
    q: 'What happens to my transfers if I downgrade?',
    a: 'Existing transfers and syncs remain intact. New transfers will follow the new plan limits.',
  },
  {
    q: 'Do you store my music credentials?',
    a: 'We use OAuth2 for all platforms. Your passwords are never shared with us. OAuth tokens are encrypted at rest.',
  },
  {
    q: 'What is ISRC matching?',
    a: 'International Standard Recording Code — a unique identifier per recording that guarantees exact track matches across platforms.',
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-base text-text-primary">
      <nav className="border-b border-border/50 bg-base/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
              <Music2 className="h-4 w-4 text-base" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">TuneMyMusic</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link href="/signup"><Button variant="primary" size="sm">Get started</Button></Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-20">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="font-display font-black text-5xl md:text-6xl tracking-tighter mb-4">
            Simple pricing
          </h1>
          <p className="text-text-secondary text-lg max-w-xl mx-auto">
            Start free. Scale as you grow. Cancel anytime — no lock-in.
          </p>
        </motion.div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              className={`relative p-8 rounded-2xl bg-surface flex flex-col ${plan.popular ? 'border-2 border-accent' : 'border border-border'}`}
              style={plan.popular ? { boxShadow: '0 0 40px #E8FF4715' } : {}}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-accent text-base text-xs font-bold px-4 py-1.5 rounded-full">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <div className="mb-6">
                <p className="text-sm font-medium mb-1" style={{ color: plan.color }}>{plan.name}</p>
                <div className="flex items-end gap-1 mb-1">
                  {plan.price === 0 ? (
                    <span className="font-display font-black text-4xl">Free</span>
                  ) : (
                    <>
                      <span className="font-display font-black text-4xl">${plan.price}</span>
                      <span className="text-text-secondary text-sm mb-1.5">/month</span>
                    </>
                  )}
                </div>
                <p className="text-text-secondary text-sm">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f.label} className="flex items-start gap-2.5 text-sm">
                    {f.included ? (
                      <Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: plan.color }} />
                    ) : (
                      <X className="h-4 w-4 flex-shrink-0 mt-0.5 text-border" />
                    )}
                    <span className={f.included ? 'text-text-primary' : 'text-text-secondary'}>{f.label}</span>
                  </li>
                ))}
              </ul>

              <Link href="/signup">
                <Button variant={plan.ctaVariant} size="md" className="w-full font-semibold">
                  {plan.cta}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="font-display font-bold text-2xl mb-8 text-center">Frequently asked questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="p-6 rounded-2xl bg-surface border border-border">
                <h3 className="font-medium text-text-primary mb-2">{faq.q}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
