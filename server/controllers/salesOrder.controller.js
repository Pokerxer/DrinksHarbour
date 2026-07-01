// server/controllers/salesOrder.controller.js
const asyncHandler = require("express-async-handler");
const crypto = require('crypto');
const SalesOrder = require('../models/SalesOrder');
const Activity = require('../models/Activity');
const CustomField = require('../models/CustomField');
const svc = require('../services/salesOrder.service');
const salesImportSvc = require('../services/salesImport.service');
const salesPayment = require('../services/salesPayment.service');
const salesFulfillSvc = require('../services/salesFulfill.service');
const salesLog = require('../services/salesActivity.service');
const { logPrivilegedAction } = require('../utils/auditLog');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { paginatedResponse } = require('../utils/response');

// Platform roles that can operate across tenants (via ?tenant=/x-tenant-slug).
const PLATFORM_ROLES = ['super_admin', 'admin'];

// F2: every super_admin/admin mutation that touches a tenant's sales data must
// be audited (actor, target tenant, justification). Tenant-scoped users
// (owner/admin/staff) act only within their own tenant and are not audited
// here. Fire-and-forget — auditing never blocks or fails the request.
function auditPrivilegedSalesAction(req, action, actionCategory, so) {
  if (!PLATFORM_ROLES.includes(req.user?.role)) return;
  void logPrivilegedAction(req, action, actionCategory, {
    targetType: 'SalesOrder',
    targetId: so?._id,
    targetTenantId: req.tenant?._id,
    justification: req.body?.justification,
  });
}

// I2: every handler that scopes a query/mutation by tenantId MUST refuse to run
// when tenantId is unresolved. Without this, Mongoose silently strips an
// `undefined` value out of a filter (`{ tenant: undefined }` becomes `{}`),
// turning a tenant-scoped read/write into a cross-tenant one.
function requireResolvedTenant(tenantId, res) {
  if (!tenantId) {
    res.status(401).json({ success: false, message: 'Tenant not resolved' });
    return false;
  }
  return true;
}

exports.createSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const salesperson = req.user?.name || '';
  const so = await svc.createSalesOrderDoc({ tenantId, salesperson, body: req.body });
  auditPrivilegedSalesAction(req, 'SALES_ORDER_CREATE', 'create', so);
  await salesLog.logActivity(tenantId, so._id, {
    subject: so.docType === 'quotation' ? 'Quotation created' : 'Sales Order created',
    userId: req.user?._id,
  });
  res.status(201).json({ success: true, data: so });
});

exports.getSalesOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { search, page, limit, dateFrom, dateTo, warehouse, paymentMethod, paymentStatus, salesperson, docType, status, customer, currency, paymentTerms, pricelist, tags, filters, groupBy, groupBySubOption } = req.query;
  const q = { tenant: tenantId };
  if (search) {
    q.$or = [
      { soNumber: { $regex: search, $options: 'i' } },
      { 'customerSnapshot.name': { $regex: search, $options: 'i' } },
    ];
  }
  if (dateFrom || dateTo) {
    q.createdAt = {};
    if (dateFrom) q.createdAt.$gte = new Date(dateFrom);
    if (dateTo) q.createdAt.$lte = new Date(dateTo);
  }
  if (warehouse) q.warehouseId = warehouse;
  if (paymentMethod) q.paymentMethod = paymentMethod;
  if (paymentStatus) q.paymentStatus = paymentStatus;
  if (salesperson) q.salesperson = salesperson;
  if (docType) q.docType = docType;
  if (customer) q.customer = customer;
  if (currency) q.currency = currency;
  if (paymentTerms) q.paymentTerms = paymentTerms;
  if (pricelist) q.pricelist = pricelist;
  if (tags) q.tags = { $in: Array.isArray(tags) ? tags : [tags] };
  if (status && docType === 'quotation') q.quoteStatus = status;
  if (status && docType === 'order') q.orderStatus = status;
  const filterQuery = svc.buildFilterQuery(filters);
  Object.assign(q, filterQuery);

  // Group-by path: server-side grouping, no pagination
  if (groupBy && groupBy !== 'none' && groupBy !== '') {
    const groups = await svc.getGroupedOrders({ matchQuery: q, groupBy, groupBySubOption });
    return res.json({ success: true, groups });
  }

  const { skip, limit: pageLimit, page: pageNum } = parsePagination(page, limit);
  const [data, total] = await Promise.all([
    SalesOrder.find(q).sort({ createdAt: -1 }).populate('warehouseId', 'name').skip(skip).limit(pageLimit).lean(),
    SalesOrder.countDocuments(q),
  ]);
  paginatedResponse(res, data, buildPaginationMeta(pageNum, pageLimit, total));
});

