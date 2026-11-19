import type { Food } from '../engines/types';
import { SEED_FOODS } from './seedFoods';

// Fichier généré par `npm run import:ciqual` (vide par défaut). Voir scripts/import-ciqual.mjs.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const imported: Food[] = require('../../assets/data/ciqual.json');

export const GENERIC_FOODS: Food[] = imported.length ? imported : SEED_FOODS;
export const hasOfficialCiqual = imported.length > 0;

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
let index: Array<{ f: Food; n: string }> | null = null;

/** Recherche locale dans les aliments génériques (hors ligne). */
export function searchGeneric(query: string, limit = 30): Food[] {
  index ??= GENERIC_FOODS.map((f) => ({ f, n: norm(f.name) }));
  const terms = norm(query).split(' ').filter(Boolean);
  if (!terms.length) return [];
  return index
    .filter(({ n }) => terms.every((t) => n.includes(t)))
    .sort((a, b) => a.n.length - b.n.length)
    .slice(0, limit).map((x) => x.f);
}
