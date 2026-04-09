import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View className={`items-center justify-center ${focused ? 'opacity-100' : 'opacity-50'}`}>
      <Text className="text-xl">{emoji}</Text>
    </View>
  );
}

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      className="text-xs"
      style={{ color: focused ? '#E8FF47' : '#8A8A8F' }}
    >
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#141416',
          borderTopColor: '#2A2A2E',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#E8FF47',
        tabBarInactiveTintColor: '#8A8A8F',
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="transfer/index"
        options={{
          title: 'Transfer',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⇄" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Transfer" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="playlists/index"
        options={{
          title: 'Playlists',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎵" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Playlists" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="stats/index"
        options={{
          title: 'Stats',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Stats" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="Settings" focused={focused} />,
        }}
      />
      {/* Hidden screens - not shown in tab bar */}
      <Tabs.Screen
        name="transfer/progress/[id]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="transfer/result/[id]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="playlists/[platform]/[id]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="settings/connect"
        options={{ href: null }}
      />
    </Tabs>
  );
}
