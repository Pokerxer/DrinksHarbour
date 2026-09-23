// services/vendorReturn.stock.js
// Inventory side of a vendor return (purchase refund): when a return is
// CONFIRMED the returned goods physically leave their warehouse, so stock is
// deducted there and a `return_out` movement + InventoryMovement mirror are
// posted. Cancelling a confirmed return reverses it (goods come back in as a
// `returned` movement). Money stays on the VendorReturn document
// (recordRefund) — this file only owns the goods ledger.
//
// Deps are injected so unit tests run without MongoDB (same pattern as
// stockTransferReturn.js / stockTransferReceive.js).
const { ValidationError } = require('../utils/errors');

function returnLines(items = []) {
  const grouped = new Map();
  for (const item of items) {
    if (!item.subProductId || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new ValidationError('Every returned item needs a product and a positive integer quantity');
    }
    const key = `${item.subProductId}:${item.sizeId || ''}`;
    const line = grouped.get(key);
    if (line) line.quantity += item.quantity;
    else grouped.set(key, { subProductId: item.subProductId, subProductName: item.subProductName, sizeId: item.sizeId, quantity: item.quantity });
  }
  return [...grouped.values()];
}

function defaultDeps(deps) {
  return {
    WarehouseStock: deps.WarehouseStock || require('../models/WarehouseStock'),
    WarehouseMovement:
      deps.WarehouseMovement || require('../models/WarehouseMovement'),
    InventoryMovement:
      deps.InventoryMovement || require('../models/InventoryMovement'),
    recalcSubProductStock:
      deps.recalcSubProductStock || require('./warehouseStock.helpers').recalcSubProductStock,
  };
}

/**
 * Deduct returned goods from the return's warehouse. Idempotent: once
 * stockAdjusted is set it is a no-op. Throws before mutating anything if any
 * line cannot be covered by the warehouse's on-hand.
 */
async function applyVendorReturnStock(vendorReturn, { tenantId, userId }, deps = {}) {
  const D = defaultDeps(deps);

  if (vendorReturn.stockAdjusted) return { applied: false, reason: 'already-applied' };
  if (!vendorReturn.warehouse) {
    throw new ValidationError('A warehouse is required to deduct returned stock');
  }

  const lines = returnLines(vendorReturn.items);
  if (!lines.length) {
    throw new ValidationError('No returnable items on this return');
  }

  // Pre-flight against every row BEFORE mutating anything.
  const held = [];
  for (const line of lines) {
    const q = {
      tenant: tenantId,
      warehouse: vendorReturn.warehouse,
      subProduct: line.subProductId,
    };
    if (line.sizeId) q.size = line.sizeId;
    const row = await D.WarehouseStock.findOne(q);
    if (!row || row.currentQuantity < line.quantity) {
      throw new ValidationError(
        `Insufficient stock to return to the vendor for ${
          line.subProductName || 'a product'
        } (have ${row ? row.currentQuantity : 0}, need ${line.quantity})`
      );
    }
    held.push({ line, row });
  }

  const ref = `Vendor return ${vendorReturn.returnNumber}`;
  for (const { line, row } of held) {
    const before = row.currentQuantity;
    row.currentQuantity = before - line.quantity;
    await row.save();

    await D.WarehouseMovement.create({
      tenant: tenantId,
      warehouse: vendorReturn.warehouse,
      subProduct: line.subProductId,
      size: row.size,
      type: 'return_out',
      quantity: line.quantity,
      balanceAfter: row.currentQuantity,
      reference: ref,
      performedBy: userId,
    });

    await D.InventoryMovement.create({
      tenant: tenantId,
      subProduct: line.subProductId,
      size: row.size,
      warehouse: vendorReturn.warehouse,
      type: 'return_out',
      category: 'out',
      quantity: line.quantity,
      quantityBefore: before,
      quantityAfter: row.currentQuantity,
      reference: ref,
      referenceType: 'vendor_return',
      relatedPurchaseOrder: vendorReturn.purchaseOrder,
      supplier: vendorReturn.vendor,
      supplierName: vendorReturn.vendorName,
      performedBy: userId,
      source: 'system',
    });

    await D.recalcSubProductStock(line.subProductId);
  }

  vendorReturn.stockAdjusted = true;
  await vendorReturn.save();
  return { applied: true, lines: held.length };
}

/**
 * Reverse a previously-applied return (cancelling a confirmed return): goods
 * come back into the warehouse as a `returned` movement. Idempotent in the
 * other direction (no-op unless stockAdjusted is currently true).
 */
async function reverseVendorReturnStock(vendorReturn, { tenantId, userId }, deps = {}) {
  const D = defaultDeps(deps);

  if (!vendorReturn.stockAdjusted) return { applied: false, reason: 'not-applied' };
  if (!vendorReturn.warehouse) {
    throw new ValidationError('Return has no warehouse to restore');
  }

  const lines = returnLines(vendorReturn.items);

  const ref = `Vendor return ${vendorReturn.returnNumber} restored`;
  for (const line of lines) {
    const q = {
      tenant: tenantId,
      warehouse: vendorReturn.warehouse,
      subProduct: line.subProductId,
    };
    if (line.sizeId) q.size = line.sizeId;
    let row = await D.WarehouseStock.findOne(q);
    if (!row) {
      // Everything was returned earlier — re-create the stock row to accept
      // the goods back. (Same recovery the transfer receive path uses.)
      row = new D.WarehouseStock({
        tenant: tenantId,
        warehouse: vendorReturn.warehouse,
        subProduct: line.subProductId,
        ...(line.sizeId ? { size: line.sizeId } : {}),
        currentQuantity: 0,
      });
    }
    const before = row.currentQuantity;
    row.currentQuantity = before + line.quantity;
    await row.save();

    await D.WarehouseMovement.create({
      tenant: tenantId,
      warehouse: vendorReturn.warehouse,
      subProduct: line.subProductId,
      size: row.size,
      type: 'returned',
      quantity: line.quantity,
      balanceAfter: row.currentQuantity,
      reference: ref,
      performedBy: userId,
    });

    await D.InventoryMovement.create({
      tenant: tenantId,
      subProduct: line.subProductId,
      size: row.size,
      warehouse: vendorReturn.warehouse,
      type: 'return',
      category: 'in',
      quantity: line.quantity,
      quantityBefore: before,
      quantityAfter: row.currentQuantity,
      reference: ref,
      referenceType: 'vendor_return',
      relatedPurchaseOrder: vendorReturn.purchaseOrder,
      supplier: vendorReturn.vendor,
      supplierName: vendorReturn.vendorName,
      performedBy: userId,
      source: 'system',
    });

    await D.recalcSubProductStock(line.subProductId);
  }

  vendorReturn.stockAdjusted = false;
  await vendorReturn.save();
  return { applied: true, lines: lines.length };
}

module.exports = {
  applyVendorReturnStock,
  reverseVendorReturnStock,
};