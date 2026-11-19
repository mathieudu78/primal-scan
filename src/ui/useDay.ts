import { useData } from '../data/AppData';
import type { Entry } from '../db/repo';
import { summarizeDay, summarizeMeal, type Summary } from '../engines/aggregate';
import type { MealType } from '../engines/types';
import { useLoad } from './hooks';
import { MEAL_ORDER } from './format';

export interface DayData {
  date: string;
  entries: Entry[];
  summary: Summary;
  meals: Record<MealType, { entries: Entry[]; summary: Summary }>;
}

/** Données d'une journée CONSOMMÉE (les repas planifiés ne sont jamais comptés). */
export function useDay(date: string) {
  const { repo, settings } = useData();
  return useLoad<DayData>(async () => {
    const entries = await repo.entriesOn(date, 'eaten');
    const summary = summarizeDay(repo.toLogged(entries), settings.goals, settings.primal);
    const meals = {} as DayData['meals'];
    for (const t of MEAL_ORDER) {
      const es = entries.filter((e) => e.mealType === t);
      meals[t] = { entries: es, summary: summarizeMeal(repo.toLogged(es), t, settings.goals, settings.primal) };
    }
    return { date, entries, summary, meals };
  }, [date, settings]);
}