exports.getSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });
  res.json({ success: true, data: so });
});

exports.updateSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });
  if (!svc.canEdit(so)) {
    return res.status(409).json({ success: false, message: 'This document can no longer be edited' });
  }
  const before = {
    pricelistName: so.appliedPricelist?.pricelistName,
    total: so.total, subtotal: so.subtotal,
    discountTotal: so.discountTotal, promotionTotal: so.promotionTotal,
    customerName: so.customerSnapshot?.name,
    paymentTerms: so.paymentTerms,
    warehouseId: so.warehouseId?.toString(),
    validUntil: so.validUntil,
    notes: so.notes,
  };
  await svc.applyEdit(so, req.body);
  await so.save();
  auditPrivilegedSalesAction(req, 'SALES_ORDER_UPDATE', 'update', so);
  const plDiff = salesLog.diffPricelist(before.pricelistName, so.appliedPricelist?.pricelistName);
  if (plDiff) {
    await salesLog.logActivity(tenantId, so._id, {
      subject: `Pricelist: ${plDiff.from} → ${plDiff.to}`,
      meta: { field: 'pricelist', ...plDiff }, userId: req.user?._id,
    });
  }
  const tDiff = salesLog.diffTotals(before, so);
  if (tDiff && tDiff.total) {
    await salesLog.logActivity(tenantId, so._id, {
      subject: `Total ${salesLog.formatMoney(tDiff.total.from)} → ${salesLog.formatMoney(tDiff.total.to)}`,
      description: tDiff.untaxed ? `Untaxed ${salesLog.formatMoney(tDiff.untaxed.from)} → ${salesLog.formatMoney(tDiff.untaxed.to)}` : undefined,
      meta: { field: 'total', ...tDiff }, userId: req.user?._id,
    });
  }
  const newCustomerName = so.customerSnapshot?.name;
  if (before.customerName !== newCustomerName) {
    await salesLog.logActivity(tenantId, so._id, {
      subject: `Customer: ${before.customerName || '—'} → ${newCustomerName || '—'}`,
      userId: req.user?._id,
    });
  }
  if (before.paymentTerms !== so.paymentTerms) {
    await salesLog.logActivity(tenantId, so._id, {
      subject: `Payment terms: ${before.paymentTerms || '—'} → ${so.paymentTerms || '—'}`,
      userId: req.user?._id,
    });
  }
  if (before.warehouseId !== (so.warehouseId?.toString())) {
    await salesLog.logActivity(tenantId, so._id, {
      subject: 'Warehouse changed',
      userId: req.user?._id,
    });
  }
  if (String(before.validUntil) !== String(so.validUntil)) {
    await salesLog.logActivity(tenantId, so._id, {
      subject: 'Valid until updated',
      userId: req.user?._id,
    });
  }
  res.json({ success: true, data: so });
});

