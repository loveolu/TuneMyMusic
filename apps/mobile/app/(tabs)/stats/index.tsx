import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { PLATFORM_CONFIG } from '../../../src/lib/constants';
import { Card } from '../../../src/components/Card';

interface MusicStats {
  totalTransfers: number;
  totalTracksTransferred: number;
  connectedPlatforms: number;
  averageMatchRate: number;
  favoriteGenre: string | null;
  topArtists: Array<{ name: string; count: number }>;
  topTracks: Array<{ name: string; artist: string; count: number }>;
  topGenres: Array<{ name: string; count: number; percentage: number }>;
  platformUsage: Array<{ platform: string; transferCount: number; trackCount: number }>;
  monthlyActivity: Array<{ month: string; transfers: number; tracks: number }>;
}

function StatCard({ label, value, subtitle }: { label: string; value: string | number; subtitle?: string }) {
  return (
    <View className="flex-1 bg-surface rounded-2xl p-4">
      <Text className="text-text-secondary text-xs mb-1">{label}</Text>
      <Text className="text-text-primary text-2xl font-bold">{value}</Text>
      {subtitle && <Text className="text-text-secondary text-xs mt-0.5">{subtitle}</Text>}
    </View>
  );
}

export default function StatsScreen() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['music-stats'],
    queryFn: () => api.get<MusicStats>('/api/stats'),
  });

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-base items-center justify-center">
        <ActivityIndicator color="#E8FF47" size="large" />
        <Text className="text-text-secondary mt-3">Loading your music stats...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-base">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-4 pb-6">
          <Text className="text-text-primary text-2xl font-bold mb-1">Music Stats</Text>
          <Text className="text-text-secondary text-sm">Your listening & transfer insights</Text>
        </View>

        {/* Overview stats */}
        <View className="px-5 mb-6">
          <View className="flex-row gap-3 mb-3">
            <StatCard
              label="Total Transfers"
              value={stats?.totalTransfers ?? 0}
            />
            <StatCard
              label="Tracks Moved"
              value={
                (stats?.totalTracksTransferred ?? 0) >= 1000
                  ? `${((stats?.totalTracksTransferred ?? 0) / 1000).toFixed(1)}k`
                  : stats?.totalTracksTransferred ?? 0
              }
            />
          </View>
          <View className="flex-row gap-3">
            <StatCard
              label="Avg Match Rate"
              value={`${Math.round(stats?.averageMatchRate ?? 0)}%`}
              subtitle="Across all transfers"
            />
            <StatCard
              label="Platforms"
              value={stats?.connectedPlatforms ?? 0}
              subtitle="Connected"
            />
          </View>
        </View>

        {/* Favorite genre */}
        {stats?.favoriteGenre && (
          <View className="px-5 mb-6">
            <Card>
              <View className="flex-row items-center gap-3">
                <Text className="text-3xl">🎸</Text>
                <View>
                  <Text className="text-text-secondary text-sm">Your Favorite Genre</Text>
                  <Text className="text-text-primary text-xl font-bold">{stats.favoriteGenre}</Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Top genres */}
        {stats?.topGenres && stats.topGenres.length > 0 && (
          <View className="px-5 mb-6">
            <Text className="text-text-primary text-lg font-bold mb-3">Top Genres</Text>
            <Card>
              <View className="gap-3">
                {stats.topGenres.slice(0, 5).map((genre, i) => (
                  <View key={genre.name}>
                    <View className="flex-row justify-between mb-1.5">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-text-secondary text-sm w-5">{i + 1}</Text>
                        <Text className="text-text-primary font-medium">{genre.name}</Text>
                      </View>
                      <Text className="text-text-secondary text-sm">{genre.percentage}%</Text>
                    </View>
                    <View className="h-1.5 bg-elevated rounded-full overflow-hidden">
                      <View
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${genre.percentage}%` }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        )}

        {/* Top artists */}
        {stats?.topArtists && stats.topArtists.length > 0 && (
          <View className="px-5 mb-6">
            <Text className="text-text-primary text-lg font-bold mb-3">Top Artists</Text>
            <Card>
              <View className="gap-3">
                {stats.topArtists.slice(0, 5).map((artist, i) => (
                  <View key={artist.name} className="flex-row items-center gap-3">
                    <View className="w-8 h-8 rounded-full bg-elevated items-center justify-center">
                      <Text className="text-text-secondary text-sm font-bold">{i + 1}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-text-primary font-medium">{artist.name}</Text>
                    </View>
                    <Text className="text-text-secondary text-sm">
                      {artist.count} {artist.count === 1 ? 'track' : 'tracks'}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        )}

        {/* Top tracks */}
        {stats?.topTracks && stats.topTracks.length > 0 && (
          <View className="px-5 mb-6">
            <Text className="text-text-primary text-lg font-bold mb-3">Most Transferred Tracks</Text>
            <Card>
              <View className="gap-3">
                {stats.topTracks.slice(0, 5).map((track, i) => (
                  <View key={i} className="flex-row items-center gap-3">
                    <View className="w-8 h-8 rounded-full bg-elevated items-center justify-center">
                      <Text className="text-text-secondary text-sm font-bold">{i + 1}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-text-primary font-medium" numberOfLines={1}>
                        {track.name}
                      </Text>
                      <Text className="text-text-secondary text-sm">{track.artist}</Text>
                    </View>
                    <Text className="text-accent text-sm font-semibold">
                      ×{track.count}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        )}

        {/* Platform comparison */}
        {stats?.platformUsage && stats.platformUsage.length > 0 && (
          <View className="px-5 mb-8">
            <Text className="text-text-primary text-lg font-bold mb-3">Platform Usage</Text>
            <Card>
              <View className="gap-4">
                {stats.platformUsage.map((usage) => {
                  const config = PLATFORM_CONFIG[usage.platform];
                  return (
                    <View key={usage.platform} className="flex-row items-center gap-3">
                      <Text className="text-2xl">{config?.emoji ?? '🎵'}</Text>
                      <View className="flex-1">
                        <Text className="text-text-primary font-medium">{config?.name ?? usage.platform}</Text>
                        <Text className="text-text-secondary text-sm">
                          {usage.transferCount} transfers · {usage.trackCount} tracks
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          </View>
        )}

        {/* Empty state */}
        {!stats?.totalTransfers && (
          <View className="px-5 mb-8 items-center">
            <Card>
              <View className="py-8 items-center">
                <Text className="text-5xl mb-4">📊</Text>
                <Text className="text-text-primary text-lg font-bold mb-2">No stats yet</Text>
                <Text className="text-text-secondary text-center">
                  Complete your first transfer to see your music stats
                </Text>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
