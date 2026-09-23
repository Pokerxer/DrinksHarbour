// One-off data repair: reattribute the POS stock trail of SalesOrder SO00007
// (tenant "Wyn City") from WH-001 (Wyn City) to WH-002 (Cloud Bay).
//
// Background (2026-09-17): the SalesOrder already recorded WH-002, but the
// POS terminal's createPOSOrder resolved its own default warehouse (WH-001)
// and deducted stock there. This script restores WH-001, applies the
// deduction to WH-002, and repoints the movement/order records so the trail,
// the order record, and the fulfilment all name WH-002.
//
// Usage: node scripts/fix-so00007-warehouse.js   (runs once; not a cron job)

require('dotenv').config();

const mongoose = require('mongoose');
const Order = require('../models/Order');
const WarehouseStock = require('../models/WarehouseStock');
const WarehouseMovement = require('../models/WarehouseMovement');
const InventoryMovement = require('../models/InventoryMovement');
const Warehouse = require('../models/Warehouse');
const SalesOrder = require('../models/SalesOrder');
const { recalcSubProductStock } = require('../services/warehouseStock.helpers');

const TENANT = new mongoose.Types.ObjectId('699165839f3308b1baeca8fc');
const WH001 = new mongoose.Types.ObjectId('6a32ad2c78f1e3c27bda089a'); // Wyn City
const WH002 = new mongoose.Types.ObjectId('6a3a84e8b22cff944371c56e'); // Cloud Bay
const POS_ORDER_ID = new mongoose.Types.ObjectId('6aac55372fda9c4377b5cb40'); // RCP-20260917-0001
const SO_ID = new mongoose.Types.ObjectId('6aac4d535415ea3df53c624c'); // SO00007

// The 17 shipped movements that make up this sale: one per (subProduct,size)
// combo, all at WH-001, all created within the sale's 15-minute window.
const SALE_WINDOW = {
  $gte: new Date('2026-09-17T21:00:00Z'),
  $lte: new Date('2026-09-17T21:15:00Z'),
};

