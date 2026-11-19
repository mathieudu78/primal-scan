import type { Repo } from '../db/repo';
import type { Food } from '../engines/types';
import { GENERIC_FOODS, searchGeneric } from './ciqual';
import { fetchByBarcode, searchOff } from './off';
import { normalizeGtin } from './barcode';

export type ScanOutcome =
  | { kind: 'found'; food: Food; from: 'cache' | 'off' }
  | { kind: 'not_found' }
  | { kind: 'offline' };

/** Code-barres : cache local d'abord (fonctionne hors ligne), puis Open Food Facts. */
export async function resolveBarcode(repo: Repo, raw: string): Promise<ScanOutcome> {
  const code = normalizeGtin(raw);
  const cached = await repo.foodByBarcode(code);
  if (cached) return { kind: 'found', food: cached, from: 'cache' };
  const r = await fetchByBarcode(code);
  if (r.kind === 'found') { await repo.saveFood(r.food); return { kind: 'found', food: r.food, from: 'off' }; }
  return r;
}

export interface SearchResult { foods: Food[]; offlineOnly: boolean }

/** Recherche : aliments enregistrés + génériques (local), puis produits emballés en ligne si possible. */
export async function searchAll(repo: Repo, query: string, online = true): Promise<SearchResult> {
  const local = await repo.searchFoods(query, 20);
  const generic = searchGeneric(query, 20);
  const seen = new Set<string>();
  const out: Food[] = [];
  const push = (f: Food) => { if (!seen.has(f.id)) { seen.add(f.id); out.push(f); } };
  local.forEach(push); generic.forEach(push);
  let offlineOnly = !online;
  if (online && query.trim().length >= 3) {
    const remote = await searchOff(query, 15);
    if (!remote.length) offlineOnly = out.length === 0 ? true : offlineOnly; // inconnu ou hors ligne : on ne peut pas distinguer
    remote.forEach(push);
  }
  return { foods: out, offlineOnly };
}

/** Retrouve un aliment par identifiant : base locale d'abord, puis génériques embarqués. */
export async function loadFood(repo: Repo, id: string): Promise<Food | undefined> {
  return (await repo.getFood(id)) ?? GENERIC_FOODS.find((f) => f.id === id);
}
