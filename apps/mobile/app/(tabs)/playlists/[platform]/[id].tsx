import { View, Text, ScrollView, Pressable, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../src/lib/api';
import { PLATFORM_CONFIG } from '../../../../src/lib/constants';
import { TrackItem } from '../../../../src/components/TrackItem';
import { Button } from '../../../../src/components/Button';

interface PlaylistDetail {
  id: string;
  name: string;
  description?: string;
  platform: string;
  trackCount: number;
  artworkUrl?: string;
  isPublic: boolean;
  owner?: string;
}

interface Track {
  id: string;
  name: string;
  artists: string[];
  album?: string;
  albumArtUrl?: string;
  durationMs?: number;
}

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function PlaylistDetailScreen() {
  const { platform, id } = useLocalSearchParams<{ platform: string; id: string }>();
  const router = useRouter();

  const { data: playlist, isLoading: playlistLoading } = useQuery({
    queryKey: ['playlist', platform, id],
    queryFn: () => api.get<PlaylistDetail>(`/api/playlists/${platform}/${id}`),
    enabled: !!platform && !!id,
  });

  const { data: tracks, isLoading: tracksLoading } = useQuery({
    queryKey: ['playlist-tracks', platform, id],
    queryFn: () => api.get<Track[]>(`/api/playlists/${platform}/${id}/tracks`),
    enabled: !!platform && !!id,
  });

  const platformConfig = platform ? PLATFORM_CONFIG[platform] : null;

  return (
    <SafeAreaView className="flex-1 bg-base">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <Pressable onPress={() => router.back()} className="px-5 pt-4 mb-2">
          <Text className="text-text-secondary">← Back</Text>
        </Pressable>

        {/* Artwork header */}
        {playlistLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator color="#E8FF47" size="large" />
          </View>
        ) : playlist ? (
          <>
            <View className="px-5 mb-6">
              {/* Artwork */}
              <View className="items-center mb-4">
                {playlist.artworkUrl ? (
                  <Image
                    source={{ uri: playlist.artworkUrl }}
                    className="w-48 h-48 rounded-2xl"
                  />
                ) : (
                  <View
                    className="w-48 h-48 rounded-2xl bg-elevated items-center justify-center"
                    style={platformConfig ? { borderWidth: 2, borderColor: platformConfig.color + '40' } : undefined}
                  >
                    <Text className="text-7xl">{platformConfig?.emoji ?? '🎵'}</Text>
                  </View>
                )}
              </View>

              {/* Info */}
              <Text className="text-text-primary text-2xl font-bold text-center mb-1">
                {playlist.name}
              </Text>
              {playlist.description && (
                <Text className="text-text-secondary text-center text-sm mb-2" numberOfLines={3}>
                  {playlist.description}
                </Text>
              )}
              <View className="flex-row items-center justify-center gap-2 mb-6">
                <Text className="text-sm">{platformConfig?.emoji}</Text>
                <Text className="text-text-secondary text-sm">{platformConfig?.name}</Text>
                <Text className="text-text-secondary">·</Text>
                <Text className="text-text-secondary text-sm">{playlist.trackCount} tracks</Text>
                {playlist.owner && (
                  <>
                    <Text className="text-text-secondary">·</Text>
                    <Text className="text-text-secondary text-sm">{playlist.owner}</Text>
                  </>
                )}
              </View>

              {/* Transfer CTA */}
              <Button
                onPress={() => router.push('/(tabs)/transfer')}
                size="lg"
                fullWidth
              >
                Transfer This Playlist
              </Button>
            </View>

            {/* Track list */}
            <View className="px-5 mb-8">
              <Text className="text-text-primary text-lg font-bold mb-3">
                Tracks ({playlist.trackCount})
              </Text>

              {tracksLoading ? (
                <ActivityIndicator color="#E8FF47" />
              ) : tracks && tracks.length > 0 ? (
                <View className="bg-surface rounded-2xl px-4 overflow-hidden">
                  {tracks.map((track, i) => (
                    <TrackItem
                      key={track.id || i}
                      name={track.name}
                      artist={track.artists.join(', ')}
                      album={track.album}
                      artworkUrl={track.albumArtUrl}
                    />
                  ))}
                </View>
              ) : (
                <View className="bg-surface rounded-2xl p-6 items-center">
                  <Text className="text-text-secondary">No tracks available</Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <View className="items-center py-16 px-5">
            <Text className="text-text-secondary text-center">Playlist not found</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
