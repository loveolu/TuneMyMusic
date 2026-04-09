import { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api } from '../../../src/lib/api';
import { PLATFORM_CONFIG, ALL_PLATFORMS } from '../../../src/lib/constants';
import { Button } from '../../../src/components/Button';
import { PlatformCard } from '../../../src/components/PlatformCard';

interface Connection {
  platform: string;
  displayName: string | null;
}

interface Playlist {
  id: string;
  name: string;
  trackCount: number;
  artworkUrl?: string;
  description?: string;
}

interface TransferOptions {
  createNew: boolean;
  keepOrder: boolean;
  makePublic: boolean;
  copyDescription: boolean;
  skipDuplicates: boolean;
  confidenceThreshold: number;
}

interface TransferResult {
  id: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { num: 1, label: 'Source' },
  { num: 2, label: 'Playlist' },
  { num: 3, label: 'Destination' },
  { num: 4, label: 'Options' },
  { num: 5, label: 'Confirm' },
];

export default function TransferScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [sourcePlatform, setSourcePlatform] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [destPlatform, setDestPlatform] = useState<string | null>(null);
  const [options, setOptions] = useState<TransferOptions>({
    createNew: true,
    keepOrder: true,
    makePublic: true,
    copyDescription: true,
    skipDuplicates: true,
    confidenceThreshold: 70,
  });

  const slideAnim = useRef(new Animated.Value(0)).current;

  const { data: connections } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.get<Connection[]>('/api/connections'),
  });

  const { data: playlists, isLoading: playlistsLoading } = useQuery({
    queryKey: ['playlists', sourcePlatform],
    queryFn: () => api.get<Playlist[]>(`/api/playlists/${sourcePlatform}`),
    enabled: !!sourcePlatform && step === 2,
  });

  const createTransferMutation = useMutation({
    mutationFn: (data: {
      sourcePlatform: string;
      destinationPlatform: string;
      sourcePlaylistId: string;
      sourcePlaylistName: string;
      options: TransferOptions;
    }) => api.post<TransferResult>('/api/transfers', data),
    onSuccess: (data) => {
      router.push(`/(tabs)/transfer/progress/${data.id}`);
    },
    onError: (err: Error) => {
      Alert.alert('Transfer failed', err.message);
    },
  });

  const goToStep = async (newStep: Step) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -20, duration: 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep(newStep);
  };

  const connectedPlatforms = connections?.map((c) => c.platform) ?? [];

  const renderStepIndicator = () => (
    <View className="flex-row justify-center gap-2 mb-6">
      {STEPS.map((s) => (
        <View key={s.num} className="items-center">
          <View
            className={`w-8 h-8 rounded-full items-center justify-center ${
              step === s.num
                ? 'bg-accent'
                : step > s.num
                ? 'bg-success'
                : 'bg-elevated'
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                step === s.num ? 'text-base' : step > s.num ? 'text-white' : 'text-text-secondary'
              }`}
            >
              {step > s.num ? '✓' : s.num}
            </Text>
          </View>
          <Text className="text-text-secondary text-xs mt-1">{s.label}</Text>
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View>
      <Text className="text-text-primary text-xl font-bold mb-2">Select Source Platform</Text>
      <Text className="text-text-secondary mb-6">Which platform do you want to transfer from?</Text>

      {connectedPlatforms.length > 0 && (
        <View className="mb-4">
          <Text className="text-text-secondary text-sm mb-3 font-medium">Connected</Text>
          <View className="flex-row flex-wrap gap-3">
            {connectedPlatforms.map((p) => (
              <View key={p} className="w-[30%]">
                <PlatformCard
                  platformId={p}
                  selected={sourcePlatform === p}
                  connected
                  onPress={() => {
                    setSourcePlatform(p);
                    setSelectedPlaylist(null);
                  }}
                />
              </View>
            ))}
          </View>
        </View>
      )}

      <Text className="text-text-secondary text-sm mb-3 font-medium">All Platforms</Text>
      <View className="flex-row flex-wrap gap-3">
        {ALL_PLATFORMS.filter((p) => !connectedPlatforms.includes(p)).map((p) => (
          <View key={p} className="w-[30%]">
            <PlatformCard
              platformId={p}
              selected={sourcePlatform === p}
              onPress={() => {
                setSourcePlatform(p);
                setSelectedPlaylist(null);
              }}
            />
          </View>
        ))}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View className="flex-1">
      <Text className="text-text-primary text-xl font-bold mb-2">Select Playlist</Text>
      <Text className="text-text-secondary mb-6">
        Which playlist from {PLATFORM_CONFIG[sourcePlatform!]?.name} do you want to transfer?
      </Text>

      {playlistsLoading ? (
        <View className="items-center py-12">
          <ActivityIndicator color="#E8FF47" size="large" />
          <Text className="text-text-secondary mt-3">Loading playlists...</Text>
        </View>
      ) : playlists && playlists.length > 0 ? (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelectedPlaylist(item)}
              className={`flex-row items-center p-4 mb-2 rounded-2xl border ${
                selectedPlaylist?.id === item.id
                  ? 'bg-elevated border-accent'
                  : 'bg-surface border-transparent'
              }`}
            >
              <View className="w-12 h-12 bg-elevated rounded-xl items-center justify-center mr-3">
                <Text className="text-xl">🎵</Text>
              </View>
              <View className="flex-1">
                <Text className="text-text-primary font-medium" numberOfLines={1}>{item.name}</Text>
                <Text className="text-text-secondary text-sm">{item.trackCount} tracks</Text>
              </View>
              {selectedPlaylist?.id === item.id && (
                <Text className="text-accent text-lg">✓</Text>
              )}
            </Pressable>
          )}
        />
      ) : (
        <View className="items-center py-12">
          <Text className="text-text-secondary text-center">
            No playlists found. Make sure you&apos;re connected to {PLATFORM_CONFIG[sourcePlatform!]?.name}.
          </Text>
        </View>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View>
      <Text className="text-text-primary text-xl font-bold mb-2">Select Destination</Text>
      <Text className="text-text-secondary mb-6">Where do you want to transfer your playlist?</Text>

      {connectedPlatforms.length > 0 && (
        <View className="mb-4">
          <Text className="text-text-secondary text-sm mb-3 font-medium">Connected</Text>
          <View className="flex-row flex-wrap gap-3">
            {connectedPlatforms
              .filter((p) => p !== sourcePlatform)
              .map((p) => (
                <View key={p} className="w-[30%]">
                  <PlatformCard
                    platformId={p}
                    selected={destPlatform === p}
                    connected
                    onPress={() => setDestPlatform(p)}
                  />
                </View>
              ))}
          </View>
        </View>
      )}

      <Text className="text-text-secondary text-sm mb-3 font-medium">All Platforms</Text>
      <View className="flex-row flex-wrap gap-3">
        {ALL_PLATFORMS
          .filter((p) => p !== sourcePlatform && !connectedPlatforms.includes(p))
          .map((p) => (
            <View key={p} className="w-[30%]">
              <PlatformCard
                platformId={p}
                selected={destPlatform === p}
                onPress={() => setDestPlatform(p)}
              />
            </View>
          ))}
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View>
      <Text className="text-text-primary text-xl font-bold mb-2">Transfer Options</Text>
      <Text className="text-text-secondary mb-6">Customize how your playlist is transferred</Text>

      <View className="gap-1">
        {[
          { key: 'createNew' as const, label: 'Create new playlist', desc: 'Create a fresh playlist on the destination' },
          { key: 'keepOrder' as const, label: 'Keep track order', desc: 'Maintain the same track sequence' },
          { key: 'makePublic' as const, label: 'Make public', desc: 'Make the new playlist publicly visible' },
          { key: 'copyDescription' as const, label: 'Copy description', desc: 'Include the original playlist description' },
          { key: 'skipDuplicates' as const, label: 'Skip duplicates', desc: 'Avoid adding tracks already in the playlist' },
        ].map((opt) => (
          <View key={opt.key} className="bg-surface rounded-2xl p-4 flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-text-primary font-medium">{opt.label}</Text>
              <Text className="text-text-secondary text-sm mt-0.5">{opt.desc}</Text>
            </View>
            <Switch
              value={options[opt.key]}
              onValueChange={(val) => setOptions((prev) => ({ ...prev, [opt.key]: val }))}
              trackColor={{ false: '#2A2A2E', true: '#E8FF47' }}
              thumbColor="#FFFFFF"
            />
          </View>
        ))}
      </View>

      <View className="bg-surface rounded-2xl p-4 mt-1">
        <View className="flex-row justify-between mb-3">
          <Text className="text-text-primary font-medium">Match Confidence</Text>
          <Text className="text-accent font-bold">{options.confidenceThreshold}%</Text>
        </View>
        <Text className="text-text-secondary text-sm">
          Minimum confidence score to consider a track matched. Higher = more accurate, fewer matches.
        </Text>
        <View className="flex-row gap-2 mt-3">
          {[50, 60, 70, 80, 90].map((val) => (
            <Pressable
              key={val}
              onPress={() => setOptions((prev) => ({ ...prev, confidenceThreshold: val }))}
              className={`flex-1 py-2 rounded-lg items-center ${
                options.confidenceThreshold === val ? 'bg-accent' : 'bg-elevated'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  options.confidenceThreshold === val ? 'text-base' : 'text-text-secondary'
                }`}
              >
                {val}%
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );

  const renderStep5 = () => {
    const src = PLATFORM_CONFIG[sourcePlatform!];
    const dst = PLATFORM_CONFIG[destPlatform!];
    return (
      <View>
        <Text className="text-text-primary text-xl font-bold mb-2">Confirm Transfer</Text>
        <Text className="text-text-secondary mb-6">Review your transfer details before starting</Text>

        <View className="bg-surface rounded-2xl p-5 mb-4">
          <View className="flex-row items-center justify-center gap-4 mb-5">
            <View className="items-center">
              <Text className="text-4xl mb-2">{src?.emoji}</Text>
              <Text className="text-text-secondary text-sm">{src?.name}</Text>
            </View>
            <View className="flex-1 items-center">
              <Text className="text-text-secondary text-2xl">→</Text>
            </View>
            <View className="items-center">
              <Text className="text-4xl mb-2">{dst?.emoji}</Text>
              <Text className="text-text-secondary text-sm">{dst?.name}</Text>
            </View>
          </View>

          <View className="border-t border-border pt-4">
            <View className="flex-row justify-between mb-2">
              <Text className="text-text-secondary">Playlist</Text>
              <Text className="text-text-primary font-medium" numberOfLines={1}>
                {selectedPlaylist?.name}
              </Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-text-secondary">Tracks</Text>
              <Text className="text-text-primary font-medium">{selectedPlaylist?.trackCount}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-text-secondary">Confidence</Text>
              <Text className="text-accent font-medium">{options.confidenceThreshold}%</Text>
            </View>
          </View>
        </View>

        <Button
          onPress={() => {
            if (!sourcePlatform || !destPlatform || !selectedPlaylist) return;
            createTransferMutation.mutate({
              sourcePlatform,
              destinationPlatform: destPlatform,
              sourcePlaylistId: selectedPlaylist.id,
              sourcePlaylistName: selectedPlaylist.name,
              options,
            });
          }}
          loading={createTransferMutation.isPending}
          size="lg"
          fullWidth
        >
          Start Transfer
        </Button>
      </View>
    );
  };

  const canProceed = () => {
    switch (step) {
      case 1: return !!sourcePlatform;
      case 2: return !!selectedPlaylist;
      case 3: return !!destPlatform;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-base">
      <View className="flex-1">
        <View className="px-5 pt-4 pb-2">
          <Text className="text-text-primary text-2xl font-bold mb-4">New Transfer</Text>
          {renderStepIndicator()}
        </View>

        <Animated.View
          style={{ flex: 1, transform: [{ translateX: slideAnim }] }}
        >
          <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
            {step === 5 && renderStep5()}
            <View className="h-8" />
          </ScrollView>
        </Animated.View>

        {step < 5 && (
          <View className="px-5 py-4 border-t border-border flex-row gap-3">
            {step > 1 && (
              <Button
                onPress={() => goToStep((step - 1) as Step)}
                variant="outline"
                size="lg"
              >
                Back
              </Button>
            )}
            <Button
              onPress={() => goToStep((step + 1) as Step)}
              disabled={!canProceed()}
              size="lg"
              fullWidth={step === 1}
              variant={canProceed() ? 'primary' : 'secondary'}
            >
              Continue
            </Button>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
