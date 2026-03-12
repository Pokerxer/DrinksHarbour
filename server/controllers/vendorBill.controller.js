// controllers/vendorBill.controller.js
const asyncHandler = require("express-async-handler");
const VendorBill = require("../models/VendorBill");
const PurchaseOrder = require("../models/PurchaseOrder");
const {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} = require("../utils/errors");

/**
 * Helper to get tenant ID
 */
const resolveTenantId = async (req) => {
  if (req.tenant?._id) return req.tenant._id;

  if (req.user?.tenant) {
    const userTenant = req.user.tenant;
    const tenantId =
      typeof userTenant === "object" && userTenant._id
        ? userTenant._id
        : userTenant;
    return tenantId;
  }

  throw new ForbiddenError("Tenant context required");
};

// @desc    Create new vendor bill
// @route   POST /api/vendor-bills
// @access  Private (Tenant admin)
const createVendorBill = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const userId = req.user?._id;

  if (!userId) {
    throw new ForbiddenError("User context required");
  }

  const {
    billNumber,
    vendor,
    vendorName,
    purchaseOrder,
    currency,
    items,
    billDate,
    dueDate,
    notes,
    terms,
    billControlPolicy,
  } = req.body;

  // Validate required fields
  if (!billNumber || !vendorName) {
    throw new ValidationError("Bill number and vendor are required");
  }

  // Calculate totals
  let subtotal = 0;
  let taxAmount = 0;
  const processedItems = (items || []).map((item) => {
    const itemSubtotal = (item.quantity || 0) * (item.unitPrice || 0);
    const itemTax = itemSubtotal * ((item.taxRate || 0) / 100);
    subtotal += itemSubtotal;
    taxAmount += itemTax;
    return {
      ...item,
      amount: itemSubtotal + itemTax,
    };
  });

  const totalAmount = subtotal + taxAmount;

  const vendorBill = await VendorBill.create({
    tenant: tenantId,
    billNumber,
    vendor,
    vendorName,
    purchaseOrder,
    currency: currency || "NGN",
    items: processedItems,
    subtotal,
    taxAmount,
    totalAmount,
    billDate: billDate || new Date(),
    dueDate,
    notes,
    terms,
    billControlPolicy: billControlPolicy || "received",
    createdBy: userId,
  });

  res.status(201).json({
    success: true,
    data: vendorBill,
  });
});

// @desc    Get vendor bill by ID
// @route   GET /api/vendor-bills/:id
// @access  Private (Tenant admin)
const getVendorBill = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = await resolveTenantId(req);

  const vendorBill = await VendorBill.findOne({
    _id: id,
    tenant: tenantId,
  })
    .populate("vendor", "name email phone")
    .populate("purchaseOrder", "poNumber status")
    .populate("createdBy", "name")
    .populate("payments.recordedBy", "name");

  if (!vendorBill) {
    throw new NotFoundError("Vendor Bill not found");
  }

  res.status(200).json({
    success: true,
    data: vendorBill,
  });
});

// @desc    Get all vendor bills
// @route   GET /api/vendor-bills
// @access  Private (Tenant admin)
const getVendorBills = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);

  // Query parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const status = req.query.status;
  const vendor = req.query.vendor;
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;

  // Build filter
  const filter = { tenant: tenantId };
  if (status) filter.status = status;
  if (vendor) filter.vendor = vendor;
  if (startDate || endDate) {
    filter.billDate = {};
    if (startDate) filter.billDate.$gte = new Date(startDate);
    if (endDate) filter.billDate.$lte = new Date(endDate);
  }

  const vendorBills = await VendorBill.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("vendor", "name")
    .populate("purchaseOrder", "poNumber status");

  const totalCount = await VendorBill.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: vendorBills,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    },
  });
});

