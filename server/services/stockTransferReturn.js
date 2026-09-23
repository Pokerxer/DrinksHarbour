// services/stockTransferReturn.js
//
// Reverse half of a stock transfer, launched from a warehouse movement's
// history entry. Given a transfer_in / transfer_out WarehouseMovement, the
// line's goods move back to the originating warehouse and, when the movement
// came from the StockTransfer module (reference "Transfer TRF-…"), the money
// the destination owes the source is reversed too.
//
// Mirrors stockTransferReceive.js: documents/status live in the controller —
// this module touches inventory, money snapshots and leading ledgers. Deps are
// injected so the core can be exercised without MongoDB.

const { ValidationError, NotFoundError } = require("../utils/errors");
const { computeTransferMoney } = require("./stockTransfer.money");

// StockTransfer module movements reference their number: "Transfer TRF-…".
const TRANSFER_REF_RE = /^Transfer\s+([A-Z0-9-]+)\s*$/i;

/**
 * Track a transfer movement back to its origin. Returns a resolution context:
 *   → { kind:'module', transfer, item, itemIndex, here, holding, other,
 *       transferNumber, returnable, currency }
 *   → { kind:'light', here, holding, other, returnable:null }
 * `holding` is the warehouse that physically has the goods today (the original
 * destination); `other` is the warehouse receiving the return (the origin).
 * `returnable` limits a module return to what was received and not yet returned.
 */
async function resolveTransferReturn({ movement, tenantId }, deps = {}) {
  const {
    WarehouseMovement = require("../models/WarehouseMovement"),
    StockTransfer = require("../models/StockTransfer"),
  } = deps;

  const here = movement.warehouse;

  // StockTransfer module transfers reference their number in both movements.
  const m = TRANSFER_REF_RE.exec(movement.reference || "");
  if (m) {
    const transfer = await StockTransfer.findOne({
      tenant: tenantId,
      transferNumber: m[1],
    });
    if (!transfer) throw new NotFoundError("Originating transfer not found");

    const hereIsDestination =
      String(here) === String(transfer.destinationWarehouse);
    if (
      (movement.type === "transfer_in" && !hereIsDestination) ||
      (movement.type === "transfer_out" && String(here) !== String(transfer.sourceWarehouse))
    ) {
      throw new ValidationError("Movement does not match the transfer warehouses");
    }

    const itemIndex = (transfer.items || []).findIndex((it) => {
      if (String(it.subProductId) !== String(movement.subProduct)) return false;
      return it.sizeId
        ? String(it.sizeId) === String(movement.size)
        : true;
    });
    if (itemIndex < 0) {
      throw new ValidationError("Unable to match movement to a transfer line");
    }
    const item = transfer.items[itemIndex];

    return {
      kind: "module",
      movement,
      transfer,
      item,
      itemIndex,
      here,
      holding: transfer.destinationWarehouse,
      other: transfer.sourceWarehouse,
      transferNumber: transfer.transferNumber,
      returnable: Math.max(
        0,
        (item.receivedQty || 0) - (item.returnedQty || 0)
      ),
      currency: transfer.currency || "NGN",
    };
  }

  // Lightweight warehouse transfers pair their movements via transferGroupId.
  if (movement.transferGroupId) {
    const pair = await WarehouseMovement.findOne({
      tenant: tenantId,
      transferGroupId: movement.transferGroupId,
      _id: { $ne: movement._id },
    }).lean();
    if (!pair) {
      throw new ValidationError("Transfer pair not found for this movement");
    }
    const sourceWarehouse =
      movement.type === "transfer_in" ? pair.warehouse : here;
    const destinationWarehouse =
      movement.type === "transfer_in" ? here : pair.warehouse;
    return {
      kind: "light",
      movement,
      here,
      holding: destinationWarehouse,
      other: sourceWarehouse,
      transferNumber: null,
      returnable: null,
    };
  }

  throw new ValidationError(
    "Unable to resolve the originating transfer for this movement"
  );
}

/**
 * Effective unit cost a returned module line comes back at — the value the
 * destination lot was written at (net + tax + charge share)/qty.
 */
