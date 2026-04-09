import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api } from '../../../src/lib/api';
import { useAuthStore } from '../../../src/lib/store';
import { PLANS } from '../../../src/lib/constants';
import { Badge } from '../../../src/components/Badge';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  plan: 'FREE' | 'PRO' | 'UNLIMITED';
  avatarUrl: string | null;
  createdAt: string;
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  rightElement,
  danger,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-5 py-4 border-b border-border/50"
      disabled={!onPress}
    >
      <Text className="text-xl mr-3">{icon}</Text>
      <View className="flex-1">
        <Text className={`font-medium text-base ${danger ? 'text-error' : 'text-text-primary'}`}>
          {label}
        </Text>
        {value && <Text className="text-text-secondary text-sm mt-0.5">{value}</Text>}
      </View>
      {rightElement ?? (onPress ? <Text className="text-text-secondary">›</Text> : null)}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const storeUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<UserProfile>('/api/auth/me'),
  });

  const user = profile ?? storeUser;
  const plan = profile?.plan ?? 'FREE';
  const planConfig = PLANS[plan as keyof typeof PLANS] ?? PLANS.FREE;

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await logout();
      queryClient.clear();
    },
  });

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => logoutMutation.mutate(),
        },
      ]
    );
  };

  const planBadgeVariant =
    plan === 'UNLIMITED' ? 'success' : plan === 'PRO' ? 'accent' : 'secondary';

  return (
    <SafeAreaView className="flex-1 bg-base">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-4 pb-6">
          <Text className="text-text-primary text-2xl font-bold">Settings</Text>
        </View>

        {/* Profile section */}
        <View className="mx-5 mb-6 bg-surface rounded-2xl overflow-hidden">
          {isLoading ? (
            <View className="p-6 items-center">
              <ActivityIndicator color="#E8FF47" />
            </View>
          ) : (
            <View className="p-5">
              <View className="flex-row items-center gap-4">
                <View className="w-16 h-16 rounded-full bg-elevated items-center justify-center">
                  <Text className="text-3xl">👤</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-text-primary text-lg font-bold">
                    {user?.name ?? 'User'}
                  </Text>
                  <Text className="text-text-secondary text-sm mt-0.5">{user?.email}</Text>
                  <View className="mt-2">
                    <Badge variant={planBadgeVariant}>{planConfig.name} Plan</Badge>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Plan section */}
        <View className="px-5 mb-2">
          <Text className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2 px-1">
            Plan
          </Text>
        </View>
        <View className="mx-5 mb-6 bg-surface rounded-2xl overflow-hidden">
          <View className="p-5">
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-text-primary font-bold text-lg">{planConfig.name}</Text>
                <Text className="text-text-secondary text-sm">
                  {planConfig.price === 0
                    ? 'Free forever'
                    : `$${planConfig.price}/month`}
                </Text>
              </View>
              <Badge variant={planBadgeVariant}>{planConfig.name}</Badge>
            </View>
            <View className="flex-row gap-4 mb-4">
              <View>
                <Text className="text-text-primary font-semibold">
                  {planConfig.transfers === -1 ? 'Unlimited' : planConfig.transfers}
                </Text>
                <Text className="text-text-secondary text-xs">Transfers/month</Text>
              </View>
            </View>
            {plan !== 'UNLIMITED' && (
              <Pressable className="bg-accent rounded-xl py-3 items-center">
                <Text className="text-base font-bold">Upgrade Plan</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Account section */}
        <View className="px-5 mb-2">
          <Text className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2 px-1">
            Account
          </Text>
        </View>
        <View className="mx-5 mb-6 bg-surface rounded-2xl overflow-hidden">
          <SettingsRow
            icon="🔗"
            label="Connected Platforms"
            value="Manage your music service connections"
            onPress={() => router.push('/(tabs)/settings/connect')}
          />
          <SettingsRow
            icon="👤"
            label="Edit Profile"
            value="Update your name and email"
            onPress={() => {}}
          />
          <SettingsRow
            icon="🔐"
            label="Change Password"
            onPress={() => {}}
          />
        </View>

        {/* Preferences section */}
        <View className="px-5 mb-2">
          <Text className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2 px-1">
            Preferences
          </Text>
        </View>
        <View className="mx-5 mb-6 bg-surface rounded-2xl overflow-hidden">
          <SettingsRow
            icon="🔔"
            label="Push Notifications"
            value="Get notified when transfers complete"
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={(val) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setNotificationsEnabled(val);
                }}
                trackColor={{ false: '#2A2A2E', true: '#E8FF47' }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingsRow
            icon="🌙"
            label="Appearance"
            value="Dark mode"
            onPress={() => {}}
          />
        </View>

        {/* About section */}
        <View className="px-5 mb-2">
          <Text className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2 px-1">
            About
          </Text>
        </View>
        <View className="mx-5 mb-6 bg-surface rounded-2xl overflow-hidden">
          <SettingsRow
            icon="📄"
            label="Privacy Policy"
            onPress={() => {}}
          />
          <SettingsRow
            icon="📋"
            label="Terms of Service"
            onPress={() => {}}
          />
          <SettingsRow
            icon="ℹ"
            label="Version"
            value="1.0.0"
          />
        </View>

        {/* Logout */}
        <View className="mx-5 mb-8 bg-surface rounded-2xl overflow-hidden">
          <SettingsRow
            icon="🚪"
            label="Log Out"
            onPress={handleLogout}
            danger
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
