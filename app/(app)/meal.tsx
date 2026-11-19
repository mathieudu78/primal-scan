import React from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Empty, ProgressBar, Row, ScoreRing, Screen, SectionTitle, T } from '../../src/ui/components';
import { colors, space } from '../../src/ui/theme';
import { useDay } from '../../src/ui/useDay';
import { dayLabel, fmt, MEAL_LABELS, pctText } from '../../src/ui/format';
import type { MealType } from '../../src/engines/types';
import { useData } from '../../src/data/AppData';
import { nutrientsFor, percentOfDailyGoal } from '../../src/engines/nutrition';
import { NUTRIENT_BY_KEY } from '../../src/engines/nutrients';

/** Détail d'un repas : aliments, quantités, calories, % de l'objectif JOURNALIER, macros, micro, notes. */
export default function Meal() {
  const { date, type } = useLocalSearchParams<{ date: string; type: MealType }>();
  const router = useRouter();
  const { repo, changed, settings } = useData();
  const { data } = useDay(String(date));
  const m = data?.meals[type as MealType];
  const s = m?.summary;
  return (
    <Screen title={MEAL_LABELS[type as MealType]} subtitle={dayLabel(String(date), true)}
      footer={<Button label="Ajouter un aliment" icon="add" onPress={() => router.push({ pathname: '/add-food', params: { date, type, status: 'eaten' } })} />}>
      {!m || !m.entries.length ? <Empty title="Aucun aliment" text="Ajoutez des aliments à ce repas." /> : (
        <>
          <Card tone="forest">
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <T v="label" style={{ color: colors.greenSoft }}>Calories du repas</T>
                <T style={{ color: colors.cream, fontSize: 34, fontWeight: '700' }}>{fmt(s!.calories.consumed)} kcal</T>
                <T v="caption" style={{ color: colors.greenSoft }}>{pctText(s!.caloriePercentOfDay)} de l’objectif journalier ({fmt(settings.goals.kcal)} kcal)</T>
              </View>
            </Row>
            <ProgressBar value={s!.caloriePercentOfDay ?? 0} max={100} color={colors.cream} />
          </Card>
          <Row style={{ alignItems: 'stretch' }} gap={space.md}>
            <Card style={{ flex: 1, alignItems: 'center' }}><T v="label">Primal</T><ScoreRing score={s!.primal?.total ?? null} size={88} /><T v="caption">{s!.primal?.label}</T></Card>
            <Card style={{ flex: 1, alignItems: 'center' }}><T v="label">Micro</T><ScoreRing score={s!.micro.score} size={88} color={colors.beige} /><T v="caption">{s!.micro.score === null ? 'Données absentes' : `${Math.round(s!.micro.coverage * 100)} % des données`}</T></Card>
          </Row>
          <Card>
            <T v="label">Macronutriments</T>
            {(['protein', 'carbs', 'fat', 'fiber'] as const).map((k) => (
              <Row key={k} style={{ justifyContent: 'space-between' }}><T v="body">{NUTRIENT_BY_KEY[k].label}</T><T v="body">{fmt(s!.macros[k].value, 1)} g <T v="caption">· {pctText(s!.macros[k].percent)} de l’objectif</T></T></Row>
            ))}
          </Card>
          <SectionTitle>Aliments</SectionTitle>
          {m.entries.map((e) => {
            const kcal = nutrientsFor(e.food, e.qty).kcal;
            return (
              <Card key={e.id} style={{ paddingVertical: 16 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}><T v="body" style={{ fontWeight: '600' }}>{e.food.name}</T><T v="caption">{fmt(e.qty.amount, 1)} {e.qty.unit === 'portion' ? 'portion(s)' : e.qty.unit}{e.qty.state ? ` · ${e.qty.state === 'raw' ? 'cru' : 'cuit'}` : ''}</T></View>
                  <View style={{ alignItems: 'flex-end' }}><T v="body">{kcal === undefined ? '—' : `${fmt(kcal)} kcal`}</T><T v="caption">{pctText(kcal === undefined ? null : percentOfDailyGoal(kcal, settings.goals.kcal))}</T></View>
                </Row>
                <Row gap={8}>
                  <Button style={{ flex: 1, minHeight: 40, paddingVertical: 8 }} variant="secondary" label="Modifier" onPress={() => router.push({ pathname: '/add-food', params: { entryId: e.id, date, type, status: 'eaten' } })} />
                  <Button style={{ flex: 1, minHeight: 40, paddingVertical: 8 }} variant="ghost" label="Supprimer" onPress={() => Alert.alert('Supprimer ?', e.food.name, [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: async () => { await repo.deleteEntry(e.id); changed(); } }])} />
                </Row>
              </Card>
            );
          })}
          <Button variant="secondary" label="Vitamines et minéraux de ce repas" onPress={() => router.push({ pathname: '/micronutrients', params: { date, type } })} />
        </>
      )}
    </Screen>
  );
}
