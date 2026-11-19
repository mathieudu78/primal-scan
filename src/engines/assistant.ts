import { ADDITIVE_BY_CODE } from './primal/dictionary';
import { CLASS_INFO } from './primal/dictionary';
import { classify, detectAdditives, normalize } from './primal/parse';
import { NUTRIENT_BY_KEY, MINERALS, VITAMINS, type MicroKey } from './nutrients';
import type { Summary } from './aggregate';
import type { Goals } from './goals';

/**
 * Assistant nutritionnel LOCAL : explique les notes, les ingrédients, les vitamines/minéraux et vos données.
 * Il ne formule JAMAIS de recommandation (manger plus/moins, remplacer, supprimer…) et ne nécessite aucune IA ni connexion.
 * Une IA distante facultative pourrait être branchée via `AssistantProvider` ; aucune n'est activée.
 */
export interface AssistantContext { today?: Summary; goals: Goals }
export interface AssistantProvider { id: string; available(): boolean; answer(question: string, ctx: AssistantContext): Promise<string> }

const FACTS: Record<MicroKey, string> = {
  vitA: 'La vitamine A participe à la vision, à l’immunité et au maintien de la peau. Elle existe sous forme de rétinol (produits animaux) et de caroténoïdes (végétaux).',
  vitB1: 'La vitamine B1 (thiamine) participe au métabolisme énergétique des glucides et au fonctionnement du système nerveux.',
  vitB2: 'La vitamine B2 (riboflavine) participe au métabolisme énergétique et à la protection des cellules contre le stress oxydatif.',
  vitB3: 'La vitamine B3 (niacine) participe au métabolisme énergétique ; l’organisme peut aussi la fabriquer à partir du tryptophane.',
  vitB5: 'La vitamine B5 (acide pantothénique) participe à la synthèse du coenzyme A, impliqué dans le métabolisme des lipides et des glucides.',
  vitB6: 'La vitamine B6 participe au métabolisme des protéines et à la formation de neurotransmetteurs.',
  vitB8: 'La vitamine B8 (biotine) participe au métabolisme des macronutriments et à l’entretien de la peau et des cheveux.',
  vitB9: 'La vitamine B9 (folates) participe à la division cellulaire et à la synthèse de l’ADN.',
  vitB12: 'La vitamine B12 participe à la formation des globules rouges et au fonctionnement du système nerveux ; elle est présente surtout dans les produits animaux.',
  vitC: 'La vitamine C participe à la synthèse du collagène, à l’immunité et favorise l’absorption du fer non héminique.',
  vitD: 'La vitamine D participe à l’absorption du calcium et à la santé osseuse ; elle est en partie synthétisée par la peau au soleil.',
  vitE: 'La vitamine E est un antioxydant liposoluble qui protège les membranes cellulaires.',
  vitK: 'La vitamine K participe à la coagulation sanguine et au métabolisme osseux.',
  calcium: 'Le calcium est le principal minéral des os et des dents et participe à la contraction musculaire.',
  magnesium: 'Le magnésium participe à des centaines de réactions enzymatiques, à la fonction musculaire et nerveuse.',
  potassium: 'Le potassium participe à l’équilibre hydrique, à la contraction musculaire et à la transmission nerveuse.',
  sodium: 'Le sodium participe à l’équilibre hydrique ; il provient surtout du sel. Dans PRIMAL SCAN il est traité comme un plafond, pas comme une cible à atteindre.',
  phosphorus: 'Le phosphore est un constituant des os et participe au métabolisme énergétique (ATP).',
  iron: 'Le fer participe au transport de l’oxygène (hémoglobine). Le fer héminique (viandes, poissons) est mieux absorbé que le fer végétal.',
  zinc: 'Le zinc participe à l’immunité, à la synthèse des protéines et à la cicatrisation.',
  copper: 'Le cuivre participe au métabolisme du fer, à la formation du collagène et à des enzymes antioxydantes.',
  selenium: 'Le sélénium participe à des enzymes antioxydantes et au fonctionnement de la thyroïde.',
  iodine: 'L’iode est nécessaire à la fabrication des hormones thyroïdiennes.',
  manganese: 'Le manganèse participe à des enzymes du métabolisme osseux et antioxydantes.',
};
const ALIASES: Array<[RegExp, MicroKey]> = [
  [/vitamine a\b|r[ée]tinol|carot[ée]no/, 'vitA'], [/\bb1\b|thiamine/, 'vitB1'], [/\bb2\b|riboflavine/, 'vitB2'], [/\bb3\b|niacine/, 'vitB3'],
  [/\bb5\b|pantoth/, 'vitB5'], [/\bb6\b/, 'vitB6'], [/\bb8\b|biotine/, 'vitB8'], [/\bb9\b|folate|acide folique/, 'vitB9'], [/\bb12\b|cobalamine/, 'vitB12'],
  [/vitamine c|ascorbique/, 'vitC'], [/vitamine d\b/, 'vitD'], [/vitamine e\b|tocoph/, 'vitE'], [/vitamine k\b/, 'vitK'],
  [/calcium/, 'calcium'], [/magn[ée]sium/, 'magnesium'], [/potassium/, 'potassium'], [/sodium|\bsel\b/, 'sodium'], [/phosphore/, 'phosphorus'],
  [/\bfer\b/, 'iron'], [/\bzinc\b/, 'zinc'], [/cuivre/, 'copper'], [/s[ée]l[ée]nium/, 'selenium'], [/iode/, 'iodine'], [/mangan[eè]se/, 'manganese'],
];

