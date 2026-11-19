import { ALL_KEYS, type NutrientKey } from './nutrients';
import type { Food, LoggedItem, NutrientMap, Quantity } from './types';

export class QuantityError extends Error {}

/**
 * Convertit la quantité saisie en grammes (ou ml) DANS L'ÉTAT où les valeurs
 * nutritionnelles de l'aliment sont données (cru/cuit).
 *  - portion -> portionSize ; ml -> g via densité si la base est en g
 *  - cru <-> cuit via cookedYield (poids cuit / poids cru)
 */
export function basisAmount(food: Food, qty: Quantity): number {
  if (!(qty.amount >= 0) || !Number.isFinite(qty.amount)) throw new QuantityError('Quantité invalide');
  let amount = qty.amount;
  if (qty.unit === 'portion') {
    if (!food.portionSize) throw new QuantityError('Taille de portion inconnue pour cet aliment');
    amount = qty.amount * food.portionSize; // exprimé dans l'unité de base de l'aliment
  } else if (qty.unit !== food.basis) {
    const d = food.density ?? 1;
    amount = qty.unit === 'ml' ? qty.amount * d : qty.amount / d; // ml -> g  |  g -> ml
  }
  const have = qty.state, base = food.nutrientState;
  if (have && base && have !== base) {
    if (!food.cookedYield) throw new QuantityError('Facteur cru/cuit inconnu pour cet aliment');
    amount = have === 'cooked' ? amount / food.cookedYield : amount * food.cookedYield;
  }
  return amount;
}

/** Masse réelle en grammes de ce qui est mangé (pour pondérer les notes). */
export function massGrams(food: Food, qty: Quantity): number {
  let amount = qty.unit === 'portion' ? qty.amount * (food.portionSize ?? 0) : qty.amount;
  const unit = qty.unit === 'portion' ? food.basis : qty.unit;
  if (unit === 'ml') amount *= food.density ?? 1;
  return amount;
}

/** Nutriments pour la quantité donnée. Les valeurs absentes restent absentes. */
export function nutrientsFor(food: Food, qty: Quantity): NutrientMap {
  const factor = basisAmount(food, qty) / 100;
  const out: NutrientMap = {};
  for (const k of ALL_KEYS) {
    const v = food.nutrients[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = round(v * factor);
  }
  return out;
}

export interface NutrientTotal {
  /** somme des valeurs CONNUES */
  value: number;
  /** part de la masse des aliments pour lesquels la donnée existe (0..1) */
  completeness: number;
  /** au moins un aliment a la donnée */
  known: boolean;
}
export type Totals = Record<NutrientKey, NutrientTotal>;

export function sumItems(items: LoggedItem[]): Totals {
  const totals = {} as Totals;
  const totalMass = items.reduce((a, i) => a + Math.max(0, massGrams(i.food, i.qty)), 0);
  for (const k of ALL_KEYS) totals[k] = { value: 0, completeness: items.length ? 0 : 1, known: false };
  for (const it of items) {
    const n = nutrientsFor(it.food, it.qty);
    const m = Math.max(0, massGrams(it.food, it.qty));
    for (const k of ALL_KEYS) {
      const v = n[k];
      if (v === undefined) continue;
      totals[k].value += v;
      totals[k].known = true;
      totals[k].completeness += totalMass > 0 ? m / totalMass : 1 / items.length;
    }
  }
  for (const k of ALL_KEYS) { totals[k].value = round(totals[k].value); totals[k].completeness = Math.min(1, totals[k].completeness); }
  return totals;
}

/**
 * Pourcentage de l'objectif calorique JOURNALIER — jamais relatif au repas.
 * null si l'objectif n'est pas défini (> 0).
 */
export function percentOfDailyGoal(kcal: number, dailyGoalKcal: number): number | null {
  if (!(dailyGoalKcal > 0)) return null;
  return (kcal / dailyGoalKcal) * 100;
}

export interface CalorieStatus {
  consumed: number; goal: number; percent: number | null;
  /** positif = reste, négatif = dépassement */
  remaining: number; over: boolean;
}
export function calorieStatus(consumedKcal: number, goal: number): CalorieStatus {
  return { consumed: consumedKcal, goal, percent: percentOfDailyGoal(consumedKcal, goal), remaining: goal - consumedKcal, over: consumedKcal > goal };
}

export function round(n: number, digits = 2): number {
  const f = 10 ** digits; return Math.round(n * f) / f;
}
