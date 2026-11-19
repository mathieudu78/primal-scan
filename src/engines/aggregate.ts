import type { Goals } from './goals';
import { calorieStatus, percentOfDailyGoal, sumItems, type CalorieStatus, type Totals } from './nutrition';
import { MEAL_SHARE, scoreMicro, scoreMicroFood, type MicroResult } from './micro';
import { DEFAULT_PRIMAL_CONFIG, scoreFood, scoreItems, type PrimalConfig, type PrimalResult } from './primal/score';
import type { Food, LoggedItem, MealType } from './types';

export interface Summary {
  totals: Totals;
  calories: CalorieStatus;
  /** % de l'objectif calorique JOURNALIER (toujours par rapport au jour, jamais au repas) */
  caloriePercentOfDay: number | null;
  macros: Record<'protein' | 'carbs' | 'fat' | 'fiber', { value: number; goal: number; percent: number | null }>;
  primal: PrimalResult | null;
  micro: MicroResult;
}

function macroRow(value: number, goal: number) { return { value, goal, percent: goal > 0 ? (value / goal) * 100 : null }; }

function build(items: LoggedItem[], goals: Goals, share: number, cfg: PrimalConfig): Summary {
  const totals = sumItems(items);
  const kcal = totals.kcal.value;
  return {
    totals,
    calories: calorieStatus(kcal, goals.kcal),
    caloriePercentOfDay: percentOfDailyGoal(kcal, goals.kcal),
    macros: {
      protein: macroRow(totals.protein.value, goals.protein), carbs: macroRow(totals.carbs.value, goals.carbs),
      fat: macroRow(totals.fat.value, goals.fat), fiber: macroRow(totals.fiber.value, goals.fiber),
    },
    primal: items.length ? scoreItems(items, cfg) : null,
    micro: scoreMicro(totals, { share, refs: goals.micro }),
  };
}

/** Un repas : pourcentage calorique relatif à l'objectif JOURNALIER ; micro comparé à la part habituelle du repas. */
export function summarizeMeal(items: LoggedItem[], type: MealType, goals: Goals, cfg = DEFAULT_PRIMAL_CONFIG): Summary {
  return build(items, goals, MEAL_SHARE[type], cfg);
}
export function summarizeDay(items: LoggedItem[], goals: Goals, cfg = DEFAULT_PRIMAL_CONFIG): Summary {
  return build(items, goals, 1, cfg);
}

export interface DayEntry { date: string; items: LoggedItem[] }
export interface PeriodSummary extends Summary {
  days: number;
  perDay: Array<{ date: string; kcal: number; primal: number | null; micro: number | null }>;
  distribution: Record<PrimalResult['label'], number>;
  best: Array<{ food: Food; score: number }>;
  worst: Array<{ food: Food; score: number }>;
  avgKcalPerDay: number;
}

/**
 * Période (semaine, mois, plage libre). Les notes sont RECALCULÉES à partir de tous les ingrédients et quantités
 * de la période (fusion des compositions) — pas une moyenne des notes journalières.
 */
export function summarizePeriod(entries: DayEntry[], goals: Goals, cfg = DEFAULT_PRIMAL_CONFIG): PeriodSummary {
  const byDate = new Map<string, LoggedItem[]>();
  for (const e of entries) byDate.set(e.date, [...(byDate.get(e.date) ?? []), ...e.items]);
  const dates = [...byDate.keys()].filter((d) => byDate.get(d)!.length > 0).sort();
  const all = dates.flatMap((d) => byDate.get(d)!);
  const days = dates.length;
  const base = build(all, goals, Math.max(1, days), cfg);
  const perDay = dates.map((date) => {
    const its = byDate.get(date)!;
    const t = sumItems(its);
    return { date, kcal: t.kcal.value, primal: scoreItems(its, cfg)?.total ?? null, micro: scoreMicro(t, { share: 1, refs: goals.micro }).score };
  });
  const distribution = { 'Excellent': 0, 'Bon': 0, 'Moyen': 0, 'Faible': 0, 'Très faible': 0 } as Record<PrimalResult['label'], number>;
  const unique = new Map<string, Food>();
  for (const it of all) unique.set(it.food.id, it.food);
  const ranked = [...unique.values()].map((food) => ({ food, r: scoreFood(food, cfg) })).filter((x) => x.r).map((x) => ({ food: x.food, score: x.r!.total }));
  for (const r of ranked) distribution[scoreFood(r.food, cfg)!.label]++;
  ranked.sort((a, b) => b.score - a.score);
  return {
    ...base, days, perDay, distribution,
    best: ranked.slice(0, 5), worst: [...ranked].reverse().slice(0, 5),
    avgKcalPerDay: days ? base.totals.kcal.value / days : 0,
  };
}

export { scoreMicroFood };
