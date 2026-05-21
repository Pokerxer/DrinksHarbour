/**
 * Semantic Search Service — DrinksHarbour
 *
 * Provides:
 *  - Beverage-domain synonym expansion
 *  - Query intent detection (cheap → price_low, on sale → onSale:true, etc.)
 *  - Fuzzy token matching via combined-OR regex
 *  - Helper: buildExpandedTextQuery(rawQuery) → MongoDB $or clause
 *  - Helper: detectIntents(rawQuery)          → { sort, onSale, minAbv, … }
 */

'use strict';

// ── Beverage synonym dictionary ──────────────────────────────────────────────
// Key   = user term (lowercase)
// Value = array of canonical search terms to include in the regex

const SYNONYMS = {
  // ── Whiskey / Whisky ──────────────────────────────────────────────────────
  whisky:               ['whiskey', 'whisky'],
  whiskey:              ['whiskey', 'whisky'],
  bourbon:              ['bourbon', 'whiskey', 'whisky', 'american whiskey'],
  scotch:               ['scotch', 'whisky', 'scottish'],
  'scotch whisky':      ['scotch', 'whisky', 'scottish'],
  'irish whiskey':      ['irish', 'whiskey'],
  'japanese whisky':    ['japanese', 'whisky'],
  'single malt':        ['single malt', 'scotch', 'whisky'],
  blended:              ['blended', 'whisky', 'whiskey'],
  dram:                 ['whisky', 'whiskey', 'scotch'],

  // ── Sparkling / Champagne ─────────────────────────────────────────────────
  bubbly:               ['champagne', 'sparkling', 'prosecco', 'cava', 'crémant'],
  fizzy:                ['sparkling', 'champagne', 'prosecco'],
  sparkling:            ['sparkling', 'champagne', 'prosecco', 'cava', 'crémant'],
  champagne:            ['champagne', 'sparkling'],
  prosecco:             ['prosecco', 'sparkling', 'italian'],
  cava:                 ['cava', 'sparkling', 'spanish'],
  cremant:              ['crémant', 'sparkling', 'french'],

  // ── Wine ─────────────────────────────────────────────────────────────────
  wine:                 ['wine'],
  vino:                 ['wine'],
  plonk:                ['wine'],
  'red wine':           ['red wine', 'red', 'rouge'],
  'white wine':         ['white wine', 'white', 'blanc'],
  rosé:                 ['rosé', 'rose'],
  rose:                 ['rosé', 'rose'],
  'rose wine':          ['rosé', 'rose', 'pink'],
  claret:               ['bordeaux', 'red wine', 'cabernet'],
  pinot:                ['pinot noir', 'pinot grigio', 'pinot gris', 'pinot'],
  'cab sav':            ['cabernet sauvignon', 'cabernet'],
  'cabernet sauvignon': ['cabernet sauvignon', 'cabernet'],
  merlot:               ['merlot', 'red wine'],
  chardonnay:           ['chardonnay', 'white wine'],
  'sauvignon blanc':    ['sauvignon blanc', 'white wine'],
  riesling:             ['riesling', 'white wine'],
  shiraz:               ['shiraz', 'syrah', 'red wine'],
  syrah:                ['syrah', 'shiraz', 'red wine'],
  malbec:               ['malbec', 'red wine'],
  tempranillo:          ['tempranillo', 'rioja', 'red wine'],
  port:                 ['port', 'porto', 'fortified'],
  sherry:               ['sherry', 'fortified'],

  // ── Beer ─────────────────────────────────────────────────────────────────
  beer:                 ['beer', 'lager', 'ale', 'brew'],
  lager:                ['lager', 'beer'],
  ale:                  ['ale', 'beer'],
  stout:                ['stout', 'beer', 'dark beer'],
  ipa:                  ['ipa', 'india pale ale', 'beer'],
  'india pale ale':     ['ipa', 'india pale ale', 'beer'],
  porter:               ['porter', 'stout', 'beer'],
  'wheat beer':         ['wheat', 'hefeweizen', 'beer', 'weizen'],
  hefeweizen:           ['hefeweizen', 'wheat beer', 'beer'],
  'craft beer':         ['craft', 'beer'],
  'pale ale':           ['pale ale', 'beer', 'ale'],
  pint:                 ['beer', 'lager', 'ale'],

  // ── Gin ──────────────────────────────────────────────────────────────────
  gin:                  ['gin'],
  'london dry':         ['london dry', 'gin'],
  'sloe gin':           ['sloe', 'gin'],

  // ── Vodka ────────────────────────────────────────────────────────────────
  vodka:                ['vodka'],

  // ── Rum ──────────────────────────────────────────────────────────────────
  rum:                  ['rum'],
  'dark rum':           ['dark rum', 'rum'],
  'white rum':          ['white rum', 'rum'],
  'spiced rum':         ['spiced', 'rum'],
  tot:                  ['rum', 'spirit'],

  // ── Tequila / Mezcal ─────────────────────────────────────────────────────
  tequila:              ['tequila', 'agave'],
  mezcal:               ['mezcal', 'agave', 'tequila'],
  agave:                ['agave', 'tequila', 'mezcal'],
  'blanco tequila':     ['blanco', 'tequila'],
  'reposado':           ['reposado', 'tequila'],
  'anejo':              ['añejo', 'anejo', 'tequila'],

  // ── Brandy / Cognac ──────────────────────────────────────────────────────
  brandy:               ['brandy', 'cognac', 'armagnac'],
  cognac:               ['cognac', 'brandy', 'french brandy'],
  armagnac:             ['armagnac', 'brandy'],
  calvados:             ['calvados', 'apple brandy', 'brandy'],

  // ── Liqueurs / Aperitifs ─────────────────────────────────────────────────
  liqueur:              ['liqueur', 'liquor'],
  liquor:               ['liqueur', 'spirits'],
  aperitif:             ['aperitif', 'vermouth', 'campari', 'aperol'],
  digestif:             ['digestif', 'amaro', 'liqueur'],
  amaro:                ['amaro', 'bitters', 'liqueur'],
  bitters:              ['bitters', 'amaro'],

  // ── Cider / Mead ─────────────────────────────────────────────────────────
  cider:                ['cider', 'apple', 'pear cider'],
  mead:                 ['mead', 'honey wine'],

  // ── Non-alcoholic ─────────────────────────────────────────────────────────
  'non alcoholic':      ['non-alcoholic', 'alcohol free', 'non_alcoholic'],
  'non-alcoholic':      ['non-alcoholic', 'alcohol free', 'non_alcoholic'],
  'alcohol free':       ['non-alcoholic', 'alcohol-free', 'non_alcoholic'],
  mocktail:             ['non-alcoholic', 'mocktail', 'alcohol free'],
  'soft drink':         ['non-alcoholic', 'mixer', 'soda'],
  juice:                ['juice', 'non-alcoholic', 'fresh'],
  water:                ['water', 'sparkling water', 'mineral water'],

  // ── Flavour / Style ───────────────────────────────────────────────────────
  smoky:                ['smoky', 'peated', 'islay', 'smoke'],
  peaty:                ['peaty', 'peat', 'smoky', 'islay'],
  islay:                ['islay', 'peaty', 'scotch', 'smoke'],
  sweet:                ['sweet', 'dessert', 'port', 'sweetness'],
  dry:                  ['dry', 'brut', 'sec'],
  fruity:               ['fruity', 'fruit', 'tropical'],
  floral:               ['floral', 'aromatic', 'fragrant'],
  spicy:                ['spicy', 'peppery', 'bold', 'chilli'],
  oaky:                 ['oak', 'woody', 'barrel', 'cask'],
  creamy:               ['creamy', 'smooth', 'velvety'],
  citrus:               ['citrus', 'lemon', 'lime', 'orange', 'grapefruit'],
  vanilla:              ['vanilla', 'sweet', 'creamy'],
  chocolate:            ['chocolate', 'cocoa', 'dark'],
  herbal:               ['herbal', 'botanical', 'herb'],
  earthy:               ['earthy', 'mineral', 'terroir'],

  // ── Colloquials ───────────────────────────────────────────────────────────
  tipple:               ['spirit', 'drink', 'whiskey', 'gin', 'rum'],
  booze:                ['spirits', 'alcohol', 'drinks'],
  hooch:                ['spirit', 'moonshine', 'whiskey'],
  bubbles:              ['sparkling', 'champagne', 'prosecco'],
  'g&t':                ['gin', 'tonic', 'gin tonic'],
  'g and t':            ['gin', 'tonic'],
};

