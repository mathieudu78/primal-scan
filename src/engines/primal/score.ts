import { CLASS_INFO, type Additive, type IngClass } from './dictionary';
import { classify, classifyByCategory, detectAdditives, parseIngredients, type ParsedIngredient } from './parse';
import { massGrams } from '../nutrition';
import type { Food, LoggedItem } from '../types';

/* =====================================================================
 * NOTE PRIMAL (0-100) — jamais influencée par les calories.
 * Elle est calculée sur la COMPOSITION (ingrédients × quantités) ; pour un repas,
 * un jour ou une période on fusionne les compositions pondérées par la masse,
 * on ne fait JAMAIS la moyenne des notes.
 * ===================================================================== */

export interface PrimalConfig {
  /** points maximum de chaque critère (somme libre, la note est ramenée sur 100) */
  weights: { naturalness: number; transformation: number; additives: number; fats: number; nutrition: number; simplicity: number };
  /** surcharge de la "naturalité" (0..1) d'une classe d'ingrédient, ex. { grain_whole: 1 } */
  naturalnessOverrides: Partial<Record<IngClass, number>>;
}
export const DEFAULT_PRIMAL_CONFIG: PrimalConfig = {
  weights: { naturalness: 25, transformation: 25, additives: 15, fats: 10, nutrition: 15, simplicity: 10 },
  naturalnessOverrides: {},
};

const ADDITIVE_PENALTY = [0, 1.5, 3.5, 6] as const; // points retirés sur 15 selon le risque
const NOVA_VALUE = { 1: 1, 2: 0.75, 3: 0.45, 4: 0.05 } as const;
const MARKER_CLASSES: IngClass[] = ['industrial', 'flavouring', 'sweetener', 'bad_fat', 'modified_starch'];
const PROCESSED_CLASSES: IngClass[] = ['sugar', 'refined_oil', 'grain_refined', 'natural_sweetener'];

export interface FoodAnalysis {
  ingredients: ParsedIngredient[];
  additives: Additive[];
  /** la composition est connue (liste fournie ou aliment brut identifié) */
  known: boolean;
  nat: number; natMin: number; natMax: number;
  unknownShare: number;
  transformation: number;
  transformationSource: 'nova' | 'estimée';
  goodFatShare: number; badFatShare: number;
  addedSugarPer100: number | undefined;
  fiberPer100: number | undefined;
  saltPer100: number | undefined;
  ingredientCount: number;
}

function natOf(cls: IngClass, cfg: PrimalConfig) {
  return cfg.naturalnessOverrides[cls] ?? CLASS_INFO[cls].naturalness;
}

