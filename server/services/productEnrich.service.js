// services/productEnrich.service.js
// Infer catalog attributes for a NEW product from its name using Claude Haiku.
// Used by the SubProduct bulk import when a row's product does not yet exist in
// the central catalog: instead of requiring the spreadsheet to carry type/brand/
// category/descriptions, we derive them from the product name.

const Anthropic = require('@anthropic-ai/sdk');
const Product = require('../models/Product');
const Category = require('../models/Category');

// Same model the platform chatbot / scan matcher already use.
const CLAUDE_MODEL = 'claude-haiku-4-5';
const PRODUCT_TYPES = Product.schema.path('type').enumValues;

let _client;
function client() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
  return _client;
}

function str(v) {
  return v === undefined || v === null ? '' : String(v).trim();
}

/**
 * Remove size/volume/pack tokens from a product name — the size is tracked as a
 * separate variant, so it must not live in the parent product name.
 * "Jack Daniels 75cl" -> "Jack Daniels", "Coca-Cola 1.5L" -> "Coca-Cola".
 */
function stripSizeFromName(name) {
  if (!name) return name;
  let s = String(name);
  // Volume tokens: 75cl, 700 ml, 1l, 1.5 L, 50cL, 330ml, 12oz, 70 cl.
  s = s.replace(/\b\d+(?:[.,]\d+)?\s?(?:cl|ml|l|litre|liter|litres|liters|oz)\b\.?/gi, ' ');
  // Pack tokens: 6-pack, 6 pack, pack of 6, x6, 6 x, case of 12, 12pk.
  s = s.replace(/\b(?:pack of \d+|\d+\s?[-\s]?pack|\d+\s?pk|case of \d+|\d+\s?x|x\s?\d+)\b/gi, ' ');
  // Tidy leftover separators / whitespace.
  s = s.replace(/\s{2,}/g, ' ').replace(/^[\s,\-–|]+|[\s,\-–|]+$/g, '').trim();
  return s;
}

/**
 * Existing Category hierarchy as pick-lists for the model: top-level names in
 * `categories`, and children keyed by parent name in `subcategories` (so the
 * model can only ever choose real, resolvable categories — never invent one).
 * Best-effort — returns empty lists on any failure.
 */
async function getCategoryOptions(deps = {}) {
  const CategoryModel = deps.Category || Category;
  try {
    const docs = await CategoryModel.find({}).select('name parent').lean();
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    const categories = [];
    const subcategories = {};
    for (const d of docs) {
      if (!d.name) continue;
      const parent = d.parent ? byId.get(String(d.parent)) : null;
      if (parent && parent.name) {
        (subcategories[parent.name] = subcategories[parent.name] || []).push(d.name);
      } else {
        categories.push(d.name);
      }
    }
    return { categories, subcategories };
  } catch {
    return { categories: [], subcategories: {} };
  }
}

/**
 * Enrich a product from its name via Haiku.
 * @returns {Promise<{type?:string, brand?:string, category?:string, subCategory?:string, shortDescription?:string, description?:string}>}
 *   Best-effort. Returns {} when the name is empty, no API key is configured, or
 *   the call/parse fails — callers must treat every field as optional.
 */
async function enrichProductFromName(name, opts = {}, deps = {}) {
  const productName = str(name);
  if (!productName) return {};
  if (!process.env.ANTHROPIC_API_KEY && !deps.anthropic) return {};

  const anthropic = deps.anthropic || client();
  const categories = opts.categories || [];
  const subcategories = opts.subcategories || {};
  const subLines = categories
    .filter((c) => (subcategories[c] || []).length)
    .map((c) => `${c}: ${subcategories[c].join(', ')}`);

  const system =
    'You are a drinks-catalog assistant for a Nigerian beverage marketplace. ' +
    'Given a product name, infer its attributes. Respond with ONLY a single JSON object, no prose, no markdown fences.';

  const prompt =
    `Product name: "${productName}"\n\n` +
    `Pick the single best "type" from this exact list: ${PRODUCT_TYPES.join(', ')}.\n` +
    (categories.length
      ? `"category": you MUST pick the single best related match from this exact list — never invent a new one or leave it empty: ${categories.join(', ')}.\n` +
        (subLines.length
          ? `"subCategory": pick the best match from the chosen category's own subcategories below; use "" if the chosen category has none listed:\n${subLines.join('\n')}\n`
          : `"subCategory": use "".\n`)
      : '') +
    'Return JSON with keys: name, type, brand, category, subCategory, shortDescription, description.\n' +
    '- name: a clean, properly-capitalized retail product name — expand obvious abbreviations, fix casing/spacing, include brand + variant. Keep it faithful to the input; do not invent a different product. IMPORTANT: do NOT include any size/volume/pack in the name (no 75cl, 700ml, 1L, 6-pack, etc.) — size is tracked separately, so strip it out.\n' +
    '- brand: the producer/brand name, or "" if unknown.\n' +
    '- shortDescription: <= 180 chars, marketing-style one-liner.\n' +
    '- description: <= 500 chars, factual product description.\n' +
    'Do not guess a brand you are not reasonably confident about; use "" instead.';

  try {
    const res = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      system,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (res.content || []).map((c) => c.text || '').join('');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return {};
    const json = JSON.parse(text.slice(start, end + 1));

    const type = PRODUCT_TYPES.includes(json.type) ? json.type : undefined;

    // Snap category/subCategory to canonical DB names — anything the model
    // returns that isn't already in the catalog is dropped, never created.
    let category;
    let subCategory;
    if (categories.length) {
      const canon = new Map(categories.map((c) => [c.toLowerCase(), c]));
      category = canon.get(str(json.category).toLowerCase());
      if (category) {
        const subs = subcategories[category] || [];
        const subCanon = new Map(subs.map((s) => [s.toLowerCase(), s]));
        subCategory = subCanon.get(str(json.subCategory).toLowerCase());
      }
    }

    return {
      name: stripSizeFromName(str(json.name)).slice(0, 200) || undefined,
      type,
      brand: str(json.brand) || undefined,
      category,
      subCategory,
      shortDescription: str(json.shortDescription).slice(0, 280) || undefined,
      description: str(json.description).slice(0, 5000) || undefined,
    };
  } catch {
    return {};
  }
}

module.exports = { enrichProductFromName, getCategoryOptions, stripSizeFromName, CLAUDE_MODEL, PRODUCT_TYPES };
