// services/productResearch.service.js — live web research for product data.
//
// The only place in the product pipeline that talks to the open internet. One
// Claude call with the Anthropic `web_search` server tool returns the objective
// facts a real source confirmed, plus the pages it actually read.
//
// Two rules make this trustworthy, and both are enforced here rather than by
// asking the model nicely:
//   1. A fact no source confirmed is OMITTED from `facts` — never inferred. The
//      caller leaves the field blank and flags it, so a wrong ABV or vintage
//      cannot reach the catalog.
//   2. `sources` is extracted from the response's `web_search_tool_result`
//      blocks, which carry real URLs from the search backend. URLs appearing
//      only in the model's prose are discarded, so a hallucinated citation
//      cannot reach the admin.
'use strict';

const Anthropic = require('@anthropic-ai/sdk');

// Haiku, same as every other product/sub-product generation path. It does not
// have to resist filling gaps from memory on its own: the no-inference rule is
// enforced twice in code below — unsourced facts are dropped, and only URLs the
// search backend actually returned ever become sources.
const RESEARCH_MODEL = process.env.ANTHROPIC_RESEARCH_MODEL || 'claude-haiku-4-5';
// Deliberately the pre-dynamic-filtering search tool. `web_search_20260209`
// runs a code-execution container per search to pre-filter results, which
// measured ~3x slower here (22.6s vs 8.0s on the same query) for a token saving
// this endpoint does not need — it reads a handful of pages, not a corpus.
// Overridable so a version bump does not need a code change.
const WEB_SEARCH_TOOL_TYPE =
  process.env.ANTHROPIC_WEB_SEARCH_TOOL || 'web_search_20250305';
const MAX_SEARCHES = Number(process.env.ANTHROPIC_RESEARCH_MAX_SEARCHES || 4);
// This runs behind an admin button click. At the default `high` effort the model
// kept re-searching for minutes on well-documented products, which no proxy will
// hold open. Lower effort consolidates the tool calls; it does not loosen the
// no-inference rule, which is enforced in the prompt and again in code.
// Only sent for models that accept it — Haiku 4.5 rejects `output_config.effort`
// and adaptive thinking outright, so both are omitted there (see reasoningParams).
const RESEARCH_EFFORT = process.env.ANTHROPIC_RESEARCH_EFFORT || 'low';
// Extended thinking on Haiku is the budgeted form, not adaptive. Must stay below
// max_tokens (8000 below) and at/above the 1024 minimum.
const RESEARCH_THINKING_BUDGET = Number(
  process.env.ANTHROPIC_RESEARCH_THINKING_BUDGET || 2000
);
// Hard ceiling. Overrunning it degrades to "nothing verified", which is a safe
// answer here — every factual field simply comes back blank and flagged.
const RESEARCH_TIMEOUT_MS = Number(process.env.ANTHROPIC_RESEARCH_TIMEOUT_MS || 90000);

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

// Objective fields the research pass may return. Anything not on this list is
// copy, and copy is never sourced from the web — it is written from these facts.
// The order is the order the admin sees in `unverified`.
const FACTUAL_FIELDS = [
  'brand',
  'producer',
  'distilleryName',
  'breweryName',
  'wineryName',
  'originCountry',
  'region',
  'appellation',
  'abv',
  'volumeMl',
  'standardSizes',
  'vintage',
  'age',
  'ageStatement',
  'productionMethod',
  'caskType',
  'grapeVarieties',
  'ingredients',
  'allergens',
  'officialTastingNotes',
  'nutritionalInfo',
  'awards',
];

// Object-valued facts, each with a fixed set of sub-keys. Sub-keys the source
// did not state are dropped the same way top-level fields are.
const OBJECT_FIELDS = {
  officialTastingNotes: { keys: ['nose', 'palate', 'finish', 'colour'], numeric: false },
  nutritionalInfo: {
    keys: ['calories', 'carbohydrates', 'sugar', 'protein', 'fat', 'sodium', 'caffeine'],
    numeric: true,
  },
};

const NUMERIC_FIELDS = new Set(['abv', 'volumeMl', 'vintage', 'age']);
const ARRAY_FIELDS = new Set([
  'standardSizes',
  'grapeVarieties',
  'ingredients',
  'allergens',
  'awards',
]);

/**
 * Reasoning knobs for the research call, which differ by model family:
 *   - Haiku 4.5 has no adaptive thinking and 400s on `output_config.effort`.
 *     It gets budgeted extended thinking and no effort at all.
 *   - Opus/Sonnet 4.6+ (only reachable via ANTHROPIC_RESEARCH_MODEL) 400 on
 *     `budget_tokens`, so they get adaptive thinking plus effort.
 */
