import React from 'react';
import { View, Text } from 'react-native';

type BadgeVariant = 'success' | 'warning' | 'error' | 'accent' | 'secondary';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-success/20 border border-success/30',
  warning: 'bg-warning/20 border border-warning/30',
  error: 'bg-error/20 border border-error/30',
  accent: 'bg-accent/20 border border-accent/30',
  secondary: 'bg-elevated border border-border',
};

const textClasses: Record<BadgeVariant, string> = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  accent: 'text-accent',
  secondary: 'text-text-secondary',
};

export function Badge({ children, variant = 'secondary' }: BadgeProps) {
  return (
    <View className={`px-2.5 py-1 rounded-full ${variantClasses[variant]}`}>
      <Text className={`text-xs font-semibold ${textClasses[variant]}`}>{children}</Text>
    </View>
  );
}
