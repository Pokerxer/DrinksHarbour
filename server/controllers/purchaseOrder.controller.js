// controllers/purchaseOrder.controller.js
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const PurchaseOrder = require("../models/PurchaseOrder");
const Tenant = require("../models/Tenant");
const SubProduct = require("../models/SubProduct");
const Size = require("../models/Size");
const Warehouse = require("../models/Warehouse");
const inventoryService = require("../services/inventory.service");
const VendorBill = require("../models/VendorBill");
const { syncVendorPricelistFromPO } = require("../services/vendorPricelistSync.service");
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

/**
 * Helper to enrich PO items with subProduct and Size data
 */
const enrichPOItems = async (items, tenantId) => {
  if (!items || !Array.isArray(items)) return items;

  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      const enriched = { ...item };

      if (item.subProductId) {
        const subProduct = await SubProduct.findOne({
          _id: item.subProductId,
          tenant: tenantId,
        }).populate('product', 'name').lean();

        if (subProduct) {
          if (!enriched.subProductName) {
            enriched.subProductName = subProduct.product?.name || subProduct.sku;
          }
          if (!enriched.sku) {
            enriched.sku = subProduct.sku;
          }

          if (item.sizeId) {
            const size = await Size.findOne({
              _id: item.sizeId,
              subproduct: subProduct._id,
            }).lean();

            if (size) {
              if (!enriched.sizeName) {
                enriched.sizeName = size.size;
              }
            }
          } else if (item.sizeName) {
            const defaultSize = await Size.findOne({
              subproduct: subProduct._id,
              size: item.sizeName,
            }).lean();

            if (defaultSize) {
              enriched.sizeId = defaultSize._id;
            }
          }
        }
      }

      return enriched;
    })
  );

  return enrichedItems;
};

/**
 * Validate that subProductIds exist in tenant's catalog
 */
const validateSubProducts = async (items, tenantId) => {
  if (!items || !Array.isArray(items)) return;

  const subProductIds = items
    .filter((item) => item.subProductId)
    .map((item) => new mongoose.Types.ObjectId(item.subProductId));

  if (subProductIds.length === 0) {
    throw new ValidationError("At least one item must have a valid subProductId");
  }

  const existingSubProducts = await SubProduct.find({
    _id: { $in: subProductIds },
    tenant: tenantId,
  }).select("_id");

  const foundIds = new Set(existingSubProducts.map((sp) => sp._id.toString()));

  for (const item of items) {
    if (item.subProductId && !foundIds.has(item.subProductId.toString())) {
      throw new ValidationError(
        `SubProduct with ID ${item.subProductId} not found in your catalog`
      );
    }
  }
};

/**
 * Tenant-level purchase settings with schema defaults applied
 */
const PURCHASE_SETTINGS_DEFAULTS = {
  requirePOApproval: true,
  approvalThreshold: 0,
  lockConfirmedOrders: false,
  defaultBillControlPolicy: "received",
  enable3WayMatching: true,
  autoGenerateBill: false,
  allowPartialReceipts: true,
  rfqValidityDays: 30,
  defaultCurrency: "NGN",
  defaultLeadTimeDays: 7,
  defaultPaymentTerms: "Net 30",
  defaultReceivingLocation: "",
};

const getTenantPurchaseSettings = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId)
    .select("purchaseSettings")
    .lean();
  return { ...PURCHASE_SETTINGS_DEFAULTS, ...(tenant?.purchaseSettings || {}) };
};

/**
 * Total order value of a PO document (unitCost * quantity over its items).
 * Pure — safe to unit-test without a DB.
 */
const poTotal = (po) =>
  (po?.items || []).reduce(
    (s, i) => s + (Number(i.unitCost) || 0) * (Number(i.quantity) || 0),
    0
  );

/**
 * Whether a PO with the given total needs approval under tenant settings.
 * Approval is required only when enabled AND (threshold is 0 → all POs, or the
 * total meets/exceeds the threshold). Pure.
 */
const requiresApproval = (total, settings = {}) => {
  if (!settings.requirePOApproval) return false;
  const threshold = Number(settings.approvalThreshold) || 0;
  return threshold <= 0 || total >= threshold;
};

/**
 * Get default warehouse for tenant
 */
const getDefaultWarehouse = async (tenantId) => {
  const warehouse = await Warehouse.findOne({
    tenant: tenantId,
    isDefault: true,
  }).lean();
  
  if (!warehouse) {
    return null;
  }
  
  return warehouse._id;
};

// @desc    Create new purchase order or RFQ
// @route   POST /api/purchase-orders
// @access  Private (Tenant admin)
const createPurchaseOrder = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const userId = req.user?._id;

  if (!userId) {
    throw new ForbiddenError("User context required");
  }

  const {
    poNumber: poNumberRaw,
    vendor,
    vendorName,
    vendorReference,
    currency,
    confirmationDate,
    expectedArrival,
    arrivalDate,
    items,
    notes,
    project,
    // RFQ fields
    type,
    rfqStatus,
    validUntil,
    termsConditions,
    approvalStatus,
    originalPO,
    isBackorder,
  } = req.body;

  // Validate required fields
  if (!vendorName || !items || !Array.isArray(items)) {
    throw new ValidationError("Required fields missing");
  }

  // Auto-generate poNumber if not provided. Derive from the highest existing
  // number rather than a document count — counts shrink after deletes and
  // would re-issue a number that still exists (unique-index crash).
  let poNumber = poNumberRaw;
  if (!poNumber) {
    const last = await PurchaseOrder.findOne({
      tenant: tenantId,
      poNumber: { $regex: /^RFQ-\d+$/ },
    })
      .sort({ poNumber: -1 })
      .select("poNumber")
      .lean();
    const lastSeq = last ? parseInt(last.poNumber.split("-")[1], 10) : 0;
    poNumber = `RFQ-${String(lastSeq + 1).padStart(6, "0")}`;
  }

  // Validate items have subProductId and normalise frontend field names → schema names
  for (const item of items) {
    if (!item.subProductId) {
      throw new ValidationError(
        "Each item must have subProductId",
      );
    }
    if (!item.subProductName && item.productName) item.subProductName = item.productName;
    if (item.unitCost === undefined || item.unitCost === null) item.unitCost = item.unitPrice ?? 0;
    if (item.packagingQty === undefined || item.packagingQty === null) item.packagingQty = item.packSize ?? 1;
  }

  // Validate subProducts exist in tenant's catalog
  await validateSubProducts(items, tenantId);

  // Enrich items with subProduct and Size data (auto-lookup)
  const enrichedItems = await enrichPOItems(items, tenantId);

  const purchSettings = await getTenantPurchaseSettings(tenantId);

  const status = ["draft", "confirmed"].includes(req.body.status)
    ? req.body.status
    : "draft";
  // Creating directly as confirmed is an implicit approval by the (admin)
  // creator — otherwise the status route would reject every later transition
  // because all POs start with approvalStatus 'pending'. Tenants can also
  // turn the approval step off entirely in purchase settings.
  const orderTotal = poTotal({ items: enrichedItems });
  const needsApproval = requiresApproval(orderTotal, purchSettings);
  const isConfirmedOnCreate =
    (status === "confirmed" || !needsApproval) && type !== "rfq";

  // Default quotation expiry from tenant settings
  let resolvedValidUntil = validUntil;
  if (!resolvedValidUntil && purchSettings.rfqValidityDays > 0) {
    const d = new Date();
    d.setDate(d.getDate() + purchSettings.rfqValidityDays);
    resolvedValidUntil = d;
  }

  const purchaseOrder = await PurchaseOrder.create({
    tenant: tenantId,
    poNumber,
    vendor,
    vendorName,
    vendorReference,
    currency: currency || purchSettings.defaultCurrency || "NGN",
    billControlPolicy:
      req.body.billControlPolicy || purchSettings.defaultBillControlPolicy || "received",
    orderDate: new Date(),
    confirmationDate: confirmationDate || new Date(),
    expectedArrival,
    arrivalDate,
    items: enrichedItems,
    notes,
    project,
    createdBy: userId,
    status,
    // RFQ specific
    type: type || "po",
    rfqStatus: rfqStatus || (type === "rfq" ? "draft" : undefined),
    validUntil: resolvedValidUntil,
    termsConditions,
    // For POs, set approval to pending (all POs require approval)
    approvalStatus:
      type === "rfq"
        ? undefined
        : isConfirmedOnCreate
          ? "approved"
          : approvalStatus || "pending",
    ...(isConfirmedOnCreate && {
      approvedBy: userId,
      approvedByName: req.user?.name || "System",
      approvedAt: new Date(),
    }),
    originalPO,
    isBackorder: isBackorder || false,
  });

  res.status(201).json({
    success: true,
    data: purchaseOrder,
  });
});

