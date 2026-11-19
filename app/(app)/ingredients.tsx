import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Badge, Card, Empty, Notice, ProgressBar, Row, Screen, T } from '../../src/ui/components';
import { colors } from '../../src/ui/theme';
import { useData } from '../../src/data/AppData';
import { loadFood } from '../../src/data/foodService';
import type { Food } from '../../src/engines/types';
import { analyzeFood } from '../../src/engines/primal/score';
import { CLASS_INFO } from '../../src/engines/primal/dictionary';
import { fmt } from '../../src/ui/format';

/** Analyse détaillée des ingrédients : classe, naturalité, part estimée, additifs. */
export default function Ingredients() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repo, settings } = useData();
  const [food, setFood] = useState<Food | null>();
  useEffect(() => { void loadFood(repo, String(id)).then((f) => setFood(f ?? null)); }, [repo, id]);
  if (!food) return <Screen title="Ingrédients">{food === null ? <Empty title="Aliment introuvable" /> : <T v="caption">Chargement…</T>}</Screen>;
  const a = analyzeFood(food, settings.primal);
  const declared = a.ingredients.some((i) => i.declaredPct !== undefined);
  return (
    <Screen title="Analyse des ingrédients" subtitle={food.name}>
      <Card>
        <T v="label">Transformation</T>
        <T v="body">{a.transformationSource === 'nova' ? `Groupe NOVA ${food.novaGroup} (fourni par Open Food Facts)` : 'Estimée à partir des ingrédients (marqueurs d’ultra-transformation, sucres, huiles raffinées…)'}</T>
        <ProgressBar value={a.transformation * 100} height={8} color={colors.greenSoft} />
        <T v="caption">Plus la barre est pleine, moins l’aliment est transformé.</T>
      </Card>
      {!a.known ? <Notice tone="warn" text="Aucune liste d’ingrédients exploitable : l’analyse est limitée." /> : null}
      <Notice text={declared ? 'Les parts affichées utilisent les pourcentages déclarés ; le reste est estimé selon l’ordre de la liste.' : 'Les parts sont des ESTIMATIONS déduites de l’ordre de la liste (du plus au moins abondant).'} />
      {a.ingredients.map((ing, i) => {
        const info = CLASS_INFO[ing.cls];
        return (
          <Card key={i} delay={i * 30} style={{ paddingVertical: 16 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="body" style={{ flex: 1, fontWeight: '600', textTransform: 'capitalize' }}>{ing.name}</T>
              <T v="caption">{ing.declaredPct !== undefined ? `${fmt(ing.declaredPct, 1)} %` : `≈ ${fmt(ing.share * 100, 0)} %`}</T>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Badge text={info.label} color={ing.cls === 'unknown' ? colors.muted : info.naturalness >= 0.8 ? colors.green : info.naturalness >= 0.4 ? colors.beige : colors.warn} />
              <T v="caption">naturalité {Math.round((settings.primal.naturalnessOverrides[ing.cls] ?? info.naturalness) * 100)} %</T>
            </Row>
            {ing.cls === 'unknown' ? <T v="caption">Non reconnu : signalé comme incertain, sans pénalité automatique.</T> : null}
          </Card>
        );
      })}
      {a.additives.length ? (
        <Card>
          <T v="label">Additifs ({a.additives.length})</T>
          {a.additives.map((ad) => (
            <View key={ad.code} style={{ gap: 2 }}>
              <Row style={{ justifyContent: 'space-between' }}><T v="body">{ad.code.startsWith('e') ? ad.code.toUpperCase() + ' — ' : ''}{ad.name}</T><T v="caption">{ad.category}</T></Row>
              <T v="caption">{['Bénin', 'Usage technologique', 'Discuté', 'Préoccupant'][ad.risk]}{ad.note ? ` · ${ad.note}` : ''}</T>
            </View>
          ))}
          <T v="caption">Classement indicatif d’après des avis publics (EFSA, ANSES, CIRC) ; ce n’est pas un avis médical.</T>
        </Card>
      ) : null}
    </Screen>
  );
}
