// Report order mapping for every POS reporting surface (order list, session
// report, order-analysis). Pure: it projects an already-fetched lean order and
// never touches the database, so it can be unit tested directly.
//
// This used to live inline in pos.controller.js, hand-duplicated per endpoint.
// The copies drifted — the session copy silently omitted the customer and the
// tip/rounding fields — so the same receipt reported different numbers on two
// screens. One mapper, imported everywhere.
const { orderReturnTotals } = require('./posReturnTotals.service');

const money = (n) => Math.round(n * 100) / 100;

// The exact projection every report surface must receive. Kept as a constant so
// the field list and this mapper cannot drift apart.
const REPORT_ORDER_FIELDS =
  'shopId shopName posWarehouse orderNumber receiptNumber totalAmount subtotal taxAmount linkedSalesOrder ' +
  'discountTotal paymentMethod paymentStatus status placedAt createdAt posStaff isVoided refunds salesReturns ' +
  'items paymentDetails posSessionId tipAmount roundingAmount';

function mapReportLine(item, netTotals) {
  return {
    ...netTotals,
    name:          item._name || item.product?.name || 'Product',
    variant:       item._variant || item.size?.displayName || '',
    quantity:      item.quantity,
    priceAtPurchase: item.priceAtPurchase,
    itemSubtotal:  item.itemSubtotal,
    // Pre-discount line value, so "gross" can be shown honestly beside net.
    grossSubtotal: money((Number(item.priceAtPurchase) || 0) * (Number(item.quantity) || 0)),
    discountAmount: item.discountAmount || 0,
    taxRate:       item.taxRate || 0,
    taxAmount:     item.taxAmount || 0,
    // What the tenant actually paid for this stock when it was sold. The Size
    // model's costPrice is *current*, so a profit report built on it rewrites
    // history every time a cost price is edited. `sizeCostPrice` is kept for
    // screens that intentionally want today's valuation.
    costPriceAtPurchase: item.vendorPriceAtPurchase || 0,
    sizeCostPrice: item.size?.costPrice || item.subproduct?.costPrice || 0,
    category:      item.product?.category?.name    || '',
    subcategory:   item.product?.subCategory?.name || '',
    brand:         item.product?.brand?.name       || '',
    warehouse:     item.warehouse
      ? { _id: item.warehouse._id, name: item.warehouse.name, code: item.warehouse.code }
      : null,
  };
}

function mapReportOrder(order) {
  const lineNetTotals = order.lineNetTotals || [];
  const lineDiscountTotal = (order.items || []).reduce(
    (sum, it) => sum + (Number(it.discountAmount) || 0),
    0
  );
  return {
    ...order,
    ...orderReturnTotals(order),
    total:        order.totalAmount,
    subtotal:     order.subtotal ?? order.totalAmount,
    // Report the tax actually charged. This used to be gated on
    // `linkedSalesOrder`, which was correct when quotations were the only
    // taxable path but would have hidden a tenant-VAT receipt's own tax from
    // every report. Undefined means "no tax recorded", which is honest;
    // 0 is reported as 0.
    taxAmount:    order.taxAmount ?? undefined,
    // Order-level discount is the cashier/threshold footer only — line and bundle
    // discounts are already netted out of itemSubtotal. Reporting one without the
    // other understates what was actually given away, so both are surfaced.
    discountTotal:      order.discountTotal || 0,
    lineDiscountTotal:  money(lineDiscountTotal),
    tipAmount:          order.tipAmount || 0,
    roundingAmount:     order.roundingAmount || 0,
    customer:           order.paymentDetails?.customer || null,
    session:            order.posSessionId && typeof order.posSessionId === 'object'
      ? { _id: order.posSessionId._id, terminalType: order.posSessionId.terminalType, openedAt: order.posSessionId.openedAt }
      : order.posSessionId ? { _id: order.posSessionId } : null,
    paymentDetails: {
      splitPayments: order.paymentDetails?.splitPayments || [],
      change:        order.paymentDetails?.change        || 0,
      amount:        order.paymentDetails?.amount        || 0,
    },
    items: (order.items || []).map((it, index) => mapReportLine(it, lineNetTotals[index])),
  };
}

module.exports = { mapReportOrder, mapReportLine, REPORT_ORDER_FIELDS };
