import { ADDITIVE_BY_CODE, ADDITIVE_NAMES, CATEGORY_RULES, CLASS_INFO, INGREDIENT_RULES, type Additive, type IngClass } from './dictionary';

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/[^a-z0-9%,;()\[\].:\-/]+/g, ' ').replace(/\s+/g, ' ').trim();
}
/** version pour comparer aux mots-clés (ponctuation -> espace) */
const flat = (s: string) => normalize(s).replace(/[%,;()\[\].:\-/]+/g, ' ').replace(/\s+/g, ' ').trim();

const esc = (k: string) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compiled: Array<[IngClass, RegExp[]]> = INGREDIENT_RULES.map(([c, ks]) => [c, ks.map((k) => new RegExp(`(^| )${esc(flat(k))}(s|x|es)?( |$)`))]);
const compiledNames = ADDITIVE_NAMES.map(([n, c]) => [new RegExp(`(^| )${esc(flat(n))}(s|x|es)?( |$)`), c] as const);

export function classify(token: string): IngClass {
  const t = flat(token);
  if (/\be ?\d{3,4}[a-i]?\b/.test(t) && !/aspartame|sucralose|acesulfame|stevi|sorbitol|maltitol|xylitol|erythritol/.test(t)) return 'industrial';
  if (/^(colorants?|emulsifiants?|acidifiants?|conservateurs?|antioxydants?|epaississants?|stabilisants?|exhausteurs?|regulateurs?|gelifiants?|agents?)\b/.test(t)) return 'industrial';
  for (const [cls, res] of compiled) for (const re of res) if (re.test(t)) return cls;
  return 'unknown';
}

export function classifyByCategory(category?: string): IngClass | undefined {
  if (!category) return undefined;
  const t = flat(category);
  for (const [re, cls] of CATEGORY_RULES) if (re.test(t)) return cls;
  return undefined;
}

export interface ParsedIngredient {
  name: string;
  cls: IngClass;
  /** pourcentage déclaré sur l'emballage, s'il existe */
  declaredPct?: number;
  /** part estimée de la masse du produit (0..1), somme = 1 */
  share: number;
  depth: number;
}

interface RawIng { name: string; pct?: number; depth: number; children: RawIng[] }

/** Découpe une liste d'ingrédients en tenant compte des parenthèses imbriquées. */
export function splitTop(text: string): string[] {
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

function parseLevel(text: string, depth: number): RawIng[] {
  return splitTop(text).map((tok) => {
    let name = tok, children: RawIng[] = [];
    const m = tok.match(/^([^(\[]*)[(\[](.*)[)\]]\s*(.*)$/s);
    if (m) {
      name = (m[1] + ' ' + (m[3] ?? '')).trim();
      const inner = m[2];
      // "(… , …)" = sous-ingrédients ; "(12%)" ou "(origine France)" = simple précision
      const stripped = inner.replace(/\d+(?:[.,]\d+)?\s*%/g, '').trim();
      const isNote = /^(origine|origin|issu|from|ue\b|eu\b|france|bio\b|organic|dont|min)/i.test(stripped);
      children = !isNote && (/[,;]/.test(stripped) || /[a-zà-ÿ]{3,}/i.test(stripped)) ? parseLevel(inner, depth + 1) : [];
      const pctIn = inner.match(/(\d+(?:[.,]\d+)?)\s*%/);
      if (pctIn && !children.length) tok = `${name} ${pctIn[0]}`;
    }
    const pct = (children.length ? name : tok).match(/(\d+(?:[.,]\d+)?)\s*%/);
    name = name.replace(/\d+(?:[.,]\d+)?\s*%/g, '').replace(/\b(min|minimum|dont|including|contains?|contient|origine\b.*)$/i, '').replace(/[*:]+/g, '').replace(/^\s*(ingredients?|ingrédients?)\s*:?/i, '').trim();
    return { name, pct: pct ? parseFloat(pct[1].replace(',', '.')) : undefined, depth, children };
  }).filter((r) => r.name.length > 0 || r.children.length > 0);
}

/** Estime la part de chaque ingrédient : pourcentages déclarés, sinon décroissance (Zipf) d'après l'ordre légal. */
function assignShares(list: RawIng[], total: number, out: ParsedIngredient[]) {
  const declared = list.reduce((a, r) => a + (r.pct ?? 0) / 100, 0);
  const free = list.filter((r) => r.pct === undefined);
  const remaining = Math.max(0, total - declared);
  const zipfSum = free.reduce((a, _r, i) => a + 1 / (i + 1), 0);
  let fi = 0;
  for (const r of list) {
    let share: number;
    if (r.pct !== undefined) share = r.pct / 100;
    else share = zipfSum ? remaining * (1 / (fi + 1)) / zipfSum : 0;
    if (r.pct === undefined) fi++;
    if (r.children.length) assignShares(r.children, share, out);
    else out.push({ name: r.name, cls: classify(r.name), declaredPct: r.pct, share, depth: r.depth });
  }
}

export interface ParsedList { ingredients: ParsedIngredient[]; additives: Additive[] }

export function parseIngredients(text: string): ParsedList {
  const raw = parseLevel(text.replace(/\s+/g, ' '), 0);
  const ingredients: ParsedIngredient[] = [];
  assignShares(raw, 1, ingredients);
  // renormaliser : la somme des parts vaut 1 (les % déclarés peuvent ne pas couvrir 100 %)
  const sum = ingredients.reduce((a, i) => a + i.share, 0);
  if (sum > 0) for (const i of ingredients) i.share /= sum;
  return { ingredients, additives: detectAdditives(text) };
}

/** Détecte les additifs (codes E et noms) ; dédoublonne. */
export function detectAdditives(text: string, offTags: string[] = []): Additive[] {
  const found = new Map<string, Additive>();
  const add = (code: string) => {
    const c = code.toLowerCase();
    const a = ADDITIVE_BY_CODE[c] ?? ADDITIVE_BY_CODE[c.replace(/[a-i]$/, '')];
    if (a) found.set(a.code, a);
    else if (/^e\d{3,4}[a-z]?$/.test(c)) found.set(c, { code: c, name: c.toUpperCase(), category: 'autre', risk: 1, note: 'Additif non répertorié (risque estimé neutre-technologique)' });
  };
  const t = normalize(text);
  for (const m of t.matchAll(/\be[ -]?(\d{3,4}[a-i]?)\b/g)) add('e' + m[1]);
  for (const tag of offTags) { const m = tag.match(/e(\d{3,4}[a-z]?)$/i); if (m) add('e' + m[1]); }
  const f = flat(text);
  for (const [re, code] of compiledNames) if (re.test(f)) add(code);
  return [...found.values()];
}

export { CLASS_INFO };
