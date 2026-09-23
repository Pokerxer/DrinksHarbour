// server/scripts/backfill-inventory-histories.js
//
// Repairs the unified product ledger (InventoryMovement) where it has drifted
// from the authoritative per-warehouse ledger (WarehouseMovement):
//
//   1. BACKFILL missing transfer mirrors. Module transfers (stockTransferReceive)
//      previously posted only the WarehouseMovement pair; the product History tab
//      never saw them. For every transfer_in/transfer_out pair lacking a
//      category:'transfer' InventoryMovement row, insert one mirror per leg,
//      preserving the original event timestamp so the timeline keeps real dates.
//
//   2. DEDUPE double-written PO receipts. PO receive used to call adjustStock
//      (which mirrors a 'manual'/"PO Receipt: …" row) AND write the authoritative
//      'purchase_order' row. Delete the manual duplicates where a matching
//      purchase_order twin exists (same tenant/subProduct/warehouse/size/qty/PO).
//      Nothing unique is lost.
//
// Idempotent: existence checks precede every insert/delete, so re-running is a
// no-op. Defaults to DRY-RUN; pass --apply to write.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log(`connected: ${mongoose.connection.name} (mode: ${APPLY ? 'APPLY' : 'DRY-RUN'})`);

  const WarehouseMovement = require('../models/WarehouseMovement');
  const InventoryMovement = require('../models/InventoryMovement');

  // ── 1. Backfill missing transfer mirrors ───────────────────────────────────
  const legs = await WarehouseMovement.find({
    type: { $in: ['transfer_out', 'transfer_in'] },
  }).lean();

  // Existence check must match ANY ledger row for the leg (type transfer_in/out)
  // regardless of referenceType — the ad-hoc TRF-000001 backfill stored 'manual'.
  const existing = await InventoryMovement.find({
    type: { $in: ['transfer_in', 'transfer_out'] },
  }).select('tenant subProduct warehouse reference type').lean();
  const have = new Set(
    existing.map((m) =>
      `${String(m.tenant)}|${String(m.subProduct)}|${String(m.warehouse)}|${m.reference || ''}|${m.type}`
    )
  );

  const byGroup = new Map();
  for (const m of legs) {
    const key = `${String(m.tenant)}|${String(m.subProduct)}|${m.reference || ''}`;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(m);
  }

  let backfilled = 0;
  let skipped = 0;
  for (const [key, pair] of byGroup) {
    if (pair.length !== 2) {
      skipped += pair.length;
      console.warn(`  ⚠ unusual group (${pair.length} legs): ${key}`);
      continue;
    }
    const out = pair.find((m) => m.type === 'transfer_out');
    const inn = pair.find((m) => m.type === 'transfer_in');
    if (!out || !inn) {
      skipped += 2;
      console.warn(`  ⚠ pair without both legs: ${key}`);
      continue;
    }
    if (!Number.isFinite(out.balanceAfter) || !Number.isFinite(inn.balanceAfter)) {
      skipped += 2;
      console.warn(`  ⚠ pair missing balanceAfter: ${key}`);
      continue;
    }

    const outKey = `${String(out.tenant)}|${String(out.subProduct)}|${String(out.warehouse)}|${out.reference || ''}|transfer_out`;
    const inKey = `${String(inn.tenant)}|${String(inn.subProduct)}|${String(inn.warehouse)}|${inn.reference || ''}|transfer_in`;
    if (have.has(outKey) && have.has(inKey)) continue;

    const base = {
      tenant: out.tenant,
      subProduct: out.subProduct,
      reference: out.reference,
      referenceType: 'transfer',
      sourceWarehouse: out.warehouse,
      destinationWarehouse: inn.warehouse,
      performedBy: out.performedBy,
      performedAt: out.createdAt,
      source: 'system',
      createdAt: out.createdAt,
      updatedAt: out.createdAt,
    };
    const rows = [
      {
        ...base,
        warehouse: out.warehouse,
        size: out.size,
        type: 'transfer_out',
        category: 'transfer',
        quantity: out.quantity,
        quantityBefore: out.balanceAfter + out.quantity,
        quantityAfter: out.balanceAfter,
      },
      {
        ...base,
        warehouse: inn.warehouse,
        size: inn.size,
        type: 'transfer_in',
        category: 'transfer',
        quantity: inn.quantity,
        quantityBefore: inn.balanceAfter - inn.quantity,
        quantityAfter: inn.balanceAfter,
      },
    ].filter((r) => !have.has(
      `${String(r.tenant)}|${String(r.subProduct)}|${String(r.warehouse)}|${r.reference || ''}|${r.type}`
    ));

    if (!rows.length) continue;
    backfilled += rows.length;
    if (APPLY) await InventoryMovement.create(rows, { ordered: true });
    console.log(`  + backfill ${rows.length} row(s): ${out.reference} (${out.subProduct})`);
  }

  // ── 2. Dedupe double-written PO receipts ────────────────────────────────────
  const manual = await InventoryMovement.find({
    referenceType: 'manual',
    reference: /^PO Receipt:\s*/,
  }).lean();
  const poRows = await InventoryMovement.find({ referenceType: 'purchase_order' }).lean();

  const twins = new Map();
  for (const r of poRows) {
    twins.set(
      `${String(r.tenant)}|${String(r.subProduct)}|${String(r.warehouse)}|${r.size ? String(r.size) : ''}|${r.quantity}|${r.reference || ''}`,
      true
    );
  }

  const toDelete = manual.filter((m) => {
    const poNo = m.reference.replace(/^PO Receipt:\s*/, '');
    return twins.has(
      `${String(m.tenant)}|${String(m.subProduct)}|${String(m.warehouse)}|${m.size ? String(m.size) : ''}|${m.quantity}|${poNo}`
    );
  });

  let deleted = 0;
  for (const m of toDelete) {
    deleted++;
    if (APPLY) await InventoryMovement.deleteOne({ _id: m._id });
    console.log(`  − delete duplicate: ${m.reference} (${m.subProduct}, qty ${m.quantity})`);
  }

  console.log('──────────────────────────────');
  console.log(`backfilled transfer rows : ${backfilled}${APPLY ? '' : ' (dry-run)'}`);
  console.log(`deleted PO duplicates    : ${deleted}${APPLY ? '' : ' (dry-run)'}`);
  console.log(`unpaired/skipped legs    : ${skipped}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});