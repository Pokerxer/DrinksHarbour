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
 * Distinct existing Category names (so the model picks real categories that
 * createSubProductCore can resolve by name rather than inventing new ones).
 * Best-effort — returns [] on any failure.
 */
async function getCategoryNames(deps = {}) {
  const CategoryModel = deps.Category || Category;
  try {
    const docs = await CategoryModel.find({}).select('name').lean();
    return docs.map((c) => c.name).filter(Boolean);
  } catch {
    return [];
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

  const system =
    'You are a drinks-catalog assistant for a Nigerian beverage marketplace. ' +
    'Given a product name, infer its attributes. Respond with ONLY a single JSON object, no prose, no markdown fences.';

  const prompt =
    `Product name: "${productName}"\n\n` +
    `Pick the single best "type" from this exact list: ${PRODUCT_TYPES.join(', ')}.\n` +
    (categories.length
      ? `Pick "category" and "subCategory" ONLY from this list (use "" if none fits): ${categories.join(', ')}.\n`
      : '') +
    'Return JSON with keys: type, brand, category, subCategory, shortDescription, description.\n' +
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
    return {
      type,
      brand: str(json.brand) || undefined,
      category: str(json.category) || undefined,
      subCategory: str(json.subCategory) || undefined,
      shortDescription: str(json.shortDescription).slice(0, 280) || undefined,
      description: str(json.description).slice(0, 5000) || undefined,
    };
  } catch {
    return {};
  }
}

module.exports = { enrichProductFromName, getCategoryNames, CLAUDE_MODEL, PRODUCT_TYPES };
