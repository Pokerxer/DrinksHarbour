// services/warehouse.service.js
const mongoose = require('mongoose');
const Warehouse = require('../models/Warehouse');
const WarehouseStock = require('../models/WarehouseStock');
const WarehouseMovement = require('../models/WarehouseMovement');
const { recalcSubProductStock } = require('./warehouseStock.helpers');
const batchService = require('./batch.service');
const { NotFoundError, ValidationError } = require('../utils/errors');

// ── Place CRUD ──────────────────────────────────────────────
const CODE_PREFIX = { warehouse: 'WH', store: 'ST', distribution_center: 'DC' };

// Generate the next sequential, tenant-unique code for a warehouse type,
// e.g. WH-001, ST-002, DC-003.
async function generateWarehouseCode(tenantId, type) {
  const prefix = CODE_PREFIX[type] || 'WH';
  const existing = await Warehouse.find({
    tenant: tenantId,
    code: new RegExp(`^${prefix}-\\d+$`),
  })
    .select('code')
    .lean();
  const max = existing.reduce((m, w) => {
    const n = parseInt(String(w.code).split('-')[1], 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

async function createWarehouse(data, userId, tenantId) {
  if (data.isDefault) {
    await Warehouse.updateMany({ tenant: tenantId }, { $set: { isDefault: false } });
  }

  const payload = { ...data, tenant: tenantId, createdBy: userId };
  const autoCode = !payload.code || !String(payload.code).trim();

  // Retry on the unique {tenant, code} index in case of a concurrent insert.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (autoCode) payload.code = await generateWarehouseCode(tenantId, payload.type);
    try {
      return await Warehouse.create(payload);
    } catch (err) {
      const isDupCode = err?.code === 11000 && err?.keyPattern?.code;
      if (autoCode && isDupCode && attempt < 4) continue;
      throw err;
    }
  }
}

async function getWarehouses(tenantId, filters = {}) {
  const query = { tenant: tenantId };
  if (filters.isActive !== undefined) query.isActive = filters.isActive;
  if (filters.type) query.type = filters.type;
  return Warehouse.find(query).sort({ isDefault: -1, name: 1 }).lean();
}

async function getWarehouseById(id, tenantId) {
  const wh = await Warehouse.findOne({ _id: id, tenant: tenantId }).lean();
  if (!wh) throw new NotFoundError('Warehouse not found');
  return wh;
}

async function updateWarehouse(id, data, tenantId) {
  if (data.isDefault) {
    await Warehouse.updateMany({ tenant: tenantId }, { $set: { isDefault: false } });
  }
  const wh = await Warehouse.findOneAndUpdate(
    { _id: id, tenant: tenantId },
    { $set: data },
    { new: true }
  );
  if (!wh) throw new NotFoundError('Warehouse not found');
  return wh;
}

async function deleteWarehouse(id, tenantId) {
  const hasStock = await WarehouseStock.exists({
    tenant: tenantId,
    warehouse: id,
    currentQuantity: { $gt: 0 },
  });
  if (hasStock) {
    throw new ValidationError(
      'Cannot delete a warehouse that still holds stock. Transfer or zero it out first.'
    );
  }
  const wh = await Warehouse.findOneAndDelete({ _id: id, tenant: tenantId });
  if (!wh) throw new NotFoundError('Warehouse not found');
  await WarehouseStock.deleteMany({ tenant: tenantId, warehouse: id });
  return wh;
}

// ── Stock ───────────────────────────────────────────────────
async function getWarehouseStock(warehouseId, tenantId) {
  return WarehouseStock.find({ tenant: tenantId, warehouse: warehouseId })
    .populate({
      path: 'subProduct',
      select: 'sku product imagesOverride',
      populate: { path: 'product', select: 'name slug images' },
    })
    .populate('size', 'size')
    .sort({ updatedAt: -1 })
    .lean();
}

/**
 * Adjust stock for one (warehouse, subProduct, size) line.
 * type: 'received' | 'shipped' | 'adjusted'
 *   received → +quantity, shipped → -quantity, adjusted → set to quantity (absolute)
 */
async function adjustStock({ warehouseId, subProduct, size, quantity, type, notes, tracksBatch = false }, userId, tenantId) {
  if (!['received', 'shipped', 'adjusted'].includes(type)) {
    throw new ValidationError('Invalid adjustment type');
  }
  let row = await WarehouseStock.findOne({
    tenant: tenantId, warehouse: warehouseId, subProduct, size,
  });
  if (!row) {
    row = new WarehouseStock({ tenant: tenantId, warehouse: warehouseId, subProduct, size });
  }
  const before = row.currentQuantity || 0;
  if (type === 'received') row.currentQuantity += quantity;
  else if (type === 'shipped') row.currentQuantity = Math.max(0, row.currentQuantity - quantity);
  else if (type === 'adjusted') row.currentQuantity = Math.max(0, quantity);
  await row.save();

  await WarehouseMovement.create({
    tenant: tenantId, warehouse: warehouseId, subProduct, size,
    type, quantity, balanceAfter: row.currentQuantity, reference: notes, performedBy: userId,
  });
  await recalcSubProductStock(subProduct);

  // Reconcile batches on a downward correction: deplete the shortfall FEFO. An
  // upward adjustment lands in untracked slack (no batch context to attribute it to).
  if (tracksBatch) {
    const removed =
      type === 'shipped' ? Math.min(before, quantity)
      : type === 'adjusted' && row.currentQuantity < before ? before - row.currentQuantity
      : 0;
    if (removed > 0) {
      await batchService.depleteBatchesFefo({ tenantId, warehouseId, subProduct, size, quantity: removed });
    }
  }
  return row;
}

/**
 * Move quantity of one (subProduct, size) from one warehouse to another, atomically.
 */
async function transferStock(
  { subProduct, size, fromWarehouse, toWarehouse, quantity, notes, tracksBatch = false },
  userId,
  tenantId
) {
  if (String(fromWarehouse) === String(toWarehouse)) {
    throw new ValidationError('Source and destination warehouses must differ');
  }
  if (!(quantity > 0)) throw new ValidationError('Quantity must be positive');

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const src = await WarehouseStock.findOne(
        { tenant: tenantId, warehouse: fromWarehouse, subProduct, size }
      ).session(session);
      if (!src || src.currentQuantity < quantity) {
        throw new ValidationError('Insufficient stock in source warehouse');
      }
      src.currentQuantity -= quantity;
      await src.save({ session });

      let dest = await WarehouseStock.findOne(
        { tenant: tenantId, warehouse: toWarehouse, subProduct, size }
      ).session(session);
      if (!dest) {
        dest = new WarehouseStock({
          tenant: tenantId, warehouse: toWarehouse, subProduct, size,
        });
      }
      dest.currentQuantity += quantity;
      await dest.save({ session });

      if (tracksBatch) {
        await batchService.transferBatchesFefo(
          { tenantId, subProduct, size, fromWarehouse, toWarehouse, quantity },
          session
        );
      }

      const transferGroupId = new mongoose.Types.ObjectId();
      await WarehouseMovement.create(
        [
          { tenant: tenantId, warehouse: fromWarehouse, subProduct, size, type: 'transfer_out',
            quantity, balanceAfter: src.currentQuantity, reference: notes, transferGroupId, performedBy: userId },
          { tenant: tenantId, warehouse: toWarehouse, subProduct, size, type: 'transfer_in',
            quantity, balanceAfter: dest.currentQuantity, reference: notes, transferGroupId, performedBy: userId },
        ],
        { session, ordered: true }
      );
      // Total across warehouses is unchanged; recompute as a safety no-op.
      await recalcSubProductStock(subProduct, session);
      result = { from: src, to: dest, transferGroupId };
    });
    return result;
  } finally {
    session.endSession();
  }
}

