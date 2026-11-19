import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, Field, ProgressBar, Row, ScoreRing, Screen, SectionTitle, T } from '../../src/ui/components';
import { colors } from '../../src/ui/theme';
import { useData } from '../../src/data/AppData';
import { useDay } from '../../src/ui/useDay';
import { loadFood } from '../../src/data/foodService';
import { scoreMicroFood, type MicroResult, type MicroStatus } from '../../src/engines/micro';
import { NUTRIENT_BY_KEY, MINERALS, VITAMINS, type MicroKey } from '../../src/engines/nutrients';
import type { MealType } from '../../src/engines/types';
import { fmt, MEAL_LABELS, toKey } from '../../src/ui/format';

const STATUS: Record<MicroStatus, { label: string; color: string }> = {
  low: { label: 'Sous la cible', color: colors.warn }, ok: { label: 'Dans la cible', color: colors.green }, high: { label: 'Au-dessus de la cible', color: colors.greenSoft },
  over_limit: { label: 'Au-delà de la limite', color: colors.danger }, no_data: { label: 'Donnée absente', color: colors.muted },
};

/** Vitamines et minéraux : aliment, repas ou journée. Les données absentes ne sont jamais comptées comme 0. */
export default function Micronutrients() {
  const p = useLocalSearchParams<{ foodId?: string; date?: string; type?: MealType }>();
  const { repo, settings, saveSettings } = useData();
  const date = p.date ? String(p.date) : toKey(new Date());
  const { data: day } = useDay(date);
  const [foodRes, setFoodRes] = useState<{ name: string; res: MicroResult } | null>(null);
  const [editing, setEditing] = useState(false);
  const [targets, setTargets] = useState<Record<string, string>>({});

  useEffect(() => { if (p.foodId) void loadFood(repo, String(p.foodId)).then((f) => f && setFoodRes({ name: f.name, res: scoreMicroFood(f, settings.goals.micro) })); }, [p.foodId, repo, settings.goals.micro]);

  const res = p.foodId ? foodRes?.res : p.type ? day?.meals[p.type as MealType].summary.micro : day?.summary.micro;
  const subtitle = p.foodId ? `${foodRes?.name ?? ''} · pour 100 g, comparé à 25 % des cibles` : p.type ? `${MEAL_LABELS[p.type as MealType]} · comparé à la part habituelle du repas` : 'Aujourd’hui';

  const startEdit = () => { setTargets(Object.fromEntries([...VITAMINS, ...MINERALS].map((k) => [k, String(settings.goals.micro[k].target)]))); setEditing(true); };
  const saveTargets = async () => {
    const micro = { ...settings.goals.micro };
    for (const k of [...VITAMINS, ...MINERALS] as MicroKey[]) { const v = parseFloat((targets[k] ?? '').replace(',', '.')); if (Number.isFinite(v) && v > 0) micro[k] = { ...micro[k], target: v }; }
    await saveSettings({ ...settings, goals: { ...settings.goals, micro } }); setEditing(false);
  };

  const group = (title: string, keys: readonly MicroKey[]) => (
    <>
      <SectionTitle>{title}</SectionTitle>
      {keys.map((k) => {
        const d = res?.details.find((x) => x.key === k); const def = NUTRIENT_BY_KEY[k]; const st = d ? STATUS[d.status] : STATUS.no_data;
        const ref = settings.goals.micro[k];
        return (
          <Card key={k} style={{ paddingVertical: 16, gap: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}><T v="body" style={{ fontWeight: '600' }}>{def.label}</T><Badge text={st.label} color={st.color} /></Row>
            {editing ? <Field label={`Cible (${def.unit}/jour)${ref.kind === 'limit' ? ' — plafond' : ''}`} value={targets[k]} onChangeText={(t) => setTargets((v) => ({ ...v, [k]: t }))} keyboardType="decimal-pad" /> : (
              <>
                <ProgressBar value={d?.intake ?? 0} max={d?.target ?? ref.target} color={st.color} height={6} />
                <T v="caption">{d && d.intake !== null ? `${fmt(d.intake, 2)} ${def.unit}` : 'Donnée absente'} · {ref.kind === 'limit' ? 'plafond' : 'cible'} {fmt(ref.target, 2)} {def.unit}/jour{d && d.completeness < 1 && d.intake !== null ? ` · connu pour ${Math.round(d.completeness * 100)} % de la masse` : ''}</T>
              </>
            )}
          </Card>
        );
      })}
    </>
  );
  return (
    <Screen title="Vitamines & minéraux" subtitle={subtitle}
      footer={editing ? <Row><Button style={{ flex: 1 }} variant="ghost" label="Annuler" onPress={() => setEditing(false)} /><Button style={{ flex: 2 }} label="Enregistrer les cibles" onPress={saveTargets} /></Row> : undefined}>
      <Card style={{ alignItems: 'center' }}>
        <ScoreRing score={res?.score ?? null} size={110} color={colors.beige} />
        <T v="caption" style={{ textAlign: 'center' }}>{res?.score === null || !res ? 'Aucune donnée micronutritionnelle disponible' : `Note calculée sur ${Math.round(res.coverage * 100)} % des micronutriments (données disponibles uniquement). Un excès n’améliore pas la note.`}</T>
      </Card>
      {group('Vitamines', VITAMINS)}
      {group('Minéraux', MINERALS)}
      {!editing ? <Button variant="secondary" label="Modifier mes cibles" onPress={startEdit} /> : null}
      <T v="caption">Valeurs de référence adulte approximatives (VNR européens / repères ANSES), modifiables. Elles ne constituent pas un avis médical.</T>
      <View />
    </Screen>
  );
}