// Recompute every product line's unit price from the order's current pricelist,
// clearing manual price overrides, then re-snapshot totals. Tenant-scoped.
exports.updatePrices = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });
  if (!svc.canEdit(so)) {
    return res.status(409).json({ success: false, message: 'This document can no longer be edited' });
  }
  const before = {
    total: so.total, subtotal: so.subtotal,
    discountTotal: so.discountTotal, promotionTotal: so.promotionTotal,
  };
  await svc.updatePricesForOrder(so, { tenantId });
  await so.save();
  auditPrivilegedSalesAction(req, 'SALES_ORDER_UPDATE', 'update', so);
  await salesLog.logActivity(tenantId, so._id, {
    subject: `Product prices recomputed according to pricelist ${so.appliedPricelist?.pricelistName || 'base'}`,
    userId: req.user?._id,
  });
  const tDiff = salesLog.diffTotals(before, so);
  if (tDiff && tDiff.total) {
    await salesLog.logActivity(tenantId, so._id, {
      subject: `Total ${salesLog.formatMoney(tDiff.total.from)} → ${salesLog.formatMoney(tDiff.total.to)}`,
      description: tDiff.untaxed ? `Untaxed ${salesLog.formatMoney(tDiff.untaxed.from)} → ${salesLog.formatMoney(tDiff.untaxed.to)}` : undefined,
      meta: { field: 'total', ...tDiff }, userId: req.user?._id,
    });
  }
  res.json({ success: true, data: so });
});

// Apply (POST body {code}) or clear (body {code: null|''}) a coupon on an
// editable order. The code resolves against tenant Promotions (findByCode).
exports.applyCoupon = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });
  if (!svc.canEdit(so)) {
    return res.status(409).json({ success: false, message: 'This document can no longer be edited' });
  }
  const code = (req.body?.code ?? '').toString().trim();
  try {
    await svc.applyCouponToOrder(so, code);
  } catch (err) {
    return res
      .status(err.statusCode || 400)
      .json({ success: false, message: err.message || 'Could not apply coupon' });
  }
  await so.save();
  await salesLog.logActivity(tenantId, so._id, {
    subject: code
      ? `Coupon ${so.couponCode} applied (−${salesLog.formatMoney(so.couponDiscount)})`
      : 'Coupon removed',
    userId: req.user?._id,
  });
  res.json({ success: true, data: so });
});

exports.deleteSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });
  if (!svc.canCancel(so)) {
    return res.status(409).json({ success: false, message: 'This document cannot be cancelled' });
  }
  if (so.docType === 'order') so.orderStatus = 'cancelled';
  else so.quoteStatus = 'rejected';
  await so.save();
  auditPrivilegedSalesAction(req, 'SALES_ORDER_CANCEL', 'delete', so);
  await salesLog.logActivity(tenantId, so._id, {
    subject: salesLog.statusSubject(so.docType, so.docType === 'order' ? 'cancelled' : 'rejected'),
    userId: req.user?._id,
  });
  res.json({ success: true, data: so });
});

// Helper: load a quotation scoped to tenant, 404 if missing/not a quotation
async function loadQuotation(req, res) {
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: req.tenant?._id });
  if (!so || so.docType !== 'quotation') {
    res.status(404).json({ success: false, message: 'Quotation not found' });
    return null;
  }
  return so;
}

exports.sendQuotation = asyncHandler(async (req, res) => {
  if (!requireResolvedTenant(req.tenant?._id, res)) return;
  const so = await loadQuotation(req, res); if (!so) return;
  if (so.quoteStatus !== 'draft') return res.status(409).json({ success: false, message: 'Only a draft quotation can be sent' });
  so.quoteStatus = 'sent'; await so.save();
  auditPrivilegedSalesAction(req, 'QUOTATION_SEND', 'update', so);
  await salesLog.logActivity(req.tenant?._id, so._id, {
    subject: salesLog.statusSubject(so.docType, 'sent'), userId: req.user?._id,
  });
  res.json({ success: true, data: so });
});

exports.acceptQuotation = asyncHandler(async (req, res) => {
  if (!requireResolvedTenant(req.tenant?._id, res)) return;
  const so = await loadQuotation(req, res); if (!so) return;
  if (so.quoteStatus !== 'sent') return res.status(409).json({ success: false, message: 'Only a sent quotation can be accepted' });
  so.quoteStatus = 'accepted'; await so.save();
  auditPrivilegedSalesAction(req, 'QUOTATION_ACCEPT', 'approve', so);
  await salesLog.logActivity(req.tenant?._id, so._id, {
    subject: salesLog.statusSubject(so.docType, 'accepted'), userId: req.user?._id,
  });
  res.json({ success: true, data: so });
});

