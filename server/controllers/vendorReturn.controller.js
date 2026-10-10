// controllers/vendorReturn.controller.js
const VendorReturn = require("../models/VendorReturn");
const PurchaseOrder = require("../models/PurchaseOrder");
const SubProduct = require("../models/SubProduct");
const VendorBill = require("../models/VendorBill");
const { ValidationError } = require("../utils/errors");
const asyncHandler = require('../utils/asyncHandler');
const { captureDocumentTax, reverseDocumentTax, effectiveTaxForFlow } = require("../services/tax.service");
const { postDocumentEntry, reverseDocumentEntry } = require("../services/accounting.posting");
const { round2 } = require("../services/tax.helpers");

async function generateReturnNumber(tenantId) {
  const year = new Date().getFullYear();
  const prefix = `RET-${year}-`;
  const last = await VendorReturn.findOne(
    { tenant: tenantId, returnNumber: { $regex: `^${prefix}` } },
    { returnNumber: 1 }
  ).sort({ returnNumber: -1 });
  const nextSeq = last
    ? parseInt(last.returnNumber.slice(prefix.length), 10) + 1
    : 1;
  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

const { adjustBillForReturn } = require('../services/vendorReturn.bill');

// @route   POST /api/vendor-returns
// @desc    Create a new vendor return
// @access  Private
exports.createVendorReturn = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant;
  const {
    vendor,
    vendorName,
    purchaseOrder,
    poNumber,
    vendorBill,
    billNumber,
    currency,
    items,
    reason,
    notes,
    shippingCarrier,
    trackingNumber,
    returnAddress,
    warehouse,
  } = req.body;

  // Resolve the header Tax ref (or tenant default). VendorReturn stores only
  // header-level tax (no per-line rate in the schema), so the resolved rate is
  // applied to taxAmount below unless the caller signalled per-line tax.
  let resolvedTax;
  try {
    resolvedTax = await effectiveTaxForFlow({ tenantId, taxId: req.body.taxId, sourceType: "vendor_return" });
  } catch (e) {
    throw new ValidationError(e.message);
  }

  // Calculate totals
  let subtotal = 0;
  let taxAmount = 0;
  const processedItems = items?.map((item) => {
    const amount = (item.quantity || 0) * (item.unitPrice || 0);
    const tax = amount * ((item.taxRate || 0) / 100);
    subtotal += amount;
    taxAmount += tax;
    return {
      ...item,
      amount: amount + tax,
    };
  }) || [];

  if (resolvedTax && resolvedTax.taxRate !== null && !items?.some(item => Object.hasOwn(item, "taxRate"))) {
    taxAmount = round2((subtotal * resolvedTax.taxRate) / 100);
  }

  const totalAmount = subtotal + taxAmount;

  // Generate return number
  const returnNumber = await generateReturnNumber(tenantId);

  const vendorReturn = new VendorReturn({
    returnNumber,
    tenant: tenantId,
    vendor,
    vendorName,
    purchaseOrder,
    poNumber,
    vendorBill,
    billNumber,
    currency: currency || "NGN",
    items: processedItems,
    subtotal,
    taxAmount,
    totalAmount,
    reason,
    notes,
    shippingCarrier,
    trackingNumber,
    returnAddress,
    warehouse,
    createdBy: req.user._id,
  });

  await vendorReturn.save();

  res.status(201).json({
    success: true,
    data: vendorReturn,
    message: "Vendor return created successfully",
  });
});

