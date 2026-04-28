'use client';

/**
 * Generic React error boundary.
 *
 * Next.js 14 App Router supports per-route `error.tsx` files which is the
 * idiomatic way to scope error UIs. This component is for cases where a
 * route's content tree contains a smaller widget that we'd rather isolate
 * (e.g. a "Recent Transfers" list inside the dashboard home — if it
 * crashes, the rest of the dashboard should keep working).
 *
 * Use route-level `error.tsx` for big-picture failures and this component
 * for "don't take down the whole page if one card breaks" cases.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional title shown above the fallback. */
  title?: string;
  /** Custom fallback. Falls back to the default UI when omitted. */
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode;
  /** Hook for logging — called once when an error is caught. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface errors to the browser console so engineers can see them in
    // dev. In production this is also where you'd hook into a third-party
    // error tracker — left as a no-op per the "no new external services"
    // constraint, but the seam is here.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught error:', error, info);
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.reset });
      }
      return (
        <div className="p-6 rounded-2xl bg-error/5 border border-error/20" role="alert" aria-live="assertive">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="h-5 w-5 text-error flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-text-primary mb-1">
                {this.props.title ?? 'Something went wrong'}
              </p>
              <p className="text-xs text-text-secondary break-words">
                {this.state.error.message || 'An unexpected error occurred.'}
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={this.reset} className="ml-8">
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