/**
 * List warehouse batches, optionally filtered by warehouse/subProduct/size.
 * Sorted earliest-expiry first (FEFO order) for the read UI.
 */
async function getBatches({ warehouseId, subProduct, size } = {}, tenantId) {
  const WarehouseBatch = require('../models/WarehouseBatch');
  const q = { tenant: tenantId };
  if (warehouseId) q.warehouse = warehouseId;
  if (subProduct) q.subProduct = subProduct;
  if (size) q.size = size;
  return WarehouseBatch.find(q)
    .populate('size', 'size')
    .sort({ expiryDate: 1, createdAt: 1 })
    .lean();
}

async function getStockByWarehouse(subProductId, tenantId) {
  return WarehouseStock.find({ tenant: tenantId, subProduct: subProductId })
    .populate('warehouse', 'name code type')
    .populate('size', 'size')
    .lean();
}

/**
 * Atomically decrement WarehouseStock for a POS sale and record a 'shipped' movement.
 * Unless allowOverselling is true, the decrement is guarded so it fails (returns null
 * from findOneAndUpdate) when currentQuantity < quantity, throwing a ValidationError.
 */
async function sellStock({ warehouseId, subProduct, size, quantity, allowOverselling = false, tracksBatch = false }, userId, tenantId) {
  const filter = { tenant: tenantId, warehouse: warehouseId, subProduct, size };
  if (!allowOverselling) {
    filter.currentQuantity = { $gte: quantity };
  }

  const row = await WarehouseStock.findOneAndUpdate(
    filter,
    { $inc: { currentQuantity: -quantity } },
    { new: true, upsert: allowOverselling, setDefaultsOnInsert: allowOverselling }
  );
  if (!row) {
    throw new ValidationError('Insufficient stock for this sale');
  }

  const after = row.currentQuantity;
  await WarehouseMovement.create({
    tenant: tenantId, warehouse: warehouseId, subProduct, size,
    type: 'shipped', quantity, balanceAfter: after, performedBy: userId,
  });
  await recalcSubProductStock(subProduct);

  let batchAllocations = [];
  if (tracksBatch) {
    batchAllocations = await batchService.depleteBatchesFefo({
      tenantId, warehouseId, subProduct, size, quantity,
    });
  }

  return { before: after + quantity, after, batchAllocations };
}

