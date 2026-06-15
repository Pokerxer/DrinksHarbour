// server/services/poReceive.helpers.js
const { ValidationError } = require('../utils/errors');

/**
 * Decide which warehouse received stock should land in.
 * @param {string|undefined|null} warehouseId  explicit choice from the request body
 * @param {string|undefined|null} defaultWarehouseId  the tenant's default warehouse id (may be null)
 * @returns {string} the resolved warehouse id
 * @throws {ValidationError} when neither resolves
 */
function resolveTargetWarehouse(warehouseId, defaultWarehouseId) {
  const target = warehouseId || defaultWarehouseId;
  if (!target) {
    throw new ValidationError(
      'Select a destination warehouse (or set a default) before validating.'
    );
  }
  return target;
}

/**
 * Post each received PO line into the target warehouse via the injected adjustStock.
 * Lines missing subProductId or sizeId are skipped and counted as failures.
 * @returns {Promise<{ successCount: number, failCount: number }>}
 */
async function postReceivedStock({
  purchaseOrder,
  targetWarehouseId,
  adjustStock,
  userId,
  tenantId,
  logger = console,
}) {
  let successCount = 0;
  let failCount = 0;

  for (const item of purchaseOrder.items) {
    const quantityToAdd =
      item.receivedQty !== undefined &&
      item.receivedQty !== null &&
      item.receivedQty > 0
        ? item.receivedQty
        : item.quantity;

    if (quantityToAdd <= 0) {
      continue;
    }

    if (!item.subProductId || !item.sizeId) {
      const missing = !item.subProductId ? 'subProductId' : 'sizeId';
      logger.log(
        `   ❌ Skipping line — missing ${missing} (${item.subProductName || item.sku || 'unknown item'})`
      );
      failCount++;
      continue;
    }

    try {
      await adjustStock(
        {
          warehouseId: targetWarehouseId,
          subProduct: item.subProductId,
          size: item.sizeId,
          quantity: quantityToAdd,
          type: 'received',
          notes: `PO Receipt: ${purchaseOrder.poNumber}`,
        },
        userId,
        tenantId
      );
      successCount++;
    } catch (err) {
      logger.error(`   ❌ Failed to post line to warehouse: ${err.message}`);
      failCount++;
    }
  }

  return { successCount, failCount };
}

module.exports = { resolveTargetWarehouse, postReceivedStock };