// ── Intent detection ─────────────────────────────────────────────────────────
const INTENTS = [
  // Price intent
  { re: /\b(cheap|budget|affordable|value|inexpensive|low.?price)\b/i,    action: { sortBy: 'price_low' } },
  { re: /\b(premium|luxury|top.?shelf|high.?end|finest|best quality)\b/i, action: { sortBy: 'rating', isFeatured: true } },

  // Sale intent
  { re: /\b(on.?sale|sale|discount(?:ed)?|offer|deal|promo|reduced|clearance)\b/i, action: { onSale: true } },

  // Recency intent
  { re: /\b(new|latest|fresh|just.?in|new.?arrivals|recent)\b/i,          action: { sortBy: 'newest' } },

  // Popularity intent
  { re: /\b(popular|bestsell(?:ing|er)|top.?rated|trending|most.?popular)\b/i, action: { sortBy: 'popular' } },

  // High-rating intent
  { re: /\b(highly.?rated|top.?rated|best.?rated|5.?star|five.?star)\b/i, action: { minRating: 4, sortBy: 'rating' } },

  // ABV intents
  { re: /\b(strong|high.?abv|high.?alcohol|potent|heavy)\b/i,             action: { minAbv: 35 } },
  { re: /\b(light|low.?abv|session|easy.?drinking|low.?alcohol)\b/i,      action: { maxAbv: 10 } },

  // Gifting intent
  { re: /\b(gift|present|gifting|special.?occasion|anniversary|birthday|celebration)\b/i, action: { isFeatured: true, sortBy: 'rating' } },
];

