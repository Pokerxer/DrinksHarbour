// server/services/scanMatch.service.js
//
// AI-powered product extraction + catalogue matching for the Sales Scan & Match
// feature. Two extraction entry points (image via Claude Haiku vision, text via
// Claude Haiku text) produce a normalized list of candidate items; each is then
// matched against the tenant's SubProduct catalogue in three phases:
//
//   Phase 1 – Text multi-pass (getMySubProducts regex on Product.name / SKU)
//   Phase 2   – Brand alias lookup (Brand.tradingAs + name + slug → SubProducts)
//   Phase 2.5 – Category/SubCategory keyword search (name/metaKeywords/typicalFlavors)
//   Phase 4   – Type fallback (Product.type → SubProducts, last resort)
//
// Scoring uses token-overlap + Levenshtein + model fields:
//   Product.type, Product.ageStatement, Product.metaKeywords,
//   Brand.tradingAs, SubProduct.customKeywords
//
// Confidence tiers:
//   exact   — name + brand match, volume within 20% of the extracted size
//   partial — brand/type match, OR volume differs >20% (defaults to closest size)
//   none    — no usable match (drawer shows a "Create new product" link)

const Anthropic   = require('@anthropic-ai/sdk');
const Brand       = require('../models/Brand');
const Product     = require('../models/Product');
const SubProduct  = require('../models/SubProduct');
const Category    = require('../models/Category');
const SubCategory = require('../models/SubCategory');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
const CLAUDE_MODEL = 'claude-haiku-4-5';
const MAX_ITEMS = 30;

/** Robustly extract the first JSON object/array from an LLM text response
 *  (strips markdown fences, leading prose, trailing prose). Local copy to avoid
 *  a private dependency on gemini.controller.parseJSONResponse. */
function parseJSONResponse(text) {
  if (!text || typeof text !== 'string') return {};
  let s = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = s.search(/[{[]/);
  if (start < 0) return {};
  // Find the matching closing brace/bracket for the first opener.
  const openCh = s[start];
  const closeCh = openCh === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === openCh) depth++;
    else if (s[i] === closeCh) {
      depth--;
      if (depth === 0) {
        s = s.slice(start, i + 1);
        break;
      }
    }
  }
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

// ── Extraction ─────────────────────────────────────────────────────────────

/**
 * Normalize an image source (data URL / HTTP URL / raw base64) into the base64
 * payload Claude's vision API expects. Mirrors chatbot.service.analyzeImage.
 */
async function normalizeImage(imageUrl) {
  let mimeType = 'image/jpeg';
  let base64Data = null;
  if (imageUrl.startsWith('data:')) {
    const m = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    mimeType = m[1];
    base64Data = m[2];
  } else if (imageUrl.startsWith('http')) {
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      base64Data = Buffer.from(buf).toString('base64');
      mimeType = res.headers.get('content-type') || 'image/jpeg';
    } catch {
      return null;
    }
  } else {
    base64Data = imageUrl;
  }
  if (!base64Data || base64Data.length < 100) return null;
  return { base64Data, mimeType };
}

const IMAGE_PROMPT = `You are a beverage-list extractor for DrinksHarbour, a Nigerian drinks marketplace.
Examine this image — it may be a single product photo, a shelf, a fridge, or a snapped list/receipt of products.
Identify every distinct beverage product visible and return ONLY JSON of the form:
{"items":[{"name":"<full canonical product name>","brand":"<canonical brand name or null>","type":"<wine|beer|spirit|champagne|whiskey|vodka|gin|rum|tequila|cognac|liqueur|soft_drink|non_alcoholic|other>","sizeText":"<size string from label e.g. '70cl','750ml','1L', or null>","qty":<number of packs/cartons/units seen, default 1>,"packUnit":"<pack|carton|case|unit|null — 'pack' for 6-packs etc., 'carton'/'case' for boxes of 12, 'unit' for single bottles>"}]}
Rules:
- Normalise brand names to their full canonical form: "Henny" → "Hennessy", "Remy" → "Remy Martin", "JD" → "Jack Daniels", "JW" → "Johnnie Walker", "Moet" → "Moët & Chandon". Strip diacritics if unsure of exact spelling.
- Expand shorthand product lines: "VSOP", "XO", "VS", "Double Black", "Blue Label", etc. should be preserved in the name.
- For pack/carton language: "2 packs" → qty:2, packUnit:"pack"; "1 carton" → qty:1, packUnit:"carton"; "3 cases" → qty:3, packUnit:"case"; single bottles → packUnit:null.
- One entry per distinct product (not per bottle of the same kind).
- If the image is a list/receipt, treat each line as a candidate item.
- Cap at ${MAX_ITEMS} items. Return only the JSON object, no prose.`;

/** Vision extraction: image → [{ name, brand, type, sizeText, qty }] */
async function extractItemsFromImage(imageUrl) {
  const img = await normalizeImage(imageUrl);
  if (!img) return [];
  if (img.base64Data.length > 5_000_000)
    console.warn(`scanMatch: large image (${Math.round(img.base64Data.length / 1024)}KB)`);
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.base64Data } },
          { type: 'text', text: IMAGE_PROMPT },
        ],
      }],
    });
    const block = response.content.find((b) => b.type === 'text');
    if (!block?.text) return [];
    const parsed = parseJSONResponse(block.text);
    return Array.isArray(parsed?.items) ? parsed.items.slice(0, MAX_ITEMS) : [];
  } catch (err) {
    console.error('scanMatch.extractItemsFromImage failed:', err.message);
    return [];
  }
}

