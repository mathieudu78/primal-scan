import { describe, expect, it } from 'vitest';
import { convert, parseCell } from '../../../scripts/import-ciqual.mjs';
import { searchGeneric } from '../ciqual';
import { SEED_FOODS } from '../seedFoods';
import { scoreFood } from '../../engines/primal/score';

describe('importeur CIQUAL (format supposé, voir README)', () => {
  it('cellules : absent ≠ 0', () => {
    expect(parseCell('-')).toBeUndefined(); expect(parseCell('')).toBeUndefined();
    expect(parseCell('traces')).toBe(0); expect(parseCell('< 0,5')).toBeUndefined(); expect(parseCell('12,5')).toBe(12.5);
  });
  it('convertit un CSV minimal', () => {
    const csv = 'alim_code;alim_grp_nom_fr;alim_nom_fr;Energie, Règlement UE N° 1169/2011 (kcal/100 g);Protéines, N x 6.25 (g/100 g);Vitamine C (mg/100 g);Vitamine B12 (µg/100 g)\n13001;fruits;Pomme, crue;52;0,3;4;-\n';
    const { foods } = convert(csv) as unknown as { foods: Array<{ nutrients: Record<string, number> }> };
    expect(foods[0].nutrients).toEqual({ kcal: 52, protein: 0.3, vitC: 4 });
    expect(foods[0].nutrients.vitB12).toBeUndefined();
  });
});
describe('aliments génériques', () => {
  it('recherche hors ligne sans accent', () => {
    expect(searchGeneric('epinard')[0].name).toMatch(/pinards/);
    expect(searchGeneric('saumon').length).toBeGreaterThan(0);
  });
  it('liste de démarrage : signalée approximative et notée sans erreur', () => {
    expect(SEED_FOODS.every((f) => f.approximate)).toBe(true);
    for (const f of SEED_FOODS) { const r = scoreFood(f); expect(r).not.toBeNull(); expect(r!.total).toBeGreaterThanOrEqual(0); expect(r!.total).toBeLessThanOrEqual(100); }
    expect(scoreFood(SEED_FOODS.find((f) => /Pomme,/.test(f.name))!)!.total).toBeGreaterThan(85);
    expect(scoreFood(SEED_FOODS.find((f) => /Sucre blanc/.test(f.name))!)!.total).toBeLessThan(75);
  });
});
