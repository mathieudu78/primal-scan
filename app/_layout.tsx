import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { colors } from '../src/ui/theme';

void SplashScreen.preventAutoHideAsync();

function RootNav() {
  const { access } = useAuth();
  useEffect(() => { if (access.status !== 'loading') void SplashScreen.hideAsync(); }, [access.status]);
  if (access.status === 'loading') return null; // l'écran de démarrage natif reste affiché
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={access.status === 'signedOut'}><Stack.Screen name="(auth)" /></Stack.Protected>
      <Stack.Protected guard={access.status === 'locked'}><Stack.Screen name="locked" /></Stack.Protected>
      <Stack.Protected guard={access.status === 'active'}><Stack.Screen name="(app)" /></Stack.Protected>
    </Stack>
  );
}

export default function Root() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthProvider><RootNav /></AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
