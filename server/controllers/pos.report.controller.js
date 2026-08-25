// controllers/pos.report.controller.js
// Session Z-reports, daily summaries, and range reports for the POS system.

const asyncHandler = require('../utils/asyncHandler');
const POSSession   = require('../models/POSSession');
const Order        = require('../models/Order');
const mongoose     = require('mongoose');

// ── helpers ───────────────────────────────────────────────────────────────────

function startOfDay(date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0); return d;
}
function endOfDay(date) {
  const d = new Date(date); d.setHours(23, 59, 59, 999); return d;
}

/**
 * A void is recorded with the `isVoided` flag. 'voided' is not a value in the
 * status enum, so the old `status === 'voided'` checks excluded nothing and
 * voided sales were counted as revenue.
 */
function isVoided(order) {
  return order.isVoided === true;
}

/** Total actually refunded against an order, across its refund records. */
function refundedTotal(order) {
  return (order.refunds || []).reduce(
    (s, r) => s + Math.abs(r.totalRefunded || 0),
    0
  );
}

/**
 * Split a session's orders into the buckets every report needs.
 * Held orders are parked carts, not sales, and must never reach revenue.
 */
function partitionOrders(orders) {
  const live = orders.filter(
    (o) => o.status !== 'cancelled' && o.status !== 'hold'
  );
  return {
    completed: live.filter((o) => !isVoided(o)),
    voided:    live.filter(isVoided),
    refunded:  live.filter((o) => refundedTotal(o) > 0),
  };
}

/**
 * Per-product sales breakdown.
 *
 * Field names must track orderItemSchema: the price is `priceAtPurchase`
 * (not finalPrice/unitPrice), the reference is `product` (not productId), and
 * `discountAmount` / `itemSubtotal` are already LINE totals — not per-unit —
 * so neither may be multiplied by quantity again.
 */
function buildProductBreakdown(orders) {
  const map = {};
  for (const order of orders) {
    if (isVoided(order)) continue;
    for (const item of order.items || []) {
      const key =
        item.product?.toString() || item.subproduct?.toString() || 'unknown';
      const name = item.product?.name || item._name || 'Unknown';
      if (!map[key]) map[key] = { name, qty: 0, gross: 0, discounts: 0, net: 0 };
      const qty       = item.quantity || 0;
      const lineGross = (item.priceAtPurchase || 0) * qty;
      const lineDisc  = item.discountAmount || 0;
      map[key].qty       += qty;
      map[key].gross     += lineGross;
      map[key].discounts += lineDisc;
      map[key].net       += item.itemSubtotal ?? lineGross - lineDisc;
    }
  }
  return Object.values(map).sort((a, b) => b.net - a.net);
}

function paymentTotalsFrom(orders) {
  const totals = { cash: 0, card: 0, bank_transfer: 0, mobile_money: 0, split: 0 };
  for (const o of orders) {
    const m = o.paymentMethod || 'cash';
    if (totals[m] !== undefined) totals[m] += o.totalAmount || 0;
  }
  return totals;
}

// ── GET /api/pos/reports/session/:id  ─────────────────────────────────────────
// Full Z-report for a single session.

