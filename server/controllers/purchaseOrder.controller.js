// controllers/purchaseOrder.controller.js
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const PurchaseOrder = require("../models/PurchaseOrder");
const SubProduct = require("../models/SubProduct");
const Size = require("../models/Size");
const Warehouse = require("../models/Warehouse");
const inventoryService = require("../services/inventory.service");
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
    poNumber,
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
  if (!poNumber || !vendorName || !items || !Array.isArray(items)) {
    throw new ValidationError("Required fields missing");
  }

  // Validate items have subProductId
  for (const item of items) {
    if (!item.subProductId) {
      throw new ValidationError(
        "Each item must have subProductId",
      );
    }
  }

  // Validate subProducts exist in tenant's catalog
  await validateSubProducts(items, tenantId);

  // Enrich items with subProduct and Size data (auto-lookup)
  const enrichedItems = await enrichPOItems(items, tenantId);

  const purchaseOrder = await PurchaseOrder.create({
    tenant: tenantId,
    poNumber,
    vendor,
    vendorName,
    vendorReference,
    currency: currency || "NGN",
    orderDate: new Date(),
    confirmationDate: confirmationDate || new Date(),
    expectedArrival,
    arrivalDate,
    items: enrichedItems,
    notes,
    project,
    createdBy: userId,
    // Auto-confirm POs for faster workflow
    status: "confirmed",
    // RFQ specific
    type: type || "po",
    rfqStatus: rfqStatus || (type === "rfq" ? "draft" : undefined),
    validUntil,
    termsConditions,
    // For POs, set approval to pending (all POs require approval)
    approvalStatus: type === "rfq" ? undefined : (approvalStatus || "pending"),
    originalPO,
    isBackorder: isBackorder || false,
    // Store creator name for display
    approvedByName: req.user?.name || "System",
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
    .populate("items.sizeId", "size ml volume");

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

  // Build filter
  const filter = { tenant: tenantId };
  if (status) filter.status = status;
  if (vendor) filter.vendor = vendor;

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

// @desc    Update purchase order status
// @route   PATCH /api/purchase-orders/:id/status
// @access  Private (Tenant admin)
const updatePurchaseOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, receivedItems } = req.body;
  const tenantId = await resolveTenantId(req);

  const purchaseOrder = await PurchaseOrder.findOne({
    _id: id,
    tenant: tenantId,
  });

  if (!purchaseOrder) {
    throw new NotFoundError("Purchase Order not found");
  }

  // Check if PO requires approval before confirming
  if (status === "confirmed" && purchaseOrder.type === "po") {
    if (purchaseOrder.approvalStatus !== "approved") {
      throw new ValidationError(
        "PO must be approved before confirmation"
      );
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
    for (const receivedItem of receivedItems) {
      const item = purchaseOrder.items.find(
        (i) => i._id.toString() === receivedItem.itemId,
      );
      if (item) {
        item.receivedQty = receivedItem.receivedQty;
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
        const movementData = {
          subProductId: item.subProductId,
          sizeId: item.sizeId,
          type: 'received',
          quantity: quantityToAdd,
          unitCost: item.unitCost,
          relatedPurchaseOrder: purchaseOrder._id,
          reference: purchaseOrder.poNumber,
          referenceType: 'purchase_order',
          supplierId: purchaseOrder.vendor,
          supplierName: purchaseOrder.vendorName,
        };
        
        if (defaultWarehouseId) {
          movementData.warehouseId = defaultWarehouseId;
        }
        
        await inventoryService.createMovement(
          movementData,
          req.user?._id || purchaseOrder.createdBy,
          tenantId
        );
        
        console.log(`   ✅ Inventory added successfully`);
        successCount++;
      } catch (inventoryError) {
        console.error(`   ❌ Failed to add inventory:`, inventoryError.message);
        failCount++;
      }
    }
    
    console.log(`🏁 PO Validation Complete: ${successCount} succeeded, ${failCount} failed`);
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
    data: po,
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

  const VendorBill = require('../models/VendorBill');

  // Generate bill number
  const count = await VendorBill.countDocuments({ tenant: tenantId });
  const year = new Date().getFullYear();
  const billNumber = `BIL-${year}-${String(count + 1).padStart(5, '0')}`;

  const policy = billControlPolicy || po.billControlPolicy || 'received';

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
    throw new ValidationError("No billable items found. Make sure products have been received.");
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
    dueDate,
    notes,
    billControlPolicy: policy,
    status: 'draft',
    matchingStatus: 'pending',
    payments: [],
    paidAmount: 0,
    createdBy: req.user?._id,
  });

  await vendorBill.save();

  res.status(201).json({
    success: true,
    data: vendorBill,
    message: "Vendor bill created successfully",
  });
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

module.exports = {
  createPurchaseOrder,
  getPurchaseOrder,
  getPurchaseOrders,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  generatePurchaseOrderReceipt,
  approvePO,
  rejectPO,
  lockPO,
  unlockPO,
  createBillFromPO,
  sendPOToVendor,
  getPurchaseAnalyticsSummary,
  getPurchaseAnalyticsByVendor,
};