exports.rejectQuotation = asyncHandler(async (req, res) => {
  if (!requireResolvedTenant(req.tenant?._id, res)) return;
  const so = await loadQuotation(req, res); if (!so) return;
  if (!['sent', 'draft'].includes(so.quoteStatus)) return res.status(409).json({ success: false, message: 'Quotation cannot be rejected' });
  so.quoteStatus = 'rejected'; await so.save();
  auditPrivilegedSalesAction(req, 'QUOTATION_REJECT', 'reject', so);
  await salesLog.logActivity(req.tenant?._id, so._id, {
    subject: salesLog.statusSubject(so.docType, 'rejected'), userId: req.user?._id,
  });
  res.json({ success: true, data: so });
});

exports.convertQuotation = asyncHandler(async (req, res) => {
  if (!requireResolvedTenant(req.tenant?._id, res)) return;
  const so = await loadQuotation(req, res); if (!so) return;
  if (['converted', 'rejected', 'expired'].includes(so.quoteStatus)) {
    return res.status(409).json({ success: false, message: 'Quotation cannot be converted' });
  }
  const order = await svc.convertQuotationToOrder(so);
  auditPrivilegedSalesAction(req, 'QUOTATION_CONVERT', 'update', order);
  await salesLog.logActivity(req.tenant?._id, so._id, {
    subject: salesLog.statusSubject(so.docType, 'converted'), userId: req.user?._id,
    meta: { orderId: order._id },
  });
  res.status(201).json({ success: true, data: order });
  await salesLog.logActivity(req.tenant?._id, order._id, {
    subject: `Created via conversion from quotation ${so.soNumber}`,
    userId: req.user?._id,
  });
});

exports.confirmSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId, docType: 'order' });
  if (!so) return res.status(404).json({ success: false, message: 'Order not found' });
  if (so.orderStatus !== 'draft') return res.status(409).json({ success: false, message: 'Only a draft order can be confirmed' });

  const { paymentMethod, amountTendered, splitPayments, redeemPoints } = req.body;
  if (!paymentMethod) return res.status(400).json({ success: false, message: 'Payment method required' });

  // I1: attachTenant does NOT select posSettings onto req.tenant (only
  // revenueModel/markupPercentage/commissionPercentage/etc are selected there),
  // so loyalty earn would silently always compute to 0 if we trusted
  // req.tenant?.posSettings. Load it explicitly here instead.
  const Tenant = require('../models/Tenant');
  const tenantDoc = await Tenant.findById(tenantId).select('posSettings').lean();
  const posSettings = tenantDoc?.posSettings || {};

  const result = await salesPayment.capturePayment({
    salesOrder: so, tenantId, paymentMethod, amountTendered, splitPayments, redeemPoints,
    userId: req.user?._id || req.posUser?._id,
    posSettings,
  });
  if (!result.ok) return res.status(result.status || 409).json({ success: false, message: result.message });

  so.orderStatus = 'confirmed';
  so.paymentMethod = paymentMethod;
  so.paymentStatus = 'paid';
  so.amountPaid = so.total;
  so.walletTxRef = result.walletTx?._id || undefined;
  so.loyaltyEarned = result.loyaltyEarned || 0;
  so.loyaltyRedeemed = result.loyaltyRedeemed || 0;
  so.pointsRedeemed = result.pointsRedeemed || 0;
  await so.save();
  auditPrivilegedSalesAction(req, 'SALES_ORDER_CONFIRM', 'update', so);
  await salesLog.logActivity(tenantId, so._id, {
    subject: salesLog.statusSubject(so.docType, 'confirmed'), userId: req.user?._id,
  });
  res.json({ success: true, data: so });
});

