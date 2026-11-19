import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Chip, Empty, Notice, Row, Screen, T } from '../../src/ui/components';
import { colors, space } from '../../src/ui/theme';
import { useData } from '../../src/data/AppData';
import { useLoad } from '../../src/ui/hooks';
import { addDays, dayLabel, fmt, MEAL_ICONS, MEAL_LABELS, MEAL_ORDER, parseDate, pctText, startOfWeek, toKey } from '../../src/ui/format';
import { nutrientsFor, percentOfDailyGoal } from '../../src/engines/nutrition';
import type { MealType } from '../../src/engines/types';

/** Planification : repas PRÉVUS (jamais comptés comme consommés tant que vous ne les validez pas). */
export default function Planner() {
  const router = useRouter();
  const { repo, changed, settings } = useData();
  const today = toKey(new Date());
  const [week, setWeek] = useState(startOfWeek(today));
  const [sel, setSel] = useState(addDays(today, 1)); // par défaut : demain
  const [moving, setMoving] = useState<string | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const { data } = useLoad(() => repo.entriesBetween(week, addDays(week, 6), 'planned'), [week]);
  const dayEntries = (data ?? []).filter((e) => e.date === sel);
  const plannedKcal = dayEntries.reduce((a, e) => a + (nutrientsFor(e.food, e.qty).kcal ?? 0), 0);

  return (
    <Screen title="Planification" subtitle="Repas prévus"
      footer={<Button icon="add" label={`Planifier ${sel === addDays(today, 1) ? 'demain' : dayLabel(sel)}`} onPress={() => router.push({ pathname: '/add-food', params: { date: sel, type: 'lunch', status: 'planned' } })} />}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable hitSlop={12} onPress={() => setWeek(addDays(week, -7))}><Ionicons name="chevron-back" size={24} color={colors.cream} /></Pressable>
        <T v="body">Semaine du {parseDate(week).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</T>
        <Pressable hitSlop={12} onPress={() => setWeek(addDays(week, 7))}><Ionicons name="chevron-forward" size={24} color={colors.cream} /></Pressable>
      </Row>
      <Row gap={6} style={{ justifyContent: 'space-between' }}>
        {days.map((d) => {
          const has = (data ?? []).some((e) => e.date === d);
          return (
            <Pressable key={d} onPress={() => setSel(d)} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 18, backgroundColor: sel === d ? colors.forest : colors.surface, borderWidth: 1, borderColor: sel === d ? colors.green : colors.border }}>
              <T v="caption" style={{ fontSize: 11, textTransform: 'capitalize' }}>{parseDate(d).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</T>
              <T v="heading" style={{ fontSize: 16 }}>{parseDate(d).getDate()}</T>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: has ? colors.green : 'transparent' }} />
            </Pressable>
          );
        })}
      </Row>
      <Notice text={`Prévu pour ${dayLabel(sel)} : ${fmt(plannedKcal)} kcal (${pctText(percentOfDailyGoal(plannedKcal, settings.goals.kcal))} de l’objectif journalier). Ces repas ne sont pas comptés dans votre journal tant que vous ne les marquez pas comme mangés.`} />
      {!dayEntries.length ? <Empty icon="calendar-outline" title="Rien de prévu" text="Ajoutez les repas que vous prévoyez ce jour-là." /> : MEAL_ORDER.map((t) => {
        const es = dayEntries.filter((e) => e.mealType === t); if (!es.length) return null;
        return (
          <Card key={t}>
            <Row><Ionicons name={MEAL_ICONS[t]} size={18} color={colors.greenSoft} /><T v="heading">{MEAL_LABELS[t]}</T></Row>
            {es.map((e) => (
              <View key={e.id} style={{ gap: 8, paddingVertical: 6 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}><T v="body">{e.food.name}</T><T v="caption">{fmt(e.qty.amount, 1)} {e.qty.unit === 'portion' ? 'portion(s)' : e.qty.unit} · {fmt(nutrientsFor(e.food, e.qty).kcal)} kcal</T></View>
                </Row>
                <Row gap={6} style={{ flexWrap: 'wrap' }}>
                  <Chip label="Mangé ✓" onPress={async () => { await repo.markEaten(e.id); changed(); }} color={colors.green} />
                  <Chip label="Quantité" onPress={() => router.push({ pathname: '/add-food', params: { entryId: e.id, date: e.date, type: e.mealType, status: 'planned' } })} />
                  <Chip label="Déplacer" active={moving === e.id} onPress={() => setMoving(moving === e.id ? null : e.id)} />
                  <Chip label="Supprimer" onPress={async () => { await repo.deleteEntry(e.id); changed(); }} />
                </Row>
                {moving === e.id ? (
                  <View style={{ gap: 8 }}>
                    <Row gap={6} style={{ flexWrap: 'wrap' }}>{days.map((d) => <Chip key={d} label={dayLabel(d)} active={e.date === d} onPress={async () => { await repo.updateEntry(e.id, { date: d }); changed(); }} />)}</Row>
                    <Row gap={6} style={{ flexWrap: 'wrap' }}>{MEAL_ORDER.map((m: MealType) => <Chip key={m} label={MEAL_LABELS[m]} active={e.mealType === m} onPress={async () => { await repo.updateEntry(e.id, { mealType: m }); changed(); }} />)}</Row>
                  </View>
                ) : null}
              </View>
            ))}
          </Card>
        );
      })}
      <View style={{ height: space.md }} />
    </Screen>
  );
}