// @desc    Update vendor bill
// @route   PATCH /api/vendor-bills/:id
// @access  Private (Tenant admin)
const updateVendorBill = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = await resolveTenantId(req);

  const vendorBill = await VendorBill.findOne({
    _id: id,
    tenant: tenantId,
  });

  if (!vendorBill) {
    throw new NotFoundError("Vendor Bill not found");
  }

  // Don't allow editing if confirmed/paid
  if (["confirmed", "paid", "partial"].includes(vendorBill.status)) {
    throw new ValidationError("Cannot edit confirmed or paid bills");
  }

  const {
    vendor,
    vendorName,
    items,
    billDate,
    dueDate,
    notes,
    terms,
  } = req.body;

  // Update fields if provided
  if (vendor) vendorBill.vendor = vendor;
  if (vendorName) vendorBill.vendorName = vendorName;
  if (billDate) vendorBill.billDate = billDate;
  if (dueDate) vendorBill.dueDate = dueDate;
  if (notes) vendorBill.notes = notes;
  if (terms) vendorBill.terms = terms;

  // Recalculate if items updated
  if (items && Array.isArray(items)) {
    let subtotal = 0;
    let taxAmount = 0;
    const processedItems = items.map((item) => {
      const itemSubtotal = (item.quantity || 0) * (item.unitPrice || 0);
      const itemTax = itemSubtotal * ((item.taxRate || 0) / 100);
      subtotal += itemSubtotal;
      taxAmount += itemTax;
      return {
        ...item,
        amount: itemSubtotal + itemTax,
      };
    });

    vendorBill.items = processedItems;
    vendorBill.subtotal = subtotal;
    vendorBill.taxAmount = taxAmount;
    vendorBill.totalAmount = subtotal + taxAmount;
  }

  await vendorBill.save();

  res.status(200).json({
    success: true,
    data: vendorBill,
  });
});

// @desc    Delete vendor bill
// @route   DELETE /api/vendor-bills/:id
// @access  Private (Tenant admin)
const deleteVendorBill = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = await resolveTenantId(req);

  const vendorBill = await VendorBill.findOne({
    _id: id,
    tenant: tenantId,
  });

  if (!vendorBill) {
    throw new NotFoundError("Vendor Bill not found");
  }

  // Don't allow deletion if confirmed/paid
  if (["confirmed", "paid", "partial"].includes(vendorBill.status)) {
    throw new ValidationError("Cannot delete confirmed or paid bills");
  }

  await VendorBill.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: "Vendor Bill deleted successfully",
  });
});

// @desc    Record payment for vendor bill
// @route   POST /api/vendor-bills/:id/pay
// @access  Private (Tenant admin)
const recordPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, date, method, reference, notes } = req.body;
  const tenantId = await resolveTenantId(req);
  const userId = req.user?._id;

  const vendorBill = await VendorBill.findOne({
    _id: id,
    tenant: tenantId,
  });

  if (!vendorBill) {
    throw new NotFoundError("Vendor Bill not found");
  }

  // Add payment
  const payment = {
    amount: amount || vendorBill.remainingAmount,
    date: date || new Date(),
    method,
    reference,
    notes,
    recordedBy: userId,
  };

  vendorBill.payments.push(payment);
  vendorBill.paidAmount = (vendorBill.paidAmount || 0) + payment.amount;

  // Update status based on payment
  if (vendorBill.paidAmount >= vendorBill.totalAmount) {
    vendorBill.status = "paid";
  } else if (vendorBill.paidAmount > 0) {
    vendorBill.status = "partial";
  }

  await vendorBill.save();

  res.status(200).json({
    success: true,
    data: vendorBill,
  });
});

