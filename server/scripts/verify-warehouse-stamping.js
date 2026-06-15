// Throwaway verification for warehouse stamping. Run against a dev DB.
// Usage: node server/scripts/verify-warehouse-stamping.js
require('dotenv').config();
const mongoose = require('mongoose');
const assert = require('assert');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  // Register sibling models referenced by populate() before querying.
  require('../models/User');
  require('../models/Size');
  require('../models/Order');
  const Warehouse = require('../models/Warehouse');
  const svc = require('../services/inventory.service');

  const wh = await Warehouse.findOne({ isDefault: true }).select('_id tenant').lean();
  assert(wh, 'Need at least one isDefault warehouse in the DB to verify');
  const tenantId = wh.tenant;

  // explicit id is returned as-is
  const explicit = await svc.resolveMovementWarehouse(tenantId, '64b000000000000000000abc');
  assert.strictEqual(explicit, '64b000000000000000000abc', 'explicit id should pass through');

  // falls back to default
  const fallback = await svc.resolveMovementWarehouse(tenantId, undefined);
  assert.strictEqual(String(fallback), String(wh._id), 'should fall back to default warehouse');

  // unknown tenant → null
  const none = await svc.resolveMovementWarehouse(new mongoose.Types.ObjectId(), undefined);
  assert.strictEqual(none, null, 'unknown tenant should resolve to null');

  console.log('✅ resolveMovementWarehouse OK');

  // Populate check: most recent movements with a warehouse should expose { name, code }
  const res = await svc.getMovements(tenantId, { limit: 20 });
  const withWh = res.data.movements.find(m => m.warehouse);
  if (withWh) {
    assert(typeof withWh.warehouse === 'object', 'warehouse should be populated to an object');
    assert('name' in withWh.warehouse || 'code' in withWh.warehouse, 'warehouse should have name/code');
    console.log('✅ getMovements populates warehouse:', withWh.warehouse.name || withWh.warehouse.code);
  } else {
    console.log('ℹ️  no movements with a warehouse yet (create one to fully verify)');
  }

  await mongoose.disconnect();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
