'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Music2, ListMusic } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { api } from '@/lib/api';
import { PLATFORM_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface Connection {
  id: string;
  platform: string;
  platformUsername: string;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackCount: number;
  imageUrl?: string;
  isPublic: boolean;
  ownerId: string;
}

function PlaylistCard({ playlist, platform }: { playlist: Playlist; platform: string }) {
  const cfg = PLATFORM_CONFIG[platform];
  return (
    <Link href={`/dashboard/playlists/${platform}/${playlist.id}`}>
      <motion.div
        className="group p-4 rounded-2xl bg-surface border border-border hover:border-border/80 transition-all duration-200 cursor-pointer flex flex-col gap-3"
        whileHover={{ y: -2 }}
      >
        {/* Artwork placeholder */}
        <div
          className="aspect-square rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: cfg ? `${cfg.color}15` : '#1C1C1F' }}
        >
          {playlist.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={playlist.imageUrl} alt={playlist.name} className="w-full h-full object-cover" />
          ) : (
            <Music2 className="h-8 w-8 text-text-secondary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-text-primary text-sm truncate">{playlist.name}</p>
          {playlist.description && (
            <p className="text-xs text-text-secondary truncate mt-0.5">{playlist.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <PlatformIcon platform={platform} size="sm" />
            <span className="text-xs text-text-secondary">{playlist.trackCount} tracks</span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function PlaylistsPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: connectData, isLoading: loadingConn } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get<{ connections: Connection[] }>('/api/connections'),
  });

  const connections = connectData?.connections ?? [];
  const activePlatform = selectedPlatform ?? connections[0]?.platform ?? null;

  const { data: playlistData, isLoading: loadingPlaylists } = useQuery({
    queryKey: ['playlists', activePlatform],
    queryFn: () => api.get<{ playlists: Playlist[] }>(`/api/playlists?platform=${activePlatform}`),
    enabled: !!activePlatform,
  });

  const playlists = playlistData?.playlists ?? [];
  const filtered = search.trim()
    ? playlists.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : playlists;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display font-bold text-3xl mb-2">Your Playlists</h1>
        <p className="text-text-secondary">Browse playlists from your connected platforms</p>
      </div>

      {/* Platform tabs */}
      {loadingConn ? (
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-28 rounded-xl" />)}
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-secondary mb-4">No platforms connected yet</p>
          <Link href="/dashboard/connect" className="text-accent hover:text-accent-dim">
            Connect a platform →
          </Link>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {connections.map((conn) => {
              const cfg = PLATFORM_CONFIG[conn.platform];
              const isActive = activePlatform === conn.platform;
              return (
                <button
                  key={conn.platform}
                  onClick={() => setSelectedPlatform(conn.platform)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0',
                    isActive
                      ? 'text-base'
                      : 'bg-surface border border-border text-text-secondary hover:text-text-primary',
                  )}
                  style={isActive ? { backgroundColor: cfg?.color, color: '#0A0A0B' } : {}}
                >
                  <span>{cfg?.emoji}</span>
                  {cfg?.name ?? conn.platform}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="mb-6 max-w-sm">
            <Input
              placeholder="Search playlists..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Grid */}
          {loadingPlaylists ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <ListMusic className="h-12 w-12 text-text-secondary mx-auto mb-4" />
              <p className="text-text-secondary">
                {search ? `No playlists matching "${search}"` : 'No playlists found on this platform'}
              </p>
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.04 } } }}
            >
              <AnimatePresence>
                {filtered.map((pl) => (
                  <motion.div
                    key={pl.id}
                    variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}
                  >
                    <PlaylistCard playlist={pl} platform={activePlatform!} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
