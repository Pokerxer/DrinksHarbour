/**
 * Repair WarehouseStock rows whose `subProduct` ref is dangling.
 *
 * WHY THESE EXIST
 * ---------------
 * `subproduct.service.js → deleteSubProduct()` deletes the SubProduct and its
 * Size docs and decrements the Product/Tenant counters, but it never touches
 * WarehouseStock. Every SubProduct deletion therefore leaves its stock lines
 * behind, pointing at an id that no longer resolves. Mongoose's populate turns
 * such a ref into `null`, and because `typeof null === 'object'`, the admin's
 * render-time ref accessors used to narrow null into the "populated" branch and
 * throw — one orphan blanked the entire /warehouses/[id] page.
 *
 * The client is now null-safe (see client/apps/admin/src/app/shared/warehouses/
 * warehouse-ref-helpers.ts), so orphans render as "Unknown product" instead of
 * crashing. This script cleans up the underlying data.
 *
 * WHAT IT DOES
 * ------------
 * Orphans are NOT simply deleted: as of 2026-08-08 all 11 carried nonzero
 * quantity (289 units total), so a bare delete would silently destroy inventory
 * records. Each row is classified and handled by provenance:
 *
 *   reattach — The line's Size doc survived and its `subproduct` backref points
 *              at a LIVE SubProduct in the same tenant, which lists that Size in
 *              its `sizes[]`. The stock is identifiable, so the ref is repaired.
 *              Quantities are untouched, so there is no ledger effect and no
 *              double-count. Skipped if a stock row for
 *              (warehouse, liveSubProduct, size) already exists — repointing
 *              would create a duplicate line and inflate on-hand.
 *
 *   writeoff — Nothing left to attach to (the Size's own backref is dead too).
 *              The quantity is written off through a `written_off`
 *              InventoryMovement so the loss is auditable, then the stock row is
 *              removed. The movement is the permanent record.
 *
 *   skip     — Ambiguous (duplicate target, cross-tenant, missing Size). Left
 *              alone and reported for a human.
 *
 * NOTE ON LEDGERS: this script deliberately does NOT call recordReceipt /
 * recordReturnMovement and never writes `Size.stock`. Those helpers mutate
 * Size.stock themselves, and pairing them with a manual write double-counts.
 * On-hand truth is SUM(WarehouseStock.currentQuantity), which reattach leaves
 * unchanged and writeoff reduces by exactly the written-off amount.
 *
 * Usage:
 *   node -r dotenv/config scripts/repair-orphan-warehouse-stock.js
 *       → dry run (default): classify and print, write nothing
 *
 *   node -r dotenv/config scripts/repair-orphan-warehouse-stock.js --apply --performed-by=<userId>
 *       → apply. --performed-by is required for write-offs (InventoryMovement
 *         requires it) and should be the admin accountable for the adjustment.
 *
 *   --only=reattach|writeoff   run just one class
 *   --tenant=<tenantId>        restrict to one tenant
 *
 * Unlike scripts/migrate-purchase-doc-indexes.js (which applies by default),
 * this one defaults to a dry run and needs an explicit --apply, because it
 * mutates inventory records rather than rebuilding indexes.
 */
const mongoose = require('mongoose');

// Referenced models must be registered before populate(), or Mongoose throws
// MissingSchemaError: Schema hasn't been registered for model "SubProduct".
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
require('../models/Product');
require('../models/Warehouse');
const WarehouseStock = require('../models/WarehouseStock');
const InventoryMovement = require('../models/InventoryMovement');

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/drinksharbour';

const argv = process.argv.slice(2);
const flag = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const APPLY = argv.includes('--apply');
const DRY_RUN = !APPLY;
const ONLY = flag('only');
const TENANT = flag('tenant');
const PERFORMED_BY = flag('performed-by');

const oid = (v) => new mongoose.Types.ObjectId(String(v));

/**
 * Decide what to do with one orphaned stock row.
 * Returns { action, reason, target? }.
 */
async function classify(row) {
  const size = row.size ? await Size.findById(row.size).lean() : null;
  if (!size) {
    return { action: 'writeoff', reason: 'size doc missing — nothing to identify the stock by' };
  }

  // Size's parent backref is `subproduct` (lowercase p) — NOT `subProduct`,
  // which is what WarehouseStock uses. Querying the wrong casing silently
  // returns nothing.
  const parentId = size.subproduct;
  if (!parentId) {
    return { action: 'writeoff', reason: 'size has no parent subproduct backref' };
  }

  const parent = await SubProduct.findById(parentId)
    .select('_id sku tenant sizes product')
    .lean();
  if (!parent) {
    return { action: 'writeoff', reason: `size's parent subproduct ${parentId} is also deleted` };
  }

  if (String(parent.tenant) !== String(row.tenant)) {
    return { action: 'skip', reason: `tenant mismatch: row ${row.tenant} vs subproduct ${parent.tenant}` };
  }

  const listed = (parent.sizes || []).some((s) => String(s) === String(size._id));
  if (!listed) {
    return { action: 'skip', reason: `subproduct ${parent.sku} does not list size ${size.size} in sizes[]` };
  }

  // Repointing onto an existing line would create a duplicate (warehouse,
  // subProduct, size) row and double-count the on-hand sum.
  const existing = await WarehouseStock.findOne({
    warehouse: row.warehouse,
    subProduct: parent._id,
    size: size._id,
    _id: { $ne: row._id },
  })
    .select('_id currentQuantity')
    .lean();
  if (existing) {
    return {
      action: 'skip',
      reason: `a stock row already exists for ${parent.sku}/${size.size} (${existing._id}, qty ${existing.currentQuantity}) — merge by hand`,
    };
  }

  return {
    action: 'reattach',
    reason: `size ${size.size} belongs to live subproduct ${parent.sku}`,
    target: parent,
    size,
  };
}