function transferLineEffectiveUnitCost(transfer, itemIndex) {
  try {
    const money = computeTransferMoney(transfer.items, transfer.deliveryCharge);
    return money.lines[itemIndex]?.effectiveUnitCost ?? null;
  } catch {
    return null;
  }
}

/**
 * Move `quantity` back from the holding warehouse to the origin and post the
 * return movements on both sides. Stock-authoritative: checks currentQuantity
 * on the warehouse that physically holds the goods before touching anything.
 */
async function returnTransferStock(ctx, { quantity, tenantId, userId, note }, deps = {}) {
  const {
    WarehouseStock = require("../models/WarehouseStock"),
    WarehouseMovement = require("../models/WarehouseMovement"),
    InventoryMovement = require("../models/InventoryMovement"),
    batchService = require("./batch.service"),
    recalcSubProductStock = require("./warehouseStock.helpers").recalcSubProductStock,
    effectiveUnitCost = transferLineEffectiveUnitCost,
  } = deps;

  const qty = Number(quantity);
  if (!Number.isSafeInteger(qty) || qty <= 0) throw new ValidationError("quantity must be a positive integer");
  if (ctx.returnable !== null && ctx.returnable < qty) {
    throw new ValidationError(
      `Cannot return more than received for this line (${ctx.returnable} available)`
    );
  }

  const { movement, holding, other } = ctx;

  const holdingQuery = { tenant: tenantId, warehouse: holding, subProduct: movement.subProduct };
  if (movement.size) holdingQuery.size = movement.size;
  const hold = await WarehouseStock.findOne(holdingQuery);
  const available = hold ? hold.currentQuantity : 0;
  if (available < qty) {
    throw new ValidationError(
      `Insufficient stock to return: ${available} available, ${qty} requested`
    );
  }

  hold.currentQuantity -= qty;
  await hold.save();

  const recvQuery = { tenant: tenantId, warehouse: other, subProduct: movement.subProduct };
  if (movement.size) recvQuery.size = movement.size;
  let recv = await WarehouseStock.findOne(recvQuery);
  if (!recv) {
    recv = new WarehouseStock({
      tenant: tenantId,
      warehouse: other,
      subProduct: movement.subProduct,
      size: movement.size || hold.size || undefined,
    });
    recv.currentQuantity = 0;
  }
  recv.currentQuantity += qty;
  await recv.save();

  // Batches travel back at the value they were written at on the way out
  // (module transfers revalue the destination lot; lightweight transfers keep
  // the source lot cost, so no revalue is passed there).
  const destUnitCost =
    ctx.kind === "module"
      ? effectiveUnitCost(ctx.transfer, ctx.itemIndex)
      : null;
  await batchService.transferBatchesFefo({
    tenantId,
    subProduct: movement.subProduct,
    size: movement.size || undefined,
    fromWarehouse: holding,
    toWarehouse: other,
    quantity: qty,
    ...(typeof destUnitCost === "number" ? { destUnitCost } : {}),
  });

  const ref = `Return of ${
    ctx.transferNumber
      ? `transfer ${ctx.transferNumber}`
      : String(movement.reference || movement.transferGroupId || "transfer").slice(0, 100)
  }`;

  const holdAfter = hold.currentQuantity;
  const recvAfter = recv.currentQuantity;

  await WarehouseMovement.create([
    {
      tenant: tenantId, warehouse: holding, subProduct: movement.subProduct,
      size: hold.size || movement.size, type: "transfer_out", quantity: qty,
      balanceAfter: holdAfter, reference: ref, performedBy: userId,
      parentMovement: movement._id,
    },
    {
      tenant: tenantId, warehouse: other, subProduct: movement.subProduct,
      size: recv.size || movement.size, type: "returned", quantity: qty,
      balanceAfter: recvAfter, reference: ref, performedBy: userId,
      parentMovement: movement._id,
    },
  ]);

  // Mirror into the unified ledger so product history/summary sees the return.
  try {
    await InventoryMovement.create([
      {
        subProduct: movement.subProduct, tenant: tenantId, warehouse: holding,
        size: movement.size, type: "transfer_out", category: "transfer",
        quantity: qty, quantityBefore: available, quantityAfter: holdAfter,
        sourceWarehouse: holding, destinationWarehouse: other,
        reference: ref.slice(0, 100), referenceType: "transfer",
        reason: note ? String(note).slice(0, 200) : undefined,
        performedBy: userId, performedAt: new Date(), source: "system",
      },
      {
        subProduct: movement.subProduct, tenant: tenantId, warehouse: other,
        size: movement.size, type: "return", category: "in",
        quantity: qty, quantityBefore: recvAfter - qty, quantityAfter: recvAfter,
        sourceWarehouse: holding, destinationWarehouse: other,
        reference: ref.slice(0, 100), referenceType: "return",
        reason: note ? String(note).slice(0, 200) : undefined,
        performedBy: userId, performedAt: new Date(), source: "system",
      },
    ]);
  } catch (err) {
    // The warehouse ledger is authoritative; a mirror write must not roll
    // back a completed stock operation. Surface for monitoring.
    console.error("[stockTransferReturn] InventoryMovement mirror failed:", err.message);
  }

  await recalcSubProductStock(movement.subProduct);

  return { before: available, holdingAfter: holdAfter, receivingAfter: recvAfter };
}

