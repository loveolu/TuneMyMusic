import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { PLATFORM_CONFIG } from '../../../src/lib/constants';

interface Connection {
  platform: string;
}

interface Playlist {
  id: string;
  name: string;
  trackCount: number;
  artworkUrl?: string;
  description?: string;
  platform: string;
}

export default function PlaylistsScreen() {
  const router = useRouter();
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: connections } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get<Connection[]>('/api/connections'),
  });

  const { data: playlists, isLoading } = useQuery({
    queryKey: ['all-playlists', selectedPlatform],
    queryFn: () =>
      api.get<Playlist[]>(
        selectedPlatform ? `/api/playlists/${selectedPlatform}` : '/api/playlists'
      ),
    enabled: !!(connections && connections.length > 0),
  });

  const connectedPlatforms = connections?.map((c) => c.platform) ?? [];

  const filteredPlaylists = playlists?.filter((p) =>
    searchQuery
      ? p.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  ) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-base">
      <View className="flex-1">
        {/* Header */}
        <View className="px-5 pt-4 pb-3">
          <Text className="text-text-primary text-2xl font-bold mb-4">Your Playlists</Text>

          {/* Search bar */}
          <View className="bg-elevated rounded-xl flex-row items-center px-4 mb-4 border border-border">
            <Text className="text-text-secondary mr-2">🔍</Text>
            <TextInput
              className="flex-1 text-text-primary py-3"
              placeholder="Search playlists..."
              placeholderTextColor="#8A8A8F"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Text className="text-text-secondary">✕</Text>
              </Pressable>
            )}
          </View>

          {/* Platform filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setSelectedPlatform(null)}
                className={`px-4 py-2 rounded-full border ${
                  selectedPlatform === null
                    ? 'bg-accent border-accent'
                    : 'bg-surface border-border'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    selectedPlatform === null ? 'text-base' : 'text-text-secondary'
                  }`}
                >
                  All Platforms
                </Text>
              </Pressable>
              {connectedPlatforms.map((p) => {
                const config = PLATFORM_CONFIG[p];
                return (
                  <Pressable
                    key={p}
                    onPress={() => setSelectedPlatform(selectedPlatform === p ? null : p)}
                    className={`px-4 py-2 rounded-full border flex-row items-center gap-1.5 ${
                      selectedPlatform === p ? 'bg-elevated' : 'bg-surface border-border'
                    }`}
                    style={selectedPlatform === p ? { borderColor: config?.color } : undefined}
                  >
                    <Text className="text-sm">{config?.emoji}</Text>
                    <Text
                      className={`text-sm font-medium ${
                        selectedPlatform === p ? 'text-text-primary' : 'text-text-secondary'
                      }`}
                    >
                      {config?.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Playlist grid */}
        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator color="#E8FF47" size="large" />
              <Text className="text-text-secondary mt-3">Loading playlists...</Text>
            </View>
          ) : connectedPlatforms.length === 0 ? (
            <View className="items-center py-16">
              <Text className="text-4xl mb-4">🎵</Text>
              <Text className="text-text-primary text-lg font-bold mb-2">No platforms connected</Text>
              <Text className="text-text-secondary text-center mb-6">
                Connect a music platform to see your playlists
              </Text>
              <Pressable
                onPress={() => router.push('/(tabs)/settings/connect')}
                className="bg-accent px-6 py-3 rounded-xl"
              >
                <Text className="text-base font-bold">Connect Platform</Text>
              </Pressable>
            </View>
          ) : filteredPlaylists.length === 0 ? (
            <View className="items-center py-12">
              <Text className="text-text-secondary text-center">
                {searchQuery ? 'No playlists match your search' : 'No playlists found'}
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-4 pb-8">
              {filteredPlaylists.map((playlist) => {
                const platformConfig = PLATFORM_CONFIG[playlist.platform];
                return (
                  <Pressable
                    key={`${playlist.platform}-${playlist.id}`}
                    onPress={() =>
                      router.push(`/(tabs)/playlists/${playlist.platform}/${playlist.id}`)
                    }
                    className="bg-surface rounded-2xl overflow-hidden"
                    style={{ width: '47%' }}
                  >
                    {playlist.artworkUrl ? (
                      <Image
                        source={{ uri: playlist.artworkUrl }}
                        className="w-full aspect-square bg-elevated"
                      />
                    ) : (
                      <View className="w-full aspect-square bg-elevated items-center justify-center">
                        <Text className="text-5xl">{platformConfig?.emoji ?? '🎵'}</Text>
                      </View>
                    )}
                    <View className="p-3">
                      <Text className="text-text-primary font-semibold" numberOfLines={1}>
                        {playlist.name}
                      </Text>
                      <View className="flex-row items-center gap-1.5 mt-1">
                        <Text className="text-sm">{platformConfig?.emoji}</Text>
                        <Text className="text-text-secondary text-xs">
                          {playlist.trackCount} tracks
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
