// Compact analysis payload for the POS order-analysis page.
//
// Why compact rows rather than pre-aggregated KPIs: the money maths already has
// one authority — posReturnTotals.service.js — and the measure/grouping logic has
// one authority — the client analysis module. If the server also computed the
// KPIs, a third implementation would exist and the headline figure would
// eventually disagree with the chart built from the same data. So this service
// only does the one thing the server is uniquely able to do: read *every* matching
// receipt instead of a truncated first page, and shrink each one to the fields
// the measures actually need.
//
// The result is a full-period dataset small enough to send whole, which is what
// removes the silent 500-order cap that used to make every figure quietly wrong.

// Defensive ceiling. A tenant far past this gets an explicit `truncated` flag
// rather than a silently incomplete report.
const DEFAULT_MAX_LINES = 100000;

function compactLine(orderId, item) {
  return {
    o: orderId,
    n: item.name,
    v: item.variant || '',
    c: item.category || '',
    s: item.subcategory || '',
    b: item.brand || '',
    w: item.warehouse?.name || '',
    q: item.netQuantity ?? item.quantity ?? 0,
    r: item.netSales ?? item.itemSubtotal ?? 0,
    g: item.grossSubtotal ?? (item.priceAtPurchase || 0) * (item.quantity || 0),
    d: item.discountAmount || 0,
    t: item.taxAmount || 0,
    // 0 means "never costed" — the client shows that revenue as uncosted rather
    // than booking it as profit.
    k: item.costPriceAtPurchase || 0,
    x: item.sizeCostPrice || 0,
    rq: item.returnedQuantity ?? 0,
  };
}

function compactOrder(o) {
  return {
    _id: o._id,
    orderNumber: o.orderNumber,
    receiptNumber: o.receiptNumber,
    // Tender basis (goods + tip +/- rounding) and commercial basis, kept separate.
    total: o.totalAmount ?? 0,
    grossRevenue: o.grossRevenue ?? 0,
    netSales: o.netSales ?? 0,
    returnDeduction: o.returnDeduction ?? 0,
    totalRefunds: o.totalRefunds ?? 0,
    salesReturnValue: o.salesReturnValue ?? 0,
    netCollections: o.netCollections ?? 0,
    tipAmount: o.tipAmount ?? 0,
    roundingAmount: o.roundingAmount ?? 0,
    discountTotal: o.discountTotal ?? 0,
    lineDiscountTotal: o.lineDiscountTotal ?? 0,
    taxAmount: o.taxAmount,
    subtotal: o.subtotal,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    status: o.status,
    isVoided: !!o.isVoided,
    placedAt: o.placedAt,
    createdAt: o.createdAt,
    posStaff: o.posStaff
      ? {
          firstName: o.posStaff.firstName,
          lastName: o.posStaff.lastName,
          posName: o.posStaff.posName,
        }
      : null,
    customer: o.customer
      ? {
          firstName: o.customer.firstName,
          lastName: o.customer.lastName,
          phone: o.customer.phone,
          customerId: o.customer.customerId || null,
        }
      : null,
    session: o.session ? { _id: o.session._id, terminalType: o.session.terminalType } : null,
    splitPayments: o.paymentDetails?.splitPayments || [],
  };
}

/**
 * Build the payload from already-mapped report orders (i.e. the output of
 * mapReportOrder, so the net-sales fields are present and authoritative).
 *
 * `onOrder` lets the caller stream results to the response as they are read
 * rather than buffering the whole period in memory.
 */
function buildAnalysisPayload(orders, { maxLines = DEFAULT_MAX_LINES } = {}) {
  const out = [];
  let lineCount = 0;
  let truncated = false;
  let scanned = 0;

  for (const o of orders) {
    scanned += 1;
    if (lineCount > maxLines) {
      truncated = true;
      continue;
    }
    const lines = (o.items || []).map((it) => compactLine(o._id, it));
    lineCount += lines.length;
    if (lineCount > maxLines) {
      truncated = true;
      continue;
    }
    out.push({ order: compactOrder(o), lines });
  }

  return {
    orders: out,
    meta: {
      scanned,
      included: out.length,
      lines: lineCount,
      truncated,
      maxLines,
    },
  };
}

module.exports = { buildAnalysisPayload, compactOrder, compactLine, DEFAULT_MAX_LINES };
