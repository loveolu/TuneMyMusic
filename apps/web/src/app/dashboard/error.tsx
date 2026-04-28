'use client';

/**
 * Dashboard-scoped error UI. Catches errors thrown inside any nested
 * `dashboard/*` segment WITHOUT taking down the marketing pages or the
 * sidebar (the dashboard layout itself is not re-rendered on retry).
 *
 * Distinct from app/error.tsx so we can render the right call-to-action
 * for an authenticated user (back to dashboard / contact support) vs. the
 * root error which might catch issues on /login or /pricing.
 */

import { useEffect } from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[dashboard/error.tsx] caught:', error);
  }, [error]);

  return (
    <div className="p-6 max-w-2xl mx-auto" role="alert" aria-live="assertive">
      <div className="p-6 rounded-2xl bg-error/5 border border-error/20">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-error flex-shrink-0 mt-1" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-lg text-text-primary mb-1">
              This page failed to load
            </h2>
            <p className="text-sm text-text-secondary mb-3">
              Something went wrong while rendering. Your data is safe; this is just a UI hiccup.
            </p>
            <div className="p-3 rounded-xl bg-elevated mb-4">
              <p className="text-xs text-text-secondary font-mono break-words">
                {error.message || 'Unknown error'}
              </p>
              {error.digest && (
                <p className="text-xs text-text-secondary font-mono mt-1 opacity-60">
                  Trace: {error.digest}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={reset}>
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                Try again
              </Button>
              <Link href="/dashboard">
                <Button variant="secondary" size="sm">
                  <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                  Back to dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
