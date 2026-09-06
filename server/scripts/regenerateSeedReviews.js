#!/usr/bin/env node
// scripts/regenerateSeedReviews.js
//
// Rewrite the copy on EXISTING seeded reviews in place, without touching the
// orders they hang off.
//
// Why this exists: the first review bank had 8 families and ~26 comments, all
// tier-blind. Across 210 reviews that produced only 10 distinct titles (each
// repeating ~20x) and put 5-star wording under 3-star scores. The orders behind
// those reviews are fine — only the text needs replacing — so re-running the
// whole seeder would be wasteful and would churn order numbers.
//
// Only touches documents matching `seedSource: 'seed-script'` and refuses any
// database whose name does not end in `_seed`.
//
// Usage:
//   node -r dotenv/config scripts/regenerateSeedReviews.js [--dry-run] [--reroll-ratings]

'use strict';

const mongoose = require('mongoose');
const { pickReview, copyStats } = require('./data/review-templates');
const { parseArgv, get, bool } = require('./lib/flags');
const { SEED_MARKER } = require('./lib/backdate');

async function main() {
  const args = parseArgv(process.argv.slice(2));
  const dryRun = bool(get(args, 'dry-run'));
  // Ratings were drawn before the copy bank was tier-aware. Leave them alone by
  // default so the star distribution the operator already reviewed is stable.
  const rerollRatings = bool(get(args, 'reroll-ratings'));

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  const conn = await mongoose.createConnection(uri).asPromise();
  const dbName = conn.db.databaseName;
  if (!/_seed$/.test(dbName)) {
    console.error(`✋ Refusing to modify "${dbName}" — name must end in "_seed".`);
    await conn.close();
    process.exit(1);
  }

  const reviews = conn.db.collection('reviews');
  const products = conn.db.collection('products');

  const all = await reviews.find({ seedSource: SEED_MARKER }).toArray();
  if (all.length === 0) {
    console.log('No seeded reviews found. Nothing to do.');
    await conn.close();
    return;
  }

  // Pull type + subType for every reviewed product in one round trip.
  const ids = [...new Set(all.map((r) => String(r.product)))]
    .map((id) => new mongoose.Types.ObjectId(id));
  const prodDocs = await products
    .find({ _id: { $in: ids } })
    .project({ type: 1, subType: 1, name: 1 })
    .toArray();
  const prodMap = new Map(prodDocs.map((p) => [String(p._id), p]));

  const stats = copyStats();
  console.log(`▶ Regenerating review copy in "${dbName}"`);
  console.log(`   reviews       : ${all.length}`);
  console.log(`   copy bank     : ${stats.families} families, ` +
              `${stats.distinctTitles} titles, ${stats.distinctComments} comments`);
  console.log(`   reroll ratings: ${rerollRatings ? 'yes' : 'no (keeping existing stars)'}`);
  console.log(`   dry run       : ${dryRun ? 'yes' : 'no'}`);
  console.log('');

  const seenTitles = new Set();
  const seenComments = new Set();
  const byFamily = {};
  let updated = 0;

  for (const rv of all) {
    const prod = prodMap.get(String(rv.product));
    const rating = rerollRatings ? (3 + Math.floor(Math.random() * 3)) : rv.rating;

    const picked = pickReview({
      type: prod?.type,
      subType: prod?.subType,
      rating,
    });

    seenTitles.add(picked.title);
    seenComments.add(picked.comment);
    byFamily[picked.family] = (byFamily[picked.family] || 0) + 1;

    if (!dryRun) {
      const set = { title: picked.title, comment: picked.comment };
      if (rerollRatings) set.rating = rating;
      await reviews.updateOne({ _id: rv._id }, { $set: set });
    }
    updated += 1;
  }

  console.log(`   ✓ ${updated} review(s) ${dryRun ? 'would be' : ''} rewritten`);
  console.log('');
  console.log(`   distinct titles   : ${seenTitles.size}`);
  console.log(`   distinct comments : ${seenComments.size}`);
  console.log('');
  console.log('   copy families used:');
  for (const [f, n] of Object.entries(byFamily).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${f.padEnd(16)} ${n}`);
  }

  await conn.close();
}

main().catch((err) => {
  console.error('💥', err.message);
  process.exit(1);
});
