'use client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BarChart2, Music2, TrendingUp, Disc } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { api } from '@/lib/api';
import { PLATFORM_CONFIG } from '@/lib/constants';

interface Connection { platform: string; }
interface Transfer { status: string; matchRate: number; totalTracks: number; matchedTracks: number; }
interface TransfersResp { transfers: Transfer[]; pagination: { total: number } }

export default function StatsPage() {
  const { data: connData } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get<{ connections: Connection[] }>('/api/connections'),
  });

  const { data: transfersData, isLoading } = useQuery({
    queryKey: ['transfers-all'],
    queryFn: () => api.get<TransfersResp>('/api/transfers?page=1&limit=100'),
  });

  const connections = connData?.connections ?? [];
  const transfers = transfersData?.transfers ?? [];
  const total = transfersData?.pagination?.total ?? 0;

  const completed = transfers.filter((t) => t.status === 'COMPLETED');
  const avgMatchRate = completed.length > 0
    ? completed.reduce((sum, t) => sum + t.matchRate, 0) / completed.length
    : 0;
  const totalTracksTransferred = completed.reduce((sum, t) => sum + t.matchedTracks, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl mb-1">Stats</h1>
        <p className="text-text-secondary">Your music library overview</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            icon: <BarChart2 className="h-5 w-5" />,
            label: 'Total Transfers',
            value: total.toString(),
            color: '#E8FF47',
          },
          {
            icon: <TrendingUp className="h-5 w-5" />,
            label: 'Avg Match Rate',
            value: `${avgMatchRate.toFixed(0)}%`,
            color: '#4ADE80',
          },
          {
            icon: <Music2 className="h-5 w-5" />,
            label: 'Tracks Transferred',
            value: totalTracksTransferred.toLocaleString(),
            color: '#60A5FA',
          },
          {
            icon: <Disc className="h-5 w-5" />,
            label: 'Platforms Connected',
            value: connections.length.toString(),
            color: '#F472B6',
          },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="p-5">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center mb-3"
                style={{ backgroundColor: `${stat.color}15`, color: stat.color }}
              >
                {stat.icon}
              </div>
              <p className="text-2xl font-display font-bold text-text-primary">{stat.value}</p>
              <p className="text-xs text-text-secondary mt-0.5">{stat.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Connected platforms */}
      <div className="mb-8">
        <h2 className="font-display font-bold text-lg mb-4">Connected Platforms</h2>
        {connections.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-text-secondary">No platforms connected</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {connections.map((conn) => {
              const cfg = PLATFORM_CONFIG[conn.platform];
              return (
                <Card key={conn.platform} className="p-4 flex items-center gap-3">
                  <PlatformIcon platform={conn.platform} size="md" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{cfg?.name ?? conn.platform}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-success" />
                      <p className="text-xs text-text-secondary">Connected</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Transfer history chart (simplified) */}
      {isLoading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : transfers.length > 0 ? (
        <div>
          <h2 className="font-display font-bold text-lg mb-4">Recent Transfer Quality</h2>
          <Card className="p-6">
            <div className="space-y-3">
              {transfers.slice(0, 10).map((t, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-text-secondary truncate">Transfer {i + 1}</div>
                  <div className="flex-1 h-2 rounded-full bg-elevated overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${t.matchRate}%`,
                        backgroundColor: t.matchRate > 80 ? '#4ADE80' : t.matchRate > 60 ? '#FBBF24' : '#F87171',
                      }}
                    />
                  </div>
                  <div className="w-12 text-xs font-mono text-text-secondary text-right">
                    {t.matchRate.toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
