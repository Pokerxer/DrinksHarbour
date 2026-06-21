// server/controllers/salesOrder.controller.js
const asyncHandler = require("express-async-handler");
const SalesOrder = require('../models/SalesOrder');
const svc = require('../services/salesOrder.service');

exports.createSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const so = await svc.createSalesOrderDoc({ tenantId, body: req.body });
  res.status(201).json({ success: true, data: so });
});

exports.getSalesOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
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
  const so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });
  res.json({ success: true, data: so });
});

exports.updateSalesOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
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
  const so = await loadQuotation(req, res); if (!so) return;
  if (so.quoteStatus !== 'draft') return res.status(409).json({ success: false, message: 'Only a draft quotation can be sent' });
  so.quoteStatus = 'sent'; await so.save();
  res.json({ success: true, data: so });
});

exports.acceptQuotation = asyncHandler(async (req, res) => {
  const so = await loadQuotation(req, res); if (!so) return;
  if (so.quoteStatus !== 'sent') return res.status(409).json({ success: false, message: 'Only a sent quotation can be accepted' });
  so.quoteStatus = 'accepted'; await so.save();
  res.json({ success: true, data: so });
});

exports.rejectQuotation = asyncHandler(async (req, res) => {
  const so = await loadQuotation(req, res); if (!so) return;
  if (!['sent', 'draft'].includes(so.quoteStatus)) return res.status(409).json({ success: false, message: 'Quotation cannot be rejected' });
  so.quoteStatus = 'rejected'; await so.save();
  res.json({ success: true, data: so });
});

exports.convertQuotation = asyncHandler(async (req, res) => {
  const so = await loadQuotation(req, res); if (!so) return;
  if (['converted', 'rejected', 'expired'].includes(so.quoteStatus)) {
    return res.status(409).json({ success: false, message: 'Quotation cannot be converted' });
  }
  const order = await svc.convertQuotationToOrder(so);
  res.status(201).json({ success: true, data: order });
});