// @desc    Get purchase order by ID
// @route   GET /api/purchase-orders/:id
// @access  Private (Tenant admin)
const getPurchaseOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = await resolveTenantId(req);

  const purchaseOrder = await PurchaseOrder.findOne({
    _id: id,
    tenant: tenantId,
  })
    .populate("vendor", "name email phone address bankDetails")
    .populate("createdBy", "name email")
    .populate("items.subProductId", "name sku imageUrl")
    .populate("items.sizeId", "size ml volume")
    .populate("purchaseAgreement", "agreementNumber name status");

  if (!purchaseOrder) {
    throw new NotFoundError("Purchase Order not found");
  }

  res.status(200).json({
    success: true,
    data: purchaseOrder,
  });
});

// @desc    Get all purchase orders
// @route   GET /api/purchase-orders
// @access  Private (Tenant admin)
const getPurchaseOrders = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);

  // Query parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const status = req.query.status;
  const vendor = req.query.vendor;

  const subProductId = req.query.subProductId;

  // Build filter
  const filter = { tenant: tenantId };
  if (status) filter.status = status;
  if (vendor) filter.vendor = vendor;
  if (subProductId) filter['items.subProductId'] = subProductId;

  const purchaseOrders = await PurchaseOrder.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("vendor", "name email")
    .populate("createdBy", "name")
    .populate("items.subProductId", "name sku")
    .populate("items.sizeId", "size volume");

  const totalCount = await PurchaseOrder.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: purchaseOrders,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    },
  });
});

// @desc    Update purchase order fields (draft/confirmed only)
// @route   PATCH /api/purchase-orders/:id
// @access  Private (Tenant admin)
const updatePurchaseOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = await resolveTenantId(req);

  const po = await PurchaseOrder.findOne({ _id: id, tenant: tenantId });
  if (!po) throw new NotFoundError("Purchase Order not found");

  if (po.isLocked) throw new ForbiddenError("Purchase Order is locked and cannot be edited");
  if (po.status === "done" || po.status === "cancelled") {
    throw new ForbiddenError("Cannot edit a locked or cancelled Purchase Order");
  }

  const {
    vendor,
    vendorName,
    vendorReference,
    currency,
    expectedArrival,
    items,
    notes,
    termsConditions,
    validUntil,
    purchaseAgreement,
  } = req.body;

  if (vendor !== undefined) po.vendor = vendor;
  if (vendorName !== undefined) po.vendorName = vendorName;
  if (vendorReference !== undefined) po.vendorReference = vendorReference;
  if (currency !== undefined) po.currency = currency;
  if (expectedArrival !== undefined) po.expectedArrival = expectedArrival;
  if (notes !== undefined) po.notes = notes;
  if (termsConditions !== undefined) po.termsConditions = termsConditions;
  if (validUntil !== undefined) po.validUntil = validUntil;
  if (purchaseAgreement !== undefined) po.purchaseAgreement = purchaseAgreement;

  if (items !== undefined && Array.isArray(items)) {
    await validateSubProducts(items, tenantId);
    po.items = await enrichPOItems(items, tenantId);
  }

  await po.save();

  res.status(200).json({ success: true, data: po });
});

