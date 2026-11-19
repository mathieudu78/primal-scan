import type { Food, LoggedItem, Quantity } from '../types';

export const apple: Food = { id: 'apple', name: 'Pomme, crue', source: 'ciqual', category: 'fruits, légumes, légumineuses et oléagineux', basis: 'g',
  nutrients: { kcal: 52, protein: 0.3, carbs: 11.4, fat: 0.2, fiber: 2.4, sugars: 10, vitC: 4.6, potassium: 107, sodium: 1, vitK: 2.2, calcium: 6 } };
export const salmon: Food = { id: 'salmon', name: 'Saumon, cru', source: 'ciqual', category: 'viandes, œufs, poissons', basis: 'g',
  nutrients: { kcal: 190, protein: 20, carbs: 0, fat: 12, vitD: 11, vitB12: 3.2, selenium: 36, potassium: 380, sodium: 45, iodine: 40 } };
export const butter: Food = { id: 'butter', name: 'Beurre', source: 'off', ingredientsText: 'Crème pasteurisée, sel', basis: 'g', novaGroup: 3,
  nutrients: { kcal: 740, protein: 0.5, carbs: 0.5, fat: 82 }, portionSize: 10 };
export const soda: Food = { id: 'soda', name: 'Soda cola', source: 'off', basis: 'ml', density: 1.04,
  ingredientsText: 'Eau gazéifiée, sucre, colorant : caramel E150d, acidifiant : acide phosphorique, arômes naturels, caféine',
  nutrients: { kcal: 42, carbs: 10.6, sugars: 10.6, fat: 0, protein: 0, sodium: 5 } };
export const biscuit: Food = { id: 'bisc', name: 'Biscuit chocolat', source: 'off', basis: 'g', novaGroup: 4,
  ingredientsText: 'Farine de blé 32%, sucre, huile de palme, sirop de glucose, cacao maigre 5%, émulsifiant (lécithine de soja, E471), poudre à lever (carbonate acide d\'ammonium), arôme, sel',
  nutrients: { kcal: 480, protein: 6, carbs: 66, fat: 21, fiber: 3, sugars: 30, sodium: 300, addedSugars: 28 } };
export const unknownThing: Food = { id: 'unk', name: 'Truc', source: 'off', basis: 'g', ingredientsText: 'xylorbane de glandou, pluf', nutrients: { kcal: 100 } };
export const rice: Food = { id: 'rice', name: 'Riz blanc', source: 'ciqual', category: 'produits céréaliers', basis: 'g', nutrientState: 'raw', cookedYield: 2.5,
  nutrients: { kcal: 350, protein: 7, carbs: 78, fat: 0.6, fiber: 1 } };
export const sunflowerOilFood: Food = { id: 'soil', name: 'Huile de tournesol', source: 'ciqual', category: 'matières grasses', basis: 'g', nutrients: { kcal: 900, fat: 100 } };

export const item = (food: Food, amount: number, unit: Quantity['unit'] = 'g', state?: Quantity['state']): LoggedItem =>
  ({ id: food.id + amount + unit, food, qty: { amount, unit, state } });
