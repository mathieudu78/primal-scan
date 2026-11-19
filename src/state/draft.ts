import type { Food, Quantity } from '../engines/types';

/** Brouillon de recette partagé entre l'écran d'édition et le sélecteur d'aliments. */
export interface RecipeDraft { id?: string; name: string; photoUri?: string; servings: number; items: Array<{ food: Food; qty: Quantity }> }
let draft: RecipeDraft | null = null;
const listeners = new Set<() => void>();
export const getDraft = () => draft;
export const setDraft = (d: RecipeDraft | null) => { draft = d; listeners.forEach((l) => l()); };
export const subscribeDraft = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
