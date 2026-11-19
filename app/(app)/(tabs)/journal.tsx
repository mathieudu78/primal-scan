import React, { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Empty, ProgressBar, Row, ScoreRing, Screen, SectionTitle, T } from '../../../src/ui/components';
import { colors, space } from '../../../src/ui/theme';
import { useDay } from '../../../src/ui/useDay';
import { addDays, dayLabel, fmt, MEAL_ICONS, MEAL_LABELS, MEAL_ORDER, pctText, toKey } from '../../../src/ui/format';
import { useData } from '../../../src/data/AppData';
import { nutrientsFor } from '../../../src/engines/nutrition';
import { percentOfDailyGoal } from '../../../src/engines/nutrition';

export default function Journal() {
  const router = useRouter();
  const { repo, changed, settings } = useData();
  const today = toKey(new Date());
  const params = useLocalSearchParams<{ date?: string }>();
  const [date, setDate] = useState(params.date ? String(params.date) : today);
  useEffect(() => { if (params.date) setDate(String(params.date)); }, [params.date]);
  const { data } = useDay(date);
  const s = data?.summary;

  const links = [['Planification', '/planner', 'calendar-outline'], ['Calendrier', '/calendar', 'grid-outline'], ['Historique', '/history', 'time-outline'], ['Statistiques', '/stats', 'stats-chart-outline'], ['Recettes', '/recipes', 'restaurant-outline'], ['Favoris', '/favorites', 'heart-outline']] as const;
  return (
    <Screen title="Journal" back={false}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable hitSlop={12} onPress={() => setDate(addDays(date, -1))}><Ionicons name="chevron-back" size={26} color={colors.cream} /></Pressable>
        <Pressable onPress={() => setDate(today)}><T v="heading" style={{ textTransform: 'capitalize' }}>{date === today ? 'Aujourd’hui' : dayLabel(date, true)}</T></Pressable>
        <Pressable hitSlop={12} onPress={() => setDate(addDays(date, 1))}><Ionicons name="chevron-forward" size={26} color={colors.cream} /></Pressable>
      </Row>

      <Card tone="forest">
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: 6 }}>
            <T v="label" style={{ color: colors.greenSoft }}>Calories</T>
            <T style={{ color: colors.cream, fontSize: 26, fontWeight: '700' }}>{fmt(s?.calories.consumed ?? 0)} <T v="caption" style={{ color: colors.greenSoft }}>/ {fmt(settings.goals.kcal)} kcal · {pctText(s?.calories.percent)}</T></T>
            <ProgressBar value={s?.calories.consumed ?? 0} max={settings.goals.kcal} color={colors.cream} over={s?.calories.over} />
          </View>
          <ScoreRing score={s?.primal?.total ?? null} size={72} stroke={7} />
        </Row>
      </Card>

      {MEAL_ORDER.map((t, i) => {
        const m = data?.meals[t];
        return (
          <Card key={t} delay={i * 50}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Pressable onPress={() => router.push({ pathname: '/meal', params: { date, type: t } })} style={{ flex: 1 }}>
                <Row><Ionicons name={MEAL_ICONS[t]} size={20} color={colors.greenSoft} /><T v="heading">{MEAL_LABELS[t]}</T></Row>
                {m?.entries.length ? <T v="caption">{fmt(m.summary.calories.consumed)} kcal · {pctText(m.summary.caloriePercentOfDay)} de l’objectif du jour</T> : null}
              </Pressable>
              <Pressable accessibilityLabel={`Ajouter à ${MEAL_LABELS[t]}`} onPress={() => router.push({ pathname: '/add-food', params: { date, type: t, status: 'eaten' } })} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="add" size={24} color="#08140E" />
              </Pressable>
            </Row>
            {m?.entries.map((e) => {
              const kcal = nutrientsFor(e.food, e.qty).kcal;
              return (
                <Pressable key={e.id} onLongPress={() => Alert.alert(e.food.name, 'Supprimer cet aliment du journal ?', [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: async () => { await repo.deleteEntry(e.id); changed(); } }])}
                  onPress={() => router.push({ pathname: '/food/[id]', params: { id: e.food.id } })} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 4 }}>
                  <View style={{ flex: 1 }}><T v="body" numberOfLines={1}>{e.food.name}</T><T v="caption">{fmt(e.qty.amount, 1)} {e.qty.unit === 'portion' ? 'portion(s)' : e.qty.unit}{e.qty.state ? ` (${e.qty.state === 'raw' ? 'cru' : 'cuit'})` : ''}</T></View>
                  <View style={{ alignItems: 'flex-end' }}><T v="body">{kcal === undefined ? '—' : `${fmt(kcal)} kcal`}</T><T v="caption">{pctText(kcal === undefined ? null : percentOfDailyGoal(kcal, settings.goals.kcal))}</T></View>
                </Pressable>
              );
            })}
          </Card>
        );
      })}
      {data && data.entries.length === 0 ? <Empty title="Journal vide" text="Ajoutez un aliment avec le bouton + ou scannez un produit." /> : <T v="caption" style={{ textAlign: 'center' }}>Appui long sur un aliment pour le supprimer.</T>}

      <SectionTitle>Outils</SectionTitle>
      <Row style={{ flexWrap: 'wrap' }} gap={8}>
        {links.map(([label, path, icon]) => <Chip key={path} label={label} onPress={() => router.push(path)} />)}
      </Row>
    </Screen>
  );
}