// @route   GET /api/vendor-returns
// @desc    Get all vendor returns for tenant
// @access  Private
exports.getVendorReturns = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant;
  const { status, vendor, purchaseOrder, subProductId, startDate, endDate, search, page = 1, limit = 20 } = req.query;

  const query = { tenant: tenantId };

  if (status) query.status = status;
  if (vendor) query.vendor = vendor;
  if (purchaseOrder) query.purchaseOrder = purchaseOrder;
  if (subProductId) query['items.subProductId'] = subProductId;
  if (startDate || endDate) {
    query.returnDate = {};
    if (startDate) query.returnDate.$gte = new Date(startDate);
    if (endDate) query.returnDate.$lte = new Date(endDate);
  }
  if (search) {
    const re = new RegExp(search, "i");
    query.$or = [
      { returnNumber: re },
      { vendorName: re },
      { poNumber: re },
    ];
  }

  const aggregate = await VendorReturn.aggregate([
    { $match: { tenant: tenantId } },
    {
      $group: {
        _id: null,
        totalCount: { $sum: 1 },
        totalValue: { $sum: "$totalAmount" },
        totalRefunded: { $sum: "$refundAmount" },
        draftCount: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
        confirmedCount: { $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] } },
        refundedCount: { $sum: { $cond: [{ $eq: ["$status", "refunded"] }, 1, 0] } },
        requestedCount: { $sum: { $cond: [{ $eq: ["$status", "requested"] }, 1, 0] } },
        shippedCount: { $sum: { $cond: [{ $eq: ["$status", "shipped"] }, 1, 0] } },
        inTransitCount: { $sum: { $cond: [{ $eq: ["$status", "in_transit"] }, 1, 0] } },
        receivedCount: { $sum: { $cond: [{ $eq: ["$status", "received"] }, 1, 0] } },
        cancelledCount: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
        rejectedCount: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
      },
    },
  ]);
  const stats = aggregate[0] || {};

  const total = await VendorReturn.countDocuments(query);
  const returns = await VendorReturn.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .populate("vendor", "name email phone")
    .populate("purchaseOrder", "poNumber")
    .populate("vendorBill", "billNumber")
    .populate("createdBy", "name email");

  res.json({
    success: true,
    data: returns,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalCount: total,
    },
    stats: {
      totalCount: stats.totalCount || 0,
      totalValue: stats.totalValue || 0,
      totalRefunded: stats.totalRefunded || 0,
      draftCount: stats.draftCount || 0,
      confirmedCount: stats.confirmedCount || 0,
      refundedCount: stats.refundedCount || 0,
      cancelledCount: stats.cancelledCount || 0,
    },
  });
});

// @route   GET /api/vendor-returns/:id
// @desc    Get single vendor return
// @access  Private
exports.getVendorReturn = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant;
  const { id } = req.params;

  const vendorReturn = await VendorReturn.findOne({
    _id: id,
    tenant: tenantId,
  })
    .populate("vendor")
    .populate("purchaseOrder")
    .populate("vendorBill")
    .populate("warehouse", "name code type")
    .populate("createdBy", "name email")
    .populate("confirmedBy", "name email")
    .populate("receivedBy", "name email")
    .populate("refunds.recordedBy", "name");

  if (!vendorReturn) {
    return res.status(404).json({
      success: false,
      message: "Vendor return not found",
    });
  }

  res.json({
    success: true,
    data: vendorReturn,
  });
});