exports.fulfillSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId, docType: 'order' });
  if (!so) return res.status(404).json({ success: false, message: 'Order not found' });
  if (!['confirmed', 'partially_fulfilled'].includes(so.orderStatus)) {
    return res.status(409).json({ success: false, message: 'Only a confirmed order can be fulfilled' });
  }
  let { warehouseId, items: fulfillLines } = req.body;
  // Fallback: order-level warehouseId → tenant default warehouse
  if (!warehouseId && so.warehouseId) warehouseId = so.warehouseId;
  if (!warehouseId) {
    const Warehouse = require('../models/Warehouse');
    const def = await Warehouse.findOne({ tenant: tenantId, isDefault: true }).select('_id').lean();
    if (def) warehouseId = def._id;
  }
  if (!warehouseId) return res.status(400).json({ success: false, message: 'No warehouse set — configure a default warehouse first' });

  // C1: revenue + paymentMethod feed buildSalesRow so every Sales-required
  // field (finalItemPrice, revenueModelUsed, platformAmount, tenantAmount,
  // paymentMethod) is populated. revenueModel/markupPercentage/commissionPercentage
  // ARE selected onto req.tenant by attachTenant.
  const revenue = {
    revenueModel: req.tenant?.revenueModel,
    markupPct: req.tenant?.markupPercentage,
    commissionPct: req.tenant?.commissionPercentage,
  };
  const { order, posting } = await salesFulfillSvc.fulfillOrder({
    salesOrder: so, tenantId, warehouseId, fulfillLines: fulfillLines || [],
    userId: req.user?._id || req.posUser?._id, deps: {},
    revenue, paymentMethod: so.paymentMethod,
  });
  auditPrivilegedSalesAction(req, 'SALES_ORDER_FULFILL', 'transfer', order);
  res.json({ success: true, data: order, posting });
  await salesLog.logActivity(tenantId, so._id, {
    subject: 'Sales Order fulfilled',
    userId: req.user?._id || req.posUser?._id,
  });
});

exports.returnSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId, docType: 'order' });
  if (!so) return res.status(404).json({ success: false, message: 'Order not found' });
  if (!['partially_fulfilled', 'fulfilled'].includes(so.orderStatus)) {
    return res.status(409).json({ success: false, message: 'Only a fulfilled order can be returned' });
  }
  const { warehouseId, items: returnLines } = req.body;
  if (!warehouseId) return res.status(400).json({ success: false, message: 'Restock warehouse required' });

  const recordMovement = async (m) => {
    const InventoryMovement = require('../models/InventoryMovement');
    await InventoryMovement.create({
      subProduct: m.subProduct,
      tenant: m.tenant,
      product: m.product,
      size: m.size,
      warehouse: m.warehouse,
      type: 'return',
      category: 'in',
      quantity: m.quantity,
      quantityBefore: Number.isFinite(m.balanceAfter) ? m.balanceAfter - m.quantity : 0,
      quantityAfter: Number.isFinite(m.balanceAfter) ? m.balanceAfter : m.quantity,
      reference: m.reference,
      referenceType: 'return',
      performedBy: m.performedBy,
      source: 'return',
      notes: `Sales return: ${m.reference}`,
    });
  };

  const { order, restock } = await salesFulfillSvc.returnOrder({
    salesOrder: so, tenantId, warehouseId, returnLines: returnLines || [],
    userId: req.user?._id || req.posUser?._id, deps: { recordMovement },
  });
  auditPrivilegedSalesAction(req, 'SALES_ORDER_RETURN', 'transfer', order);
  res.json({ success: true, data: order, restock });
  await salesLog.logActivity(tenantId, so._id, {
    subject: 'Return processed',
    userId: req.user?._id || req.posUser?._id,
  });
});

// ─── Task 2: Duplicate ───────────────────────────────────────────────────────
exports.duplicateSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });
  const dup = await svc.duplicateSalesOrderDoc(so);
  auditPrivilegedSalesAction(req, 'SALES_ORDER_DUPLICATE', 'create', dup);
  res.status(201).json({ success: true, data: dup });
  await salesLog.logActivity(tenantId, so._id, {
    subject: `Duplicated — new document ${dup.soNumber}`,
    description: `Sales order was duplicated. New document: ${dup.soNumber}`,
    userId: req.user?._id,
  });
});

// ─── Task 3: Import CSV ──────────────────────────────────────────────────────
exports.importSalesOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { csv } = req.body;
  if (!csv) return res.status(400).json({ success: false, message: 'CSV text is required in body.csv' });
  const orders = salesImportSvc.parseSalesCsv(csv, tenantId);
  const result = await salesImportSvc.bulkImportSales(orders, tenantId);
  auditPrivilegedSalesAction(req, 'SALES_IMPORT', 'create', null);
  res.json({ success: true, data: result });
});

