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
 * Post each received PO line into the target warehouse via the injected adjustStock,
 * and write the sub-product history (InventoryMovement) via the injected recordMovement.
 *
 * Right-sizing is resolved upstream (controller) so every postable line carries a
 * sizeId — WarehouseStock.size is required, so even sellWithoutSizeVariants products
 * resolve to their single/default Size. A line that still lacks subProductId or sizeId
 * is NOT silently dropped: it is recorded as a surfaced failure (returned in `failures`)
 * so the caller can report it instead of losing stock quietly.
 *
 * @returns {Promise<{ successCount: number, failCount: number, failures: Array<{name: string, reason: string}> }>}
 */
async function postReceivedStock({
  purchaseOrder,
  targetWarehouseId,
  adjustStock,
  receiveBatch,
  generateBatchNumber,
  recordMovement,
  userId,
  tenantId,
  logger = console,
}) {
  let successCount = 0;
  let failCount = 0;
  const failures = [];

  const lineLabel = (item) =>
    item.subProductName || item.sku || String(item.subProductId || 'unknown item');

  const fail = (item, reason) => {
    logger.error(`   ❌ ${lineLabel(item)} — ${reason}`);
    failures.push({ name: lineLabel(item), reason });
    failCount++;
  };

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

    if (!item.subProductId) {
      fail(item, 'missing sub-product reference');
      continue;
    }
    if (!item.sizeId) {
      fail(item, 'could not resolve a size variant to receive into');
      continue;
    }

    try {
      const effectiveBatchNumber =
        (item.receivedBatchNumber && String(item.receivedBatchNumber).trim()) || null;

      if (item.tracksBatch) {
        const batchNumber =
          effectiveBatchNumber ||
          (await generateBatchNumber({
            tenantId,
            warehouseId: targetWarehouseId,
            subProduct: item.subProductId,
            size: item.sizeId,
            sku: item.sku || 'BATCH',
            date: new Date(),
          }));
        await receiveBatch({
          tenantId,
          warehouseId: targetWarehouseId,
          subProduct: item.subProductId,
          size: item.sizeId,
          product: item.productId,
          batchNumber,
          quantity: quantityToAdd,
          expiryDate: item.receivedExpiryDate || null,
          sourcePO: purchaseOrder._id,
          poNumber: purchaseOrder.poNumber,
        });
      }

      const row = await adjustStock(
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

      // History is recorded after the stock posts. A history-write failure is logged
      // loudly but does not flip the line to failed — the stock has already landed.
      if (recordMovement) {
        const balanceAfter = row && Number.isFinite(row.currentQuantity)
          ? row.currentQuantity
          : undefined;
        try {
          await recordMovement({
            subProduct: item.subProductId,
            tenant: tenantId,
            product: item.productId,
            size: item.sizeId,
            warehouse: targetWarehouseId,
            quantity: quantityToAdd,
            balanceBefore:
              balanceAfter !== undefined ? balanceAfter - quantityToAdd : undefined,
            balanceAfter,
            unitCost: item.unitCost,
            supplierName: purchaseOrder.vendorName,
            reference: purchaseOrder.poNumber,
            relatedPurchaseOrder: purchaseOrder._id,
            batchNumber: effectiveBatchNumber,
            expirationDate: item.receivedExpiryDate || null,
            performedBy: userId,
          });
        } catch (histErr) {
          logger.error(
            `   ⚠️ Stock posted but history write failed for ${lineLabel(item)}: ${histErr.message}`
          );
        }
      }
    } catch (err) {
      fail(item, err.message);
    }
  }

  return { successCount, failCount, failures };
}

module.exports = { resolveTargetWarehouse, postReceivedStock };
