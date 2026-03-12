// controllers/vendorReturn.controller.js
const VendorReturn = require("../models/VendorReturn");
const PurchaseOrder = require("../models/PurchaseOrder");
const SubProduct = require("../models/SubProduct");

// @route   POST /api/vendor-returns
// @desc    Create a new vendor return
// @access  Private
exports.createVendorReturn = async (req, res) => {
  try {
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
    } = req.body;

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

    const totalAmount = subtotal + taxAmount;

    const vendorReturn = new VendorReturn({
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
      createdBy: req.user._id,
    });

    await vendorReturn.save();

    res.status(201).json({
      success: true,
      data: vendorReturn,
      message: "Vendor return created successfully",
    });
  } catch (error) {
    console.error("Error creating vendor return:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create vendor return",
      error: error.message,
    });
  }
};

// @route   GET /api/vendor-returns
// @desc    Get all vendor returns for tenant
// @access  Private
exports.getVendorReturns = async (req, res) => {
  try {
    const tenantId = req.user.tenant;
    const { status, vendor, startDate, endDate, page = 1, limit = 20 } = req.query;

    const query = { tenant: tenantId };

    if (status) query.status = status;
    if (vendor) query.vendor = vendor;
    if (startDate || endDate) {
      query.returnDate = {};
      if (startDate) query.returnDate.$gte = new Date(startDate);
      if (endDate) query.returnDate.$lte = new Date(endDate);
    }

    const total = await VendorReturn.countDocuments(query);
    const returns = await VendorReturn.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("vendor", "name email phone")
      .populate("purchaseOrder", "poNumber")
      .populate("vendorBill", "billNumber");

    res.json({
      success: true,
      data: returns,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalCount: total,
      },
    });
  } catch (error) {
    console.error("Error fetching vendor returns:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch vendor returns",
      error: error.message,
    });
  }
};

// @route   GET /api/vendor-returns/:id
// @desc    Get single vendor return
// @access  Private
exports.getVendorReturn = async (req, res) => {
  try {
    const tenantId = req.user.tenant;
    const { id } = req.params;

    const vendorReturn = await VendorReturn.findOne({
      _id: id,
      tenant: tenantId,
    })
      .populate("vendor")
      .populate("purchaseOrder")
      .populate("vendorBill")
      .populate("createdBy", "name email")
      .populate("confirmedBy", "name email")
      .populate("receivedBy", "name email");

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
  } catch (error) {
    console.error("Error fetching vendor return:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch vendor return",
      error: error.message,
    });
  }
};

// @route   PATCH /api/vendor-returns/:id
// @desc    Update vendor return
// @access  Private
exports.updateVendorReturn = async (req, res) => {
  try {
    const tenantId = req.user.tenant;
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated
    delete updates.tenant;
    delete updates.returnNumber;
    delete updates.createdBy;

    // If items are updated, recalculate totals
    if (updates.items) {
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
  } catch (error) {
    console.error("Error updating vendor return:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update vendor return",
      error: error.message,
    });
  }
};

// @route   PATCH /api/vendor-returns/:id/status
// @desc    Update vendor return status
// @access  Private
exports.updateReturnStatus = async (req, res) => {
  try {
    const tenantId = req.user.tenant;
    const { id } = req.params;
    const { status, notes } = req.body;

    const statusFlows = {
      draft: ["confirmed", "cancelled"],
      confirmed: ["requested", "cancelled"],
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

    const updated = await VendorReturn.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    res.json({
      success: true,
      data: updated,
      message: `Return status updated to ${status}`,
    });
  } catch (error) {
    console.error("Error updating return status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update return status",
      error: error.message,
    });
  }
};

// @route   POST /api/vendor-returns/:id/refund
// @desc    Record refund for vendor return
// @access  Private
exports.recordRefund = async (req, res) => {
  try {
    const tenantId = req.user.tenant;
    const { id } = req.params;
    const { amount, method, reference, notes } = req.body;

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

    if (vendorReturn.status !== "received") {
      return res.status(400).json({
        success: false,
        message: "Return must be received before recording refund",
      });
    }

    const newRefundAmount = (vendorReturn.refundAmount || 0) + amount;

    if (newRefundAmount > vendorReturn.totalAmount) {
      return res.status(400).json({
        success: false,
        message: "Refund amount exceeds return total",
      });
    }

    const updateData = {
      refundAmount: newRefundAmount,
      refundMethod: method,
      refundReference: reference,
      refundDate: new Date(),
    };

    if (newRefundAmount >= vendorReturn.totalAmount) {
      updateData.refundStatus = "completed";
    } else {
      updateData.refundStatus = "processing";
    }

    const updated = await VendorReturn.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    res.json({
      success: true,
      data: updated,
      message: "Refund recorded successfully",
    });
  } catch (error) {
    console.error("Error recording refund:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record refund",
      error: error.message,
    });
  }
};

// @route   DELETE /api/vendor-returns/:id
// @desc    Delete vendor return (only draft)
// @access  Private
exports.deleteVendorReturn = async (req, res) => {
  try {
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
  } catch (error) {
    console.error("Error deleting vendor return:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete vendor return",
      error: error.message,
    });
  }
};

// @desc    Create Vendor Return from Vendor Bill
// @route   POST /api/vendor-returns/from-bill
// @access  Private (Tenant admin)
exports.createReturnFromBill = async (req, res) => {
  try {
    const { billId, items, reason, notes, returnAddress } = req.body;
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
    const count = await VendorReturn.countDocuments({ tenant: tenantId });
    const year = new Date().getFullYear();
    const returnNumber = `RET-${year}-${String(count + 1).padStart(5, '0')}`;

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
  } catch (error) {
    console.error("Error creating vendor return from bill:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create vendor return",
      error: error.message,
    });
  }
};

module.exports = exports;
