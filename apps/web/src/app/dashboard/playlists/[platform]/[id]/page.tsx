'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Music2, ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { api } from '@/lib/api';
import { PLATFORM_CONFIG } from '@/lib/constants';

interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackCount: number;
  imageUrl?: string;
  isPublic: boolean;
  ownerId: string;
}

interface Track {
  id: string;
  name: string;
  artists: string[];
  album?: string;
  durationMs?: number;
  isrc?: string;
  imageUrl?: string;
}

function formatDuration(ms: number) {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function PlaylistDetailPage() {
  const params = useParams<{ platform: string; id: string }>();
  const { platform, id } = params;
  const platformUpper = platform.toUpperCase();
  const cfg = PLATFORM_CONFIG[platformUpper];

  const { data: playlistData, isLoading: loadingPlaylist } = useQuery({
    queryKey: ['playlist', platform, id],
    queryFn: () => api.get<{ playlist: Playlist }>(`/api/playlists/${platformUpper}/${id}`),
  });

  const { data: tracksData, isLoading: loadingTracks } = useQuery({
    queryKey: ['playlist-tracks', platform, id],
    queryFn: () => api.get<{ tracks: Track[]; pagination: { total: number } }>(`/api/playlists/${platformUpper}/${id}/tracks?page=1&limit=100`),
  });

  const playlist = playlistData?.playlist;
  const tracks = tracksData?.tracks ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back */}
      <Link href="/dashboard/playlists" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to playlists
      </Link>

      {loadingPlaylist ? (
        <div className="flex gap-6 mb-8">
          <Skeleton className="h-36 w-36 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      ) : playlist ? (
        <motion.div
          className="flex flex-col sm:flex-row gap-6 mb-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Artwork */}
          <div
            className="h-36 w-36 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: cfg ? `${cfg.color}20` : '#1C1C1F' }}
          >
            {playlist.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={playlist.imageUrl} alt={playlist.name} className="w-full h-full object-cover" />
            ) : (
              <Music2 className="h-12 w-12 text-text-secondary" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <PlatformIcon platform={platformUpper} size="sm" showName />
            </div>
            <h1 className="font-display font-bold text-3xl mb-1">{playlist.name}</h1>
            {playlist.description && (
              <p className="text-text-secondary text-sm mb-3 line-clamp-2">{playlist.description}</p>
            )}
            <p className="text-text-secondary text-sm mb-4">{playlist.trackCount} tracks</p>

            <Link href={`/dashboard/transfer/new?source=${platformUpper}&playlist=${id}&name=${encodeURIComponent(playlist.name)}`}>
              <Button variant="primary" size="md" className="font-semibold">
                Transfer this playlist
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      ) : null}

      {/* Track list */}
      <div>
        <h2 className="font-display font-bold text-lg mb-4">Tracks</h2>
        {loadingTracks ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-1">
            {tracks.map((track, i) => (
              <motion.div
                key={track.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface transition-colors"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: i * 0.02 }}
              >
                <span className="text-xs text-text-secondary font-mono w-6 text-right flex-shrink-0">{i + 1}</span>
                <div
                  className="h-10 w-10 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
                  style={{ backgroundColor: cfg ? `${cfg.color}15` : '#1C1C1F' }}
                >
                  {track.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={track.imageUrl} alt={track.name} className="w-full h-full object-cover" />
                  ) : (
                    <Music2 className="h-4 w-4 text-text-secondary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{track.name}</p>
                  <p className="text-xs text-text-secondary truncate">{track.artists.join(', ')}</p>
                </div>
                {track.album && (
                  <p className="text-xs text-text-secondary truncate max-w-[140px] hidden md:block">{track.album}</p>
                )}
                {track.durationMs && (
                  <span className="text-xs text-text-secondary font-mono flex-shrink-0 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(track.durationMs)}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
