import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { colors } from '@/constants/theme';
function TabIcon({ name, color }: { name: React.ComponentProps<typeof FontAwesome>['name']; color: string }) {
  return <FontAwesome size={22} style={{ marginBottom: -2 }} name={name} color={color} />;
}
export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: colors.brand.purple, tabBarInactiveTintColor: colors.text.muted,
      tabBarStyle: { backgroundColor: colors.surface.card, borderTopColor: colors.surface.border, height: 64, paddingBottom: 8, paddingTop: 8 },
      tabBarLabelStyle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11 },
      headerStyle: { backgroundColor: colors.surface.background },
      headerTitleStyle: { fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.text.primary },
      headerShadowVisible: false,
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon name="home" color={String(color)} /> }} />
      <Tabs.Screen name="circle" options={{ title: 'My Circle', tabBarIcon: ({ color }) => <TabIcon name="circle-o" color={String(color)} /> }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: ({ color }) => <TabIcon name="search" color={String(color)} /> }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: ({ color }) => <TabIcon name="bell" color={String(color)} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabIcon name="user" color={String(color)} /> }} />
    </Tabs>
  );
}
