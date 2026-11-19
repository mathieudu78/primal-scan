import type { MicroKey } from './nutrients';

/**
 * Valeurs de référence adulte (approximatives, issues des VNR européens / repères ANSES).
 * `target` = apport visé par jour ; `upper` = limite haute usuelle (au-delà : surdose).
 * Pour le sodium, `target` n'est PAS un objectif à atteindre : `kind: 'limit'` (plafond).
 * Ces valeurs sont modifiables par l'utilisateur dans Objectifs ; elles ne constituent pas un avis médical.
 */
export interface MicroRef { target: number; upper?: number; kind: 'target' | 'limit' }

export const DEFAULT_MICRO_REFS: Record<MicroKey, MicroRef> = {
  vitA: { target: 800, upper: 3000, kind: 'target' },
  vitB1: { target: 1.1, kind: 'target' },
  vitB2: { target: 1.4, kind: 'target' },
  vitB3: { target: 16, kind: 'target' },
  vitB5: { target: 6, kind: 'target' },
  vitB6: { target: 1.4, upper: 25, kind: 'target' },
  vitB8: { target: 50, kind: 'target' },
  vitB9: { target: 330, upper: 1000, kind: 'target' },
  vitB12: { target: 4, kind: 'target' },
  vitC: { target: 110, upper: 1000, kind: 'target' },
  vitD: { target: 15, upper: 100, kind: 'target' },
  vitE: { target: 12, upper: 300, kind: 'target' },
  vitK: { target: 75, kind: 'target' },
  calcium: { target: 950, upper: 2500, kind: 'target' },
  magnesium: { target: 380, kind: 'target' },
  potassium: { target: 3500, kind: 'target' },
  sodium: { target: 2000, kind: 'limit' },
  phosphorus: { target: 700, upper: 3000, kind: 'target' },
  iron: { target: 11, upper: 45, kind: 'target' },
  zinc: { target: 11, upper: 25, kind: 'target' },
  copper: { target: 1.5, upper: 5, kind: 'target' },
  selenium: { target: 70, upper: 255, kind: 'target' },
  iodine: { target: 150, upper: 600, kind: 'target' },
  manganese: { target: 2.8, upper: 11, kind: 'target' },
};
