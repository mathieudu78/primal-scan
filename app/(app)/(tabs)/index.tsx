import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, CountUp, ProgressBar, Row, ScoreRing, Screen, SectionTitle, T } from '../../../src/ui/components';
import { colors, radius, space } from '../../../src/ui/theme';
import { useDay } from '../../../src/ui/useDay';
import { dayLabel, fmt, MEAL_ICONS, MEAL_LABELS, MEAL_ORDER, pctText, toKey } from '../../../src/ui/format';
import { useData } from '../../../src/data/AppData';
import { NUTRIENT_BY_KEY } from '../../../src/engines/nutrients';

export default function Home() {
  const router = useRouter();
  const { settings } = useData();
  const today = toKey(new Date());
  const { data } = useDay(today);
  const s = data?.summary;
  const cal = s?.calories;
  const macros = [['protein', colors.green], ['carbs', colors.beige], ['fat', colors.greenSoft], ['fiber', colors.textSoft]] as const;
  const micro = s?.micro;
  const lows = micro?.details.filter((d) => d.status === 'low').length ?? 0;
  const noData = micro?.details.filter((d) => d.status === 'no_data').length ?? 0;

  return (
    <Screen title="Accueil" subtitle={dayLabel(today, true)} back={false}
      right={<Pressable accessibilityLabel="Rechercher" onPress={() => router.push('/search')} hitSlop={10} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="search" size={20} color={colors.cream} /></Pressable>}>
      <Card tone="forest" delay={0}>
        <T v="label" style={{ color: colors.greenSoft }}>Calories aujourd’hui</T>
        <Row style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <CountUp value={cal?.consumed ?? 0} style={{ color: colors.cream, fontSize: 48, fontWeight: '700', letterSpacing: -1 }} />
            <T v="caption" style={{ color: colors.greenSoft }}>sur {fmt(settings.goals.kcal)} kcal</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T style={{ color: colors.cream, fontSize: 22, fontWeight: '700' }}>{pctText(cal?.percent)}</T>
            <T v="caption" style={{ color: colors.greenSoft }}>{cal ? (cal.over ? `Dépassement : ${fmt(-cal.remaining)} kcal` : `Restant : ${fmt(cal.remaining)} kcal`) : ' '}</T>
          </View>
        </Row>
        <ProgressBar value={cal?.consumed ?? 0} max={settings.goals.kcal} color={colors.cream} over={cal?.over} height={10} />
      </Card>

      <Card delay={80}>
        <T v="label">Macronutriments</T>
        {macros.map(([k, c]) => {
          const m = s?.macros[k];
          return (
            <View key={k} style={{ gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T v="body">{NUTRIENT_BY_KEY[k].label}</T>
                <T v="caption">{fmt(m?.value ?? 0, 1)} / {fmt(m?.goal ?? 0)} g · {pctText(m?.percent)}</T>
              </Row>
              <ProgressBar value={m?.value ?? 0} max={m?.goal ?? 1} color={c} height={6} />
            </View>
          );
        })}
      </Card>

      <Row gap={space.md} style={{ alignItems: 'stretch' }}>
        <Card style={{ flex: 1, alignItems: 'center' }} delay={160}>
          <T v="label">Note Primal</T>
          <ScoreRing score={s?.primal?.total ?? null} />
          <T v="caption">{s?.primal?.label ?? 'Aucun repas'}</T>
        </Card>
        <Card style={{ flex: 1, alignItems: 'center' }} delay={200} onPress={() => router.push('/micronutrients')}>
          <T v="label">Micronutriments</T>
          <ScoreRing score={micro?.score ?? null} color={colors.beige} />
          <T v="caption">{micro?.score === null || !micro ? 'Pas de données' : `${Math.round(micro.coverage * 100)} % des données`}</T>
        </Card>
      </Row>

      <Card delay={240} onPress={() => router.push('/micronutrients')}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="label">Vitamines & minéraux</T><Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Row>
        <T v="caption">{micro && micro.coverage > 0 ? `${micro.details.length - noData} suivis aujourd’hui · ${lows} sous la cible · ${noData} sans donnée` : 'Ajoutez des repas pour voir vos apports.'}</T>
      </Card>

      <SectionTitle right={<Pressable onPress={() => router.push('/journal')}><T v="caption" style={{ color: colors.greenSoft }}>Journal</T></Pressable>}>Repas du jour</SectionTitle>
      {MEAL_ORDER.map((t, i) => {
        const m = data?.meals[t];
        return (
          <Card key={t} delay={280 + i * 40} onPress={() => router.push({ pathname: '/meal', params: { date: today, type: t } })} style={{ paddingVertical: space.lg }}>
            <Row>
              <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={MEAL_ICONS[t]} size={20} color={colors.greenSoft} /></View>
              <View style={{ flex: 1 }}>
                <T v="body" style={{ fontWeight: '600' }}>{MEAL_LABELS[t]}</T>
                <T v="caption">{m?.entries.length ? `${m.entries.length} aliment(s)` : 'Aucun aliment'}</T>
              </View>
              {m?.entries.length ? <View style={{ alignItems: 'flex-end' }}><T v="body" style={{ fontWeight: '600' }}>{fmt(m.summary.calories.consumed)} kcal</T><T v="caption">{pctText(m.summary.caloriePercentOfDay)} de l’objectif</T></View> : null}
            </Row>
          </Card>
        );
      })}
      <Button label="Scanner un produit" icon="scan" onPress={() => router.push('/scanner')} />
    </Screen>
  );
}