// ─── Task 4a: Payment Link ────────────────────────────────────────────────────
exports.generatePaymentLink = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId, docType: 'order' });
  if (!so) return res.status(404).json({ success: false, message: 'Order not found' });
  if (so.orderStatus !== 'draft') return res.status(409).json({ success: false, message: 'Only a draft order can generate a payment link' });
  const paymentLink = `https://pay.drinksharbour.com/pay/${so._id}`;
  so.paymentLink = paymentLink;
  await so.save();
  res.json({ success: true, data: { paymentLink } });
  await salesLog.logActivity(tenantId, so._id, {
    subject: 'Payment link generated',
    userId: req.user?._id,
  });
});

// ─── Task 4b: Accrued Revenue ─────────────────────────────────────────────────
exports.accruedRevenueEntry = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId, docType: 'order' });
  if (!so) return res.status(404).json({ success: false, message: 'Order not found' });
  if (so.orderStatus !== 'confirmed') return res.status(409).json({ success: false, message: 'Only a confirmed order can record accrued revenue' });
  // Stub: real accounting integration will replace this
  console.log(`[ACCRUED REVENUE STUB] Order ${so.soNumber} (${so._id}) — total ${so.total}`);
  auditPrivilegedSalesAction(req, 'ACCRUED_REVENUE', 'create', so);
  res.json({ success: true, data: { message: `Accrued revenue recorded for ${so.soNumber}`, total: so.total } });
});

// ─── Task 4c: Create Project ──────────────────────────────────────────────────
exports.createProjectFromOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId, docType: 'order' });
  if (!so) return res.status(404).json({ success: false, message: 'Order not found' });
  // Stub: real project creation integration will replace this
  const project = { projectId: so._id, name: so.soNumber, status: 'planned' };
  res.status(201).json({ success: true, data: project });
});

// ─── Task 5a: Activities ─────────────────────────────────────────────────────
exports.getActivities = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const data = await Activity.find({ tenant: tenantId, salesOrder: req.params.id }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data });
});

exports.createActivity = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const activity = await Activity.create({
    tenant: tenantId,
    salesOrder: req.params.id,
    type: req.body.type || 'note',
    subject: req.body.subject,
    description: req.body.description,
    createdBy: req.user?._id,
  });
  res.status(201).json({ success: true, data: activity });
});

// ─── Task 5b: Custom Fields ──────────────────────────────────────────────────
exports.getCustomFields = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const data = await CustomField.find({ tenant: tenantId, model: 'SalesOrder' }).sort({ fieldName: 1 }).lean();
  res.json({ success: true, data });
});

exports.createCustomField = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const field = await CustomField.create({
    tenant: tenantId,
    model: 'SalesOrder',
    fieldName: req.body.fieldName,
    fieldType: req.body.fieldType,
    options: req.body.options || [],
    isRequired: req.body.isRequired || false,
    createdBy: req.user?._id,
  });
  res.status(201).json({ success: true, data: field });
});

// ─── Task 6a: Send Email ─────────────────────────────────────────────────────
exports.sendOrderEmail = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId }).populate('warehouseId', 'name').lean();
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });

  const itemsHtml = (so.items || []).map((it) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${it.name || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px;">${it.quantity || 0}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">₦${(it.unitPrice || 0).toLocaleString()}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:600;">₦${(it.lineTotal || 0).toLocaleString()}</td>
    </tr>
  `).join('');

  const html = `
    <h2 style="margin:0 0 16px 0;">Sales Order: ${so.soNumber}</h2>
    <p><strong>Customer:</strong> ${so.customerSnapshot?.name || 'Walk-in'}</p>
    <p><strong>Status:</strong> ${so.docType === 'quotation' ? so.quoteStatus : so.orderStatus}</p>
    <p><strong>Total:</strong> ₦${(so.total || 0).toLocaleString()}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:10px 12px;text-align:left;font-size:12px;border-bottom:2px solid #e5e7eb;">Item</th>
        <th style="padding:10px 12px;text-align:center;font-size:12px;border-bottom:2px solid #e5e7eb;">Qty</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;border-bottom:2px solid #e5e7eb;">Price</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;border-bottom:2px solid #e5e7eb;">Total</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>`;

  try {
    const emailSvc = require('../services/email.service');
    await emailSvc.sendEmail({ to: req.body.to, subject: `Sales Order ${so.soNumber}`, html });
    res.json({ success: true, data: { emailSent: true } });
  } catch (err) {
    console.log('[SEND_ORDER_EMAIL] Email service unavailable:', err.message);
    res.json({ success: true, data: { emailSent: false, note: 'Email service not available — logged to console' } });
  }
});

