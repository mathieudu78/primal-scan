import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Empty, Field, Notice, Screen, T } from '../../src/ui/components';
import { FoodRow } from '../../src/ui/FoodRow';
import { useData } from '../../src/data/AppData';
import { searchAll } from '../../src/data/foodService';
import type { Food } from '../../src/engines/types';
import { useLoad } from '../../src/ui/hooks';

/** Recherche alimentaire : produits emballés, aliments bruts, ingrédients et recettes personnelles. */
export default function Search() {
  const router = useRouter();
  const { repo } = useData();
  const [q, setQ] = useState('');
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [limited, setLimited] = useState(false);
  const { data: recipes } = useLoad(() => repo.recipes(), []);
  const { data: recents } = useLoad(() => repo.recentFoods(15), []);

  useEffect(() => {
    if (q.trim().length < 2) { setFoods(null); return; }
    const t = setTimeout(async () => { const r = await searchAll(repo, q); setFoods(r.foods); setLimited(r.offlineOnly); }, 350);
    return () => clearTimeout(t);
  }, [q, repo]);

  const rec = q.trim().length >= 2 ? (recipes ?? []).filter((r) => r.name.toLowerCase().includes(q.toLowerCase())) : [];
  const list = foods ?? recents ?? [];
  return (
    <Screen title="Recherche">
      <Field placeholder="Pomme, yaourt, 3017620422003…" value={q} onChangeText={setQ} autoFocus autoCorrect={false} />
      {limited && foods ? <Notice text="Hors ligne ou produit inconnu : seuls les aliments enregistrés sur cet appareil sont affichés." /> : null}
      {rec.map((r) => <FoodRow key={r.id} food={{ id: r.id, name: `🍽 ${r.name}`, source: 'recipe', nutrients: {}, basis: 'g' }} sub={`Recette · ${r.servings} portion(s)`} right={<T v="caption">›</T>} onPress={() => router.push('/recipes')} />)}
      {list.map((f) => <FoodRow key={f.id} food={f} onPress={() => router.push({ pathname: '/food/[id]', params: { id: f.id } })} />)}
      {!list.length && !rec.length ? <Empty icon="search-outline" title="Aucun résultat" text="Essayez un autre mot ou scannez le produit." /> : null}
    </Screen>
  );
}
