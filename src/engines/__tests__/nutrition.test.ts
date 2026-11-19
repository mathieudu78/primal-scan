import { describe, expect, it } from 'vitest';
import { apple, butter, item, rice, salmon, soda } from './fixtures';
import { basisAmount, calorieStatus, massGrams, nutrientsFor, percentOfDailyGoal, QuantityError, sumItems } from '../nutrition';
import { summarizeDay, summarizeMeal } from '../aggregate';
import { DEFAULT_GOALS, suggestGoals } from '../goals';
import { scoreMicro } from '../micro';
import { scoreItems } from '../primal/score';

describe('quantités et unités', () => {
  it('grammes -> nutriments', () => {
    const n = nutrientsFor(apple, { amount: 200, unit: 'g' });
    expect(n.kcal).toBe(104); expect(n.vitC).toBe(9.2);
  });
  it('portions et ml', () => {
    expect(nutrientsFor(butter, { amount: 2, unit: 'portion' }).kcal).toBe(148);
    expect(basisAmount(soda, { amount: 330, unit: 'ml' })).toBe(330);
    expect(massGrams(soda, { amount: 330, unit: 'ml' })).toBeCloseTo(343.2);
    expect(() => nutrientsFor(apple, { amount: 1, unit: 'portion' })).toThrow(QuantityError);
    expect(() => nutrientsFor(apple, { amount: -5, unit: 'g' })).toThrow(QuantityError);
  });
  it('cru vs cuit : 250 g de riz cuit = 100 g de riz cru', () => {
    expect(nutrientsFor(rice, { amount: 250, unit: 'g', state: 'cooked' }).kcal).toBe(350);
    expect(nutrientsFor(rice, { amount: 100, unit: 'g', state: 'raw' }).kcal).toBe(350);
    expect(() => nutrientsFor(apple, { amount: 100, unit: 'g', state: 'cooked' })).not.toThrow(); // état inconnu -> pas de conversion
  });
  it('donnée absente ≠ 0', () => {
    const n = nutrientsFor(apple, { amount: 100, unit: 'g' });
    expect(n.vitB12).toBeUndefined();
    expect(n.fat).toBe(0.2);
    const t = sumItems([item(apple, 100)]);
    expect(t.vitB12.known).toBe(false);
    expect(t.vitC.known).toBe(true);
    const zero = { ...apple, nutrients: { ...apple.nutrients, vitB12: 0 } };
    expect(sumItems([item(zero, 100)]).vitB12.known).toBe(true);
  });
  it('complétude : un aliment sans la donnée la rend partielle', () => {
    const t = sumItems([item(apple, 100), item(salmon, 100)]); // vitC : pomme oui, saumon non
    expect(t.vitC.completeness).toBeCloseTo(0.5);
    expect(t.vitD.completeness).toBeCloseTo(0.5);
  });
});

describe('calories : pourcentage de l’objectif JOURNALIER', () => {
  it('exemple du cahier des charges : 1500 kcal / 3000 = 50 %', () => {
    expect(percentOfDailyGoal(1500, 3000)).toBe(50);
    const s = calorieStatus(1500, 3000);
    expect(s.remaining).toBe(1500); expect(s.over).toBe(false);
    expect(calorieStatus(3300, 3000)).toMatchObject({ remaining: -300, over: true });
    expect(calorieStatus(3300, 3000).percent).toBeCloseTo(110, 8);
    expect(percentOfDailyGoal(100, 0)).toBeNull();
  });
  it('le % d’un repas est relatif à la journée, pas au repas', () => {
    const goals = { ...DEFAULT_GOALS, kcal: 3000 };
    const lunch = [item(butter, 200)]; // 1480 kcal
    const m = summarizeMeal(lunch, 'lunch', goals);
    expect(m.caloriePercentOfDay).toBeCloseTo(49.33, 1);
    const day = summarizeDay([...lunch, item(apple, 100)], goals);
    expect(m.caloriePercentOfDay!).toBeLessThan(day.caloriePercentOfDay!);
  });
  it('changer l’objectif recalcule les % sans toucher calories ni notes', () => {
    const items = [item(apple, 150), item(salmon, 150), item(butter, 10)];
    const a = summarizeDay(items, { ...DEFAULT_GOALS, kcal: 2000 });
    const b = summarizeDay(items, { ...DEFAULT_GOALS, kcal: 4000 });
    expect(a.totals.kcal.value).toBe(b.totals.kcal.value);
    expect(a.primal).toEqual(b.primal);
    expect(a.micro).toEqual(b.micro);
    expect(a.caloriePercentOfDay!).toBeCloseTo(2 * b.caloriePercentOfDay!, 5);
  });
});

describe('RÈGLE ABSOLUE : les calories n’influencent jamais les notes', () => {
  it('note Primal et micro identiques quand les kcal changent', () => {
    for (const food of [apple, salmon, soda, butter]) {
      const hi = { ...food, nutrients: { ...food.nutrients, kcal: 9999 } };
      const lo = { ...food, nutrients: { ...food.nutrients, kcal: 1 } };
      expect(scoreItems([item(hi, 100)])).toEqual(scoreItems([item(lo, 100)]));
      expect(scoreMicro(sumItems([item(hi, 100)]), { share: 1 })).toEqual(scoreMicro(sumItems([item(lo, 100)]), { share: 1 }));
    }
  });
});

describe('objectifs : proposition, jamais imposée', () => {
  it('Mifflin-St Jeor', () => {
    const g = suggestGoals({ sex: 'male', age: 30, weightKg: 80, heightCm: 180, activity: 'moderate' });
    expect(g.kcal).toBe(2760); expect(g.protein).toBe(128);
    expect(g.protein * 4 + g.carbs * 4 + g.fat * 9).toBeGreaterThan(g.kcal - 50);
  });
});
