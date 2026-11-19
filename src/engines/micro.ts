import { MINERALS, VITAMINS, type MicroKey } from './nutrients';
import { DEFAULT_MICRO_REFS, type MicroRef } from './micro-reference';
import { sumItems, type Totals } from './nutrition';
import type { Food, MealType } from './types';

/**
 * NOTE MICRONUTRITIONNELLE (0-100) — distincte de la note Primal, jamais influencée par les calories.
 *  - Chaque micronutriment reçoit un sous-score 0..1 : proportionnel jusqu'à la cible, plein entre cible et limite haute,
 *    puis décroissant au-delà de la limite haute (un excès n'est PAS meilleur). Le sodium est un plafond.
 *  - Les données ABSENTES sont exclues du calcul (jamais comptées comme 0) ; `coverage` indique la part prise en compte.
 */
export const MEAL_SHARE: Record<MealType, number> = { breakfast: 0.25, lunch: 0.35, snack: 0.1, dinner: 0.3, other: 0.1 };
export const ALL_MICRO: MicroKey[] = [...VITAMINS, ...MINERALS];

export type MicroStatus = 'low' | 'ok' | 'high' | 'over_limit' | 'no_data';
export interface MicroDetail {
  key: MicroKey; intake: number | null; target: number; ratio: number | null; score: number | null;
  status: MicroStatus; completeness: number;
}
export interface MicroResult { score: number | null; coverage: number; details: MicroDetail[] }

export interface MicroOptions {
  /** fraction (ou nombre de jours) de la cible quotidienne que représente la période évaluée */
  share: number;
  refs?: Record<MicroKey, MicroRef>;
  /** part minimale de la masse ayant la donnée pour inclure un nutriment (défaut 0.5) */
  minCompleteness?: number;
}

export function scoreMicro(totals: Totals, opts: MicroOptions): MicroResult {
  const refs = opts.refs ?? DEFAULT_MICRO_REFS;
  const minC = opts.minCompleteness ?? 0.5;
  const share = opts.share > 0 ? opts.share : 1;
  const details: MicroDetail[] = [];
  let sum = 0, n = 0;
  for (const key of ALL_MICRO) {
    const ref = refs[key], t = totals[key];
    if (!t.known || t.completeness < minC) {
      details.push({ key, intake: t.known ? t.value : null, target: ref.target, ratio: null, score: null, status: 'no_data', completeness: t.completeness });
      continue;
    }
    const daily = t.value / share; // équivalent journalier
    let s: number, status: MicroStatus;
    if (ref.kind === 'limit') {
      if (daily <= ref.target) { s = 1; status = 'ok'; } else { s = Math.max(0, 1 - (daily - ref.target) / ref.target); status = 'over_limit'; }
    } else if (daily < ref.target) { s = daily / ref.target; status = 'low'; }
    else if (ref.upper !== undefined && daily > ref.upper) { s = Math.max(0, 1 - (daily - ref.upper) / ref.upper); status = 'over_limit'; }
    else { s = 1; status = daily >= ref.target * 1.5 ? 'high' : 'ok'; }
    sum += s; n++;
    details.push({ key, intake: t.value, target: ref.target, ratio: daily / ref.target, score: s, status, completeness: t.completeness });
  }
  return { score: n ? Math.round((sum / n) * 1000) / 10 : null, coverage: n / ALL_MICRO.length, details };
}

/** Un aliment : apports pour 100 g comparés à 25 % de la cible quotidienne (densité par masse, pas par calories). */
export function scoreMicroFood(food: Food, refs?: Record<MicroKey, MicroRef>): MicroResult {
  const totals = sumItems([{ id: 'x', food, qty: { amount: 100, unit: food.basis, state: food.nutrientState } }]);
  return scoreMicro(totals, { share: 0.25, refs });
}
