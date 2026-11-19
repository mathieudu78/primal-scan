import React, { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Chip, Empty, Field, Notice, Row, Screen, SectionTitle, T } from '../../src/ui/components';
import { FoodRow } from '../../src/ui/FoodRow';
import { colors, space } from '../../src/ui/theme';
import { useData } from '../../src/data/AppData';
import { useLoad } from '../../src/ui/hooks';
import { loadFood, searchAll } from '../../src/data/foodService';
import type { Food, MealType, Quantity, Unit } from '../../src/engines/types';
import { MEAL_LABELS, MEAL_ORDER, fmt, pctText, dayLabel } from '../../src/ui/format';
import { nutrientsFor, percentOfDailyGoal, QuantityError } from '../../src/engines/nutrition';
import type { EntryStatus, Recipe } from '../../src/db/repo';
import { getDraft, setDraft } from '../../src/state/draft';

/** Ajout d'aliment : scanner/recherche/favoris/recettes/saisie manuelle, puis quantité. Sert aussi à modifier une entrée. */
export default function AddFood() {
  const p = useLocalSearchParams<{ foodId?: string; entryId?: string; date?: string; type?: MealType; status?: EntryStatus; target?: string }>();
  const router = useRouter();
  const { repo, changed } = useData();
  const [food, setFood] = useState<Food | undefined>();
  const [initial, setInitial] = useState<Quantity | undefined>();
  const [meal, setMeal] = useState<MealType>((p.type as MealType) ?? 'lunch');
  const date = String(p.date);
  const status: EntryStatus = p.status === 'planned' ? 'planned' : 'eaten';
  const recipeMode = p.target === 'recipe';

  useEffect(() => {
    (async () => {
      if (p.entryId) {
        const e = (await repo.entriesBetween('0000-01-01', '9999-12-31')).find((x) => x.id === p.entryId);
        if (e) { setFood(e.food); setInitial(e.qty); setMeal(e.mealType); }
      } else if (p.foodId) setFood(await loadFood(repo, String(p.foodId)));
    })();
  }, [p.entryId, p.foodId, repo]);

  if (food) {
    return (
      <QuantityStep food={food} initial={initial} meal={meal} setMeal={setMeal} date={date} status={status} editing={!!p.entryId} recipeMode={recipeMode}
        onSave={async (qty) => {
          if (recipeMode) { const d = getDraft(); if (d) setDraft({ ...d, items: [...d.items, { food, qty }] }); router.back(); return; }
          await repo.saveFood(food);
          if (p.entryId) await repo.updateEntry(String(p.entryId), { qty, mealType: meal });
          else await repo.addEntry({ date, mealType: meal, status, food, qty });
          changed(); router.back();
        }}
        onCancel={() => { if (p.foodId || p.entryId) router.back(); else setFood(undefined); }} />
    );
  }
  return <Picker date={date} status={status} meal={meal} recipeMode={recipeMode} onPick={setFood} onRecipe={async (r, portions) => {
    const ratio = portions / r.servings;
    for (const it of r.items) await repo.addEntry({ date, mealType: meal, status, food: it.food, qty: { ...it.qty, amount: Math.round(it.qty.amount * ratio * 100) / 100 } });
    changed(); router.back();
  }} />;
}

function Picker({ date, status, meal, recipeMode, onPick, onRecipe }: { date: string; status: EntryStatus; meal: MealType; recipeMode: boolean; onPick: (f: Food) => void; onRecipe: (r: Recipe, portions: number) => void }) {
  const router = useRouter();
  const { repo } = useData();
  const [tab, setTab] = useState<'recent' | 'fav' | 'recipes'>('recent');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Food[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [limited, setLimited] = useState(false);
  const { data: recents } = useLoad(() => repo.recentFoods(20), []);
  const { data: favs } = useLoad(() => repo.favorites(), []);
  const { data: recipes } = useLoad(() => repo.recipes(), []);

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchAll(repo, q);
      setResults(r.foods); setLimited(r.offlineOnly); setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [q, repo]);

  const list = results ?? (tab === 'recent' ? recents : tab === 'fav' ? favs : undefined);
  return (
    <Screen title="Ajouter un aliment" subtitle={recipeMode ? 'Ingrédient de recette' : `${MEAL_LABELS[meal]} · ${dayLabel(date)}${status === 'planned' ? ' · prévu' : ''}`}>
      <Field placeholder="Rechercher un aliment, un produit, un ingrédient…" value={q} onChangeText={setQ} autoCorrect={false} />
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <Chip label="Récents" active={tab === 'recent' && !results} onPress={() => { setQ(''); setTab('recent'); }} />
        <Chip label="Favoris" active={tab === 'fav' && !results} onPress={() => { setQ(''); setTab('fav'); }} />
        {!recipeMode ? <Chip label="Recettes" active={tab === 'recipes' && !results} onPress={() => { setQ(''); setTab('recipes'); }} /> : null}
      </Row>
      <Row gap={8}>
        <Button style={{ flex: 1 }} variant="secondary" icon="scan" label="Scanner" onPress={() => router.push('/scanner')} />
        <Button style={{ flex: 1 }} variant="secondary" icon="create-outline" label="Saisie manuelle" onPress={() => router.push('/manual-food')} />
      </Row>
      {searching ? <T v="caption">Recherche…</T> : null}
      {results && limited ? <Notice text="Recherche limitée aux aliments enregistrés sur cet appareil (hors ligne ou produit inconnu)." /> : null}
      {tab === 'recipes' && !results ? (
        recipes?.length ? recipes.map((r) => (
          <Card key={r.id} onPress={() => Alert.alert(r.name, `Combien de portions (sur ${r.servings}) ?`, [{ text: 'Annuler', style: 'cancel' }, { text: '1', onPress: () => onRecipe(r, 1) }, { text: `Toute la recette (${r.servings})`, onPress: () => onRecipe(r, r.servings) }])}>
            <T v="heading">{r.name}</T><T v="caption">{r.items.length} ingrédient(s) · {r.servings} portion(s)</T>
          </Card>
        )) : <Empty title="Aucune recette" text="Créez-en depuis Journal › Recettes." />
      ) : list?.length ? list.map((f) => <FoodRow key={f.id} food={f} onPress={() => onPick(f)} />)
        : <Empty icon="search-outline" title={results ? 'Aucun résultat' : tab === 'fav' ? 'Pas encore de favori' : 'Rien pour l’instant'} text={results ? 'Essayez un autre mot, scannez le code-barres ou saisissez l’aliment manuellement.' : 'Recherchez un aliment ci-dessus.'} />}
    </Screen>
  );
}