exports.getSessionReport = asyncHandler(async (req, res) => {
  const { id }     = req.params;
  const tenantId   = req.tenant?._id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid session ID' });
  }

  const session = await POSSession.findOne({ _id: id, tenant: tenantId })
    .populate('openedBy',           'firstName lastName posName')
    .populate('closedBy',           'firstName lastName posName')
    .populate('activeCashier',      'firstName lastName posName')
    .populate('cashierLog.cashier', 'firstName lastName posName')
    .lean();

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const orders          = await Order.find({ posSessionId: id, tenant: tenantId }).lean();
  const {
    completed: completedOrders,
    voided: voidedOrders,
    refunded: refundOrders,
  } = partitionOrders(orders);

  const paymentTotals  = paymentTotalsFrom(completedOrders);
  const grossRevenue   = completedOrders.reduce((s, o) => s + (o.totalAmount  || 0), 0);
  const totalRefunds   = refundOrders.reduce   ((s, o) => s + refundedTotal(o), 0);
  const totalDiscounts = completedOrders.reduce((s, o) => s + (o.discountTotal || 0), 0);
  const totalTips      = completedOrders.reduce((s, o) => s + (o.tipAmount      || 0), 0);
  const totalRounding  = completedOrders.reduce((s, o) => s + (o.roundingAmount || 0), 0);
  const netRevenue     = grossRevenue - totalRefunds;

  const cashIn  = (session.cashMovements || []).filter((m) => m.type === 'in' ).reduce((s, m) => s + m.amount, 0);
  const cashOut = (session.cashMovements || []).filter((m) => m.type === 'out').reduce((s, m) => s + m.amount, 0);
  const expectedCash = (session.openingCash || 0) + paymentTotals.cash + cashIn - cashOut;

  const openedAt     = new Date(session.openedAt);
  const closedAt     = session.closedAt ? new Date(session.closedAt) : new Date();
  const durationMins = Math.round((closedAt - openedAt) / 60000);

  // Hourly sales
  const hourlyMap = {};
  for (const o of completedOrders) {
    const h = `${String(new Date(o.createdAt).getHours()).padStart(2, '0')}:00`;
    if (!hourlyMap[h]) hourlyMap[h] = { orders: 0, revenue: 0 };
    hourlyMap[h].orders  += 1;
    hourlyMap[h].revenue += o.totalAmount || 0;
  }
  const hourlySales = Object.entries(hourlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, data]) => ({ hour, ...data }));

  res.json({
    success: true,
    data: {
      session: {
        _id:            session._id,
        terminalType:   session.terminalType,
        status:         session.status,
        openedAt:       session.openedAt,
        closedAt:       session.closedAt,
        openedBy:       session.openedBy,
        closedBy:       session.closedBy,
        openingCash:    session.openingCash,
        notes:          session.notes,
        closingNotes:   session.closingNotes,
        cashierLog:     session.cashierLog,
        methodBalances: session.methodBalances,
        hasDifference:  session.hasDifference,
      },
      summary: {
        totalOrders:   completedOrders.length,
        voidedOrders:  voidedOrders.length,
        refundOrders:  refundOrders.length,
        grossRevenue,
        totalDiscounts,
        totalRefunds,
        totalTips,
        totalRounding,
        netRevenue,
        durationMins,
      },
      paymentTotals,
      cashSummary: {
        openingCash:  session.openingCash || 0,
        cashSales:    paymentTotals.cash,
        cashIn,
        cashOut,
        expectedCash,
        countedCash:  session.methodBalances?.find((m) => m.method === 'cash')?.counted ?? null,
        difference:   session.methodBalances?.find((m) => m.method === 'cash')?.difference ?? null,
      },
      cashMovements:   session.cashMovements || [],
      productBreakdown: buildProductBreakdown(orders),
      hourlySales,
    },
  });
});

// ── GET /api/pos/reports/daily  ───────────────────────────────────────────────
// All sessions for a calendar date with totals.

exports.getDailyReport = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const date     = req.query.date ? new Date(req.query.date) : new Date();

  const sessions = await POSSession.find({
    tenant:   tenantId,
    openedAt: { $gte: startOfDay(date), $lte: endOfDay(date) },
  })
    .populate('openedBy', 'firstName lastName posName')
    .populate('closedBy', 'firstName lastName posName')
    .sort({ openedAt: 1 })
    .lean();

  if (!sessions.length) {
    return res.json({
      success: true,
      data: { date: date.toISOString().slice(0, 10), sessions: [], totals: {} },
    });
  }

  const sessionIds = sessions.map((s) => s._id);
  const orders     = await Order.find({ posSessionId: { $in: sessionIds }, tenant: tenantId }).lean();

  const { completed, voided, refunded: refunds } = partitionOrders(orders);

  const paymentTotals  = paymentTotalsFrom(completed);
  const grossRevenue   = completed.reduce((s, o) => s + (o.totalAmount  || 0), 0);
  const totalRefunds   = refunds.reduce  ((s, o) => s + refundedTotal(o), 0);
  const totalDiscounts = completed.reduce((s, o) => s + (o.discountTotal || 0), 0);
  const totalTips      = completed.reduce((s, o) => s + (o.tipAmount      || 0), 0);
  const totalRounding  = completed.reduce((s, o) => s + (o.roundingAmount || 0), 0);

  const sessionSummaries = sessions.map((session) => {
    const sOrders  = completed.filter((o) => o.posSessionId?.toString() === session._id.toString());
    return {
      _id:         session._id,
      terminalType:session.terminalType,
      status:      session.status,
      openedAt:    session.openedAt,
      closedAt:    session.closedAt,
      openedBy:    session.openedBy,
      orderCount:  sOrders.length,
      revenue:     sOrders.reduce((s, o) => s + (o.totalAmount || 0), 0),
    };
  });

  res.json({
    success: true,
    data: {
      date: date.toISOString().slice(0, 10),
      sessions: sessionSummaries,
      totals: {
        sessionCount:  sessions.length,
        totalOrders:   completed.length,
        voidedOrders:  voided.length,
        refundOrders:  refunds.length,
        grossRevenue,
        totalDiscounts,
        totalRefunds,
        totalTips,
        totalRounding,
        netRevenue:    grossRevenue - totalRefunds,
        paymentTotals,
      },
    },
  });
});

