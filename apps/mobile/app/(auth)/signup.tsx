import { useState } from 'react';
import { View, Text, ScrollView, Alert, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';

interface SignupResponse {
  token: string;
  user: { id: string; email: string; name: string | null; plan: string };
}

export default function SignupScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});

  const signupMutation = useMutation({
    mutationFn: (data: { name: string; email: string; password: string }) =>
      api.post<SignupResponse>('/api/auth/register', data),
    onSuccess: async (data) => {
      await login(data.token, data.user);
      router.replace('/(tabs)/home');
    },
    onError: (err: Error) => {
      Alert.alert('Signup failed', err.message);
    },
  });

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Invalid email';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = () => {
    if (!validate()) return;
    signupMutation.mutate({ name: name.trim(), email: email.trim(), password });
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
          <Text className="text-3xl font-bold text-text-primary mb-2">Create account</Text>
          <Text className="text-text-secondary text-base">Start transferring your music for free</Text>
        </View>

        {/* Form */}
        <View className="px-6 pt-4 flex-1">
          <Input
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            error={errors.name}
            autoComplete="name"
          />
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
            placeholder="Min 8 characters"
            secureToggle
            error={errors.password}
          />

          <Text className="text-text-secondary text-xs mb-6">
            By signing up you agree to our Terms of Service and Privacy Policy.
          </Text>

          <Button
            onPress={handleSignup}
            loading={signupMutation.isPending}
            size="lg"
            fullWidth
          >
            Create Account
          </Button>
        </View>

        {/* Footer */}
        <View className="px-6 py-8 flex-row justify-center items-center">
          <Text className="text-text-secondary">Already have an account? </Text>
          <Pressable onPress={() => router.push('/(auth)/login')}>
            <Text className="text-accent font-semibold">Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
