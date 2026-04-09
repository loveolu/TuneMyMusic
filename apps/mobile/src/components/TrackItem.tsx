import React from 'react';
import { View, Text, Image } from 'react-native';
import { Badge } from './Badge';

type TrackStatus = 'MATCHED' | 'NOT_FOUND' | 'PARTIAL_MATCH' | 'SKIPPED' | 'FAILED';

interface TrackItemProps {
  name: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  status?: TrackStatus;
  confidence?: number;
  showStatus?: boolean;
}

const statusVariant = (status: TrackStatus) => {
  switch (status) {
    case 'MATCHED': return 'success' as const;
    case 'PARTIAL_MATCH': return 'warning' as const;
    case 'NOT_FOUND':
    case 'FAILED': return 'error' as const;
    case 'SKIPPED': return 'secondary' as const;
    default: return 'secondary' as const;
  }
};

const statusLabel = (status: TrackStatus) => {
  switch (status) {
    case 'MATCHED': return 'Matched';
    case 'PARTIAL_MATCH': return 'Partial';
    case 'NOT_FOUND': return 'Not Found';
    case 'FAILED': return 'Failed';
    case 'SKIPPED': return 'Skipped';
    default: return status;
  }
};

export function TrackItem({
  name,
  artist,
  album,
  artworkUrl,
  status,
  showStatus = false,
}: TrackItemProps) {
  return (
    <View className="flex-row items-center py-3 border-b border-border/50">
      {artworkUrl ? (
        <Image
          source={{ uri: artworkUrl }}
          className="w-12 h-12 rounded-lg mr-3 bg-elevated"
        />
      ) : (
        <View className="w-12 h-12 rounded-lg mr-3 bg-elevated items-center justify-center">
          <Text className="text-xl">🎵</Text>
        </View>
      )}
      <View className="flex-1 mr-2">
        <Text className="text-text-primary font-medium" numberOfLines={1}>{name}</Text>
        <Text className="text-text-secondary text-sm mt-0.5" numberOfLines={1}>{artist}</Text>
        {album && (
          <Text className="text-text-secondary text-xs mt-0.5 opacity-70" numberOfLines={1}>{album}</Text>
        )}
      </View>
      {showStatus && status && (
        <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
      )}
    </View>
  );
}
