import { describe, expect, it } from 'vitest';
import { apple, biscuit, butter, item, rice, salmon, soda, sunflowerOilFood, unknownThing } from './fixtures';
import { analyzeFood, DEFAULT_PRIMAL_CONFIG, scoreFood, scoreItems } from '../primal/score';
import { detectAdditives, parseIngredients } from '../primal/parse';
import { scoreMicro, scoreMicroFood } from '../micro';
import { sumItems } from '../nutrition';
import { summarizePeriod } from '../aggregate';
import { DEFAULT_GOALS } from '../goals';

describe('analyse des ingrédients', () => {
  it('parenthèses imbriquées, pourcentages et additifs', () => {
    const p = parseIngredients(biscuit.ingredientsText!);
    const names = p.ingredients.map((i) => i.name);
    expect(names).toContain('Farine de blé');
    expect(names.some((n) => /lécithine/i.test(n))).toBe(true);
    expect(p.ingredients.find((i) => /farine/i.test(i.name))!.declaredPct).toBe(32);
    expect(p.ingredients.reduce((a, i) => a + i.share, 0)).toBeCloseTo(1, 5);
    expect(p.additives.map((a) => a.code)).toEqual(expect.arrayContaining(['e471', 'e322']));
  });
  it('codes E et tags Open Food Facts', () => {
    expect(detectAdditives('colorant E 150d, E330').map((a) => a.code)).toEqual(expect.arrayContaining(['e150d', 'e330']));
    expect(detectAdditives('', ['en:e250', 'en:e407']).map((a) => a.code)).toEqual(['e250', 'e407']);
  });
  it('huile de palme / tournesol → graisses de mauvaise qualité ; beurre → bonne', () => {
    expect(analyzeFood(biscuit).badFatShare).toBeGreaterThan(0);
    expect(analyzeFood(butter).goodFatShare).toBeGreaterThan(0.05);
    expect(analyzeFood(sunflowerOilFood).badFatShare).toBe(1);
  });
});

describe('note Primal', () => {
  it('ordre cohérent : aliments entiers > transformés > ultra-transformés', () => {
    const a = scoreFood(apple)!.total, s = scoreFood(salmon)!.total, b = scoreFood(butter)!.total;
    const soda_ = scoreFood(soda)!.total, bis = scoreFood(biscuit)!.total;
    expect(a).toBeGreaterThan(85); expect(s).toBeGreaterThan(85);
    expect(b).toBeGreaterThan(bis); expect(b).toBeGreaterThan(soda_);
    expect(bis).toBeLessThan(35); expect(soda_).toBeLessThan(50);
    for (const x of [a, s, b, soda_, bis]) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(100); }
  });
  it('ingrédients inconnus : signalés, incertitude, pas présentés comme dangereux', () => {
    const r = scoreFood(unknownThing)!;
    expect(r.unknownShare).toBe(1);
    expect(r.max).toBeGreaterThan(r.total); expect(r.min).toBeLessThanOrEqual(r.total);
    expect(r.confidence).toBeLessThan(0.3);
    expect(r.additives).toHaveLength(0);
    expect(r.parts.find((p) => p.key === 'naturalness')!.points).toBeCloseTo(12.5, 1); // neutre (0.5), pas 0
  });
  it('REPAS : pas de moyenne simple — 20 g de bon aliment ne masquent pas 300 g de mauvais', () => {
    const good = item(apple, 20), bad = item(biscuit, 300);
    const meal = scoreItems([good, bad])!.total;
    const simpleMean = (scoreFood(apple)!.total + scoreFood(biscuit)!.total) / 2;
    expect(meal).toBeLessThan(simpleMean - 10);
    // inversement : beaucoup de bon + un peu de mauvais reste élevé
    const meal2 = scoreItems([item(apple, 300), item(biscuit, 20)])!.total;
    expect(meal2).toBeGreaterThan(simpleMean);
    // l'ordre n'a pas d'importance, les quantités oui
    expect(scoreItems([bad, good])!.total).toBe(meal);
    expect(scoreItems([item(apple, 300), item(biscuit, 20)])!.total).toBeGreaterThan(meal);
  });
  it('les additifs d’un repas ne sont pas dilués par la masse', () => {
    const solo = scoreItems([item(biscuit, 30)])!;
    const diluted = scoreItems([item(biscuit, 30), item(apple, 600)])!;
    expect(diluted.parts.find((p) => p.key === 'additives')!.points).toBe(solo.parts.find((p) => p.key === 'additives')!.points);
  });
  it('un repas sans calories-influence : changer les quantités relatives suffit', () => {
    expect(scoreItems([])).toBeNull();
    expect(scoreItems([item(apple, 0)])).toBeNull();
  });
  it('réglages Primal : surcharge de naturalité des classes', () => {
    const base = scoreFood(rice)!.total;
    const lenient = scoreFood(rice, { ...DEFAULT_PRIMAL_CONFIG, naturalnessOverrides: { grain_refined: 1 } })!.total;
    expect(lenient).toBeGreaterThan(base);
  });
  it('PÉRIODE : recalcul depuis les ingrédients, pas moyenne des notes journalières', () => {
    const day1 = [item(apple, 500)], day2 = [item(biscuit, 50)];
    const p = summarizePeriod([{ date: '2026-01-01', items: day1 }, { date: '2026-01-02', items: day2 }], DEFAULT_GOALS);
    const avgOfDays = (p.perDay[0].primal! + p.perDay[1].primal!) / 2;
    expect(p.days).toBe(2);
    expect(p.primal!.total).not.toBeCloseTo(avgOfDays, 0);
    expect(p.primal!.total).toBeGreaterThan(avgOfDays); // 500 g de pomme pèsent plus que 50 g de biscuit
    expect(p.primal!.total).toBe(scoreItems([...day1, ...day2])!.total);
    expect(p.best[0].food.id).toBe('apple'); expect(p.worst[0].food.id).toBe('bisc');
    expect(p.avgKcalPerDay).toBeCloseTo((260 + 240) / 2, 5);
  });
});