export const SUGGESTIONS = [
  'Comment est calculée la note Primal ?',
  'Comment est calculée la note micronutritionnelle ?',
  'Pourquoi les calories n’influencent pas les notes ?',
  'Que signifie E471 ?',
  'Explique la vitamine D',
  'Résume ma journée',
];

export function answerLocally(question: string, ctx: AssistantContext): string {
  const q = normalize(question);

  const e = detectAdditives(question)[0];
  if (e && /\be ?\d{3}/.test(q)) {
    const a = ADDITIVE_BY_CODE[e.code] ?? e;
    return `${a.code.toUpperCase()} — ${a.name} (${a.category}). Niveau indicatif : ${['bénin', 'usage technologique', 'discuté', 'préoccupant'][a.risk]}.${a.note ? ' ' + a.note + '.' : ''} Ce classement s’appuie sur des avis publics (EFSA, ANSES, CIRC) et sert uniquement à calculer la note Primal ; ce n’est pas un avis médical.`;
  }

  if (/(note|score).*(primal)|primal.*(calcul|note|score)|comment.*primal/.test(q)) {
    return 'La note Primal (0-100) évalue la COMPOSITION d’un aliment, jamais ses calories : naturalité des ingrédients (25 pts), niveau de transformation (25), additifs (15), qualité des matières grasses (10), qualité nutritionnelle — sucres ajoutés, fibres, sel (15), simplicité et transparence (10). Pour un repas, un jour ou une période, on fusionne les ingrédients pondérés par leurs quantités ; ce n’est pas une moyenne des notes. Les ingrédients non reconnus sont signalés, comptés de façon neutre, et la note est donnée avec une plage.';
  }
  if (/micro/.test(q) && /(note|score|calcul)/.test(q)) {
    return 'La note micronutritionnelle (0-100) compare vos apports en 13 vitamines et 11 minéraux à des valeurs de référence adulte modifiables. Chaque nutriment reçoit un sous-score : proportionnel jusqu’à la cible, plein entre la cible et la limite haute, puis décroissant au-delà (un excès n’est pas meilleur). Le sodium est un plafond. Les données absentes sont exclues du calcul (jamais comptées comme zéro) ; la couverture indique la part de nutriments pris en compte.';
  }
  if (/calorie|kcal|pourcent|objectif/.test(q) && /(note|score|influen|pourquoi|comment|calcul)/.test(q)) {
    return `Les calories servent uniquement au suivi quantitatif, jamais aux notes. Le pourcentage d’un aliment ou d’un repas = calories ÷ objectif calorique JOURNALIER (${ctx.goals.kcal} kcal) × 100, toujours par rapport à la journée, jamais au repas. Changer l’objectif recalcule les pourcentages sans toucher aux calories ni aux notes.`;
  }
  if (/(r[ée]sum|bilan|aujourd|journ[ée]e|mon journal)/.test(q)) {
    const t = ctx.today;
    if (!t || t.calories.consumed === 0) return 'Aucun repas consommé aujourd’hui pour le moment.';
    const m = t.macros;
    return `Aujourd’hui : ${Math.round(t.calories.consumed)} kcal sur ${ctx.goals.kcal} (${t.calories.percent?.toFixed(0)} %). Protéines ${m.protein.value.toFixed(0)} g, glucides ${m.carbs.value.toFixed(0)} g, lipides ${m.fat.value.toFixed(0)} g, fibres ${m.fiber.value.toFixed(0)} g. Note Primal : ${t.primal ? Math.round(t.primal.total) : '—'} (${t.primal?.label ?? '—'}). Note micronutritionnelle : ${t.micro.score === null ? 'données insuffisantes' : Math.round(t.micro.score)} (${Math.round(t.micro.coverage * 100)} % des micronutriments renseignés).`;
  }
  for (const [re, key] of ALIASES) {
    if (re.test(q)) {
      const def = NUTRIENT_BY_KEY[key]; const ref = ctx.goals.micro[key]; const intake = ctx.today?.micro.details.find((d) => d.key === key);
      return `${FACTS[key]} Valeur de référence utilisée : ${ref.target} ${def.unit}/jour${ref.kind === 'limit' ? ' (plafond)' : ''}${ref.upper ? `, limite haute ${ref.upper} ${def.unit}` : ''}.${intake && intake.intake !== null ? ` Aujourd’hui : ${intake.intake.toFixed(2)} ${def.unit}.` : ' Aujourd’hui : donnée absente.'}`;
    }
  }
  if (/(vitamines?|min[ée]raux)/.test(q)) return `Je peux expliquer : ${[...VITAMINS, ...MINERALS].map((k) => NUTRIENT_BY_KEY[k].label).join(', ')}. Demandez par exemple « Explique le magnésium ».`;

  const cls = classify(question.replace(/^(que|qu'est-ce que|c'est quoi|explique)\s+/i, ''));
  if (cls !== 'unknown' && q.split(' ').length <= 6) return `« ${question.trim()} » est classé « ${CLASS_INFO[cls].label} » : naturalité ${Math.round(CLASS_INFO[cls].naturalness * 100)} %, non-transformation ${Math.round(CLASS_INFO[cls].transformation * 100)} %. Cette classification est indicative et réglable dans Paramètres › Critères Primal.`;

  return 'Je peux expliquer les notes, les additifs (ex. « E330 »), les vitamines et minéraux, vos pourcentages et votre journée. Je ne donne pas de conseils ni de recommandations : je présente les données et leur calcul.';
}

export const LocalAssistant: AssistantProvider = { id: 'local', available: () => true, answer: async (q, c) => answerLocally(q, c) };
