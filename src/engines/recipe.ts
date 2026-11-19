import type { Goals } from './goals';
import { scoreMicro, type MicroResult } from './micro';
import { percentOfDailyGoal, sumItems, type Totals } from './nutrition';
import { DEFAULT_PRIMAL_CONFIG, scoreItems, type PrimalConfig, type PrimalResult } from './primal/score';
import type { Food, LoggedItem, Quantity } from './types';

export interface RecipeLike { servings: number; items: Array<{ food: Food; qty: Quantity }> }
export interface RecipeSummary {
  totals: Totals; kcalTotal: number; kcalPerPortion: number; percentOfDayPerPortion: number | null;
  macrosPerPortion: Record<'protein' | 'carbs' | 'fat' | 'fiber', number>;
  primal: PrimalResult | null; micro: MicroResult;
}
/** Nutriments, notes et micro d'une recette (par portion). La note Primal vient de TOUS les ingrédients × quantités. */
export function summarizeRecipe(r: RecipeLike, goals: Goals, cfg: PrimalConfig = DEFAULT_PRIMAL_CONFIG): RecipeSummary {
  const items: LoggedItem[] = r.items.map((it, i) => ({ id: String(i), food: it.food, qty: it.qty }));
  const totals = sumItems(items);
  const s = Math.max(1, r.servings);
  const kcalTotal = totals.kcal.value;
  return {
    totals, kcalTotal, kcalPerPortion: kcalTotal / s, percentOfDayPerPortion: percentOfDailyGoal(kcalTotal / s, goals.kcal),
    macrosPerPortion: { protein: totals.protein.value / s, carbs: totals.carbs.value / s, fat: totals.fat.value / s, fiber: totals.fiber.value / s },
    primal: items.length ? scoreItems(items, cfg) : null,
    // une portion est comparée à ~30 % des cibles quotidiennes (un repas principal)
    micro: scoreMicro(totals, { share: 0.3 * s, refs: goals.micro }),
  };
}