function reasoningParams(model = RESEARCH_MODEL) {
  if (String(model).startsWith('claude-haiku')) {
    return {
      thinking: { type: 'enabled', budget_tokens: RESEARCH_THINKING_BUDGET },
    };
  }
  return {
    thinking: { type: 'adaptive' },
    output_config: { effort: RESEARCH_EFFORT },
  };
}

let defaultClient = null;
function getDefaultClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!defaultClient) {
    defaultClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return defaultClient;
}

// ── Cache ───────────────────────────────────────────────────────────────────

// Map preserves insertion order, so the oldest key is the first one — that is
// the LRU victim once we re-insert on every read.
const cache = new Map();

function cacheKey({ name, brand }) {
  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  return `${norm(name)}|${norm(brand)}`;
}

function cacheGet(key, now) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (now - hit.storedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Re-insert so recently used entries move to the back of the eviction queue.
  cache.delete(key);
  cache.set(key, hit);
  return hit.brief;
}

function cacheSet(key, brief, now) {
  cache.set(key, { brief, storedAt: now });
  while (cache.size > CACHE_MAX_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
}

function clearResearchCache() {
  cache.clear();
}

// ── Response parsing ────────────────────────────────────────────────────────

// Retail listings and marketplaces do turn up real bottle data, but they are the
// weakest evidence and they dominate drinks search results by volume. Rank them
// last so the admin sees producer and reference sources first.
const WEAK_SOURCE_HOSTS = [
  'ebay.',
  'amazon.',
  'ubereats.com',
  'instacart.com',
  'drizly.com',
  'doordash.com',
  'aliexpress.',
  'walmart.com',
  'jumia.',
  'konga.com',
];

const MAX_SOURCES = 12;

const isWeakSource = (url) => {
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch (_) {
      return '';
    }
  })();
  return WEAK_SOURCE_HOSTS.some((h) => host.includes(h));
};

/**
 * Pull the pages the search backend actually returned. Walks
 * `web_search_tool_result` blocks only — text-block citations and any URL the
 * model typed into its prose are deliberately ignored, because those can be
 * fabricated and these cannot.
 *
 * Strong sources first, then weak ones, capped at `MAX_SOURCES` so the admin
 * gets a checkable list rather than thirty retail listings.
 */
function extractSources(content) {
  const strong = [];
  const weak = [];
  const seen = new Set();
  for (const block of Array.isArray(content) ? content : []) {
    if (block?.type !== 'web_search_tool_result') continue;
    // `content` is either an array of results or an error object.
    const results = Array.isArray(block.content) ? block.content : [];
    for (const r of results) {
      if (r?.type !== 'web_search_result' || !r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      const source = { title: String(r.title || r.url), url: String(r.url) };
      (isWeakSource(source.url) ? weak : strong).push(source);
    }
  }
  return strong.concat(weak).slice(0, MAX_SOURCES);
}

function extractText(content) {
  return (Array.isArray(content) ? content : [])
    .filter((b) => b?.type === 'text')
    .map((b) => b.text || '')
    .join('')
    .trim();
}

// Tolerant JSON extraction — the model may wrap the object in prose or fences
// even when told not to. Returns null when nothing parseable is present.
function parseFactsJSON(text) {
  if (!text) return null;
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  cleaned = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    return null;
  }
}

// Drop anything the model returned that is not a real, confirmed value: unknown
// keys, nulls, empty strings/arrays, and the "unknown"/"n/a" placeholders models
// reach for when told not to guess. What survives is what we treat as verified.
function sanitizeFacts(raw) {
  const facts = {};
  if (!raw || typeof raw !== 'object') return facts;

  const PLACEHOLDERS = new Set([
    '',
    'unknown',
    'n/a',
    'na',
    'none',
    'not specified',
    'not stated',
    'not available',
    'unconfirmed',
    'null',
    'undefined',
    'varies',
  ]);

  for (const field of FACTUAL_FIELDS) {
    const value = raw[field];
    if (value === null || value === undefined) continue;

    if (NUMERIC_FIELDS.has(field)) {
      const num = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.]/g, ''));
      if (Number.isFinite(num) && num > 0) facts[field] = num;
      continue;
    }

    if (ARRAY_FIELDS.has(field)) {
      const arr = (Array.isArray(value) ? value : [value])
        .map((v) => String(v).trim())
        .filter((v) => v && !PLACEHOLDERS.has(v.toLowerCase()));
      if (arr.length) facts[field] = arr;
      continue;
    }

    if (field in OBJECT_FIELDS) {
      if (typeof value !== 'object' || Array.isArray(value)) continue;
      const { keys, numeric } = OBJECT_FIELDS[field];
      const out = {};
      for (const part of keys) {
        const v = value[part];
        if (v === null || v === undefined) continue;
        if (numeric) {
          const num = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.]/g, ''));
          // 0 is a real nutritional value (a spirit genuinely has 0g protein),
          // so unlike ABV it is kept.
          if (Number.isFinite(num) && String(v).trim() !== '') out[part] = num;
          continue;
        }
        const str = String(v).trim();
        if (str && !PLACEHOLDERS.has(str.toLowerCase())) out[part] = str;
      }
      if (Object.keys(out).length) facts[field] = out;
      continue;
    }

    const str = String(value).trim();
    if (str && !PLACEHOLDERS.has(str.toLowerCase())) facts[field] = str;
  }

  return facts;
}