// @route   PATCH /api/vendor-returns/:id
// @desc    Update vendor return
// @access  Private
exports.updateVendorReturn = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant;
  const { id } = req.params;
  const updates = { ...req.body };

  if (Object.keys(updates).some(field => field.includes('.') || field.startsWith('$'))) {
    return res.status(400).json({ success: false, message: 'Nested field updates must use the return workflow' });
  }

  // Workflow and inventory bookkeeping are owned by their dedicated endpoints.
  // Letting a generic PATCH reset either field can make the document claim the
  // stock was never deducted and allows the same return to be applied twice.
  const protectedFields = [
    "status",
    "stockAdjusted",
    "poCountersAdjusted",
    "poCounterAdjustments",
    "confirmedBy",
    "confirmedAt",
    "requestedDate",
    "shippedDate",
    "receivedBy",
    "receivedDate",
    "refundedDate",
    "refundStatus",
    "refundAmount",
    "refunds",
    "refundMethod",
    "refundReference",
    "refundDate",
    "subtotal",
    "taxAmount",
    "totalAmount",
  ];
  const attemptedProtectedField = protectedFields.find((field) =>
    Object.prototype.hasOwnProperty.call(updates, field)
  );
  if (attemptedProtectedField) {
    return res.status(400).json({
      success: false,
      message: `${attemptedProtectedField} must be changed through the return workflow`,
    });
  }

  const existingReturn = await VendorReturn.findOne({ _id: id, tenant: tenantId });
  if (!existingReturn) return res.status(404).json({ success: false, message: 'Vendor return not found' });
  const stockFields = ['items', 'warehouse', 'purchaseOrder', 'vendorBill', 'vendor', 'vendorName', 'currency', 'taxId'];
  if (existingReturn.status !== 'draft' && stockFields.some(field => Object.hasOwn(updates, field))) {
    return res.status(400).json({ success: false, message: 'Stock and value can only be edited on draft returns' });
  }

  // Remove fields that shouldn't be updated
  delete updates.tenant;
  delete updates.returnNumber;
  delete updates.createdBy;

  // The warehouse must be fixed before stock is taken out; changing it after
  // confirmation would leave the wrong lot debited in the history.
  if (updates.warehouse) {
    const existing = await VendorReturn.findOne({ _id: id, tenant: tenantId });
    if (existing && existing.stockAdjusted) {
      return res.status(400).json({
        success: false,
        message: "Warehouse cannot change after stock has been deducted from it",
      });
    }
  }

  // If items are updated, recalculate totals
  if (updates.items) {
    // Resolve the header Tax ref (or tenant default). VendorReturn stores only
    // header-level tax (no per-line rate in the schema), so the resolved rate
    // is applied to taxAmount below unless the caller signalled per-line tax.
    let resolvedTax;
    try {
      resolvedTax = await effectiveTaxForFlow({ tenantId, taxId: req.body.taxId, sourceType: "vendor_return" });
    } catch (e) {
      throw new ValidationError(e.message);
    }
    let subtotal = 0;
    let taxAmount = 0;
    updates.items = updates.items.map((item) => {
      const amount = (item.quantity || 0) * (item.unitPrice || 0);
      const tax = amount * ((item.taxRate || 0) / 100);
      subtotal += amount;
      taxAmount += tax;
      return {
        ...item,
        amount: amount + tax,
      };
    });
    if (resolvedTax && resolvedTax.taxRate !== null && !updates.items.some(item => Object.hasOwn(item, "taxRate"))) {
      taxAmount = round2((subtotal * resolvedTax.taxRate) / 100);
    }
    updates.subtotal = subtotal;
    updates.taxAmount = taxAmount;
    updates.totalAmount = subtotal + taxAmount;
  }

  const vendorReturn = await VendorReturn.findOneAndUpdate(
    { _id: id, tenant: tenantId },
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!vendorReturn) {
    return res.status(404).json({
      success: false,
      message: "Vendor return not found",
    });
  }

  res.json({
    success: true,
    data: vendorReturn,
    message: "Vendor return updated successfully",
  });
});

