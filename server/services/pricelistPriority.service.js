// server/services/pricelistPriority.service.js
//
// Automatic rule priority for pricelists.
//
// `sequence` is the order the pricing engines stack rules in — ascending, one
// after another, each rule seeing the price the previous one left behind
// (pricelistPricing.service → findMatchingPriceRules → applyPriceRules). It
// used to be set by hand with ↑/↓ arrows; it is now derived from what a rule
// IS, and reassigned on every rule mutation.
//
// This lives on the server because both engines read `sequence` off the stored
// document. A client-side ordering would show one order and charge another.

/** Rules that assign a new price outright, in the order they should run. */
const KIND_ORDER = {
  // Base-setters: applyPriceRules does `result = …` for these, so either one
  // landing after a modifier silently discards that modifier's work. Formula
  // first so an explicitly entered fixed price is the final word.
  formula: 0,
  fixed: 1,
  // Modifiers: these adjust whatever price they are handed.
  discount: 2,
  flash_sale: 3,
  // Not in PER_LINE_PRICE_TYPES — they never compete with the per-line pool.
  // Ranked last so the displayed list does not imply that they do.
  bundle: 4,
  cart_threshold: 5,
};

/**
 * Sort key for one rule. Earlier (smaller) = applied first.
 *
 * Specificity leads because that is what the panel shows first, and it costs
 * nothing in pricing terms: findMatchingPriceRules shadows entire pools
 * (`specific.length > 0 ? specific : global`), so a product-specific rule and
 * an all-products rule never stack against each other anyway.
 */
function rankKey(rule) {
  return [
    rule.subProduct ? 0 : 1,
    KIND_ORDER[rule.priceType] ?? 99,
    // Descending: the higher volume tier runs first, mirroring the tiebreak
    // findMatchingPriceRules already applies when sequences are equal.
    -(Number(rule.minQuantity) || 0),
    String(rule._id),
  ];
}

function compareRules(a, b) {
  const ka = rankKey(a);
  const kb = rankKey(b);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
}

/** The rules in priority order. Does not mutate the input. */
function rankedRules(rules) {
  if (!Array.isArray(rules)) return [];
  return [...rules].sort(compareRules);
}

/**
 * Assign `sequence = 0..N-1` from the ranking.
 *
 * Only `sequence` is touched — the stored array keeps its physical order, the
 * same discipline the reorder endpoint follows. Callers must re-run this after
 * ANY rule mutation: changing a rule's priceType, minQuantity or subProduct
 * changes where it belongs, and deleting one leaves a gap.
 */
function resequenceRules(rules) {
  if (!Array.isArray(rules)) return [];
  rankedRules(rules).forEach((rule, i) => {
    rule.sequence = i;
  });
  return rules;
}

/**
 * Rules in the order they are APPLIED: ascending `sequence`, ties broken on
 * `_id` so a duplicate sequence still orders identically across refetches.
 *
 * Distinct from `rankedRules`, which re-derives the ranking from scratch. This
 * reads the ranking already stored on the document, which is what both pricing
 * engines stack by — so anything that consumes rules for pricing or display
 * must go through here rather than trusting the stored array order (which
 * `resequenceRules` deliberately never touches).
 *
 * A non-array is passed through unchanged: `GET /:id` spreads the result back
 * onto the document, and turning an absent `rules` into `[]` there would tell
 * the client "this pricelist has no rules" instead of "not hydrated yet".
 */
function rulesInSequenceOrder(rules) {
  if (!Array.isArray(rules)) return rules;
  return [...rules].sort((a, b) => {
    const seqDiff = (Number(a.sequence) || 0) - (Number(b.sequence) || 0);
    if (seqDiff !== 0) return seqDiff;
    return String(a._id).localeCompare(String(b._id));
  });
}

/** Short human explanation of why a rule sits where it does. */
function priorityReason(rule) {
  const scope = rule.subProduct ? 'Specific product' : 'All products';
  const qty = Number(rule.minQuantity) || 0;
  const tier = qty > 0 ? ` · qty ${qty}+` : '';
  switch (rule.priceType) {
    case 'formula':
    case 'fixed':
      return `${scope} · sets the price${tier}`;
    case 'discount':
    case 'flash_sale':
      return `${scope} · adjusts the price${tier}`;
    case 'bundle':
      return `${scope} · bundle${tier}`;
    case 'cart_threshold':
      return `${scope} · whole cart`;
    default:
      return scope;
  }
}

module.exports = {
  rankedRules,
  resequenceRules,
  rulesInSequenceOrder,
  priorityReason,
  compareRules,
};
