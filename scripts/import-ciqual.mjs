#!/usr/bin/env node
/**
 * Convertit la table CIQUAL officielle (ANSES) en assets/data/ciqual.json.
 *
 * 1. Téléchargez la table "Ciqual" sur https://ciqual.anses.fr (rubrique « Table de composition ») ;
 * 2. Exportez-la en CSV (séparateur « ; », encodage UTF-8, une ligne par aliment, une colonne par constituant) ;
 * 3. Lancez :  npm run import:ciqual -- chemin/vers/ciqual.csv
 *
 * Les colonnes sont reconnues par leur NOM (ex. « Vitamine C (mg/100 g) »), pas par leur position.
 * Les cellules « - » ou vides = donnée ABSENTE (jamais 0). « traces » = 0. « < x » = absente.
 * ⚠ Ce script n'a pas pu être essayé sur le fichier réel au moment de l'écriture : vérifiez le rapport affiché.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const MAP = [ // [regex sur l'en-tête, clé, facteur]
  [/^energie.*kcal/i, 'kcal', 1], [/^prot[ée]ines.*g\/100/i, 'protein', 1], [/^glucides.*g\/100/i, 'carbs', 1],
  [/^lipides.*g\/100/i, 'fat', 1], [/^fibres.*g\/100/i, 'fiber', 1], [/^sucres.*g\/100/i, 'sugars', 1],
  [/^ag satur[ée]s.*g\/100/i, 'satFat', 1], [/^ag mono.*g\/100/i, 'monoFat', 1], [/^ag poly.*g\/100/i, 'polyFat', 1],
  [/^sel chlorure de sodium.*g\/100/i, 'salt', 1],
  [/^vitamine a.*|^r[ée]tinol.*/i, null, 1], [/^vitamine b1.*mg/i, 'vitB1', 1], [/^vitamine b2.*mg/i, 'vitB2', 1],
  [/^vitamine b3.*mg/i, 'vitB3', 1], [/^vitamine b5.*mg/i, 'vitB5', 1], [/^vitamine b6.*mg/i, 'vitB6', 1],
  [/^vitamine b9.*[µu]g/i, 'vitB9', 1], [/^vitamine b12.*[µu]g/i, 'vitB12', 1], [/^vitamine c.*mg/i, 'vitC', 1],
  [/^vitamine d.*[µu]g/i, 'vitD', 1], [/^vitamine e.*mg/i, 'vitE', 1], [/^vitamine k.*[µu]g/i, 'vitK', 1],
  [/^calcium.*mg/i, 'calcium', 1], [/^magn[ée]sium.*mg/i, 'magnesium', 1], [/^potassium.*mg/i, 'potassium', 1],
  [/^sodium.*mg/i, 'sodium', 1], [/^phosphore.*mg/i, 'phosphorus', 1], [/^fer .*mg|^fer \(/i, 'iron', 1],
  [/^zinc.*mg/i, 'zinc', 1], [/^cuivre.*mg/i, 'copper', 1], [/^s[ée]l[ée]nium.*[µu]g/i, 'selenium', 1],
  [/^iode.*[µu]g/i, 'iodine', 1], [/^mangan[èe]se.*mg/i, 'manganese', 1],
];
export function parseCell(v) {
  const s = String(v ?? '').trim().replace(',', '.');
  if (s === '' || s === '-') return undefined;
  if (/^traces?$/i.test(s)) return 0;
  if (s.startsWith('<')) return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}
export function convert(csv) {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const head = lines.shift().split(';').map((h) => h.replace(/^"|"$/g, '').trim());
  const col = (re) => head.findIndex((h) => re.test(h));
  const iName = col(/^alim_nom_fr$|^nom/i), iGroup = col(/groupe|alim_grp_nom_fr/i), iCode = col(/^alim_code$|^code/i);
  if (iName < 0) throw new Error('Colonne du nom de l’aliment introuvable');
  const cols = MAP.map(([re, key, f]) => [col(re), key, f]).filter(([i, key]) => i >= 0 && key);
  const vitA = col(/^r[ée]tinol equivalent|vitamine a/i);
  const foods = [];
  for (const line of lines) {
    const c = line.split(';').map((x) => x.replace(/^"|"$/g, ''));
    const nutrients = {};
    for (const [i, key, f] of cols) { const v = parseCell(c[i]); if (v !== undefined) nutrients[key] = Math.round(v * f * 1000) / 1000; }
    if (vitA >= 0) { const v = parseCell(c[vitA]); if (v !== undefined) nutrients.vitA = v; }
    if (nutrients.kcal === undefined) continue;
    foods.push({ id: `ciqual:${c[iCode] ?? foods.length}`, name: c[iName], source: 'ciqual', category: iGroup >= 0 ? c[iGroup] : undefined, nutrients, basis: 'g' });
  }
  return { foods, recognisedColumns: cols.map(([, k]) => k) };
}
if (process.argv[1] && process.argv[1].endsWith('import-ciqual.mjs')) {
  const file = process.argv[2];
  if (!file) { console.error('Usage: npm run import:ciqual -- fichier.csv'); process.exit(1); }
  const { foods, recognisedColumns } = convert(readFileSync(file, 'utf8'));
  writeFileSync(new URL('../assets/data/ciqual.json', import.meta.url), JSON.stringify(foods));
  console.log(`${foods.length} aliments importés. Constituants reconnus : ${recognisedColumns.join(', ')}`);
  if (foods.length < 500) console.warn('⚠ Moins de 500 aliments : vérifiez le format du fichier.');
}