// ─── Task 6b: Request Signature ──────────────────────────────────────────────
exports.requestSignature = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });
  const token = crypto.randomBytes(32).toString('hex');
  const signatureUrl = `https://app.drinksharbour.com/sign/${token}`;
  // Stub: store signatureToken on the order (model field optional — not persisted if field missing)
  try { so.signatureToken = token; await so.save(); } catch { /* model may not have field */ }

  try {
    const emailSvc = require('../services/email.service');
    const html = `<p>Please sign the sales order <strong>${so.soNumber}</strong>:</p><p><a href="${signatureUrl}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">Sign Document</a></p>`;
    await emailSvc.sendEmail({ to: req.body.to, subject: `Signature Request: ${so.soNumber}`, html });
  } catch (err) {
    console.log('[REQUEST_SIGNATURE] Email service unavailable:', err.message);
  }

  res.json({ success: true, data: { signatureUrl, token } });
});

// ─── Bulk actions ──────────────────────────────────────────────────────────────

async function processBulk(ids, tenantId, fn) {
  const docs = await SalesOrder.find({ _id: { $in: ids }, tenant: tenantId });
  const foundMap = new Map(docs.map((d) => [String(d._id), d]));
  const results = [];
  for (const id of ids) {
    const doc = foundMap.get(id);
    if (!doc) {
      results.push({ id, ok: false, error: 'Sales order not found' });
      continue;
    }
    try {
      const extra = (await fn(doc)) || {};
      results.push({ id, ok: true, ...extra });
    } catch (err) {
      results.push({ id, ok: false, error: err.message });
    }
  }
  return results;
}

exports.bulkMarkSent = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
  const results = await processBulk(ids, tenantId, (doc) => svc.bulkMarkSent(doc));
  res.json({ success: true, results });
});

exports.bulkDuplicate = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
  const results = await processBulk(ids, tenantId, (doc) => svc.bulkDuplicate(doc));
  res.json({ success: true, results });
});

exports.bulkDelete = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
  const results = await processBulk(ids, tenantId, (doc) => svc.bulkDeleteDoc(doc));
  res.json({ success: true, results });
});

exports.bulkCancel = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
  const results = await processBulk(ids, tenantId, (doc) => svc.bulkCancelDoc(doc));
  res.json({ success: true, results });
});

exports.bulkCreateInvoice = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
  const results = await processBulk(ids, tenantId, (doc) => svc.bulkCreateInvoice(doc));
  res.json({ success: true, results });
});

exports.bulkAccruedRevenue = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
  const results = await processBulk(ids, tenantId, (doc) => svc.bulkAccruedRevenue(doc));
  res.json({ success: true, results });
});

exports.bulkFollowers = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { ids, action, userId } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
  if (!['add', 'remove'].includes(action)) return res.status(400).json({ success: false, message: 'action must be "add" or "remove"' });
  if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });
  const results = await processBulk(ids, tenantId, (doc) => svc.bulkFollowers(doc, action, userId));
  res.json({ success: true, results });
});

exports.bulkSendEmail = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { ids, to, subject, body } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'ids must be a non-empty array' });
  if (!to) return res.status(400).json({ success: false, message: 'to (email address) is required' });
  const results = await processBulk(ids, tenantId, (doc) => svc.bulkSendEmail(doc, to, subject, body));
  res.json({ success: true, results });
});
