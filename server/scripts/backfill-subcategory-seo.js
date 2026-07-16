/**
 * Backfill missing subcategory copy + SEO meta with claude-haiku-4-5.
 *
 * The /categories/[slug]/[subSlug] pages fall back to generic copy when a
 * subcategory has no description/metaTitle/metaDescription — thin pages that
 * won't rank. This fills ONLY the missing copy fields on each subcategory;
 * existing values are never overwritten, and type / style / color / icon are
 * never touched (those stay admin-curated via the ai-fill form).
 *
 * Fields filled when empty: tagline, shortDescription, description (HTML
 * <p> paragraphs, same format the admin ai-fill produces), metaTitle,
 * metaDescription, metaKeywords.
 *
 * Usage:
 *   node scripts/backfill-subcategory-seo.js [--dry-run] [--limit=N] [--delay=ms]
 *
 *   --dry-run   show what would be filled, no writes, no AI calls beyond
 *               the first subcategory (printed as a sample)
 *   --limit=N   process at most N subcategories (default: all)
 *   --delay=ms  pause between AI calls (default 800)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const Anthropic = require('@anthropic-ai/sdk');
const SubCategory = require('../models/SubCategory');
const Category = require('../models/Category'); // registers ref for populate
const Brand = require('../models/Brand'); // registers ref for populate
const Product = require('../models/Product');

const MODEL = 'claude-haiku-4-5';
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity;
const DELAY_MS = Number((process.argv.find((a) => a.startsWith('--delay=')) || '').split('=')[1]) || 800;

// Copy fields we own here, with clamp lengths matching the SubCategory schema
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

// Internal-link catalog: detail pages only (/product, parent /categories/cat,
// sibling /categories/cat/sub, /brands) — the self-canonical SEO pages.
function linksBlock({ products, siblings, brands, parentSlug, parentName }) {
  if (!products.length && !siblings.length && !parentSlug) return '';
  const parentLine = parentSlug ? `- "${parentName}" (parent category) → /categories/${parentSlug}` : '';
  const siblingLines = siblings.map((s) => `- "${s.name}" → /categories/${parentSlug}/${s.slug}`).join('\n');
  const productLines = products.map((p) => `- "${p.name}" → /product/${p.slug}`).join('\n');
  const brandLines = [...brands.entries()].map(([slug, n]) => `- "${n}" → /brands/${slug}`).join('\n');
  return `

INTERNAL LINKING: inside the description HTML, weave 3-6 contextual internal links as <a href="/path">natural anchor words</a>. Rules:
- Use ONLY links from the approved catalog below. NEVER invent a URL or slug.
- The anchor must be natural words inside a sentence, never the raw slug.
- Link each target at most once. Prefer standout products, then the parent category and sibling styles, then brands.${parentLine ? `\n\nApproved category links:\n${parentLine}` : ''}${siblingLines ? `\n\nApproved sibling style links:\n${siblingLines}` : ''}${productLines ? `\n\nApproved product links:\n${productLines}` : ''}${brandLines ? `\n\nApproved brand links:\n${brandLines}` : ''}`;
}

function missingFields(sub) {
  const missing = Object.keys(FIELDS).filter((f) => !String(sub[f] || '').trim());
  if (!Array.isArray(sub.metaKeywords) || sub.metaKeywords.length === 0) {
    missing.push('metaKeywords');
  }
  return missing;
}

function buildPrompt(sub, missing, productNames, links) {
  const known = [
    `Name: "${sub.name}"`,
    sub.parent?.name && `Parent category: ${sub.parent.name}`,
    sub.type && `Type: ${String(sub.type).replace(/_/g, ' ')}`,
    sub.subType && `Sub-type: ${sub.subType}`,
    sub.style && `Style: ${String(sub.style).replace(/_/g, ' ')}`,
    sub.productCount > 0 && `Products in catalog: ${sub.productCount}`,
    productNames.length && `Products we stock: ${productNames.join('; ')}`,
  ]
    .filter(Boolean)
    .join('\n- ');

  const specs = {
    tagline: '"short punchy tagline that sells the subcategory (max 150 chars)"',
    shortDescription: '"2 compelling sentences for listings and cards (max 280 chars)"',
    description:
      '"3-4 compelling, informative paragraphs about the subcategory — what defines the style, how it differs within its parent category, how it is enjoyed, why buy it here — formatted as HTML using <p> tags (plus inline <a> internal links per the linking rules below, if a catalog is provided) (max 1800 chars including tags)"',
    metaTitle: '"SEO page title targeting buyers in Nigeria, e.g. subcategory + buy online Nigeria (max 100 chars)"',
    metaDescription: '"SEO meta description for the subcategory page, Nigeria market (max 320 chars)"',
    metaKeywords: '"8-12 comma-separated search keywords relevant to this subcategory in Nigeria"',
  };

  const keys = missing.map((f) => `  "${f}": ${specs[f]}`).join(',\n');

  return `Generate subcategory page content for DrinksHarbour (Nigeria's premium online drinks store).

Known facts about the subcategory:
- ${known}

Use your real knowledge of this drinks style. Where a fact is genuinely unknown, write plausible professional copy without inventing specific claims (no fake awards, dates or figures).

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

  // Most-stocked subcategories first — they get the most page traffic.
  const subs = await SubCategory.find({})
    .populate('parent', 'name slug')
    .sort({ productCount: -1, name: 1 })
    .lean();
  const todo = subs.filter((s) => missingFields(s).length > 0).slice(0, LIMIT);

  console.log(`${subs.length} subcategories total, ${todo.length} need backfill${DRY_RUN ? ' (dry run)' : ''}`);

  let filled = 0;
  let failed = 0;

  for (const [i, sub] of todo.entries()) {
    const missing = missingFields(sub);

    if (DRY_RUN && i > 0) {
      console.log(`[dry] ${sub.name}: would fill ${missing.join(', ')}`);
      continue;
    }

    const products = (
      await Product.find({ subCategory: sub._id, status: 'approved', isPublished: true })
        .select('name slug brand')
        .sort({ createdAt: -1 })
        .limit(12)
        .populate('brand', 'name slug')
        .lean()
    ).filter((p) => p.name && p.slug);
    const productNames = products.slice(0, 8).map((p) => p.name);
    const parentSlug = sub.parent?.slug || '';
    const siblings = sub.parent?._id
      ? await SubCategory.find({ parent: sub.parent._id, status: 'published', _id: { $ne: sub._id } })
          .select('name slug')
          .sort({ productCount: -1, name: 1 })
          .limit(8)
          .lean()
      : [];
    const brands = new Map();
    products.forEach((p) => {
      if (p.brand?.slug && !brands.has(p.brand.slug)) brands.set(p.brand.slug, p.brand.name);
    });
    const allowed = new Set([
      ...products.map((p) => `/product/${p.slug}`),
      ...[...brands.keys()].map((slug) => `/brands/${slug}`),
      ...(parentSlug ? [`/categories/${parentSlug}`] : []),
      ...(parentSlug ? siblings.map((s) => `/categories/${parentSlug}/${s.slug}`) : []),
    ]);
    const links = linksBlock({ products, siblings, brands, parentSlug, parentName: sub.parent?.name || '' });

    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system:
          "You are a content assistant for DrinksHarbour, Nigeria's premier online premium beverages store. " +
          "You know the world's drinks styles well. Respond with ONLY a single valid JSON object — no prose, no markdown fences.",
        messages: [{ role: 'user', content: buildPrompt(sub, missing, productNames, links) }],
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
        console.log(`[dry sample] ${sub.name}:`);
        for (const [k, v] of Object.entries($set)) {
          console.log(`  ${k}: ${String(v).slice(0, 100)}${String(v).length > 100 ? '…' : ''}`);
        }
      } else {
        await SubCategory.updateOne({ _id: sub._id }, { $set });
        filled++;
        console.log(`[${i + 1}/${todo.length}] ${sub.name}: filled ${Object.keys($set).join(', ')}`);
      }
    } catch (err) {
      failed++;
      console.error(`[${i + 1}/${todo.length}] ${sub.name}: FAILED — ${err.message}`);
    }

    if (i < todo.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nDone. ${filled} subcategories updated, ${failed} failed, ${todo.length} examined.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
