import type { Food, NutrientMap } from '../engines/types';
import type { NutrientKey } from '../engines/nutrients';

/**
 * Conversion de la table CIQUAL officielle (ANSES, format « large » : une ligne par aliment, une colonne par constituant).
 * Les colonnes sont reconnues par leur NOM. Cellule vide ou « - » = donnée ABSENTE ; « traces » = 0 ; « < x » = absente.
 * ⚠ Les intitulés exacts n'ont pas pu être vérifiés sur le fichier réel : `report.recognised` liste ce qui a été reconnu.
 */
const MAP: Array<[RegExp, NutrientKey]> = [
  [/^energie.*kcal/i, 'kcal'], [/^prot[ée]ines/i, 'protein'], [/^glucides/i, 'carbs'], [/^lipides/i, 'fat'],
  [/^fibres/i, 'fiber'], [/^sucres/i, 'sugars'], [/^ag satur[ée]s/i, 'satFat'], [/^ag mono/i, 'monoFat'], [/^ag poly/i, 'polyFat'],
  [/^sel chlorure/i, 'salt'],
  [/^vitamine b1\b|^vitamine b1 /i, 'vitB1'], [/^vitamine b2/i, 'vitB2'], [/^vitamine b3/i, 'vitB3'], [/^vitamine b5/i, 'vitB5'],
  [/^vitamine b6/i, 'vitB6'], [/^vitamine b9/i, 'vitB9'], [/^vitamine b12/i, 'vitB12'], [/^vitamine c/i, 'vitC'],
  [/^vitamine d/i, 'vitD'], [/^vitamine e/i, 'vitE'], [/^vitamine k1/i, 'vitK'], [/^vitamine k\b|^vitamine k \(/i, 'vitK'],
  [/^calcium/i, 'calcium'], [/^magn[ée]sium/i, 'magnesium'], [/^potassium/i, 'potassium'], [/^sodium/i, 'sodium'],
  [/^phosphore/i, 'phosphorus'], [/^fer\b/i, 'iron'], [/^zinc/i, 'zinc'], [/^cuivre/i, 'copper'], [/^s[ée]l[ée]nium/i, 'selenium'],
  [/^iode/i, 'iodine'], [/^mangan[èe]se/i, 'manganese'],
];

export function parseCell(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : undefined;
  const s = String(v ?? '').trim().replace(',', '.');
  if (s === '' || s === '-') return undefined;
  if (/^traces?$/i.test(s)) return 0;
  if (s.startsWith('<')) return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export interface CiqualReport { foods: Food[]; recognised: string[]; rows: number }

export function ciqualFromRows(rows: unknown[][]): CiqualReport {
  if (rows.length < 2) throw new Error('Fichier vide');
  const head = rows[0].map((h) => String(h ?? '').replace(/\s+/g, ' ').trim());
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const iName = col(/^alim_nom_fr$|^nom.*fran/i), iGroup = col(/^alim_grp_nom_fr$|groupe/i), iCode = col(/^alim_code$/i);
  if (iName < 0) throw new Error('Colonne « alim_nom_fr » introuvable : ce n’est pas la table CIQUAL attendue');
  const cols: Array<[number, NutrientKey]> = [];
  const seen = new Set<NutrientKey>();
  for (const [re, key] of MAP) { if (seen.has(key)) continue; const i = col(re); if (i >= 0) { cols.push([i, key]); seen.add(key); } }
  const iRet = col(/^r[ée]tinol/i), iCar = col(/^b[êe]ta[- ]?carot/i);
  const foods: Food[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]; const name = String(row[iName] ?? '').trim();
    if (!name) continue;
    const n: NutrientMap = {};
    for (const [i, key] of cols) { const v = parseCell(row[i]); if (v !== undefined) n[key] = Math.round(v * 1000) / 1000; }
    // vitamine A (µg RAE) ≈ rétinol + bêta-carotène / 12
    const ret = iRet >= 0 ? parseCell(row[iRet]) : undefined, car = iCar >= 0 ? parseCell(row[iCar]) : undefined;
    if (ret !== undefined || car !== undefined) n.vitA = Math.round(((ret ?? 0) + (car ?? 0) / 12) * 100) / 100;
    if (n.kcal === undefined) continue;
    foods.push({ id: `ciqual:${row[iCode] ?? r}`, name, source: 'ciqual', category: iGroup >= 0 ? String(row[iGroup] ?? '') || undefined : undefined, nutrients: n, basis: 'g' });
  }
  return { foods, recognised: [...cols.map(([, k]) => k), ...(iRet >= 0 || iCar >= 0 ? ['vitA' as NutrientKey] : [])], rows: rows.length - 1 };
}

/** CSV simple (séparateur ; ou ,) pour les exports texte. */
export function csvToRows(text: string): unknown[][] {
  const t = text.replace(/^﻿/, '');
  const sep = (t.split('\n')[0].match(/;/g) ?? []).length >= (t.split('\n')[0].match(/,/g) ?? []).length ? ';' : ',';
  return t.split(/\r?\n/).filter(Boolean).map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, '')));
}
