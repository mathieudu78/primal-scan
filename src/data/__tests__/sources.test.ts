import { describe, expect, it } from 'vitest';
import { ciqualFromRows, csvToRows, parseCell } from '../ciqualParse';
import { usdaToFood } from '../usda';

describe('CIQUAL (format supposé)', () => {
  const head = ['alim_grp_code', 'alim_grp_nom_fr', 'alim_code', 'alim_nom_fr', 'Energie, Règlement UE N° 1169/2011 (kcal/100 g)', 'Protéines, N x 6.25 (g/100 g)', 'Vitamine C (mg/100 g)', 'Vitamine B12 (µg/100 g)', 'Rétinol (µg/100 g)', 'Beta-Carotène (µg/100 g)', 'Vitamine K1 (µg/100 g)', 'Sodium (mg/100 g)'];
  const rows = [head, ['05', 'fruits', '13001', 'Pomme, crue', '52,1', '0,3', '4', '-', 'traces', '36', '< 2', 1], ['05', 'fruits', '13002', 'Sans énergie', '-', '1', '1', '1', '1', '1', '1', '1']];
  it('convertit, absent ≠ 0, vitamine A calculée', () => {
    const r = ciqualFromRows(rows);
    expect(r.foods).toHaveLength(1);
    const n = r.foods[0].nutrients;
    expect(n).toMatchObject({ kcal: 52.1, protein: 0.3, vitC: 4, sodium: 1, vitA: 3 });
    expect(n.vitB12).toBeUndefined(); expect(n.vitK).toBeUndefined();
    expect(r.foods[0].name).toBe('Pomme, crue'); expect(r.foods[0].category).toBe('fruits');
  });
  it('fichier inattendu -> erreur claire ; CSV', () => {
    expect(() => ciqualFromRows([['a', 'b'], ['1', '2']])).toThrow(/alim_nom_fr/);
    expect(csvToRows('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCell('traces')).toBe(0); expect(parseCell('')).toBeUndefined();
  });
});
describe('USDA', () => {
  it('convertit un résultat de recherche', () => {
    const f = usdaToFood({ fdcId: 1, description: 'APPLES, RAW', foodNutrients: [{ nutrientId: 1008, value: 52 }, { nutrientId: 1003, value: 0.26 }, { nutrientId: 1162, value: 4.6 }, { nutrientId: 1093, value: 1 }] })!;
    expect(f.nutrients).toMatchObject({ kcal: 52, protein: 0.26, vitC: 4.6, sodium: 1 });
    expect(f.nutrients.vitB12).toBeUndefined(); expect(f.name).toBe('Apples, raw');
    expect(usdaToFood({ fdcId: 2, description: 'X', foodNutrients: [] })).toBeNull();
  });
});