async function main() {
  if (!process.argv.includes("--apply")) throw new Error("Pass --apply to perform this one-off stock repair");
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    appName: 'dh-so00007-repair',
  });
  const db = mongoose.connection.db;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const movCol = db.collection('warehousemovements');
    const wsCol = db.collection('warehousestocks');
    const invCol = db.collection('inventorymovements');

    // ── 1. The physical movements that actually deducted WH-001 ──────────────
    const shipped = await WarehouseMovement.find({
      tenant: TENANT, warehouse: WH001, type: 'shipped', createdAt: SALE_WINDOW,
    }).session(session).lean();
    if (shipped.length !== 17) {
      throw new Error(`expected 17 shipped movements, found ${shipped.length}`);
    }

    // Aggregate sold qty per combo (a combo appears once, but stay safe).
    const soldByCombo = new Map();
    for (const m of shipped) {
      const key = `${String(m.subProduct)}::${String(m.size || '')}`;
      soldByCombo.set(key, {
        subProduct: m.subProduct, size: m.size || null, movements: [],
        qty: (soldByCombo.get(key)?.qty || 0) + m.quantity,
      });
      soldByCombo.get(key).movements.push(m._id);
    }

    const combos = [...soldByCombo.values()];
    console.log(`re-attributing ${combos.length} combos / ${shipped.reduce((s, m) => s + m.quantity, 0)} units from WH-001 -> WH-002`);

    const touchedSubProducts = new Set();

    for (const combo of combos) {
      const q = { tenant: TENANT, subProduct: combo.subProduct, size: combo.size };
      const w1 = await wsCol.findOne({ ...q, warehouse: WH001 }, { session });
      const w2 = await wsCol.findOne({ ...q, warehouse: WH002 }, { session });
      if (!w1 || !w2) {
        throw new Error(`missing warehouse stock row for ${String(combo.subProduct)}/${String(combo.size)}`);
      }
      const q1 = w1.currentQuantity || 0;
      const q2 = w2.currentQuantity || 0;
      if (q2 < combo.qty) {
        throw new Error(`WH-002 holds ${q2}, less than the ${combo.qty} this combo sold — aborting`);
      }

      // 2. Rebalance: WH-001 restored, WH-002 deducted.
      await wsCol.updateOne({ _id: w1._id }, { $set: { currentQuantity: q1 + combo.qty } }, { session });
      const newQ2 = q2 - combo.qty;
      await wsCol.updateOne({ _id: w2._id }, { $set: { currentQuantity: newQ2 } }, { session });

      // 3. Repoint the shipped movements to WH-002 with its post-sale balance.
      await movCol.updateMany(
        { _id: { $in: combo.movements } },
        { $set: { warehouse: WH002, balanceAfter: newQ2 } },
        { session }
      );

      // 4. Repoint the inventory ('sold') movements for this order+combo.
      const inv = await invCol.find({
        relatedOrder: POS_ORDER_ID, subProduct: combo.subProduct, size: combo.size,
      }, { session }).toArray();
      if (inv.length !== 1) {
        throw new Error(`expected 1 inventory movement for ${String(combo.subProduct)}/${String(combo.size)}, found ${inv.length}`);
      }
      await invCol.updateOne(
        { _id: inv[0]._id },
        { $set: { warehouse: WH002, quantityBefore: q2, quantityAfter: newQ2 } },
        { session }
      );

      touchedSubProducts.add(String(combo.subProduct));
      console.log(`  ${String(combo.subProduct).slice(0, 10)}: +${combo.qty} WH-001 (${q1}->${q1 + combo.qty}), -${combo.qty} WH-002 (${q2}->${newQ2})`);
    }

    // 5. Repoint the POS order record (posWarehouse + item warehouses).
    //    posWarehouse is `immutable: true` on the schema, so a document save()
    //    silently keeps the old value — the raw collection write is required.
    const order = await Order.findOne({ _id: POS_ORDER_ID, tenant: TENANT }).session(session);
    if (!order || String(order.posWarehouse) !== String(WH001)) {
      throw new Error(`POS order not found or posWarehouse is not WH-001 (got ${order?.posWarehouse})`);
    }
    if (!Array.isArray(order.items)) throw new Error('POS order has no items');
    const patch = { posWarehouse: WH002 };
    for (let i = 0; i < order.items.length; i++) {
      if (String(order.items[i].warehouse) === String(WH001)) {
        patch[`items.${i}.warehouse`] = WH002;
      }
    }
    await db.collection('orders').updateOne(
      { _id: POS_ORDER_ID },
      { $set: patch },
      { session }
    );

    // 6. SalesOrder must already be WH-002 — assert, don't mutate.
    const so = await SalesOrder.findOne({ _id: SO_ID, tenant: TENANT }).session(session).lean();
    if (!so || String(so.warehouseId) !== String(WH002)) {
      throw new Error(`SalesOrder SO00007 warehouse is not WH-002 (got ${so?.warehouseId})`);
    }

    // 7. Refresh SubProduct rollups for every touched product.
    for (const spId of touchedSubProducts) {
      await recalcSubProductStock(new mongoose.Types.ObjectId(spId), session);
    }

    await session.commitTransaction();
    console.log('COMMIT ok — references for cross-check:');
    console.log('  shipment totals now by warehouse:', JSON.stringify(
      await movCol.aggregate([
        { $match: { tenant: TENANT, createdAt: SALE_WINDOW, type: 'shipped' } },
        { $group: { _id: '$warehouse', u: { $sum: '$quantity' } } },
      ]).toArray()
    ));
  } catch (err) {
    await session.abortTransaction();
    console.error('ABORT:', err.message);
    throw err;
  } finally {
    await session.endSession();
    await mongoose.disconnect();
  }
}

main().then(() => process.exit(0)).catch(() => process.exit(1));