// @route   PATCH /api/vendor-returns/:id/status
// @desc    Update vendor return status
// @access  Private
exports.updateReturnStatus = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant;
  const { id } = req.params;
  const { status, notes } = req.body;

  const statusFlows = {
    draft: ["confirmed", "cancelled"],
    confirmed: ["requested", "received", "cancelled"],
    requested: ["shipped", "cancelled"],
    shipped: ["in_transit", "cancelled"],
    in_transit: ["received", "rejected"],
    received: ["refunded"],
    refunded: [],
    rejected: [],
    cancelled: [],
  };

  const vendorReturn = await VendorReturn.findOne({
    _id: id,
    tenant: tenantId,
  });

  if (!vendorReturn) {
    return res.status(404).json({
      success: false,
      message: "Vendor return not found",
    });
  }

  // Validate status transition
  const allowedTransitions = statusFlows[vendorReturn.status] || [];
  if (!allowedTransitions.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot transition from ${vendorReturn.status} to ${status}`,
    });
  }

  if (status === 'refunded') {
    return res.status(400).json({ success: false, message: 'Use Record Refund to settle the remaining balance' });
  }
  if (['cancelled', 'rejected'].includes(status) && (vendorReturn.refundAmount || 0) > 0) {
    return res.status(400).json({ success: false, message: 'A return with recorded refunds cannot be cancelled or rejected' });
  }

  const updateData = { status };

  // Set timestamps based on status
  switch (status) {
    case "confirmed":
      updateData.confirmedBy = req.user._id;
      updateData.confirmedAt = new Date();
      break;
    case "requested":
      updateData.requestedDate = new Date();
      break;
    case "shipped":
      updateData.shippedDate = new Date();
      break;
    case "received":
      updateData.receivedBy = req.user._id;
      updateData.receivedByName = req.user.name;
      updateData.receivedDate = new Date();
      break;
    case "refunded":
      updateData.refundedDate = new Date();
      break;
  }

  if (notes) {
    updateData.notes = notes;
  }

  const prevStatus = vendorReturn.status;
  const stockReturn = require("../services/vendorReturn.stock");

  // Validate and apply the physical stock operation first. In particular, an
  // insufficient-stock failure must leave PO counters and bills untouched.
  // The stock service is idempotent, so retrying a request that lost its
  // response cannot deduct the same return twice.
  if (prevStatus === 'draft' && status === 'confirmed') {
    await require('../services/vendorReturn.quantities').validatePurchaseReturn(vendorReturn, tenantId);
    await stockReturn.applyVendorReturnStock(
      vendorReturn,
      { tenantId, userId: req.user._id },
      {}
    );
  } else if (status === 'cancelled' && prevStatus !== 'draft') {
    await stockReturn.reverseVendorReturnStock(
      vendorReturn,
      { tenantId, userId: req.user._id },
      {}
    );
  }

  if (vendorReturn.purchaseOrder && vendorReturn.items?.length) {
    const counters = require('../services/vendorReturn.counters');
    if (prevStatus === 'draft' && status === 'confirmed') {
      await counters.syncPurchaseReturnCounters(vendorReturn, tenantId, 'deduct');
      await adjustBillForReturn(tenantId, vendorReturn, 'deduct');
    }
    if (status === 'cancelled' && prevStatus !== 'draft') {
      await counters.syncPurchaseReturnCounters(vendorReturn, tenantId, 'restore');
      await adjustBillForReturn(tenantId, vendorReturn, 'restore');
    }
  }

  const updated = await VendorReturn.findOneAndUpdate(
    { _id: id, tenant: tenantId },
    { $set: updateData },
    { new: true }
  );

  if (status === "refunded") {
    captureDocumentTax({ sourceType: 'vendor_return', doc: updated, postedBy: req.user._id });
    await postDocumentEntry({ sourceType: 'vendor_return', doc: updated, postedBy: req.user._id });
  } else if (status === "cancelled") {
    await reverseDocumentEntry({ sourceType: 'vendor_return', doc: updated, userId: req.user._id });
    reverseDocumentTax({ sourceType: 'vendor_return', doc: updated, userId: req.user._id });
  }

  res.json({
    success: true,
    data: updated,
    message: `Return status updated to ${status}`,
  });
});

// @route   POST /api/vendor-returns/:id/refund
// @desc    Record refund for vendor return
// @access  Private
exports.recordRefund = asyncHandler(async (req, res) => {
  const updated = await require('../services/vendorReturn.refund').recordVendorRefund({
    id: req.params.id, tenantId: req.user.tenant, userId: req.user._id, data: req.body,
  });
  if (updated.refundStatus === 'completed') {
    await captureDocumentTax({ sourceType: 'vendor_return', doc: updated, postedBy: req.user._id });
  }
  res.json({ success: true, data: updated, message: 'Refund recorded successfully' });
});

// @route   DELETE /api/vendor-returns/:id
// @desc    Delete vendor return (only draft)
// @access  Private
exports.deleteVendorReturn = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant;
  const { id } = req.params;

  const vendorReturn = await VendorReturn.findOne({
    _id: id,
    tenant: tenantId,
  });

  if (!vendorReturn) {
    return res.status(404).json({
      success: false,
      message: "Vendor return not found",
    });
  }

  if (vendorReturn.status !== "draft") {
    return res.status(400).json({
      success: false,
      message: "Only draft returns can be deleted",
    });
  }

  await VendorReturn.findByIdAndDelete(id);

  res.json({
    success: true,
    message: "Vendor return deleted successfully",
  });
});

// @desc    Create Vendor Return from Vendor Bill
// @route   POST /api/vendor-returns/from-bill
// @access  Private (Tenant admin)
exports.createReturnFromBill = asyncHandler(async (req, res) => {
  const { billId, items, reason, notes, returnAddress, warehouse } = req.body;
  const tenantId = req.user.tenant;

  if (!billId) {
    return res.status(400).json({ success: false, message: "Bill ID is required" });
  }

  const VendorBill = require('../models/VendorBill');
  const bill = await VendorBill.findOne({
    _id: billId,
    tenant: tenantId,
  });

  if (!bill) {
    return res.status(404).json({ success: false, message: "Vendor bill not found" });
  }

  // Generate return number
  const returnNumber = await generateReturnNumber(tenantId);

  // Process items - if no specific items provided, use all bill items with qty 0
  let processedItems = [];
  let subtotal = 0;
  let taxAmount = 0;

  if (items && items.length > 0) {
    processedItems = items.map(item => {
      const unitPrice = item.unitPrice || 0;
      const quantity = item.quantity || 0;
      const taxRate = item.taxRate || 0;
      const amount = quantity * unitPrice;
      const itemTax = amount * (taxRate / 100);
      subtotal += amount;
      taxAmount += itemTax;
      return {
        subProductId: item.subProductId,
        subProductName: item.subProductName,
        sku: item.sku,
        sizeId: item.sizeId,
        sizeName: item.sizeName,
        quantity: quantity,
        unitPrice: unitPrice,
        taxRate: taxRate,
        amount: amount + itemTax,
        reason: item.reason || reason,
        condition: item.condition || 'other',
      };
    });
  } else {
    // Use all bill items
    processedItems = (bill.items || []).map(item => {
      const quantity = item.quantity || 0;
      const unitPrice = item.unitPrice || 0;
      const taxRate = item.taxRate || 0;
      const amount = quantity * unitPrice;
      const itemTax = amount * (taxRate / 100);
      subtotal += amount;
      taxAmount += itemTax;
      return {
        subProductId: item.subProductId,
        subProductName: item.subProductName,
        sku: item.sku,
        sizeId: item.sizeId,
        sizeName: item.sizeName,
        quantity: quantity,
        unitPrice: unitPrice,
        taxRate: taxRate,
        amount: amount + itemTax,
        reason: reason,
        condition: 'other',
      };
    });
  }

  const totalAmount = subtotal + taxAmount;

  const vendorReturn = new VendorReturn({
    tenant: tenantId,
    returnNumber,
    vendor: bill.vendor,
    vendorName: bill.vendorName,
    purchaseOrder: bill.purchaseOrder,
    poNumber: bill.purchaseOrder ? bill.purchaseOrder.toString() : undefined,
    vendorBill: bill._id,
    billNumber: bill.billNumber,
    currency: bill.currency || 'NGN',
    items: processedItems,
    subtotal,
    taxAmount,
    totalAmount,
    reason,
    notes,
    returnAddress,
    warehouse,
    status: 'draft',
    refundStatus: 'none',
    createdBy: req.user._id,
  });

  await vendorReturn.save();

  res.status(201).json({
    success: true,
    data: vendorReturn,
    message: "Vendor return created successfully",
  });
});

module.exports = exports;
