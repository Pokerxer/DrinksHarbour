// Deterministic gift finder for the gifting occasion pages. A fixed local
// lookup table — no AI, no prices, no client-side money math. Suggestions name
// bottle categories only; exact bottles are confirmed with the team on /shop
// or through the staff-review request form.
export type RecipientType = 'enjoys-alcohol' | 'unknown' | 'may-not-drink' | 'health' | 'religious';
export type BudgetTier = 'modest' | 'classic' | 'premium';

export type GiftSuggestion = {
  /** Display label for the suggested bottle category. */
  category: string;
  /** Why this category fits the recipient and budget tier. */
  why: string;
  /** Shop category link for browsing candidates (no prices shown here). */
  href: string;
};

export type GiftMatch = {
  suggestions: GiftSuggestion[];
  notes: string[];
};

export const RECIPIENT_OPTIONS: { value: RecipientType; label: string }[] = [
  { value: 'enjoys-alcohol', label: 'They enjoy alcoholic drinks' },
  { value: 'unknown', label: 'Not sure of their taste' },
  { value: 'may-not-drink', label: 'They do not drink alcohol' },
  { value: 'health', label: 'Avoiding alcohol for health reasons' },
  { value: 'religious', label: 'Avoiding alcohol for religious reasons' },
];

export const BUDGET_OPTIONS: { value: BudgetTier; label: string }[] = [
  { value: 'modest', label: 'Simple, well-chosen bottle' },
  { value: 'classic', label: 'Standard work gift' },
  { value: 'premium', label: 'Statement gift' },
];

const ALCOHOL_18PLUS_NOTE =
  'Alcohol gifts can only be handed over to an adult aged 18 or over at the address.';
const UNKNOWN_TASTE_NOTE =
  'When the taste is unconfirmed, an alcohol-free gift is the safe default. Share what you learn later and our team can suggest champagne or whisky options.';
const NON_ALCOHOLIC_HREF = '/shop?category=non-alcoholic';

