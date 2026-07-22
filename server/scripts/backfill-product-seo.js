/**
 * Backfill missing product SEO meta with claude-haiku-4-5.
 *
 * The /product/[slug] pages fall back to the raw product name for their
 * title/H1 and have no meta description when a product has no
 * metaTitle/seoH1/metaDescription/metaKeywords — thin pages that won't rank.
 * This fills ONLY the missing SEO fields on each product; existing values are
 * never overwritten, and no other product fields are ever touched.
 *
 * Fields filled when empty: metaTitle (≤45), seoH1 (≤70, name + beverage
 * type), metaDescription (≤160, ends with a Nigeria delivery hook),
 * metaKeywords (10-12, ≥3 city/purchase-intent terms). These mirror the caps
 * and the prompt used by generateSeo in controllers/gemini.controller.js.
 *
 * Usage:
 *   node scripts/backfill-product-seo.js [--dry-run] [--limit=N] [--delay=ms]
 *
 *   --dry-run   show what would be filled, no writes, no AI calls beyond
 *               the first product (printed as a sample)
 *   --limit=N   process at most N products (default: all)
 *   --delay=ms  pause between AI calls (default 800)
 *
 * NOTE: run from a permitted host — Atlas blocks the local dev IP.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const Anthropic = require('@anthropic-ai/sdk');
const Product = require('../models/Product');
const Brand = require('../models/Brand');

const MODEL = 'claude-haiku-4-5';
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity;
const DELAY_MS = Number((process.argv.find((a) => a.startsWith('--delay=')) || '').split('=')[1]) || 800;

// SEO fields we own here, with caps matching generateSeo in gemini.controller.js.
const CAPS = {
  metaTitle: 45,
  seoH1: 70,
  metaDescription: 160,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, max) => (v === undefined || v === null ? '' : String(v).trim().slice(0, max));

function missingFields(product) {
  const missing = Object.keys(CAPS).filter((f) => !String(product[f] || '').trim());
  if (!Array.isArray(product.metaKeywords) || product.metaKeywords.length === 0) {
    missing.push('metaKeywords');
  }
  return missing;
}

function buildPrompt(product, missing, brandName) {
  const name = product.name;
  const type = product.type ? String(product.type).replace(/_/g, ' ') : '';
  const shortDescription = String(product.shortDescription || '').trim();

  const specs = {
    metaTitle:
      '"SEO title, max 45 characters — include product name and type; do NOT add \\"Nigeria\\" (wastes chars). We append \\" | DrinksHarbour\\" ourselves, so keep it under 45."',
    seoH1:
      '"on-page H1 headline, max 70 characters — include the product name AND its beverage type (e.g. \\"Glenfiddich 40 Year Old Single Malt Scotch\\"). Natural, no \\"Buy\\"/price/\\"Nigeria\\" filler."',
    metaDescription:
      '"SEO meta description, max 160 characters — must end with a local hook, e.g. \\"Available for delivery across Nigeria on DrinksHarbour.\\" or \\"Order online — delivered to Lagos, Abuja & across Nigeria.\\""',
    metaKeywords:
      '"10-12 relevant keywords (lowercase, no duplicates) — MUST include at least 3 Nigeria/city-specific purchase-intent terms such as \\"{type} Nigeria\\", \\"buy {type} Lagos\\", \\"buy {type} Abuja\\", \\"{brand} price Nigeria\\", \\"alcohol delivery Nigeria\\"."',
  };

  const keys = missing
    .map((f) => `  "${f}": ${f === 'metaKeywords' ? '[' + specs[f] + ']' : specs[f]}`)
    .join(',\n');

  return `You are an SEO expert for DrinksHarbour, a premium beverages e-commerce platform based in Abuja, Nigeria that delivers nationwide across Nigeria (Lagos, Abuja, Port Harcourt, etc.).

Generate SEO content for "${name}"${brandName ? ` by ${brandName}` : ''}${type ? `, a ${type}` : ''}.
${shortDescription ? `Product description: ${shortDescription}` : ''}

Use your real knowledge of this product where you have it. Do NOT invent specifics you cannot be sure of — no fabricated ABV, awards, ages, vintages or origin claims.

Return a JSON object with exactly these keys:
{
${keys}
}`;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not configured');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Newest products first — they are the least likely to already have meta.
  const products = await Product.find({})
    .select('name type shortDescription brand metaTitle seoH1 metaDescription metaKeywords')
    .populate('brand', 'name')
    .sort({ createdAt: -1 })
    .lean();
  const todo = products.filter((p) => missingFields(p).length > 0).slice(0, LIMIT);

  console.log(`${products.length} products total, ${todo.length} need backfill${DRY_RUN ? ' (dry run)' : ''}`);

  let filled = 0;
  let failed = 0;

  for (const [i, product] of todo.entries()) {
    const missing = missingFields(product);
    const brandName = product.brand && product.brand.name ? product.brand.name : '';

    if (DRY_RUN && i > 0) {
      console.log(`[dry] ${product.name}: would fill ${missing.join(', ')}`);
      continue;
    }

    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system:
          "You are an SEO content assistant for DrinksHarbour, Nigeria's premier online premium beverages store. " +
          'Respond with ONLY a single valid JSON object — no prose, no markdown fences.',
        messages: [{ role: 'user', content: buildPrompt(product, missing, brandName) }],
      });

      const raw = (response.content || []).map((c) => c.text || '').join('');
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('no JSON in response');
      const json = JSON.parse(raw.slice(start, end + 1));

      const $set = {};
      for (const f of missing) {
        if (f === 'metaKeywords') {
          const src = Array.isArray(json.metaKeywords)
            ? json.metaKeywords
            : String(json.metaKeywords || '').split(',');
          const seen = new Set();
          const kw = src
            .map((s) => String(s).trim().toLowerCase())
            .filter((s) => {
              if (!s || seen.has(s)) return false;
              seen.add(s);
              return true;
            })
            .slice(0, 12);
          if (kw.length) $set.metaKeywords = kw;
        } else {
          const v = clamp(json[f], CAPS[f]);
          if (v) $set[f] = v;
        }
      }

      if (Object.keys($set).length === 0) throw new Error('AI returned no usable fields');

      if (DRY_RUN) {
        console.log(`[dry sample] ${product.name}:`);
        for (const [k, v] of Object.entries($set)) {
          console.log(`  ${k}: ${String(v).slice(0, 100)}${String(v).length > 100 ? '…' : ''}`);
        }
      } else {
        await Product.updateOne({ _id: product._id }, { $set });
        filled++;
        console.log(`[${i + 1}/${todo.length}] ${product.name}: filled ${Object.keys($set).join(', ')}`);
      }
    } catch (err) {
      failed++;
      console.error(`[${i + 1}/${todo.length}] ${product.name}: FAILED — ${err.message}`);
    }

    if (i < todo.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nDone. ${filled} products updated, ${failed} failed, ${todo.length} examined.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
