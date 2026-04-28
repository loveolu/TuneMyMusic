'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, Plus, Trash2, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { PLATFORM_CONFIG, ALL_PLATFORMS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface Connection {
  id: string;
  platform: string;
  platformUsername: string;
  connectedAt: string;
  isActive: boolean;
}

const REDIRECT_URI = typeof window !== 'undefined'
  ? `${window.location.origin}/dashboard/connect`
  : 'http://localhost:3000/dashboard/connect';

/**
 * Translate raw OAuth error codes (per RFC 6749 §4.1.2.1 and platform
 * extensions) into user-friendly copy. Falls back to a generic message for
 * codes we don't recognize so the user always sees *something* actionable.
 */
function describeOAuthError(code: string | null, description: string | null): string {
  switch (code) {
    case 'access_denied':
      return "You declined the connection. We won't be able to access this platform until you connect again.";
    case 'invalid_request':
    case 'invalid_grant':
      return 'The authorization request was malformed or the code expired. Please try connecting again.';
    case 'unauthorized_client':
      return 'TuneMyMusic is not authorized to access this platform with these credentials. If this keeps happening, contact support.';
    case 'unsupported_response_type':
    case 'invalid_scope':
      return 'The platform rejected our authorization request. This is a TuneMyMusic configuration issue — please contact support.';
    case 'server_error':
    case 'temporarily_unavailable':
      return "The platform's auth server is having trouble. Please try again in a few minutes.";
    default:
      return description || 'Connection failed. Please try again.';
  }
}