// ── GET /api/pos/reports/summary  ────────────────────────────────────────────
// Date-range aggregate with daily breakdown and top products.

exports.getReportSummary = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const dateFrom = req.query.dateFrom
    ? new Date(req.query.dateFrom)
    : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
  const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : new Date();

  const sessions = await POSSession.find({
    tenant:   tenantId,
    openedAt: { $gte: startOfDay(dateFrom), $lte: endOfDay(dateTo) },
  }).lean();

  if (!sessions.length) {
    return res.json({
      success: true,
      data: {
        dateFrom:   dateFrom.toISOString().slice(0, 10),
        dateTo:     dateTo.toISOString().slice(0, 10),
        totals:     {},
        dailySales: [],
        topProducts:[],
      },
    });
  }

  const sessionIds = sessions.map((s) => s._id);
  const orders     = await Order.find({ posSessionId: { $in: sessionIds }, tenant: tenantId }).lean();

  const { completed, voided, refunded: refunds } = partitionOrders(orders);

  const paymentTotals  = paymentTotalsFrom(completed);
  const grossRevenue   = completed.reduce((s, o) => s + (o.totalAmount  || 0), 0);
  const totalRefunds   = refunds.reduce  ((s, o) => s + refundedTotal(o), 0);
  const totalDiscounts = completed.reduce((s, o) => s + (o.discountTotal || 0), 0);
  const totalTips      = completed.reduce((s, o) => s + (o.tipAmount      || 0), 0);
  const totalRounding  = completed.reduce((s, o) => s + (o.roundingAmount || 0), 0);
  const avgOrderValue  = completed.length ? grossRevenue / completed.length : 0;

  // Daily breakdown
  const dailyMap = {};
  for (const o of completed) {
    const day = new Date(o.createdAt).toISOString().slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { orders: 0, revenue: 0 };
    dailyMap[day].orders  += 1;
    dailyMap[day].revenue += o.totalAmount || 0;
  }
  const dailySales = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));

  res.json({
    success: true,
    data: {
      dateFrom:    dateFrom.toISOString().slice(0, 10),
      dateTo:      dateTo.toISOString().slice(0, 10),
      totals: {
        sessionCount:  sessions.length,
        totalOrders:   completed.length,
        voidedOrders:  voided.length,
        refundOrders:  refunds.length,
        grossRevenue,
        totalDiscounts,
        totalRefunds,
        totalTips,
        totalRounding,
        netRevenue:    grossRevenue - totalRefunds,
        avgOrderValue,
        paymentTotals,
      },
      dailySales,
      topProducts: buildProductBreakdown(completed).slice(0, 20),
    },
  });
});

// Internals exposed for unit tests. These encode the money rules (what counts
// as revenue, what a refund is worth, how a line is priced) and are worth
// testing directly rather than only through an HTTP handler.
exports.__test__ = {
  isVoided,
  refundedTotal,
  partitionOrders,
  buildProductBreakdown,
  paymentTotalsFrom,
};
