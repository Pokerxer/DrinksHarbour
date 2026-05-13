'use strict';

const asyncHandler = require('express-async-handler');
const Order        = require('../models/Order');
const SubProduct   = require('../models/SubProduct');
const Tenant       = require('../models/Tenant');

// ─── helpers ────────────────────────────────────────────────────────────────

function startOf(date, unit) {
  const d = new Date(date);
  if (unit === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0); }
  if (unit === 'day')   { d.setHours(0, 0, 0, 0); }
  return d;
}

function endOf(date, unit) {
  const d = new Date(date);
  if (unit === 'month') { d.setMonth(d.getMonth() + 1); d.setDate(0); d.setHours(23, 59, 59, 999); }
  if (unit === 'day')   { d.setHours(23, 59, 59, 999); }
  return d;
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

const MONTH_NAMES        = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PAID_STATUSES      = ['paid', 'partially_refunded'];
const ACTIVE_STATUSES    = ['pending','confirmed','processing','shipped','delivered'];
const COMPLETED_STATUSES = ['shipped','delivered'];   // stock has physically left

// ─── controller ─────────────────────────────────────────────────────────────

/**
 * GET /api/analytics/dashboard
 * Aggregated dashboard metrics. Accessible to tenantAdmin / superAdmin.
 *
 * Revenue / Profit model
 * ─────────────────────
 * Each order item stores three snapshot amounts at purchase time:
 *   itemSubtotal        = what the customer paid for this line (after item discount)
 *   platformCommission  = platform's net earnings for this line
 *   tenantRevenueShare  = vendor's net earnings for this line
 *
 * So:
 *   Gross Revenue  = Σ itemSubtotal   (or equivalently order.totalAmount)
 *   Platform Profit= Σ platformCommission
 *   Vendor Payout  = Σ tenantRevenueShare
 *   COGS           = Σ (itemSubtotal - platformCommission - tenantRevenueShare)
 */
exports.getDashboard = asyncHandler(async (req, res) => {
  const now = new Date();

  const thisMonthStart = startOf(now, 'month');
  const thisMonthEnd   = endOf(now, 'month');
  const lastMonthStart = startOf(addMonths(now, -1), 'month');
  const lastMonthEnd   = endOf(addMonths(now, -1), 'month');
  const todayStart     = startOf(now, 'day');
  const todayEnd       = endOf(now, 'day');
  const yesterdayStart = startOf(new Date(now - 86_400_000), 'day');
  const yesterdayEnd   = endOf(new Date(now - 86_400_000), 'day');
  const yearStart      = new Date(now.getFullYear(), 0, 1);

  const isSuperAdmin   = ['super_admin', 'admin'].includes(req.user.role);
  const tenantFilter   = isSuperAdmin ? {} : { 'items.tenant': req.user.tenant };
  const spTenantFilter = isSuperAdmin ? {} : { tenant: req.user.tenant };

  // sevenDaysAgo helper (inline)
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // ── Run all aggregations in parallel ───────────────────────────────────
  const [
    thisMonthAgg,
    lastMonthAgg,
    todayAgg,
    yesterdayAgg,
    dailyOrdersAgg,
    pendingCount,
    monthlySalesAgg,
    statusBreakdownAgg,
    paymentBreakdownAgg,
    topProductsAgg,
    recentOrdersAgg,
    lowStockCount,
    customerChartAgg,
    // ── Profit: sum platformCommission from paid orders ──────────────────
    profitThisMonthAgg,
    profitLastMonthAgg,
    profitMonthlyAgg,
    // ── Per-vendor revenue (top tenants) ─────────────────────────────────
    topVendorsAgg,
  ] = await Promise.all([

    // 1. This month gross revenue + orders
    Order.aggregate([
      { $match: { ...tenantFilter, placedAt: { $gte: thisMonthStart, $lte: thisMonthEnd }, status: { $in: ACTIVE_STATUSES } } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
    ]),

    // 2. Last month gross revenue + orders
    Order.aggregate([
      { $match: { ...tenantFilter, placedAt: { $gte: lastMonthStart, $lte: lastMonthEnd }, status: { $in: ACTIVE_STATUSES } } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
    ]),

    // 3. Today
    Order.aggregate([
      { $match: { ...tenantFilter, placedAt: { $gte: todayStart, $lte: todayEnd }, status: { $in: ACTIVE_STATUSES } } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
    ]),

    // 4. Yesterday
    Order.aggregate([
      { $match: { ...tenantFilter, placedAt: { $gte: yesterdayStart, $lte: yesterdayEnd }, status: { $in: ACTIVE_STATUSES } } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
    ]),

    // 5. 7-day daily sparkline
    Order.aggregate([
      { $match: { ...tenantFilter, placedAt: { $gte: sevenDaysAgo }, status: { $in: ACTIVE_STATUSES } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$placedAt' } }, orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { _id: 1 } },
    ]),

    // 6. Pending count
    Order.countDocuments({ ...tenantFilter, status: 'pending' }),

    // 7. 12-month sales
    Order.aggregate([
      { $match: { ...tenantFilter, placedAt: { $gte: startOf(addMonths(now, -11), 'month') }, status: { $in: ACTIVE_STATUSES } } },
      { $group: { _id: { year: { $year: '$placedAt' }, month: { $month: '$placedAt' } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),

    // 8. Status breakdown (this month)
    Order.aggregate([
      { $match: { ...tenantFilter, placedAt: { $gte: thisMonthStart } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // 9. Payment method breakdown (this month)
    Order.aggregate([
      { $match: { ...tenantFilter, placedAt: { $gte: thisMonthStart } } },
      { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$totalAmount' } } },
      { $sort: { count: -1 } },
    ]),

    // 10. Top 8 products by totalSold
    SubProduct.find({ ...spTenantFilter, totalSold: { $gt: 0 } })
      .sort({ totalSold: -1 }).limit(8)
      .select('sku totalSold totalRevenue stockStatus availableStock costPrice baseSellingPrice')
      .populate('product', 'name images')
      .populate('tenant', 'name slug logo primaryColor')
      .lean(),

    // 11. Recent 10 orders
    Order.find(tenantFilter)
      .sort({ placedAt: -1 }).limit(10)
      .select('orderNumber totalAmount status paymentStatus paymentMethod shippingAddress placedAt user items')
      .populate('items.tenant', 'name slug')
      .lean(),

    // 12. Low-stock count
    SubProduct.countDocuments({ ...spTenantFilter, stockStatus: { $in: ['low_stock', 'out_of_stock'] } }),

    // 13. New vs registered orders per month this year
    Order.aggregate([
      { $match: { ...tenantFilter, placedAt: { $gte: yearStart }, status: { $in: ACTIVE_STATUSES } } },
      { $group: {
        _id: { month: { $month: '$placedAt' }, isGuest: { $cond: [{ $ifNull: ['$user', false] }, false, true] } },
        count: { $sum: 1 },
      }},
      { $sort: { '_id.month': 1 } },
    ]),

    // 14. Profit this month from paid orders
    //     vendorCost  = Σ tenantRevenueShare  (platform's cost = vendor payout)
    //     platformProfit = Σ platformCommission (= grossRevenue - vendorCost)
    //     If tenantRevenueShare is 0 (legacy order), fall back: vendorCost = itemSubtotal / 1.15
    Order.aggregate([
      { $match: { ...tenantFilter, placedAt: { $gte: thisMonthStart, $lte: thisMonthEnd }, paymentStatus: { $in: PAID_STATUSES } } },
      { $unwind: '$items' },
      { $addFields: {
        // For items missing tenantRevenueShare, back-calculate from 15% platform markup
        '_effectiveVendorCost': {
          $cond: [
            { $gt: ['$items.tenantRevenueShare', 0] },
            '$items.tenantRevenueShare',
            { $divide: ['$items.itemSubtotal', 1.15] },
          ],
        },
      }},
      { $group: {
        _id: null,
        grossRevenue: { $sum: '$items.itemSubtotal' },
        vendorCost:   { $sum: '$_effectiveVendorCost' },
        orderCount:   { $addToSet: '$_id' },
      }},
      { $addFields: {
        platformProfit: { $subtract: ['$grossRevenue', '$vendorCost'] },
      }},
    ]),

    // 15. Last month profit (for % change)
    Order.aggregate([
      { $match: { ...tenantFilter, placedAt: { $gte: lastMonthStart, $lte: lastMonthEnd }, paymentStatus: { $in: PAID_STATUSES } } },
      { $unwind: '$items' },
      { $addFields: {
        '_effectiveVendorCost': {
          $cond: [
            { $gt: ['$items.tenantRevenueShare', 0] },
            '$items.tenantRevenueShare',
            { $divide: ['$items.itemSubtotal', 1.15] },
          ],
        },
      }},
      { $group: {
        _id: null,
        grossRevenue: { $sum: '$items.itemSubtotal' },
        vendorCost:   { $sum: '$_effectiveVendorCost' },
      }},
      { $addFields: {
        platformProfit: { $subtract: ['$grossRevenue', '$vendorCost'] },
      }},
    ]),

    // 16. Monthly profit trend (12 months, paid orders only)
    Order.aggregate([
      { $match: { ...tenantFilter, placedAt: { $gte: startOf(addMonths(now, -11), 'month') }, paymentStatus: { $in: PAID_STATUSES } } },
      { $unwind: '$items' },
      { $addFields: {
        '_effectiveVendorCost': {
          $cond: [
            { $gt: ['$items.tenantRevenueShare', 0] },
            '$items.tenantRevenueShare',
            { $divide: ['$items.itemSubtotal', 1.15] },
          ],
        },
      }},
      { $group: {
        _id: { year: { $year: '$placedAt' }, month: { $month: '$placedAt' } },
        revenue:    { $sum: '$items.itemSubtotal' },
        vendorCost: { $sum: '$_effectiveVendorCost' },
      }},
      { $addFields: { profit: { $subtract: ['$revenue', '$vendorCost'] } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),

    // 17. Top vendors this month — ranked by platform revenue (gross from their items)
    //     vendorCost  = what the platform pays the vendor (platform's cost)
    //     platformProfit = what the platform earns from this vendor's items
    Order.aggregate([
      { $match: { ...tenantFilter, placedAt: { $gte: thisMonthStart }, status: { $in: ACTIVE_STATUSES } } },
      { $unwind: '$items' },
      { $match: { 'items.tenant': { $exists: true, $ne: null } } },
      { $addFields: {
        '_effectiveVendorCost': {
          $cond: [
            { $gt: ['$items.tenantRevenueShare', 0] },
            '$items.tenantRevenueShare',
            { $divide: ['$items.itemSubtotal', 1.15] },
          ],
        },
      }},
      { $group: {
        _id:          '$items.tenant',
        grossRevenue: { $sum: '$items.itemSubtotal' },
        vendorCost:   { $sum: '$_effectiveVendorCost' },
        orderCount:   { $addToSet: '$_id' },
        itemCount:    { $sum: '$items.quantity' },
      }},
      { $addFields: {
        platformProfit: { $subtract: ['$grossRevenue', '$vendorCost'] },
      }},
      { $sort: { grossRevenue: -1 } },
      { $limit: 8 },
    ]),

  ]);

  // ── Process stat cards ───────────────────────────────────────────────────
  const thisOrders   = thisMonthAgg[0]?.orders  ?? 0;
  const thisRevenue  = thisMonthAgg[0]?.revenue ?? 0;
  const lastOrders   = lastMonthAgg[0]?.orders  ?? 0;
  const lastRevenue  = lastMonthAgg[0]?.revenue ?? 0;
  const todayOrders  = todayAgg[0]?.orders  ?? 0;
  const todayRevenue = todayAgg[0]?.revenue ?? 0;
  const yestOrders   = yesterdayAgg[0]?.orders  ?? 0;
  const yestRevenue  = yesterdayAgg[0]?.revenue ?? 0;

  // Vendor cost  = what platform pays out to vendors = platform's cost of goods
  // Platform profit = gross revenue - vendor cost  (= the platform markup earned)
  const paidGross      = profitThisMonthAgg[0]?.grossRevenue   ?? 0;
  const vendorCostThisMonth = profitThisMonthAgg[0]?.vendorCost ?? 0;
  const platformProfit = profitThisMonthAgg[0]?.platformProfit ?? (paidGross - vendorCostThisMonth);
  const paidOrderCount = profitThisMonthAgg[0]?.orderCount?.length ?? 0;
  const avgOrderValue  = paidOrderCount > 0 ? Math.round(paidGross / paidOrderCount) : 0;
  const lastGross      = profitLastMonthAgg[0]?.grossRevenue    ?? 0;
  const lastVendorCost = profitLastMonthAgg[0]?.vendorCost      ?? 0;
  const lastProfit     = profitLastMonthAgg[0]?.platformProfit  ?? (lastGross - lastVendorCost);

  // 7-day sparkline normalised
  const dailyMap = {};
  dailyOrdersAgg.forEach(d => { dailyMap[d._id] = d; });
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    last7Days.push({ day, date: key, orders: dailyMap[key]?.orders ?? 0, revenue: dailyMap[key]?.revenue ?? 0 });
  }

  // ── 12-month sales + profit trend ───────────────────────────────────────
  const salesByMonth  = {};
  const profitByMonth = {};
  monthlySalesAgg.forEach(m  => { salesByMonth [`${m._id.year}-${m._id.month}`] = m; });
  profitMonthlyAgg.forEach(m => { profitByMonth[`${m._id.year}-${m._id.month}`] = m; });

  const salesReport = [];
  for (let i = 11; i >= 0; i--) {
    const d   = addMonths(now, -i);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const s   = salesByMonth[key];
    const p   = profitByMonth[key];
    const rev = s?.revenue  ?? 0;
    const vc  = p?.vendorCost ?? 0;
    const pft = p?.profit   ?? (rev - vc);
    salesReport.push({
      month:      MONTH_NAMES[d.getMonth()],
      revenue:    rev,
      orders:     s?.orders ?? 0,
      vendorCost: vc,   // platform's cost = vendor payout
      profit:     pft,  // platform's profit = revenue - vendorCost
    });
  }

  // ── Status breakdown ─────────────────────────────────────────────────────
  const statusMap = {};
  statusBreakdownAgg.forEach(s => { statusMap[s._id] = s.count; });

  // ── Customer chart ───────────────────────────────────────────────────────
  const customerMap = {};
  customerChartAgg.forEach(r => {
    const m = MONTH_NAMES[r._id.month - 1];
    if (!customerMap[m]) customerMap[m] = { month: m, newCustomer: 0, returningCustomer: 0 };
    if (r._id.isGuest) customerMap[m].newCustomer      += r.count;
    else               customerMap[m].returningCustomer += r.count;
  });
  const customerChart = MONTH_NAMES.map(m => customerMap[m] ?? { month: m, newCustomer: 0, returningCustomer: 0 });

  // ── Top products ─────────────────────────────────────────────────────────
  const topProductsList = topProductsAgg.map(sp => {
    // Margin = (baseSellingPrice - costPrice) / baseSellingPrice × 100
    const margin = (sp.baseSellingPrice && sp.costPrice && sp.baseSellingPrice > 0)
      ? Math.round(((sp.baseSellingPrice - sp.costPrice) / sp.baseSellingPrice) * 100)
      : null;
    return {
      id:          sp._id,
      name:        sp.product?.name ?? sp.sku,
      image:       sp.product?.images?.[0]?.url ?? null,
      sku:         sp.sku,
      sold:        sp.totalSold,
      revenue:     sp.totalRevenue ?? 0,
      stock:       sp.availableStock ?? 0,
      stockStatus: sp.stockStatus ?? 'in_stock',
      margin,
      vendor: sp.tenant ? {
        id:    sp.tenant._id,
        name:  sp.tenant.name,
        slug:  sp.tenant.slug,
        logo:  sp.tenant.logo?.url ?? null,
        color: sp.tenant.primaryColor ?? '#1a202c',
      } : null,
    };
  });

  // ── Recent orders ────────────────────────────────────────────────────────
  const recentOrdersList = recentOrdersAgg.map(o => {
    // Collect unique vendor names on this order
    const vendors = [...new Set(
      (o.items || [])
        .filter(i => i.tenant?.name)
        .map(i => i.tenant.name)
    )];
    return {
      id:            o._id,
      orderNumber:   o.orderNumber,
      customer:      o.shippingAddress?.fullName ?? (o.user ? 'Registered User' : 'Guest'),
      total:         o.totalAmount,
      status:        o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      placedAt:      o.placedAt,
      hasAccount:    !!o.user,
      vendors,
    };
  });

  // ── Top vendors ──────────────────────────────────────────────────────────
  // Hydrate tenant details
  const vendorIds  = topVendorsAgg.map(v => v._id).filter(Boolean);
  const tenantDocs = await Tenant.find({ _id: { $in: vendorIds } })
    .select('name slug logo primaryColor revenueModel')
    .lean();
  const tenantMap  = {};
  tenantDocs.forEach(t => { tenantMap[String(t._id)] = t; });

  const topVendors = topVendorsAgg.map(v => {
    const t   = tenantMap[String(v._id)] ?? {};
    const vc  = v.vendorCost ?? 0;
    const rev = v.grossRevenue ?? 0;
    return {
      id:             v._id,
      name:           t.name         ?? 'Unknown',
      slug:           t.slug         ?? '',
      logo:           t.logo?.url    ?? null,
      color:          t.primaryColor ?? '#1a202c',
      revenueModel:   t.revenueModel ?? 'markup',
      grossRevenue:   rev,
      // vendorCost = platform's cost for this vendor's goods = vendor payout
      vendorCost:     vc,
      // platformProfit = what the platform earns from this vendor's items
      platformProfit: v.platformProfit ?? (rev - vc),
      orderCount:     v.orderCount?.length ?? 0,
      itemCount:      v.itemCount,
    };
  });

  // ── Response ─────────────────────────────────────────────────────────────
  res.json({
    success: true,
    data: {
      statCards: {
        thisMonth:     { orders: thisOrders,  revenue: thisRevenue  },
        lastMonth:     { orders: lastOrders,  revenue: lastRevenue  },
        today:         { orders: todayOrders, revenue: todayRevenue },
        yesterday:     { orders: yestOrders,  revenue: yestRevenue  },
        pendingOrders: pendingCount,
        lowStockCount,
        avgOrderValue,
        sparkline:     last7Days,
      },
      salesReport,
      statusBreakdown: statusMap,
      paymentBreakdown: paymentBreakdownAgg.map(p => ({
        method: p._id || 'unknown',
        count:  p.count,
        total:  p.total,
      })),
      topProducts:  topProductsList,
      recentOrders: recentOrdersList,
      customerChart,
      profit: {
        // platformProfit = gross revenue - vendor cost (= platform markup earned)
        thisMonth:      platformProfit,
        lastMonth:      lastProfit,
        // paidRevenue = gross revenue from paid orders (what customers paid for items)
        paidRevenue:    paidGross,
        // vendorCost = platform's cost = Σ vendor payouts (what platform owes vendors)
        vendorCost:     vendorCostThisMonth,
        trend: salesReport.map(m => ({
          month:      m.month,
          totalSales: m.revenue,
          vendorCost: m.vendorCost,
          profit:     m.profit,
        })),
      },
      topVendors,
    },
  });
});