// @desc    Update purchase order status
// @route   PATCH /api/purchase-orders/:id/status
// @access  Private (Tenant admin)
const updatePurchaseOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const rawStatus = req.body.status;
  // Accept legacy frontend aliases
  const status = rawStatus === "cancel" ? "cancelled" : rawStatus === "done" ? "validated" : rawStatus;
  const { receivedItems } = req.body;
  const tenantId = await resolveTenantId(req);

  const purchaseOrder = await PurchaseOrder.findOne({
    _id: id,
    tenant: tenantId,
  });

  if (!purchaseOrder) {
    throw new NotFoundError("Purchase Order not found");
  }

  // Check if PO requires approval before confirming (tenant-configurable)
  if (status === "confirmed" && purchaseOrder.type === "po") {
    const purchSettings = await getTenantPurchaseSettings(tenantId);
    const needsApproval = requiresApproval(poTotal(purchaseOrder), purchSettings);
    if (needsApproval && purchaseOrder.approvalStatus !== "approved") {
      throw new ValidationError("PO must be approved before confirmation");
    }
    if (!needsApproval) {
      purchaseOrder.approvalStatus = "approved";
    }
    if (purchSettings.lockConfirmedOrders) {
      purchaseOrder.isLocked = true;
      purchaseOrder.lockedAt = new Date();
      purchaseOrder.lockReason = "Auto-locked on confirmation";
    }
  }

  // Validate status transition
  const validTransitions = {
    draft: ["confirmed", "received", "cancelled"],
    confirmed: ["received", "cancelled"],
    received: ["validated", "cancelled"],
    validated: ["cancelled"],
    cancelled: [],
  };

  if (!validTransitions[purchaseOrder.status].includes(status)) {
    throw new ValidationError(
      `Cannot transition from ${purchaseOrder.status} to ${status}`,
    );
  }

  // Update status
  const previousStatus = purchaseOrder.status;
  purchaseOrder.status = status;

  // If receiving items, update received quantities
  if (status === "received" && receivedItems && Array.isArray(receivedItems)) {
    const receiveSettings = await getTenantPurchaseSettings(tenantId);
    for (const receivedItem of receivedItems) {
      const item = purchaseOrder.items.find(
        (i) => i._id.toString() === receivedItem.itemId,
      );
      if (item) {
        const qty = Math.max(0, receivedItem.receivedQty ?? 0);
        if (!receiveSettings.allowPartialReceipts && qty > 0 && qty < item.quantity) {
          throw new ValidationError(
            `Partial receipts are disabled — ${item.subProductName} must be received in full (${item.quantity}).`
          );
        }
        item.receivedQty = qty;
      }
    }
  }

  // Track fully received date and create inventory movements
  if (status === "validated") {
    // Check if PO status was 'received' before this update
    if (previousStatus !== 'received') {
      console.log(`⚠️ PO ${purchaseOrder.poNumber} validation: Previous status was '${previousStatus}', expected 'received'. Proceeding anyway...`);
    }

    purchaseOrder.fullyReceivedDate = new Date();

    // Get default warehouse for tenant (optional - can be null)
    let defaultWarehouseId;
    try {
      defaultWarehouseId = await getDefaultWarehouse(tenantId);
    } catch (e) {
      console.log('No default warehouse found, skipping warehouse update');
      defaultWarehouseId = null;
    }

    console.log(`🔍 PO Validation Start: ${purchaseOrder.poNumber} - ${purchaseOrder.items?.length || 0} items`);
    console.log(`📋 Items details:`, purchaseOrder.items.map(item => ({
      name: item.subProductName,
      subProductId: item.subProductId,
      sizeId: item.sizeId,
      sizeName: item.sizeName,
      orderedQty: item.quantity,
      receivedQty: item.receivedQty,
      unitCost: item.unitCost
    })));

    // Create inventory movements for each item (Odoo-style)
    let successCount = 0;
    let failCount = 0;
    
    for (const item of purchaseOrder.items) {
      // Fix: Use quantity as fallback if receivedQty is 0, undefined, or null
      const quantityToAdd = (item.receivedQty !== undefined && item.receivedQty !== null && item.receivedQty > 0) 
        ? item.receivedQty 
        : item.quantity;
      
      console.log(`📦 Processing item: ${item.subProductName}`);
      console.log(`   - subProductId: ${item.subProductId}`);
      console.log(`   - sizeId: ${item.sizeId || '(none)'}`);
      console.log(`   - orderedQty: ${item.quantity}, receivedQty: ${item.receivedQty}, using: ${quantityToAdd}`);
      
      if (quantityToAdd <= 0) {
        console.log(`   ⚠️ Skipping - quantity is 0`);
        continue;
      }
      
      if (!item.subProductId) {
        console.log(`   ❌ Skipping - no subProductId`);
        failCount++;
        continue;
      }
      
      try {
        await inventoryService.recordReceived(
          item.subProductId,
          tenantId,
          {
            quantity: quantityToAdd,
            unitCost: item.unitCost ?? 0,
            reference: purchaseOrder.poNumber,
            referenceType: 'purchase_order',
            supplierId: purchaseOrder.vendor,
            supplierName: purchaseOrder.vendorName,
            sizeId: item.sizeId,
            sizeName: item.sizeName,
            reason: `PO Receipt: ${purchaseOrder.poNumber}`,
          },
          req.user?._id || purchaseOrder.createdBy
        );

        console.log(`   ✅ Inventory added successfully`);
        successCount++;
      } catch (inventoryError) {
        console.error(`   ❌ Failed to add inventory:`, inventoryError.message);
        failCount++;
      }
    }
    
    console.log(`🏁 PO Validation Complete: ${successCount} succeeded, ${failCount} failed`);

    // Auto-sync the vendor's pricelist from this (latest) validated purchase.
    // Non-blocking: a pricelist failure must never block PO validation.
    try {
      const syncSettings = await getTenantPurchaseSettings(tenantId);
      const syncResult = await syncVendorPricelistFromPO(
        purchaseOrder,
        tenantId,
        req.user?._id || purchaseOrder.createdBy,
        { defaultLeadTimeDays: syncSettings.defaultLeadTimeDays }
      );
      if (syncResult) {
        console.log(
          `🏷️  Vendor pricelist sync: ${syncResult.created ? 'created' : 'updated'} ` +
            `(${syncResult.updated} updated, ${syncResult.added} added)`
        );
      }
    } catch (pricelistError) {
      console.error(
        `⚠️ Vendor pricelist sync failed for ${purchaseOrder.poNumber}:`,
        pricelistError.message
      );
    }

    // Auto-generate a draft vendor bill if the tenant opted in. Non-blocking.
    try {
      const purchSettings = await getTenantPurchaseSettings(tenantId);
      if (purchSettings.autoGenerateBill) {
        const billPo = await PurchaseOrder.findById(purchaseOrder._id).populate('vendor');
        const billResult = await buildBillFromPO(billPo, tenantId, req.user?._id || purchaseOrder.createdBy);
        if (billResult.bill) {
          console.log(`🧾 Auto-generated vendor bill ${billResult.bill.billNumber} for ${purchaseOrder.poNumber}`);
        } else {
          console.log(`🧾 Auto-bill skipped for ${purchaseOrder.poNumber}: ${billResult.reason}`);
        }
      }
    } catch (billError) {
      console.error(`⚠️ Auto-bill failed for ${purchaseOrder.poNumber}:`, billError.message);
    }
  }

  await purchaseOrder.save();

  res.status(200).json({
    success: true,
    data: purchaseOrder,
  });
});

// @desc    Delete purchase order
// @route   DELETE /api/purchase-orders/:id
// @access  Private (Tenant admin)
const deletePurchaseOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = await resolveTenantId(req);

  const purchaseOrder = await PurchaseOrder.findOne({
    _id: id,
    tenant: tenantId,
  });

  if (!purchaseOrder) {
    throw new NotFoundError("Purchase Order not found");
  }

  // Don't allow deletion of confirmed/received/validated POs
  if (["confirmed", "received", "validated"].includes(purchaseOrder.status)) {
    throw new ValidationError("Cannot delete confirmed purchase order");
  }

  await PurchaseOrder.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: "Purchase Order deleted successfully",
  });
});

