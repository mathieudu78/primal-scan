import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, T } from '../src/ui/components';
import { colors, space } from '../src/ui/theme';
import { useAuth } from '../src/auth/AuthProvider';
import { LOCK_MESSAGES } from '../src/auth/sessionPolicy';

/** Affiché quand l'appareil perd son autorisation. Aucune donnée privée n'est rendue ici. */
export default function Locked() {
  const { access, acknowledgeLock } = useAuth();
  const insets = useSafeAreaInsets();
  const reason = access.status === 'locked' ? access.reason : 'revoked';
  const msg = LOCK_MESSAGES[reason];
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.xl, paddingTop: insets.top + 80, paddingBottom: insets.bottom + space.xl, justifyContent: 'space-between' }}>
      <Animated.View entering={FadeInDown.duration(600)} style={{ alignItems: 'center', gap: space.lg }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="lock-closed" size={42} color={colors.beige} />
        </View>
        <T v="title" style={{ textAlign: 'center' }}>{msg.title}</T>
        <T v="body" style={{ textAlign: 'center', color: colors.textSoft }}>{msg.body}</T>
      </Animated.View>
      <Button label="Se reconnecter" onPress={acknowledgeLock} />
    </View>
  );
}
