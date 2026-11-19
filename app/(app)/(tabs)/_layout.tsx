import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../src/ui/theme';

const icon = (name: keyof typeof Ionicons.glyphMap, focused: keyof typeof Ionicons.glyphMap) =>
  ({ color, focused: f, size }: { color: unknown; focused: boolean; size: number }) => <Ionicons name={f ? focused : name} size={size} color={color as string} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false, tabBarActiveTintColor: colors.greenSoft, tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 78, paddingTop: 8, paddingBottom: 18, borderTopLeftRadius: 28, borderTopRightRadius: 28, position: 'absolute' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="scanner" options={{ title: 'Scanner', tabBarIcon: icon('scan-outline', 'scan') }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal', tabBarIcon: icon('book-outline', 'book') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: icon('person-outline', 'person') }} />
    </Tabs>
  );
}
