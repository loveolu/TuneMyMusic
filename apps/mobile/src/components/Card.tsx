import React from 'react';
import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  elevated?: boolean;
}

export function Card({ children, elevated = false, className, ...props }: CardProps) {
  return (
    <View
      className={`rounded-2xl p-4 ${elevated ? 'bg-elevated' : 'bg-surface'} ${className ?? ''}`}
      {...props}
    >
      {children}
    </View>
  );
}
