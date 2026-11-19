import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';
import { AppDataProvider, useData } from '../../src/data/AppData';
import { useAuth } from '../../src/auth/AuthProvider';
import { colors } from '../../src/ui/theme';
import { Notice } from '../../src/ui/components';

function Inner() {
  const { settings } = useData();
  const { access } = useAuth();
  if (!settings.setupDone) return <Redirect href="/setup" />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {access.status === 'active' && access.offline ? <View style={{ position: 'absolute', top: 50, left: 16, right: 16, zIndex: 10 }}><Notice tone="warn" text="Hors ligne — la session sera revérifiée dès que la connexion revient." /></View> : null}
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="setup" options={{ animation: 'fade' }} />
        <Stack.Screen name="add-food" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="manual-food" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </View>
  );
}

export default function AppLayout() {
  const { access } = useAuth();
  if (access.status !== 'active') return null;
  return <AppDataProvider userId={access.user.id} offline={access.offline}><Inner /></AppDataProvider>;
}
