import { View, Text, ScrollView, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { useAuthStore } from '../../../src/lib/store';
import { PLATFORM_CONFIG } from '../../../src/lib/constants';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { Badge } from '../../../src/components/Badge';

interface Connection {
  platform: string;
  connectedAt: string;
  displayName: string | null;
}

interface Transfer {
  id: string;
  sourcePlatform: string;
  destinationPlatform: string;
  sourcePlaylistName: string;
  status: string;
  totalTracks: number;
  matchedTracks: number;
  createdAt: string;
}

interface Stats {
  totalTransfers: number;
  totalTracksTransferred: number;
  connectedPlatforms: number;
  favoriteGenre: string | null;
}

const statusVariant = (status: string) => {
  switch (status) {
    case 'COMPLETED': return 'success' as const;
    case 'PROCESSING':
    case 'MATCHING':
    case 'IMPORTING': return 'warning' as const;
    case 'FAILED':
    case 'CANCELLED': return 'error' as const;
    default: return 'secondary' as const;
  }
};

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data: connections, isLoading: connectionsLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get<Connection[]>('/api/connections'),
  });

  const { data: transfers, isLoading: transfersLoading } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => api.get<Transfer[]>('/api/transfers?limit=5'),
  });

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get<Stats>('/api/stats'),
  });

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView className="flex-1 bg-base">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-5 pt-4 pb-6">
          <Text className="text-text-secondary text-sm mb-1">{greeting()},</Text>
          <Text className="text-text-primary text-2xl font-bold">
            {user?.name ?? user?.email?.split('@')[0] ?? 'Music Lover'} 👋
          </Text>
        </View>

        {/* Stats row */}
        {stats && (
          <View className="px-5 mb-6">
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-2xl p-4">
                <Text className="text-text-secondary text-xs mb-1">Transfers</Text>
                <Text className="text-text-primary text-2xl font-bold">{stats.totalTransfers}</Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4">
                <Text className="text-text-secondary text-xs mb-1">Tracks Moved</Text>
                <Text className="text-text-primary text-2xl font-bold">
                  {stats.totalTracksTransferred >= 1000
                    ? `${(stats.totalTracksTransferred / 1000).toFixed(1)}k`
                    : stats.totalTracksTransferred}
                </Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4">
                <Text className="text-text-secondary text-xs mb-1">Platforms</Text>
                <Text className="text-text-primary text-2xl font-bold">{stats.connectedPlatforms}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Connected platforms */}
        <View className="mb-6">
          <View className="px-5 flex-row justify-between items-center mb-3">
            <Text className="text-text-primary text-lg font-bold">Connected Platforms</Text>
            <Pressable onPress={() => router.push('/(tabs)/settings/connect')}>
              <Text className="text-accent text-sm font-medium">Manage</Text>
            </Pressable>
          </View>

          {connectionsLoading ? (
            <View className="px-5">
              <ActivityIndicator color="#E8FF47" />
            </View>
          ) : connections && connections.length > 0 ? (
            <FlatList
              data={connections}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              keyExtractor={(item) => item.platform}
              renderItem={({ item }) => {
                const config = PLATFORM_CONFIG[item.platform];
                if (!config) return null;
                return (
                  <View
                    className="bg-surface rounded-2xl p-4 items-center min-w-[90px]"
                    style={{ borderWidth: 1, borderColor: config.color + '40' }}
                  >
                    <Text className="text-3xl mb-2">{config.emoji}</Text>
                    <Text className="text-text-primary text-xs font-medium text-center" numberOfLines={2}>
                      {config.name}
                    </Text>
                    <View className="w-1.5 h-1.5 rounded-full bg-success mt-1.5" />
                  </View>
                );
              }}
            />
          ) : (
            <View className="px-5">
              <Card>
                <Text className="text-text-secondary text-center mb-3">
                  No platforms connected yet
                </Text>
                <Button
                  onPress={() => router.push('/(tabs)/settings/connect')}
                  variant="outline"
                  size="sm"
                  fullWidth
                >
                  Connect a platform
                </Button>
              </Card>
            </View>
          )}
        </View>

        {/* Quick Transfer CTA */}
        <View className="px-5 mb-6">
          <Pressable
            onPress={() => router.push('/(tabs)/transfer')}
            className="bg-accent rounded-2xl p-5 flex-row items-center justify-between"
          >
            <View>
              <Text className="text-base font-bold text-lg mb-0.5">Start New Transfer</Text>
              <Text className="text-base/70 text-sm">Move playlists between platforms</Text>
            </View>
            <Text className="text-3xl">⇄</Text>
          </Pressable>
        </View>

        {/* Recent transfers */}
        <View className="px-5 mb-8">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-text-primary text-lg font-bold">Recent Transfers</Text>
          </View>

          {transfersLoading ? (
            <ActivityIndicator color="#E8FF47" />
          ) : transfers && transfers.length > 0 ? (
            <View className="gap-3">
              {transfers.map((transfer) => {
                const src = PLATFORM_CONFIG[transfer.sourcePlatform];
                const dst = PLATFORM_CONFIG[transfer.destinationPlatform];
                const matchRate = transfer.totalTracks > 0
                  ? Math.round((transfer.matchedTracks / transfer.totalTracks) * 100)
                  : 0;

                return (
                  <Pressable
                    key={transfer.id}
                    onPress={() => {
                      if (transfer.status === 'PROCESSING' || transfer.status === 'MATCHING' || transfer.status === 'IMPORTING') {
                        router.push(`/(tabs)/transfer/progress/${transfer.id}`);
                      } else {
                        router.push(`/(tabs)/transfer/result/${transfer.id}`);
                      }
                    }}
                  >
                    <Card>
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-lg">{src?.emoji ?? '🎵'}</Text>
                          <Text className="text-text-secondary text-sm">→</Text>
                          <Text className="text-lg">{dst?.emoji ?? '🎵'}</Text>
                        </View>
                        <Badge variant={statusVariant(transfer.status)}>
                          {transfer.status}
                        </Badge>
                      </View>
                      <Text className="text-text-primary font-semibold mb-1" numberOfLines={1}>
                        {transfer.sourcePlaylistName}
                      </Text>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-text-secondary text-sm">
                          {transfer.totalTracks} tracks
                        </Text>
                        {transfer.status === 'COMPLETED' && (
                          <Text className="text-success text-sm font-medium">{matchRate}% matched</Text>
                        )}
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Card>
              <Text className="text-text-secondary text-center">No transfers yet</Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
