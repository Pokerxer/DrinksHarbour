/**
 * Backfill Product.category for products that have no category reference.
 *
 * Most of the imported catalog (481/501 published products as of 2026-07-13)
 * has category: null, so every /shop?category=… filter returns almost nothing.
 * This script classifies each uncategorized product into one of the published
 * top-level Category documents (fetched from the DB — nothing hardcoded) using
 * claude-haiku, then writes the ObjectId reference and refreshes per-category
 * productCount.
 *
 * Usage:
 *   node scripts/backfill-product-categories.js --dry   # classify + print, no writes
 *   node scripts/backfill-product-categories.js         # classify + write
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Anthropic = require('@anthropic-ai/sdk');

const Product = require('../models/Product');
const Category = require('../models/Category');
require('../models/Brand');

const DRY_RUN = process.argv.includes('--dry');
const BATCH_SIZE = 40;
const HAIKU_MODEL = process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

async function classifyBatch(products, categories) {
  const catalog = categories.map(c => `${c.slug} (${c.type})`).join(', ');
  const lines = products.map((p, i) => {
    const bits = [p.name];
    if (p.brand?.name) bits.push(`brand: ${p.brand.name}`);
    if (p.type) bits.push(`imported type: ${p.type}`);
    if (p.subType) bits.push(`subtype: ${p.subType}`);
    return `${i}. ${bits.join(' | ')}`;
  }).join('\n');

  const prompt = `You are classifying drinks for an online store in Nigeria.

Available category slugs (with their type): ${catalog}

Classify each product below into exactly one category slug from the list.
Rules:
- Single malt / blended Scotch whisky distilleries (Macallan, Ardbeg, Kilchoman, Benriach, Glenallachie, Aultmore, Royal Brackla, Bruichladdich, Ballantines, Johnnie Walker, etc.) → "scotch"
- Non-Scotch world whiskies (Japanese, Taiwanese, Indian, Irish, e.g. Akashi, Kavalan, Armorik) → "whiskey"; American bourbon → "bourbon"; rye → "rye-whiskey"
- Champagne houses (Ruinart, Moët, Veuve Clicquot, Dom Pérignon, Krug) → "champagne"
- Cognac/Armagnac → "brandy"
- "Wine cask / sherry cask / port cask finish" in a whisky name does NOT make it wine.
- If genuinely unsure, use the closest match; never invent a slug.

Products:
${lines}

Reply with ONLY a JSON array: [{"i": <index>, "slug": "<category-slug>"}] — one entry per product, no other text.`;

  const message = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content?.[0]?.text ?? '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error(`No JSON array in model reply: ${text.slice(0, 200)}`);
  return JSON.parse(jsonMatch[0]);
}

async function main() {
  if (!anthropic) {
    console.error('ANTHROPIC_API_KEY not set — cannot classify.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected. ${DRY_RUN ? 'DRY RUN — no writes.' : 'LIVE RUN.'}`);

  // Top-level published categories straight from the DB — the classification
  // target list is whatever the catalog actually contains.
  const categories = await Category.find({ parent: null, status: 'published' })
    .select('slug name type').lean();
  const bySlug = new Map(categories.map(c => [c.slug, c]));
  console.log(`Loaded ${categories.length} published top-level categories from DB.`);

  const orphans = await Product.find({ category: null })
    .select('name type subType brand')
    .populate('brand', 'name')
    .lean();
  console.log(`Found ${orphans.length} products without a category.`);
  if (!orphans.length) { await mongoose.disconnect(); return; }

  const assignments = []; // { productId, name, slug }
  const failures = [];

  for (let start = 0; start < orphans.length; start += BATCH_SIZE) {
    const batch = orphans.slice(start, start + BATCH_SIZE);
    process.stdout.write(`Classifying ${start + 1}-${start + batch.length}/${orphans.length}… `);
    try {
      const results = await classifyBatch(batch, categories);
      let ok = 0;
      for (const r of results) {
        const product = batch[r.i];
        const cat = bySlug.get(r.slug);
        if (!product) continue;
        if (!cat) {
          failures.push({ name: product.name, reason: `unknown slug "${r.slug}"` });
          continue;
        }
        assignments.push({ productId: product._id, name: product.name, slug: r.slug, categoryId: cat._id });
        ok++;
      }
      console.log(`${ok}/${batch.length} classified`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      batch.forEach(p => failures.push({ name: p.name, reason: err.message }));
    }
  }

  // Distribution report
  const dist = {};
  for (const a of assignments) dist[a.slug] = (dist[a.slug] || 0) + 1;
  console.log('\nAssignment distribution:');
  Object.entries(dist).sort((a, b) => b[1] - a[1]).forEach(([slug, n]) => console.log(`  ${slug}: ${n}`));
  if (failures.length) {
    console.log(`\n${failures.length} products NOT classified:`);
    failures.slice(0, 20).forEach(f => console.log(`  - ${f.name}: ${f.reason}`));
  }

  if (DRY_RUN) {
    console.log('\nSample assignments:');
    assignments.slice(0, 30).forEach(a => console.log(`  ${a.name} → ${a.slug}`));
    await mongoose.disconnect();
    return;
  }

  // Write category references
  if (assignments.length) {
    const ops = assignments.map(a => ({
      updateOne: { filter: { _id: a.productId, category: null }, update: { $set: { category: a.categoryId } } },
    }));
    const res = await Product.bulkWrite(ops, { ordered: false });
    console.log(`\nUpdated ${res.modifiedCount} products.`);
  }

  // Refresh per-category product counts from actual data
  const counts = await Product.aggregate([
    { $match: { category: { $ne: null } } },
    { $group: { _id: '$category', total: { $sum: 1 } } },
  ]);
  const countOps = counts.map(c => ({
    updateOne: { filter: { _id: c._id }, update: { $set: { productCount: c.total } } },
  }));
  if (countOps.length) {
    await Category.bulkWrite(countOps, { ordered: false });
    console.log(`Refreshed productCount on ${countOps.length} categories.`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
