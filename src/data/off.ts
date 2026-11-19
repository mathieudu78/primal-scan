import type { Food } from '../engines/types';
import type { NutrientMap } from '../engines/types';
import { normalizeGtin } from './barcode';

const HOST = 'https://world.openfoodfacts.org';
const UA = 'PrimalScan/1.0';
const FIELDS = 'code,product_name,product_name_fr,generic_name,brands,image_front_url,image_front_small_url,ingredients_text,ingredients_text_fr,nutriments,nova_group,additives_tags,serving_quantity,categories_tags,categories,quantity';

/** Open Food Facts exprime vitamines/minéraux en GRAMMES pour 100 g : conversion vers l'unité de l'app. */
const G_TO: Array<[string, keyof NutrientMap, number]> = [
  ['proteins', 'protein', 1], ['carbohydrates', 'carbs', 1], ['fat', 'fat', 1], ['fiber', 'fiber', 1],
  ['saturated-fat', 'satFat', 1], ['monounsaturated-fat', 'monoFat', 1], ['polyunsaturated-fat', 'polyFat', 1],
  ['sugars', 'sugars', 1], ['added-sugars', 'addedSugars', 1], ['salt', 'salt', 1],
  ['vitamin-a', 'vitA', 1e6], ['vitamin-b1', 'vitB1', 1e3], ['vitamin-b2', 'vitB2', 1e3], ['vitamin-pp', 'vitB3', 1e3],
  ['pantothenic-acid', 'vitB5', 1e3], ['vitamin-b6', 'vitB6', 1e3], ['biotin', 'vitB8', 1e6], ['vitamin-b9', 'vitB9', 1e6],
  ['vitamin-b12', 'vitB12', 1e6], ['vitamin-c', 'vitC', 1e3], ['vitamin-d', 'vitD', 1e6], ['vitamin-e', 'vitE', 1e3], ['vitamin-k', 'vitK', 1e6],
  ['calcium', 'calcium', 1e3], ['magnesium', 'magnesium', 1e3], ['potassium', 'potassium', 1e3], ['sodium', 'sodium', 1e3],
  ['phosphorus', 'phosphorus', 1e3], ['iron', 'iron', 1e3], ['zinc', 'zinc', 1e3], ['copper', 'copper', 1e3],
  ['selenium', 'selenium', 1e6], ['iodine', 'iodine', 1e6], ['manganese', 'manganese', 1e3],
];

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function offToFood(p: any): Food | null {
  const name: string = (p?.product_name_fr || p?.product_name || p?.generic_name || '').trim();
  if (!name) return null;
  const nu = p.nutriments ?? {};
  const nutrients: NutrientMap = {};
  const kcal = num(nu['energy-kcal_100g']) ?? (num(nu['energy_100g']) !== undefined ? num(nu['energy_100g'])! / 4.184 : undefined);
  if (kcal !== undefined) nutrients.kcal = Math.round(kcal * 10) / 10;
  for (const [off, key, mult] of G_TO) {
    const v = num(nu[`${off}_100g`]);
    if (v !== undefined) nutrients[key] = Math.round(v * mult * 1000) / 1000;
  }
  // sel absent mais sodium présent (et inversement) : on complète sans inventer
  if (nutrients.salt === undefined && nutrients.sodium !== undefined) nutrients.salt = Math.round((nutrients.sodium * 2.5) / 10) / 100;
  const cats: string[] = p.categories_tags ?? [];
  const liquid = cats.some((c) => /beverage|boisson|drinks|waters|juices|sodas/.test(c)) || /\d\s?(ml|cl)\b|\bl\b/i.test(p.quantity ?? '');
  const nova = num(p.nova_group);
  const barcode = p.code ? normalizeGtin(String(p.code)) : undefined;
  return {
    id: `off:${barcode ?? name}`, name, brand: (p.brands ?? '').split(',')[0]?.trim() || undefined, barcode, source: 'off',
    imageUrl: p.image_front_url || p.image_front_small_url || undefined,
    ingredientsText: (p.ingredients_text_fr || p.ingredients_text || '').trim() || undefined,
    category: p.categories || cats.map((c: string) => c.replace(/^\w\w:/, '')).join(', ') || undefined,
    additivesTags: p.additives_tags ?? undefined,
    novaGroup: nova && nova >= 1 && nova <= 4 ? (nova as 1 | 2 | 3 | 4) : undefined,
    nutrients, basis: liquid ? 'ml' : 'g', portionSize: num(p.serving_quantity),
  };
}

async function getJson(url: string, timeoutMs = 12000): Promise<any> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

export type Lookup = { kind: 'found'; food: Food } | { kind: 'not_found' } | { kind: 'offline' };

export async function fetchByBarcode(barcode: string): Promise<Lookup> {
  try {
    const j = await getJson(`${HOST}/api/v2/product/${normalizeGtin(barcode)}.json?fields=${FIELDS}`);
    if (j.status !== 1 || !j.product) return { kind: 'not_found' };
    const f = offToFood({ ...j.product, code: j.product.code ?? barcode });
    return f ? { kind: 'found', food: f } : { kind: 'not_found' };
  } catch { return { kind: 'offline' }; }
}

export async function searchOff(query: string, limit = 20): Promise<Food[]> {
  try {
    const j = await getJson(`${HOST}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${limit}&fields=${FIELDS}`);
    return (j.products ?? []).map(offToFood).filter(Boolean) as Food[];
  } catch { return []; }
}
