'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Plus, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { PLATFORM_CONFIG } from '@/lib/constants';

interface Connection {
  id: string;
  platform: string;
  platformUsername: string;
  connectedAt: string;
  isActive: boolean;
}

interface Transfer {
  id: string;
  sourcePlatform: string;
  destinationPlatform: string;
  sourcePlaylistName: string;
  status: string;
  matchRate: number;
  matchedTracks: number;
  totalTracks: number;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'COMPLETED') return <Badge variant="success">Completed</Badge>;
  if (status === 'FAILED') return <Badge variant="error">Failed</Badge>;
  if (status === 'PROCESSING' || status === 'MATCHING' || status === 'IMPORTING') return <Badge variant="warning">Running</Badge>;
  if (status === 'PENDING' || status === 'QUEUED') return <Badge variant="default">Queued</Badge>;
  return <Badge>{status}</Badge>;
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: connectionsData, isLoading: loadingConnections } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get<{ connections: Connection[] }>('/api/connections'),
  });

  const { data: transfersData, isLoading: loadingTransfers } = useQuery({
    queryKey: ['transfers', 1],
    queryFn: () => api.get<{ transfers: Transfer[] }>('/api/transfers?page=1&limit=5'),
  });

  const connections = connectionsData?.connections ?? [];
  const recentTransfers = transfersData?.transfers ?? [];
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="font-display font-bold text-3xl mb-1">
          {greeting}, {user?.name?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="text-text-secondary">
          {connections.length} platform{connections.length !== 1 ? 's' : ''} connected
        </p>
      </motion.div>

      {/* Quick actions */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <Link href="/dashboard/transfer/new">
          <Card className="p-5 hover:border-accent/40 cursor-pointer transition-all group" style={{ boxShadow: '0 0 0 0 #E8FF47' }}>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                <Plus className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="font-medium text-text-primary">New Transfer</p>
                <p className="text-sm text-text-secondary">Move a playlist between platforms</p>
              </div>
              <ArrowRight className="h-4 w-4 text-text-secondary ml-auto group-hover:text-accent group-hover:translate-x-1 transition-all" />
            </div>
          </Card>
        </Link>

        <Link href="/dashboard/connect">
          <Card className="p-5 hover:border-border/80 cursor-pointer transition-all group">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-surface border border-border flex items-center justify-center group-hover:bg-elevated transition-colors">
                <span className="text-2xl">🔗</span>
              </div>
              <div>
                <p className="font-medium text-text-primary">Connect Platform</p>
                <p className="text-sm text-text-secondary">Add a new music service</p>
              </div>
              <ArrowRight className="h-4 w-4 text-text-secondary ml-auto group-hover:text-text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </Card>
        </Link>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Connected platforms */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg">Connected</h2>
            <Link href="/dashboard/connect" className="text-xs text-accent hover:text-accent-dim transition-colors">
              Manage
            </Link>
          </div>

          {loadingConnections ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : connections.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-text-secondary text-sm mb-3">No platforms connected yet</p>
              <Link href="/dashboard/connect">
                <Button variant="primary" size="sm">Connect a platform</Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-2">
              {connections.map((conn) => (
                <Card key={conn.id} className="p-4 flex items-center gap-3">
                  <PlatformIcon platform={conn.platform} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{PLATFORM_CONFIG[conn.platform]?.name ?? conn.platform}</p>
                    <p className="text-xs text-text-secondary truncate">@{conn.platformUsername}</p>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-success flex-shrink-0" />
                </Card>
              ))}
              {connections.length < 3 && (
                <Link href="/dashboard/connect">
                  <Card className="p-4 flex items-center gap-3 hover:border-accent/30 cursor-pointer transition-colors border-dashed">
                    <div className="h-10 w-10 rounded-xl border border-dashed border-border flex items-center justify-center">
                      <Plus className="h-4 w-4 text-text-secondary" />
                    </div>
                    <span className="text-sm text-text-secondary">Add platform</span>
                  </Card>
                </Link>
              )}
            </div>
          )}
        </motion.div>

        {/* Recent transfers */}
        <motion.div
          className="lg:col-span-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg">Recent Transfers</h2>
            <Link href="/dashboard/history" className="text-xs text-accent hover:text-accent-dim transition-colors">
              View all
            </Link>
          </div>

          {loadingTransfers ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : recentTransfers.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-text-secondary mb-3">No transfers yet</p>
              <Link href="/dashboard/transfer/new">
                <Button variant="primary" size="sm">Start your first transfer</Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentTransfers.map((t) => (
                <Link key={t.id} href={`/dashboard/transfer/${t.id}`}>
                  <Card className="p-4 hover:border-border/80 cursor-pointer transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <PlatformIcon platform={t.sourcePlatform} size="sm" />
                        <ArrowRight className="h-3 w-3 text-text-secondary" />
                        <PlatformIcon platform={t.destinationPlatform} size="sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{t.sourcePlaylistName}</p>
                        <p className="text-xs text-text-secondary">
                          {t.matchedTracks}/{t.totalTracks} tracks matched
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <StatusBadge status={t.status} />
                        {t.status === 'COMPLETED' && (
                          <span className="text-xs font-mono text-text-secondary">{t.matchRate.toFixed(0)}%</span>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
