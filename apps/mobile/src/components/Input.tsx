import React, { useState } from 'react';
import { TextInput, View, Text, TextInputProps, Pressable } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  secureToggle?: boolean;
}

export function Input({ label, error, secureToggle, secureTextEntry, ...props }: InputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const isSecure = secureToggle ? !showPassword : secureTextEntry;

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-text-secondary text-sm font-medium mb-2">{label}</Text>
      )}
      <View className="relative">
        <TextInput
          className={`
            bg-elevated text-text-primary rounded-xl px-4 py-3.5
            border text-base
            ${error ? 'border-error' : 'border-border'}
          `}
          placeholderTextColor="#8A8A8F"
          secureTextEntry={isSecure}
          autoCapitalize="none"
          {...props}
        />
        {secureToggle && (
          <Pressable
            onPress={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-4"
          >
            <Text className="text-text-secondary text-sm">{showPassword ? 'Hide' : 'Show'}</Text>
          </Pressable>
        )}
      </View>
      {error && <Text className="text-error text-xs mt-1">{error}</Text>}
    </View>
  );
}
