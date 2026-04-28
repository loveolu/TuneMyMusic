'use client';

/**
 * Root-level error UI. Next.js renders this when an unhandled error escapes
 * any nested route segment (and no closer error.tsx caught it).
 *
 * Note the `'use client'` directive: this file MUST be a client component
 * because it receives the `reset` callback Next.js gives error boundaries.
 */

import { useEffect } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[app/error.tsx] caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-6">
      <div
        role="alert"
        aria-live="assertive"
        className="max-w-md w-full p-6 rounded-2xl bg-surface border border-error/20"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-error/10 border border-error/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-error" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-lg text-text-primary mb-1">
              Something broke
            </h1>
            <p className="text-sm text-text-secondary">
              We hit an unexpected error rendering this page.
            </p>
          </div>
        </div>

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
          <Button variant="primary" size="md" onClick={reset} className="flex-1">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
          <Link href="/dashboard">
            <Button variant="secondary" size="md">
              <Home className="h-4 w-4" aria-hidden="true" />
              Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
