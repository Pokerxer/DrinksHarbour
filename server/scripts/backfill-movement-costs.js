#!/usr/bin/env node
// scripts/backfill-movement-costs.js
//
// One-time repair: movements written before the cost-recording fix carried no
// cost — transfers/adjustments/returns/scrap stored neither unitCost nor
// totalCost, and received/purchase lines fell back to ₦0 whenever no explicit
// unit cost was supplied (the service never selected subProduct.costPrice).
// /inventory/moves therefore showed ₦0.00 for them.
//
// For every affected movement whose totalCost is missing/null/0, this script
// copies the linked SubProduct's costPrice into unitCost and writes
// totalCost = unitCost × quantity. NOTE: this reconstructs with the CURRENT
// cost price — the cost at the time of the move is not recoverable.
//
// Usage (from server/):
//   node scripts/backfill-movement-costs.js            # dry run
//   node scripts/backfill-movement-costs.js --apply    # write

require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/drinksharbour';

// Types whose writer path was structurally broken (no cost, or costPrice never
// selected so the fallback resolved to 0). Order-lifecycle types written by
// audit() (reserved/released/shipped/return-from-refund) always had costPrice
// selected, so any of those with a real cost are naturally excluded by the
// totalCost filter below.
const AFFECTED_TYPES = [
  'transfer_in',
  'transfer_out',
  'received',
  'purchase',
  'adjustment_in',
  'adjustment_out',
  'return',
  'damaged',
  'expired',
  'theft',
  'written_off',
];

async function main() {
  console.log(
    `Backfill InventoryMovement costs — ${APPLY ? 'APPLY' : 'DRY RUN'}\n`
  );
  await mongoose.connect(MONGO_URI);
  // Register schemas (side-effect requires) before touching the models.
  require('../models/InventoryMovement');
  require('../models/SubProduct');
  const InventoryMovement = mongoose.model('InventoryMovement');
  const SubProduct = mongoose.model('SubProduct');

  // totalCost: null also matches missing fields in MongoDB.
  const query = {
    type: { $in: AFFECTED_TYPES },
    $or: [{ totalCost: null }, { totalCost: 0 }],
  };

  const movements = await InventoryMovement.find(query)
    .select('type quantity subProduct tenant unitCost totalCost')
    .lean();
  console.log(`Movements needing cost repair: ${movements.length}`);

  if (movements.length === 0) {
    await mongoose.disconnect();
    return;
  }

  // Batch-load cost prices for every linked SubProduct.
  const spIds = [
    ...new Set(movements.map((m) => String(m.subProduct)).filter(Boolean)),
  ];
  const sps = await SubProduct.find({ _id: { $in: spIds } })
    .select('costPrice')
    .lean();
  const costBySp = new Map(sps.map((sp) => [String(sp._id), sp.costPrice ?? 0]));
  console.log(`Linked SubProducts: ${spIds.length} (${sps.length} found)\n`);

  const perType = {};
  const perTenant = {};
  const ops = [];
  let noSubProduct = 0;
  let zeroCostPrice = 0;

  for (const m of movements) {
    const spKey = String(m.subProduct ?? '');
    const cost = costBySp.get(spKey);
    if (cost == null) {
      noSubProduct++;
      continue;
    }
    if (!cost) {
      zeroCostPrice++;
      continue;
    }
    perType[m.type] = (perType[m.type] || 0) + 1;
    perTenant[String(m.tenant)] = (perTenant[String(m.tenant)] || 0) + 1;
    if (APPLY) {
      ops.push({
        updateOne: {
          filter: { _id: m._id },
          update: { $set: { unitCost: cost, totalCost: cost * m.quantity } },
        },
      });
    }
  }

  if (APPLY && ops.length > 0) {
    const res = await InventoryMovement.bulkWrite(ops, { ordered: false });
    console.log(`Bulk write: ${res.modifiedCount} documents updated.\n`);
  }

  console.log('Would fix by type (APPLY writes these):');
  for (const [type, count] of Object.entries(perType).sort()) {
    console.log(`  ${type.padEnd(16)} ${count}`);
  }
  console.log('\nBy tenant:');
  for (const [tenant, count] of Object.entries(perTenant).sort()) {
    console.log(`  ${tenant}  ${count}`);
  }
  console.log(
    `\nSkipped — SubProduct missing: ${noSubProduct}, SubProduct costPrice is 0: ${zeroCostPrice}`
  );
  console.log(
    `\n${APPLY ? 'Applied' : 'Dry run — re-run with --apply to write'}: ${ops.length || Object.values(perType).reduce((a, b) => a + b, 0)}`
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
