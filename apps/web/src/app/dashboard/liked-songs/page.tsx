'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Heart, Music2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { api } from '@/lib/api';
import { PLATFORM_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface Connection { platform: string; }
interface Track {
  id: string;
  name: string;
  artists: string[];
  album?: string;
  durationMs?: number;
}

export default function LikedSongsPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  const { data: connData, isLoading: loadingConn } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get<{ connections: Connection[] }>('/api/connections'),
  });

  const connections = connData?.connections ?? [];
  const activePlatform = selectedPlatform ?? connections[0]?.platform ?? null;

  const { data: tracksData, isLoading: loadingTracks } = useQuery({
    queryKey: ['liked-songs', activePlatform],
    queryFn: () =>
      api.get<{ tracks: Track[]; pagination: { total: number } }>(
        `/api/playlists/liked?platform=${activePlatform}&limit=100`,
      ),
    enabled: !!activePlatform,
  });

  const tracks = tracksData?.tracks ?? [];
  const total = tracksData?.pagination?.total ?? 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-error/10 border border-error/20 flex items-center justify-center">
          <Heart className="h-5 w-5 text-error" />
        </div>
        <div>
          <h1 className="font-display font-bold text-3xl">Liked Songs</h1>
          <p className="text-text-secondary text-sm">Your liked / saved songs across platforms</p>
        </div>
      </div>

      {/* Platform tabs */}
      {loadingConn ? (
        <div className="flex gap-2 mb-6">
          {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-28 rounded-xl" />)}
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-secondary">No platforms connected</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {connections.map((conn) => {
              const cfg = PLATFORM_CONFIG[conn.platform];
              const isActive = activePlatform === conn.platform;
              return (
                <button
                  key={conn.platform}
                  onClick={() => setSelectedPlatform(conn.platform)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0',
                    isActive ? 'text-base' : 'bg-surface border border-border text-text-secondary hover:text-text-primary',
                  )}
                  style={isActive ? { backgroundColor: cfg?.color, color: '#0A0A0B' } : {}}
                >
                  <span>{cfg?.emoji}</span>
                  {cfg?.name}
                </button>
              );
            })}
          </div>

          {activePlatform && (
            <p className="text-sm text-text-secondary mb-4">
              {loadingTracks ? 'Loading...' : `${total} liked songs on ${PLATFORM_CONFIG[activePlatform]?.name}`}
            </p>
          )}

          {loadingTracks ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="h-12 w-12 text-text-secondary mx-auto mb-3" />
              <p className="text-text-secondary">No liked songs found on this platform</p>
            </div>
          ) : (
            <div className="space-y-1">
              {tracks.map((track, i) => (
                <motion.div
                  key={track.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface transition-colors"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.01 }}
                >
                  <span className="text-xs text-text-secondary font-mono w-6 text-right">{i + 1}</span>
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: activePlatform ? `${PLATFORM_CONFIG[activePlatform]?.color}15` : '#1C1C1F' }}
                  >
                    <Music2 className="h-4 w-4 text-text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{track.name}</p>
                    <p className="text-xs text-text-secondary truncate">{track.artists.join(', ')}</p>
                  </div>
                  {track.album && (
                    <p className="text-xs text-text-secondary truncate max-w-[140px] hidden md:block">{track.album}</p>
                  )}
                  <Heart className="h-4 w-4 text-error flex-shrink-0" />
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
