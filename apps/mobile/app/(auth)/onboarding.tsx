import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-base">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero section */}
        <View className="flex-1 items-center justify-center px-6 pt-16 pb-8">
          <View className="w-24 h-24 rounded-3xl bg-accent items-center justify-center mb-8">
            <Text className="text-5xl">🎵</Text>
          </View>
          <Text className="text-4xl font-bold text-text-primary text-center mb-3">
            TuneMyMusic
          </Text>
          <Text className="text-text-secondary text-lg text-center mb-8 leading-7">
            Transfer your music library between any streaming platform in minutes
          </Text>

          {/* Feature cards */}
          <View className="w-full gap-3 mb-12">
            {[
              { icon: '⚡', title: 'Lightning Fast', desc: 'Transfer thousands of tracks in minutes' },
              { icon: '🎯', title: 'Highly Accurate', desc: 'AI-powered matching for perfect results' },
              { icon: '🔒', title: '100% Private', desc: 'Your data never stored on our servers' },
            ].map((feature) => (
              <View key={feature.title} className="bg-surface rounded-2xl p-4 flex-row items-start">
                <Text className="text-2xl mr-3">{feature.icon}</Text>
                <View className="flex-1">
                  <Text className="text-text-primary font-semibold text-base">{feature.title}</Text>
                  <Text className="text-text-secondary text-sm mt-0.5">{feature.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Platform logos row */}
          <View className="flex-row flex-wrap justify-center gap-3 mb-12">
            {['🎵', '🍎', '▶', '📦', '🌊', '🎧'].map((emoji, i) => (
              <View key={i} className="w-12 h-12 bg-elevated rounded-xl items-center justify-center">
                <Text className="text-xl">{emoji}</Text>
              </View>
            ))}
          </View>

          <Text className="text-text-secondary text-sm mb-2">Connect with 13+ platforms</Text>
        </View>

        {/* CTA section */}
        <View className="px-6 pb-8 gap-3">
          <Button
            onPress={() => router.push('/(auth)/signup')}
            variant="primary"
            size="lg"
            fullWidth
          >
            Get Started Free
          </Button>
          <Button
            onPress={() => router.push('/(auth)/login')}
            variant="outline"
            size="lg"
            fullWidth
          >
            I already have an account
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
