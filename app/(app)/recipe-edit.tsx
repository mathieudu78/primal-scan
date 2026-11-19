import React, { useSyncExternalStore } from 'react';
import { Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Chip, Field, ProgressBar, Row, ScoreRing, Screen, SectionTitle, T } from '../../src/ui/components';
import { colors } from '../../src/ui/theme';
import { useData } from '../../src/data/AppData';
import { getDraft, setDraft, subscribeDraft, type RecipeDraft } from '../../src/state/draft';
import { summarizeRecipe } from '../../src/engines/recipe';
import { fmt, pctText } from '../../src/ui/format';
import { nutrientsFor } from '../../src/engines/nutrition';

/** Création / édition d'une recette : ingrédients, quantités (cru ou cuit), portions, totaux et notes. */
export default function RecipeEdit() {
  const router = useRouter();
  const { repo, settings, changed } = useData();
  const d = useSyncExternalStore(subscribeDraft, getDraft, getDraft) as RecipeDraft | null;
  if (!d) return <Screen title="Recette"><T v="caption">Aucun brouillon.</T></Screen>;
  const upd = (patch: Partial<RecipeDraft>) => setDraft({ ...d, ...patch });
  const s = summarizeRecipe(d, settings.goals, settings.primal);
  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [4, 3] });
    if (!r.canceled && r.assets[0]) upd({ photoUri: r.assets[0].uri });
  };
  const save = async () => { await repo.saveRecipe({ id: d.id, name: d.name.trim(), photoUri: d.photoUri, servings: d.servings, items: d.items }); setDraft(null); changed(); router.back(); };
  return (
    <Screen title={d.id ? 'Modifier la recette' : 'Nouvelle recette'}
      footer={<Button label="Enregistrer la recette" disabled={d.name.trim().length < 2 || d.items.length === 0} onPress={save} />}>
      <Card>
        <Field label="Nom" value={d.name} onChangeText={(t) => upd({ name: t })} />
        <Pressable onPress={pick} style={{ height: d.photoUri ? 160 : 70, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {d.photoUri ? <Image source={{ uri: d.photoUri }} style={{ width: '100%', height: '100%' }} /> : <Row><Ionicons name="image-outline" size={22} color={colors.muted} /><T v="caption">Ajouter une photo (facultatif)</T></Row>}
        </Pressable>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="body">Nombre de portions</T>
          <Row gap={12}>
            <Chip label="−" onPress={() => upd({ servings: Math.max(1, d.servings - 1) })} /><T v="heading">{d.servings}</T><Chip label="+" onPress={() => upd({ servings: d.servings + 1 })} />
          </Row>
        </Row>
      </Card>

      <SectionTitle>Ingrédients</SectionTitle>
      {d.items.map((it, i) => (
        <Card key={i} style={{ paddingVertical: 14 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}><T v="body" style={{ fontWeight: '600' }}>{it.food.name}</T><T v="caption">{fmt(it.qty.amount, 1)} {it.qty.unit === 'portion' ? 'portion(s)' : it.qty.unit}{it.qty.state ? ` · ${it.qty.state === 'raw' ? 'cru' : 'cuit'}` : ''} · {fmt(nutrientsFor(it.food, it.qty).kcal)} kcal</T></View>
            <Ionicons name="trash-outline" size={22} color={colors.muted} onPress={() => upd({ items: d.items.filter((_, j) => j !== i) })} />
          </Row>
        </Card>
      ))}
      <Button variant="secondary" icon="add" label="Ajouter un ingrédient" onPress={() => router.push({ pathname: '/add-food', params: { target: 'recipe', date: '-', type: 'lunch' } })} />

      {d.items.length ? (
        <Card tone="forest">
          <T v="label" style={{ color: colors.greenSoft }}>Totaux</T>
          <Row style={{ justifyContent: 'space-between' }}>
            <View><T style={{ color: colors.cream, fontSize: 28, fontWeight: '700' }}>{fmt(s.kcalPerPortion)} kcal</T><T v="caption" style={{ color: colors.greenSoft }}>par portion · {pctText(s.percentOfDayPerPortion)} de l’objectif journalier</T><T v="caption" style={{ color: colors.greenSoft }}>Total : {fmt(s.kcalTotal)} kcal</T></View>
            <ScoreRing score={s.primal?.total ?? null} size={80} stroke={8} label="Primal" color={colors.cream} />
          </Row>
          {(['protein', 'carbs', 'fat', 'fiber'] as const).map((k) => <Row key={k} style={{ justifyContent: 'space-between' }}><T v="caption" style={{ color: colors.greenSoft }}>{({ protein: 'Protéines', carbs: 'Glucides', fat: 'Lipides', fiber: 'Fibres' })[k]} / portion</T><T v="body" style={{ color: colors.cream }}>{fmt(s.macrosPerPortion[k], 1)} g</T></Row>)}
          <Row style={{ justifyContent: 'space-between' }}><T v="caption" style={{ color: colors.greenSoft }}>Note micronutritionnelle (portion)</T><T v="body" style={{ color: colors.cream }}>{s.micro.score === null ? '—' : Math.round(s.micro.score)}</T></Row>
          <ProgressBar value={s.micro.score ?? 0} color={colors.beige} />
        </Card>
      ) : null}
    </Screen>
  );
}