// Sources state bottle sizes however they like — "700ml", "0.7L", "70 cl" — and
// the Product schema only accepts one spelling. Convert to millilitres, then try
// every spelling the schema might use, so a correctly-sourced size is not thrown
// away for being written the other way round.
function sizeVariants(value) {
  const raw = String(value).trim();
  const m = raw.match(/^([\d.]+)\s*(ml|cl|l|litre|liter)?$/i);
  if (!m) return [raw];

  const num = parseFloat(m[1]);
  if (!Number.isFinite(num) || num <= 0) return [raw];

  const unit = (m[2] || 'ml').toLowerCase();
  const ml = unit === 'ml' ? num : unit === 'cl' ? num * 10 : num * 1000;

  const trim = (n) => String(parseFloat(n.toFixed(4)));
  return [
    raw,
    `${trim(ml)}ml`,
    `${trim(ml / 10)}cl`,
    `${trim(ml / 1000)}L`,
    `bottle-${trim(ml)}ml`,
    `can-${trim(ml)}ml`,
  ];
}

/**
 * Filter sourced values down to what the schema can store, trying alternate
 * spellings for sizes. Returns only values that survive.
 */
function filterToEnum(value, allowed, field) {
  const values = Array.isArray(value) ? value : [value];
  const out = [];
  for (const v of values) {
    const candidates = field === 'standardSizes' ? sizeVariants(v) : [v];
    const match = candidates.find((c) => allowed.includes(c));
    if (match !== undefined && !out.includes(match)) out.push(match);
  }
  return Array.isArray(value) ? out : out[0];
}

// Derived from what is actually present, not self-reported by the model.
function computeUnverified(facts) {
  return FACTUAL_FIELDS.filter((f) => !(f in facts));
}

function emptyBrief(now, extra = {}) {
  return {
    found: false,
    facts: {},
    sources: [],
    unverified: FACTUAL_FIELDS.slice(),
    searchedAt: new Date(now).toISOString(),
    ...extra,
  };
}

// ── Prompt ──────────────────────────────────────────────────────────────────

const RESEARCH_SYSTEM = `You are a drinks-industry research assistant for a retailer's product catalog.

Your job is to find what authoritative sources actually say about a product, then report ONLY that.

METHOD:
- Search for the product by its full name. Prefer the producer's own site, the distillery/winery/brewery site, official importer or distributor listings, and established reference databases.
- Ignore marketplace listings and user-generated content when they conflict with a producer source.
- If several sources disagree on a number, prefer the producer's.

THE ONE RULE THAT MATTERS:
Omit any field you did not find stated in a source you actually read. Do not infer it from the product category, the brand's other products, the name, or your own prior knowledge. A missing field is a correct answer; a plausible guess is a defect. Never output placeholder strings like "unknown" or "N/A" — leave the key out entirely.

Respond with ONLY a JSON object, no prose and no code fences.`;

