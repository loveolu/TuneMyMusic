import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

interface ProgressBarProps {
  progress: number; // 0-100
  height?: number;
  color?: string;
  backgroundColor?: string;
}

export function ProgressBar({
  progress,
  height = 8,
  color = '#E8FF47',
  backgroundColor = '#1C1C1F',
}: ProgressBarProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: Math.min(100, Math.max(0, progress)),
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View
      style={{ height, backgroundColor, borderRadius: height / 2, overflow: 'hidden' }}
    >
      <Animated.View
        style={{
          height,
          backgroundColor: color,
          borderRadius: height / 2,
          width: animatedWidth.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
          }),
        }}
      />
    </View>
  );
}
