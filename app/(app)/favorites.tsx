import React from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Empty, Screen } from '../../src/ui/components';
import { FoodRow } from '../../src/ui/FoodRow';
import { useData } from '../../src/data/AppData';
import { useLoad } from '../../src/ui/hooks';
import { colors } from '../../src/ui/theme';

export default function Favorites() {
  const router = useRouter();
  const { repo, changed } = useData();
  const { data } = useLoad(() => repo.favorites(), []);
  return (
    <Screen title="Favoris">
      {!data?.length ? <Empty icon="heart-outline" title="Aucun favori" text="Touchez le cœur sur une fiche aliment pour le retrouver ici." /> : data.map((f) => (
        <FoodRow key={f.id} food={f} onPress={() => router.push({ pathname: '/food/[id]', params: { id: f.id } })}
          right={<Ionicons name="heart" size={24} color={colors.danger} onPress={async () => { await repo.setFavorite(f, false); changed(); }} />} />
      ))}
    </Screen>
  );
}
