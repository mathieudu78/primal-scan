import { describe, expect, it } from 'vitest';
import { barcodeFromQr, isValidGtin, normalizeGtin } from '../barcode';
import { extractIngredients, findGtin } from '../ocr';
import { offToFood } from '../off';
import { scoreFood } from '../../engines/primal/score';

describe('codes-barres', () => {
  it('validation de clé GTIN', () => {
    expect(isValidGtin('3017620422003')).toBe(true);   // EAN-13
    expect(isValidGtin('3017620422004')).toBe(false);
    expect(isValidGtin('96385074')).toBe(true);        // EAN-8
    expect(isValidGtin('036000291452')).toBe(true);    // UPC-A
    expect(isValidGtin('abc')).toBe(false);
    expect(normalizeGtin('036000291452')).toBe('0036000291452');
  });
  it('QR : GTIN dans une URL, sinon rien (pas de devinette)', () => {
    expect(barcodeFromQr('https://example.org/p/3017620422003?x=1')).toBe('3017620422003');
    expect(barcodeFromQr('https://example.org/menu')).toBeUndefined();
    expect(barcodeFromQr('12345678901234567890')).toBeUndefined();
  });
});

describe('OCR : liste d’ingrédients', () => {
  it('extrait la liste et s’arrête avant les allergènes / valeurs nutritionnelles', () => {
    const raw = 'NUTELLA\nIngrédients : Sucre, huile de palme, noisettes 13%,\ncacao maigre 7,4%, lait écrémé en poudre 6,6%,\némulsifiant : lécithines (soja), vanilline. Peut contenir des traces\nd\'autres fruits à coque. Valeurs nutritionnelles pour 100 g';
    const r = extractIngredients(raw)!;
    expect(r.startsWith('Sucre, huile de palme')).toBe(true);
    expect(r).toContain('vanilline');
    expect(r).not.toMatch(/peut contenir|valeurs/i);
  });
  it('introuvable -> undefined', () => {
    expect(extractIngredients('Une photo floue sans texte utile')).toBeUndefined();
  });
  it('GTIN imprimé sur l’emballage', () => {
    expect(findGtin('EAN 3 017620 422003 poids 400g')).toBe('3017620422003');
    expect(findGtin('1234567890123')).toBeUndefined();
  });
});

describe('Open Food Facts → Food', () => {
  const sample = {
    code: '3017620422003', product_name: 'Pâte à tartiner', brands: 'Marque X, Autre', quantity: '400 g',
    ingredients_text_fr: 'Sucre, huile de palme, noisettes 13%, cacao maigre 7,4%, lait écrémé en poudre, émulsifiant : lécithines (soja), vanilline',
    nova_group: 4, additives_tags: ['en:e322'], serving_quantity: 15, categories_tags: ['en:spreads'],
    nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9, 'saturated-fat_100g': 10.6, sugars_100g: 56.3, salt_100g: 0.107, 'vitamin-c_100g': 0.0046, 'vitamin-d_100g': 0.0000025, calcium_100g: 0.11, iron_100g: 0 },
  };
  it('convertit les unités (g → mg / µg) et conserve les données absentes comme absentes', () => {
    const f = offToFood(sample)!;
    expect(f.nutrients.kcal).toBe(539);
    expect(f.nutrients.vitC).toBeCloseTo(4.6, 3);      // 0.0046 g = 4.6 mg
    expect(f.nutrients.vitD).toBeCloseTo(2.5, 3);      // 2.5e-6 g = 2.5 µg
    expect(f.nutrients.calcium).toBeCloseTo(110, 3);
    expect(f.nutrients.iron).toBe(0);                   // vraie valeur nulle
    expect(f.nutrients.vitB12).toBeUndefined();         // absente ≠ 0
    expect(f.nutrients.fiber).toBeUndefined();
    expect(f.brand).toBe('Marque X'); expect(f.barcode).toBe('3017620422003'); expect(f.novaGroup).toBe(4);
    expect(f.basis).toBe('g'); expect(f.portionSize).toBe(15);
  });
  it('boisson -> millilitres ; kJ -> kcal si kcal absent ; sans nom -> null', () => {
    expect(offToFood({ product_name: 'Jus', categories_tags: ['en:beverages'], nutriments: { energy_100g: 418.4 } })!.basis).toBe('ml');
    expect(offToFood({ product_name: 'Jus', nutriments: { energy_100g: 418.4 } })!.nutrients.kcal).toBe(100);
    expect(offToFood({ nutriments: {} })).toBeNull();
  });
  it('le produit converti est noté (ultra-transformé → note basse, additif E322 détecté)', () => {
    const r = scoreFood(offToFood(sample)!)!;
    expect(r.total).toBeLessThan(45);
    expect(r.additives.map((a) => a.code)).toContain('e322');
  });
});
