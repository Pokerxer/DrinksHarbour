const { known } = require('./tenantProductInsights.rules');
const { uncertainProducts } = require('./tenantProductInsights.salesEvidence');
const { recoverInsightReceipts } = require('./insightReceiptRecovery');
const { settled } = require('./posSessionTotals.service');
const {
  id,
  matchingLine,
  buildLinkedReturnState,
} = require('./linkedReturns.helpers');
const units = (v) => (known(v) ? v : 0);
function normalizeOrderUnits(order, tenantId, { locations = false, details = false } = {}) {
  if (!settled(order)) return [];
  if (order.source !== 'pos') {
    const ownStatus =
      order.fulfillmentStatus?.[tenantId] ||
      order.fulfillmentStatus?.get?.(tenantId);
    if ((ownStatus || order.status) !== 'delivered') return [];
  }
  const at =
    order.source === 'pos'
      ? order.paidAt || order.createdAt
      : order.deliveredAt;
  return (order.items || []).flatMap((item, index) => {
    if (
      id(item.tenant || (order.source === 'pos' ? order.tenant : null)) !==
        id(tenantId) ||
      !item.subproduct ||
      !known(item.quantity)
    )
      return [];
    let refunds = 0,
      overlap = 0,
      sales = 0;
    for (const refund of order.refunds || []) {
      if (refund.source === 'sales') continue;
      for (const r of refund.items || [])
        if (r.orderItemIndex === index) {
          refunds += units(r.quantity);
          overlap += Math.min(
            units(r.quantity),
            units(r.salesReturnedQuantity),
          );
        }
    }
    for (const record of order.salesReturns || [])
      for (const r of record.items || [])
        if (r.orderItemIndex === index) sales += units(r.quantity);
    // Projection supplies historical Sales returns missing in old receipt snapshots.
    sales = Math.max(sales, units(order.projectedSalesReturns?.[index]));
    return [
      {
        ...(details ? { lineIndex: index, gross: item.quantity } : {}),
        subProductId: id(item.subproduct),
        sizeId: id(item.size),
        ...(locations ? { warehouseId: id(item.warehouse) } : {}),
        units: Math.max(
          0,
          item.quantity - refunds - Math.max(0, sales - overlap),
        ),
        at,
      },
    ];
  });
}
function normalizeSalesUnits(
  so,
  receipts,
  tenantId,
  { locations = false, details = false } = {},
) {
  if (
    id(so.tenant) !== id(tenantId) ||
    so.docType !== 'order' ||
    !['fulfilled', 'partially_fulfilled'].includes(so.orderStatus) ||
    so.paymentStatus !== 'paid'
  )
    return [];
  const linked = receipts.filter(
    (r) =>
      id(r.tenant) === id(tenantId) &&
      [id(so._id), id(so.convertedFrom)].includes(id(r.linkedSalesOrder)) &&
      settled(r),
  );
  const represented = new Set(
    linked.map((r) => r.receiptNumber).filter(Boolean),
  );
  const state = buildLinkedReturnState(so, linked);
  return (so.items || []).flatMap((line) => {
    if (!line.subproduct || (line.lineType && line.lineType !== 'product'))
      return [];
    // Allocate only unrepresented Sales returns to residual fulfillments.
    let allocated = 0;
    for (const receipt of linked)
      (receipt.items || []).forEach((item, index) => {
        if (id(matchingLine(so, item)?._id) === id(line._id))
          allocated += units(state.salesByReceipt[id(receipt._id)]?.[index]);
      });
    let remainingReturn = Math.max(0, units(line.returnedQty) - allocated);
    const sources = new Set(
      (so.fulfillments || [])
        .filter(
          (f) =>
            (!f.status || f.status === 'posted') &&
            !(f.ref && represented.has(f.ref)) &&
            (f.items || []).some((r) => String(r.lineId) === id(line._id)),
        )
        .map((f) => id(f.warehouseId)),
    );
    const ambiguous = remainingReturn > 0 && sources.size > 1;
    let remainingFulfilled = units(line.fulfilledQty);
    const rows = [];
    for (const [fulfillmentIndex, f] of (so.fulfillments || []).entries()) {
      if (f.status && f.status !== 'posted') continue;
      const qty = (f.items || [])
        .filter((r) => String(r.lineId) === id(line._id))
        .reduce((n, r) => n + units(r.qty), 0);
      const actual = Math.min(remainingFulfilled, qty);
      remainingFulfilled -= actual;
      if (f.ref && represented.has(f.ref)) continue;
      const returned = Math.min(actual, remainingReturn);
      remainingReturn -= returned;
      rows.push({
        ...(details ? { lineId: id(line._id), fulfillmentId: id(f._id) || String(fulfillmentIndex), gross: actual } : {}),
        subProductId: id(line.subproduct),
        sizeId: id(line.size),
        ...(locations
          ? {
              warehouseId: ambiguous ? '' : id(f.warehouseId),
              ...(ambiguous ? { locationUncertain: true } : {}),
            }
          : {}),
        units: actual - returned,
        at: f.at,
      });
    }
    // Undated legacy fulfillments are unknown evidence, not dated to order creation.
    return rows;
  });
}
function sumSalesWindows(rows, w) {
  const result = new Map();
  const end = Date.parse(w.end),
    start = Date.parse(w.start),
    previous = Date.parse(w.previousStart),
    month = Date.parse(w.monthStart);
  for (const r of rows) {
    const at = Date.parse(r.at);
    if (!known(r.units) || !Number.isFinite(at) || at < month || at >= end)
      continue;
    const s = result.get(r.subProductId) || {
      currentUnits: 0,
      previousUnits: 0,
      units30: 0,
    };
    s.units30 += r.units;
    if (at >= start) s.currentUnits += r.units;
    else if (at >= previous) s.previousUnits += r.units;
    result.set(r.subProductId, s);
  }
  return result;
}
async function readBounded(query) {
  const rows = [];
  for await (const row of query.lean().cursor()) {
    rows.push(row);
    if (rows.length > 20000)
      throw new Error('Insight sales evidence exceeds batch capacity');
  }
  return rows;
}
async function getSalesEvidence(
  tenantId,
  productIds,
  w,
  { locations = false, baskets = false } = {},
) {
  const Order = require('../models/Order');
  const SalesOrder = require('../models/SalesOrder');
  const fields =
    'tenant source status fulfillmentStatus paymentStatus isVoided paidAt deliveredAt createdAt items refunds salesReturns linkedSalesOrder receiptNumber';
  const range = { $gte: new Date(w.monthStart), $lt: new Date(w.end) };
  const sales = await readBounded(
    SalesOrder.find({
      tenant: tenantId,
      docType: 'order',
      'items.subproduct': { $in: productIds },
      $or: [
        { 'fulfillments.at': range },
        { createdAt: range },
        { 'fulfillments.at': null },
      ],
    }).select(
      'tenant docType orderStatus paymentStatus items fulfillments convertedFrom',
    ),
  );
  const links = sales.flatMap((s) => [s._id, s.convertedFrom].filter(Boolean));
  const refs = sales.flatMap(s => (s.fulfillments || []).map(f => f.ref).filter(Boolean));
  let orders = await readBounded(
    Order.find({
      $and: [
        { $or: [{ tenant: tenantId }, { 'items.tenant': tenantId }] },
        { 'items.subproduct': { $in: productIds } },
        {
          $or: [
            { paidAt: range },
            { deliveredAt: range },
            { source: 'pos', paidAt: null, createdAt: range },
            ...(refs.length ? [{ source: 'pos', receiptNumber: { $in: refs } }] : []),
            ...(links.length
              ? [{ source: 'pos', linkedSalesOrder: { $in: links } }]
              : []),
          ],
        },
      ],
    }).select(fields),
  );
  // Also load an old Sales document when a recent POS receipt refers to it.
  const missing = [
    ...new Set(
      orders
        .map((o) => id(o.linkedSalesOrder))
        .filter((v) => v && !links.map(id).includes(v)),
    ),
  ];
  if (missing.length)
    sales.push(
      ...(await readBounded(
        SalesOrder.find({ tenant: tenantId, _id: { $in: missing } }).select(
          'tenant docType orderStatus paymentStatus items fulfillments convertedFrom',
        ),
      )),
    );
  if (missing.length) {
    const allLinks = sales.flatMap((s) =>
      [s._id, s.convertedFrom].filter(Boolean),
    );
    const historical = await readBounded(
      Order.find({
        source: 'pos',
        linkedSalesOrder: { $in: allLinks },
        $or: [{ tenant: tenantId }, { 'items.tenant': tenantId }],
      }).select(fields),
    );
    const seen = new Set(orders.map((o) => id(o)));
    for (const receipt of historical)
      if (!seen.has(id(receipt))) {
        orders.push(receipt);
        seen.add(id(receipt));
      }
  }
  orders = recoverInsightReceipts(sales, orders, tenantId);
  const projected = new Map();
  for (const so of sales) {
    const state = buildLinkedReturnState(so, orders.filter(settled));
    for (const [receipt, returns] of Object.entries(state.salesByReceipt))
      projected.set(receipt, returns);
  }
  const basketTools = baskets ? require('./promotionSuggestions/baskets') : null;
  const aliases = baskets ? basketTools.basketAliases(sales) : null;
  const rows = orders.flatMap((o) =>
    normalizeOrderUnits(
      { ...o, projectedSalesReturns: projected.get(id(o)) },
      tenantId,
      { locations },
    ).map((r) => baskets ? { ...r, basketId: basketTools.orderBasketId(o, aliases) } : r),
  );
  rows.push(
    ...sales.flatMap((so) =>
      normalizeSalesUnits(so, orders, tenantId, { locations }).map((r) => baskets ? { ...r, basketId: aliases.get(id(so._id)) || `sales:${id(so._id)}` } : r),
    ),
  );
  const uncertain = uncertainProducts(sales, orders);
  for (const row of rows)
    if (!Number.isFinite(Date.parse(row.at))) uncertain.add(row.subProductId);
  return { rows, uncertain };
}
async function getNetSales(tenantId, productIds, w) {
  const { rows, uncertain } = await getSalesEvidence(tenantId, productIds, w);
  const result = sumSalesWindows(rows, w);
  for (const productId of uncertain)
    result.set(productId, {
      currentUnits: null,
      previousUnits: null,
      units30: null,
    });
  return result;
}
module.exports = {
  normalizeOrderUnits,
  normalizeSalesUnits,
  sumSalesWindows,
  getNetSales,
  getSalesEvidence,
};
