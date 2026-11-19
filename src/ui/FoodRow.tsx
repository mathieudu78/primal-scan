import React from 'react';
import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressScale, T } from './components';
import { colors, radius, scoreColor, space } from './theme';
import type { Food } from '../engines/types';
import { scoreFood } from '../engines/primal/score';
import { fmt } from './format';

/** Ligne d'aliment : nom, marque, kcal/100 g et mini-note Primal. */
export function FoodRow({ food, onPress, right, sub }: { food: Food; onPress?: () => void; right?: React.ReactNode; sub?: string }) {
  const score = scoreFood(food)?.total ?? null;
  return (
    <PressScale onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 }}>
      <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {food.imageUrl ? <Image source={{ uri: food.imageUrl }} style={{ width: 48, height: 48 }} /> : <Ionicons name="leaf-outline" size={22} color={colors.muted} />}
      </View>
      <View style={{ flex: 1 }}>
        <T v="body" numberOfLines={1} style={{ fontWeight: '600' }}>{food.name}</T>
        <T v="caption" numberOfLines={1}>{sub ?? [food.brand, food.nutrients.kcal !== undefined ? `${fmt(food.nutrients.kcal)} kcal / 100 ${food.basis}` : 'énergie inconnue'].filter(Boolean).join(' · ')}{food.approximate ? ' · indicatif' : ''}</T>
      </View>
      {right ?? (
        <View style={{ minWidth: 44, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: scoreColor(score), alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
          <T style={{ color: scoreColor(score), fontWeight: '700', fontSize: 13 }}>{score === null ? '—' : Math.round(score)}</T>
        </View>
      )}
    </PressScale>
  );
}