function QuantityStep({ food, initial, meal, setMeal, date, status, editing, recipeMode, onSave, onCancel }: {
  food: Food; initial?: Quantity; meal: MealType; setMeal: (m: MealType) => void; date: string; status: EntryStatus; editing: boolean; recipeMode: boolean;
  onSave: (q: Quantity) => Promise<void>; onCancel: () => void;
}) {
  const { settings } = useData();
  const units: Unit[] = useMemo(() => [food.basis, ...(food.portionSize ? (['portion'] as Unit[]) : [])], [food]);
  const [unit, setUnit] = useState<Unit>(initial?.unit ?? (food.portionSize ? 'portion' : food.basis));
  const [amount, setAmount] = useState(String(initial?.amount ?? (food.portionSize ? 1 : 100)));
  const [state, setState] = useState<'raw' | 'cooked' | undefined>(initial?.state ?? food.nutrientState);
  const num = parseFloat(amount.replace(',', '.'));
  let preview: { kcal?: number; err?: string } = {};
  if (Number.isFinite(num) && num > 0) {
    try { preview = { kcal: nutrientsFor(food, { amount: num, unit, state }).kcal }; } catch (e) { preview = { err: e instanceof QuantityError ? e.message : 'Erreur' }; }
  }
  const valid = Number.isFinite(num) && num > 0 && !preview.err;
  return (
    <Screen title={editing ? 'Modifier la quantité' : 'Quantité'} subtitle={food.name}
      footer={<Row><Button style={{ flex: 1 }} variant="ghost" label="Retour" onPress={onCancel} /><Button style={{ flex: 2 }} label={editing ? 'Enregistrer' : status === 'planned' ? 'Planifier' : 'Ajouter'} disabled={!valid} onPress={() => onSave({ amount: num, unit, state })} /></Row>}>
      <Card>
        <Field label="Quantité" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus />
        <Row gap={8}>{units.map((u) => <Chip key={u} label={u === 'portion' ? `portion (${fmt(food.portionSize!)} ${food.basis})` : u} active={unit === u} onPress={() => setUnit(u)} />)}{food.basis === 'g' && !units.includes('ml') ? null : null}</Row>
        {food.cookedYield && food.nutrientState ? (
          <>
            <T v="label">Poids pesé</T>
            <Row gap={8}><Chip label="Cru" active={state === 'raw'} onPress={() => setState('raw')} /><Chip label="Cuit" active={state === 'cooked'} onPress={() => setState('cooked')} /></Row>
            <T v="caption">Valeurs de référence données pour l’aliment {food.nutrientState === 'raw' ? 'cru' : 'cuit'} ; conversion automatique (facteur cru→cuit {food.cookedYield}).</T>
          </>
        ) : null}
      </Card>
      {preview.err ? <Notice tone="danger" text={preview.err} /> : preview.kcal !== undefined ? (
        <Card tone="forest">
          <T v="label" style={{ color: colors.greenSoft }}>Cette quantité</T>
          <T style={{ color: colors.cream, fontSize: 32, fontWeight: '700' }}>{fmt(preview.kcal)} kcal</T>
          <T v="caption" style={{ color: colors.greenSoft }}>{pctText(percentOfDailyGoal(preview.kcal, settings.goals.kcal))} de l’objectif journalier</T>
        </Card>
      ) : <Notice text="Énergie inconnue pour cet aliment : seules les données disponibles seront comptées." />}
      {!recipeMode ? (
        <>
          <SectionTitle>Repas</SectionTitle>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>{MEAL_ORDER.map((m) => <Chip key={m} label={MEAL_LABELS[m]} active={meal === m} onPress={() => setMeal(m)} />)}</Row>
        </>
      ) : null}
      <View style={{ height: space.md }} />
    </Screen>
  );
}