function buildResearchPrompt({ name, brand, category }) {
  const context = [
    brand ? `Brand (as entered by the admin, may be wrong): ${brand}` : null,
    category ? `Category (as entered by the admin, may be wrong): ${category}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `Research this drinks product and report only what your sources confirm.

PRODUCT: ${name}
${context}

Return this JSON shape, including only the keys you could confirm:

{
  "found": true,
  "brand": "",
  "producer": "",
  "distilleryName": "",
  "breweryName": "",
  "wineryName": "",
  "originCountry": "",
  "region": "",
  "appellation": "",
  "abv": 0,
  "volumeMl": 0,
  "standardSizes": [],
  "vintage": 0,
  "age": 0,
  "ageStatement": "",
  "productionMethod": "",
  "caskType": "",
  "grapeVarieties": [],
  "ingredients": [],
  "allergens": [],
  "officialTastingNotes": { "nose": "", "palate": "", "finish": "", "colour": "" },
  "nutritionalInfo": { "calories": 0, "carbohydrates": 0, "sugar": 0, "protein": 0, "fat": 0, "sodium": 0, "caffeine": 0 },
  "awards": [],
  "summary": ""
}

Notes on specific fields:
- "abv" is a percentage number, e.g. 40 for 40% ABV.
- "volumeMl" is the standard retail bottle/can size in millilitres.
- "vintage" and "age" are plain years/numbers; omit both unless the source states them for THIS bottling.
- "officialTastingNotes" must be the producer's own published notes, not your description.
- "nutritionalInfo" must come from a published nutrition panel or the producer's own figures. Do not calculate calories from ABV — omit the whole object if it is not published.
- "summary" is 2-3 factual sentences drawn from your sources, for the copywriter to build on.

If you cannot confirm the product exists at all, return {"found": false}.`;
}

// The SDK's request-level `timeout` does not interrupt a long server-tool loop —
// a run that kept searching sailed past it — so race the stream ourselves and
// abort it. A timeout is not an error the admin needs to see: it degrades to
// "nothing verified", which blanks and flags the fields exactly like a genuine
// no-results answer.
function withTimeout(stream, ms) {
  let timer;
  return Promise.race([
    stream.finalMessage().finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        try {
          stream.abort();
        } catch (_) {
          /* already settled */
        }
        reject(new Error(`Research timed out after ${Math.round(ms / 1000)}s`));
      }, ms);
    }),
  ]);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Research a product on the live web.
 *
 * @param {{name: string, brand?: string, category?: string}} query
 * @param {{client?: object, cacheOnly?: boolean, now?: () => number}} [opts]
 * @returns {Promise<object|null>} Brief, or null when `cacheOnly` misses.
 *
 * Never throws: search or parse failures come back as a `found: false` brief so
 * a flaky network degrades to blank-and-flagged rather than a 500.
 */
async function researchProduct(query, opts = {}) {
  const { cacheOnly = false, now = Date.now } = opts;
  const name = String(query?.name || '').trim();
  const at = now();

  if (!name) return cacheOnly ? null : emptyBrief(at);

  const key = cacheKey({ name, brand: query.brand });
  const cached = cacheGet(key, at);
  if (cached) return cached;
  // A cache-only caller (copy endpoints) must never spend a search.
  if (cacheOnly) return null;

  const client = opts.client || getDefaultClient();
  if (!client) {
    return emptyBrief(at, { error: 'ANTHROPIC_API_KEY is not configured' });
  }

  let message;
  try {
    // Streamed so a long search loop cannot trip the SDK's HTTP timeout.
    const stream = client.messages.stream(
      {
        model: RESEARCH_MODEL,
        max_tokens: 8000,
        ...reasoningParams(RESEARCH_MODEL),
        system: RESEARCH_SYSTEM,
        tools: [
          {
            type: WEB_SEARCH_TOOL_TYPE,
            name: 'web_search',
            max_uses: MAX_SEARCHES,
          },
        ],
        messages: [{ role: 'user', content: buildResearchPrompt({ ...query, name }) }],
      },
      { timeout: RESEARCH_TIMEOUT_MS }
    );

    message = await withTimeout(stream, RESEARCH_TIMEOUT_MS);
  } catch (error) {
    console.error('[productResearch] search failed:', error.message);
    return emptyBrief(at, { error: error.message });
  }

  // A safety refusal is a successful HTTP 200 with no usable content.
  if (message?.stop_reason === 'refusal') {
    return emptyBrief(at, { error: 'Model declined the research request' });
  }

  const sources = extractSources(message?.content);
  const raw = parseFactsJSON(extractText(message?.content));

  if (!raw || raw.found === false) {
    const brief = emptyBrief(at);
    brief.sources = sources;
    cacheSet(key, brief, at);
    return brief;
  }

  const facts = sanitizeFacts(raw);
  const summary = String(raw.summary || '').trim();

  const brief = {
    // Facts with no sources behind them are model recall wearing a costume.
    found: sources.length > 0 && Object.keys(facts).length > 0,
    facts,
    summary,
    sources,
    unverified: computeUnverified(facts),
    searchedAt: new Date(at).toISOString(),
  };

  cacheSet(key, brief, at);
  return brief;
}

/**
 * Render a brief as the prompt block that grounds a generation pass. Returns ''
 * for an empty brief so callers can concatenate unconditionally.
 */
function formatFactsForPrompt(brief) {
  if (!brief || !brief.found) return '';
  const lines = [];
  for (const field of FACTUAL_FIELDS) {
    if (!(field in brief.facts)) continue;
    const v = brief.facts[field];
    lines.push(`- ${field}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  }
  if (brief.summary) lines.push(`- summary: ${brief.summary}`);
  if (!lines.length) return '';

  return `
CONFIRMED FACTS — verified against ${brief.sources.length} live source${brief.sources.length === 1 ? '' : 's'} on ${brief.searchedAt.slice(0, 10)}.
These are the ONLY specifics you may state. Any factual field not listed here is unknown: return null or "" for it and do NOT infer a value from the product name, category, or brand.
${lines.join('\n')}
`;
}