/**
 * Atomically increment WarehouseStock for a POS refund/void and record a 'returned'
 * movement. Upserts the (warehouse, subProduct, size) row if it doesn't exist yet.
 */
async function returnStock({ warehouseId, subProduct, size, quantity, batchAllocations = null }, userId, tenantId) {
  const row = await WarehouseStock.findOneAndUpdate(
    { tenant: tenantId, warehouse: warehouseId, subProduct, size },
    { $inc: { currentQuantity: quantity } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const after = row.currentQuantity;
  await WarehouseMovement.create({
    tenant: tenantId, warehouse: warehouseId, subProduct, size,
    type: 'returned', quantity, balanceAfter: after, performedBy: userId,
  });
  await recalcSubProductStock(subProduct);

  if (batchAllocations && batchAllocations.length) {
    await batchService.restoreBatches(batchAllocations);
  }

  return { before: after - quantity, after };
}

/**
 * Resolve the warehouse a POS shop's stock should be sourced from. A custom
 * shop (posSettings.shops entry) uses its bound `warehouse`, or null for
 * aggregate stock if left unbound. The built-in retail/wholesale shops, and
 * any other shopId that doesn't match a custom shop, always use the
 * tenant's default warehouse (Warehouse.isDefault), or null if none is set.
 */
async function resolveShopWarehouse(tenant, tenantId, shopId) {
  let shop = null;
  if (shopId) {
    try {
      shop = tenant?.posSettings?.shops?.id?.(shopId) || null;
    } catch (_) {
      shop = null;
    }
  }
  if (shop) {
    return shop.warehouse || null;
  }
  const def = await Warehouse.findOne({ tenant: tenantId, isDefault: true }).select('_id').lean();
  return def?._id || null;
}

module.exports = {
  createWarehouse, getWarehouses, getWarehouseById, updateWarehouse, deleteWarehouse,
  getWarehouseStock, adjustStock, transferStock, getStockByWarehouse,
  sellStock, returnStock, resolveShopWarehouse, getBatches,
};
