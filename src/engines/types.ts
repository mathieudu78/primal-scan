import type { NutrientKey } from './nutrients';

/** Valeurs par 100 g (ou 100 ml). `undefined` = donnée ABSENTE ; `0` = vraie valeur nulle. */
export type NutrientMap = Partial<Record<NutrientKey, number>>;

export type FoodSource = 'off' | 'ciqual' | 'seed' | 'custom' | 'recipe';
export type Unit = 'g' | 'ml' | 'portion';
export type FoodState = 'raw' | 'cooked';
export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'other';

export interface Food {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  source: FoodSource;
  imageUrl?: string;
  /** Liste d'ingrédients brute (texte de l'emballage). Absente pour un aliment brut. */
  ingredientsText?: string;
  /** Catégorie (groupe CIQUAL, catégorie OFF) — sert à classer un aliment brut sans liste. */
  category?: string;
  /** Marqueurs fournis par Open Food Facts */
  additivesTags?: string[];       // ex: "en:e330"
  novaGroup?: 1 | 2 | 3 | 4;
  /** Valeurs pour 100 g (ou 100 ml si basis = 'ml') */
  nutrients: NutrientMap;
  basis: 'g' | 'ml';
  /** g/ml, pour convertir ml -> g (défaut 1) */
  density?: number;
  /** poids d'une portion en g (ou ml selon basis) */
  portionSize?: number;
  /** Les valeurs nutritionnelles sont-elles données pour l'aliment cru ou cuit ? */
  nutrientState?: FoodState;
  /** poids cuit / poids cru (ex. riz ≈ 2.5). Permet de convertir cru <-> cuit. */
  cookedYield?: number;
  /** valeurs indicatives (liste de démarrage) : à remplacer par la base officielle CIQUAL */
  approximate?: boolean;
  updatedAt?: number;
}

export interface Quantity {
  amount: number;
  unit: Unit;
  /** l'utilisateur a pesé cru ou cuit */
  state?: FoodState;
}

export interface LoggedItem {
  id: string;
  food: Food;
  qty: Quantity;
}
