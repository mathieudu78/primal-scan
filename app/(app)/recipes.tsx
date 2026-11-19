import React from 'react';
import { Alert } from 'react-native';
import { Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Empty, Row, ScoreRing, Screen, T } from '../../src/ui/components';
import { useData } from '../../src/data/AppData';
import { useLoad } from '../../src/ui/hooks';
import { summarizeRecipe } from '../../src/engines/recipe';
import { fmt, pctText } from '../../src/ui/format';
import { setDraft } from '../../src/state/draft';

export default function Recipes() {
  const router = useRouter();
  const { repo, settings, changed } = useData();
  const { data } = useLoad(() => repo.recipes(), []);
  return (
    <Screen title="Recettes" footer={<Button icon="add" label="Nouvelle recette" onPress={() => { setDraft({ name: '', servings: 1, items: [] }); router.push('/recipe-edit'); }} />}>
      {!data?.length ? <Empty icon="restaurant-outline" title="Aucune recette" text="Créez vos recettes pour calculer calories, macros, vitamines et notes." /> : data.map((r) => {
        const s = summarizeRecipe(r, settings.goals, settings.primal);
        return (
          <Card key={r.id} onPress={() => { setDraft({ id: r.id, name: r.name, photoUri: r.photoUri, servings: r.servings, items: r.items }); router.push('/recipe-edit'); }}
            style={{ gap: 8 }}>
            <Row gap={12}>
              {r.photoUri ? <Image source={{ uri: r.photoUri }} style={{ width: 64, height: 64, borderRadius: 16 }} /> : null}
              <T v="heading" style={{ flex: 1 }} numberOfLines={2}>{r.name}</T>
              <ScoreRing score={s.primal?.total ?? null} size={56} stroke={6} />
            </Row>
            <T v="caption">{r.items.length} ingrédient(s) · {r.servings} portion(s) · {fmt(s.kcalPerPortion)} kcal par portion ({pctText(s.percentOfDayPerPortion)} de l’objectif journalier)</T>
            <Button variant="ghost" label="Supprimer" style={{ minHeight: 40, paddingVertical: 8 }} onPress={() => Alert.alert('Supprimer la recette ?', r.name, [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: async () => { await repo.deleteRecipe(r.id); changed(); } }])} />
          </Card>
        );
      })}
    </Screen>
  );
}
