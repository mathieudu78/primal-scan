import React, { useState } from 'react';
import { Button, Card, Chip, Field, Notice, Row, SectionTitle, T } from './components';
import type { Goals, BodyProfile } from '../engines/goals';
import { suggestGoals } from '../engines/goals';
import { fmt } from './format';

type Sug = ReturnType<typeof suggestGoals>;
const ACT: Array<[BodyProfile['activity'], string]> = [['sedentary', 'Sédentaire'], ['light', 'Légère'], ['moderate', 'Modérée'], ['active', 'Active'], ['very_active', 'Très active']];

/** Objectifs : valeurs modifiables à la main ; la proposition automatique n'est JAMAIS appliquée sans votre accord. */
export function GoalsForm({ goals, profile, onChange, onProfile }: {
  goals: Goals; profile?: BodyProfile; onChange: (g: Goals) => void; onProfile: (p: BodyProfile) => void;
}) {
  const [p, setP] = useState<{ sex: 'male' | 'female'; age: string; w: string; h: string; act: BodyProfile['activity'] }>({
    sex: profile?.sex ?? 'male', age: String(profile?.age ?? ''), w: String(profile?.weightKg ?? ''), h: String(profile?.heightCm ?? ''), act: profile?.activity ?? 'moderate' });
  const [sug, setSug] = useState<Sug | null>(null);
  const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const profileOk = num(p.age) > 10 && num(p.w) > 20 && num(p.h) > 100;
  const compute = () => {
    const bp: BodyProfile = { sex: p.sex, age: num(p.age), weightKg: num(p.w), heightCm: num(p.h), activity: p.act };
    onProfile(bp); setSug(suggestGoals(bp));
  };
  const field = (key: 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber', label: string, unit: string) => (
    <Field key={key} label={`${label} (${unit})`} keyboardType="decimal-pad" value={String(goals[key])}
      onChangeText={(t) => { const n = num(t); onChange({ ...goals, [key]: Number.isFinite(n) && n >= 0 ? n : 0 }); }} />
  );
  return (
    <>
      <Card>
        <T v="label">Objectifs quotidiens</T>
        {field('kcal', 'Calories', 'kcal')}{field('protein', 'Protéines', 'g')}{field('carbs', 'Glucides', 'g')}{field('fat', 'Lipides', 'g')}{field('fiber', 'Fibres', 'g')}
        <T v="caption">Le pourcentage calorique de chaque aliment et repas est toujours calculé par rapport à l’objectif calorique JOURNALIER. Modifier l’objectif ne change ni les calories consommées ni les notes.</T>
      </Card>
      <SectionTitle>Proposition automatique (facultative)</SectionTitle>
      <Card>
        <Row gap={8}><Chip label="Homme" active={p.sex === 'male'} onPress={() => setP({ ...p, sex: 'male' })} /><Chip label="Femme" active={p.sex === 'female'} onPress={() => setP({ ...p, sex: 'female' })} /></Row>
        <Field label="Âge" keyboardType="number-pad" value={p.age} onChangeText={(t) => setP({ ...p, age: t })} />
        <Field label="Poids (kg)" keyboardType="decimal-pad" value={p.w} onChangeText={(t) => setP({ ...p, w: t })} />
        <Field label="Taille (cm)" keyboardType="decimal-pad" value={p.h} onChangeText={(t) => setP({ ...p, h: t })} />
        <Row gap={8} style={{ flexWrap: 'wrap' }}>{ACT.map(([k, l]) => <Chip key={k} label={l} active={p.act === k} onPress={() => setP({ ...p, act: k })} />)}</Row>
        <Button variant="secondary" label="Calculer une proposition" disabled={!profileOk} onPress={compute} />
        {sug ? (
          <>
            <Notice text={`Proposition (formule de Mifflin-St Jeor) : ${fmt(sug.kcal)} kcal · ${fmt(sug.protein)} g de protéines · ${fmt(sug.carbs)} g de glucides · ${fmt(sug.fat)} g de lipides · ${fmt(sug.fiber)} g de fibres. Elle n’est appliquée que si vous le décidez.`} />
            <Button label="Appliquer cette proposition" onPress={() => { onChange({ ...goals, ...sug }); setSug(null); }} />
          </>
        ) : null}
      </Card>
    </>
  );
}
