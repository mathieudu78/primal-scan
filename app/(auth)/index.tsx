import React from 'react';
import { Image, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Notice, T } from '../../src/ui/components';
import { colors, space } from '../../src/ui/theme';
import { useAuth } from '../../src/auth/AuthProvider';

/** Écran « Démarrage / Bienvenue » */
export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { configured } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: insets.top + 60, paddingBottom: insets.bottom + space.xl, justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'center', gap: space.lg }}>
        <Animated.View entering={FadeIn.duration(900)}>
          <Image source={require('../../assets/icon.png')} style={{ width: 132, height: 132, borderRadius: 36 }} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(300).duration(700)} style={{ alignItems: 'center', gap: 8 }}>
          <T v="display" style={{ letterSpacing: 2, fontSize: 34 }}>PRIMAL SCAN</T>
          <T v="body" style={{ color: colors.textSoft, textAlign: 'center' }}>Scannez, analysez et suivez votre alimentation selon la philosophie Primal.</T>
        </Animated.View>
      </View>
      <Animated.View entering={FadeInDown.delay(600).duration(700)} style={{ gap: space.md }}>
        {!configured ? <Notice tone="warn" text="Application non configurée : renseignez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY (voir README)." /> : null}
        <Button label="J’ai un code d’invitation" icon="key-outline" onPress={() => router.push('/invite')} disabled={!configured} />
        <Button label="Se connecter" variant="secondary" onPress={() => router.push('/login')} disabled={!configured} />
        <T v="caption" style={{ textAlign: 'center', marginTop: 4 }}>Application privée — l’accès se fait uniquement sur invitation.</T>
      </Animated.View>
    </View>
  );
}
