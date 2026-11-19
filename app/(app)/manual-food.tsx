import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Field, Notice, Screen, SectionTitle, T } from '../../src/ui/components';
import { useData } from '../../src/data/AppData';
import { uid } from '../../src/db/repo';
import type { Food, NutrientMap } from '../../src/engines/types';
import { NUTRIENTS, type NutrientKey } from '../../src/engines/nutrients';
import { extractIngredients } from '../../src/data/ocr';

const MAIN: NutrientKey[] = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'satFat', 'sugars', 'salt'];

/** Saisie manuelle d'un aliment/produit. Champ vide = donnée ABSENTE (jamais 0 par défaut). */
export default function ManualFood() {
  const p = useLocalSearchParams<{ barcode?: string; ingredients?: string; name?: string }>();
  const router = useRouter();
  const { repo, changed } = useData();
  const [name, setName] = useState(p.name ?? '');
  const [brand, setBrand] = useState('');
  const [ingredients, setIngredients] = useState(p.ingredients ?? '');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [showMicro, setShowMicro] = useState(false);
  const [portion, setPortion] = useState('');
  const [liquid, setLiquid] = useState(false);

  const keys = showMicro ? NUTRIENTS.filter((n) => n.group === 'vitamin' || n.group === 'mineral').map((n) => n.key) : [];
  const save = async () => {
    const nutrients: NutrientMap = {};
    for (const k of [...MAIN, ...keys]) {
      const raw = vals[k]?.trim(); if (!raw) continue;
      const n = parseFloat(raw.replace(',', '.')); if (Number.isFinite(n) && n >= 0) nutrients[k] = n;
    }
    const food: Food = {
      id: `custom:${uid()}`, name: name.trim(), brand: brand.trim() || undefined, barcode: p.barcode, source: 'custom', nutrients,
      basis: liquid ? 'ml' : 'g', ingredientsText: extractIngredients(`Ingrédients: ${ingredients}`) ?? (ingredients.trim() || undefined),
      portionSize: parseFloat(portion.replace(',', '.')) > 0 ? parseFloat(portion.replace(',', '.')) : undefined,
    };
    await repo.saveFood(food); changed();
    router.replace({ pathname: '/result', params: { foodId: food.id } });
  };
  const set = (k: string) => (t: string) => setVals((v) => ({ ...v, [k]: t }));
  return (
    <Screen title="Saisie manuelle" subtitle={p.barcode ? `Code-barres ${p.barcode}` : undefined}
      footer={<Button label="Enregistrer et analyser" disabled={name.trim().length < 2} onPress={save} />}>
      <Notice text="Renseignez uniquement ce que vous connaissez (pour 100 g ou 100 ml). Un champ vide reste « donnée absente » : rien n’est inventé." />
      <Card>
        <Field label="Nom" value={name} onChangeText={setName} />
        <Field label="Marque (facultatif)" value={brand} onChangeText={setBrand} />
        <Field label="Liste d’ingrédients (facultatif)" value={ingredients} onChangeText={setIngredients} multiline style={{ minHeight: 90, textAlignVertical: 'top' }} />
        <Field label="Poids d’une portion (g/ml, facultatif)" value={portion} onChangeText={setPortion} keyboardType="decimal-pad" />
        <Button variant={liquid ? 'primary' : 'secondary'} label={liquid ? 'Valeurs pour 100 ml (liquide)' : 'Valeurs pour 100 g'} onPress={() => setLiquid(!liquid)} />
      </Card>
      <SectionTitle>Valeurs nutritionnelles pour 100 {liquid ? 'ml' : 'g'}</SectionTitle>
      <Card>
        {MAIN.map((k) => { const d = NUTRIENTS.find((n) => n.key === k)!; return <Field key={k} label={`${d.label} (${d.unit})`} value={vals[k] ?? ''} onChangeText={set(k)} keyboardType="decimal-pad" placeholder="—" />; })}
      </Card>
      <Button variant="ghost" label={showMicro ? 'Masquer vitamines et minéraux' : 'Ajouter vitamines et minéraux'} onPress={() => setShowMicro(!showMicro)} />
      {showMicro ? <Card>{keys.map((k) => { const d = NUTRIENTS.find((n) => n.key === k)!; return <Field key={k} label={`${d.label} (${d.unit})`} value={vals[k] ?? ''} onChangeText={set(k)} keyboardType="decimal-pad" placeholder="—" />; })}</Card> : null}
      <T v="caption">Ces données restent privées et sont synchronisées avec votre compte.</T>
    </Screen>
  );
}