// @desc    Validate vendor bill (3-way matching)
// @route   POST /api/vendor-bills/:id/validate
// @access  Private (Tenant admin)
const validateBill = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { override, notes } = req.body;
  const tenantId = await resolveTenantId(req);

  const vendorBill = await VendorBill.findOne({
    _id: id,
    tenant: tenantId,
  }).populate("purchaseOrder");

  if (!vendorBill) {
    throw new NotFoundError("Vendor Bill not found");
  }

  const po = vendorBill.purchaseOrder;
  let matchingStatus = "matched";
  let shouldBePaid = "pending";
  
  // Initialize matching details with size-level breakdown
  const matchingDetails = {
    priceMatch: true,
    quantityMatch: true,
    receivedMatch: true,
    poTotal: 0,
    billTotal: vendorBill.totalAmount,
    receivedTotal: 0,
    variance: 0,
    varianceReason: "",
    itemComparisons: [], // Detailed per-item + size comparison
    sizeBreakdown: {}, // Breakdown by size
  };

  // Helper to create item key from subProductId + sizeId
  const getItemKey = (item) => {
    const prodId = item.subProductId?.toString() || item.subProductId || '';
    const sizeId = item.sizeId?.toString() || item.sizeId || 'nosize';
    return `${prodId}::${sizeId}`;
  };

  // Helper to get item display name
  const getItemDisplayName = (item) => {
    return item.sizeName ? `${item.subProductName} (${item.sizeName})` : item.subProductName;
  };

  // Build bill items map by key
  const billItemsMap = {};
  let billTotalQty = 0;
  let billTotalAmount = 0;

  vendorBill.items.forEach(item => {
    const key = getItemKey(item);
    const qty = item.quantity || 0;
    const price = item.unitPrice || 0;
    const amount = qty * price;
    
    if (!billItemsMap[key]) {
      billItemsMap[key] = {
        subProductId: item.subProductId,
        subProductName: item.subProductName,
        sizeId: item.sizeId,
        sizeName: item.sizeName,
        sku: item.sku,
        billQty: 0,
        billPrice: price,
        billAmount: 0,
      };
    }
    billItemsMap[key].billQty += qty;
    billItemsMap[key].billAmount += amount;
    billTotalQty += qty;
    billTotalAmount += amount;
  });

  matchingDetails.billTotal = billTotalAmount;
  vendorBill.billQty = billTotalQty;

  if (po && po.items) {
    // Build PO items map by key
    const poItemsMap = {};
    let poOrderedQty = 0;
    let poReceivedQty = 0;
    let poOrderedAmount = 0;
    let poReceivedAmount = 0;

    po.items.forEach(item => {
      const key = getItemKey(item);
      const orderedQty = item.quantity || 0;
      const receivedQty = item.receivedQty || 0;
      const unitCost = item.unitCost || 0;
      
      if (!poItemsMap[key]) {
        poItemsMap[key] = {
          subProductId: item.subProductId,
          subProductName: item.subProductName,
          sizeId: item.sizeId,
          sizeName: item.sizeName,
          orderedQty: 0,
          receivedQty: 0,
          orderedPrice: unitCost,
          orderedAmount: 0,
          receivedAmount: 0,
        };
      }
      poItemsMap[key].orderedQty += orderedQty;
      poItemsMap[key].receivedQty += receivedQty;
      poItemsMap[key].orderedAmount += orderedQty * unitCost;
      poItemsMap[key].receivedAmount += receivedQty * unitCost;
      
      poOrderedQty += orderedQty;
      poReceivedQty += receivedQty;
      poOrderedAmount += orderedQty * unitCost;
      poReceivedAmount += receivedQty * unitCost;
    });

    matchingDetails.poTotal = poOrderedAmount;
    matchingDetails.receivedTotal = poReceivedAmount;
    vendorBill.poOrderedQty = poOrderedQty;
    vendorBill.poReceivedQty = poReceivedQty;

    // Compare each item + size combination
    const itemComparisons = [];
    const sizeBreakdown = {};

    // Check all bill items against PO
    Object.keys(billItemsMap).forEach(key => {
      const billItem = billItemsMap[key];
      const poItem = poItemsMap[key];
      const itemDisplayName = getItemDisplayName(billItem);
      const sizeKey = billItem.sizeName || 'Default';

      if (!poItem) {
        // Item/size not in PO - mismatch
        itemComparisons.push({
          key,
          subProductName: billItem.subProductName,
          sizeName: billItem.sizeName,
          status: 'extra_in_bill',
          message: `Item ${itemDisplayName} in bill but not in PO`,
          billQty: billItem.billQty,
          billPrice: billItem.billPrice,
          billAmount: billItem.billAmount,
          poOrderedQty: 0,
          poOrderedPrice: 0,
          poReceivedQty: 0,
        });
        matchingStatus = "mismatch";
        matchingDetails.quantityMatch = false;
      } else {
        // Compare quantities
        const qtyDiff = billItem.billQty - poItem.orderedQty;
        const priceDiff = Math.abs(billItem.billPrice - poItem.orderedPrice);
        const priceMatch = priceDiff <= 0.01; // 1 cent tolerance
        const qtyMatch = billItem.billQty === poItem.orderedQty;
        const receivedMatch = billItem.billQty <= poItem.receivedQty;

        let itemStatus = 'matched';
        if (!qtyMatch || !priceMatch) {
          itemStatus = 'mismatch';
          matchingStatus = "mismatch";
          matchingDetails.quantityMatch = false;
          matchingDetails.priceMatch = false;
        }

        // Check received qty for "received" policy
        if (vendorBill.billControlPolicy === "received" && !receivedMatch) {
          matchingDetails.receivedMatch = false;
        }

        itemComparisons.push({
          key,
          subProductName: billItem.subProductName,
          sizeName: billItem.sizeName,
          status: itemStatus,
          message: !qtyMatch ? `Qty mismatch: bill ${billItem.billQty} vs PO ${poItem.orderedQty}` :
                    !priceMatch ? `Price mismatch: bill ${billItem.billPrice} vs PO ${poItem.orderedPrice}` : 'Matched',
          billQty: billItem.billQty,
          billPrice: billItem.billPrice,
          billAmount: billItem.billAmount,
          poOrderedQty: poItem.orderedQty,
          poOrderedPrice: poItem.orderedPrice,
          poReceivedQty: poItem.receivedQty,
          qtyDiff,
          priceDiff,
        });

        // Add to size breakdown
        if (!sizeBreakdown[sizeKey]) {
          sizeBreakdown[sizeKey] = {
            sizeName: sizeKey,
            billQty: 0,
            billAmount: 0,
            poOrderedQty: 0,
            poOrderedAmount: 0,
            poReceivedQty: 0,
            poReceivedAmount: 0,
          };
        }
        sizeBreakdown[sizeKey].billQty += billItem.billQty;
        sizeBreakdown[sizeKey].billAmount += billItem.billAmount;
        sizeBreakdown[sizeKey].poOrderedQty += poItem.orderedQty;
        sizeBreakdown[sizeKey].poOrderedAmount += poItem.orderedAmount;
        sizeBreakdown[sizeKey].poReceivedQty += poItem.receivedQty;
        sizeBreakdown[sizeKey].poReceivedAmount += poItem.receivedAmount;
      }
    });

    // Check for items in PO but not in bill (underreceived)
    Object.keys(poItemsMap).forEach(key => {
      if (!billItemsMap[key]) {
        const poItem = poItemsMap[key];
        const itemDisplayName = getItemDisplayName(poItem);
        
        itemComparisons.push({
          key,
          subProductName: poItem.subProductName,
          sizeName: poItem.sizeName,
          status: 'missing_in_bill',
          message: `Item ${itemDisplayName} in PO but not in bill`,
          billQty: 0,
          billPrice: 0,
          billAmount: 0,
          poOrderedQty: poItem.orderedQty,
          poOrderedPrice: poItem.orderedPrice,
          poReceivedQty: poItem.receivedQty,
        });
        matchingStatus = "underreceived";
      }
    });

    matchingDetails.itemComparisons = itemComparisons;
    matchingDetails.sizeBreakdown = sizeBreakdown;

    // Calculate overall variance
    const amountDiff = Math.abs(billTotalAmount - poOrderedAmount);
    const tolerance = poOrderedAmount * 0.01; // 1% tolerance
    if (amountDiff > tolerance) {
      matchingDetails.variance = amountDiff;
      matchingDetails.varianceReason = `Total mismatch: Bill (${vendorBill.currency} ${billTotalAmount.toFixed(2)}) vs PO (${vendorBill.currency} ${poOrderedAmount.toFixed(2)})`;
    }

    // Determine "should be paid"
    if (po.status !== "validated") {
      shouldBePaid = "pending";
      matchingNotes = "PO not yet validated";
    } else if (matchingStatus === "matched") {
      shouldBePaid = "yes";
    } else if (matchingStatus === "underreceived") {
      // Underreceived is okay - they billed for less than ordered
      shouldBePaid = vendorBill.billControlPolicy === "received" ? "yes" : "yes";
    } else {
      // mismatch or overreceived - needs review
      shouldBePaid = "exception";
      matchingNotes = matchingDetails.itemComparisons
        .filter(c => c.status !== 'matched')
        .map(c => c.message)
        .join('; ');
    }

    // Check received qty policy
    if (vendorBill.billControlPolicy === "received" && po.status === "validated") {
      const totalReceived = Object.values(poItemsMap).reduce((sum, item) => sum + item.receivedQty, 0);
      if (billTotalQty > totalReceived) {
        shouldBePaid = "exception";
        matchingNotes = `Bill qty (${billTotalQty}) exceeds received qty (${totalReceived})`;
      }
    }
  } else {
    matchingStatus = "pending";
    shouldBePaid = "pending";
    matchingNotes = "No linked PO for comparison";
  }

  // Handle override
  if (override) {
    matchingStatus = override;
    shouldBePaid = override === "matched" ? "yes" : "exception";
    matchingNotes = notes || "Manually overridden";
    vendorBill.overrideReason = notes;
    vendorBill.overrideBy = req.user?._id;
    vendorBill.overrideAt = new Date();
  }

  vendorBill.matchingStatus = matchingStatus;
  vendorBill.matchingNotes = matchingNotes;
  vendorBill.shouldBePaid = shouldBePaid;
  vendorBill.matchingDetails = matchingDetails;
  vendorBill.validatedBy = req.user?._id;
  vendorBill.validatedAt = new Date();

  if (vendorBill.status === "draft") {
    vendorBill.status = "confirmed";
  }

  await vendorBill.save();

  res.status(200).json({
    success: true,
    data: vendorBill,
  });
});

module.exports = {
  createVendorBill,
  getVendorBill,
  getVendorBills,
  updateVendorBill,
  deleteVendorBill,
  recordPayment,
  validateBill,
};