// @desc    Generate purchase order receipt
// @route   GET /api/purchase-orders/:id/receipt
// @access  Private (Tenant admin)
const generatePurchaseOrderReceipt = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = await resolveTenantId(req);

  // Fetch the tenant directly
  const Tenant = require('../models/Tenant');
  const Vendor = require('../models/Vendor');
  
  let tenantData = await Tenant.findById(tenantId).lean();
  console.log('tenantData from tenantId:', tenantData?.name);

  const purchaseOrder = await PurchaseOrder.findOne({
    _id: id,
    tenant: tenantId,
  })
    .populate("createdBy", "name email")
    .populate("vendor", "name email phone address bankDetails");

  if (!purchaseOrder) {
    throw new NotFoundError("Purchase Order not found");
  }

  // If vendor is null but we have vendorName, try to find vendor
  let vendorData = purchaseOrder.vendor;
  if (!vendorData && purchaseOrder.vendorName) {
    vendorData = await Vendor.findOne({ name: purchaseOrder.vendorName, tenant: tenantId }).lean();
  }

  // Set defaults for dates
  // Order date should be when the order was created (createdAt)
  const orderDate = purchaseOrder.orderDate || purchaseOrder.createdAt;

  // If expected date is not filled and order is validated, use confirmation date
  let expectedArrival = purchaseOrder.expectedArrival;
  if (!expectedArrival && purchaseOrder.status === "validated") {
    expectedArrival = purchaseOrder.confirmationDate || orderDate;
  }
  expectedArrival = expectedArrival || orderDate;

  // Calculate receipt totals
  const totals = {
    totalOrdered: purchaseOrder.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    ),
    totalReceived: purchaseOrder.items.reduce(
      (sum, item) => sum + item.receivedQty,
      0,
    ),
    totalCost: purchaseOrder.items.reduce(
      (sum, item) => sum + item.totalCost,
      0,
    ),
    taxTotal: purchaseOrder.items.reduce(
      (sum, item) => sum + (item.totalCost * (item.taxRate || 0)) / 100,
      0,
    ),
  };

  const receiptData = {
    purchaseOrder: {
      poNumber: purchaseOrder.poNumber,
      status: purchaseOrder.status,
      orderDate: orderDate,
      expectedArrival: expectedArrival,
      confirmationDate: purchaseOrder.confirmationDate,
      paymentTerms: purchaseOrder.paymentTerms,
      currency: purchaseOrder.currency,
      notes: purchaseOrder.notes,
    },
    tenant: tenantData,
    vendor: vendorData || { name: purchaseOrder.vendorName },
    createdBy: purchaseOrder.createdBy,
    items: purchaseOrder.items.map((item) => ({
      subProductName: item.subProductName,
      sku: item.sku,
      sizeName: item.sizeName,
      quantity: item.quantity,
      receivedQty: item.receivedQty,
      unitCost: item.unitCost,
      discount: item.discount || 0,
      totalCost: item.totalCost,
      taxRate: item.taxRate,
    })),
    totals,
    generatedAt: new Date(),
  };

  console.log('Receipt tenantData:', tenantData?.name, tenantData?.address);
  
  // For now, return JSON receipt data
  // In production, this would generate PDF/HTML receipt
  res.status(200).json({
    success: true,
    data: receiptData,
  });
});

// @desc    Get purchase analytics summary
// @route   GET /api/purchase-orders/analytics/summary
// @access  Private (Tenant admin)
const getPurchaseAnalyticsSummary = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const { startDate, endDate, period = "month" } = req.query;

  // Build date filter
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  const query = { tenant: tenantId, type: "po" };
  if (Object.keys(dateFilter).length > 0) {
    query.confirmationDate = dateFilter;
  }

  // Get all POs for the period
  const purchaseOrders = await PurchaseOrder.find(query);

  // Calculate totals
  const totalPOs = purchaseOrders.length;
  const totalAmount = purchaseOrders.reduce((sum, po) => {
    const poTotal = po.items?.reduce((s, item) => s + ((item.packPrice || 0) * (item.packQty || 1)), 0) || 0;
    return sum + poTotal;
  }, 0);

  // Status breakdown
  const statusBreakdown = {
    draft: purchaseOrders.filter(po => po.status === "draft").length,
    confirmed: purchaseOrders.filter(po => po.status === "confirmed").length,
    received: purchaseOrders.filter(po => po.status === "received").length,
    validated: purchaseOrders.filter(po => po.status === "validated").length,
    cancelled: purchaseOrders.filter(po => po.status === "cancelled").length,
  };

  // Approval status breakdown
  const approvalBreakdown = {
    pending: purchaseOrders.filter(po => po.approvalStatus === "pending").length,
    approved: purchaseOrders.filter(po => po.approvalStatus === "approved").length,
    rejected: purchaseOrders.filter(po => po.approvalStatus === "rejected").length,
  };

  // Vendor breakdown
  const vendorMap = {};
  purchaseOrders.forEach(po => {
    const vendorName = po.vendorName || "Unknown";
    if (!vendorMap[vendorName]) {
      vendorMap[vendorName] = { count: 0, amount: 0 };
    }
    vendorMap[vendorName].count += 1;
    const poTotal = po.items?.reduce((s, item) => s + ((item.packPrice || 0) * (item.packQty || 1)), 0) || 0;
    vendorMap[vendorName].amount += poTotal;
  });

  const topVendors = Object.entries(vendorMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // Monthly trend
  const monthlyData = {};
  purchaseOrders.forEach(po => {
    if (po.confirmationDate) {
      const date = new Date(po.confirmationDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyData[key]) {
        monthlyData[key] = { count: 0, amount: 0 };
      }
      monthlyData[key].count += 1;
      const poTotal = po.items?.reduce((s, item) => s + ((item.packPrice || 0) * (item.packQty || 1)), 0) || 0;
      monthlyData[key].amount += poTotal;
    }
  });

  const monthlyTrend = Object.entries(monthlyData)
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);

  // Size breakdown
  const sizeBreakdown = {};
  purchaseOrders.forEach(po => {
    po.items?.forEach(item => {
      const sizeName = item.sizeName || 'Default';
      if (!sizeBreakdown[sizeName]) {
        sizeBreakdown[sizeName] = {
          sizeName,
          totalQuantity: 0,
          totalAmount: 0,
          orderCount: 0,
        };
      }
      const qty = item.quantity || 0;
      const price = (item.packPrice || 0) * (item.packQty || 1);
      sizeBreakdown[sizeName].totalQuantity += qty;
      sizeBreakdown[sizeName].totalAmount += price;
      sizeBreakdown[sizeName].orderCount += 1;
    });
  });

  const sizeBreakdownList = Object.values(sizeBreakdown)
    .sort((a, b) => b.totalAmount - a.totalAmount);

  // Product breakdown
  const productBreakdown = {};
  purchaseOrders.forEach(po => {
    po.items?.forEach(item => {
      const prodKey = item.subProductName || 'Unknown';
      const sizeName = item.sizeName || 'Default';
      const key = `${prodKey}::${sizeName}`;
      
      if (!productBreakdown[key]) {
        productBreakdown[key] = {
          productName: item.subProductName,
          sizeName: item.sizeName,
          totalQuantity: 0,
          totalAmount: 0,
          orderCount: 0,
        };
      }
      const qty = item.quantity || 0;
      const price = (item.packPrice || 0) * (item.packQty || 1);
      productBreakdown[key].totalQuantity += qty;
      productBreakdown[key].totalAmount += price;
      productBreakdown[key].orderCount += 1;
    });
  });

  const topProducts = Object.values(productBreakdown)
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 20);

  // Pending approvals count
  const pendingApprovals = purchaseOrders.filter(
    po => po.approvalStatus === "pending" && po.status === "draft"
  ).length;

  res.status(200).json({
    success: true,
    data: {
      totalPOs,
      totalAmount,
      statusBreakdown,
      approvalBreakdown,
      topVendors,
      monthlyTrend,
      pendingApprovals,
      sizeBreakdown: sizeBreakdownList,
      topProducts,
    },
  });
});