const TABLE: Record<RecipientType, Record<BudgetTier, GiftMatch>> = {
  'enjoys-alcohol': {
    modest: {
      suggestions: [
        { category: 'Wine', why: 'A single well-made table wine is a safe bottle when you know they drink.', href: '/shop?category=wine' },
      ],
      notes: [ALCOHOL_18PLUS_NOTE],
    },
    classic: {
      suggestions: [
        { category: 'Champagne & sparkling', why: 'Champagne or a quality sparkling suits congratulations and thank-you gifts.', href: '/shop?category=champagne' },
        { category: 'Scotch whisky', why: 'A known blended or single malt label works for spirit drinkers.', href: '/shop?category=scotch' },
      ],
      notes: [ALCOHOL_18PLUS_NOTE],
    },
    premium: {
      suggestions: [
        { category: 'Prestige champagne', why: 'A vintage or prestige label reads as a clear step up.', href: '/shop?category=champagne' },
        { category: 'Premium whisky & cognac', why: 'A serious bottle for someone who already collects spirits.', href: '/shop?category=scotch' },
      ],
      notes: [ALCOHOL_18PLUS_NOTE, 'Exact premium labels change often — confirm current stock with the team before committing.'],
    },
  },
  unknown: {
    modest: {
      suggestions: [
        { category: 'Non-alcoholic sparkling & juices', why: 'With the taste unconfirmed, an alcohol-free choice suits every recipient.', href: NON_ALCOHOLIC_HREF },
      ],
      notes: [UNKNOWN_TASTE_NOTE],
    },
    classic: {
      suggestions: [
        { category: 'Non-alcoholic wine & sparkling', why: 'Reads as a proper gift while you confirm whether they drink at all.', href: NON_ALCOHOLIC_HREF },
      ],
      notes: [UNKNOWN_TASTE_NOTE],
    },
    premium: {
      suggestions: [
        { category: 'Premium alcohol-free sparkling', why: 'A confident non-alcoholic bottle needs no confirmation and offends nobody.', href: NON_ALCOHOLIC_HREF },
      ],
      notes: [UNKNOWN_TASTE_NOTE],
    },
  },
  'may-not-drink': {
    modest: {
      suggestions: [
        { category: 'Non-alcoholic sparkling & juices', why: 'They do not drink, so the whole gift stays alcohol-free.', href: NON_ALCOHOLIC_HREF },
      ],
      notes: ['No bottle containing alcohol belongs in this gift.'],
    },
    classic: {
      suggestions: [
        { category: 'Non-alcoholic wine', why: 'A familiar format without the alcohol the recipient avoids.', href: NON_ALCOHOLIC_HREF },
      ],
      notes: ['No bottle containing alcohol belongs in this gift.'],
    },
    premium: {
      suggestions: [
        { category: 'Premium alcohol-free sparkling', why: 'Alcohol-free does not have to look like an afterthought.', href: NON_ALCOHOLIC_HREF },
      ],
      notes: ['No bottle containing alcohol belongs in this gift.'],
    },
  },
  health: {
    modest: {
      suggestions: [
        { category: 'Non-alcoholic sparkling & juices', why: 'Keeps the gift alcohol-free rather than picking a lighter drink.', href: NON_ALCOHOLIC_HREF },
      ],
      notes: ['Some conditions and medications rule out alcohol entirely — let the recipient or their doctor decide what is acceptable.'],
    },
    classic: {
      suggestions: [
        { category: 'Non-alcoholic wine', why: 'A familiar gift format that gently avoids alcohol.', href: NON_ALCOHOLIC_HREF },
      ],
      notes: ['Some conditions and medications rule out alcohol entirely — let the recipient or their doctor decide what is acceptable.'],
    },
    premium: {
      suggestions: [
        { category: 'Premium alcohol-free sparkling', why: 'A considered alcohol-free gift shows attention, not restriction.', href: NON_ALCOHOLIC_HREF },
      ],
      notes: ['Some conditions and medications rule out alcohol entirely — let the recipient or their doctor decide what is acceptable.'],
    },
  },
  religious: {
    modest: {
      suggestions: [
        { category: 'Non-alcoholic sparkling & juices', why: 'Alcohol-free gifts respect requirements you may not see directly.', href: NON_ALCOHOLIC_HREF },
      ],
      notes: ['Some faiths avoid alcohol entirely, including de-alcoholised and cooking varieties.', 'Ask discreetly, or ask someone close to the recipient what is acceptable.'],
    },
    classic: {
      suggestions: [
        { category: 'Non-alcoholic wine', why: 'A bottle-shaped gift that keeps every faith requirement intact.', href: NON_ALCOHOLIC_HREF },
      ],
      notes: ['Some faiths avoid alcohol entirely, including de-alcoholised and cooking varieties.', 'Ask discreetly, or ask someone close to the recipient what is acceptable.'],
    },
    premium: {
      suggestions: [
        { category: 'Premium alcohol-free sparkling', why: 'Generous without putting the recipient in an awkward position.', href: NON_ALCOHOLIC_HREF },
      ],
      notes: ['Some faiths avoid alcohol entirely, including de-alcoholised and cooking varieties.', 'Ask discreetly, or ask someone close to the recipient what is acceptable.'],
    },
  },
};

/** Categories that contain alcohol — used anywhere the recipient opts out. */
export const ALCOHOLIC_CATEGORY_WORDS = ['wine', 'champagne', 'whisky', 'cognac', 'gin', 'beer', 'spirit'];

/** A category suggests alcohol only when it is not labelled non-alcoholic. */
export function suggestsAlcohol(category: string): boolean {
  if (/non-alcoholic|alcohol-free/i.test(category)) return false;
  return ALCOHOLIC_CATEGORY_WORDS.some(word => category.toLowerCase().includes(word));
}

/** Fixed table lookup: same inputs always produce the same suggestion list. */
export function findGiftMatch(recipient: RecipientType, budget: BudgetTier): GiftMatch {
  const match = TABLE[recipient][budget];
  return {
    suggestions: match.suggestions.map(entry => ({ ...entry })),
    notes: [...match.notes],
  };
}

export function giftMatchOptions() {
  return { recipients: RECIPIENT_OPTIONS, budgets: BUDGET_OPTIONS };
}
