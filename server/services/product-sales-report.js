// Private read model: use the existing receipt/fulfillment and return rules.
const {
  normalizeOrderUnits,
  normalizeSalesUnits,
} = require('./tenantProductInsights.sales');
const { uncertainProducts } = require('./tenantProductInsights.salesEvidence');
const { recoverInsightReceipts } = require('./insightReceiptRecovery');
const { id, buildLinkedReturnState } = require('./linkedReturns.helpers');
const { settled } = require('./posSessionTotals.service');
const { known } = require('./tenantProductInsights.rules');
const iso = (value) =>
  value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const name = (user) =>
  user?.displayName || [user?.firstName, user?.lastName].filter(Boolean).join(' ');
function buildProductSalesReport({
  productId,
  tenantId,
  orders,
  sales,
  tenants = [],
  sizes = [],
}) {
  const rows = [];
  let complete = true;
  const tenantNames = new Map(tenants.map((t) => [id(t), t.name]));
  const sizeNames = new Map(sizes.map((s) => [id(s), s]));
  const matches = (line, tenant) =>
    id(line.product) === id(productId) && (!tenantId || id(tenant) === id(tenantId));
  const scopes = new Set(
    [
      ...sales
        .filter((s) => s.items?.some((i) => matches(i, s.tenant)))
        .map((s) => id(s.tenant)),
      ...orders.flatMap((o) =>
        (o.items || [])
          .filter((i) =>
            matches(i, i.tenant || (o.source === 'pos' ? o.tenant : null))
          )
          .map((i) => id(i.tenant || o.tenant))
      ),
    ].filter(Boolean)
  );
  const add = (r, line, tenant, meta) => {
    if (!line || !matches(line, tenant) || r.gross <= 0) return;
    const size = sizeNames.get(r.sizeId);
    const soldAt = iso(r.at);
    if (!soldAt) complete = false;
    rows.push({
      ...meta,
      soldAt,
      tenant: tenantNames.get(tenant) || 'Unknown tenant',
      size:
        size && id(size.tenant) === tenant && id(size.subproduct) === r.subProductId
          ? size.displayName || size.size || 'Unspecified size'
          : 'Unspecified size',
      gross: r.gross,
      returned: Math.max(0, r.gross - r.units),
      net: r.units,
    });
  };
  for (const tenant of scopes) {
    const ownSales = sales.filter((s) => id(s.tenant) === tenant);
    const receipts = recoverInsightReceipts(ownSales, orders, tenant);
    const projected = new Map();
    for (const so of ownSales) {
      const state = buildLinkedReturnState(so, receipts.filter(settled));
      for (const [receipt, returns] of Object.entries(state.salesByReceipt))
        projected.set(receipt, returns);
    }
    const uncertain = uncertainProducts(ownSales, receipts);
    for (const so of ownSales)
      if (
        (so.items || []).some(
          (i) => matches(i, tenant) && uncertain.has(id(i.subproduct))
        )
      )
        complete = false;
    for (const order of receipts) {
      // A completed delivery remains a historical sale after a full refund.
      const ownStatus =
        order.fulfillmentStatus?.[tenant] || order.fulfillmentStatus?.get?.(tenant);
      const refundedDelivery =
        order.source !== 'pos' &&
        order.status === 'refunded' &&
        iso(order.deliveredAt) &&
        (!ownStatus || ownStatus === 'refunded');
      const evidence = refundedDelivery
        ? {
            ...order,
            status: 'delivered',
            fulfillmentStatus: { [tenant]: 'delivered' },
          }
        : order;
      const eligible =
        settled(evidence) &&
        (evidence.source === 'pos' ||
          (refundedDelivery ? 'delivered' : ownStatus || evidence.status) ===
            'delivered');
      const targetLines = (evidence.items || []).filter(
        (i) =>
          matches(
            i,
            i.tenant || (evidence.source === 'pos' ? evidence.tenant : null)
          ) && id(i.tenant || evidence.tenant) === tenant
      );
      if (eligible && targetLines.some((i) => !known(i.quantity) || !i.subproduct))
        complete = false;
      if (
        eligible &&
        targetLines.length &&
        ['refunded', 'partially_refunded'].includes(evidence.paymentStatus) &&
        !(evidence.refunds || []).some((r) =>
          r.items?.some((i) => known(i.quantity) && i.quantity > 0)
        )
      )
        complete = false;
      const snapshot = order.paymentDetails?.customer;
      const linkedBuyer = snapshot?.customerId;
      const buyer =
        name(snapshot) ||
        (id(linkedBuyer?.tenant) === tenant ? name(linkedBuyer) : '') ||
        name(order.user) ||
        (order.source === 'pos' && !snapshot?.customerId
          ? 'Walk-in customer'
          : 'Unknown customer');
      for (const r of normalizeOrderUnits(
        { ...evidence, projectedSalesReturns: projected.get(id(order)) },
        tenant,
        { details: true }
      )) {
        const line = order.items[r.lineIndex];
        add(r, line, tenant, {
          key: `order:${id(order)}:${r.lineIndex}`,
          reference:
            order.receiptNumber || order.orderNumber || 'Reference unavailable',
          source: order.source === 'pos' ? 'POS' : 'Online',
          buyer,
          buyerId: id(snapshot?.customerId || order.user),
          dateBasis:
            order.source === 'pos'
              ? order.paidAt
                ? 'Paid'
                : 'Recorded'
              : 'Delivered',
          status: order.paymentStatus,
          transaction: `order:${id(order)}`,
        });
      }
    }
    for (const so of ownSales) {
      if (
        so.docType === 'order' &&
        so.paymentStatus === 'paid' &&
        ['fulfilled', 'partially_fulfilled'].includes(so.orderStatus) &&
        (so.items || []).some(
          (i) => matches(i, tenant) && (!i.subproduct || !known(i.fulfilledQty))
        )
      )
        complete = false;
      for (const r of normalizeSalesUnits(so, receipts, tenant, { details: true })) {
        const line = so.items.find((i) => id(i) === r.lineId);
        add(r, line, tenant, {
          key: `sales:${id(so)}:${r.lineId}:${r.fulfillmentId}`,
          reference: so.soNumber || 'Reference unavailable',
          source: 'Sales order',
          buyer:
            so.customerSnapshot?.name ||
            (id(so.customer?.tenant) === tenant ? name(so.customer) : '') ||
            'Unknown customer',
          buyerId: id(so.customer || so.customerSnapshot?.customerId),
          dateBasis: 'Fulfilled',
          status: so.paymentStatus,
          transaction: `sales:${id(so)}:${r.fulfillmentId}`,
        });
      }
    }
  }
  rows.sort(
    (a, b) =>
      (Date.parse(b.soldAt) || 0) - (Date.parse(a.soldAt) || 0) ||
      a.key.localeCompare(b.key)
  );
  const totals = rows.reduce(
    (s, r) => ({
      gross: s.gross + r.gross,
      returned: s.returned + r.returned,
      net: s.net + r.net,
    }),
    { gross: 0, returned: 0, net: 0 }
  );
  totals.transactions = new Set(rows.map((r) => r.transaction)).size;
  return { rows, totals, complete };
}
module.exports = { buildProductSalesReport };
