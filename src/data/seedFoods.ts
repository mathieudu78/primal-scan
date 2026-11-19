import type { Food, FoodState, NutrientMap } from '../engines/types';

/**
 * LISTE DE DÉMARRAGE : ~30 aliments courants avec des valeurs INDICATIVES (ordres de grandeur usuels pour 100 g).
 * Ce n'est PAS la base CIQUAL officielle : importez-la avec `npm run import:ciqual` (voir README) pour des valeurs exactes.
 * Toutes les entrées sont marquées `approximate` et signalées comme telles dans l'application.
 */
type Row = [name: string, category: string, n: NutrientMap, extra?: Partial<Food>];
const F = 'fruits, légumes, légumineuses et oléagineux';
const V = 'viandes, œufs, poissons';
const rows: Row[] = [
  ['Pomme, crue', F, { kcal: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4, sugars: 10.4, vitC: 4.6, potassium: 107, vitK: 2.2, calcium: 6, sodium: 1 }],
  ['Banane, crue', F, { kcal: 89, protein: 0.9, carbs: 22.8, fat: 0.3, fiber: 2.6, sugars: 12.2, vitC: 8.7, potassium: 358, magnesium: 27, vitB6: 0.37 }],
  ['Carotte, crue', F, { kcal: 41, protein: 0.9, carbs: 9.6, fat: 0.2, fiber: 2.8, sugars: 4.7, vitA: 835, potassium: 320, vitK: 13.2, vitC: 5.9 }],
  ['Épinards, crus', F, { kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, vitA: 469, vitC: 28, vitK: 483, vitB9: 194, calcium: 99, iron: 2.7, magnesium: 79, potassium: 558 }],
  ['Brocoli, cru', F, { kcal: 34, protein: 2.8, carbs: 6.6, fat: 0.4, fiber: 2.6, vitC: 89, vitK: 102, vitB9: 63, potassium: 316, calcium: 47 }],
  ['Pomme de terre, crue', F, { kcal: 77, protein: 2, carbs: 17.5, fat: 0.1, fiber: 2.2, vitC: 19.7, potassium: 421, vitB6: 0.3 }],
  ['Tomate, crue', F, { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, vitC: 13.7, potassium: 237, vitA: 42, vitK: 7.9 }],
  ['Oignon, cru', F, { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, vitC: 7.4, potassium: 146 }],
  ['Courgette, crue', F, { kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fiber: 1, vitC: 17.9, potassium: 261, vitK: 4.3 }],
  ['Avocat, cru', F, { kcal: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7, satFat: 2.1, monoFat: 9.8, polyFat: 1.8, potassium: 485, vitK: 21, vitB9: 81, vitE: 2.1, vitC: 10 }],
  ['Amandes', F, { kcal: 579, protein: 21.2, carbs: 21.6, fat: 49.9, fiber: 12.5, satFat: 3.8, monoFat: 31.6, polyFat: 12.3, vitE: 25.6, magnesium: 270, calcium: 269, potassium: 733, phosphorus: 481, vitB2: 1.14, zinc: 3.1, manganese: 2.2, copper: 1 }],
  ['Noix', F, { kcal: 654, protein: 15.2, carbs: 13.7, fat: 65.2, fiber: 6.7, satFat: 6.1, monoFat: 8.9, polyFat: 47.2, magnesium: 158, phosphorus: 346, copper: 1.6, manganese: 3.4, zinc: 3.1, vitB6: 0.54, vitB9: 98 }],
  ['Lentilles, sèches, crues', 'légumineuses', { kcal: 352, protein: 24.6, carbs: 63.4, fat: 1.1, fiber: 10.7, iron: 6.5, vitB9: 479, potassium: 677, magnesium: 47, zinc: 3.3, vitB1: 0.87 }, { nutrientState: 'raw' as FoodState, cookedYield: 2.5 }],
  ['Œuf entier, cru', V, { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, satFat: 3.1, monoFat: 3.6, polyFat: 1.9, vitA: 160, vitD: 2, vitB12: 0.89, vitB2: 0.46, selenium: 30.7, iron: 1.75, zinc: 1.29, vitB5: 1.4, vitB9: 47, phosphorus: 198, calcium: 56 }, { portionSize: 50 }],
  ['Poulet, blanc, cru', V, { kcal: 120, protein: 22.5, carbs: 0, fat: 2.6, potassium: 370, phosphorus: 213, selenium: 22 }],
  ['Bœuf haché 15 % MG, cru', V, { kcal: 215, protein: 18.6, carbs: 0, fat: 15, iron: 2.1, zinc: 4.5, vitB12: 2.2, selenium: 15, potassium: 270 }],
  ['Saumon d’élevage, cru', V, { kcal: 208, protein: 20.4, carbs: 0, fat: 13.4, satFat: 3.1, monoFat: 3.8, polyFat: 3.9, vitD: 11, vitB12: 3.2, selenium: 36.5, potassium: 363, vitB6: 0.64, vitB3: 8 }],
  ['Lait entier', 'produits laitiers', { kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3, satFat: 1.9, calcium: 113, potassium: 132, vitB2: 0.17, vitB12: 0.45, phosphorus: 84 }],
  ['Yaourt nature', 'produits laitiers', { kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3, calcium: 121, vitB12: 0.37, vitB2: 0.14, potassium: 155, phosphorus: 95 }],
  ['Emmental', 'produits laitiers', { kcal: 380, protein: 28.4, carbs: 0.4, fat: 29, satFat: 18, calcium: 1000 }],
  ['Beurre doux', 'matières grasses', { kcal: 717, protein: 0.9, carbs: 0.1, fat: 81, satFat: 51, monoFat: 21, polyFat: 3, vitA: 684 }, { portionSize: 10 }],
  ['Huile d’olive vierge extra', 'matières grasses', { kcal: 884, protein: 0, carbs: 0, fat: 100, satFat: 13.8, monoFat: 73, polyFat: 10.5, vitE: 14.4, vitK: 60 }, { density: 0.91, portionSize: 10 }],
  ['Riz blanc, cru', 'produits céréaliers', { kcal: 360, protein: 6.7, carbs: 79.3, fat: 0.6, fiber: 1.3 }, { nutrientState: 'raw' as FoodState, cookedYield: 2.7 }],
  ['Pâtes sèches, crues', 'produits céréaliers', { kcal: 371, protein: 13, carbs: 74.7, fat: 1.5, fiber: 3.2 }, { nutrientState: 'raw' as FoodState, cookedYield: 2.3 }],
  ['Miel', 'produits sucrés', { kcal: 304, protein: 0.3, carbs: 82.4, fat: 0, sugars: 82.1, addedSugars: 0 }, { portionSize: 20 }],
  ['Chocolat noir 70-85 %', 'produits sucrés', { kcal: 598, protein: 7.8, carbs: 45.9, fat: 42.6, fiber: 10.9, satFat: 24.5, iron: 11.9, magnesium: 228, potassium: 715, copper: 1.8, manganese: 1.95, zinc: 3.3 }, { ingredientsText: 'Pâte de cacao, sucre, beurre de cacao' }],
  ['Sucre blanc', 'produits sucrés', { kcal: 387, protein: 0, carbs: 99.9, fat: 0, sugars: 99.8 }],
  ['Eau plate', 'eaux et boissons non sucrées', { kcal: 0, protein: 0, carbs: 0, fat: 0 }, { basis: 'ml' as const }],
];

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const SEED_FOODS: Food[] = rows.map(([name, category, nutrients, extra]) => ({
  id: `seed:${slug(name)}`, name, source: 'seed', category, nutrients, basis: 'g', approximate: true, ...extra,
}));
