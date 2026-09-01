#!/usr/bin/env node
// server/scripts/backfill-pricelist-priority.js
//
// Re-rank every pricelist's rules under the automatic priority model
// (services/pricelistPriority.service), reporting the CHARGED-PRICE effect
// before writing anything.
//
// Rule `sequence` decides the order the pricing engines stack rules in, so a
// re-rank can move real money. This script therefore prices every affected
// product through the real engine (findMatchingPriceRules → applyPriceRules)
// both before and after, and prints every line whose price moves.
//
//   node scripts/backfill-pricelist-priority.js            # dry run (default)
//   node scripts/backfill-pricelist-priority.js --write    # persist
//   node scripts/backfill-pricelist-priority.js --write --allow-price-moves
//
// Without --allow-price-moves, a run that would change any charged price
// refuses to write. Silent repricing is the exact failure this module has been
// fixing all along; making it opt-in keeps it visible.
require('dotenv').config();
const mongoose = require('mongoose');

const Pricelist = require('../models/Pricelist');
const SubProduct = require('../models/SubProduct');
require('../models/Product'); // register before any .populate('product')
const { rankedRules } = require('../services/pricelistPriority.service');
const {
  findMatchingPriceRules,
  applyPriceRules,
} = require('../services/pricelistPricing.service');

const WRITE = process.argv.includes('--write');
const ALLOW_MOVES = process.argv.includes('--allow-price-moves');
const QTYS = [1, 6, 12]; // spot-check the volume tiers rules actually use

const ngn = (n) => `₦${Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

/** Price one product against one ordering of a pricelist's rules. */
function priceFor(rules, sp, qty) {
  const matched = findMatchingPriceRules(rules, String(sp._id), qty);
  const size = (sp.sizes || []).find((s) => s.isDefault) || (sp.sizes || [])[0];
  return applyPriceRules(
    Number(sp.baseSellingPrice) || 0,
    Number(sp.costPrice) || 0,
    matched,
    Number(size?.wholesalePrice) || 0
  );
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log(WRITE ? '── WRITE MODE ──\n' : '── DRY RUN (pass --write to persist) ──\n');

  const pricelists = await Pricelist.find({}).lean();
  let totalMoves = 0;
  const plans = [];

  for (const pl of pricelists) {
    const rules = pl.rules || [];
    if (!rules.length) continue;

    // The proposed ordering, as sequence numbers keyed by rule id.
    const nextSeq = new Map(rankedRules(rules).map((r, i) => [String(r._id), i]));
    const changed = rules.filter(
      (r) => (Number(r.sequence) || 0) !== nextSeq.get(String(r._id))
    );

    const after = rules.map((r) => ({ ...r, sequence: nextSeq.get(String(r._id)) }));

    // Every product any rule could touch. A rule with no subProduct is
    // all-products, so in that case the whole tenant catalogue is in scope.
    const hasGlobal = rules.some((r) => !r.subProduct);
    const specificIds = rules.filter((r) => r.subProduct).map((r) => r.subProduct);
    const products = await SubProduct.find(
      hasGlobal ? { tenant: pl.tenant } : { _id: { $in: specificIds } }
    )
      .select('sku baseSellingPrice costPrice sizes product')
      .populate('product', 'name')
      .lean();

    const moves = [];
    for (const sp of products) {
      for (const qty of QTYS) {
        const before = priceFor(rules, sp, qty);
        const now = priceFor(after, sp, qty);
        if (Math.abs(before - now) > 0.005) {
          moves.push({ sp, qty, before, now });
        }
      }
    }

    console.log(`${pl.name}  (${pl._id})`);
    console.log(`  rules: ${rules.length} · resequenced: ${changed.length} · products in scope: ${products.length}`);
    if (changed.length) {
      for (const r of rankedRules(rules)) {
        const from = Number(r.sequence) || 0;
        const to = nextSeq.get(String(r._id));
        console.log(`    seq ${from} → ${to}  ${r.priceType}${r.subProduct ? ' (product-specific)' : ''}${r.minQuantity ? ` qty${r.minQuantity}+` : ''}`);
      }
    }
    if (moves.length) {
      totalMoves += moves.length;
      console.log(`  ⚠ ${moves.length} charged price(s) move:`);
      for (const m of moves.slice(0, 20)) {
        const name = m.sp.product?.name || m.sp.sku || m.sp._id;
        console.log(`    ${name} @qty${m.qty}:  ${ngn(m.before)} → ${ngn(m.now)}`);
      }
      if (moves.length > 20) console.log(`    …and ${moves.length - 20} more`);
    } else {
      console.log('  ✓ no charged price changes');
    }
    console.log('');

    if (changed.length) plans.push({ id: pl._id, nextSeq });
  }

  console.log(`── ${plans.length} pricelist(s) need resequencing · ${totalMoves} price move(s) ──`);

  if (!WRITE) {
    console.log('\nDry run — nothing written.');
  } else if (totalMoves > 0 && !ALLOW_MOVES) {
    console.log('\nREFUSING TO WRITE: this would change charged prices.');
    console.log('Review the moves above, then re-run with --allow-price-moves.');
    process.exitCode = 1;
  } else {
    for (const plan of plans) {
      const doc = await Pricelist.findById(plan.id);
      doc.rules.forEach((r) => {
        const seq = plan.nextSeq.get(String(r._id));
        if (seq !== undefined) r.sequence = seq;
      });
      await doc.save();
      console.log(`written: ${plan.id}`);
    }
    console.log(`\nDone — ${plans.length} pricelist(s) updated.`);
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