export function analyzeFood(food: Food, cfg: PrimalConfig = DEFAULT_PRIMAL_CONFIG): FoodAnalysis {
  let ingredients: ParsedIngredient[] = [];
  let additives: Additive[] = [];
  let known = false;

  const text = food.ingredientsText?.trim();
  if (text) {
    const parsed = parseIngredients(text);
    ingredients = parsed.ingredients;
    additives = parsed.additives;
    known = ingredients.length > 0;
  }
  if (!known) {
    // aliment brut / générique : un seul "ingrédient" = l'aliment lui-même
    const cat = classifyByCategory(food.category);
    const byName = classify(food.name);
    const cls: IngClass = food.category && /matieres? grasses?|huiles?/i.test(food.category.normalize('NFD').replace(/[̀-ͯ]/g, ''))
      ? (byName !== 'unknown' ? byName : 'natural_fat')
      : (cat ?? byName);
    ingredients = [{ name: food.name, cls, share: 1, depth: 0 }];
    known = cls !== 'unknown' && (food.source === 'ciqual' || food.source === 'custom' || !!food.category);
  }
  // les additifs peuvent aussi venir d'Open Food Facts (tags) en plus du texte
  if (food.additivesTags?.length) {
    const extra = detectAdditives('', food.additivesTags);
    const seen = new Set(additives.map((a) => a.code));
    for (const a of extra) if (!seen.has(a.code)) additives.push(a);
  }
  // arômes / ingrédients industriels sans code E : pénalité "technologique" légère (une fois par ingrédient)
  for (const ing of ingredients) {
    if ((ing.cls === 'flavouring' || ing.cls === 'industrial') && !/^e ?\d/i.test(ing.name.trim()) && detectAdditives(ing.name).length === 0) {
      additives.push({ code: 'ing:' + ing.name.toLowerCase(), name: ing.name, category: 'autre', risk: 1 });
    }
  }
  // édulcorants cités en ingrédient mais sans code E
  for (const ing of ingredients) {
    if (ing.cls === 'sweetener' && !additives.some((a) => a.category === 'édulcorant')) {
      additives.push({ code: 'sweetener', name: ing.name, category: 'édulcorant', risk: 1 });
    }
  }

  let nat = 0, natMin = 0, natMax = 0, unknownShare = 0, tAcc = 0, good = 0, bad = 0, sugarShare = 0;
  for (const i of ingredients) {
    const n = natOf(i.cls, cfg);
    nat += i.share * n;
    if (i.cls === 'unknown') { unknownShare += i.share; natMax += i.share; } else { natMin += i.share * n; natMax += i.share * n; }
    tAcc += i.share * CLASS_INFO[i.cls].transformation;
    const info = CLASS_INFO[i.cls];
    if (i.cls === 'natural_fat' || i.cls === 'refined_oil' || i.cls === 'bad_fat') { if (info.fat === 'good') good += i.share; else bad += i.share; }
    else if (i.cls === 'dairy') good += i.share * 0.15;
    if (info.addedSugar) sugarShare += i.share;
  }

  // transformation
  let transformation: number, source: FoodAnalysis['transformationSource'];
  if (food.novaGroup) { transformation = NOVA_VALUE[food.novaGroup]; source = 'nova'; }
  else {
    source = 'estimée';
    const hasMarker = ingredients.some((i) => MARKER_CLASSES.includes(i.cls)) || additives.some((a) => a.risk >= 1 || ['colorant', 'édulcorant', 'émulsifiant', 'exhausteur', 'épaississant'].includes(a.category));
    const hasProcessed = ingredients.some((i) => PROCESSED_CLASSES.includes(i.cls));
    if (hasMarker) transformation = 0.05;
    else if (hasProcessed) transformation = Math.min(0.5, tAcc);
    else transformation = ingredients.length <= 1 ? Math.min(1, tAcc) : Math.min(0.9, tAcc);
  }

  const n = food.nutrients;
  const saltPer100 = n.salt ?? (n.sodium !== undefined ? (n.sodium * 2.5) / 1000 : undefined);
  const hasFatClasses = ingredients.some((i) => i.cls === 'natural_fat' || i.cls === 'refined_oil' || i.cls === 'bad_fat');
  void hasFatClasses;
  return {
    ingredients, additives, known, nat, natMin, natMax, unknownShare, transformation, transformationSource: source,
    goodFatShare: good, badFatShare: bad,
    addedSugarPer100: n.addedSugars ?? (known ? sugarShare * 100 : undefined),
    fiberPer100: n.fiber, saltPer100,
    ingredientCount: Math.max(1, ingredients.length),
  };
}

/* ---------- Profil fusionnable (somme pondérée par la masse) ---------- */
export interface PrimalProfile {
  mass: number; knownMass: number;
  nat: number; natMin: number; natMax: number;
  unknownMass: number; trans: number;
  goodFat: number; badFat: number;
  countW: number;
  additives: Record<string, Additive>;
  sugar: { sum: number; mass: number };
  fiber: { sum: number; mass: number };
  salt: { sum: number; mass: number };
  foods: number;
}
export const emptyProfile = (): PrimalProfile => ({
  mass: 0, knownMass: 0, nat: 0, natMin: 0, natMax: 0, unknownMass: 0, trans: 0, goodFat: 0, badFat: 0, countW: 0,
  additives: {}, sugar: { sum: 0, mass: 0 }, fiber: { sum: 0, mass: 0 }, salt: { sum: 0, mass: 0 }, foods: 0,
});

