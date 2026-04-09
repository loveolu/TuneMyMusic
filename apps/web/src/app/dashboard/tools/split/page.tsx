'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Scissors, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { api } from '@/lib/api';
import { PLATFORM_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface Connection { platform: string; }
interface Playlist { id: string; name: string; trackCount: number; }

type SplitMode = 'count' | 'genre' | 'decade';

export default function SplitPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [splitMode, setSplitMode] = useState<SplitMode>('count');
  const [tracksPerPart, setTracksPerPart] = useState(25);
  const [destPlatform, setDestPlatform] = useState('');

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

  const playlists = playlistData?.playlists ?? [];

  const estimatedParts = selectedPlaylist && splitMode === 'count'
    ? Math.ceil(selectedPlaylist.trackCount / tracksPerPart)
    : 3; // placeholder for genre/decade

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <Scissors className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h1 className="font-display font-bold text-3xl">Split Playlist</h1>
          <p className="text-text-secondary text-sm">Divide a large playlist into smaller parts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Select playlist */}
        <div className="lg:col-span-3">
          <div className="p-5 rounded-2xl bg-surface border border-border">
            <p className="text-sm font-medium text-text-secondary mb-3">Select playlist to split</p>

            {/* Platform tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {connections.map((conn) => {
                const cfg = PLATFORM_CONFIG[conn.platform];
                const isActive = activePlatform === conn.platform;
                return (
                  <button
                    key={conn.platform}
                    onClick={() => { setSelectedPlatform(conn.platform); setSelectedPlaylist(null); }}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0',
                      isActive ? 'text-base' : 'bg-elevated text-text-secondary hover:text-text-primary',
                    )}
                    style={isActive ? { backgroundColor: cfg?.color, color: '#0A0A0B' } : {}}
                  >
                    {cfg?.emoji} {cfg?.name}
                  </button>
                );
              })}
            </div>

            {loadingPlaylists ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {playlists.filter((p) => p.trackCount > 1).map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => setSelectedPlaylist(pl)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all',
                      selectedPlaylist?.id === pl.id ? 'bg-accent/10 border border-accent/30' : 'hover:bg-elevated',
                    )}
                  >
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: activePlatform ? `${PLATFORM_CONFIG[activePlatform]?.color}15` : '#1C1C1F' }}
                    >
                      <Music2 className="h-4 w-4 text-text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{pl.name}</p>
                      <p className="text-xs text-text-secondary">{pl.trackCount} tracks</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Split options */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-2xl bg-surface border border-border space-y-4">
            <div>
              <p className="text-sm font-medium text-text-secondary mb-2">Split mode</p>
              <div className="grid grid-cols-3 gap-2">
                {(['count', 'genre', 'decade'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSplitMode(mode)}
                    className={cn(
                      'p-2 rounded-xl border text-xs font-medium transition-all capitalize',
                      splitMode === mode ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-secondary hover:text-text-primary',
                    )}
                  >
                    {mode === 'count' ? 'By Count' : mode === 'genre' ? 'By Genre' : 'By Decade'}
                  </button>
                ))}
              </div>
            </div>

            {splitMode === 'count' && (
              <div>
                <div className="flex justify-between mb-2">
                  <p className="text-sm font-medium text-text-primary">Tracks per part</p>
                  <span className="text-sm font-mono text-accent">{tracksPerPart}</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={tracksPerPart}
                  onChange={(e) => setTracksPerPart(Number(e.target.value))}
                  className="w-full accent-[#E8FF47]"
                />
              </div>
            )}

            {selectedPlaylist && (
              <div className="p-3 rounded-xl bg-elevated border border-border">
                <p className="text-xs text-text-secondary mb-1">Preview</p>
                <p className="text-sm font-medium text-text-primary">
                  {selectedPlaylist.name} →{' '}
                  <span className="text-accent">{estimatedParts} parts</span>
                </p>
                <p className="text-xs text-text-secondary">
                  ~{Math.ceil(selectedPlaylist.trackCount / estimatedParts)} tracks each
                </p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-text-secondary mb-2">Destination</p>
              <div className="grid grid-cols-2 gap-2">
                {connections.map((conn) => {
                  const cfg = PLATFORM_CONFIG[conn.platform];
                  return (
                    <button
                      key={conn.platform}
                      onClick={() => setDestPlatform(conn.platform)}
                      className={cn(
                        'p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-all',
                        destPlatform === conn.platform ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-secondary',
                      )}
                    >
                      <span>{cfg?.emoji}</span>{cfg?.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full font-bold"
            disabled={!selectedPlaylist || !destPlatform}
          >
            <Scissors className="h-4 w-4" />
            Split into {estimatedParts} parts
          </Button>
        </div>
      </div>
    </div>
  );
}
