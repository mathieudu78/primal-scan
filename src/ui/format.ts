import type { MealType } from '../engines/types';

export const MEAL_LABELS: Record<MealType, string> = { breakfast: 'Petit-déjeuner', lunch: 'Déjeuner', snack: 'Collation', dinner: 'Dîner', other: 'Autre repas' };
export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner', 'other'];
export const MEAL_ICONS: Record<MealType, 'sunny-outline' | 'restaurant-outline' | 'nutrition-outline' | 'moon-outline' | 'ellipsis-horizontal'> =
  { breakfast: 'sunny-outline', lunch: 'restaurant-outline', snack: 'nutrition-outline', dinner: 'moon-outline', other: 'ellipsis-horizontal' };

export const fmt = (n: number | null | undefined, digits = 0) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: 0 }));
export const pctText = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${fmt(n, n < 10 ? 1 : 0)} %`);

export function parseDate(key: string): Date { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); }
export function toKey(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function addDays(key: string, n: number): string { const d = parseDate(key); d.setDate(d.getDate() + n); return toKey(d); }
export function startOfWeek(key: string): string { const d = parseDate(key); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return toKey(d); } // lundi
export function monthRange(key: string): { from: string; to: string } {
  const d = parseDate(key); const from = new Date(d.getFullYear(), d.getMonth(), 1, 12), to = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12);
  return { from: toKey(from), to: toKey(to) };
}
export function dayLabel(key: string, long = false): string {
  return parseDate(key).toLocaleDateString('fr-FR', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' });
}
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = []; let k = from;
  for (let i = 0; i < 1000 && k <= to; i++) { out.push(k); k = addDays(k, 1); }
  return out;
}
