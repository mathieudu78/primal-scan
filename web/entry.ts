// Point d'entrée du bundle de la version HTML : réutilise les MÊMES moteurs que l'application mobile.
export { summarizeDay, summarizeMeal, summarizePeriod } from '../src/engines/aggregate';
export { scoreFood, analyzeFood, DEFAULT_PRIMAL_CONFIG } from '../src/engines/primal/score';
export { scoreMicroFood } from '../src/engines/micro';
export { nutrientsFor, percentOfDailyGoal, QuantityError } from '../src/engines/nutrition';
export { DEFAULT_GOALS, suggestGoals } from '../src/engines/goals';
export { NUTRIENTS, NUTRIENT_BY_KEY, VITAMINS, MINERALS } from '../src/engines/nutrients';
export { CLASS_INFO } from '../src/engines/primal/dictionary';
export { SEED_FOODS } from '../src/data/seedFoods';
export { answerLocally } from '../src/engines/assistant';
