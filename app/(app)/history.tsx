import React from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Empty, Row, ScoreRing, Screen, T } from '../../src/ui/components';
import { useData } from '../../src/data/AppData';
import { useLoad } from '../../src/ui/hooks';
import { addDays, dayLabel, fmt, pctText, toKey } from '../../src/ui/format';
import { summarizeDay } from '../../src/engines/aggregate';
import { colors } from '../../src/ui/theme';

/** Historique : toutes les journées enregistrées (notes recalculées depuis les aliments et quantités). */
export default function History() {
  const router = useRouter();
  const { repo, settings } = useData();
  const { data } = useLoad(async () => {
    const entries = await repo.entriesBetween('2000-01-01', toKey(new Date()), 'eaten');
    const by = new Map<string, typeof entries>();
    for (const e of entries) by.set(e.date, [...(by.get(e.date) ?? []), e]);
    return [...by.keys()].sort().reverse().slice(0, 365).map((d) => ({ date: d, n: by.get(d)!.length, s: summarizeDay(repo.toLogged(by.get(d)!), settings.goals, settings.primal) }));
  }, [settings]);
  void addDays;
  return (
    <Screen title="Historique" subtitle="Toutes vos journées conservées">
      {!data?.length ? <Empty icon="time-outline" title="Pas encore d’historique" text="Vos journées apparaîtront ici dès le premier repas." /> : data.map((d, i) => (
        <Card key={d.date} delay={Math.min(i, 8) * 30} onPress={() => router.navigate({ pathname: '/journal', params: { date: d.date } })} style={{ paddingVertical: 16 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Pressable style={{ flex: 1 }}>
              <T v="body" style={{ fontWeight: '600', textTransform: 'capitalize' }}>{dayLabel(d.date)}</T>
              <T v="caption">{d.n} aliment(s) · {fmt(d.s.calories.consumed)} kcal · {pctText(d.s.calories.percent)}</T>
            </Pressable>
            <ScoreRing score={d.s.primal?.total ?? null} size={50} stroke={5} />
            <ScoreRing score={d.s.micro.score} size={50} stroke={5} color={colors.beige} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
