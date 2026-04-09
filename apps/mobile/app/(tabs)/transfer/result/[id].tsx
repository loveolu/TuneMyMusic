import { useState } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../src/lib/api';
import { PLATFORM_CONFIG } from '../../../../src/lib/constants';
import { Badge } from '../../../../src/components/Badge';
import { Button } from '../../../../src/components/Button';
import { TrackItem } from '../../../../src/components/TrackItem';

type TrackStatus = 'MATCHED' | 'NOT_FOUND' | 'PARTIAL_MATCH' | 'SKIPPED' | 'FAILED';
type StatusFilter = 'ALL' | TrackStatus;

interface TransferResult {
  id: string;
  sourcePlatform: string;
  destinationPlatform: string;
  sourcePlaylistName: string;
  status: string;
  totalTracks: number;
  matchedTracks: number;
  failedTracks: number;
  matchRate: number;
  createdAt: string;
  completedAt: string;
}

interface TransferTrack {
  sourceTrackName: string;
  sourceArtist: string;
  destinationTrackName?: string;
  destinationArtist?: string;
  status: TrackStatus;
  confidenceScore: number;
}

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'MATCHED', label: 'Matched' },
  { key: 'PARTIAL_MATCH', label: 'Partial' },
  { key: 'NOT_FOUND', label: 'Not Found' },
  { key: 'FAILED', label: 'Failed' },
];

export default function TransferResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const { data: result, isLoading: resultLoading } = useQuery({
    queryKey: ['transfer-result', id],
    queryFn: () => api.get<TransferResult>(`/api/transfers/${id}`),
    enabled: !!id,
  });

  const { data: tracks, isLoading: tracksLoading } = useQuery({
    queryKey: ['transfer-tracks-all', id, statusFilter],
    queryFn: () =>
      api.get<TransferTrack[]>(
        `/api/transfers/${id}/tracks${statusFilter !== 'ALL' ? `?status=${statusFilter}` : ''}`
      ),
    enabled: !!id,
  });

  const matchRate = result?.matchRate ?? 0;
  const matchRateBadgeVariant =
    matchRate >= 80 ? 'success' : matchRate >= 60 ? 'warning' : 'error';

  const src = result ? PLATFORM_CONFIG[result.sourcePlatform] : null;
  const dst = result ? PLATFORM_CONFIG[result.destinationPlatform] : null;

  if (resultLoading) {
    return (
      <SafeAreaView className="flex-1 bg-base items-center justify-center">
        <ActivityIndicator color="#E8FF47" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-base">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-5 pt-4 pb-2">
          <Pressable onPress={() => router.push('/(tabs)/home')} className="mb-4">
            <Text className="text-text-secondary">← Home</Text>
          </Pressable>
          <Text className="text-text-primary text-2xl font-bold">Transfer Results</Text>
        </View>

        {/* Summary card */}
        {result && (
          <View className="px-5 mb-6">
            <View className="bg-surface rounded-3xl p-5">
              {/* Platform header */}
              <View className="flex-row items-center justify-center gap-4 mb-5">
                <View
                  className="w-16 h-16 rounded-xl bg-elevated items-center justify-center"
                  style={src ? { borderWidth: 1, borderColor: src.color + '60' } : undefined}
                >
                  <Text className="text-3xl">{src?.emoji}</Text>
                </View>
                <Text className="text-accent text-2xl">→</Text>
                <View
                  className="w-16 h-16 rounded-xl bg-elevated items-center justify-center"
                  style={dst ? { borderWidth: 1, borderColor: dst.color + '60' } : undefined}
                >
                  <Text className="text-3xl">{dst?.emoji}</Text>
                </View>
              </View>

              <Text
                className="text-text-primary text-lg font-bold text-center mb-4"
                numberOfLines={2}
              >
                {result.sourcePlaylistName}
              </Text>

              {/* Match rate big badge */}
              <View className="items-center mb-5">
                <View
                  className={`w-24 h-24 rounded-full items-center justify-center border-4 ${
                    matchRate >= 80
                      ? 'border-success bg-success/10'
                      : matchRate >= 60
                      ? 'border-warning bg-warning/10'
                      : 'border-error bg-error/10'
                  }`}
                >
                  <Text
                    className={`text-2xl font-bold ${
                      matchRate >= 80
                        ? 'text-success'
                        : matchRate >= 60
                        ? 'text-warning'
                        : 'text-error'
                    }`}
                  >
                    {matchRate}%
                  </Text>
                  <Text className="text-text-secondary text-xs">matched</Text>
                </View>
              </View>

              {/* Stats row */}
              <View className="flex-row justify-around border-t border-border pt-4">
                <View className="items-center">
                  <Text className="text-text-primary text-xl font-bold">{result.totalTracks}</Text>
                  <Text className="text-text-secondary text-xs mt-0.5">Total</Text>
                </View>
                <View className="items-center">
                  <Text className="text-success text-xl font-bold">{result.matchedTracks}</Text>
                  <Text className="text-text-secondary text-xs mt-0.5">Matched</Text>
                </View>
                <View className="items-center">
                  <Text className="text-error text-xl font-bold">{result.failedTracks}</Text>
                  <Text className="text-text-secondary text-xs mt-0.5">Failed</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Action buttons */}
        <View className="px-5 mb-6 gap-3">
          <Button
            onPress={() => router.push('/(tabs)/transfer')}
            variant="primary"
            size="lg"
            fullWidth
          >
            Start Another Transfer
          </Button>
          {(result?.failedTracks ?? 0) > 0 && (
            <Button
              onPress={() => setStatusFilter('NOT_FOUND')}
              variant="outline"
              size="md"
              fullWidth
            >
              Review Unmatched ({result?.failedTracks})
            </Button>
          )}
        </View>

        {/* Track list */}
        <View className="px-5 mb-8">
          <Text className="text-text-primary text-lg font-bold mb-3">Track Details</Text>

          {/* Filter tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
          >
            <View className="flex-row gap-2">
              {FILTER_TABS.map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => setStatusFilter(tab.key)}
                  className={`px-4 py-2 rounded-full ${
                    statusFilter === tab.key ? 'bg-accent' : 'bg-surface'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      statusFilter === tab.key ? 'text-base' : 'text-text-secondary'
                    }`}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {tracksLoading ? (
            <ActivityIndicator color="#E8FF47" />
          ) : tracks && tracks.length > 0 ? (
            <View className="bg-surface rounded-2xl px-4 overflow-hidden">
              {tracks.map((track, i) => (
                <TrackItem
                  key={i}
                  name={track.sourceTrackName}
                  artist={track.sourceArtist}
                  status={track.status}
                  showStatus
                />
              ))}
            </View>
          ) : (
            <View className="bg-surface rounded-2xl p-6 items-center">
              <Text className="text-text-secondary text-center">
                No tracks found for this filter
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
