'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { api } from '@/lib/api';
import { PLATFORM_CONFIG } from '@/lib/constants';

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
  completedAt?: string;
}

interface TransfersResp {
  transfers: Transfer[];
  pagination: { page: number; totalPages: number; total: number };
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'COMPLETED') return <Badge variant="success">Completed</Badge>;
  if (status === 'FAILED') return <Badge variant="error">Failed</Badge>;
  if (status === 'CANCELLED') return <Badge variant="default">Cancelled</Badge>;
  if (['PROCESSING', 'MATCHING', 'IMPORTING'].includes(status)) return <Badge variant="warning">Running</Badge>;
  return <Badge>{status}</Badge>;
}

export default function HistoryPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['transfers', page],
    queryFn: () => api.get<TransfersResp>(`/api/transfers?page=${page}&limit=20`),
  });

  const transfers = data?.transfers ?? [];
  const pagination = data?.pagination;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl mb-1">Transfer History</h1>
          <p className="text-text-secondary">
            {pagination ? `${pagination.total} total transfers` : 'All your past transfers'}
          </p>
        </div>
        <Link href="/dashboard/transfer/new">
          <Button variant="primary" size="md">New Transfer</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : transfers.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-secondary mb-4">No transfers yet</p>
          <Link href="/dashboard/transfer/new">
            <Button variant="primary">Start your first transfer</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {transfers.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
              >
                <Link href={`/dashboard/transfer/${t.id}`}>
                  <div className="p-4 rounded-2xl bg-surface border border-border hover:border-border/80 cursor-pointer transition-all group">
                    <div className="flex items-center gap-4">
                      {/* Platforms */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <PlatformIcon platform={t.sourcePlatform} size="sm" />
                        <ArrowRight className="h-3 w-3 text-text-secondary" />
                        <PlatformIcon platform={t.destinationPlatform} size="sm" />
                      </div>

                      {/* Playlist name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{t.sourcePlaylistName}</p>
                        <p className="text-xs text-text-secondary">
                          {PLATFORM_CONFIG[t.sourcePlatform]?.name} → {PLATFORM_CONFIG[t.destinationPlatform]?.name}
                          {' · '}
                          {new Date(t.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {t.status === 'COMPLETED' && (
                          <div className="text-right">
                            <p className="text-sm font-mono text-text-primary">{t.matchRate.toFixed(0)}%</p>
                            <p className="text-xs text-text-secondary">{t.matchedTracks}/{t.totalTracks}</p>
                          </div>
                        )}
                        <StatusBadge status={t.status} />
                        <ArrowRight className="h-4 w-4 text-text-secondary group-hover:text-text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-text-secondary">
                {page} / {pagination.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page === pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