describe('note micronutritionnelle', () => {
  it('données absentes exclues (≠ 0)', () => {
    const r = scoreMicro(sumItems([item(apple, 100)]), { share: 1 });
    const b12 = r.details.find((d) => d.key === 'vitB12')!;
    expect(b12.status).toBe('no_data'); expect(b12.score).toBeNull();
    expect(r.coverage).toBeLessThan(0.5);
    const withZero = { ...apple, nutrients: { ...apple.nutrients, vitB12: 0 } };
    expect(scoreMicro(sumItems([item(withZero, 100)]), { share: 1 }).details.find((d) => d.key === 'vitB12')!.score).toBe(0);
  });
  it('un excès n’est pas meilleur ; le sodium est un plafond', () => {
    const mk = (vitC: number, sodium: number) => ({ ...apple, nutrients: { vitC, sodium } });
    const sc = (f: any) => scoreMicro(sumItems([item(f, 100)]), { share: 1 }).details;
    expect(sc(mk(110, 100)).find((d) => d.key === 'vitC')!.score).toBe(1);
    expect(sc(mk(1500, 100)).find((d) => d.key === 'vitC')!.score).toBeLessThan(1); // au-dessus de la limite haute (1000 mg)
    expect(sc(mk(1000, 100)).find((d) => d.key === 'vitC')!.score).toBe(1);
    expect(sc(mk(110, 1000)).find((d) => d.key === 'sodium')!.score).toBe(1);
    expect(sc(mk(110, 3000)).find((d) => d.key === 'sodium')!.status).toBe('over_limit');
    expect(sc(mk(55, 100)).find((d) => d.key === 'vitC')!.score).toBeCloseTo(0.5);
  });
  it('quantités réellement consommées', () => {
    const a = scoreMicro(sumItems([item(apple, 100)]), { share: 1 }).details.find((d) => d.key === 'vitC')!;
    const b = scoreMicro(sumItems([item(apple, 400)]), { share: 1 }).details.find((d) => d.key === 'vitC')!;
    expect(b.intake!).toBeCloseTo(a.intake! * 4, 5);
  });
  it('aliment seul : saumon riche en D/B12, évalué sans kcal', () => {
    const r = scoreMicroFood(salmon);
    expect(r.details.find((d) => d.key === 'vitD')!.score).toBe(1);
    expect(r.score).not.toBeNull();
  });
});
