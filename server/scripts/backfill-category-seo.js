/**
 * Backfill missing category copy + SEO meta with claude-haiku-4-5.
 *
 * The /categories/[slug] pages fall back to generic copy when a category has
 * no description/metaTitle/metaDescription — thin pages that won't rank. This
 * fills ONLY the missing copy fields on each category; existing values are
 * never overwritten, and type / alcoholCategory / color / icon are never
 * touched (those stay admin-curated via the ai-fill form).
 *
 * Fields filled when empty: tagline, shortDescription, description (HTML
 * <p> paragraphs, same format the admin ai-fill produces), metaTitle,
 * metaDescription, metaKeywords.
 *
 * Usage:
 *   node scripts/backfill-category-seo.js [--dry-run] [--limit=N] [--delay=ms]
 *
 *   --dry-run   show what would be filled, no writes, no AI calls beyond
 *               the first category (printed as a sample)
 *   --limit=N   process at most N categories (default: all)
 *   --delay=ms  pause between AI calls (default 800)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const Anthropic = require('@anthropic-ai/sdk');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Product = require('../models/Product');

const MODEL = 'claude-haiku-4-5';
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity;
const DELAY_MS = Number((process.argv.find((a) => a.startsWith('--delay=')) || '').split('=')[1]) || 800;

// Copy fields we own here, with clamp lengths matching the Category schema
// maxlengths (description is 2000 in the model; the prompt asks for 1800).
const FIELDS = {
  tagline: 150,
  shortDescription: 280,
  description: 2000,
  metaTitle: 100,
  metaDescription: 320,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, max) => (v === undefined || v === null ? '' : String(v).trim().slice(0, max));

// Strip <a> tags whose href isn't in the approved set, keeping the anchor text
// (prevents 404s from hallucinated slugs). Mirrors the ai-fill endpoint.
function stripUnapprovedLinks(html, allowed) {
  return String(html || '').replace(
    /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (match, href, text) => (allowed.has(href) ? match : text)
  );
}

// Internal-link catalog: detail pages only (/categories/cat/sub, /product,
// /brands) — the self-canonical SEO pages that benefit from link equity.
function linksBlock({ subs, products, brands, categorySlug }) {
  if (!subs.length && !products.length) return '';
  const subLines = subs.map((s) => `- "${s.name}" → /categories/${categorySlug}/${s.slug}`).join('\n');
  const productLines = products.map((p) => `- "${p.name}" → /product/${p.slug}`).join('\n');
  const brandLines = [...brands.entries()].map(([slug, name]) => `- "${name}" → /brands/${slug}`).join('\n');
  return `

INTERNAL LINKING: inside the description HTML, weave 3-6 contextual internal links as <a href="/path">natural anchor words</a>. Rules:
- Use ONLY links from the approved catalog below. NEVER invent a URL or slug.
- The anchor must be natural words inside a sentence, never the raw slug.
- Link each target at most once. Prefer subcategory pages, then standout products, then brands.${subLines ? `\n\nApproved subcategory links:\n${subLines}` : ''}${productLines ? `\n\nApproved product links:\n${productLines}` : ''}${brandLines ? `\n\nApproved brand links:\n${brandLines}` : ''}`;
}

function missingFields(category) {
  const missing = Object.keys(FIELDS).filter((f) => !String(category[f] || '').trim());
  if (!Array.isArray(category.metaKeywords) || category.metaKeywords.length === 0) {
    missing.push('metaKeywords');
  }
  return missing;
}

function buildPrompt(category, missing, productNames, links) {
  const known = [
    `Name: "${category.name}"`,
    category.type && `Type: ${String(category.type).replace(/_/g, ' ')}`,
    category.subType && `Sub-type: ${category.subType}`,
    category.alcoholCategory && `Alcohol category: ${String(category.alcoholCategory).replace(/_/g, ' ')}`,
    category.productCount > 0 && `Products in catalog: ${category.productCount}`,
    productNames.length && `Products we stock: ${productNames.join('; ')}`,
  ]
    .filter(Boolean)
    .join('\n- ');

  const specs = {
    tagline: '"short punchy tagline that sells the category (max 150 chars)"',
    shortDescription: '"2 compelling sentences for listings and cards (max 280 chars)"',
    description:
      '"3-4 compelling, informative paragraphs about the category — what it is, styles, how it is enjoyed, why buy it here — formatted as HTML using <p> tags (plus inline <a> internal links per the linking rules below, if a catalog is provided) (max 1800 chars including tags)"',
    metaTitle: '"SEO page title targeting buyers in Nigeria, e.g. category + buy online Nigeria (max 100 chars)"',
    metaDescription: '"SEO meta description for the category page, Nigeria market (max 320 chars)"',
    metaKeywords: '"8-12 comma-separated search keywords relevant to this category in Nigeria"',
  };

  const keys = missing.map((f) => `  "${f}": ${specs[f]}`).join(',\n');

  return `Generate category page content for DrinksHarbour (Nigeria's premium online drinks store).

Known facts about the category:
- ${known}

Use your real knowledge of this drinks category. Where a fact is genuinely unknown, write plausible professional copy without inventing specific claims (no fake awards, dates or figures).

Return a JSON object with exactly these keys:
{
${keys}
}${links || ''}`;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not configured');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Most-stocked categories first — they get the most page traffic.
  const categories = await Category.find({}).sort({ productCount: -1, name: 1 }).lean();
  const todo = categories.filter((c) => missingFields(c).length > 0).slice(0, LIMIT);

  console.log(`${categories.length} categories total, ${todo.length} need backfill${DRY_RUN ? ' (dry run)' : ''}`);

  let filled = 0;
  let failed = 0;

  for (const [i, category] of todo.entries()) {
    const missing = missingFields(category);

    if (DRY_RUN && i > 0) {
      console.log(`[dry] ${category.name}: would fill ${missing.join(', ')}`);
      continue;
    }

    const products = (
      await Product.find({ category: category._id, status: 'approved', isPublished: true })
        .select('name slug brand')
        .sort({ createdAt: -1 })
        .limit(12)
        .populate('brand', 'name slug')
        .lean()
    ).filter((p) => p.name && p.slug);
    const productNames = products.slice(0, 8).map((p) => p.name);
    const subs = await SubCategory.find({ parent: category._id, status: 'published' })
      .select('name slug')
      .sort({ productCount: -1, name: 1 })
      .limit(10)
      .lean();
    const brands = new Map();
    products.forEach((p) => {
      if (p.brand?.slug && !brands.has(p.brand.slug)) brands.set(p.brand.slug, p.brand.name);
    });
    const allowed = new Set([
      ...products.map((p) => `/product/${p.slug}`),
      ...[...brands.keys()].map((slug) => `/brands/${slug}`),
      ...subs.map((s) => `/categories/${category.slug}/${s.slug}`),
    ]);
    const links = linksBlock({ subs, products, brands, categorySlug: category.slug });

    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system:
          "You are a content assistant for DrinksHarbour, Nigeria's premier online premium beverages store. " +
          "You know the world's drinks categories well. Respond with ONLY a single valid JSON object — no prose, no markdown fences.",
        messages: [{ role: 'user', content: buildPrompt(category, missing, productNames, links) }],
      });

      const raw = (response.content || []).map((c) => c.text || '').join('');
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('no JSON in response');
      const json = JSON.parse(raw.slice(start, end + 1));

      const $set = {};
      for (const f of missing) {
        if (f === 'metaKeywords') {
          const kw = clamp(json.metaKeywords, 500)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 12);
          if (kw.length) $set.metaKeywords = kw;
        } else {
          const raw = f === 'description' ? stripUnapprovedLinks(json[f], allowed) : json[f];
          const v = clamp(raw, FIELDS[f]);
          if (v) $set[f] = v;
        }
      }

      if (Object.keys($set).length === 0) throw new Error('AI returned no usable fields');

      if (DRY_RUN) {
        console.log(`[dry sample] ${category.name}:`);
        for (const [k, v] of Object.entries($set)) {
          console.log(`  ${k}: ${String(v).slice(0, 100)}${String(v).length > 100 ? '…' : ''}`);
        }
      } else {
        await Category.updateOne({ _id: category._id }, { $set });
        filled++;
        console.log(`[${i + 1}/${todo.length}] ${category.name}: filled ${Object.keys($set).join(', ')}`);
      }
    } catch (err) {
      failed++;
      console.error(`[${i + 1}/${todo.length}] ${category.name}: FAILED — ${err.message}`);
    }

    if (i < todo.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nDone. ${filled} categories updated, ${failed} failed, ${todo.length} examined.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
