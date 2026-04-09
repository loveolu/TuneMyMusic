import { useState } from 'react';
import { View, Text, ScrollView, Alert, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';

interface LoginResponse {
  token: string;
  user: { id: string; email: string; name: string | null; plan: string };
}

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const loginMutation = useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post<LoginResponse>('/api/auth/login', data),
    onSuccess: async (data) => {
      await login(data.token, data.user);
      router.replace('/(tabs)/home');
    },
    onError: (err: Error) => {
      Alert.alert('Login failed', err.message);
    },
  });

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Invalid email';
    if (!password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = () => {
    if (!validate()) return;
    loginMutation.mutate({ email: email.trim(), password });
  };

  return (
    <SafeAreaView className="flex-1 bg-base">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-6 pt-8 pb-4">
          <Pressable onPress={() => router.back()} className="mb-8">
            <Text className="text-text-secondary text-base">← Back</Text>
          </Pressable>
          <View className="w-14 h-14 rounded-2xl bg-accent items-center justify-center mb-6">
            <Text className="text-3xl">🎵</Text>
          </View>
          <Text className="text-3xl font-bold text-text-primary mb-2">Welcome back</Text>
          <Text className="text-text-secondary text-base">Sign in to your TuneMyMusic account</Text>
        </View>

        {/* Form */}
        <View className="px-6 pt-4 flex-1">
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            keyboardType="email-address"
            error={errors.email}
            autoComplete="email"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureToggle
            error={errors.password}
          />

          <Pressable className="mb-6">
            <Text className="text-accent text-sm text-right">Forgot password?</Text>
          </Pressable>

          <Button
            onPress={handleLogin}
            loading={loginMutation.isPending}
            size="lg"
            fullWidth
          >
            Sign In
          </Button>
        </View>

        {/* Footer */}
        <View className="px-6 py-8 flex-row justify-center items-center">
          <Text className="text-text-secondary">Don&apos;t have an account? </Text>
          <Pressable onPress={() => router.push('/(auth)/signup')}>
            <Text className="text-accent font-semibold">Sign up</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
