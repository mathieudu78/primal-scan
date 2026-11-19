export const VITAMINS = ['vitA','vitB1','vitB2','vitB3','vitB5','vitB6','vitB8','vitB9','vitB12','vitC','vitD','vitE','vitK'] as const;
export const MINERALS = ['calcium','magnesium','potassium','sodium','phosphorus','iron','zinc','copper','selenium','iodine','manganese'] as const;
export const MACROS = ['protein','carbs','fat','fiber','satFat','monoFat','polyFat'] as const;
/** Autres champs utiles (jamais utilisés par la note micronutritionnelle) */
export const EXTRAS = ['sugars','addedSugars','salt'] as const;

export type VitaminKey = (typeof VITAMINS)[number];
export type MineralKey = (typeof MINERALS)[number];
export type MacroKey = (typeof MACROS)[number];
export type MicroKey = VitaminKey | MineralKey;
export type NutrientKey = 'kcal' | MacroKey | MicroKey | (typeof EXTRAS)[number];

export interface NutrientDef {
  key: NutrientKey;
  label: string;
  unit: 'kcal' | 'g' | 'mg' | 'µg';
  group: 'energy' | 'macro' | 'vitamin' | 'mineral' | 'extra';
}

export const NUTRIENTS: NutrientDef[] = [
  { key: 'kcal', label: 'Énergie', unit: 'kcal', group: 'energy' },
  { key: 'protein', label: 'Protéines', unit: 'g', group: 'macro' },
  { key: 'carbs', label: 'Glucides', unit: 'g', group: 'macro' },
  { key: 'fat', label: 'Lipides', unit: 'g', group: 'macro' },
  { key: 'fiber', label: 'Fibres', unit: 'g', group: 'macro' },
  { key: 'satFat', label: 'Acides gras saturés', unit: 'g', group: 'macro' },
  { key: 'monoFat', label: 'Acides gras mono-insaturés', unit: 'g', group: 'macro' },
  { key: 'polyFat', label: 'Acides gras polyinsaturés', unit: 'g', group: 'macro' },
  { key: 'sugars', label: 'Sucres', unit: 'g', group: 'extra' },
  { key: 'addedSugars', label: 'Sucres ajoutés', unit: 'g', group: 'extra' },
  { key: 'salt', label: 'Sel', unit: 'g', group: 'extra' },
  { key: 'vitA', label: 'Vitamine A', unit: 'µg', group: 'vitamin' },
  { key: 'vitB1', label: 'Vitamine B1 (thiamine)', unit: 'mg', group: 'vitamin' },
  { key: 'vitB2', label: 'Vitamine B2 (riboflavine)', unit: 'mg', group: 'vitamin' },
  { key: 'vitB3', label: 'Vitamine B3 (niacine)', unit: 'mg', group: 'vitamin' },
  { key: 'vitB5', label: 'Vitamine B5 (acide pantothénique)', unit: 'mg', group: 'vitamin' },
  { key: 'vitB6', label: 'Vitamine B6', unit: 'mg', group: 'vitamin' },
  { key: 'vitB8', label: 'Vitamine B8 (biotine)', unit: 'µg', group: 'vitamin' },
  { key: 'vitB9', label: 'Vitamine B9 (folates)', unit: 'µg', group: 'vitamin' },
  { key: 'vitB12', label: 'Vitamine B12', unit: 'µg', group: 'vitamin' },
  { key: 'vitC', label: 'Vitamine C', unit: 'mg', group: 'vitamin' },
  { key: 'vitD', label: 'Vitamine D', unit: 'µg', group: 'vitamin' },
  { key: 'vitE', label: 'Vitamine E', unit: 'mg', group: 'vitamin' },
  { key: 'vitK', label: 'Vitamine K', unit: 'µg', group: 'vitamin' },
  { key: 'calcium', label: 'Calcium', unit: 'mg', group: 'mineral' },
  { key: 'magnesium', label: 'Magnésium', unit: 'mg', group: 'mineral' },
  { key: 'potassium', label: 'Potassium', unit: 'mg', group: 'mineral' },
  { key: 'sodium', label: 'Sodium', unit: 'mg', group: 'mineral' },
  { key: 'phosphorus', label: 'Phosphore', unit: 'mg', group: 'mineral' },
  { key: 'iron', label: 'Fer', unit: 'mg', group: 'mineral' },
  { key: 'zinc', label: 'Zinc', unit: 'mg', group: 'mineral' },
  { key: 'copper', label: 'Cuivre', unit: 'mg', group: 'mineral' },
  { key: 'selenium', label: 'Sélénium', unit: 'µg', group: 'mineral' },
  { key: 'iodine', label: 'Iode', unit: 'µg', group: 'mineral' },
  { key: 'manganese', label: 'Manganèse', unit: 'mg', group: 'mineral' },
];

export const NUTRIENT_BY_KEY = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n])) as Record<NutrientKey, NutrientDef>;
export const ALL_KEYS = NUTRIENTS.map((n) => n.key);