/**
 * Money snapshot over the still-unreturned quantity. Mirrors
 * applyTransferMoney in the controller but nets each line's returnedQty.
 */
function applyTransferMoneyRemaining(transfer) {
  const originalNet = (transfer.items || []).reduce((sum, item) => {
    const gross = (Number(item.costPrice) || 0) * (Number(item.quantity) || 0);
    return sum + gross * (1 - (Number(item.discountRate) || 0) / 100);
  }, 0);
  const effectiveItems = (transfer.items || []).map((it) => ({
    costPrice: it.costPrice,
    discountRate: it.discountRate,
    taxRate: it.taxRate,
    quantity: Math.max(0, (it.quantity || 0) - (it.returnedQty || 0)),
  }));
  const remainingNet = effectiveItems.reduce((sum, item) => {
    const gross = (Number(item.costPrice) || 0) * (Number(item.quantity) || 0);
    return sum + gross * (1 - (Number(item.discountRate) || 0) / 100);
  }, 0);
  const remainingDeliveryCharge =
    originalNet > 0
      ? (Number(transfer.deliveryCharge) || 0) * (remainingNet / originalNet)
      : 0;
  const m = computeTransferMoney(effectiveItems, remainingDeliveryCharge);
  transfer.subtotal = m.subtotal;
  transfer.discountAmount = m.discountAmount;
  transfer.taxAmount = m.taxAmount;
  transfer.total = m.total;
  transfer.totalValue = m.total;
  return m;
}

/**
 * Reverse the destination→source liability for the returned lines: drop the
 * received/transferred counts, record the return, recompute the money snapshot
 * over unreturned quantities and re-capture the tax posting.
 */
async function reverseTransferMoney(ctx, { quantity, userId, note }, deps = {}) {
  const {
    reverseDocumentTax = require("../services/tax.service").reverseDocumentTax,
    captureDocumentTax = require("../services/tax.service").captureDocumentTax,
  } = deps;

  const { transfer, item, itemIndex } = ctx;
  const qty = Number(quantity);

  // Receipt counters are historical. Returns must not reopen a completed
  // transfer for receiving or subtract the returned units twice.
  item.returnedQty = (item.returnedQty || 0) + qty;

  if (!Array.isArray(transfer.returns)) transfer.returns = [];
  transfer.returns.push({
    returnedBy: userId,
    returnedAt: new Date(),
    lines: [
      {
        itemIndex,
        quantity: qty,
        ...(note ? { note: String(note).slice(0, 200) } : {}),
      },
    ],
  });

  applyTransferMoneyRemaining(transfer);
  await transfer.save();

  await reverseDocumentTax({ sourceType: "stock_transfer", doc: transfer, userId });
  await captureDocumentTax({ sourceType: "stock_transfer", doc: transfer, postedBy: userId });
}

module.exports = {
  resolveTransferReturn,
  returnTransferStock,
  reverseTransferMoney,
  applyTransferMoneyRemaining,
  transferLineEffectiveUnitCost,
};
