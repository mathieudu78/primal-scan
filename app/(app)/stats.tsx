import React, { useState } from 'react';
import { View } from 'react-native';
import { Card, Chip, Empty, Field, Notice, ProgressBar, Row, ScoreRing, Screen, SectionTitle, T } from '../../src/ui/components';
import { BarChart, LineChart } from '../../src/ui/charts';
import { colors } from '../../src/ui/theme';
import { useData } from '../../src/data/AppData';
import { useLoad } from '../../src/ui/hooks';
import { addDays, dayLabel, fmt, monthRange, pctText, toKey } from '../../src/ui/format';
import { summarizePeriod } from '../../src/engines/aggregate';
import { NUTRIENT_BY_KEY } from '../../src/engines/nutrients';
import { FoodRow } from '../../src/ui/FoodRow';
import { useRouter } from 'expo-router';

type Range = '7' | '30' | 'month' | 'custom';

/** Statistiques : journalières → personnalisées. Les notes de période sont RECALCULÉES depuis tous les ingrédients et quantités. */
export default function Stats() {
  const router = useRouter();
  const { repo, settings } = useData();
  const today = toKey(new Date());
  const [range, setRange] = useState<Range>('7');
  const [cf, setCf] = useState(addDays(today, -13)); const [ct, setCt] = useState(today);
  const { from, to } = range === '7' ? { from: addDays(today, -6), to: today } : range === '30' ? { from: addDays(today, -29), to: today } : range === 'month' ? monthRange(today) : { from: cf, to: ct };
  const validCustom = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
  const { data } = useLoad(async () => {
    if (!validCustom) return null;
    const entries = await repo.entriesBetween(from, to, 'eaten');
    const by = new Map<string, typeof entries>();
    for (const e of entries) by.set(e.date, [...(by.get(e.date) ?? []), e]);
    return summarizePeriod([...by.entries()].map(([date, es]) => ({ date, items: repo.toLogged(es) })), settings.goals, settings.primal);
  }, [from, to, settings, validCustom]);

  return (
    <Screen title="Statistiques">
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <Chip label="7 jours" active={range === '7'} onPress={() => setRange('7')} /><Chip label="30 jours" active={range === '30'} onPress={() => setRange('30')} />
        <Chip label="Ce mois" active={range === 'month'} onPress={() => setRange('month')} /><Chip label="Personnalisée" active={range === 'custom'} onPress={() => setRange('custom')} />
      </Row>
      {range === 'custom' ? <Row gap={8}><View style={{ flex: 1 }}><Field label="Du (AAAA-MM-JJ)" value={cf} onChangeText={setCf} /></View><View style={{ flex: 1 }}><Field label="Au" value={ct} onChangeText={setCt} /></View></Row> : null}
      <T v="caption">{dayLabel(from)} → {dayLabel(to)}</T>
      {!validCustom ? <Notice tone="warn" text="Dates invalides." /> : !data || data.days === 0 ? <Empty icon="stats-chart-outline" title="Pas de données" text="Aucun repas consommé sur cette période." /> : (
        <>
          <Row style={{ alignItems: 'stretch' }} gap={12}>
            <Card style={{ flex: 1, alignItems: 'center' }}><T v="label">Primal</T><ScoreRing score={data.primal?.total ?? null} size={92} /><T v="caption">{data.primal?.label}</T></Card>
            <Card style={{ flex: 1, alignItems: 'center' }}><T v="label">Micro</T><ScoreRing score={data.micro.score} size={92} color={colors.beige} /><T v="caption">{data.micro.score === null ? 'Données absentes' : `${Math.round(data.micro.coverage * 100)} % des données`}</T></Card>
          </Row>
          <Notice text="Notes de période recalculées à partir de tous les aliments et quantités (pas une moyenne des notes journalières)." />
          <Card>
            <T v="label">Calories</T>
            <T style={{ fontSize: 28, fontWeight: '700' }}>{fmt(data.avgKcalPerDay)} <T v="caption">kcal / jour en moyenne · {data.days} jour(s) · {pctText((data.avgKcalPerDay / settings.goals.kcal) * 100)} de l’objectif</T></T>
            <BarChart data={data.perDay.map((d) => ({ label: dayLabel(d.date), value: d.kcal }))} goal={settings.goals.kcal} />
          </Card>
          <Card>
            <T v="label">Évolution des notes</T>
            <T v="caption" style={{ color: colors.greenSoft }}>— Primal (jour par jour)</T><LineChart data={data.perDay.map((d) => d.primal)} />
            <T v="caption" style={{ color: colors.beige }}>— Micronutriments</T><LineChart data={data.perDay.map((d) => d.micro)} color={colors.beige} />
          </Card>
          <Card>
            <T v="label">Macronutriments (moyenne / jour)</T>
            {(['protein', 'carbs', 'fat', 'fiber'] as const).map((k) => (
              <View key={k} style={{ gap: 4 }}>
                <Row style={{ justifyContent: 'space-between' }}><T v="body">{NUTRIENT_BY_KEY[k].label}</T><T v="caption">{fmt(data.totals[k].value / data.days, 1)} / {fmt(settings.goals[k])} g</T></Row>
                <ProgressBar value={data.totals[k].value / data.days} max={settings.goals[k]} height={6} />
              </View>
            ))}
          </Card>
          <Card>
            <T v="label">Vitamines & minéraux (moyenne / jour)</T>
            {data.micro.details.map((d) => (
              <Row key={d.key} style={{ justifyContent: 'space-between' }}>
                <T v="caption" style={{ flex: 1 }}>{NUTRIENT_BY_KEY[d.key].label}</T>
                <T v="caption">{d.status === 'no_data' ? 'donnée absente' : `${fmt(d.ratio! * 100)} % de la ${settings.goals.micro[d.key].kind === 'limit' ? 'limite' : 'cible'}`}</T>
              </Row>
            ))}
          </Card>
          <Card>
            <T v="label">Répartition des notes Primal (aliments distincts)</T>
            {Object.entries(data.distribution).map(([k, n]) => <Row key={k} style={{ justifyContent: 'space-between' }}><T v="body">{k}</T><T v="body">{n}</T></Row>)}
          </Card>
          <SectionTitle>Mieux notés</SectionTitle>
          {data.best.map((b) => <FoodRow key={b.food.id} food={b.food} onPress={() => router.push({ pathname: '/food/[id]', params: { id: b.food.id } })} />)}
          <SectionTitle>Moins bien notés</SectionTitle>
          {data.worst.map((b) => <FoodRow key={b.food.id} food={b.food} onPress={() => router.push({ pathname: '/food/[id]', params: { id: b.food.id } })} />)}
        </>
      )}
    </Screen>
  );
}