// Brief fact -> Product field. Only hard, checkable fields are merged;
// `officialTastingNotes` and `summary` stay prompt-only because they feed
// copywriting rather than a structured column.
const PRODUCT_FIELD_MAP = {
  brand: 'brand',
  producer: 'producer',
  distilleryName: 'distilleryName',
  breweryName: 'breweryName',
  wineryName: 'wineryName',
  originCountry: 'originCountry',
  region: 'region',
  appellation: 'appellation',
  abv: 'abv',
  volumeMl: 'volumeMl',
  vintage: 'vintage',
  age: 'age',
  ageStatement: 'ageStatement',
  productionMethod: 'productionMethod',
  caskType: 'caskType',
  standardSizes: 'standardSizes',
  ingredients: 'ingredients',
  allergens: 'allergens',
};

// The empty value each field takes when nothing confirmed it. Numeric and enum
// fields blank to null, not '', to match the Product schema.
const BLANK_FOR_FIELD = {
  abv: null,
  volumeMl: null,
  vintage: null,
  age: null,
  productionMethod: null,
  standardSizes: [],
  ingredients: [],
  allergens: [],
};

// `?? ''` would be wrong here — half these blanks ARE null.
const blankFor = (field) =>
  field in BLANK_FOR_FIELD
    ? Array.isArray(BLANK_FOR_FIELD[field])
      ? []
      : BLANK_FOR_FIELD[field]
    : '';

/**
 * Make the brief authoritative over a generated product object.
 *
 * Confirmed facts overwrite whatever the fill pass produced, and every factual
 * field the brief could NOT confirm is blanked — that is the whole point. A
 * model that ignores the "return null" instruction still cannot land an
 * unsourced ABV in the catalog.
 *
 * @param {object} product   Sanitised product object (mutated and returned).
 * @param {object} brief     Result of `researchProduct`.
 * @param {object} [options]
 * @param {object} [options.enums]     Optional allow-lists, e.g.
 *                                     `{ standardSizes: [...], productionMethod: [...], allergens: [...] }`.
 * @param {string[]} [options.preserve] Product fields the admin supplied; never blanked.
 * @returns {{ data: object, unverified: string[] }}
 */
function applyBriefToProduct(product, brief, options = {}) {
  const { enums = {}, preserve = [] } = options;
  const data = product || {};
  const facts = brief?.facts || {};
  const kept = new Set(preserve);
  const unverified = [];

  for (const [factField, productField] of Object.entries(PRODUCT_FIELD_MAP)) {
    const allowed = enums[factField];

    if (factField in facts) {
      let value = facts[factField];
      if (Array.isArray(allowed)) {
        value = filterToEnum(value, allowed, factField);
        // A confirmed value we cannot represent is still not something to guess
        // at — fall through to the blanking branch below.
        if (value === undefined || (Array.isArray(value) && !value.length)) {
          if (!kept.has(productField)) {
            data[productField] = blankFor(factField);
            unverified.push(productField);
          }
          continue;
        }
      }
      data[productField] = value;
      continue;
    }

    if (kept.has(productField)) continue;
    data[productField] = blankFor(factField);
    unverified.push(productField);
  }

  // Proof is arithmetic on a verified ABV, not an independent claim.
  if (typeof data.abv === 'number' && data.abv > 0) {
    data.proof = parseFloat((data.abv * 2).toFixed(1));
  } else if ('proof' in data) {
    data.proof = null;
  }

  return { data, unverified };
}

module.exports = {
  researchProduct,
  formatFactsForPrompt,
  applyBriefToProduct,
  clearResearchCache,
  filterToEnum,
  withTimeout,
  // Exported for tests and for the controller's field mapping.
  FACTUAL_FIELDS,
  PRODUCT_FIELD_MAP,
  extractSources,
  sanitizeFacts,
  reasoningParams,
  RESEARCH_MODEL,
};
