import { isValidGtin, normalizeGtin } from './barcode';

const STOP = /(valeurs?\s+nutritionnelles?|informations?\s+nutritionnelles?|nutrition\s+facts?|nutritional|peut\s+contenir|may\s+contain|traces?\s+(?:éventuelles?|eventuelles?)|conservation|à\s+consommer|a\s+consommer|best\s+before|à\s+conserver|fabriqu|packed|distribu|origine|energie|énergie|energy|poids\s+net|net\s+weight|conditionn)/i;

/** Isole la liste d'ingrédients dans le texte brut d'un OCR. undefined si introuvable (jamais d'invention). */
export function extractIngredients(raw: string): string | undefined {
  const text = raw.replace(/\r/g, '').replace(/-\n/g, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ');
  const m = text.match(/(?:ingr[ée]dients?|ingredients?|zutaten|ingredienti)\s*[:：.]?\s*/i);
  if (!m || m.index === undefined) return undefined;
  let rest = text.slice(m.index + m[0].length);
  const stop = rest.search(STOP);
  if (stop > 10) rest = rest.slice(0, stop);
  rest = rest.replace(/[|_]+/g, ' ').replace(/\s+([,.;:)])/g, '$1').trim().replace(/[.\s]+$/, '');
  return rest.length >= 4 ? rest : undefined;
}

/** Cherche un code-barres imprimé (EAN-13/8/UPC) dans un texte OCR. */
export function findGtin(raw: string): string | undefined {
  const compact = raw.replace(/(\d)[ -](?=\d)/g, '$1'); // "301 7620 422003" -> chiffres collés
  const c = compact.match(/\d{8,14}/g) ?? [];
  const hit = c.find(isValidGtin);
  return hit ? normalizeGtin(hit) : undefined;
}
