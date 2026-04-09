'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, X, AlertTriangle, RefreshCw, Filter } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { api } from '@/lib/api';
import { PLATFORM_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface TransferDetail {
  id: string;
  sourcePlatform: string;
  destinationPlatform: string;
  sourcePlaylistName: string;
  destinationPlaylistName?: string;
  status: string;
  totalTracks: number;
  processedTracks: number;
  matchedTracks: number;
  failedTracks: number;
  matchRate: number;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

interface TrackResult {
  id: string;
  sourceTrackName: string;
  sourceArtist: string;
  destinationTrackName?: string;
  destinationArtist?: string;
  status: 'MATCHED' | 'NOT_FOUND' | 'PARTIAL_MATCH' | 'SKIPPED' | 'FAILED';
  confidenceScore: number;
  matchMethod?: string;
}

interface SSEEvent {
  transferId: string;
  status: string;
  totalTracks: number;
  processedTracks: number;
  matchedTracks: number;
  failedTracks: number;
  matchRate: number;
  phase: 'FETCHING' | 'MATCHING' | 'IMPORTING' | 'DONE';
  currentTrack?: string;
}

const PHASE_LABELS = {
  FETCHING: 'Fetching tracks',
  MATCHING: 'Matching tracks',
  IMPORTING: 'Importing to destination',
  DONE: 'Complete',
};

const STATUS_TERMINAL = ['COMPLETED', 'FAILED', 'CANCELLED'];

function TrackStatusIcon({ status }: { status: string }) {
  if (status === 'MATCHED') return <Check className="h-4 w-4 text-success" />;
  if (status === 'PARTIAL_MATCH') return <AlertTriangle className="h-4 w-4 text-warning" />;
  if (status === 'NOT_FOUND' || status === 'FAILED') return <X className="h-4 w-4 text-error" />;
  return <div className="h-4 w-4 rounded-full border-2 border-border border-t-accent animate-spin" />;
}

function TrackStatusBadge({ status }: { status: string }) {
  if (status === 'MATCHED') return <Badge variant="success">Matched</Badge>;
  if (status === 'PARTIAL_MATCH') return <Badge variant="warning">Partial</Badge>;
  if (status === 'NOT_FOUND') return <Badge variant="error">Not Found</Badge>;
  if (status === 'FAILED') return <Badge variant="error">Failed</Badge>;
  if (status === 'SKIPPED') return <Badge variant="default">Skipped</Badge>;
  return <Badge>{status}</Badge>;
}

export default function TransferDetailPage() {
  const params = useParams<{ id: string }>();
  const { id } = params;

  const [liveProgress, setLiveProgress] = useState<SSEEvent | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [trackFilter, setTrackFilter] = useState<string>('ALL');
  const [liveTrackFeed, setLiveTrackFeed] = useState<string[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const { data: transferData, isLoading, refetch } = useQuery({
    queryKey: ['transfer', id],
    queryFn: () => api.get<{ transfer: TransferDetail }>(`/api/transfers/${id}`),
    refetchInterval: (query) => {
      const status = query.state.data?.transfer?.status;
      if (!status || STATUS_TERMINAL.includes(status)) return false;
      return 5000;
    },
  });

  const { data: tracksData, isLoading: loadingTracks, refetch: refetchTracks } = useQuery({
    queryKey: ['transfer-tracks', id, trackFilter],
    queryFn: () => {
      const filterParam = trackFilter !== 'ALL' ? `&status=${trackFilter}` : '';
      return api.get<{ tracks: TrackResult[]; pagination: { total: number } }>(
        `/api/transfers/${id}/tracks?page=1&limit=100${filterParam}`,
      );
    },
    enabled: !!transferData?.transfer,
  });

  const transfer = transferData?.transfer;
  const tracks = tracksData?.tracks ?? [];
  const progress = liveProgress ?? (transfer ? {
    processedTracks: transfer.processedTracks ?? 0,
    totalTracks: transfer.totalTracks ?? 0,
    matchedTracks: transfer.matchedTracks,
    failedTracks: transfer.failedTracks,
    matchRate: transfer.matchRate,
    phase: 'DONE' as const,
  } : null);

  const isRunning = transfer && !STATUS_TERMINAL.includes(transfer.status);

  // SSE connection
  useEffect(() => {
    if (!transfer || STATUS_TERMINAL.includes(transfer.status)) return;

    const token = api.getToken();
    const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/transfers/${id}/stream`;
    const es = new EventSource(url + (token ? `?token=${token}` : ''));
    esRef.current = es;
    setSseConnected(true);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;
        setLiveProgress(data);
        if (data.currentTrack) {
          setLiveTrackFeed((prev) => [data.currentTrack!, ...prev].slice(0, 20));
        }
        if (STATUS_TERMINAL.includes(data.status)) {
          es.close();
          setSseConnected(false);
          refetch();
          refetchTracks();
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      es.close();
      setSseConnected(false);
    };
  }, [id, transfer?.status, refetch, refetchTracks]);

  const pct = progress?.totalTracks
    ? Math.round((progress.processedTracks / progress.totalTracks) * 100)
    : transfer?.status === 'COMPLETED' ? 100 : 0;

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-16">
        <p className="text-text-secondary mb-4">Transfer not found</p>
        <Link href="/dashboard/history"><Button variant="secondary">View all transfers</Button></Link>
      </div>
    );
  }

  const srcCfg = PLATFORM_CONFIG[transfer.sourcePlatform];
  const dstCfg = PLATFORM_CONFIG[transfer.destinationPlatform];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/dashboard/history" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" />
        All transfers
      </Link>

      {/* Header card */}
      <motion.div
        className="p-6 rounded-2xl bg-surface border border-border mb-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Platform flow */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <PlatformIcon platform={transfer.sourcePlatform} size="lg" showName />
          </div>
          <motion.div
            className="flex items-center gap-2"
            animate={isRunning ? { x: [0, 4, 0] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <div className="h-px w-12 bg-gradient-to-r from-border to-accent" />
            <ArrowRight className="h-5 w-5 text-accent" />
            <div className="h-px w-12 bg-gradient-to-r from-accent to-border" />
          </motion.div>
          <div className="flex items-center gap-3">
            <PlatformIcon platform={transfer.destinationPlatform} size="lg" showName />
          </div>
        </div>

        <h1 className="font-display font-bold text-xl mb-2">{transfer.sourcePlaylistName}</h1>

        {/* Status */}
        <div className="flex items-center gap-3 mb-4">
          {transfer.status === 'COMPLETED' && <Badge variant="success">Completed</Badge>}
          {transfer.status === 'FAILED' && <Badge variant="error">Failed</Badge>}
          {transfer.status === 'CANCELLED' && <Badge variant="default">Cancelled</Badge>}
          {isRunning && (
            <Badge variant="warning" className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
              {liveProgress?.phase ? PHASE_LABELS[liveProgress.phase] : 'Processing'}
            </Badge>
          )}
          {sseConnected && (
            <span className="text-xs text-text-secondary flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse inline-block" />
              Live
            </span>
          )}
        </div>

        {/* Progress bar */}
        {(isRunning || transfer.status === 'COMPLETED') && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-secondary">
                {progress?.processedTracks ?? 0} / {progress?.totalTracks ?? transfer.totalTracks} tracks
              </span>
              <span className="font-mono text-accent">{pct}%</span>
            </div>
            <Progress value={pct} />
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-elevated text-center">
            <p className="text-xl font-display font-bold text-success">{transfer.matchedTracks}</p>
            <p className="text-xs text-text-secondary">Matched</p>
          </div>
          <div className="p-3 rounded-xl bg-elevated text-center">
            <p className="text-xl font-display font-bold text-error">{transfer.failedTracks}</p>
            <p className="text-xs text-text-secondary">Not Found</p>
          </div>
          <div className="p-3 rounded-xl bg-elevated text-center">
            <p className="text-xl font-display font-bold text-accent">{transfer.matchRate.toFixed(0)}%</p>
            <p className="text-xs text-text-secondary">Match Rate</p>
          </div>
        </div>

        {transfer.errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
            {transfer.errorMessage}
          </div>
        )}
      </motion.div>

      {/* Live track feed while running */}
      <AnimatePresence>
        {isRunning && liveTrackFeed.length > 0 && (
          <motion.div
            className="p-4 rounded-2xl bg-surface border border-border mb-6"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <p className="text-xs text-text-secondary font-mono mb-3 uppercase tracking-wider">Live feed</p>
            <div className="space-y-1.5 max-h-40 overflow-hidden">
              {liveTrackFeed.map((track, i) => (
                <motion.div
                  key={`${track}-${i}`}
                  className="text-sm text-text-secondary flex items-center gap-2"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1 - i * 0.1, x: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-accent flex-shrink-0" />
                  {track}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Track results table */}
      {!isRunning && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg">Track Results</h2>
            <div className="flex gap-2">
              {(['ALL', 'MATCHED', 'PARTIAL_MATCH', 'NOT_FOUND', 'FAILED'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTrackFilter(f)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                    trackFilter === f ? 'bg-accent text-base' : 'text-text-secondary hover:text-text-primary',
                  )}
                >
                  {f === 'ALL' ? 'All' : f === 'MATCHED' ? 'Matched' : f === 'PARTIAL_MATCH' ? 'Partial' : f === 'NOT_FOUND' ? 'Not Found' : 'Failed'}
                </button>
              ))}
            </div>
          </div>

          {loadingTracks ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">
              No tracks found for this filter
            </div>
          ) : (
            <div className="space-y-1">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface transition-colors"
                >
                  <TrackStatusIcon status={track.status} />
                  <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{track.sourceTrackName}</p>
                      <p className="text-xs text-text-secondary truncate">{track.sourceArtist}</p>
                    </div>
                    {track.destinationTrackName && (
                      <div className="min-w-0">
                        <p className="text-sm text-text-secondary truncate">{track.destinationTrackName}</p>
                        <p className="text-xs text-text-secondary truncate">{track.destinationArtist}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {track.confidenceScore > 0 && (
                      <span className="text-xs font-mono text-text-secondary">{track.confidenceScore}%</span>
                    )}
                    <TrackStatusBadge status={track.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Actions */}
      {transfer.status === 'FAILED' && (
        <div className="mt-6 flex gap-3">
          <Link href={`/dashboard/transfer/new`}>
            <Button variant="primary" size="md">
              <RefreshCw className="h-4 w-4" />
              Retry transfer
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
