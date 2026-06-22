// server/services/salesFulfill.service.js
const { applyFulfillment, buildPostingLines, fulfillStatus, postShippedStock } = require('./salesFulfill.helpers');

/**
 * Apply one additive fulfillment to an order:
 *  1. applyFulfillment -> per-line deltas (clamped to outstanding)
 *  2. advance fulfilledQty on the lines
 *  3. post the UNPOSTED delta to stock (adjustStock type:'shipped'); advance postedQty
 *  4. write Sales rows for the shipped delta (channel: 'tenant_manual')
 *  5. append a fulfillments[] entry + recompute orderStatus
 * deps = { adjustStock, SalesModel }
 */
async function fulfillOrder({ salesOrder, tenantId, warehouseId, fulfillLines, userId, deps }) {
  const adjustStock = deps.adjustStock || require('./warehouse.service').adjustStock;
  const SalesModel = deps.SalesModel || require('../models/Sales');

  // 1 + 2: accumulate fulfilledQty (optimistic; rolled back below for lines that fail to post)
  const { lines } = applyFulfillment(salesOrder.items, fulfillLines);
  if (lines.length === 0) {
    return { order: salesOrder, salesRows: [], posting: { successCount: 0, failCount: 0, failures: [], postedLineIds: [] } };
  }
  const byId = new Map(salesOrder.items.map((it) => [String(it._id), it]));
  const previousFulfilledById = new Map(lines.map((l) => [String(l.lineId), l.previousFulfilledQty]));
  for (const l of lines) {
    const item = byId.get(String(l.lineId));
    if (item) item.fulfilledQty = l.newFulfilledQty;
  }

  // 3: post unposted delta to stock
  const postingLines = buildPostingLines(salesOrder.items);
  const posting = await postShippedStock({
    salesOrder, targetWarehouseId: warehouseId, postingLines, adjustStock, userId, tenantId,
  });
  const postedIdSet = new Set((posting.postedLineIds || []).map(String));

  // advance postedQty / write Sales rows ONLY for lines that actually posted;
  // roll back the optimistic fulfilledQty bump for lines whose adjustStock failed
  // so they stay outstanding and get retried on the next /fulfill call.
  const salesRows = [];
  const postedLines = [];
  for (const pl of postingLines) {
    const id = String(pl._id);
    const item = byId.get(id);
    if (!item) continue;

    if (!postedIdSet.has(id)) {
      if (previousFulfilledById.has(id)) {
        item.fulfilledQty = previousFulfilledById.get(id);
      }
      continue;
    }

    item.postedQty = item.fulfilledQty;
    postedLines.push(pl);

    const qty = pl.qty;
    const priceAtSale = Math.max(0, (item.unitPrice || 0) - (item.discount || 0));
    const row = await SalesModel.create({
      tenant: tenantId,
      product: item.product, subproduct: item.subproduct, size: item.size,
      quantity: qty, priceAtSale, itemSubtotal: priceAtSale * qty,
      channel: 'tenant_manual', channelDetail: `Sales order ${salesOrder.soNumber}`,
    });
    const rowId = row._id || row;
    salesRows.push(rowId);
    if (!Array.isArray(salesOrder.relatedSales)) salesOrder.relatedSales = [];
    salesOrder.relatedSales.push(rowId);
  }

  // 5: fulfillment entry (only successfully-posted lines) + status from actual shipped qtys
  if (postedLines.length > 0) {
    salesOrder.fulfillments.push({
      warehouseId,
      items: postedLines.map((pl) => ({ lineId: String(pl._id), qty: pl.qty })),
      status: 'posted', at: new Date(), by: userId,
    });
  }
  const status = fulfillStatus(salesOrder.items);
  if (status) salesOrder.orderStatus = status;

  await salesOrder.save();
  return { order: salesOrder, salesRows, posting };
}

/**
 * Restock returned units and reverse the ledger. returnedQty advances (clamped to
 * fulfilledQty). Stock goes back via adjustStock(type:'received'); an
 * InventoryMovement is recorded with referenceType:'return' (valid enum member).
 * deps = { adjustStock, recordMovement }
 */
async function returnOrder({ salesOrder, tenantId, warehouseId, returnLines, userId, deps }) {
  const adjustStock = deps.adjustStock || require('./warehouse.service').adjustStock;
  const recordMovement = deps.recordMovement || null;

  const byId = new Map(salesOrder.items.map((it) => [String(it._id), it]));
  const restock = { successCount: 0, failures: [] };

  for (const rl of returnLines || []) {
    const item = byId.get(String(rl.lineId));
    if (!item) continue;
    const maxReturnable = (item.fulfilledQty || 0) - (item.returnedQty || 0);
    const qty = Math.min(Math.max(0, Number(rl.qty) || 0), maxReturnable);
    if (qty <= 0) continue;

    try {
      const row = await adjustStock(
        { warehouseId, subProduct: item.subproduct, size: item.size, quantity: qty,
          type: 'received', notes: `Sales return: ${salesOrder.soNumber}` },
        userId, tenantId
      );
      item.returnedQty = (item.returnedQty || 0) + qty;
      restock.successCount++;

      if (recordMovement) {
        try {
          await recordMovement({
            subProduct: item.subproduct, tenant: tenantId, product: item.product, size: item.size,
            warehouse: warehouseId, quantity: qty,
            balanceAfter: row && Number.isFinite(row.currentQuantity) ? row.currentQuantity : undefined,
            reference: salesOrder.soNumber, referenceType: 'return', performedBy: userId,
          });
        } catch (_) { /* history non-fatal */ }
      }
    } catch (err) {
      restock.failures.push({ lineId: String(rl.lineId), reason: err.message });
    }
  }

  await salesOrder.save();
  return { order: salesOrder, restock };
}

module.exports = { fulfillOrder, returnOrder };