const TEXT_PROMPT = `You are a beverage-list parser for DrinksHarbour, a Nigerian drinks marketplace.
Parse the following free-form text (it may be typed notes, a copied invoice, a paragraph, or a line-per-product list) into a JSON list of distinct beverage products.
Return ONLY JSON of the form:
{"items":[{"name":"<full canonical product name>","brand":"<canonical brand name or null>","type":"<wine|beer|spirit|champagne|whiskey|vodka|gin|rum|tequila|cognac|liqueur|soft_drink|non_alcoholic|other>","sizeText":"<size string e.g. '70cl','750ml','1L', or null>","qty":<number of packs/cartons/units, default 1>,"packUnit":"<pack|carton|case|unit|null>"}]}
Rules:
- Expand nicknames and abbreviations to canonical brand names: "Henny" → "Hennessy", "Remy" → "Remy Martin", "JD" → "Jack Daniels", "JW" → "Johnnie Walker", "Moet" → "Moët & Chandon", "Chivas" → "Chivas Regal", "Patron" → "Patrón".
- Preserve product-line qualifiers in the name: "VSOP", "XO", "VS", "Double Black", "Blue Label", "12 Year", etc.
- Pack/carton rules: "2 packs" → qty:2, packUnit:"pack"; "1 carton" → qty:1, packUnit:"carton"; "3 cases" → qty:3, packUnit:"case"; single bottles/units → packUnit:null.
- Normalize plain quantity words ('x2', '×2', '2 bottles of X', 'X - 2') into the qty field with packUnit:null (one entry per distinct product).
- Ignore non-product lines (headers, totals, addresses) when it's an invoice.
- If a name is ambiguous or a shorthand (e.g. "cognac", "the usual"), output your best guess at the canonical product name.
- Cap at ${MAX_ITEMS} items. Return only the JSON object, no prose.

TEXT TO PARSE:
"""
`;

/** Text extraction: free-form text → [{ name, brand, type, sizeText, qty }] */
async function extractItemsFromText(text) {
  if (!text || !text.trim()) return [];
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      temperature: 0.2,
      messages: [{ role: 'user', content: TEXT_PROMPT + text + '\n"""' }],
    });
    const block = response.content.find((b) => b.type === 'text');
    if (!block?.text) return [];
    const parsed = parseJSONResponse(block.text);
    return Array.isArray(parsed?.items) ? parsed.items.slice(0, MAX_ITEMS) : [];
  } catch (err) {
    console.error('scanMatch.extractItemsFromText failed:', err.message);
    return [];
  }
}

// ── Text normalisation + fuzzy helpers ────────────────────────────────────

/**
 * Common drink nicknames/aliases → canonical name fragment used for searching.
 * Checked after lower-casing + diacritic stripping.
 */
const BRAND_ALIASES = new Map([
  ['henny',      'hennessy'],
  ['hen',        'hennessy'],
  ['remy',       'remy martin'],
  ['jd',         'jack daniels'],
  ['jack',       'jack daniels'],
  ['jw',         'johnnie walker'],
  ['johnnie',    'johnnie walker'],
  ['moet',       'moet chandon'],
  ['ciroc',      'ciroc'],
  ['chivas',     'chivas regal'],
  ['baileys',    'baileys irish'],
  ['bud',        'budweiser'],
  ['smirnoff',   'smirnoff'],
  ['patron',     'patron tequila'],
  ['don julio',  'don julio'],
]);

const STOPWORDS = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'in', 'de', 'with', 'by']);

