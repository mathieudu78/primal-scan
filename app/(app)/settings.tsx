import React, { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Chip, Field, Notice, Row, Screen, SectionTitle, T } from '../../src/ui/components';
import { colors } from '../../src/ui/theme';
import { useAuth } from '../../src/auth/AuthProvider';
import { useData } from '../../src/data/AppData';
import { supabase } from '../../src/lib/supabase';
import { DEFAULT_PRIMAL_CONFIG, type PrimalConfig } from '../../src/engines/primal/score';
import { OFFLINE_MAX_MS } from '../../src/auth/sessionPolicy';
import { fmt } from '../../src/ui/format';

const OVERRIDES: Array<[keyof PrimalConfig['naturalnessOverrides'], string, number]> = [
  ['dairy', 'Considérer les produits laitiers comme 100 % naturels', 1],
  ['grain_whole', 'Considérer les céréales complètes comme 100 % naturelles', 1],
  ['legume', 'Considérer les légumineuses comme 100 % naturelles', 1],
];
const WEIGHTS: Array<[keyof PrimalConfig['weights'], string]> = [['naturalness', 'Naturalité'], ['transformation', 'Transformation'], ['additives', 'Additifs'], ['fats', 'Matières grasses'], ['nutrition', 'Qualité nutritionnelle'], ['simplicity', 'Simplicité & transparence']];

export default function Settings() {
  const router = useRouter();
  const { access, signOut } = useAuth();
  const { settings, saveSettings, sync } = useData();
  const [name, setName] = useState(access.status === 'active' ? access.user.displayName ?? '' : '');
  if (access.status !== 'active') return null;
  const primal = settings.primal;
  const setPrimal = (p: PrimalConfig) => saveSettings({ ...settings, primal: p });
  return (
    <Screen title="Paramètres">
      <SectionTitle>Profil</SectionTitle>
      <Card>
        <Field label="Prénom affiché" value={name} onChangeText={setName} />
        <Button variant="secondary" label="Enregistrer" onPress={async () => { await supabase.from('profiles').update({ display_name: name.trim() || null }).eq('id', access.user.id); Alert.alert('Enregistré'); }} />
      </Card>

      <SectionTitle>Objectifs</SectionTitle>
      <Card>
        <T v="body">Calories : {fmt(settings.goals.kcal)} kcal · Protéines {fmt(settings.goals.protein)} g · Glucides {fmt(settings.goals.carbs)} g · Lipides {fmt(settings.goals.fat)} g</T>
        <Row gap={8}><Button style={{ flex: 1 }} variant="secondary" label="Calories & macros" onPress={() => router.push('/goals')} /><Button style={{ flex: 1 }} variant="secondary" label="Vitamines & minéraux" onPress={() => router.push('/micronutrients')} /></Row>
      </Card>

      <SectionTitle>Critères Primal</SectionTitle>
      <Card>
        <T v="caption">Points maximum de chaque critère (la note reste ramenée sur 100). Les calories n’interviennent jamais.</T>
        {WEIGHTS.map(([k, label]) => (
          <Row key={k} style={{ justifyContent: 'space-between' }}>
            <T v="body" style={{ flex: 1 }}>{label}</T>
            <Row gap={8}><Chip label="−" onPress={() => setPrimal({ ...primal, weights: { ...primal.weights, [k]: Math.max(0, primal.weights[k] - 5) } })} /><T v="heading" style={{ minWidth: 28, textAlign: 'center' }}>{primal.weights[k]}</T><Chip label="+" onPress={() => setPrimal({ ...primal, weights: { ...primal.weights, [k]: primal.weights[k] + 5 } })} /></Row>
          </Row>
        ))}
        {OVERRIDES.map(([cls, label, v]) => (
          <Row key={cls} style={{ justifyContent: 'space-between' }}>
            <T v="caption" style={{ flex: 1 }}>{label}</T>
            <Switch value={primal.naturalnessOverrides[cls] === v} trackColor={{ true: colors.green, false: colors.surfaceAlt }} onValueChange={(on) => { const o = { ...primal.naturalnessOverrides }; if (on) o[cls] = v; else delete o[cls]; void setPrimal({ ...primal, naturalnessOverrides: o }); }} />
          </Row>
        ))}
        <Button variant="ghost" label="Rétablir les critères par défaut" onPress={() => setPrimal(DEFAULT_PRIMAL_CONFIG)} />
      </Card>

      <SectionTitle>Unités</SectionTitle>
      <Card><T v="body">Énergie : kilocalories (kcal) · Masses : g / ml</T></Card>

      <SectionTitle>Synchronisation</SectionTitle>
      <Card>
        <T v="body">{access.offline ? 'Hors ligne' : sync.error ? `Erreur : ${sync.error}` : sync.lastSyncAt ? `Dernière synchro : ${new Date(sync.lastSyncAt).toLocaleTimeString('fr-FR')}` : 'Pas encore synchronisé'}</T>
        <T v="caption">{sync.pending} modification(s) en attente. Vos données restent utilisables hors ligne.</T>
        <Button variant="secondary" label="Synchroniser maintenant" onPress={() => void sync.syncNow()} />
      </Card>

      <SectionTitle>Compte</SectionTitle>
      <Card>
        <T v="body">{access.user.email}</T>
        <Notice text="Votre compte n’est utilisable que sur un seul appareil à la fois : se connecter sur un autre téléphone déconnecte celui-ci." />
        <Button variant="danger" label="Se déconnecter" onPress={signOut} />
      </Card>

      <SectionTitle>Confidentialité</SectionTitle>
      <Card>
        <T v="caption">• Vos repas, recettes et réglages sont stockés sur votre téléphone et synchronisés avec VOTRE compte, isolés des autres utilisateurs (règles de sécurité côté serveur).</T>
        <T v="caption">• Les codes-barres sont envoyés à Open Food Facts pour identifier un produit ; aucune donnée personnelle ne leur est transmise.</T>
        <T v="caption">• La lecture de texte (OCR) et toutes les notes sont calculées sur l’appareil.</T>
        <T v="caption">• Hors ligne, l’accès à vos données est maintenu au maximum {Math.round(OFFLINE_MAX_MS / 3600000)} h sans vérification du serveur, puis verrouillé jusqu’à la reconnexion.</T>
        <View />
      </Card>
    </Screen>
  );
}
