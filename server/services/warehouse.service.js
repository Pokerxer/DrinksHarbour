// services/warehouse.service.js
const mongoose = require('mongoose');
const Warehouse = require('../models/Warehouse');
const WarehouseStock = require('../models/WarehouseStock');
const WarehouseMovement = require('../models/WarehouseMovement');
const { recalcSubProductStock } = require('./warehouseStock.helpers');
const { NotFoundError, ValidationError } = require('../utils/errors');

// ── Place CRUD ──────────────────────────────────────────────
async function createWarehouse(data, userId, tenantId) {
  if (data.isDefault) {
    await Warehouse.updateMany({ tenant: tenantId }, { $set: { isDefault: false } });
  }
  return Warehouse.create({ ...data, tenant: tenantId, createdBy: userId });
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
    .populate('subProduct', 'sku')
    .populate('size', 'size')
    .sort({ updatedAt: -1 })
    .lean();
}

/**
 * Adjust stock for one (warehouse, subProduct, size) line.
 * type: 'received' | 'shipped' | 'adjusted'
 *   received → +quantity, shipped → -quantity, adjusted → set to quantity (absolute)
 */
async function adjustStock({ warehouseId, subProduct, size, quantity, type, notes }, userId, tenantId) {
  if (!['received', 'shipped', 'adjusted'].includes(type)) {
    throw new ValidationError('Invalid adjustment type');
  }
  let row = await WarehouseStock.findOne({
    tenant: tenantId, warehouse: warehouseId, subProduct, size,
  });
  if (!row) {
    row = new WarehouseStock({ tenant: tenantId, warehouse: warehouseId, subProduct, size });
  }
  if (type === 'received') row.currentQuantity += quantity;
  else if (type === 'shipped') row.currentQuantity = Math.max(0, row.currentQuantity - quantity);
  else if (type === 'adjusted') row.currentQuantity = Math.max(0, quantity);
  await row.save();

  await WarehouseMovement.create({
    tenant: tenantId, warehouse: warehouseId, subProduct, size,
    type, quantity, balanceAfter: row.currentQuantity, reference: notes, performedBy: userId,
  });
  await recalcSubProductStock(subProduct);
  return row;
}

/**
 * Move quantity of one (subProduct, size) from one warehouse to another, atomically.
 */
async function transferStock(
  { subProduct, size, fromWarehouse, toWarehouse, quantity, notes },
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

      const transferGroupId = new mongoose.Types.ObjectId();
      await WarehouseMovement.create(
        [
          { tenant: tenantId, warehouse: fromWarehouse, subProduct, size, type: 'transfer_out',
            quantity, balanceAfter: src.currentQuantity, reference: notes, transferGroupId, performedBy: userId },
          { tenant: tenantId, warehouse: toWarehouse, subProduct, size, type: 'transfer_in',
            quantity, balanceAfter: dest.currentQuantity, reference: notes, transferGroupId, performedBy: userId },
        ],
        { session }
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

async function getStockByWarehouse(subProductId, tenantId) {
  return WarehouseStock.find({ tenant: tenantId, subProduct: subProductId })
    .populate('warehouse', 'name code type')
    .populate('size', 'size')
    .lean();
}

module.exports = {
  createWarehouse, getWarehouses, getWarehouseById, updateWarehouse, deleteWarehouse,
  getWarehouseStock, adjustStock, transferStock, getStockByWarehouse,
};
