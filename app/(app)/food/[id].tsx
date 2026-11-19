import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { FoodDetail } from '../../../src/ui/FoodDetail';
export default function FoodScreen() { const { id } = useLocalSearchParams<{ id: string }>(); return <FoodDetail foodId={String(id)} />; }
