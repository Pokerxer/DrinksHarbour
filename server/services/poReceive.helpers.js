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
          unitCost: item.unitCost || 0,
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

// ── Pure receiving math (DB-less) ────────────────────────────────────────────

/** Stable id for a PO line, whether a plain test object or a Mongoose subdoc. */
function lineId(item) {
  if (item.itemId != null) return String(item.itemId);
  if (item._id != null) return String(item._id);
  return null;
}

/**
 * Units still expected on a line: ordered minus what has landed (receivedQty)
 * minus what was sent back (returnedQty). A returned unit is accounted for, so
 * it is NOT counted as still outstanding. Never returns below zero.
 */
function outstanding(line) {
  const ordered = line.quantity || 0;
  const received = line.receivedQty || 0;
  const returned = line.returnedQty || 0;
  return Math.max(0, ordered - received - returned);
}

/**
 * Accumulate one receipt onto the PO lines WITHOUT mutating them.
 *
 * For each receipt line, receivedQty accumulates (previous + this receipt),
 * clamped so it never exceeds the ordered quantity — unless allowOverReceipt
 * is set. `delta` is the accepted increment for THIS receipt (what should post
 * to stock), so re-receiving never double-posts.
 *
 * @param {Array} poItems   the PO's items (each with quantity, receivedQty, _id/itemId)
 * @param {Array} receiptLines  [{ itemId, receivedQty }] — this receipt's quantities
 * @param {{ allowOverReceipt?: boolean }} [opts]
 * @returns {{ lines: Array<{ itemId, previousReceivedQty, newReceivedQty, delta }> }}
 */
function applyReceipt(poItems, receiptLines, { allowOverReceipt = false } = {}) {
  const byId = new Map((poItems || []).map((it) => [lineId(it), it]));
  const lines = [];

  for (const rl of receiptLines || []) {
    const add = Math.max(0, Number(rl.receivedQty) || 0);
    if (add <= 0) continue;

    const item = byId.get(String(rl.itemId));
    if (!item) continue;

    const previousReceivedQty = item.receivedQty || 0;
    let newReceivedQty = previousReceivedQty + add;
    if (!allowOverReceipt) {
      newReceivedQty = Math.min(newReceivedQty, item.quantity || 0);
    }
    const delta = newReceivedQty - previousReceivedQty;
    if (delta <= 0) continue;

    lines.push({
      itemId: String(rl.itemId),
      previousReceivedQty,
      newReceivedQty,
      delta,
    });
  }

  return { lines };
}

/**
 * Derived receipt status for a PO from its lines:
 *  - 'received'           every line receivedQty >= ordered quantity
 *  - 'partially_received' some (but not all) units received
 *  - null                 nothing received yet (caller keeps current status)
 */
function poReceiptStatus(poItems) {
  const items = poItems || [];
  if (items.length === 0) return null;

  const allFull = items.every((it) => (it.receivedQty || 0) >= (it.quantity || 0));
  if (allFull) return 'received';

  const anyReceived = items.some((it) => (it.receivedQty || 0) > 0);
  if (anyReceived) return 'partially_received';

  return null;
}

/**
 * Project PO lines into the lines that still need to post to inventory, with
 * receivedQty set to the UNPOSTED delta (receivedQty - postedQty). Feed the
 * result to postReceivedStock so a validate posts only what has not yet been
 * posted — making repeated validates across partial receipts idempotent.
 * @returns {Array} shallow clones (receivedQty = delta); empty when nothing pending
 */
function buildPostingLines(poItems) {
  const out = [];
  for (const it of poItems || []) {
    const delta = (it.receivedQty || 0) - (it.postedQty || 0);
    if (delta <= 0) continue;
    out.push({ ...it, receivedQty: delta });
  }
  return out;
}

module.exports = {
  resolveTargetWarehouse,
  postReceivedStock,
  applyReceipt,
  poReceiptStatus,
  outstanding,
  buildPostingLines,
};
