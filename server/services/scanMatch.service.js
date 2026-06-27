// server/services/scanMatch.service.js
//
// AI-powered product extraction + catalogue matching for the Sales Scan & Match
// feature. Two extraction entry points (image via Claude Haiku vision, text via
// Claude Haiku text) produce a normalized list of candidate items; each is then
// matched against the tenant's SubProduct catalogue with a blend of regex search
// (subproduct.service.getMySubProducts) and semantic ranking (embeddings.js).
//
// Confidence tiers:
//   exact   — name + brand match, volume within 20% of the extracted size
//   partial — brand/type match, OR volume differs >20% (defaults to closest size)
//   none    — no usable match (drawer shows a "Create new product" link)
//
// Pure + DB-free where possible (vision/text calls + DB lookups via injected
// services) so the orchestration can be unit-tested without Mongo/Express.

const Anthropic = require('@anthropic-ai/sdk');

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
{"items":[{"name":"<product name as printed>","brand":"<brand if known, else null>","type":"<wine|beer|spirit|champagne|whiskey|vodka|gin|rum|tequila|cognac|liqueur|soft_drink|non_alcoholic|other>","sizeText":"<size string from label e.g. '70cl','750ml','1L', or null>","qty":<number seen, default 1>}]}
Rules:
- Read labels carefully. Prefer the exact printed name and brand.
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
{"items":[{"name":"<product name>","brand":"<brand if known, else null>","type":"<wine|beer|spirit|champagne|whiskey|vodka|gin|rum|tequila|cognac|liqueur|soft_drink|non_alcoholic|other>","sizeText":"<size string e.g. '70cl','750ml','1L', or null>","qty":<number, default 1>}]}
Rules:
- Normalize quantities ('x2', '×2', '2 bottles of X', 'X - 2') into the qty field (one entry per distinct product).
- Ignore non-product lines (headers, totals, addresses) when it's an invoice.
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
  return {
    extractedName: extracted.name,
    brand: extracted.brand || null,
    type: extracted.type || null,
    sizeText: extracted.sizeText || null,
    qty: Math.max(1, Math.round(Number(extracted.qty) || 1)),
    confidence,
    note: note || null,
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
        sellingPrice: s.sellingPrice ?? 0,
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
 * Uses subproduct.service.getMySubProducts (regex on product name/SKU) to fetch
 * candidates, then ranks them. Confidence is derived from name/brand/volume.
 *
 * @param extracted  { name, brand, type, sizeText, qty }
 * @param deps       { getSubProducts, tenantId }
 */
async function matchOne(extracted, deps) {
  const { getSubProducts, tenantId } = deps;
  const query = [extracted.name, extracted.brand].filter(Boolean).join(' ').trim();
  if (!query) return buildResult(extracted, null, [], 'none', 'No name extracted');

  let subProducts = [];
  try {
    const res = await getSubProducts(tenantId, { search: query, limit: 5 });
    subProducts = res?.subProducts || [];
  } catch (err) {
    console.error('scanMatch.matchOne getSubProducts failed:', err.message);
  }

  if (subProducts.length === 0) {
    return buildResult(extracted, null, [], 'none', 'Not found in catalogue');
  }

  // Rank: exact name match first, then brand match, then first result.
  const nameLower = extracted.name.toLowerCase();
  const brandLower = (extracted.brand || '').toLowerCase();
  let best = subProducts[0];
  let bestScore = 0;
  for (const sp of subProducts) {
    const pName = (sp.product?.name || sp.name || '').toLowerCase();
    let score = 0;
    if (pName === nameLower) score += 50;
    else if (pName.includes(nameLower) || nameLower.includes(pName)) score += 35;
    const pBrand = (sp.product?.brand?.name || '').toLowerCase();
    if (brandLower && pBrand === brandLower) score += 20;
    else if (brandLower && pBrand.includes(brandLower)) score += 10;
    if (score > bestScore) {
      bestScore = score;
      best = sp;
    }
  }
  const matchedProduct = best.product || { _id: best.productId, name: best.name };

  // Volume comparison for exact vs partial.
  const targetMl = sizeTextToMl(extracted.sizeText);
  let confidence = 'partial';
  let note = 'Closest match';
  if (bestScore >= 50) {
    // Strong name match — check volume.
    if (targetMl) {
      const catMls = (best.sizes || [])
        .map((s) => s.volumeMl ?? sizeTextToMl(s.displayName) ?? sizeTextToMl(s.size))
        .filter((m) => m != null);
      if (catMls.length) {
        const closest = catMls.reduce((a, b) =>
          Math.abs(b - targetMl) < Math.abs(a - targetMl) ? b : a
        );
        const diffPct = Math.abs(closest - targetMl) / Math.max(1, targetMl);
        if (diffPct <= 0.2) {
          confidence = 'exact';
          note = null;
        } else {
          confidence = 'partial';
          note = `Volume differs (extracted ${extracted.sizeText}, closest ${closest}ml) — using closest size`;
        }
      } else {
        confidence = 'exact';
        note = null;
      }
    } else {
      confidence = 'exact';
      note = null;
    }
  } else if (bestScore >= 20) {
    confidence = 'partial';
    note = 'Brand/type match';
  } else {
    confidence = 'partial';
    note = 'Weak match — verify';
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

module.exports = {
  extractItemsFromImage,
  extractItemsFromText,
  extractAndMatch,
  matchOne,
  sizeTextToMl,
};