// server/controllers/salesOrder.controller.js
const asyncHandler = require("express-async-handler");
const SalesOrder = require('../models/SalesOrder');
const svc = require('../services/salesOrder.service');
const salesPayment = require('../services/salesPayment.service');
const salesFulfillSvc = require('../services/salesFulfill.service');

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
  const so = await svc.createSalesOrderDoc({ tenantId, body: req.body });
  res.status(201).json({ success: true, data: so });
});

exports.getSalesOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const { docType, status, customer } = req.query;
  const q = { tenant: tenantId };
  if (docType) q.docType = docType;
  if (customer) q.customer = customer;
  if (status && docType === 'quotation') q.quoteStatus = status;
  if (status && docType === 'order') q.orderStatus = status;
  const data = await SalesOrder.find(q).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data });
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
  svc.applyEdit(so, req.body);
  await so.save();
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
  res.json({ success: true, data: so });
});

exports.acceptQuotation = asyncHandler(async (req, res) => {
  if (!requireResolvedTenant(req.tenant?._id, res)) return;
  const so = await loadQuotation(req, res); if (!so) return;
  if (so.quoteStatus !== 'sent') return res.status(409).json({ success: false, message: 'Only a sent quotation can be accepted' });
  so.quoteStatus = 'accepted'; await so.save();
  res.json({ success: true, data: so });
});

exports.rejectQuotation = asyncHandler(async (req, res) => {
  if (!requireResolvedTenant(req.tenant?._id, res)) return;
  const so = await loadQuotation(req, res); if (!so) return;
  if (!['sent', 'draft'].includes(so.quoteStatus)) return res.status(409).json({ success: false, message: 'Quotation cannot be rejected' });
  so.quoteStatus = 'rejected'; await so.save();
  res.json({ success: true, data: so });
});

exports.convertQuotation = asyncHandler(async (req, res) => {
  if (!requireResolvedTenant(req.tenant?._id, res)) return;
  const so = await loadQuotation(req, res); if (!so) return;
  if (['converted', 'rejected', 'expired'].includes(so.quoteStatus)) {
    return res.status(409).json({ success: false, message: 'Quotation cannot be converted' });
  }
  const order = await svc.convertQuotationToOrder(so);
  res.status(201).json({ success: true, data: order });
});

exports.confirmSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!requireResolvedTenant(tenantId, res)) return;
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId, docType: 'order' });
  if (!so) return res.status(404).json({ success: false, message: 'Order not found' });
  if (so.orderStatus !== 'draft') return res.status(409).json({ success: false, message: 'Only a draft order can be confirmed' });

  const { paymentMethod, amountTendered, splitPayments } = req.body;
  if (!paymentMethod) return res.status(400).json({ success: false, message: 'Payment method required' });

  // I1: attachTenant does NOT select posSettings onto req.tenant (only
  // revenueModel/markupPercentage/commissionPercentage/etc are selected there),
  // so loyalty earn would silently always compute to 0 if we trusted
  // req.tenant?.posSettings. Load it explicitly here instead.
  const Tenant = require('../models/Tenant');
  const tenantDoc = await Tenant.findById(tenantId).select('posSettings').lean();
  const posSettings = tenantDoc?.posSettings || {};

  const result = await salesPayment.capturePayment({
    salesOrder: so, tenantId, paymentMethod, amountTendered, splitPayments,
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
  await so.save();
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
  const { warehouseId, items: fulfillLines } = req.body;
  if (!warehouseId) return res.status(400).json({ success: false, message: 'Destination warehouse required' });

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
  res.json({ success: true, data: order, posting });
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
  res.json({ success: true, data: order, restock });
});
