import { DEFAULT_MICRO_REFS, type MicroRef } from './micro-reference';
import type { MicroKey } from './nutrients';

export interface Goals {
  kcal: number; protein: number; carbs: number; fat: number; fiber: number;
  micro: Record<MicroKey, MicroRef>;
}

export const DEFAULT_GOALS: Goals = { kcal: 2500, protein: 120, carbs: 250, fat: 90, fiber: 30, micro: DEFAULT_MICRO_REFS };

export interface BodyProfile {
  sex: 'male' | 'female'; age: number; weightKg: number; heightCm: number;
  activity: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
}
const PAL = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 } as const;

/**
 * PROPOSITION d'objectifs (Mifflin-St Jeor). Jamais appliquée automatiquement :
 * l'utilisateur doit l'accepter ou saisir ses propres valeurs.
 */
export function suggestGoals(p: BodyProfile): Pick<Goals, 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber'> {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const kcal = Math.round((bmr * PAL[p.activity]) / 10) * 10;
  const protein = Math.round(p.weightKg * 1.6);
  const fat = Math.round((kcal * 0.35) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const fiber = Math.round((kcal / 1000) * 14);
  return { kcal, protein, carbs, fat, fiber };
}
