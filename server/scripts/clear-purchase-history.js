/**
 * Clear a tenant's purchase DOCUMENTS, keeping the suppliers.
 *
 * Deletes every purchase order, vendor bill and vendor return for one tenant,
 * and deliberately leaves `Vendor` and `VendorPricelist` alone — a supplier and
 * its agreed prices are authored master data you would have to retype, whereas
 * the documents are what trading with that supplier produces. `PurchaseAgreement`
 * is kept for the same reason: it is a contract, not history.
 *
 * ⚠ IRREVERSIBLE, and it does NOT reverse stock.
 *
 * A received purchase order has already moved goods into a warehouse. Deleting
 * it does not take them back out: `WarehouseStock` quantities are untouched and
 * the `StockMovement` / `WarehouseMovement` ledger rows survive. Those ledgers
 * link back by a free-text `reference` string, not by an ObjectId ref, so
 * nothing dereferences a missing document — the audit trail simply goes cold at
 * a PO number that no longer exists. That is the intended trade: you keep the
 * goods you physically have and lose the paperwork explaining where they came
 * from. If you need the stock reversed too, that is a different job and this
 * script is the wrong tool.
 *
 * The count of POs carrying receipts, and of bills already paid, is printed
 * before anything is written so the operator sees exactly what they are about
 * to lose. If any of it matters, stop and dump it first.
 *
 * Order matters: children before parents. VendorBill and VendorReturn each hold
 * a `purchaseOrder` ref, so they go first. A crash halfway then leaves orphaned
 * parents — a PO with no bill reads as simply un-billed, which the app tolerates
 * — rather than orphaned children, which it does not.
 *
 * Usage:
 *   node scripts/clear-purchase-history.js --tenant=<id>            # dry run
 *   node scripts/clear-purchase-history.js --tenant=<id> --apply    # delete
 *
 * Writes nothing without --apply. `--tenant` is REQUIRED and never defaulted:
 * a delete that picks its own scope is one keystroke from clearing the wrong
 * company.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const PurchaseOrder = require('../models/PurchaseOrder');
const VendorBill = require('../models/VendorBill');
const VendorReturn = require('../models/VendorReturn');
const PurchaseAgreement = require('../models/PurchaseAgreement');
const Vendor = require('../models/Vendor');
const VendorPricelist = require('../models/VendorPricelist');

const APPLY = process.argv.includes('--apply');
const TENANT = (process.argv.find((a) => a.startsWith('--tenant=')) || '').split('=')[1] || null;

// Children first — see the note above on which orphan the app survives.
const TARGETS = [
  ['VendorReturn', VendorReturn],
  ['VendorBill', VendorBill],
  ['PurchaseOrder', PurchaseOrder],
];

// Named explicitly rather than left implicit: a "clear everything purchases"
// that silently took the suppliers with it would be an expensive surprise.
const KEPT = [
  ['Vendor', Vendor],
  ['VendorPricelist', VendorPricelist],
  ['PurchaseAgreement', PurchaseAgreement],
];

async function main() {
  if (!TENANT) throw new Error('--tenant=<id> is required');
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri);

  const tenant = await Tenant.findById(TENANT).select('name').lean();
  if (!tenant) throw new Error(`No tenant ${TENANT}`);
  console.log(`Tenant: ${tenant.name} (${TENANT})\n`);

  const filter = { tenant: new mongoose.Types.ObjectId(TENANT) };
  let total = 0;
  for (const [label, Model] of TARGETS) {
    const n = await Model.countDocuments(filter);
    total += n;
    console.log(`  ${label.padEnd(20)} ${String(n).padStart(5)}`);
  }
  for (const [label, Model] of KEPT) {
    const n = await Model.countDocuments(filter);
    console.log(`  ${label.padEnd(20)} ${String(n).padStart(5)}   ← KEPT`);
  }

  // The two numbers that decide whether this is safe to run.
  const received = await PurchaseOrder.countDocuments({
    ...filter,
    'partialReceipts.0': { $exists: true },
  });
  const paidBills = await VendorBill.countDocuments({
    ...filter,
    status: { $in: ['paid', 'partial'] },
  });
  console.log(`\n${total} documents to delete.`);
  console.log(`  ${received} purchase orders have RECEIVED stock — those goods stay on hand.`);
  console.log(`  ${paidBills} vendor bills are PAID or part-paid — that payment record is lost.`);

  if (!APPLY) {
    console.log('\nDry run — nothing deleted. Re-run with --apply.');
    await mongoose.disconnect();
    return;
  }

  console.log('');
  for (const [label, Model] of TARGETS) {
    const { deletedCount } = await Model.deleteMany(filter);
    console.log(`  deleted ${String(deletedCount).padStart(5)}  ${label}`);
  }

  // A kept agreement still lists the POs just deleted. Drop those ids so it
  // does not point at documents that are gone.
  const { modifiedCount } = await PurchaseAgreement.updateMany(filter, {
    $set: { purchaseOrders: [] },
  });
  if (modifiedCount) console.log(`  cleared PO refs on ${modifiedCount} PurchaseAgreement(s)`);

  console.log('\nVerifying:');
  for (const [label, Model] of TARGETS) {
    const left = await Model.countDocuments(filter);
    console.log(`  ${left === 0 ? '✓' : '✗'} ${label.padEnd(20)} ${left} left`);
  }
  for (const [label, Model] of KEPT) {
    const n = await Model.countDocuments(filter);
    console.log(`  · ${label.padEnd(20)} ${n} intact`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
