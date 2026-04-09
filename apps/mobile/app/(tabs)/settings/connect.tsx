import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import { api } from '../../../src/lib/api';
import { PLATFORM_CONFIG, ALL_PLATFORMS } from '../../../src/lib/constants';
import { Badge } from '../../../src/components/Badge';

const API_URL = 'http://localhost:3001';

interface Connection {
  platform: string;
  connectedAt: string;
  displayName: string | null;
}

interface OAuthResult {
  url: string;
}

export default function ConnectPlatformsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: connections, isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get<Connection[]>('/api/connections'),
  });

  const connectMutation = useMutation({
    mutationFn: async (platform: string) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const redirectUri = Linking.createURL('/oauth/callback');
      const result = await api.post<OAuthResult>('/api/connections/oauth/start', {
        platform,
        redirectUri,
      });

      const browserResult = await WebBrowser.openAuthSessionAsync(
        result.url,
        redirectUri
      );

      if (browserResult.type === 'success' && browserResult.url) {
        const url = new URL(browserResult.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        if (code) {
          await api.post('/api/connections/oauth/callback', { platform, code, state });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      Alert.alert('Connected!', 'Platform connected successfully');
    },
    onError: (err: Error) => {
      Alert.alert('Connection failed', err.message);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (platform: string) => {
      await api.delete(`/api/connections/${platform}`);
    },
    onSuccess: (_, platform) => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['playlists', platform] });
    },
    onError: (err: Error) => {
      Alert.alert('Disconnect failed', err.message);
    },
  });

  const handleDisconnect = (platform: string) => {
    const config = PLATFORM_CONFIG[platform];
    Alert.alert(
      `Disconnect ${config?.name ?? platform}`,
      'Are you sure? You will lose access to playlists from this platform.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => disconnectMutation.mutate(platform),
        },
      ]
    );
  };

  const connectedPlatformIds = new Set(connections?.map((c) => c.platform) ?? []);

  const platformsByTier = {
    'Tier 1 (Full Support)': ['SPOTIFY', 'APPLE_MUSIC', 'YOUTUBE_MUSIC', 'AMAZON_MUSIC', 'TIDAL'],
    'Tier 2': ['DEEZER', 'SOUNDCLOUD', 'PANDORA', 'QOBUZ', 'NAPSTER'],
    'Import / Export': ['LASTFM', 'CSV', 'ITUNES_XML'],
  };

  return (
    <SafeAreaView className="flex-1 bg-base">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-5 pt-4 pb-4">
          <Pressable onPress={() => router.back()} className="mb-4">
            <Text className="text-text-secondary">← Back</Text>
          </Pressable>
          <Text className="text-text-primary text-2xl font-bold mb-1">Connected Platforms</Text>
          <Text className="text-text-secondary text-sm">
            Connect your music streaming services to enable transfers
          </Text>
        </View>

        {/* Connected count */}
        {!isLoading && (
          <View className="px-5 mb-4">
            <View className="bg-surface rounded-2xl p-4 flex-row items-center gap-3">
              <Text className="text-3xl">🔗</Text>
              <View>
                <Text className="text-text-primary font-bold text-lg">
                  {connections?.length ?? 0} Connected
                </Text>
                <Text className="text-text-secondary text-sm">
                  {ALL_PLATFORMS.length - (connections?.length ?? 0)} more available
                </Text>
              </View>
            </View>
          </View>
        )}

        {isLoading ? (
          <View className="items-center py-12">
            <ActivityIndicator color="#E8FF47" size="large" />
          </View>
        ) : (
          Object.entries(platformsByTier).map(([tierLabel, platforms]) => (
            <View key={tierLabel} className="px-5 mb-6">
              <Text className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3 px-1">
                {tierLabel}
              </Text>
              <View className="bg-surface rounded-2xl overflow-hidden">
                {platforms.map((platformId, i) => {
                  const config = PLATFORM_CONFIG[platformId];
                  const isConnected = connectedPlatformIds.has(platformId);
                  const connection = connections?.find((c) => c.platform === platformId);
                  const isLoading =
                    connectMutation.isPending || disconnectMutation.isPending;

                  return (
                    <View
                      key={platformId}
                      className={`flex-row items-center px-4 py-4 ${
                        i < platforms.length - 1 ? 'border-b border-border/50' : ''
                      }`}
                    >
                      {/* Platform icon + name */}
                      <View
                        className="w-12 h-12 rounded-xl bg-elevated items-center justify-center mr-3"
                        style={{ borderWidth: 1, borderColor: (config?.color ?? '#2A2A2E') + '40' }}
                      >
                        <Text className="text-2xl">{config?.emoji ?? '🎵'}</Text>
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-text-primary font-medium">
                            {config?.name ?? platformId}
                          </Text>
                          {isConnected && (
                            <Badge variant="success">Connected</Badge>
                          )}
                        </View>
                        {connection?.displayName && (
                          <Text className="text-text-secondary text-sm mt-0.5">
                            {connection.displayName}
                          </Text>
                        )}
                      </View>

                      {/* Connect/Disconnect button */}
                      <Pressable
                        onPress={() =>
                          isConnected
                            ? handleDisconnect(platformId)
                            : connectMutation.mutate(platformId)
                        }
                        disabled={isLoading}
                        className={`px-4 py-2 rounded-xl ${
                          isConnected
                            ? 'bg-elevated border border-error/30'
                            : 'bg-accent'
                        }`}
                      >
                        <Text
                          className={`text-sm font-semibold ${
                            isConnected ? 'text-error' : 'text-base'
                          }`}
                        >
                          {isConnected ? 'Disconnect' : 'Connect'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