// @desc    Get purchase analytics by vendor
// @route   GET /api/purchase-orders/analytics/by-vendor
// @access  Private (Tenant admin)
const getPurchaseAnalyticsByVendor = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const { startDate, endDate } = req.query;

  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  const query = { tenant: tenantId, type: "po" };
  if (Object.keys(dateFilter).length > 0) {
    query.confirmationDate = dateFilter;
  }

  const purchaseOrders = await PurchaseOrder.find(query);

  const vendorData = {};
  purchaseOrders.forEach(po => {
    const vendorName = po.vendorName || "Unknown";
    if (!vendorData[vendorName]) {
      vendorData[vendorName] = {
        vendorName,
        totalOrders: 0,
        totalAmount: 0,
        totalQuantity: 0,
        validated: 0,
        pending: 0,
        sizeBreakdown: {},
        productBreakdown: {},
      };
    }
    vendorData[vendorName].totalOrders += 1;
    const poTotal = po.items?.reduce((s, item) => s + ((item.packPrice || 0) * (item.packQty || 1)), 0) || 0;
    vendorData[vendorName].totalAmount += poTotal;
    
    po.items?.forEach(item => {
      const qty = item.quantity || 0;
      const price = (item.packPrice || 0) * (item.packQty || 1);
      vendorData[vendorName].totalQuantity += qty;
      
      // Size breakdown per vendor
      const sizeName = item.sizeName || 'Default';
      if (!vendorData[vendorName].sizeBreakdown[sizeName]) {
        vendorData[vendorName].sizeBreakdown[sizeName] = {
          sizeName,
          quantity: 0,
          amount: 0,
        };
      }
      vendorData[vendorName].sizeBreakdown[sizeName].quantity += qty;
      vendorData[vendorName].sizeBreakdown[sizeName].amount += price;
      
      // Product breakdown per vendor
      const prodKey = item.subProductName || 'Unknown';
      if (!vendorData[vendorName].productBreakdown[prodKey]) {
        vendorData[vendorName].productBreakdown[prodKey] = {
          productName: item.subProductName,
          quantity: 0,
          amount: 0,
        };
      }
      vendorData[vendorName].productBreakdown[prodKey].quantity += qty;
      vendorData[vendorName].productBreakdown[prodKey].amount += price;
    });
    
    if (po.status === "validated") vendorData[vendorName].validated += 1;
    if (po.approvalStatus === "pending") vendorData[vendorName].pending += 1;
  });

  // Format result with size breakdown
  const result = Object.values(vendorData).map(vendor => ({
    ...vendor,
    sizeBreakdown: Object.values(vendor.sizeBreakdown).sort((a, b) => b.amount - a.amount),
    productBreakdown: Object.values(vendor.productBreakdown).sort((a, b) => b.amount - a.amount).slice(0, 10),
  })).sort((a, b) => b.totalAmount - a.totalAmount);

  res.status(200).json({
    success: true,
    data: result,
  });
});

// @desc    Lock a purchase order
// @route   POST /api/purchase-orders/:id/lock
// @access  Private (Tenant admin)
const lockPO = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const tenantId = await resolveTenantId(req);
  const userId = req.user?._id;
  const userName = req.user?.name || 'Unknown';

  const po = await PurchaseOrder.findOne({
    _id: id,
    tenant: tenantId,
  });

  if (!po) {
    throw new NotFoundError("Purchase Order not found");
  }

  if (po.isLocked) {
    throw new ValidationError("PO is already locked");
  }

  po.isLocked = true;
  po.lockedAt = new Date();
  po.lockedBy = userId;
  po.lockedByName = userName;
  po.lockReason = reason;
  await po.save();

  res.status(200).json({
    success: true,
    data: po,
  });
});

// @desc    Unlock a purchase order
// @route   POST /api/purchase-orders/:id/unlock
// @access  Private (Tenant admin)
const unlockPO = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = await resolveTenantId(req);
  const userId = req.user?._id;

  const po = await PurchaseOrder.findOne({
    _id: id,
    tenant: tenantId,
  });

  if (!po) {
    throw new NotFoundError("Purchase Order not found");
  }

  if (!po.isLocked) {
    throw new ValidationError("PO is not locked");
  }

  po.isLocked = false;
  po.lockedAt = null;
  po.lockedBy = null;
  po.lockedByName = null;
  po.lockReason = null;
  await po.save();

  res.status(200).json({
    success: true,
    data: po,
  });
});

// @desc    Create new RFQ
// @route   POST /api/purchase-orders/rfq
// @access  Private (Tenant admin)
const createRFQ = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const userId = req.user?._id;

  if (!userId) {
    throw new ForbiddenError("User context required");
  }

  const {
    poNumber,
    vendorName,
    vendorReference,
    currency,
    expectedArrival,
    items,
    notes,
    validUntil,
    termsConditions,
  } = req.body;

  if (!poNumber || !items || !Array.isArray(items)) {
    throw new ValidationError("Required fields missing");
  }

  const rfq = await PurchaseOrder.create({
    tenant: tenantId,
    poNumber,
    vendorName,
    vendorReference,
    currency: currency || "NGN",
    orderDate: new Date(),
    confirmationDate: new Date(),
    expectedArrival,
    items,
    notes,
    createdBy: userId,
    type: "rfq",
    rfqStatus: "draft",
    validUntil,
    termsConditions,
  });

  res.status(201).json({
    success: true,
    data: rfq,
  });
});

// @desc    Update RFQ status
// @route   PATCH /api/purchase-orders/:id/rfq-status
// @access  Private (Tenant admin)
const updateRFQStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rfqStatus } = req.body;
  const tenantId = await resolveTenantId(req);

  const rfq = await PurchaseOrder.findOne({
    _id: id,
    tenant: tenantId,
    type: "rfq",
  });

  if (!rfq) {
    throw new NotFoundError("RFQ not found");
  }

  // Validate RFQ status transition
  const validTransitions = {
    draft: ["sent", "cancelled"],
    sent: ["quoted", "cancelled", "expired"],
    quoted: ["approved", "rejected", "cancelled"],
    approved: ["converted", "cancelled"],
    rejected: ["cancelled"],
    converted: [],
    expired: ["cancelled"],
    cancelled: [],
  };

  if (!validTransitions[rfq.rfqStatus]?.includes(rfqStatus)) {
    throw new ValidationError(
      `Cannot transition from ${rfq.rfqStatus} to ${rfqStatus}`,
    );
  }

  rfq.rfqStatus = rfqStatus;
  await rfq.save();

  res.status(200).json({
    success: true,
    data: rfq,
  });
});

