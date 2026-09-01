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

function buildProductBreakdown(orders) {
  const map = {};
  for (const order of orders) {
    if (order.status === 'voided') continue;
    for (const item of order.items || []) {
      const key = item.productId?.toString() || item.name || 'unknown';
      if (!map[key]) map[key] = { name: item.name || 'Unknown', qty: 0, gross: 0, discounts: 0, net: 0 };
      const qty  = item.quantity || 1;
      const unit = item.finalPrice ?? item.unitPrice ?? 0;
      const disc = item.discountAmount || 0;
      map[key].qty       += qty;
      map[key].gross     += unit * qty;
      map[key].discounts += disc * qty;
      map[key].net       += (unit - disc) * qty;
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

  const orders          = await Order.find({ posSession: id, tenant: tenantId }).lean();
  const completedOrders = orders.filter((o) => o.status !== 'voided' && o.status !== 'cancelled');
  const voidedOrders    = orders.filter((o) => o.status === 'voided');
  const refundOrders    = orders.filter((o) => o.isRefund === true);

  const paymentTotals  = paymentTotalsFrom(completedOrders);
  const grossRevenue   = completedOrders.reduce((s, o) => s + (o.totalAmount  || 0), 0);
  const totalRefunds   = refundOrders.reduce   ((s, o) => s + Math.abs(o.totalAmount || 0), 0);
  const totalDiscounts = completedOrders.reduce((s, o) => s + (o.discountAmount || 0), 0);
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
  const orders     = await Order.find({ posSession: { $in: sessionIds }, tenant: tenantId }).lean();

  const completed  = orders.filter((o) => o.status !== 'voided' && o.status !== 'cancelled');
  const voided     = orders.filter((o) => o.status === 'voided');
  const refunds    = orders.filter((o) => o.isRefund === true);

  const paymentTotals  = paymentTotalsFrom(completed);
  const grossRevenue   = completed.reduce((s, o) => s + (o.totalAmount  || 0), 0);
  const totalRefunds   = refunds.reduce  ((s, o) => s + Math.abs(o.totalAmount || 0), 0);
  const totalDiscounts = completed.reduce((s, o) => s + (o.discountAmount || 0), 0);

  const sessionSummaries = sessions.map((session) => {
    const sOrders  = completed.filter((o) => o.posSession?.toString() === session._id.toString());
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
  const orders     = await Order.find({ posSession: { $in: sessionIds }, tenant: tenantId }).lean();

  const completed  = orders.filter((o) => o.status !== 'voided' && o.status !== 'cancelled');
  const voided     = orders.filter((o) => o.status === 'voided');
  const refunds    = orders.filter((o) => o.isRefund === true);

  const paymentTotals  = paymentTotalsFrom(completed);
  const grossRevenue   = completed.reduce((s, o) => s + (o.totalAmount  || 0), 0);
  const totalRefunds   = refunds.reduce  ((s, o) => s + Math.abs(o.totalAmount || 0), 0);
  const totalDiscounts = completed.reduce((s, o) => s + (o.discountAmount || 0), 0);
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
        netRevenue:    grossRevenue - totalRefunds,
        avgOrderValue,
        paymentTotals,
      },
      dailySales,
      topProducts: buildProductBreakdown(orders).slice(0, 20),
    },
  });
});
