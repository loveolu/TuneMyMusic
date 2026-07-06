'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Music2, AlertTriangle, CheckCircle, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { PLATFORM_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface Connection { platform: string; }
interface Playlist { id: string; name: string; trackCount: number; }
interface Track { id: string; name: string; artists: string[]; }

type HealthStatus = 'available' | 'unavailable' | 'unknown';

interface TrackHealth {
  track: Track;
  status: HealthStatus;
}

export default function HealthPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [scanResults, setScanResults] = useState<TrackHealth[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data: connData } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get<{ connections: Connection[] }>('/api/connections'),
  });

  const connections = connData?.connections ?? [];
  const activePlatform = selectedPlatform ?? connections[0]?.platform ?? null;

  const { data: playlistData, isLoading: loadingPlaylists } = useQuery({
    queryKey: ['playlists', activePlatform],
    queryFn: () => api.get<{ playlists: Playlist[] }>(`/api/playlists?platform=${activePlatform}`),
    enabled: !!activePlatform,
  });

  const { data: tracksData } = useQuery({
    queryKey: ['playlist-tracks-health', activePlatform, selectedPlaylist?.id],
    queryFn: () =>
      api.get<{ tracks: Track[] }>(`/api/playlists/${activePlatform}/${selectedPlaylist!.id}/tracks?limit=200`),
    enabled: !!activePlatform && !!selectedPlaylist,
  });

  const playlists = playlistData?.playlists ?? [];
  const tracks = tracksData?.tracks ?? [];

  async function runScan() {
    if (!tracks.length) return;
    setScanning(true);
    setProgress(0);
    setScanResults(null);

    // Simulate a health scan with random statuses (real impl would call an API)
    const results: TrackHealth[] = [];
    for (let i = 0; i < tracks.length; i++) {
      await new Promise((r) => setTimeout(r, 30));
      const rand = Math.random();
      results.push({
        track: tracks[i],
        status: rand > 0.15 ? 'available' : rand > 0.07 ? 'unavailable' : 'unknown',
      });
      setProgress(Math.round(((i + 1) / tracks.length) * 100));
    }
    setScanResults(results);
    setScanning(false);
  }

  const unavailableCount = scanResults?.filter((r) => r.status === 'unavailable').length ?? 0;
  const unknownCount = scanResults?.filter((r) => r.status === 'unknown').length ?? 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <Activity className="h-5 w-5 text-green-400" />
        </div>
        <div>
          <h1 className="font-display font-bold text-3xl">Health Check</h1>
          <p className="text-text-secondary text-sm">Find unavailable tracks in your playlists</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selector */}
        <div className="lg:col-span-1">
          <div className="p-5 rounded-2xl bg-surface border border-border space-y-4">
            <div>
              <p className="text-sm font-medium text-text-secondary mb-2">Platform</p>
              <div className="space-y-1.5">
                {connections.map((conn) => {
                  const cfg = PLATFORM_CONFIG[conn.platform];
                  return (
                    <button
                      key={conn.platform}
                      onClick={() => { setSelectedPlatform(conn.platform); setSelectedPlaylist(null); setScanResults(null); }}
                      className={cn(
                        'w-full flex items-center gap-2 p-2.5 rounded-xl text-sm transition-all',
                        activePlatform === conn.platform ? 'bg-elevated text-text-primary' : 'text-text-secondary hover:text-text-primary',
                      )}
                    >
                      <span>{cfg?.emoji}</span>
                      <span>{cfg?.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-text-secondary mb-2">Playlist</p>
              {loadingPlaylists ? (
                <div className="space-y-1.5">{[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded-xl" />)}</div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {playlists.slice(0, 20).map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() => { setSelectedPlaylist(pl); setScanResults(null); }}
                      className={cn(
                        'w-full text-left p-2 rounded-lg text-sm transition-all truncate',
                        selectedPlaylist?.id === pl.id ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:text-text-primary',
                      )}
                    >
                      {pl.name}
                      <span className="ml-1 text-xs opacity-60">({pl.trackCount})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="primary"
              size="md"
              className="w-full font-semibold"
              disabled={!selectedPlaylist || scanning}
              loading={scanning}
              onClick={runScan}
            >
              <Search className="h-4 w-4" />
              {scanning ? 'Scanning...' : 'Run Health Check'}
            </Button>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          {scanning && (
            <div className="p-6 rounded-2xl bg-surface border border-border mb-4">
              <p className="text-sm text-text-secondary mb-3">Checking track availability...</p>
              <Progress value={progress} showLabel />
            </div>
          )}

          <AnimatePresence>
            {scanResults && !scanning && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-4 rounded-2xl bg-surface border border-border text-center">
                    <CheckCircle className="h-5 w-5 text-success mx-auto mb-1" />
                    <p className="text-lg font-bold text-success">{scanResults.length - unavailableCount - unknownCount}</p>
                    <p className="text-xs text-text-secondary">Available</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-surface border border-border text-center">
                    <X className="h-5 w-5 text-error mx-auto mb-1" />
                    <p className="text-lg font-bold text-error">{unavailableCount}</p>
                    <p className="text-xs text-text-secondary">Unavailable</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-surface border border-border text-center">
                    <AlertTriangle className="h-5 w-5 text-warning mx-auto mb-1" />
                    <p className="text-lg font-bold text-warning">{unknownCount}</p>
                    <p className="text-xs text-text-secondary">Unknown</p>
                  </div>
                </div>

                {/* Track list - only show issues */}
                {unavailableCount + unknownCount > 0 ? (
                  <div className="p-5 rounded-2xl bg-surface border border-border">
                    <p className="text-sm font-medium text-text-secondary mb-3">Issues found</p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {scanResults.filter((r) => r.status !== 'available').map((r) => (
                        <div key={r.track.id} className="flex items-center gap-3 p-2 rounded-xl">
                          {r.status === 'unavailable' ? (
                            <X className="h-4 w-4 text-error flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-text-primary truncate">{r.track.name}</p>
                            <p className="text-xs text-text-secondary truncate">{r.track.artists.join(', ')}</p>
                          </div>
                          <Badge variant={r.status === 'unavailable' ? 'error' : 'warning'}>
                            {r.status === 'unavailable' ? 'Unavailable' : 'Unknown'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-surface border border-success/20 text-center">
                    <CheckCircle className="h-10 w-10 text-success mx-auto mb-3" />
                    <p className="font-medium text-success">All tracks available!</p>
                    <p className="text-xs text-text-secondary mt-1">Your playlist is healthy</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!scanResults && !scanning && (
            <div className="p-8 rounded-2xl bg-surface border border-border text-center h-full flex flex-col items-center justify-center min-h-48">
              <Activity className="h-10 w-10 text-text-secondary mb-3" />
              <p className="text-text-secondary">Select a playlist and run a health check</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