/** Escape regex metacharacters in a user-supplied string. */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Strip Unicode diacritics (ë→e, é→e, ô→o, etc.). */
function stripDiacritics(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Lowercase + strip diacritics + collapse non-alphanumeric runs to a space. */
function normalizeStr(str) {
  if (!str) return '';
  return stripDiacritics(str)
    .toLowerCase()
    .replace(/[''`]/g, '')          // apostrophes
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Expand known brand aliases in a normalised query string.
 *  Uses a single-pass regex so already-expanded text is never re-processed
 *  (avoids "jd" → "jack daniels" → "jack daniels daniels"). */
function expandAliases(str) {
  const s = normalizeStr(str);
  if (!s) return '';
  // Longest aliases first so "don julio" wins over a hypothetical "don".
  const sorted = [...BRAND_ALIASES.entries()].sort((a, b) => b[0].length - a[0].length);
  const pattern = sorted.map(([alias]) => escapeRegex(alias)).join('|');
  return s
    .replace(new RegExp('\\b(' + pattern + ')\\b', 'g'), (match) => {
      for (const [alias, canonical] of sorted) {
        if (match === alias) return canonical;
      }
      return match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a normalised string into meaningful tokens (≥2 chars, skip stopwords). */
function tokenize(str) {
  return normalizeStr(str)
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/**
 * Levenshtein edit distance (used for typo tolerance).
 * Capped at `max` to short-circuit large strings.
 */
function editDistance(a, b, max = 3) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/**
 * Score how well a candidate product name matches the query tokens.
 * Returns a non-negative number; higher = better match.
 */
function scoreNameMatch(queryTokens, candidateName, candidateBrandName) {
  const candTokens = tokenize((candidateName || '') + ' ' + (candidateBrandName || ''));
  if (!candTokens.length || !queryTokens.length) return 0;

  let tokenScore = 0;
  for (const qt of queryTokens) {
    let best = 0;
    for (const ct of candTokens) {
      if (qt === ct) { best = Math.max(best, 12); break; }
      if (ct.includes(qt) || qt.includes(ct)) { best = Math.max(best, 8); continue; }
      // Typo tolerance: 1 edit allowed for tokens ≥4 chars, 2 edits for ≥7 chars.
      if (qt.length >= 4 && ct.length >= 4) {
        const dist = editDistance(qt, ct, 2);
        if (dist === 1) best = Math.max(best, 9);
        else if (dist === 2 && qt.length >= 7) best = Math.max(best, 5);
      }
    }
    tokenScore += best;
  }

  // Bonus: every query token is at least partially covered.
  const allCovered = queryTokens.every((qt) =>
    candTokens.some(
      (ct) => qt === ct || ct.includes(qt) || qt.includes(ct) ||
               (qt.length >= 4 && ct.length >= 4 && editDistance(qt, ct, 1) <= 1)
    )
  );
  if (allCovered) tokenScore += 20;

  return tokenScore;
}

/**
 * Build an ordered list of search terms to try against the catalogue.
 * Starts specific (full query) and progressively broadens.
 */
function buildSearchTerms(name, brand, sizeText) {
  const normalName = expandAliases(name);
  const normalBrand = expandAliases(brand || '');

  // Remove inline size/volume tokens from the name for a tighter query.
  const nameNoSize = normalName
    .replace(/\b\d+(?:\.\d+)?\s*(?:ml|cl|l|litre|liter)\b/gi, '')
    .replace(/\bx?\d+\s*pack\b/gi, '')
    .trim();

  const terms = [];

  // 1. Canonical name (alias-expanded, diacritics stripped) + brand.
  const full = [normalName, normalBrand].filter(Boolean).join(' ').trim();
  if (full) terms.push(full);

  // 2. Name without size.
  if (nameNoSize && nameNoSize !== full) terms.push(nameNoSize);

  // 3. Brand alone (often enough for a hit).
  if (normalBrand && normalBrand !== full) terms.push(normalBrand);

  // 4. Each significant token (≥3 chars).
  const tokens = tokenize(normalName + ' ' + normalBrand).filter((t) => t.length >= 3);
  for (const tok of tokens) {
    if (!terms.includes(tok)) terms.push(tok);
  }

  // 5. 4-char prefix of each long token — catches single-character typos that
  //    share the same prefix (e.g. "Henessy" → prefix "hene" still finds "Hennessy").
  for (const tok of tokens) {
    if (tok.length >= 5) {
      const prefix = tok.slice(0, 4);
      if (!terms.includes(prefix)) terms.push(prefix);
    }
  }

  return terms;
}

// ── Model-aware lookups ────────────────────────────────────────────────────

/**
 * Map the type strings Claude extracts to the Product.type enum values used in
 * the database. Claude's TEXT_PROMPT uses simplified labels; the model uses
 * the full enum (whiskey, cognac, champagne, etc.).
 */
// Mirrors Category.type + Product.type enums. Claude's TEXT_PROMPT uses
// simplified labels; this maps them to the canonical DB values so Phase 3
// (type fallback) and Phase 2.5 (category search) find the right documents.
const EXTRACTED_TYPE_MAP = {
  cognac:        'cognac',
  whiskey:       'whiskey',
  whisky:        'whisky',
  bourbon:       'bourbon',
  scotch:        'scotch',
  rye:           'rye_whiskey',
  rye_whiskey:   'rye_whiskey',
  irish:         'irish_whiskey',
  irish_whiskey: 'irish_whiskey',
  japanese:      'japanese_whisky',
  vodka:         'vodka',
  gin:           'gin',
  rum:           'rum',
  tequila:       'tequila',
  mezcal:        'mezcal',
  brandy:        'brandy',
  champagne:     'champagne',
  sparkling:     'sparkling_wine',
  sparkling_wine:'sparkling_wine',
  prosecco:      'prosecco',
  wine:          'wine',
  red_wine:      'red_wine',
  red:           'red_wine',
  white_wine:    'white_wine',
  white:         'white_wine',
  rose:          'rose_wine',
  rose_wine:     'rose_wine',
  beer:          'beer',
  lager:         'lager',
  ale:           'ale',
  stout:         'stout',
  cider:         'cider',
  spirit:        'spirit',
  liqueur:       'liqueur',
  aperitif:      'aperitif',
  digestif:      'digestif',
  soft_drink:    'soft_drink',
  soda:          'soft_drink',
  juice:         'juice',
  water:         'water',
  coffee:        'coffee',
  tea:           'tea',
  non_alcoholic: 'non_alcoholic',
  other:         'other',
};

function mapExtractedType(extractedType) {
  if (!extractedType) return null;
  return EXTRACTED_TYPE_MAP[extractedType.toLowerCase().replace(/\s+/g, '_')] ?? null;
}

/**
 * Search the Brand collection by name, tradingAs aliases, or slug.
 * Crucial for nicknames that live in Brand.tradingAs (e.g. "Henny" → Hennessy).
 */
async function lookupBrandsByAlias(term) {
  if (!term || term.length < 2) return [];
  try {
    const re = new RegExp(escapeRegex(term.trim()), 'i');
    return await Brand.find({
      $or: [{ name: re }, { tradingAs: re }, { slug: re }],
      status: { $ne: 'archived' },
    })
      .select('_id name tradingAs')
      .lean();
  } catch (err) {
    console.error('scanMatch.lookupBrandsByAlias failed:', err.message);
    return [];
  }
}

/** Shared populate spec for SubProduct → Product used across all direct DB lookups. */
const PRODUCT_POPULATE = {
  path: 'product',
  select: 'name slug type ageStatement abv volumeMl brand metaKeywords region originCountry category subCategory',
  populate: [
    { path: 'brand',       select: 'name slug tradingAs' },
    { path: 'category',    select: 'name slug type displayName metaKeywords' },
    { path: 'subCategory', select: 'name slug type displayName metaKeywords typicalFlavors' },
  ],
};

/**
 * Fetch SubProducts that belong to the given brand IDs and are scoped to a tenant.
 * Used in Phase 2 after a brand alias hit.
 */
async function findSubProductsByBrandIds(brandIds, tenantId, limit = 8) {
  if (!brandIds.length || !tenantId) return [];
  try {
    const productIds = await Product.find({
      brand: { $in: brandIds },
      status: { $in: ['approved', 'pending'] },
    })
      .select('_id').lean()
      .then((docs) => docs.map((d) => d._id));
    if (!productIds.length) return [];
    return await SubProduct.find({ product: { $in: productIds }, tenant: tenantId })
      .populate(PRODUCT_POPULATE)
      .populate('sizes')
      .limit(limit)
      .lean();
  } catch (err) {
    console.error('scanMatch.findSubProductsByBrandIds failed:', err.message);
    return [];
  }
}

/**
 * Fetch SubProducts by product type — last-resort Phase 4 fallback.
 */
async function findSubProductsByType(productType, tenantId, limit = 5) {
  if (!productType || !tenantId) return [];
  try {
    const productIds = await Product.find({
      type: productType,
      status: { $in: ['approved', 'pending'] },
    })
      .select('_id').lean()
      .then((docs) => docs.map((d) => d._id));
    if (!productIds.length) return [];
    return await SubProduct.find({ product: { $in: productIds }, tenant: tenantId })
      .populate(PRODUCT_POPULATE)
      .populate('sizes')
      .limit(limit)
      .lean();
  } catch (err) {
    console.error('scanMatch.findSubProductsByType failed:', err.message);
    return [];
  }
}

/**
 * Find Categories whose name, displayName, or metaKeywords contain any of the
 * given query tokens. Used in Phase 2.5 to handle category-level inputs like
 * "bubbly" → Champagne, "sparkling" → Sparkling Wine, "single malt" → Scotch.
 */
async function findCategoriesByTokens(queryTokens) {
  if (!queryTokens.length) return [];
  try {
    // Build an $or that tests each token against name, displayName, metaKeywords.
    const clauses = queryTokens
      .filter((t) => t.length >= 3)
      .map((t) => {
        const re = new RegExp(escapeRegex(t), 'i');
        return [
          { name: re },
          { displayName: re },
          { metaKeywords: re },
          { slug: re },
        ];
      })
      .flat();
    if (!clauses.length) return [];
    return await Category.find({ $or: clauses, status: 'published' })
      .select('_id name type displayName metaKeywords')
      .lean();
  } catch (err) {
    console.error('scanMatch.findCategoriesByTokens failed:', err.message);
    return [];
  }
}

/**
 * Find SubCategories whose name, displayName, metaKeywords, or typicalFlavors
 * contain any of the given query tokens. Helps match "VSOP", "XO", "Brut",
 * "Single Malt" — terms that live at the subcategory level but not in product names.
 */
async function findSubCategoriesByTokens(queryTokens) {
  if (!queryTokens.length) return [];
  try {
    const clauses = queryTokens
      .filter((t) => t.length >= 3)
      .map((t) => {
        const re = new RegExp(escapeRegex(t), 'i');
        return [
          { name: re },
          { displayName: re },
          { metaKeywords: re },
          { type: re },
          { typicalFlavors: re },
        ];
      })
      .flat();
    if (!clauses.length) return [];
    return await SubCategory.find({ $or: clauses, status: 'published' })
      .select('_id name parent type displayName metaKeywords')
      .lean();
  } catch (err) {
    console.error('scanMatch.findSubCategoriesByTokens failed:', err.message);
    return [];
  }
}

/**
 * Fetch SubProducts in the given category or subCategory IDs scoped to a tenant.
 */
async function findSubProductsByCategoryIds({ categoryIds = [], subCategoryIds = [] }, tenantId, limit = 6) {
  if (!tenantId || (!categoryIds.length && !subCategoryIds.length)) return [];
  try {
    const productQuery = { status: { $in: ['approved', 'pending'] } };
    const orClauses = [];
    if (categoryIds.length)    orClauses.push({ category:    { $in: categoryIds } });
    if (subCategoryIds.length) orClauses.push({ subCategory: { $in: subCategoryIds } });
    if (orClauses.length > 1)  productQuery.$or = orClauses;
    else Object.assign(productQuery, orClauses[0]);

    const productIds = await Product.find(productQuery)
      .select('_id').lean()
      .then((docs) => docs.map((d) => d._id));
    if (!productIds.length) return [];

    return await SubProduct.find({ product: { $in: productIds }, tenant: tenantId })
      .populate(PRODUCT_POPULATE)
      .populate('sizes')
      .limit(limit)
      .lean();
  } catch (err) {
    console.error('scanMatch.findSubProductsByCategoryIds failed:', err.message);
    return [];
  }
}

/**
 * Rich per-candidate scoring that combines token overlap with model fields:
 *   • Brand.tradingAs aliases  (+12 if a query token matches any alias)
 *   • Product.metaKeywords     (+10 if a query token matches any keyword)
 *   • SubProduct.customKeywords(+10 if a query token matches any keyword)
 *   • Product.type             (+15 if type matches the extracted type)
 *   • Product.ageStatement     (+8  if age tokens appear in query)
 */
function scoreCandidate(queryTokens, extractedType, sp) {
  const pName      = sp.product?.name    || sp.name || '';
  const pBrand     = sp.product?.brand?.name || '';
  const pType      = sp.product?.type    || '';
  const pAgeStmt   = sp.product?.ageStatement || '';
  const pMetaKw    = sp.product?.metaKeywords  || [];
  const pTradingAs = sp.product?.brand?.tradingAs || [];
  const pCustKw    = sp.customKeywords   || [];

  let score = scoreNameMatch(queryTokens, pName, pBrand);

  // Brand tradingAs aliases (e.g. "Henny" in Brand.tradingAs → bonus)
  if (pTradingAs.length) {
    const tradingTokens = pTradingAs.flatMap((a) => tokenize(a));
    if (queryTokens.some((qt) =>
      tradingTokens.some((tt) => qt === tt || tt.includes(qt) || qt.includes(tt))
    )) score += 12;
  }

  // Product.metaKeywords overlap
  if (pMetaKw.length) {
    const kwTokens = pMetaKw.flatMap((kw) => tokenize(kw));
    if (queryTokens.some((qt) =>
      kwTokens.some((kt) => qt === kt || (qt.length >= 4 && kt.length >= 4 && editDistance(qt, kt, 1) <= 1))
    )) score += 10;
  }

  // SubProduct.customKeywords overlap (tenant-specific hints)
  if (pCustKw.length) {
    const ckTokens = pCustKw.flatMap((kw) => tokenize(kw));
    if (queryTokens.some((qt) =>
      ckTokens.some((kt) => qt === kt || (qt.length >= 4 && kt.length >= 4 && editDistance(qt, kt, 1) <= 1))
    )) score += 10;
  }

  // Product.type matches extracted type (e.g. "cognac" → cognac products)
  if (extractedType) {
    const mapped = mapExtractedType(extractedType);
    if (mapped && pType === mapped) score += 15;
  }

  // Product.ageStatement tokens appear in query (VSOP / XO / 12 Year / Double Black)
  if (pAgeStmt) {
    const ageTokens = tokenize(pAgeStmt);
    if (ageTokens.some((at) => queryTokens.some((qt) => qt === at || qt.includes(at) || at.includes(qt)))) {
      score += 8;
    }
  }

  // Category name/type matches extracted product type or query tokens (+10)
  const catName = sp.product?.category?.name || sp.product?.category?.displayName || '';
  const catType = sp.product?.category?.type || '';
  const catMetaKw = sp.product?.category?.metaKeywords || [];
  if (catName || catType || catMetaKw.length) {
    const catTokens = tokenize(catName);
    if (catType && extractedType && catType === mapExtractedType(extractedType)) {
      score += 10;
    } else if (catTokens.length && queryTokens.some((qt) => catTokens.some((ct) => qt === ct || ct.includes(qt)))) {
      score += 6;
    }
    if (catMetaKw.length) {
      const ckw = catMetaKw.flatMap((kw) => tokenize(kw));
      if (queryTokens.some((qt) => ckw.some((k) => qt === k || k.includes(qt)))) score += 4;
    }
  }

  // SubCategory name/metaKeywords/typicalFlavors match query tokens (+8)
  const scName    = sp.product?.subCategory?.name || sp.product?.subCategory?.displayName || '';
  const scMetaKw  = sp.product?.subCategory?.metaKeywords || [];
  const scFlavors = sp.product?.subCategory?.typicalFlavors || [];
  if (scName || scMetaKw.length || scFlavors.length) {
    const scTokens = tokenize(scName);
    if (scTokens.length && queryTokens.some((qt) => scTokens.some((st) => qt === st || st.includes(qt) || qt.includes(st)))) {
      score += 8;
    }
    if (scMetaKw.length) {
      const smkw = scMetaKw.flatMap((kw) => tokenize(kw));
      if (queryTokens.some((qt) => smkw.some((k) => qt === k || k.includes(qt)))) score += 5;
    }
    if (scFlavors.length) {
      const sfTokens = scFlavors.flatMap((f) => tokenize(f));
      if (queryTokens.some((qt) => sfTokens.some((ft) => qt === ft))) score += 3;
    }
  }

  return score;
}

// ── Pack / carton conversion ────────────────────────────────────────────────

// Fallback units-per-pack when Size.unitsPerPack is 1 (the schema default,
// meaning "not configured"). A physical pack of beer/wine is usually 6;
// a carton/case is 12. Operators can override per-size via unitsPerPack.
const PACK_UNIT_DEFAULTS = {
  pack:   6,
  carton: 12,
  case:   12,
  box:    12,
};

/**
 * Convert an extracted (qty, packUnit) pair to individual bottle/unit count
 * using the matched size's unitsPerPack, with sensible defaults.
 *
 * @param {number} rawQty      - pack/carton/unit count from AI
 * @param {string|null} packUnit - "pack"|"carton"|"case"|"unit"|null
 * @param {number} [sizeUnitsPerPack] - Size.unitsPerPack from DB (default 1)
 * @returns {{ finalQty: number, packNote: string|null }}
 */
function resolvePackQty(rawQty, packUnit, sizeUnitsPerPack) {
  const qty = Math.max(1, Math.round(Number(rawQty) || 1));
  if (!packUnit || packUnit === 'unit') return { finalQty: qty, packNote: null };

  // Use DB value when it's configured (> 1); otherwise fall back to defaults.
  const dbVal = sizeUnitsPerPack && sizeUnitsPerPack > 1 ? sizeUnitsPerPack : null;
  const unitsEach = dbVal ?? PACK_UNIT_DEFAULTS[packUnit] ?? 6;
  const finalQty = qty * unitsEach;
  const packNote = `${qty} ${packUnit}${qty !== 1 ? 's' : ''} × ${unitsEach} units = ${finalQty}`;
  return { finalQty, packNote };
}

// ── Size parsing + volume comparison ───────────────────────────────────────

const UNITS = [
  { re: /(\d+(?:\.\d+)?)\s*ml\b/i, toMl: (n) => n },
  { re: /(\d+(?:\.\d+)?)\s*l\b/i, toMl: (n) => n * 1000 },
  { re: /(\d+(?:\.\d+)?)\s*cl\b/i, toMl: (n) => n * 10 },
  { re: /(\d+(?:\.\d+)?)\s*litre/i, toMl: (n) => n * 1000 },
];

/** Parse a size string like '70cl' / '750ml' / '1L' to ml; null if not parseable. */
function sizeTextToMl(sizeText) {
  if (!sizeText) return null;
  for (const u of UNITS) {
    const m = sizeText.match(u.re);
    if (m) return u.toMl(parseFloat(m[1]));
  }
  return null;
}

// ── Matching ───────────────────────────────────────────────────────────────

/** Build the result object for one extracted item. */
function buildResult(extracted, matchedProduct, subProducts, confidence, note) {
  const suggestedSizeId = pickSuggestedSize(matchedProduct, subProducts, extracted.sizeText);

  // Pack/carton qty resolution — uses DB unitsPerPack from the best matched size.
  const bestSize = subProducts[0]?.sizes?.[0];
  const { finalQty, packNote } = resolvePackQty(
    extracted.qty,
    extracted.packUnit || null,
    bestSize?.unitsPerPack
  );

  // Combine pack note with any match-quality note.
  const combinedNote = [packNote, note].filter(Boolean).join(' · ') || null;

  return {
    extractedName: extracted.name,
    brand: extracted.brand || null,
    type: extracted.type || null,
    sizeText: extracted.sizeText || null,
    packUnit: extracted.packUnit || null,
    qty: finalQty,
    confidence,
    note: combinedNote,
    matchedProductId: matchedProduct?._id || matchedProduct?.id || null,
    matchedProductName: matchedProduct?.name || null,
    matchedSubProducts: subProducts.map((sp) => ({
      _id: sp._id,
      sku: sp.sku || '',
      baseSellingPrice: sp.baseSellingPrice ?? 0,
      costPrice: sp.costPrice ?? 0,
      taxRate: sp.taxRate ?? 0,
      sellWithoutSizeVariants: sp.sellWithoutSizeVariants ?? false,
      bundleDeals: sp.bundleDeals ?? [],
      sizes: (sp.sizes || []).map((s) => ({
        size: String(s._id ?? s.size ?? ''),
        displayName: s.displayName ?? s.size ?? '',
        volumeMl: s.volumeMl ?? null,
        sku: s.sku ?? sp.sku ?? '',
        // Fall back to sp.baseSellingPrice when the Size row has no price yet —
        // mirrors the same fallback in product-line-search pickSize.
        sellingPrice: s.sellingPrice || sp.baseSellingPrice || 0,
        costPrice: s.costPrice ?? sp.costPrice ?? 0,
        availableStock: s.availableStock ?? s.stock ?? 0,
        isDefault: s.isDefault ?? false,
      })),
    })),
    suggestedSizeId,
    partial: confidence === 'partial',
  };
}

/** Pick the size to default-select: closest volume to the extracted size,
 *  falling back to the default size, then the first size. */
function pickSuggestedSize(matchedProduct, subProducts, sizeText) {
  if (!matchedProduct || subProducts.length === 0) return null;
  const targetMl = sizeTextToMl(sizeText);
  if (targetMl) {
    let best = null;
    let bestDiff = Infinity;
    for (const sp of subProducts) {
      for (const s of sp.sizes || []) {
        const ml = s.volumeMl ?? sizeTextToMl(s.displayName) ?? sizeTextToMl(s.size);
        if (ml == null) continue;
        const diff = Math.abs(ml - targetMl);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = String(s._id ?? s.size ?? '');
        }
      }
    }
    if (best) return best;
  }
  // Fallback: default size, then first size of the first subproduct.
  for (const sp of subProducts) {
    const def = (sp.sizes || []).find((s) => s.isDefault);
    if (def) return String(def._id ?? def.size ?? '');
    if (sp.sizes?.[0]) return String(sp.sizes[0]._id ?? sp.sizes[0].size ?? '');
  }
  return null;
}

/**
 * Match one extracted item against the tenant's catalogue.
 *
 * Four-phase search:
 *   Phase 1 — Text multi-pass via getMySubProducts (regex on Product.name/SKU).
 *             Tries full query, brand alone, individual tokens, 4-char prefixes.
 *   Phase 2 — Brand alias lookup via Brand.tradingAs when <5 candidates found.
 *             Catches nicknames ("Henny") and abbreviations ("JD") stored in
 *             Brand.tradingAs even if Product.name doesn't contain them.
 *   Phase 2.5 — Category/SubCategory search when <8 candidates found.
 *             Searches Category.name/displayName/metaKeywords and
 *             SubCategory.name/metaKeywords/typicalFlavors — handles category-level
 *             terms like "bubbly" (→ Champagne), "single malt" (→ Scotch),
 *             "VSOP" (→ SubCategory VSOP Cognac).
 *   Phase 4 — Type-based fallback (last resort) when still no candidates.
 *             Finds SubProducts by Product.type matching the extracted beverage
 *             type — helps with vague inputs like "give me some cognac".
 *
 * Scoring uses token-overlap + Levenshtein + model fields:
 *   Product.type, Product.ageStatement, Product.metaKeywords,
 *   Brand.tradingAs, SubProduct.customKeywords,
 *   Category.name/type/metaKeywords, SubCategory.name/metaKeywords/typicalFlavors.
 *
 * @param extracted  { name, brand, type, sizeText, qty, packUnit }
 * @param deps       { getSubProducts, tenantId }
 */
async function matchOne(extracted, deps) {
  const { getSubProducts, tenantId } = deps;
  if (!extracted.name?.trim()) {
    return buildResult(extracted, null, [], 'none', 'No name extracted');
  }

  const searchTerms = buildSearchTerms(extracted.name, extracted.brand, extracted.sizeText);
  const candidateMap = new Map();

  // ── Phase 1: text-based multi-pass ──────────────────────────────────────
  for (const term of searchTerms) {
    if (!term || term.length < 2) continue;
    try {
      const res = await getSubProducts(tenantId, { search: term, limit: 8 });
      for (const sp of res?.subProducts || []) {
        const id = String(sp._id);
        if (!candidateMap.has(id)) candidateMap.set(id, sp);
      }
    } catch (err) {
      console.error('scanMatch.matchOne getSubProducts failed:', err.message);
    }
    if (candidateMap.size >= 15) break;
  }

  // ── Phase 2: Brand.tradingAs alias lookup ────────────────────────────────
  // Triggered when Phase 1 yields < 5 candidates (i.e. text search was weak).
  // Searches the Brand collection's `tradingAs` array so nicknames that are
  // stored there (e.g. brand.tradingAs = ["Henny","Hen"]) produce hits.
  if (candidateMap.size < 5) {
    const brandAliasTerm = expandAliases(extracted.brand || extracted.name);
    const matchedBrands = await lookupBrandsByAlias(brandAliasTerm);

    // Also try the raw extracted name in case brand is unknown/null.
    if (!matchedBrands.length && extracted.brand) {
      const fallbackBrands = await lookupBrandsByAlias(expandAliases(extracted.name));
      matchedBrands.push(...fallbackBrands);
    }

    if (matchedBrands.length) {
      const byBrand = await findSubProductsByBrandIds(
        matchedBrands.map((b) => b._id),
        tenantId,
        8
      );
      for (const sp of byBrand) {
        const id = String(sp._id);
        if (!candidateMap.has(id)) candidateMap.set(id, sp);
      }
    }
  }

  // ── Phase 2.5: Category/SubCategory keyword search ──────────────────────
  // Fires when < 8 candidates: handles category-level terms not in product names.
  // "bubbly" → Category.metaKeywords → Champagne → champagne products.
  // "single malt" → SubCategory.name → Single Malt Scotch → scotch products.
  if (candidateMap.size < 8) {
    const catQueryTokens = tokenize(expandAliases(extracted.name) + ' ' + (extracted.brand || ''));
    const [matchedCats, matchedSubCats] = await Promise.all([
      findCategoriesByTokens(catQueryTokens),
      findSubCategoriesByTokens(catQueryTokens),
    ]);
    if (matchedCats.length || matchedSubCats.length) {
      const byCat = await findSubProductsByCategoryIds(
        {
          categoryIds:    matchedCats.map((c) => c._id),
          subCategoryIds: matchedSubCats.map((s) => s._id),
        },
        tenantId,
        6
      );
      for (const sp of byCat) {
        const id = String(sp._id);
        if (!candidateMap.has(id)) candidateMap.set(id, sp);
      }
    }
  }

  // ── Phase 4: type-based fallback ────────────────────────────────────────
  // Only fires when the input is extremely vague (e.g. "cognac", "champagne")
  // and all previous phases returned nothing.
  if (candidateMap.size === 0 && extracted.type) {
    const mappedType = mapExtractedType(extracted.type);
    if (mappedType) {
      const byType = await findSubProductsByType(mappedType, tenantId, 5);
      for (const sp of byType) {
        const id = String(sp._id);
        if (!candidateMap.has(id)) candidateMap.set(id, sp);
      }
    }
  }

  const candidates = [...candidateMap.values()];
  if (candidates.length === 0) {
    return buildResult(extracted, null, [], 'none', 'Not found in catalogue');
  }

  // ── Rank with model-aware scoring ───────────────────────────────────────
  const queryTokens = tokenize(
    expandAliases(extracted.name) + ' ' + expandAliases(extracted.brand || '')
  );

  let best = candidates[0];
  let bestScore = -1;
  for (const sp of candidates) {
    const score = scoreCandidate(queryTokens, extracted.type, sp);
    if (score > bestScore) {
      bestScore = score;
      best = sp;
    }
  }

  const matchedProduct = best.product || { _id: best.productId, name: best.name };

  // ── Derive confidence ────────────────────────────────────────────────────
  // Threshold ≥32: allCovered bonus (20) + at least one strong token match (12).
  // This accounts for the extra bonuses from model fields (type +15, tradingAs +12,
  // metaKeywords +10, customKeywords +10, ageStatement +8).
  const targetMl = sizeTextToMl(extracted.sizeText);
  let confidence = 'partial';
  let note = null;

  const strongNameMatch = bestScore >= 32;

  if (strongNameMatch) {
    if (targetMl) {
      const catMls = (best.sizes || [])
        .map((s) => s.volumeMl ?? sizeTextToMl(s.displayName) ?? sizeTextToMl(s.size))
        .filter((m) => m != null);
      if (catMls.length) {
        const closest = catMls.reduce((a, b) =>
          Math.abs(b - targetMl) < Math.abs(a - targetMl) ? b : a
        );
        const diffPct = Math.abs(closest - targetMl) / Math.max(1, targetMl);
        confidence = diffPct <= 0.2 ? 'exact' : 'partial';
        if (diffPct > 0.2) note = `Volume differs (${extracted.sizeText} extracted, ${closest}ml in catalogue)`;
      } else {
        confidence = 'exact';
      }
    } else {
      confidence = 'exact';
    }
  } else if (bestScore >= 15) {
    confidence = 'partial';
    note = bestScore >= 25 ? 'Partial name match — verify' : 'Weak match — verify';
  } else {
    confidence = 'partial';
    note = 'Low-confidence match — verify';
  }

  return buildResult(extracted, matchedProduct, [best], confidence, note);
}

/**
 * Extract + match in one call. Accepts either an image URL or raw text.
 * @param input  { imageUrl?: string, text?: string }
 * @param deps   { tenantId, getSubProducts }
 * @returns Promise<ScanResult[]>
 */
async function extractAndMatch(input, deps) {
  let extracted;
  if (input.imageUrl) {
    extracted = await extractItemsFromImage(input.imageUrl);
  } else if (input.text) {
    extracted = await extractItemsFromText(input.text);
  } else {
    return [];
  }
  if (extracted.length === 0) return [];

  // Match in parallel (bounded) — Promise.all is fine for ≤30 items.
  const results = await Promise.all(
    extracted.map((item) => matchOne(item, deps).catch((err) => {
      console.error('scanMatch.matchOne error:', err.message);
      return buildResult(item, null, [], 'none', 'Match error');
    }))
  );
  return results;
}

/**
 * Smart search: no AI, just alias expansion + Brand/Category lookup + fuzzy
 * scoring. Used by the live product search box as a fuzzy fallback when a
 * plain-text search returns 0 results.
 *
 * Returns up to `limit` SubProducts sorted by descending match score, each
 * annotated with `_smartScore` so the caller can show a confidence indicator.
 *
 * @param {string} query       Raw text the user typed ("Henny", "moet", "JD 1L")
 * @param {{ tenantId, getSubProducts }} deps
 * @param {number} [limit=10]
 */
async function smartSearch(query, deps, limit = 10) {
  const { getSubProducts, tenantId } = deps;
  if (!query?.trim() || !tenantId) return [];

  const expanded   = expandAliases(query.trim());
  const searchTerms = buildSearchTerms(expanded, null, null);
  const queryTokens = tokenize(expanded);
  const candidateMap = new Map();

  // Phase 1: text multi-pass
  for (const term of searchTerms) {
    if (!term || term.length < 2) continue;
    try {
      const res = await getSubProducts(tenantId, { search: term, limit: 8 });
      for (const sp of res?.subProducts || []) {
        const id = String(sp._id);
        if (!candidateMap.has(id)) candidateMap.set(id, sp);
      }
    } catch { /* skip */ }
    if (candidateMap.size >= 15) break;
  }

  // Phase 2: Brand alias lookup
  if (candidateMap.size < 5) {
    const brands = await lookupBrandsByAlias(expanded);
    if (brands.length) {
      const byBrand = await findSubProductsByBrandIds(brands.map((b) => b._id), tenantId, 8);
      for (const sp of byBrand) {
        const id = String(sp._id);
        if (!candidateMap.has(id)) candidateMap.set(id, sp);
      }
    }
  }

  // Phase 2.5: Category/SubCategory keyword search
  if (candidateMap.size < 8) {
    const [cats, subCats] = await Promise.all([
      findCategoriesByTokens(queryTokens),
      findSubCategoriesByTokens(queryTokens),
    ]);
    if (cats.length || subCats.length) {
      const byCat = await findSubProductsByCategoryIds(
        { categoryIds: cats.map((c) => c._id), subCategoryIds: subCats.map((s) => s._id) },
        tenantId, 6
      );
      for (const sp of byCat) {
        const id = String(sp._id);
        if (!candidateMap.has(id)) candidateMap.set(id, sp);
      }
    }
  }

  if (!candidateMap.size) return [];

  // Score and sort
  return [...candidateMap.values()]
    .map((sp) => {
      const score = scoreCandidate(queryTokens, null, sp);
      return { ...sp, _smartScore: score };
    })
    .filter((sp) => sp._smartScore > 0)
    .sort((a, b) => b._smartScore - a._smartScore)
    .slice(0, limit);
}

module.exports = {
  extractItemsFromImage,
  extractItemsFromText,
  extractAndMatch,
  matchOne,
  smartSearch,
  sizeTextToMl,
  // Exposed for testing / external use
  normalizeStr,
  expandAliases,
  scoreNameMatch,
  scoreCandidate,
  mapExtractedType,
  lookupBrandsByAlias,
  findCategoriesByTokens,
  findSubCategoriesByTokens,
  findSubProductsByCategoryIds,
};