/**
 * One-off dev script: wipe all stock quantities and movement history.
 *
 * Clears:
 *   • Size.stock + Size.availableStock  → 0  (all sizes)
 *   • WarehouseStock collection         → deleted entirely
 *   • InventoryMovement collection      → deleted entirely
 *   • WarehouseMovement collection      → deleted entirely
 *
 * Also resets SubProduct rollup fields (totalStock, availableStock, reservedStock,
 * stockStatus) so the edit page doesn't show stale numbers.
 *
 * Run: node server/scripts/reset-stock.js
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');

async function main() {
  await connectDB();
  console.log('Connected to MongoDB\n');

  const Size             = require('../models/Size');
  const WarehouseStock   = require('../models/WarehouseStock');
  const InventoryMovement = require('../models/InventoryMovement');
  const WarehouseMovement = require('../models/WarehouseMovement');
  const SubProduct       = require('../models/SubProduct');

  // 1 – Size stock counters
  const sizeRes = await Size.updateMany({}, {
    $set: { stock: 0, availableStock: 0 },
  });
  console.log(`✅ Size.stock reset:          ${sizeRes.modifiedCount} sizes`);

  // 2 – SubProduct rollup fields
  const spRes = await SubProduct.updateMany({}, {
    $set: {
      totalStock:     0,
      availableStock: 0,
      reservedStock:  0,
      stockStatus:    'out_of_stock',
    },
  });
  console.log(`✅ SubProduct rollup reset:   ${spRes.modifiedCount} sub-products`);

  // 3 – WarehouseStock rows
  const wsRes = await WarehouseStock.deleteMany({});
  console.log(`✅ WarehouseStock deleted:    ${wsRes.deletedCount} rows`);

  // 4 – InventoryMovement records
  const imRes = await InventoryMovement.deleteMany({});
  console.log(`✅ InventoryMovement deleted: ${imRes.deletedCount} records`);

  // 5 – WarehouseMovement records
  const wmRes = await WarehouseMovement.deleteMany({});
  console.log(`✅ WarehouseMovement deleted: ${wmRes.deletedCount} records`);

  console.log('\nDone — all stock and history cleared.');
  await disconnectDB();
}

main().catch((err) => {
  console.error('Reset failed:', err.message);
  process.exit(1);
});