export function profileOf(a: FoodAnalysis, grams: number): PrimalProfile {
  const p = emptyProfile();
  if (!(grams > 0)) return p;
  p.mass = grams; p.foods = 1;
  p.knownMass = a.known ? grams : 0;
  p.nat = a.nat * grams; p.natMin = a.natMin * grams; p.natMax = a.natMax * grams;
  p.unknownMass = a.unknownShare * grams; p.trans = a.transformation * grams;
  p.goodFat = a.goodFatShare * grams; p.badFat = a.badFatShare * grams;
  p.countW = a.ingredientCount * grams;
  for (const ad of a.additives) p.additives[ad.code === 'sweetener' ? 'sw:' + ad.name : ad.code] = ad;
  if (a.addedSugarPer100 !== undefined) p.sugar = { sum: (a.addedSugarPer100 / 100) * grams, mass: grams };
  if (a.fiberPer100 !== undefined) p.fiber = { sum: (a.fiberPer100 / 100) * grams, mass: grams };
  if (a.saltPer100 !== undefined) p.salt = { sum: (a.saltPer100 / 100) * grams, mass: grams };
  return p;
}

export function mergeProfiles(list: PrimalProfile[]): PrimalProfile {
  const o = emptyProfile();
  for (const p of list) {
    o.mass += p.mass; o.knownMass += p.knownMass; o.nat += p.nat; o.natMin += p.natMin; o.natMax += p.natMax;
    o.unknownMass += p.unknownMass; o.trans += p.trans; o.goodFat += p.goodFat; o.badFat += p.badFat; o.countW += p.countW;
    Object.assign(o.additives, p.additives);
    for (const k of ['sugar', 'fiber', 'salt'] as const) { o[k].sum += p[k].sum; o[k].mass += p[k].mass; }
    o.foods += p.foods;
  }
  return o;
}

export interface PrimalPart { key: keyof PrimalConfig['weights']; label: string; points: number; max: number; detail: string }
export interface PrimalResult {
  total: number; min: number; max: number;
  parts: PrimalPart[];
  confidence: number;               // 0..1
  unknownShare: number;             // part de la masse non reconnue
  additives: Additive[];
  label: 'Excellent' | 'Bon' | 'Moyen' | 'Faible' | 'Très faible';
}

