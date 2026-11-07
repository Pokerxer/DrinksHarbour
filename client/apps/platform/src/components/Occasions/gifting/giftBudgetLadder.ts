// Deterministic budget-tier ladder for drinks gifts. Budgets are the
// customer's plan — this module never derives bottle prices; exact pricing
// stays on /shop and with the team. No AI.
export type GiftBudgetTierId = 'thoughtful-single' | 'quality-single' | 'premium-plus' | 'curated-set';

export type BudgetPlan = {
  id: GiftBudgetTierId;
  title: string;
  /** How the plan splits into bottles/lines. Categories come from the gift finder, not here. */
  lines: string[];
  note: string;
  /** Suggested maximum perGiftBottles count used by the hamper builder. */
  bottles: number;
};

export const MAX_PLANNED_BUDGET = 5000000;

export const GIFT_BUDGET_TIERS: (BudgetPlan & { min: number })[] = [
  {
    id: 'thoughtful-single', min: 0, title: 'Thoughtful single', bottles: 1,
    lines: ['One considered bottle, matched to the recipient'],
    note: 'A small, well-matched bottle reads as thoughtful; a stretched set reads as rushed.',
  },
  {
    id: 'quality-single', min: 10000, title: 'One quality bottle', bottles: 1,
    lines: ['One recognised quality label in a familiar style'],
    note: 'Spend on the label rather than the count — one good bottle wins.',
  },
  {
    id: 'premium-plus', min: 25000, title: 'Premium + companion', bottles: 2,
    lines: ['One premium bottle as the centrepiece', 'One companion bottle for variety'],
    note: 'A two-bottle pairing still fits most gift boxes when confirmed with the team.',
  },
  {
    id: 'curated-set', min: 60000, title: 'Curated set', bottles: 3,
    lines: ['One statement bottle', 'A complementary second style', 'A small finishing bottle or premium mixer'],
    note: 'Three lines sit well in hamper presentation — confirm assembly with support.',
  },
];

const MAX_SAFE_INPUT = 99999999;

/** Highest tier whose threshold fits the planned budget; positive integers only. */
export function tierForBudget(budgetNaira: number): BudgetPlan | null {
  if (!Number.isSafeInteger(budgetNaira) || budgetNaira < 1 || budgetNaira > MAX_PLANNED_BUDGET) return null;
  let match = GIFT_BUDGET_TIERS[0];
  for (const tier of GIFT_BUDGET_TIERS) if (budgetNaira >= tier.min) match = tier;
  return { id: match.id, title: match.title, lines: [...match.lines], note: match.note, bottles: match.bottles };
}

/** Naira budget → gift-finder tier id (modest/classic/premium) thresholds. */
export function budgetToGiftTier(budgetNaira: number): 'modest' | 'classic' | 'premium' | null {
  if (!Number.isSafeInteger(budgetNaira) || budgetNaira < 1 || budgetNaira > MAX_SAFE_INPUT) return null;
  if (budgetNaira < 10000) return 'modest';
  if (budgetNaira < 25000) return 'classic';
  return 'premium';
}
