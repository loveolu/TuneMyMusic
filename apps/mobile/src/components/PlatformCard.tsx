import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PLATFORM_CONFIG } from '../lib/constants';

interface PlatformCardProps {
  platformId: string;
  selected?: boolean;
  connected?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function PlatformCard({
  platformId,
  selected = false,
  connected = false,
  onPress,
  size = 'md',
}: PlatformCardProps) {
  const config = PLATFORM_CONFIG[platformId];
  if (!config) return null;

  const handlePress = async () => {
    if (!onPress) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const sizeClasses = {
    sm: { container: 'p-3 rounded-xl', emoji: 'text-2xl', name: 'text-xs mt-1' },
    md: { container: 'p-4 rounded-2xl', emoji: 'text-3xl', name: 'text-xs mt-1.5' },
    lg: { container: 'p-5 rounded-2xl', emoji: 'text-4xl', name: 'text-sm mt-2' },
  }[size];

  return (
    <Pressable
      onPress={handlePress}
      className={`
        bg-elevated items-center
        ${sizeClasses.container}
        ${selected ? 'border-2' : 'border border-border'}
      `}
      style={selected ? { borderColor: config.color } : undefined}
    >
      <Text className={sizeClasses.emoji}>{config.emoji}</Text>
      <Text
        className={`text-text-primary font-medium text-center ${sizeClasses.name}`}
        numberOfLines={2}
      >
        {config.name}
      </Text>
      {connected && (
        <View className="mt-1 w-1.5 h-1.5 rounded-full bg-success" />
      )}
    </Pressable>
  );
}
