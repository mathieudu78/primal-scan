import type { Food, NutrientMap } from '../engines/types';
import type { NutrientKey } from '../engines/nutrients';

/** USDA FoodData Central (gratuit). Clé de démonstration limitée ; clé personnelle gratuite sur fdc.nal.usda.gov. */
const ID: Record<number, NutrientKey> = {
  1008: 'kcal', 1003: 'protein', 1005: 'carbs', 1004: 'fat', 1079: 'fiber', 1258: 'satFat', 1292: 'monoFat', 1293: 'polyFat', 2000: 'sugars',
  1106: 'vitA', 1165: 'vitB1', 1166: 'vitB2', 1167: 'vitB3', 1170: 'vitB5', 1175: 'vitB6', 1176: 'vitB8', 1177: 'vitB9', 1178: 'vitB12',
  1162: 'vitC', 1114: 'vitD', 1109: 'vitE', 1185: 'vitK',
  1087: 'calcium', 1090: 'magnesium', 1092: 'potassium', 1093: 'sodium', 1091: 'phosphorus', 1089: 'iron', 1095: 'zinc',
  1098: 'copper', 1103: 'selenium', 1100: 'iodine', 1101: 'manganese',
};
export function usdaToFood(f: any): Food | null {
  const name = String(f?.description ?? '').trim(); if (!name) return null;
  const n: NutrientMap = {};
  for (const x of f.foodNutrients ?? []) {
    const id = Number(x.nutrientId ?? x.nutrient?.id); const key = ID[id]; const v = Number(x.value ?? x.amount);
    if (key && Number.isFinite(v) && v >= 0) n[key] = v;
  }
  if (n.salt === undefined && n.sodium !== undefined) n.salt = Math.round(n.sodium * 2.5) / 1000;
  if (n.kcal === undefined) return null;
  return { id: `usda:${f.fdcId}`, name: name.charAt(0) + name.slice(1).toLowerCase(), brand: f.brandOwner || undefined, source: 'custom', category: f.foodCategory, nutrients: n, basis: 'g' };
}
export async function searchUsda(query: string, apiKey = 'DEMO_KEY', limit = 15): Promise<Food[]> {
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=${limit}&dataType=Foundation,SR%20Legacy&api_key=${encodeURIComponent(apiKey)}`;
    const r = await fetch(url); if (!r.ok) return [];
    return ((await r.json()).foods ?? []).map(usdaToFood).filter(Boolean) as Food[];
  } catch { return []; }
}
