import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, Row, Screen, SectionTitle, T } from '../../../src/ui/components';
import { colors, radius } from '../../../src/ui/theme';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useData } from '../../../src/data/AppData';

const Item = ({ icon, label, to, sub }: { icon: keyof typeof Ionicons.glyphMap; label: string; to: string; sub?: string }) => {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(to)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={20} color={colors.greenSoft} /></View>
      <View style={{ flex: 1 }}><T v="body" style={{ fontWeight: '600' }}>{label}</T>{sub ? <T v="caption">{sub}</T> : null}</View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
};

export default function Profile() {
  const { access, signOut } = useAuth();
  const { sync } = useData();
  if (access.status !== 'active') return null;
  const u = access.user;
  return (
    <Screen title="Profil" back={false}>
      <Card tone="forest">
        <Row>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}><T v="title">{(u.displayName ?? u.email)[0]?.toUpperCase()}</T></View>
          <View style={{ flex: 1 }}><T v="heading">{u.displayName ?? 'Mon compte'}</T><T v="caption" style={{ color: colors.greenSoft }}>{u.email}</T></View>
          {u.role === 'owner' ? <Badge text="Propriétaire" color={colors.beige} /> : null}
        </Row>
        <T v="caption" style={{ color: colors.greenSoft }}>{access.offline ? 'Hors ligne' : sync.pending > 0 ? `${sync.pending} modification(s) à synchroniser` : 'Données synchronisées'}</T>
      </Card>
      <Card>
        <Item icon="flag-outline" label="Objectifs" to="/goals" sub="Calories, macros" />
        <Item icon="flask-outline" label="Vitamines & minéraux" to="/micronutrients" />
        <Item icon="stats-chart-outline" label="Statistiques" to="/stats" />
        <Item icon="time-outline" label="Historique" to="/history" />
        <Item icon="restaurant-outline" label="Recettes" to="/recipes" />
        <Item icon="heart-outline" label="Favoris" to="/favorites" />
        <Item icon="chatbubble-ellipses-outline" label="Assistant nutritionnel" to="/assistant" sub="Local, sans IA" />
        <Item icon="settings-outline" label="Paramètres" to="/settings" />
      </Card>
      {u.role === 'owner' ? (
        <>
          <SectionTitle>Administration</SectionTitle>
          <Card>
            <Item icon="key-outline" label="Gestion des invitations" to="/admin-invites" />
            <Item icon="phone-portrait-outline" label="Gestion des appareils" to="/admin-devices" />
          </Card>
        </>
      ) : null}
      <Button variant="ghost" label="Se déconnecter" icon="log-out-outline" onPress={signOut} />
    </Screen>
  );
}
