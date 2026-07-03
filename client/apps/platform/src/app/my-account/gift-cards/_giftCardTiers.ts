// Amount-driven gift-card tiers — the client mirror of server/services/giftCard.helpers.js
// (GIFT_CARD_TIERS / giftCardTierForAmount). Keep the bands + ids in sync with the server.
// The card art + label are derived from the purchase amount; higher amounts get more
// premium styling. Bands are inclusive lower bounds (NGN).

export interface GiftCardTier {
  id: 'classic' | 'silver' | 'gold' | 'platinum' | 'premium' | 'black';
  name: string;
  minAmount: number;
  gradient: string;    // tailwind gradient stops, e.g. "from-stone-800 to-red-900"
  textClass: string;   // foreground text colour for the card art
  accentClass: string; // secondary/label colour on the card art
}

export const GIFT_CARD_TIERS: GiftCardTier[] = [
  { id: 'classic',  name: 'Classic',  minAmount: 1000,    gradient: 'from-stone-800 to-red-900',     textClass: 'text-white',     accentClass: 'text-red-200' },
  { id: 'silver',   name: 'Silver',   minAmount: 50000,   gradient: 'from-slate-400 to-slate-600',   textClass: 'text-white',     accentClass: 'text-slate-100' },
  { id: 'gold',     name: 'Gold',     minAmount: 200000,  gradient: 'from-amber-500 to-yellow-600',  textClass: 'text-stone-900', accentClass: 'text-amber-900' },
  { id: 'platinum', name: 'Platinum', minAmount: 500000,  gradient: 'from-zinc-300 to-zinc-500',     textClass: 'text-stone-900', accentClass: 'text-zinc-700' },
  { id: 'premium',  name: 'Premium',  minAmount: 1000000, gradient: 'from-indigo-700 to-purple-800', textClass: 'text-white',     accentClass: 'text-indigo-200' },
  { id: 'black',    name: 'Black',    minAmount: 5000000, gradient: 'from-neutral-900 to-black',      textClass: 'text-white',     accentClass: 'text-amber-300' },
];

/** Highest tier whose minAmount <= amount; clamps below the first band to `classic`. */
export function giftCardTierForAmount(amount: number): GiftCardTier {
  const n = Number(amount) || 0;
  let tier = GIFT_CARD_TIERS[0];
  for (const t of GIFT_CARD_TIERS) {
    if (n >= t.minAmount) tier = t;
  }
  return tier;
}

/** Resolve a tier from a stored id (falls back to amount-derived, then classic). */
export function giftCardTierById(id?: string, amount = 0): GiftCardTier {
  return GIFT_CARD_TIERS.find(t => t.id === id) || giftCardTierForAmount(amount);
}
