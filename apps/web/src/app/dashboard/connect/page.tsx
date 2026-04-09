'use client';
import { useState } from 'react';
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

export default function ConnectPage() {
  const queryClient = useQueryClient();
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<Connection | null>(null);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get<{ connections: Connection[] }>('/api/connections'),
  });

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
    try {
      const data = await api.get<{ url: string }>(
        `/api/connections/${platform.toLowerCase()}/auth-url?redirectUri=${encodeURIComponent(REDIRECT_URI)}`,
      );
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to get auth URL');
      setConnectingPlatform(null);
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
        <div className="mb-6 flex items-center gap-2 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
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