// @desc    Add vendor response to RFQ
// @route   POST /api/purchase-orders/:id/vendor-response
// @access  Private (Tenant admin)
const addVendorResponse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { vendorId, vendorName, items, notes, totalAmount } = req.body;
  const tenantId = await resolveTenantId(req);

  const rfq = await PurchaseOrder.findOne({
    _id: id,
    tenant: tenantId,
    type: "rfq",
  });

  if (!rfq) {
    throw new NotFoundError("RFQ not found");
  }

  if (rfq.rfqStatus !== "sent" && rfq.rfqStatus !== "quoted") {
    throw new ValidationError("RFQ must be sent to receive vendor responses");
  }

  const vendorResponse = {
    vendorId,
    vendorName,
    quoteDate: new Date(),
    totalAmount,
    currency: rfq.currency,
    items: items || [],
    notes,
    status: "pending",
    respondedAt: new Date(),
  };

  rfq.vendorResponses.push(vendorResponse);
  
  // Auto-update RFQ status if first response
  if (rfq.rfqStatus === "sent") {
    rfq.rfqStatus = "quoted";
  }
  
  await rfq.save();

  res.status(200).json({
    success: true,
    data: rfq,
  });
});

// @desc    Convert RFQ to PO (select winning vendor)
// @route   POST /api/purchase-orders/:id/convert-to-po
// @access  Private (Tenant admin)
const convertRFQToPO = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { vendorIndex, vendorName } = req.body;
  const tenantId = await resolveTenantId(req);

  const rfq = await PurchaseOrder.findOne({
    _id: id,
    tenant: tenantId,
    type: "rfq",
  });

  if (!rfq) {
    throw new NotFoundError("RFQ not found");
  }

  if (rfq.rfqStatus !== "approved") {
    throw new ValidationError("RFQ must be approved before conversion");
  }

  if (!rfq.vendorResponses || rfq.vendorResponses.length === 0) {
    throw new ValidationError("No vendor responses to convert");
  }

  const selectedVendor = rfq.vendorResponses[vendorIndex];
  if (!selectedVendor) {
    throw new ValidationError("Invalid vendor selection");
  }

  // Generate new PO number
  const poCount = await PurchaseOrder.countDocuments({ tenant: tenantId, type: "po" });
  const poNumber = `PO-${String(poCount + 1).padStart(6, "0")}`;

  // Create PO from RFQ with selected vendor's prices
  const poItems = rfq.items.map((item, idx) => {
    const vendorItem = selectedVendor.items?.find(
      (vi) => vi.subProductId?.toString() === item.subProductId?.toString()
    );
    return {
      ...item,
      unitCost: vendorItem?.unitPrice || item.unitCost || 0,
      totalCost: (vendorItem?.unitPrice || item.unitCost || 0) * item.quantity,
    };
  });

  const po = await PurchaseOrder.create({
    tenant: tenantId,
    poNumber,
    vendorName: selectedVendor.vendorName,
    vendor: selectedVendor.vendorId,
    currency: rfq.currency,
    orderDate: new Date(),
    confirmationDate: new Date(),
    expectedArrival: rfq.expectedArrival,
    items: poItems,
    notes: rfq.notes,
    createdBy: rfq.createdBy,
    type: "po",
    status: "draft",
    originalRFQ: rfq._id,
  });

  // Update RFQ status
  rfq.rfqStatus = "converted";
  rfq.selectedVendorIndex = vendorIndex;
  await rfq.save();

  res.status(201).json({
    success: true,
    data: po,
  });
});

// @desc    Approve PO (for approval workflow)
// @route   POST /api/purchase-orders/:id/approve
// @access  Private (Tenant admin)
const approvePO = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  const tenantId = await resolveTenantId(req);
  const userId = req.user?._id;
  const userName = req.user?.name || "Unknown";

  const po = await PurchaseOrder.findOne({
    _id: id,
    tenant: tenantId,
    type: "po",
  });

  if (!po) {
    throw new NotFoundError("Purchase Order not found");
  }

  if (po.approvalStatus && po.approvalStatus !== "pending") {
    throw new ValidationError("PO has already been processed");
  }

  po.approvalStatus = "approved";
  po.approvedBy = userId;
  po.approvedByName = userName;
  po.approvedAt = new Date();
  po.approvalNotes = notes;
  
  // Also confirm the PO (Odoo-style: draft -> confirmed on approval)
  if (po.status === "draft") {
    po.status = "confirmed";
  }
  
  await po.save();

  res.status(200).json({
    success: true,
    data: po,
    message: po.status === "confirmed" ? "PO approved and confirmed" : "PO approved",
  });
});

// @desc    Reject PO (for approval workflow)
// @route   POST /api/purchase-orders/:id/reject
// @access  Private (Tenant admin)
const rejectPO = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  const tenantId = await resolveTenantId(req);
  const userId = req.user?._id;

  const po = await PurchaseOrder.findOne({
    _id: id,
    tenant: tenantId,
    type: "po",
  });

  if (!po) {
    throw new NotFoundError("Purchase Order not found");
  }

  if (po.approvalStatus && po.approvalStatus !== "pending") {
    throw new ValidationError("PO has already been processed");
  }

  po.approvalStatus = "rejected";
  po.approvedBy = userId;
  po.approvedAt = new Date();
  po.approvalNotes = notes;
  
  // Also cancel the PO when rejected (Odoo-style)
  if (po.status === "draft") {
    po.status = "cancelled";
  }
  
  await po.save();

  res.status(200).json({
    success: true,
    data: po,
    message: po.status === "cancelled" ? "PO rejected and cancelled" : "PO rejected",
  });
});

// @desc    Create Vendor Bill from PO
// @route   POST /api/purchase-orders/:id/create-bill
// @access  Private (Tenant admin)
/**
 * Build & save a draft VendorBill from a PO document.
 *
 * Returns `{ bill }` on success, or `{ skipped: true, reason }` when a live
 * bill already exists for this PO or there are no billable items. Throws
 * only for invalid input (no vendor). Shared by the create-bill route and
 * the auto-bill-on-validation hook.
 *
 * @param {object} po - Populated PO document (po.vendor must be populated).
 * @param {string|ObjectId} tenantId
 * @param {string|ObjectId} userId - Used as `createdBy` on the bill.
 * @param {object} [opts]
 * @param {string} [opts.billControlPolicy] - Overrides PO/tenant policy.
 * @param {Date|string} [opts.billDate]
 * @param {Date|string} [opts.dueDate]
 * @param {string} [opts.notes]
 */
