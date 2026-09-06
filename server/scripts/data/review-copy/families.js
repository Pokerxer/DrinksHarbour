// scripts/data/review-copy/families.js
//
// Map a Product's (type, subType) onto a copy family.
//
// The old resolver folded everything into 8 families keyed off `type` alone,
// which meant every spirit — gin, tequila, cognac, vodka, Irish whiskey —
// drew from ONE pool of four "smoky notes" comments. Reviewing a Bombay
// Sapphire with "warm smoky notes ... excellent neat over a single large cube"
// is wrong copy, not just repetitive copy.
//
// The seeded catalogue actually carries these subTypes (measured, not guessed):
//   spirit/gin, spirit/single_malt, spirit/tequila, spirit/scotch,
//   spirit/irish_whiskey, spirit/brandy, spirit/bourbon, spirit/reposado,
//   spirit/blended_scotch, spirit/cognac, spirit/vodka, spirit/blended,
//   wine/*, sparkling_wine/champagne, sparkling_wine/prosecco, liqueur/*
// so subType is resolved FIRST and only falls back to type.

/**
 * @param {string} type      Product.type      e.g. 'spirit'
 * @param {string} [subType] Product.subType   e.g. 'gin'
 * @returns {string} family key present in ./bodies.js
 */
function resolveFamily(type, subType) {
  const t = String(type || '').toLowerCase().replace(/[\s-]+/g, '_');
  const s = String(subType || '').toLowerCase().replace(/[\s-]+/g, '_');
  const any = `${s} ${t}`;

  // Non-alcoholic first — 'non_alcoholic_wine' must not match the wine family.
  if (t.startsWith('non_alcoholic') || s.startsWith('non_alcoholic') || t === 'mocktail') {
    return 'nonAlcoholic';
  }

  // ── Spirits, by subType ──────────────────────────────────────────────────
  if (/\bgin\b/.test(any)) return 'gin';
  if (/vodka/.test(any)) return 'vodka';
  if (/tequila|mezcal|reposado|anejo|añejo|blanco/.test(any)) return 'tequila';
  if (/cognac|armagnac/.test(any)) return 'cognac';
  if (/\brum\b/.test(any)) return 'rum';
  if (/brandy/.test(any)) return 'brandy';
  if (/irish/.test(any)) return 'irishWhiskey';
  if (/bourbon|rye|tennessee/.test(any)) return 'bourbon';
  if (/single_malt|islay|speyside|highland/.test(any)) return 'singleMalt';
  if (/scotch|blended_malt|blended_scotch|whisky|whiskey|blended/.test(any)) return 'blendedWhisky';

  // ── Sparkling ────────────────────────────────────────────────────────────
  if (/champagne/.test(any)) return 'champagne';
  if (/prosecco|cava|asti|spumante|sparkling/.test(any)) return 'sparkling';

  // ── Still wine, by colour/sweetness where stated ─────────────────────────
  if (/sweet_white|moscato|riesling/.test(any)) return 'sweetWhite';
  if (/sweet_red|sweet/.test(any) && /wine|red|rose|rosé/.test(any)) return 'sweetRed';
  if (/rose|rosé/.test(any)) return 'roseWine';
  if (/white_wine|chardonnay|sauvignon|pinot_grigio|chenin/.test(any)) return 'whiteWine';
  if (/red_wine|cabernet|merlot|shiraz|syrah|pinotage|malbec|tempranillo|refosco/.test(any)) return 'redWine';
  if (/port|sherry|madeira|fortified/.test(any)) return 'fortified';
  if (/\bwine\b/.test(any)) return 'redWine';

  // ── Other ────────────────────────────────────────────────────────────────
  if (/liqueur|amaretto|vermouth|aperitif|digestif|bitters|cream/.test(any)) return 'liqueur';
  if (/cider|perry|mead/.test(any)) return 'cider';
  if (/beer|stout|lager|\bale\b|ipa|pilsner/.test(any)) return 'beer';
  if (/cocktail|seltzer|alcopop|cooler/.test(any)) return 'readyToDrink';
  if (/juice|water|soda|cola|ginger|tonic|soft_drink|kombucha|smoothie/.test(any)) return 'softDrink';
  if (/spirit/.test(any)) return 'blendedWhisky';

  return 'generic';
}

module.exports = { resolveFamily };
