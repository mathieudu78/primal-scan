import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Row, Screen, T } from '../../src/ui/components';
import { colors, space } from '../../src/ui/theme';
import { useData } from '../../src/data/AppData';
import { useLoad } from '../../src/ui/hooks';
import { addDays, fmt, monthRange, parseDate, startOfWeek, toKey } from '../../src/ui/format';
import { nutrientsFor } from '../../src/engines/nutrition';

/** Calendrier mensuel : calories consommées (chiffre) et repas prévus (point). */
export default function CalendarScreen() {
  const router = useRouter();
  const { repo } = useData();
  const today = toKey(new Date());
  const [cursor, setCursor] = useState(today);
  const [sel, setSel] = useState(today);
  const { from, to } = monthRange(cursor);
  const { data } = useLoad(() => repo.entriesBetween(from, to), [from, to]);
  const gridStart = startOfWeek(from);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const by = new Map<string, { kcal: number; planned: number; eaten: number }>();
  for (const e of data ?? []) {
    const c = by.get(e.date) ?? { kcal: 0, planned: 0, eaten: 0 };
    if (e.status === 'eaten') { c.kcal += nutrientsFor(e.food, e.qty).kcal ?? 0; c.eaten++; } else c.planned++;
    by.set(e.date, c);
  }
  const shift = (n: number) => { const d = parseDate(cursor); d.setMonth(d.getMonth() + n, 1); setCursor(toKey(d)); };
  const s = by.get(sel);
  return (
    <Screen title="Calendrier">
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable hitSlop={12} onPress={() => shift(-1)}><Ionicons name="chevron-back" size={24} color={colors.cream} /></Pressable>
        <T v="heading" style={{ textTransform: 'capitalize' }}>{parseDate(cursor).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</T>
        <Pressable hitSlop={12} onPress={() => shift(1)}><Ionicons name="chevron-forward" size={24} color={colors.cream} /></Pressable>
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((l, i) => <T key={i} v="caption" style={{ flex: 1, textAlign: 'center' }}>{l}</T>)}</Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d) => {
          const inMonth = d >= from && d <= to; const c = by.get(d);
          return (
            <Pressable key={d} onPress={() => setSel(d)} style={{ width: `${100 / 7}%`, aspectRatio: 0.85, padding: 2 }}>
              <View style={{ flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: sel === d ? colors.forest : 'transparent', borderWidth: d === today ? 1 : 0, borderColor: colors.greenSoft, opacity: inMonth ? 1 : 0.3 }}>
                <T v="body" style={{ fontSize: 14 }}>{parseDate(d).getDate()}</T>
                <T v="caption" style={{ fontSize: 9 }}>{c?.eaten ? fmt(c.kcal) : ' '}</T>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c?.planned ? colors.beige : 'transparent' }} />
              </View>
            </Pressable>
          );
        })}
      </View>
      <Card>
        <T v="heading" style={{ textTransform: 'capitalize' }}>{parseDate(sel).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</T>
        <T v="caption">{s?.eaten ? `${fmt(s.kcal)} kcal consommées · ${s.eaten} aliment(s)` : 'Rien de consommé'}{s?.planned ? ` · ${s.planned} prévu(s)` : ''}</T>
        <Row gap={8}>
          <Button style={{ flex: 1 }} label="Journal" onPress={() => router.navigate({ pathname: '/journal', params: { date: sel } })} />
          <Button style={{ flex: 1 }} variant="secondary" label="Planifier" onPress={() => router.push({ pathname: '/add-food', params: { date: sel, type: 'lunch', status: 'planned' } })} />
        </Row>
      </Card>
      <View style={{ height: space.md }} />
    </Screen>
  );
}