async function buildBillFromPO(po, tenantId, userId, opts = {}) {
  if (!po.vendor) {
    throw new ValidationError("PO must have a vendor to create a bill");
  }

  // One bill per PO: a second bill on 'received' policy would double-bill the
  // first receipt. Cancel the existing bill to re-bill.
  const existingBill = await VendorBill.findOne({
    tenant: tenantId,
    purchaseOrder: po._id,
    status: { $ne: 'cancelled' },
  }).select('billNumber');
  if (existingBill) {
    return {
      skipped: true,
      reason: `Bill ${existingBill.billNumber} already exists for this PO. Cancel it before creating a new one.`,
    };
  }

  // Generate bill number from the highest existing sequence this year —
  // document counts shrink after deletes and would re-issue a taken number.
  const year = new Date().getFullYear();
  const lastBill = await VendorBill.findOne({
    tenant: tenantId,
    billNumber: { $regex: new RegExp(`^BIL-${year}-\\d+$`) },
  })
    .sort({ billNumber: -1 })
    .select('billNumber')
    .lean();
  const lastSeq = lastBill ? parseInt(lastBill.billNumber.split('-')[2], 10) : 0;
  const billNumber = `BIL-${year}-${String(lastSeq + 1).padStart(5, '0')}`;

  const tenantPurchSettings = await getTenantPurchaseSettings(tenantId);
  const policy =
    opts.billControlPolicy ||
    po.billControlPolicy ||
    tenantPurchSettings.defaultBillControlPolicy ||
    'received';

  const items = po.items
    .filter(item => {
      const qty = policy === 'received' ? (item.receivedQty || 0) : item.quantity;
      return qty > 0;
    })
    .map(item => {
      const qty = policy === 'received' ? (item.receivedQty || 0) : item.quantity;
      const unitPrice = item.unitCost || 0;
      const taxRate = item.taxRate || 0;
      const amount = qty * unitPrice;
      const taxAmount = amount * (taxRate / 100);
      return {
        subProductId: item.subProductId,
        subProductName: item.subProductName,
        sku: item.sku,
        sizeId: item.sizeId,
        sizeName: item.sizeName,
        quantity: qty,
        unitPrice: unitPrice,
        taxRate: taxRate,
        amount: amount + taxAmount,
      };
    });

  if (items.length === 0) {
    return {
      skipped: true,
      reason:
        policy === 'received'
          ? "No billable items found. Receive products first, or bill on ordered quantities."
          : "No billable items found on this purchase order.",
    };
  }

  // Default the due date from the vendor's payment terms (net_7 → +7 days …)
  const { billDate, dueDate, notes } = opts;
  let resolvedDueDate = dueDate;
  if (!resolvedDueDate && po.vendor.paymentTerms) {
    const netDays = parseInt(
      String(po.vendor.paymentTerms).replace('net_', ''),
      10
    );
    if (!Number.isNaN(netDays)) {
      const base = billDate ? new Date(billDate) : new Date();
      base.setDate(base.getDate() + netDays);
      resolvedDueDate = base;
    }
  }

  let subtotal = 0;
  let taxAmount = 0;
  items.forEach(item => {
    const amount = item.quantity * item.unitPrice;
    subtotal += amount;
    taxAmount += amount * (item.taxRate / 100);
  });
  const totalAmount = subtotal + taxAmount;

  const vendorBill = new VendorBill({
    tenant: tenantId,
    billNumber,
    vendor: po.vendor._id,
    vendorName: po.vendorName,
    purchaseOrder: po._id,
    currency: po.currency || 'NGN',
    items,
    subtotal,
    taxAmount,
    totalAmount,
    billDate: billDate || new Date(),
    dueDate: resolvedDueDate,
    notes,
    billControlPolicy: policy,
    status: 'draft',
    matchingStatus: 'pending',
    payments: [],
    paidAmount: 0,
    createdBy: userId,
  });

  await vendorBill.save();

  return { bill: vendorBill };
}

const createBillFromPO = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { billDate, dueDate, notes, billControlPolicy } = req.body;
  const tenantId = await resolveTenantId(req);

  const po = await PurchaseOrder.findOne({
    _id: id,
    tenant: tenantId,
    type: "po",
  }).populate('vendor');

  if (!po) {
    throw new NotFoundError("Purchase Order not found");
  }

  if (!po.vendor) {
    throw new ValidationError("PO must have a vendor to create a bill");
  }

  if (!["confirmed", "received", "validated"].includes(po.status)) {
    throw new ValidationError(
      `Cannot bill a ${po.status} purchase order — confirm it first`
    );
  }

  const result = await buildBillFromPO(po, tenantId, req.user?._id, {
    billControlPolicy,
    billDate,
    dueDate,
    notes,
  });

  if (result.skipped) {
    throw new ValidationError(result.reason);
  }

  const vendorBill = result.bill;

  res.status(201).json({
    success: true,
    data: vendorBill,
    message: "Vendor bill created successfully",
  });
});

// @desc    Get tenant purchase settings
// @route   GET /api/purchase-orders/settings
// @access  Private (Tenant admin)
const getPurchaseSettings = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const purchaseSettings = await getTenantPurchaseSettings(tenantId);
  res.status(200).json({ success: true, data: { purchaseSettings } });
});

// Declarative validators — a new key only needs one entry here to persist
const PURCHASE_SETTING_VALIDATORS = {
  requirePOApproval: (v) => typeof v === "boolean",
  approvalThreshold: (v) => typeof v === "number" && v >= 0,
  lockConfirmedOrders: (v) => typeof v === "boolean",
  defaultBillControlPolicy: (v) => ["ordered", "received"].includes(v),
  enable3WayMatching: (v) => typeof v === "boolean",
  autoGenerateBill: (v) => typeof v === "boolean",
  allowPartialReceipts: (v) => typeof v === "boolean",
  rfqValidityDays: (v) => typeof v === "number" && v >= 0 && v <= 365,
  defaultCurrency: (v) => ["NGN", "USD", "EUR", "GBP"].includes(v),
  defaultLeadTimeDays: (v) => typeof v === "number" && v >= 0 && v <= 365,
  defaultPaymentTerms: (v) => typeof v === "string" && v.length <= 100,
  defaultReceivingLocation: (v) => typeof v === "string" && v.length <= 200,
};

// @desc    Update tenant purchase settings
// @route   PATCH /api/purchase-orders/settings
// @access  Private (Tenant admin)
const updatePurchaseSettings = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const { purchaseSettings = {} } = req.body;

  const updates = {};
  Object.entries(PURCHASE_SETTING_VALIDATORS).forEach(([key, isValid]) => {
    if (key in purchaseSettings && isValid(purchaseSettings[key])) {
      updates[`purchaseSettings.${key}`] = purchaseSettings[key];
    }
  });

  if (Object.keys(updates).length === 0) {
    throw new ValidationError("No valid purchase settings provided");
  }

  await Tenant.findByIdAndUpdate(tenantId, { $set: updates });
  const saved = await getTenantPurchaseSettings(tenantId);
  res.status(200).json({ success: true, data: { purchaseSettings: saved } });
});

