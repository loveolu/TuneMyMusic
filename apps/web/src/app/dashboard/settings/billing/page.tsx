'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CreditCard, ArrowLeft, Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { PLANS } from '@/lib/constants';

interface UserData { plan: string; createdAt: string; }

const PLAN_FEATURES: Record<string, string[]> = {
  FREE: ['3 transfers/month', 'Up to 100 tracks', '2 platforms'],
  PRO: ['50 transfers/month', 'Up to 1,000 tracks', '5 platforms', 'ISRC matching', '1 scheduled sync'],
  UNLIMITED: ['Unlimited transfers', 'Unlimited tracks', 'All 13 platforms', 'All features'],
};

export default function BillingPage() {
  const user = useAuthStore((s) => s.user);

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ user: UserData }>('/api/auth/me'),
  });

  const plan = meData?.user?.plan ?? user?.plan ?? 'FREE';
  const planConfig = PLANS[plan as keyof typeof PLANS] ?? PLANS.FREE;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/settings" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to settings
        </Link>
        <h1 className="font-display font-bold text-3xl mb-1">Billing</h1>
        <p className="text-text-secondary">Manage your subscription</p>
      </div>

      {/* Current plan */}
      <motion.div
        className="p-6 rounded-2xl bg-surface border border-border mb-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-4 w-4 text-text-secondary" />
          <h2 className="font-display font-bold text-base">Current Plan</h2>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-elevated border border-border mb-4">
          <div>
            <p className="font-medium text-text-primary text-lg">{planConfig.name}</p>
            <p className="text-sm text-text-secondary">
              {planConfig.price === 0 ? 'Free plan' : `$${planConfig.price}/month · billed monthly`}
            </p>
          </div>
          <Badge variant={plan === 'FREE' ? 'default' : plan === 'PRO' ? 'accent' : 'success'}>
            {plan}
          </Badge>
        </div>

        <div className="space-y-2 mb-4">
          {PLAN_FEATURES[plan]?.map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-text-secondary">
              <Check className="h-4 w-4 text-accent flex-shrink-0" />
              {f}
            </div>
          ))}
        </div>

        {plan === 'FREE' && (
          <Link href="/pricing">
            <Button variant="primary" size="md" className="font-semibold">
              Upgrade to Pro — $4.99/mo
            </Button>
          </Link>
        )}
        {plan === 'PRO' && (
          <div className="flex gap-3">
            <Link href="/pricing">
              <Button variant="secondary" size="md">Upgrade to Unlimited</Button>
            </Link>
            <Button variant="ghost" size="md" className="text-error hover:text-error">
              Cancel subscription
            </Button>
          </div>
        )}
        {plan === 'UNLIMITED' && (
          <Button variant="ghost" size="md" className="text-error hover:text-error">
            Cancel subscription
          </Button>
        )}
      </motion.div>

      {/* Payment history placeholder */}
      <motion.div
        className="p-6 rounded-2xl bg-surface border border-border"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <h2 className="font-display font-bold text-base mb-4">Payment History</h2>
        {plan === 'FREE' ? (
          <p className="text-text-secondary text-sm">No payments on free plan</p>
        ) : (
          <div className="space-y-3">
            {[
              { date: 'Apr 1, 2026', amount: `$${planConfig.price}`, status: 'Paid' },
              { date: 'Mar 1, 2026', amount: `$${planConfig.price}`, status: 'Paid' },
              { date: 'Feb 1, 2026', amount: `$${planConfig.price}`, status: 'Paid' },
            ].map((payment) => (
              <div key={payment.date} className="flex items-center justify-between p-3 rounded-xl hover:bg-elevated transition-colors">
                <div>
                  <p className="text-sm font-medium text-text-primary">{payment.date}</p>
                  <p className="text-xs text-text-secondary">Monthly subscription</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-text-primary">{payment.amount}</span>
                  <Badge variant="success">{payment.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
