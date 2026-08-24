#!/usr/bin/env node
// scripts/backfill-inventory-movements.js
//
// One-time repair: the warehouse ops ledger (WarehouseMovement) and the
// unified inventory ledger (InventoryMovement) were written by different code
// paths, so transfers/adjustments made from warehouse screens were missing
// from /inventory/movements-based history and summaries.
//
// This script mirrors historical WarehouseMovement entries into
// InventoryMovement, reconstructing quantityBefore/After by replaying each
// line's balance trail, then recalculates SubProduct stock rollups.
//
// Usage (from server/):
//   node scripts/backfill-inventory-movements.js            # dry run
//   DRY_RUN=0 MONGO_URI=... node scripts/backfill-inventory-movements.js --apply

require('dotenv').config();
const mongoose = require('mongoose');

const DRY_RUN = !process.argv.includes('--apply');
const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/drinksharbour';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(
    `Backfill InventoryMovement from WarehouseMovement — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}\n`
  );
  await mongoose.connect(MONGO_URI);
  // Register schemas (side-effect requires) before touching the models.
  require('../models/WarehouseMovement');
  require('../models/InventoryMovement');
  require('../models/SubProduct');
  const WarehouseMovement = mongoose.model('WarehouseMovement');
  const InventoryMovement = mongoose.model('InventoryMovement');
  const SubProduct = mongoose.model('SubProduct');
  const { recalcSubProductStock } = require('../services/warehouseStock.helpers');

  // 1) Load every warehouse movement in chronological order per line.
  const wms = await WarehouseMovement.find({}).sort({ createdAt: 1 }).lean();
  console.log(`WarehouseMovement docs: ${wms.length}`);

  // Existing unified-ledger fingerprints for dedupe: a mirror is skipped when
  // an InventoryMovement already exists for the same line/type/qty within
  // ±15s of the warehouse entry.
  const existing = await InventoryMovement.find({})
    .select('tenant subProduct size type quantity createdAt')
    .lean();
  const fingerprint = (m) =>
    [
      String(m.tenant),
      String(m.subProduct),
      String(m.size ?? ''),
      m.type,
      Math.round(m.quantity),
      new Date(m.createdAt).getTime(),
    ].join('|');
  const nearDup = new Set();
  const WINDOW = 15_000;
  for (const m of existing) {
    const base = fingerprint(m).split('|');
    // bucket by second-level line key; compare times with tolerance below
    nearDup.add(
      `${base[0]}|${base[1]}|${base[2]}|${base[3]}|${base[4]}|${base[5]}`
    );
  }
  const hasNearDup = (m) => {
    for (let dt = -WINDOW; dt <= WINDOW; dt += 5000) {
      const t = new Date(m.createdAt).getTime() + dt;
      if (
        nearDup.has(
          [
            String(m.tenant),
            String(m.subProduct),
            String(m.size ?? ''),
            m.mappedType,
            Math.round(Math.abs(m.mappedQty)),
            t,
          ].join('|')
        )
      )
        return true;
    }
    return false;
  };

  // 2) Replay balances per (tenant, subProduct, size) to derive before values.
  const lines = new Map();
  for (const wm of wms) {
    const key = `${wm.tenant}|${wm.subProduct}|${wm.size}`;
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push(wm);
  }

  const inserts = [];
  let skippedDup = 0;
  let skippedNoBalance = 0;

  for (const [, list] of lines) {
    // Track the last known on-hand so recounts can compute deltas.
    let prevBalance = null;
    for (const wm of list) {
      const after = wm.balanceAfter;

      let mappedType;
      let category;
      let qtyBefore;
      let qtyAbs;

      switch (wm.type) {
        case 'received':
          mappedType = 'received';
          category = 'in';
          qtyAbs = Math.abs(wm.quantity);
          qtyBefore = after - qtyAbs >= 0 ? after - qtyAbs : null;
          break;
        case 'shipped':
          mappedType = 'shipped';
          category = 'out';
          qtyAbs = Math.abs(wm.quantity);
          qtyBefore = after + qtyAbs;
          break;
        case 'returned':
          mappedType = 'return';
          category = 'in';
          qtyAbs = Math.abs(wm.quantity);
          qtyBefore = after - qtyAbs >= 0 ? after - qtyAbs : null;
          break;
        case 'adjusted': {
          // quantity IS the new absolute count. Delta needs the prior balance;
          // fall back to the recorded balance itself when unknown.
          const delta =
            prevBalance === null ? null : after - prevBalance;
          if (delta === null || delta === 0) {
            // Nothing verifiable to mirror — record as a neutral audit row.
            mappedType = 'adjustment_in';
            category = 'adjustment';
            qtyAbs = 0;
            qtyBefore = after;
          } else {
            mappedType = delta > 0 ? 'adjustment_in' : 'adjustment_out';
            category = 'adjustment';
            qtyAbs = Math.abs(delta);
            qtyBefore = prevBalance;
          }
          break;
        }
        case 'transfer_out':
          mappedType = 'transfer_out';
          category = 'transfer';
          qtyAbs = Math.abs(wm.quantity);
          qtyBefore = after + qtyAbs;
          break;
        case 'transfer_in':
          mappedType = 'transfer_in';
          category = 'transfer';
          qtyAbs = Math.abs(wm.quantity);
          qtyBefore = after - qtyAbs >= 0 ? after - qtyAbs : null;
          break;
        default:
          continue; // unknown type — leave untouched
      }

      if (qtyBefore === null) {
        // Balance trail doesn't support an exact reconstruction; still mirror,
        // using `after` as before (quantity stays truthful).
        skippedNoBalance++;
        qtyBefore = after;
      }

      const candidate = {
        tenant: wm.tenant,
        subProduct: wm.subProduct,
        size: wm.size ?? undefined,
        warehouse: wm.warehouse,
        type: mappedType,
        category,
        quantity: qtyAbs,
        quantityBefore: qtyBefore,
        quantityAfter: after,
        unitCost: wm.unitCost ?? undefined,
        totalCost:
          wm.unitCost && qtyAbs ? wm.unitCost * qtyAbs : undefined,
        reference: wm.reference
          ? String(wm.reference).slice(0, 100)
          : wm.transferGroupId
            ? String(wm.transferGroupId)
            : undefined,
        referenceType: wm.transferGroupId
          ? 'transfer'
          : category === 'adjustment'
            ? 'adjustment'
            : 'manual',
        reason: wm.reference ? String(wm.reference).slice(0, 200) : undefined,
        performedBy: wm.performedBy ?? undefined,
        performedAt: wm.createdAt,
        createdAt: wm.createdAt,
        updatedAt: wm.createdAt,
        source: 'system',
        status: 'confirmed',
        notes: 'backfilled from WarehouseMovement',
      };

      const probe = {
        ...candidate,
        createdAt: wm.createdAt,
        mappedType,
        mappedQty: qtyAbs,
      };
      if (existing.length && hasNearDup(probe)) {
        skippedDup++;
      } else {
        inserts.push(candidate);
        // Register so later windows don't double-insert within this run.
        nearDup.add(
          [
            String(wm.tenant),
            String(wm.subProduct),
            String(wm.size ?? ''),
            mappedType,
            Math.round(qtyAbs),
            new Date(wm.createdAt).getTime(),
          ].join('|')
        );
      }

      prevBalance = after;
    }
  }

  console.log(
    `Planned inserts: ${inserts.length} · near-duplicates skipped: ${skippedDup} · balance-approximated: ${skippedNoBalance}`
  );

  if (!DRY_RUN && inserts.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < inserts.length; i += CHUNK) {
      await InventoryMovement.insertMany(inserts.slice(i, i + CHUNK), {
        ordered: false,
      });
      process.stdout.write(`inserted ${Math.min(i + CHUNK, inserts.length)}\r`);
    }
    console.log('\nInserts complete.');
  }

  // 3) Recalculate SubProduct rollups so every total reflects reality.
  const subIds = [...new Set(wms.map((w) => String(w.subProduct)))];
  console.log(`Recalculating rollups for ${subIds.length} sub-products…`);
  if (!DRY_RUN) {
    let fixed = 0;
    for (const id of subIds) {
      try {
        await recalcSubProductStock(id);
        fixed++;
      } catch (e) {
        console.warn(`rollup failed for ${id}: ${e.message}`);
      }
    }
    console.log(`Rollups recalculated: ${fixed}`);
  }

  console.log(DRY_RUN ? '\nDry run only — rerun with --apply to write.' : '\nDone.');
  await mongoose.disconnect();
  await sleep(100);
}

main().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
  try {
    await mongoose.disconnect();
  } catch {}
});