async function main() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 20000, family: 4 });
  console.log(`Connected. Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'APPLY'}\n`);

  const query = TENANT ? { tenant: oid(TENANT) } : {};
  const rows = await WarehouseStock.find(query).populate('subProduct', '_id').lean();

  // populate() resolves a dangling ref to null — that is the orphan signal.
  const orphans = rows.filter((r) => r.subProduct == null);
  const totalQty = orphans.reduce((s, r) => s + (r.currentQuantity || 0), 0);
  console.log(`scanned ${rows.length} stock rows`);
  console.log(`orphaned (subProduct → null): ${orphans.length}, holding ${totalQty} units\n`);
  if (orphans.length === 0) return void console.log('Nothing to do.');

  // Re-read unpopulated so the dangling ObjectIds are visible.
  const raw = await WarehouseStock.find({ _id: { $in: orphans.map((o) => o._id) } }).lean();

  const plan = [];
  for (const row of raw) plan.push({ row, ...(await classify(row)) });

  const of = (a) => plan.filter((p) => p.action === a);
  for (const action of ['reattach', 'writeoff', 'skip']) {
    const group = of(action);
    const qty = group.reduce((s, p) => s + (p.row.currentQuantity || 0), 0);
    console.log(`── ${action.toUpperCase()} — ${group.length} row(s), ${qty} units`);
    for (const p of group) {
      console.log(
        `   ${p.row._id}  qty=${String(p.row.currentQuantity).padStart(4)}  ` +
          `deadRef=${p.row.subProduct}  ${p.reason}`
      );
    }
    console.log('');
  }

  if (DRY_RUN) {
    console.log('Dry run — nothing written. Re-run with --apply --performed-by=<userId> to execute.');
    return;
  }

  const wantWriteoff = of('writeoff').length > 0 && ONLY !== 'reattach';
  if (wantWriteoff && !PERFORMED_BY) {
    throw new Error(
      'Write-offs create InventoryMovement records, which require performedBy. ' +
        'Pass --performed-by=<userId> (or --only=reattach to skip them).'
    );
  }

  let reattached = 0;
  let writtenOff = 0;

  for (const p of plan) {
    if (ONLY && p.action !== ONLY) continue;

    if (p.action === 'reattach') {
      // Quantity is untouched: this only repairs the ref, so on-hand
      // (SUM of currentQuantity) is identical before and after.
      await WarehouseStock.updateOne(
        { _id: p.row._id },
        { $set: { subProduct: p.target._id } }
      );
      // Bring the ledger entries along so movement history stays attached.
      await InventoryMovement.updateMany(
        { subProduct: oid(p.row.subProduct) },
        { $set: { subProduct: p.target._id } }
      );
      reattached += 1;
      console.log(`reattached ${p.row._id} → ${p.target.sku}`);
    }

    if (p.action === 'writeoff') {
      const qty = p.row.currentQuantity || 0;
      if (qty > 0) {
        // Audit trail first, so a crash mid-way leaves a record of intent
        // rather than a silently vanished quantity.
        await InventoryMovement.create({
          subProduct: oid(p.row.subProduct),
          size: p.row.size,
          warehouse: p.row.warehouse,
          tenant: p.row.tenant,
          type: 'written_off',
          category: 'out',
          quantity: qty,
          quantityBefore: qty,
          quantityAfter: 0,
          source: 'system',
          performedBy: oid(PERFORMED_BY),
          notes:
            `Write-off of orphaned WarehouseStock ${p.row._id}: ${p.reason}. ` +
            `Recorded by scripts/repair-orphan-warehouse-stock.js.`,
        });
      }
      await WarehouseStock.deleteOne({ _id: p.row._id });
      writtenOff += 1;
      console.log(`wrote off ${p.row._id} (${qty} units) and removed the row`);
    }
  }

  console.log(`\nDone. reattached=${reattached} writtenOff=${writtenOff} skipped=${of('skip').length}`);
}

main()
  .catch((err) => {
    console.error('FAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