// @desc    Send PO to Vendor via email
// @route   POST /api/purchase-orders/:id/send-to-vendor
// @access  Private (Tenant admin)
const sendPOToVendor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  const tenantId = await resolveTenantId(req);

  const po = await PurchaseOrder.findOne({
    _id: id,
    tenant: tenantId,
  }).populate('vendor');

  if (!po) {
    throw new NotFoundError("Purchase Order not found");
  }

  if (!po.vendor) {
    throw new ValidationError("PO must have a vendor to send");
  }

  const Vendor = require('../models/Vendor');
  const { sendPurchaseOrderToVendor } = require('../services/email.service');

  const vendorEmail = email || po.vendor.email;
  
  if (!vendorEmail) {
    throw new ValidationError("Vendor does not have an email address");
  }

  const tenant = await require('../models/Tenant').findById(tenantId);

  await sendPurchaseOrderToVendor(po, po.vendor, tenant);

  if (po.type === 'rfq') {
    po.rfqStatus = 'sent';
    po.sentAt = new Date();
    await po.save();
  }

  res.status(200).json({
    success: true,
    message: `PO sent to ${vendorEmail}`,
  });
});

// ─── Return items to vendor ───────────────────────────────────────────────────
/**
 * POST /api/purchase-orders/:id/return
 * Body: { items: [{ subProductId, quantity, reason? }], reason?, isExchange? }
 * Decrements stock, creates InventoryMovement records (type:'return', category:'out'),
 * and updates PO receivedQty / status flags.
 */
const returnPurchaseOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { items: returnItems = [], reason = '', isExchange = false } = req.body;
  const tenantId = await resolveTenantId(req);

  const InventoryMovement = require('../models/InventoryMovement');

  if (!returnItems.length) {
    return res.status(400).json({ success: false, message: 'No items provided for return' });
  }

  const po = await PurchaseOrder.findOne({ _id: id, tenant: tenantId });
  if (!po) throw new NotFoundError('Purchase order not found');
  if (po.status === 'cancelled') {
    return res.status(400).json({ success: false, message: 'Cannot return items from a cancelled PO' });
  }

  const errors   = [];
  const movementIds = [];

  for (const retItem of returnItems) {
    const { subProductId, quantity, reason: lineReason } = retItem;
    if (!quantity || quantity <= 0) continue;

    // Match against PO line by subProductId
    const poLine = po.items.find(it => it.subProductId?.toString() === subProductId);
    if (!poLine) {
      errors.push(`Product not found in this PO: ${subProductId}`);
      continue;
    }

    const availableToReturn = poLine.receivedQty ?? 0;
    if (quantity > availableToReturn) {
      errors.push(
        `Cannot return ${quantity} of "${poLine.subProductName || subProductId}" — only ${availableToReturn} received`
      );
      continue;
    }

    const effSizeId = poLine.sizeId?.toString() || null;
    let quantityBefore = 0;
    let quantityAfter  = 0;

    try {
      if (effSizeId) {
        const sizeAfter = await Size.findByIdAndUpdate(
          effSizeId,
          { $inc: { availableStock: -quantity, stock: -quantity } },
          { new: true }
        );
        quantityBefore = (sizeAfter?.availableStock ?? 0) + quantity;
        quantityAfter  = sizeAfter?.availableStock ?? 0;

        if (sizeAfter) {
          await Size.findByIdAndUpdate(effSizeId, {
            availability: sizeAfter.availableStock <= 0 ? 'out_of_stock'
                        : sizeAfter.availableStock <= (sizeAfter.lowStockThreshold || 5) ? 'low_stock'
                        : 'in_stock',
          });
        }

        await SubProduct.findByIdAndUpdate(subProductId, {
          $inc: { availableStock: -quantity, totalStock: -quantity },
        });
      } else {
        const spAfter = await SubProduct.findByIdAndUpdate(
          subProductId,
          { $inc: { availableStock: -quantity, totalStock: -quantity } },
          { new: true }
        );
        quantityBefore = (spAfter?.availableStock ?? 0) + quantity;
        quantityAfter  = spAfter?.availableStock ?? 0;
      }
    } catch (stockErr) {
      errors.push(`Stock update failed for "${poLine.subProductName}": ${stockErr.message}`);
      continue;
    }

    try {
      const movement = await InventoryMovement.create({
        subProduct:          subProductId,
        tenant:              tenantId,
        size:                effSizeId || undefined,
        type:                'return',
        category:            'out',
        quantity,
        quantityBefore,
        quantityAfter,
        reference:           po.poNumber,
        referenceType:       'purchase_order_return',
        relatedPurchaseOrder: po._id,
        reason:              lineReason || reason || (isExchange ? 'Return for exchange' : 'Return to vendor'),
        unitCost:            poLine.unitCost || 0,
        supplierName:        po.vendorName   || undefined,
        performedBy:         req.user._id,
        performedAt:         new Date(),
        source:              'manual',
        status:              'confirmed',
        notes:               `Vendor return — PO ${po.poNumber}${isExchange ? ' (Exchange)' : ''}`,
      });
      movementIds.push(movement._id);
    } catch (mvErr) {
      errors.push(`Movement record failed for "${poLine.subProductName}": ${mvErr.message}`);
      continue;
    }

    // Decrement received qty on the PO line in-memory (saved below)
    poLine.receivedQty = Math.max(0, availableToReturn - quantity);
  }

  if (errors.length && movementIds.length === 0) {
    return res.status(400).json({ success: false, message: errors.join('; ') });
  }

  // Re-evaluate PO receipt flags
  const totalOrdered  = po.items.reduce((s, it) => s + (it.quantity    || 0), 0);
  const totalReceived = po.items.reduce((s, it) => s + (it.receivedQty || 0), 0);

  if (totalReceived <= 0) {
    po.isPartiallyReceived = false;
    po.fullyReceivedDate   = undefined;
    if (po.status === 'received' || po.status === 'validated') po.status = 'confirmed';
  } else if (totalReceived < totalOrdered) {
    po.isPartiallyReceived = true;
    po.fullyReceivedDate   = undefined;
    if (po.status === 'validated') po.status = 'received';
  }

  await po.save();

  res.json({
    success: true,
    data: {
      movements: movementIds,
      warnings:  errors.length ? errors : undefined,
    },
  });
});

module.exports = {
  createPurchaseOrder,
  getPurchaseOrder,
  getPurchaseOrders,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  generatePurchaseOrderReceipt,
  approvePO,
  rejectPO,
  lockPO,
  unlockPO,
  createBillFromPO,
  sendPOToVendor,
  getPurchaseSettings,
  updatePurchaseSettings,
  returnPurchaseOrder,
  getPurchaseAnalyticsSummary,
  getPurchaseAnalyticsByVendor,
  requiresApproval,
  poTotal,
};