// ── Type keyword hints ────────────────────────────────────────────────────────
// When a query token matches a type keyword, optionally add a type filter hint
const TYPE_HINTS = {
  beer: 'beer', lager: 'beer', ale: 'beer', stout: 'beer', porter: 'beer', ipa: 'beer',
  wine: 'wine',
  champagne: 'sparkling_wine', sparkling: 'sparkling_wine', prosecco: 'sparkling_wine', cava: 'sparkling_wine',
  port: 'fortified_wine', sherry: 'fortified_wine', vermouth: 'fortified_wine',
  gin: 'spirit', vodka: 'spirit', rum: 'spirit', tequila: 'spirit', mezcal: 'spirit',
  whiskey: 'spirit', whisky: 'spirit', brandy: 'spirit', cognac: 'spirit',
  liqueur: 'liqueur',
  cocktail: 'cocktail_ready_to_drink', rtd: 'cocktail_ready_to_drink',
  juice: 'juice', water: 'water', mixer: 'mixer',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Preprocess a raw search query.
 *
 * @param {string} rawQuery
 * @returns {{
 *   originalQuery: string,
 *   tokens: string[],
 *   expandedTerms: string[],
 *   intents: object,
 *   typeHint: string|null,
 * }}
 */
function preprocessQuery(rawQuery) {
  const q = (rawQuery || '').trim();
  const lower = q.toLowerCase();
  const tokens = lower.split(/\s+/).filter(Boolean);

  // 1. Expand synonyms — try longest phrase first
  const expandedSet = new Set();
  let expandedFromSynonyms = false;

  for (let len = Math.min(tokens.length, 3); len >= 1; len--) {
    for (let i = 0; i <= tokens.length - len; i++) {
      const phrase = tokens.slice(i, i + len).join(' ');
      if (SYNONYMS[phrase]) {
        SYNONYMS[phrase].forEach(t => expandedSet.add(t));
        expandedFromSynonyms = true;
      }
    }
  }

  // Always include original tokens
  tokens.forEach(t => expandedSet.add(t));

  // 2. Detect intents
  const intents = {};
  for (const intent of INTENTS) {
    if (intent.re.test(lower)) {
      Object.assign(intents, intent.action);
    }
  }

  // 3. Detect type hint
  let typeHint = null;
  for (const token of tokens) {
    if (TYPE_HINTS[token]) { typeHint = TYPE_HINTS[token]; break; }
  }

  return {
    originalQuery: q,
    tokens,
    expandedTerms: [...expandedSet],
    intents,
    typeHint,
  };
}

/**
 * Build a MongoDB $or text-search clause using expanded synonym terms.
 * Combines all terms into a single alternation regex per field.
 *
 * Fields searched (pre-lookup stage):
 *   name, shortDescription, description, type, subType,
 *   originCountry, region, producer, flavorProfile, metaKeywords
 *
 * @param {string} rawQuery
 * @returns {object|null} MongoDB query fragment or null if query is empty
 */
function buildExpandedTextQuery(rawQuery) {
  const { originalQuery, expandedTerms } = preprocessQuery(rawQuery);

  if (!originalQuery) return null;

  // Deduplicate and build single alternation regex
  const allTerms = [...new Set([originalQuery, ...expandedTerms])];
  const pattern = allTerms.map(escapeRegex).join('|');
  const re = new RegExp(pattern, 'i');

  return {
    $or: [
      { name:             re },
      { shortDescription: re },
      { description:      re },
      { type:             re },
      { subType:          re },
      { originCountry:    re },
      { region:           re },
      { producer:         re },
      { flavorProfile:    re },
      { metaKeywords:     re },
      { barcode:          new RegExp(`^${escapeRegex(originalQuery)}$`, 'i') },
      { sku:              new RegExp(`^${escapeRegex(originalQuery)}$`, 'i') },
    ],
  };
}

/**
 * Detect intent modifiers from a raw query string.
 * Returns an object that can be merged into searchParams.
 *
 * @param {string} rawQuery
 * @returns {object} e.g. { sortBy: 'price_low' } or { onSale: true }
 */
function detectIntents(rawQuery) {
  const { intents } = preprocessQuery(rawQuery);
  return intents;
}

/**
 * Build relevance score $addFields stage that rewards:
 *  - Exact name match           → +50
 *  - Name starts-with query     → +35
 *  - Partial name match         → +15
 *  - Brand name match           → +20  (uses looked-up brand.name)
 *  - Category name match        → +10  (uses looked-up category.name)
 *  - Type / short-desc match    → +5
 *  - Average rating × 3
 *  - Total sold / 5
 *  - Featured                   → +10
 *
 * Requires brand and category to already be joined in the pipeline.
 *
 * @param {string} rawQuery
 * @param {boolean} hasSemanticBoost - whether vectorSimilarity field exists
 * @returns {object} $addFields expression value
 */
function buildRelevanceScore(rawQuery, hasSemanticBoost = false) {
  if (!rawQuery || !rawQuery.trim()) {
    // No query — rank by rating + popularity + featured only
    return {
      $add: [
        { $multiply: [{ $ifNull: ['$averageRating', 0] }, 3] },
        { $divide:   [{ $ifNull: ['$totalSold',     0] }, 5] },
        { $cond: [{ $eq: ['$isFeatured', true] }, 10, 0] },
      ],
    };
  }

  const q = rawQuery.trim();
  const exactRegex   = `^${escapeRegex(q)}$`;
  const startsRegex  = `^${escapeRegex(q)}`;
  const partialRegex = escapeRegex(q);

  const semanticBonus = hasSemanticBoost
    ? [{ $multiply: [{ $ifNull: ['$vectorSimilarity', 0] }, 25] }]
    : [];

  return {
    $add: [
      // Exact name match
      { $cond: [{ $regexMatch: { input: '$name', regex: exactRegex,   options: 'i' } }, 50, 0] },
      // Name starts-with
      { $cond: [{ $regexMatch: { input: '$name', regex: startsRegex,  options: 'i' } }, 35, 0] },
      // Partial name
      { $cond: [{ $regexMatch: { input: '$name', regex: partialRegex, options: 'i' } }, 15, 0] },
      // Brand name
      { $cond: [{ $regexMatch: { input: { $ifNull: ['$brand.name', ''] }, regex: partialRegex, options: 'i' } }, 20, 0] },
      // Category name
      { $cond: [{ $regexMatch: { input: { $ifNull: ['$category.name', ''] }, regex: partialRegex, options: 'i' } }, 10, 0] },
      // Short description
      { $cond: [{ $regexMatch: { input: { $ifNull: ['$shortDescription', ''] }, regex: partialRegex, options: 'i' } }, 5, 0] },
      // Type
      { $cond: [{ $regexMatch: { input: { $ifNull: ['$type', ''] }, regex: partialRegex, options: 'i' } }, 5, 0] },
      // Semantic similarity bonus
      ...semanticBonus,
      // Popularity / quality boosts
      { $multiply: [{ $ifNull: ['$averageRating', 0] }, 3] },
      { $divide:   [{ $ifNull: ['$totalSold',     0] }, 5] },
      { $cond: [{ $eq: ['$isFeatured', true] }, 10, 0] },
    ],
  };
}

module.exports = {
  preprocessQuery,
  buildExpandedTextQuery,
  detectIntents,
  buildRelevanceScore,
  SYNONYMS,
  INTENTS,
  TYPE_HINTS,
};