export function labelFor(score: number): PrimalResult['label'] {
  return score >= 80 ? 'Excellent' : score >= 60 ? 'Bon' : score >= 40 ? 'Moyen' : score >= 20 ? 'Faible' : 'Très faible';
}
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function scoreProfile(p: PrimalProfile, cfg: PrimalConfig = DEFAULT_PRIMAL_CONFIG): PrimalResult | null {
  if (!(p.mass > 0)) return null;
  const w = cfg.weights;
  const M = p.mass;
  const adds = Object.values(p.additives);

  const nat = p.nat / M, natMin = p.natMin / M, natMax = p.natMax / M;
  const trans = p.trans / M;
  const addPenalty = adds.reduce((a, x) => a + ADDITIVE_PENALTY[x.risk], 0);
  const addFrac = clamp01(1 - addPenalty / 15);

  const fatMass = p.goodFat + p.badFat;
  const fatFrac = fatMass / M < 0.005 ? 1 : p.goodFat / fatMass;

  // qualité nutritionnelle : sucres ajoutés (7) + fibres (3) + sel (5) — jamais de calories
  const comps: Array<[number, number]> = []; // [poids, fraction]
  if (p.sugar.mass > 0) { const x = (p.sugar.sum / p.sugar.mass) * 100; comps.push([7, clamp01(1 - (x - 1) / 14)]); }
  if (p.fiber.mass > 0) { const x = (p.fiber.sum / p.fiber.mass) * 100; comps.push([3, clamp01(x / 3)]); }
  if (p.salt.mass > 0) { const x = (p.salt.sum / p.salt.mass) * 100; comps.push([5, clamp01(1 - (x - 0.3) / 1.5)]); }
  const wsum = comps.reduce((a, c) => a + c[0], 0);
  const nutFrac = wsum ? comps.reduce((a, c) => a + c[0] * c[1], 0) / wsum : 0.5;
  const nutCoverage = wsum / 15;

  const avgCount = p.countW / M;
  const simpl = clamp01(1 - (avgCount - 3) / 12);
  const unknownShare = p.unknownMass / M;
  const knownShare = p.knownMass / M;
  const transp = clamp01(knownShare * (1 - unknownShare));
  const simplFrac = (6 * simpl + 4 * transp) / 10;

  const parts: PrimalPart[] = [
    { key: 'naturalness', label: 'Naturalité', max: w.naturalness, points: w.naturalness * nat, detail: `${pct(nat)} d’ingrédients « naturels » (pondéré par la masse)` },
    { key: 'transformation', label: 'Transformation', max: w.transformation, points: w.transformation * trans, detail: `Niveau de transformation ${pct(1 - trans)}` },
    { key: 'additives', label: 'Additifs', max: w.additives, points: w.additives * addFrac, detail: adds.length ? `${adds.length} additif(s) détecté(s)` : 'Aucun additif détecté' },
    { key: 'fats', label: 'Matières grasses', max: w.fats, points: w.fats * fatFrac, detail: fatMass / M < 0.005 ? 'Pas de matière grasse ajoutée identifiée' : `${pct(fatFrac)} des graisses ajoutées sont de bonne qualité` },
    { key: 'nutrition', label: 'Qualité nutritionnelle', max: w.nutrition, points: w.nutrition * nutFrac, detail: nutCoverage < 1 ? `Basé sur ${Math.round(nutCoverage * 100)} % des données (sucres ajoutés, fibres, sel)` : 'Sucres ajoutés, fibres, sel' },
    { key: 'simplicity', label: 'Simplicité & transparence', max: w.simplicity, points: w.simplicity * simplFrac, detail: `~${avgCount.toFixed(1)} ingrédients par aliment · ${pct(transp)} de transparence` },
  ];
  const maxSum = parts.reduce((a, x) => a + x.max, 0);
  const total = (parts.reduce((a, x) => a + x.points, 0) / maxSum) * 100;
  const deltaPts = (n: number) => w.naturalness * (n - nat);
  const min = ((parts.reduce((a, x) => a + x.points, 0) + deltaPts(natMin)) / maxSum) * 100;
  const max = ((parts.reduce((a, x) => a + x.points, 0) + deltaPts(natMax)) / maxSum) * 100;

  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    total: r1(total), min: r1(Math.min(min, total)), max: r1(Math.max(max, total)),
    parts: parts.map((x) => ({ ...x, points: r1(x.points) })),
    confidence: clamp01(knownShare * (1 - unknownShare) * (0.5 + 0.5 * nutCoverage)),
    unknownShare, additives: adds, label: labelFor(total),
  };
}
const pct = (x: number) => `${Math.round(x * 100)} %`;

/** Note d'un aliment seul (pour 100 g par défaut). */
export function scoreFood(food: Food, cfg: PrimalConfig = DEFAULT_PRIMAL_CONFIG, grams = 100) {
  return scoreProfile(profileOf(analyzeFood(food, cfg), grams), cfg);
}

/** Note d'un repas / d'une journée / d'une période : fusion des compositions, pas de moyenne de notes. */
export function scoreItems(items: LoggedItem[], cfg: PrimalConfig = DEFAULT_PRIMAL_CONFIG) {
  return scoreProfile(mergeProfiles(items.map((i) => profileOf(analyzeFood(i.food, cfg), Math.max(0, massGrams(i.food, i.qty))))), cfg);
}
