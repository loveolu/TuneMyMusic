'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Trash2, Check, Music2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { api } from '@/lib/api';
import { PLATFORM_CONFIG } from '@/lib/constants';

interface Connection { platform: string; }
interface Track { id: string; name: string; artists: string[]; }
interface DuplicateGroup { key: string; tracks: Array<{ track: Track; playlist: string; platform: string; }>; }

export default function DuplicatesPage() {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[] | null>(null);
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  const { data: connData } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get<{ connections: Connection[] }>('/api/connections'),
  });

  const connections = connData?.connections ?? [];

  async function runScan() {
    if (!connections.length) return;
    setScanning(true);
    setProgress(0);
    setDuplicates(null);

    // Collect all tracks from all connected platforms
    const allTracks: Array<{ track: Track; playlist: string; platform: string }> = [];

    for (let i = 0; i < connections.length; i++) {
      setProgress(Math.round((i / connections.length) * 60));
      try {
        const playlists = await api.get<{ playlists: Array<{ id: string; name: string }> }>(
          `/api/playlists?platform=${connections[i].platform}`,
        );
        for (const pl of playlists.playlists.slice(0, 3)) {
          const tracks = await api.get<{ tracks: Track[] }>(
            `/api/playlists/${connections[i].platform}/${pl.id}/tracks?limit=50`,
          );
          tracks.tracks.forEach((t) =>
            allTracks.push({ track: t, playlist: pl.name, platform: connections[i].platform }),
          );
        }
      } catch {
        // continue
      }
    }

    setProgress(80);

    // Find duplicates by normalized name+artist
    const groups = new Map<string, typeof allTracks>();
    for (const item of allTracks) {
      const key = `${item.track.name.toLowerCase().trim()}__${item.track.artists[0]?.toLowerCase().trim() ?? ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    const dupGroups: DuplicateGroup[] = [];
    groups.forEach((items, key) => {
      if (items.length > 1) {
        dupGroups.push({ key, tracks: items });
      }
    });

    setProgress(100);
    setDuplicates(dupGroups);
    setScanning(false);
  }

  function removeDuplicate(key: string) {
    setRemoving((prev) => new Set([...prev, key]));
    setTimeout(() => {
      setDuplicates((prev) => prev?.filter((d) => d.key !== key) ?? null);
      setRemoving((prev) => { const n = new Set(prev); n.delete(key); return n; });
    }, 600);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <Copy className="h-5 w-5 text-orange-400" />
        </div>
        <div>
          <h1 className="font-display font-bold text-3xl">Duplicate Finder</h1>
          <p className="text-text-secondary text-sm">Find and remove duplicate tracks across your playlists</p>
        </div>
      </div>

      {/* Scan section */}
      <div className="p-6 rounded-2xl bg-surface border border-border mb-6">
        <p className="text-sm text-text-secondary mb-4">
          Scans playlists across all {connections.length} connected platform{connections.length !== 1 ? 's' : ''} for duplicate tracks.
        </p>

        {scanning && (
          <div className="mb-4">
            <p className="text-xs text-text-secondary mb-2">Scanning playlists...</p>
            <Progress value={progress} showLabel />
          </div>
        )}

        <Button
          variant="primary"
          size="md"
          loading={scanning}
          disabled={connections.length === 0}
          onClick={runScan}
        >
          <Search className="h-4 w-4" />
          {scanning ? 'Scanning...' : 'Scan for duplicates'}
        </Button>
      </div>

      {/* Results */}
      <AnimatePresence>
        {duplicates !== null && !scanning && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg">
                {duplicates.length === 0 ? 'No duplicates found!' : `${duplicates.length} duplicate group${duplicates.length !== 1 ? 's' : ''} found`}
              </h2>
              {duplicates.length > 0 && (
                <Badge variant="warning">{duplicates.reduce((sum, d) => sum + d.tracks.length - 1, 0)} extra copies</Badge>
              )}
            </div>

            {duplicates.length === 0 ? (
              <div className="p-8 rounded-2xl bg-surface border border-success/20 text-center">
                <Check className="h-10 w-10 text-success mx-auto mb-3" />
                <p className="font-medium text-success">Your library is clean!</p>
                <p className="text-xs text-text-secondary mt-1">No duplicate tracks found across your playlists</p>
              </div>
            ) : (
              <div className="space-y-3">
                {duplicates.map((group) => (
                  <AnimatePresence key={group.key}>
                    {!removing.has(group.key) && (
                      <motion.div
                        className="p-4 rounded-2xl bg-surface border border-border"
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="font-medium text-text-primary">{group.tracks[0].track.name}</p>
                            <p className="text-xs text-text-secondary">{group.tracks[0].track.artists.join(', ')}</p>
                          </div>
                          <Badge variant="warning">{group.tracks.length}x</Badge>
                        </div>
                        <div className="space-y-1.5 mb-3">
                          {group.tracks.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-text-secondary">
                              <PlatformIcon platform={item.platform} size="sm" />
                              <span className="truncate">{item.playlist}</span>
                            </div>
                          ))}
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeDuplicate(group.key)}
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove {group.tracks.length - 1} duplicate{group.tracks.length - 1 !== 1 ? 's' : ''}
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
