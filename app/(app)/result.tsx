import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { FoodDetail } from '../../src/ui/FoodDetail';
/** Résultat d'analyse après un scan. */
export default function Result() { const { foodId } = useLocalSearchParams<{ foodId: string }>(); return <FoodDetail foodId={String(foodId)} scanned />; }
