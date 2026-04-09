import { useEffect, useRef } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, Animated, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api } from '../../../../src/lib/api';
import { PLATFORM_CONFIG } from '../../../../src/lib/constants';
import { ProgressBar } from '../../../../src/components/ProgressBar';
import { Button } from '../../../../src/components/Button';

interface TransferProgress {
  transferId: string;
  status: string;
  totalTracks: number;
  processedTracks: number;
  matchedTracks: number;
  failedTracks: number;
  currentTrack?: string;
  matchRate: number;
  phase: 'FETCHING' | 'MATCHING' | 'IMPORTING' | 'DONE';
}

interface TransferDetail {
  id: string;
  sourcePlatform: string;
  destinationPlatform: string;
  sourcePlaylistName: string;
  status: string;
}

interface RecentTrack {
  name: string;
  artist: string;
  status: 'MATCHED' | 'NOT_FOUND' | 'PARTIAL_MATCH';
}

const PHASE_LABELS: Record<string, string> = {
  FETCHING: 'Fetching tracks...',
  MATCHING: 'Matching tracks...',
  IMPORTING: 'Importing to destination...',
  DONE: 'Complete!',
};

const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'];

export default function TransferProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const { data: transfer } = useQuery({
    queryKey: ['transfer', id],
    queryFn: () => api.get<TransferDetail>(`/api/transfers/${id}`),
    enabled: !!id,
  });

  const { data: progress } = useQuery({
    queryKey: ['transfer-progress', id],
    queryFn: () => api.get<TransferProgress>(`/api/transfers/${id}/progress`),
    enabled: !!id,
    refetchInterval: (data) => {
      if (!data || TERMINAL_STATUSES.includes(data.state?.status ?? '')) return false;
      return 2000;
    },
  });

  const { data: recentTracks } = useQuery({
    queryKey: ['transfer-tracks', id],
    queryFn: () => api.get<RecentTrack[]>(`/api/transfers/${id}/tracks?limit=20`),
    enabled: !!id,
    refetchInterval: 3000,
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/api/transfers/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-progress', id] });
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    },
  });

  // Pulse animation for active phases
  useEffect(() => {
    if (!progress || TERMINAL_STATUSES.includes(progress.status)) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [progress?.status]);

  // Navigate to result on completion
  useEffect(() => {
    if (progress?.status === 'COMPLETED') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => router.replace(`/(tabs)/transfer/result/${id}`), 1000);
    } else if (progress?.status === 'FAILED') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [progress?.status]);

  const handleCancel = () => {
    Alert.alert(
      'Cancel Transfer',
      'Are you sure you want to cancel this transfer?',
      [
        { text: 'Keep Running', style: 'cancel' },
        {
          text: 'Cancel Transfer',
          style: 'destructive',
          onPress: () => cancelMutation.mutate(),
        },
      ]
    );
  };

  const progressPercent = progress
    ? progress.totalTracks > 0
      ? Math.round((progress.processedTracks / progress.totalTracks) * 100)
      : 0
    : 0;

  const isComplete = progress?.status === 'COMPLETED';
  const isFailed = progress?.status === 'FAILED';
  const isRunning = !isComplete && !isFailed && progress?.status !== 'CANCELLED';

  const src = transfer ? PLATFORM_CONFIG[transfer.sourcePlatform] : null;
  const dst = transfer ? PLATFORM_CONFIG[transfer.destinationPlatform] : null;

  return (
    <SafeAreaView className="flex-1 bg-base">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-5 pt-4 pb-6">
          <Pressable onPress={() => router.push('/(tabs)/home')} className="mb-4">
            <Text className="text-text-secondary">← Home</Text>
          </Pressable>
          <Text className="text-text-primary text-2xl font-bold">
            {isComplete ? 'Transfer Complete!' : isFailed ? 'Transfer Failed' : 'Transfer in Progress'}
          </Text>
          <Text className="text-text-secondary mt-1">
            {transfer?.sourcePlaylistName ?? 'Loading...'}
          </Text>
        </View>

        {/* Platform animation */}
        <View className="px-5 mb-6">
          <View className="bg-surface rounded-3xl p-6">
            <View className="flex-row items-center justify-center gap-4 mb-6">
              <View
                className="w-20 h-20 rounded-2xl bg-elevated items-center justify-center"
                style={src ? { borderWidth: 2, borderColor: src.color + '60' } : undefined}
              >
                <Text className="text-4xl">{src?.emoji ?? '🎵'}</Text>
              </View>

              <Animated.View style={{ opacity: isRunning ? pulseAnim : 1 }}>
                <Text className="text-accent text-3xl font-bold">→</Text>
              </Animated.View>

              <View
                className="w-20 h-20 rounded-2xl bg-elevated items-center justify-center"
                style={dst ? { borderWidth: 2, borderColor: dst.color + '60' } : undefined}
              >
                <Text className="text-4xl">{dst?.emoji ?? '🎵'}</Text>
              </View>
            </View>

            {/* Progress bar */}
            <ProgressBar
              progress={isComplete ? 100 : progressPercent}
              color={isComplete ? '#4ADE80' : isFailed ? '#F87171' : '#E8FF47'}
            />

            <View className="flex-row justify-between mt-2">
              <Text className="text-text-secondary text-sm">
                {progress?.processedTracks ?? 0} / {progress?.totalTracks ?? 0} tracks
              </Text>
              <Text className="text-text-secondary text-sm font-medium">
                {isComplete ? '100%' : `${progressPercent}%`}
              </Text>
            </View>

            {/* Phase indicator */}
            <View className="mt-4 pt-4 border-t border-border">
              <Animated.Text
                className="text-text-secondary text-center text-sm"
                style={{ opacity: isRunning ? pulseAnim : 1 }}
              >
                {progress?.phase ? PHASE_LABELS[progress.phase] : 'Initializing...'}
              </Animated.Text>
              {progress?.currentTrack && (
                <Text className="text-text-primary text-center text-sm mt-1 font-medium" numberOfLines={1}>
                  {progress.currentTrack}
                </Text>
              )}
            </View>

            {/* Stats */}
            {(progress?.matchedTracks ?? 0) > 0 && (
              <View className="flex-row justify-around mt-4 pt-4 border-t border-border">
                <View className="items-center">
                  <Text className="text-success text-xl font-bold">{progress?.matchedTracks}</Text>
                  <Text className="text-text-secondary text-xs mt-0.5">Matched</Text>
                </View>
                <View className="items-center">
                  <Text className="text-error text-xl font-bold">{progress?.failedTracks}</Text>
                  <Text className="text-text-secondary text-xs mt-0.5">Failed</Text>
                </View>
                <View className="items-center">
                  <Text className="text-accent text-xl font-bold">{progress?.matchRate}%</Text>
                  <Text className="text-text-secondary text-xs mt-0.5">Match Rate</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Live track feed */}
        {recentTracks && recentTracks.length > 0 && (
          <View className="px-5 mb-6">
            <Text className="text-text-primary text-lg font-bold mb-3">Live Track Feed</Text>
            <View className="bg-surface rounded-2xl overflow-hidden">
              {recentTracks.slice(0, 10).map((track, i) => (
                <View key={i} className="flex-row items-center px-4 py-3 border-b border-border/50">
                  <View className="w-8 h-8 bg-elevated rounded-lg items-center justify-center mr-3">
                    <Text className="text-sm">🎵</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-text-primary text-sm font-medium" numberOfLines={1}>
                      {track.name}
                    </Text>
                    <Text className="text-text-secondary text-xs">{track.artist}</Text>
                  </View>
                  <Text
                    className={`text-xs font-semibold ml-2 ${
                      track.status === 'MATCHED'
                        ? 'text-success'
                        : track.status === 'PARTIAL_MATCH'
                        ? 'text-warning'
                        : 'text-error'
                    }`}
                  >
                    {track.status === 'MATCHED' ? '✓' : track.status === 'PARTIAL_MATCH' ? '~' : '✗'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom actions */}
      <View className="px-5 py-4 border-t border-border">
        {isRunning && (
          <Button
            onPress={handleCancel}
            variant="danger"
            size="lg"
            fullWidth
            loading={cancelMutation.isPending}
          >
            Cancel Transfer
          </Button>
        )}
        {(isComplete || isFailed) && (
          <Button
            onPress={() =>
              isComplete
                ? router.replace(`/(tabs)/transfer/result/${id}`)
                : router.replace('/(tabs)/home')
            }
            size="lg"
            fullWidth
          >
            {isComplete ? 'View Results' : 'Back to Home'}
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}
