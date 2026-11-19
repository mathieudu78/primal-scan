import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, Empty, Notice, ProgressBar, Row, ScoreRing, Screen, SectionTitle, T } from './components';
import { colors, radius, space } from './theme';
import { useData } from '../data/AppData';
import { loadFood } from '../data/foodService';
import type { Food } from '../engines/types';
import { analyzeFood, scoreFood } from '../engines/primal/score';
import { scoreMicroFood } from '../engines/micro';
import { percentOfDailyGoal } from '../engines/nutrition';
import { fmt, pctText, toKey } from './format';

const riskColor = [colors.greenSoft, colors.beige, colors.warn, colors.danger] as const;

/** Fiche alimentaire / résultat d'analyse (utilisée après un scan et depuis la recherche). */
export function FoodDetail({ foodId, title = 'Analyse', scanned }: { foodId: string; title?: string; scanned?: boolean }) {
  const router = useRouter();
  const { repo, settings, changed } = useData();
  const [food, setFood] = useState<Food | null | undefined>(undefined);
  const [fav, setFav] = useState(false);
  useEffect(() => { void loadFood(repo, foodId).then((f) => setFood(f ?? null)); void repo.isFavorite(foodId).then(setFav); }, [repo, foodId]);

  if (food === undefined) return <Screen title={title}><T v="caption">Chargement…</T></Screen>;
  if (food === null) return <Screen title={title}><Empty title="Aliment introuvable" /></Screen>;

  const primal = scoreFood(food, settings.primal);
  const micro = scoreMicroFood(food, settings.goals.micro);
  const analysis = analyzeFood(food, settings.primal);
  const n = food.nutrients;
  const unit = food.basis;
  const unknownNames = analysis.ingredients.filter((i) => i.cls === 'unknown').map((i) => i.name);
  const noList = !food.ingredientsText && food.source === 'off';
  const portion = food.portionSize;
  const kcalPortion = n.kcal !== undefined && portion ? (n.kcal * portion) / 100 : undefined;

  const toggleFav = async () => { await repo.saveFood(food); await repo.setFavorite(food, !fav); setFav(!fav); changed(); };
  const macroRows: Array<[string, number | undefined, string]> = [['Protéines', n.protein, 'g'], ['Glucides', n.carbs, 'g'], ['Lipides', n.fat, 'g'], ['Fibres', n.fiber, 'g'], ['dont saturés', n.satFat, 'g'], ['dont mono-insaturés', n.monoFat, 'g'], ['dont polyinsaturés', n.polyFat, 'g']];

  return (
    <Screen title={scanned ? 'Résultat' : 'Fiche aliment'} subtitle={title !== 'Analyse' ? title : undefined}
      right={<Ionicons name={fav ? 'heart' : 'heart-outline'} size={26} color={fav ? colors.danger : colors.cream} onPress={toggleFav} />}
      footer={<Row><Button style={{ flex: 1 }} label="Ajouter au journal" icon="add-circle-outline" onPress={() => router.push({ pathname: '/add-food', params: { foodId: food.id, date: toKey(new Date()), type: 'lunch', status: 'eaten' } })} /></Row>}>
      <Card delay={0}>
        <Row gap={space.lg}>
          <View style={{ width: 84, height: 84, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            {food.imageUrl ? <Image source={{ uri: food.imageUrl }} style={{ width: 84, height: 84 }} resizeMode="cover" /> : <Ionicons name="leaf-outline" size={32} color={colors.muted} />}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <T v="heading" numberOfLines={3}>{food.name}</T>
            {food.brand ? <T v="caption">{food.brand}</T> : null}
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {food.approximate ? <Badge text="Valeurs indicatives" color={colors.warn} /> : null}
              {food.source === 'off' ? <Badge text="Open Food Facts" /> : null}
              {food.source === 'custom' ? <Badge text="Personnalisé" /> : null}
              {food.novaGroup ? <Badge text={`NOVA ${food.novaGroup}`} color={colors.beige} /> : null}
            </Row>
          </View>
        </Row>
      </Card>

      {food.approximate ? <Notice tone="warn" text="Valeurs indicatives de la liste de démarrage. Importez la base CIQUAL officielle pour des valeurs exactes (voir README)." /> : null}
      {noList ? <Notice tone="warn" text="Ce produit n’a pas de liste d’ingrédients dans la base : la note est limitée aux données disponibles. Vous pouvez la compléter par photo (scanner) ou saisie manuelle." /> : null}

      <Row style={{ alignItems: 'stretch' }} gap={space.md}>
        <Card style={{ flex: 1, alignItems: 'center' }} delay={60}>
          <T v="label">Note Primal</T>
          <ScoreRing score={primal?.total ?? null} size={104} />
          <T v="caption">{primal?.label}</T>
          {primal && primal.max - primal.min > 1 ? <T v="caption" style={{ fontSize: 11 }}>entre {Math.round(primal.min)} et {Math.round(primal.max)} (ingrédients inconnus)</T> : null}
        </Card>
        <Card style={{ flex: 1, alignItems: 'center' }} delay={100}>
          <T v="label">Micronutriments</T>
          <ScoreRing score={micro.score} size={104} color={colors.beige} />
          <T v="caption">{micro.score === null ? 'Données absentes' : `${Math.round(micro.coverage * 100)} % des données`}</T>
        </Card>
      </Row>

      <Card delay={140}>
        <T v="label">Pour 100 {unit}</T>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <T style={{ fontSize: 34, fontWeight: '700' }}>{n.kcal === undefined ? '—' : fmt(n.kcal)} <T v="caption">kcal</T></T>
          <T v="caption">{n.kcal === undefined ? 'énergie inconnue' : `${pctText(percentOfDailyGoal(n.kcal, settings.goals.kcal))} de l’objectif journalier`}</T>
        </Row>
        {portion && kcalPortion !== undefined ? <T v="caption">Une portion ({fmt(portion)} {unit}) : {fmt(kcalPortion)} kcal · {pctText(percentOfDailyGoal(kcalPortion, settings.goals.kcal))} de l’objectif journalier</T> : null}
        {macroRows.map(([l, v, u]) => (
          <Row key={l} style={{ justifyContent: 'space-between' }}>
            <T v="body" style={{ color: l.startsWith('dont') ? colors.textSoft : colors.text }}>{l}</T>
            <T v="body">{v === undefined ? <T v="caption">donnée absente</T> : `${fmt(v, 1)} ${u}`}</T>
          </Row>
        ))}
      </Card>

      {primal ? (
        <Card delay={180}>
          <T v="label">Détail de la note Primal</T>
          {primal.parts.map((p) => (
            <View key={p.key} style={{ gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}><T v="body">{p.label}</T><T v="body" style={{ fontWeight: '600' }}>{fmt(p.points, 1)} / {p.max}</T></Row>
              <ProgressBar value={p.points} max={p.max} height={6} />
              <T v="caption">{p.detail}</T>
            </View>
          ))}
          {primal.additives.length ? (
            <>
              <SectionTitle>Additifs détectés</SectionTitle>
              <Row style={{ flexWrap: 'wrap' }} gap={8}>
                {primal.additives.map((a) => <Badge key={a.code} text={`${a.code.startsWith('e') ? a.code.toUpperCase() + ' · ' : ''}${a.name}`} color={riskColor[a.risk]} />)}
              </Row>
            </>
          ) : null}
          {unknownNames.length ? <Notice tone="warn" text={`Ingrédients non reconnus : ${unknownNames.join(', ')}. Leur impact est incertain (ils ne sont pas considérés comme mauvais) ; la note est donnée avec une plage.`} /> : null}
          <Button variant="ghost" label="Analyse détaillée des ingrédients" onPress={() => router.push({ pathname: '/ingredients', params: { id: food.id } })} />
        </Card>
      ) : null}

      {food.ingredientsText ? <Card delay={220}><T v="label">Ingrédients</T><T v="caption">{food.ingredientsText}</T></Card> : null}
      <Button variant="secondary" label="Voir vitamines et minéraux" onPress={() => router.push({ pathname: '/micronutrients', params: { foodId: food.id } })} />
    </Screen>
  );
}
