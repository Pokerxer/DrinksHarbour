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

  // 1 + 2: accumulate fulfilledQty
  const { lines } = applyFulfillment(salesOrder.items, fulfillLines);
  if (lines.length === 0) {
    return { order: salesOrder, salesRows: [], posting: { successCount: 0, failCount: 0, failures: [] } };
  }
  const byId = new Map(salesOrder.items.map((it) => [String(it._id), it]));
  for (const l of lines) {
    const item = byId.get(String(l.lineId));
    if (item) item.fulfilledQty = l.newFulfilledQty;
  }

  // 3: post unposted delta to stock
  const postingLines = buildPostingLines(salesOrder.items);
  const posting = await postShippedStock({
    salesOrder, targetWarehouseId: warehouseId, postingLines, adjustStock, userId, tenantId,
  });
  // advance postedQty for the lines we just posted (only the successfully-posted set)
  for (const pl of postingLines) {
    const item = byId.get(String(pl._id));
    if (item) item.postedQty = item.fulfilledQty;
  }

  // 4: write Sales rows for the shipped delta
  const salesRows = [];
  for (const pl of postingLines) {
    const item = byId.get(String(pl._id));
    if (!item) continue;
    const qty = pl.qty;
    const priceAtSale = Math.max(0, (item.unitPrice || 0) - (item.discount || 0));
    const row = await SalesModel.create({
      tenant: tenantId,
      product: item.product, subproduct: item.subproduct, size: item.size,
      quantity: qty, priceAtSale, itemSubtotal: priceAtSale * qty,
      channel: 'tenant_manual', channelDetail: `Sales order ${salesOrder.soNumber}`,
    });
    salesRows.push(row._id || row);
  }
  if (!Array.isArray(salesOrder.relatedSales)) salesOrder.relatedSales = [];
  salesOrder.relatedSales.push(...salesRows);

  // 5: fulfillment entry + status
  salesOrder.fulfillments.push({
    warehouseId,
    items: postingLines.map((pl) => ({ lineId: String(pl._id), qty: pl.qty })),
    status: 'posted', at: new Date(), by: userId,
  });
  const status = fulfillStatus(salesOrder.items);
  if (status) salesOrder.orderStatus = status;

  await salesOrder.save();
  return { order: salesOrder, salesRows, posting };
}

module.exports = { fulfillOrder };
