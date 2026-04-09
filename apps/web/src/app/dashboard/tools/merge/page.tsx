'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { GitMerge, Plus, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { api } from '@/lib/api';
import { PLATFORM_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface Connection { platform: string; }
interface Playlist { id: string; name: string; trackCount: number; platform?: string; }

export default function MergePage() {
  const [selectedPlaylists, setSelectedPlaylists] = useState<Array<{ platform: string; playlist: Playlist }>>([]);
  const [newName, setNewName] = useState('');
  const [destPlatform, setDestPlatform] = useState('');
  const [deduplicate, setDeduplicate] = useState(true);
  const [activePlatformTab, setActivePlatformTab] = useState<string | null>(null);

  const { data: connData } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get<{ connections: Connection[] }>('/api/connections'),
  });

  const connections = connData?.connections ?? [];
  const selectedPlatformForBrowse = activePlatformTab ?? connections[0]?.platform ?? null;

  const { data: playlistData, isLoading: loadingPlaylists } = useQuery({
    queryKey: ['playlists', selectedPlatformForBrowse],
    queryFn: () => api.get<{ playlists: Playlist[] }>(`/api/playlists?platform=${selectedPlatformForBrowse}`),
    enabled: !!selectedPlatformForBrowse,
  });

  const playlists = playlistData?.playlists ?? [];
  const totalTracks = selectedPlaylists.reduce((sum, { playlist }) => sum + playlist.trackCount, 0);
  const estimatedAfterDedup = deduplicate ? Math.round(totalTracks * 0.9) : totalTracks;

  function togglePlaylist(platform: string, playlist: Playlist) {
    const exists = selectedPlaylists.some((s) => s.playlist.id === playlist.id && s.platform === platform);
    if (exists) {
      setSelectedPlaylists((prev) => prev.filter((s) => !(s.playlist.id === playlist.id && s.platform === platform)));
    } else {
      setSelectedPlaylists((prev) => [...prev, { platform, playlist }]);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <GitMerge className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h1 className="font-display font-bold text-3xl">Merge Playlists</h1>
          <p className="text-text-secondary text-sm">Combine multiple playlists into one</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: playlist browser */}
        <div className="lg:col-span-3">
          <div className="p-5 rounded-2xl bg-surface border border-border">
            <p className="text-sm font-medium text-text-secondary mb-3">Select playlists to merge</p>

            {/* Platform tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {connections.map((conn) => {
                const cfg = PLATFORM_CONFIG[conn.platform];
                const isActive = selectedPlatformForBrowse === conn.platform;
                return (
                  <button
                    key={conn.platform}
                    onClick={() => setActivePlatformTab(conn.platform)}
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
              <div className="space-y-2">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {playlists.map((pl) => {
                  const selected = selectedPlaylists.some(
                    (s) => s.playlist.id === pl.id && s.platform === selectedPlatformForBrowse!,
                  );
                  return (
                    <button
                      key={pl.id}
                      onClick={() => togglePlaylist(selectedPlatformForBrowse!, pl)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all',
                        selected ? 'bg-accent/10 border border-accent/30' : 'hover:bg-elevated',
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{pl.name}</p>
                        <p className="text-xs text-text-secondary">{pl.trackCount} tracks</p>
                      </div>
                      {selected ? (
                        <div className="h-5 w-5 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                          <X className="h-3 w-3 text-base" />
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-full border border-border flex items-center justify-center flex-shrink-0">
                          <Plus className="h-3 w-3 text-text-secondary" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: merge config */}
        <div className="lg:col-span-2 space-y-4">
          {/* Selected */}
          <div className="p-5 rounded-2xl bg-surface border border-border">
            <p className="text-sm font-medium text-text-secondary mb-3">
              Selected ({selectedPlaylists.length})
            </p>
            {selectedPlaylists.length === 0 ? (
              <p className="text-xs text-text-secondary text-center py-4">
                Select 2+ playlists to merge
              </p>
            ) : (
              <div className="space-y-2">
                {selectedPlaylists.map(({ platform, playlist }) => (
                  <div key={`${platform}-${playlist.id}`} className="flex items-center gap-2">
                    <PlatformIcon platform={platform} size="sm" />
                    <span className="text-xs text-text-primary flex-1 truncate">{playlist.name}</span>
                    <span className="text-xs text-text-secondary">{playlist.trackCount}</span>
                    <button onClick={() => togglePlaylist(platform, playlist)}>
                      <X className="h-3 w-3 text-text-secondary hover:text-error transition-colors" />
                    </button>
                  </div>
                ))}
                <div className="border-t border-border pt-2">
                  <p className="text-xs text-text-secondary">
                    ~{estimatedAfterDedup} tracks after {deduplicate ? 'dedup' : 'merge'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Options */}
          <div className="p-5 rounded-2xl bg-surface border border-border space-y-4">
            <Input
              label="New playlist name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="My merged playlist"
            />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">Remove duplicates</p>
                <p className="text-xs text-text-secondary">Skip tracks that appear in multiple playlists</p>
              </div>
              <button
                onClick={() => setDeduplicate(!deduplicate)}
                className={cn('h-6 w-11 rounded-full transition-colors relative', deduplicate ? 'bg-accent' : 'bg-border')}
              >
                <div className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', deduplicate ? 'left-5.5 translate-x-0.5' : 'left-0.5')} />
              </button>
            </div>

            <div>
              <p className="text-sm font-medium text-text-secondary mb-2">Destination platform</p>
              <div className="grid grid-cols-2 gap-2">
                {connections.map((conn) => {
                  const cfg = PLATFORM_CONFIG[conn.platform];
                  return (
                    <button
                      key={conn.platform}
                      onClick={() => setDestPlatform(conn.platform)}
                      className={cn(
                        'p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-all',
                        destPlatform === conn.platform ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-secondary hover:text-text-primary',
                      )}
                    >
                      <span>{cfg?.emoji}</span>
                      {cfg?.name}
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
            disabled={selectedPlaylists.length < 2 || !newName.trim() || !destPlatform}
          >
            <GitMerge className="h-4 w-4" />
            Merge {selectedPlaylists.length} playlists
          </Button>
        </div>
      </div>
    </div>
  );
}
