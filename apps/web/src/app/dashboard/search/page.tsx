'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Music2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { api } from '@/lib/api';
import { PLATFORM_CONFIG } from '@/lib/constants';

interface Connection { platform: string; }
interface Playlist { id: string; name: string; trackCount: number; }
interface PlaylistsResp { playlists: Playlist[] }

export default function SearchPage() {
  const [query, setQuery] = useState('');

  const { data: connData } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get<{ connections: Connection[] }>('/api/connections'),
  });

  const connections = connData?.connections ?? [];

  // Query playlists for all connected platforms, then filter client-side
  const platformQueries = connections.slice(0, 4); // limit for demo

  const { data: results, isLoading: searching } = useQuery({
    queryKey: ['search-playlists', query, connections.map(c => c.platform).join(',')],
    queryFn: async () => {
      if (!query.trim() || connections.length === 0) return [];
      const all: Array<{ platform: string; playlist: Playlist }> = [];
      await Promise.allSettled(
        connections.map(async (conn) => {
          try {
            const res = await api.get<PlaylistsResp>(`/api/playlists?platform=${conn.platform}`);
            const matches = res.playlists.filter((p) =>
              p.name.toLowerCase().includes(query.toLowerCase()),
            );
            matches.forEach((pl) => all.push({ platform: conn.platform, playlist: pl }));
          } catch {
            // ignore per-platform errors
          }
        }),
      );
      return all;
    },
    enabled: query.trim().length >= 2,
  });

  const hasResults = results && results.length > 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl mb-1">Search</h1>
        <p className="text-text-secondary">Search across all your connected platforms</p>
      </div>

      <div className="relative mb-8">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">
          <Search className="h-5 w-5" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for playlists across all platforms..."
          className="w-full h-14 pl-12 pr-4 rounded-2xl bg-surface border border-border text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-base transition-all"
          autoFocus
        />
        {searching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="h-5 w-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        )}
      </div>

      {/* Connected platforms hint */}
      {connections.length > 0 && !query && (
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs text-text-secondary">Searching across:</span>
          {connections.map((c) => (
            <PlatformIcon key={c.platform} platform={c.platform} size="sm" showName />
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {query.trim().length < 2 && query.length > 0 && (
          <motion.p
            key="hint"
            className="text-text-secondary text-sm text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            Keep typing to search...
          </motion.p>
        )}

        {query.trim().length >= 2 && !searching && !hasResults && (
          <motion.div
            key="empty"
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Search className="h-12 w-12 text-text-secondary mx-auto mb-3" />
            <p className="text-text-secondary">No playlists found for &quot;{query}&quot;</p>
          </motion.div>
        )}

        {hasResults && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="text-xs text-text-secondary mb-4">{results.length} result{results.length !== 1 ? 's' : ''} found</p>
            <div className="space-y-2">
              {results.map(({ platform, playlist }, i) => {
                const cfg = PLATFORM_CONFIG[platform];
                return (
                  <motion.div
                    key={`${platform}-${playlist.id}`}
                    className="flex items-center gap-3 p-4 rounded-2xl bg-surface border border-border hover:border-border/80 transition-all"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.04 }}
                  >
                    <div
                      className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${cfg?.color ?? '#888'}15` }}
                    >
                      <Music2 className="h-5 w-5 text-text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text-primary truncate">{playlist.name}</p>
                      <p className="text-xs text-text-secondary">{playlist.trackCount} tracks</p>
                    </div>
                    <PlatformIcon platform={platform} size="sm" showName />
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
