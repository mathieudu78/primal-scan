import { describe, expect, it } from 'vitest';
import { answerLocally, SUGGESTIONS } from '../assistant';
import { DEFAULT_GOALS } from '../goals';
import { summarizeDay } from '../aggregate';
import { apple, item, salmon } from './fixtures';

const ctx = { goals: DEFAULT_GOALS, today: summarizeDay([item(apple, 150), item(salmon, 120)], DEFAULT_GOALS) };
describe('assistant local', () => {
  it('répond à toutes les suggestions sans réseau', () => {
    for (const s of SUGGESTIONS) expect(answerLocally(s, ctx).length).toBeGreaterThan(30);
  });
  it('additifs, vitamines, journée', () => {
    expect(answerLocally('Que signifie E471 ?', ctx)).toMatch(/E471/);
    expect(answerLocally('Explique la vitamine D', ctx)).toMatch(/calcium/);
    expect(answerLocally('Résume ma journée', ctx)).toMatch(/kcal/);
  });
  it('ne formule jamais de recommandation', () => {
    const banned = /(vous devriez|il faut manger|mangez plus|mangez moins|remplacez|évitez|supprimez|nous recommandons|je recommande)/i;
    for (const q of [...SUGGESTIONS, 'Que dois-je manger ?', 'Dois-je manger moins de sucre ?', 'Explique le fer', 'Explique le sodium']) expect(answerLocally(q, ctx)).not.toMatch(banned);
  });
});