export default function ConnectPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<Connection | null>(null);
  const [error, setError] = useState('');
  const [callbackBanner, setCallbackBanner] = useState<
    | { kind: 'success'; platform: string }
    | { kind: 'error'; message: string; canRetry: boolean }
    | null
  >(null);

  const { data, isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get<{ connections: Connection[] }>('/api/connections'),
  });

  // OAuth callback exchange.
  //
  // After the user authorizes on the third-party site, we land back here
  // with `?code=...&state=...` (success) or `?error=...&error_description=...`
  // (denial / failure). This effect picks up either case, exchanges the
  // code via the server, and surfaces friendly status to the user.
  //
  // Platform identification: we stash the in-flight `platform` in
  // sessionStorage just before redirecting in handleConnect(). We can't
  // round-trip it through the OAuth `state` (server-generated and opaque
  // to us) and putting it in the redirect URI breaks providers that
  // require an EXACT registered URI (Google, Spotify). sessionStorage is
  // appropriate here — it's same-origin and short-lived.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const oauthError = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Nothing OAuth-related in the query string — bail.
    if (!code && !oauthError) return;

    const platform = sessionStorage.getItem('tmm_oauth_platform');

    // Strip OAuth params from the URL so a refresh doesn't re-trigger this.
    function clearQueryParams() {
      sessionStorage.removeItem('tmm_oauth_platform');
      router.replace(pathname);
    }

    if (oauthError) {
      setCallbackBanner({
        kind: 'error',
        message: describeOAuthError(oauthError, errorDescription),
        canRetry: oauthError !== 'unauthorized_client' && oauthError !== 'invalid_scope',
      });
      clearQueryParams();
      return;
    }

    if (!platform) {
      // Code/state present but no in-flight platform — likely a stale tab
      // or someone landed here with a copy-pasted URL. Treat as a no-op.
      clearQueryParams();
      return;
    }

    if (code && state) {
      api
        .post(`/api/connections/${platform.toLowerCase()}/callback`, {
          code,
          state,
          redirectUri: REDIRECT_URI,
        })
        .then(() => {
          setCallbackBanner({ kind: 'success', platform });
          queryClient.invalidateQueries({ queryKey: ['connections'] });
        })
        .catch((err: Error) => {
          // Server-side state validation failures land here. Common cause:
          // user kicked off auth in one tab, signed in with a different
          // account in another, then came back. Treat as a clean expiry.
          const expired =
            err.message.toLowerCase().includes('invalid') &&
            err.message.toLowerCase().includes('state');
          setCallbackBanner({
            kind: 'error',
            message: expired
              ? 'This connection link has expired or already been used. Please start the connection again.'
              : err.message,
            canRetry: true,
          });
        })
        .finally(() => {
          clearQueryParams();
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const disconnectMutation = useMutation({
    mutationFn: (platform: string) =>
      api.delete<{ message: string }>(`/api/connections/${platform}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      setDisconnectTarget(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const connections = data?.connections ?? [];
  const connectedSet = new Set(connections.map((c) => c.platform));

  async function handleConnect(platform: string) {
    setConnectingPlatform(platform);
    setError('');
    setCallbackBanner(null);
    try {
      // Stash the platform we're connecting in sessionStorage so the
      // callback effect (after the OAuth round-trip) knows which API path
      // to POST to. Using sessionStorage rather than a URL param keeps the
      // redirect URI byte-identical to what's registered with the provider.
      sessionStorage.setItem('tmm_oauth_platform', platform);
      const data = await api.get<{ url: string }>(
        `/api/connections/${platform.toLowerCase()}/auth-url?redirectUri=${encodeURIComponent(REDIRECT_URI)}`,
      );
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to get auth URL');
      setConnectingPlatform(null);
      sessionStorage.removeItem('tmm_oauth_platform');
    }
  }

  const tier1 = ALL_PLATFORMS.slice(0, 5);
  const tier2 = ALL_PLATFORMS.slice(5, 10);
  const tier3 = ALL_PLATFORMS.slice(10);

  function renderPlatformGrid(platformIds: string[], tierLabel: string) {
    return (
      <div className="mb-8">
        <p className="text-xs text-text-secondary uppercase tracking-widest mb-4 font-mono">{tierLabel}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {platformIds.map((id) => {
            const cfg = PLATFORM_CONFIG[id];
            if (!cfg) return null;
            const connected = connectedSet.has(id);
            const conn = connections.find((c) => c.platform === id);
            const isConnecting = connectingPlatform === id;

            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  'relative p-4 rounded-2xl border flex flex-col items-center gap-3 transition-all duration-200',
                  connected
                    ? 'bg-surface border-success/30'
                    : 'bg-surface border-border hover:border-border/80',
                )}
                style={connected ? { boxShadow: `0 0 16px ${cfg.color}15` } : {}}
              >
                {connected && (
                  <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-success/10 border border-success/30 flex items-center justify-center">
                    <Check className="h-3 w-3 text-success" />
                  </div>
                )}

                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ backgroundColor: `${cfg.color}22`, border: `1px solid ${cfg.color}44` }}
                >
                  {cfg.emoji}
                </div>

                <div className="text-center">
                  <p className="text-xs font-medium text-text-primary">{cfg.name}</p>
                  {conn?.platformUsername && (
                    <p className="text-xs text-text-secondary truncate max-w-[100px]">
                      @{conn.platformUsername}
                    </p>
                  )}
                </div>

                {connected ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setDisconnectTarget(conn!)}
                  >
                    <Trash2 className="h-3 w-3" />
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full text-xs"
                    loading={isConnecting}
                    onClick={() => handleConnect(id)}
                  >
                    <Plus className="h-3 w-3" />
                    Connect
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl mb-2">Connect Platforms</h1>
        <p className="text-text-secondary">
          Connect your music services to start transferring playlists.
          {connections.length > 0 && (
            <span className="ml-2 text-success font-medium">{connections.length} connected</span>
          )}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-6 flex items-center gap-2 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {callbackBanner?.kind === 'success' && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-2 p-4 rounded-xl bg-success/10 border border-success/20 text-success text-sm"
        >
          <Check className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          Connected to{' '}
          <strong className="text-text-primary">
            {PLATFORM_CONFIG[callbackBanner.platform]?.name ?? callbackBanner.platform}
          </strong>
          .
          <button
            onClick={() => setCallbackBanner(null)}
            className="ml-auto text-text-secondary hover:text-text-primary"
            aria-label="Dismiss success message"
          >
            ✕
          </button>
        </motion.div>
      )}

      {callbackBanner?.kind === 'error' && (
        <motion.div
          role="alert"
          aria-live="assertive"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20"
        >
          <div className="flex items-start gap-2 mb-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-error" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">Connection failed</p>
              <p className="text-sm text-error mt-0.5">{callbackBanner.message}</p>
            </div>
            <button
              onClick={() => setCallbackBanner(null)}
              className="text-text-secondary hover:text-text-primary"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
          {callbackBanner.canRetry && (
            <p className="text-xs text-text-secondary mt-2 ml-6">
              You can try again from the platform list below.
            </p>
          )}
        </motion.div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
          {renderPlatformGrid(tier1, 'Tier 1 — Full Support')}
          {renderPlatformGrid(tier2, 'Tier 2 — Standard Support')}
          {renderPlatformGrid(tier3, 'Tier 3 — Import / Export')}
        </>
      )}

      <Dialog
        open={!!disconnectTarget}
        onClose={() => setDisconnectTarget(null)}
        title="Disconnect platform"
      >
        <p className="text-text-secondary mb-6">
          Are you sure you want to disconnect{' '}
          <strong className="text-text-primary">
            {disconnectTarget ? PLATFORM_CONFIG[disconnectTarget.platform]?.name : ''}
          </strong>
          ? You won&apos;t be able to transfer playlists from this platform until you reconnect.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" size="md" className="flex-1" onClick={() => setDisconnectTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="md"
            className="flex-1"
            loading={disconnectMutation.isPending}
            onClick={() => disconnectTarget && disconnectMutation.mutate(disconnectTarget.platform)}
          >
            Disconnect
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
