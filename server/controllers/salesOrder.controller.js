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
  res.status(501).json({ success: false, message: 'Not implemented yet' }); // Task 4
});

exports.deleteSalesOrder = asyncHandler(async (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' }); // Task 4
});
