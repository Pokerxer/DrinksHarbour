// services/inventory.service.js

const mongoose = require('mongoose');
const InventoryMovement = require('../models/InventoryMovement');
const SubProduct = require('../models/SubProduct');
const Warehouse = require('../models/Warehouse');
const { NotFoundError, ValidationError, ForbiddenError } = require('../utils/errors');

const { ObjectId } = mongoose.Types;

// Movement type categories
const MOVEMENT_CATEGORIES = {
  received: 'in',
  purchase: 'in',
  return: 'in',
  adjustment_in: 'in',
  transfer_in: 'transfer',
  sold: 'out',
  shipped: 'out',
  adjustment_out: 'out',
  transfer_out: 'transfer',
  damaged: 'out',
  expired: 'out',
  theft: 'out',
  written_off: 'out',
  reserved: 'out',
  released: 'in',
};

// Create inventory movement and update stock
const createMovement = async (data, userId, tenantId) => {
  const {
    subProductId,
    productId,
    sizeId,
    warehouseId,
    type,
    quantity,
    reference,
    referenceType,
    relatedOrder,
    relatedPurchaseOrder,
    unitCost,
    sellingPrice,
    sourceWarehouseId,
    destinationWarehouseId,
    supplierId,
    supplierName,
    batchNumber,
    lotNumber,
    expirationDate,
    manufacturingDate,
    reason,
    notes,
    source = 'manual',
    ipAddress,
    userAgent,
  } = data;

  // Validate required fields
  if (!subProductId) {
    throw new ValidationError('SubProduct ID is required');
  }
  if (!type) {
    throw new ValidationError('Movement type is required');
  }
  if (!quantity || quantity <= 0) {
    throw new ValidationError('Quantity must be greater than 0');
  }

  // Get current subproduct
  const subProduct = await SubProduct.findOne({
    _id: subProductId,
    tenant: tenantId,
  });

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found');
  }

  const quantityBefore = subProduct.totalStock || 0;
  let quantityAfter;

  // Determine category
  const category = MOVEMENT_CATEGORIES[type] || 'adjustment';

  // Calculate new quantity based on movement type
  if (['in', 'return', 'adjustment_in', 'released'].includes(category)) {
    quantityAfter = quantityBefore + quantity;
  } else if (['out', 'adjustment_out'].includes(category)) {
    quantityAfter = quantityBefore - quantity;
    if (quantityAfter < 0) {
      throw new ValidationError(`Insufficient stock. Available: ${quantityBefore}, Requested: ${quantity}`);
    }
  } else if (category === 'transfer') {
    // For transfers, just record the movement
    quantityAfter = quantityBefore;
  }

  // Create the movement record
  const movement = await InventoryMovement.create({
    subProduct: subProductId,
    tenant: tenantId,
    product: productId || subProduct.product,
    size: sizeId,
    warehouse: warehouseId,
    type,
    category,
    quantity,
    quantityBefore,
    quantityAfter,
    reference,
    referenceType,
    relatedOrder,
    relatedPurchaseOrder,
    unitCost: unitCost || subProduct.costPrice,
    totalCost: (unitCost || subProduct.costPrice || 0) * quantity,
    sellingPrice,
    sourceWarehouse: sourceWarehouseId,
    destinationWarehouse: destinationWarehouseId,
    supplier: supplierId,
    supplierName,
    batchNumber,
    lotNumber,
    expirationDate: expirationDate ? new Date(expirationDate) : null,
    manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : null,
    reason,
    notes,
    performedBy: userId,
    performedAt: new Date(),
    source,
    ipAddress,
    userAgent,
    status: 'confirmed',
    isVerified: true,
    verifiedAt: new Date(),
    verifiedBy: userId,
  });

  // Update SubProduct stock
  await SubProduct.findByIdAndUpdate(subProductId, {
    totalStock: quantityAfter,
    availableStock: quantityAfter - (subProduct.reservedStock || 0),
    stockStatus: quantityAfter === 0 ? 'out_of_stock' : quantityAfter <= (subProduct.lowStockThreshold || 10) ? 'low_stock' : 'in_stock',
    lastRestockDate: ['received', 'purchase', 'return'].includes(type) ? new Date() : subProduct.lastRestockDate,
  });

  // Update Warehouse if specified
  if (warehouseId) {
    await Warehouse.findByIdAndUpdate(warehouseId, {
      $inc: { currentQuantity: category === 'in' ? quantity : -quantity },
    });
  }

  console.log(`✅ Inventory movement created: ${type} - ${quantity} units. Stock: ${quantityBefore} -> ${quantityAfter}`);

  return movement;
};

// Get inventory movements with filtering and pagination
const getMovements = async (tenantId, options = {}) => {
  const {
    subProductId,
    productId,
    sizeId,
    warehouseId,
    type,
    category,
    startDate,
    endDate,
    page = 1,
    limit = 50,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const query = { tenant: tenantId };

  if (subProductId) query.subProduct = subProductId;
  if (productId) query.product = productId;
  if (sizeId) query.size = sizeId;
  if (warehouseId) query.warehouse = warehouseId;
  if (type) query.type = type;
  if (category) query.category = category;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [movements, total] = await Promise.all([
    InventoryMovement.find(query)
      .populate('subProduct', 'sku baseSellingPrice')
      .populate('product', 'name slug')
      .populate('warehouse', 'location zone aisle shelf bin')
      .populate('performedBy', 'name email')
      .populate('verifiedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    InventoryMovement.countDocuments(query),
  ]);

  return {
    movements,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Get inventory summary for a subproduct
const getInventorySummary = async (tenantId, subProductId) => {
  if (!subProductId) {
    throw new ValidationError('SubProduct ID is required');
  }

  const subProduct = await SubProduct.findOne({
    _id: subProductId,
    tenant: tenantId,
  }).lean();

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found');
  }

  // Get totals by movement type
  const summary = await InventoryMovement.aggregate([
    {
      $match: {
        tenant: new ObjectId(tenantId),
        subProduct: new ObjectId(subProductId),
      },
    },
    {
      $group: {
        _id: '$type',
        totalQuantity: { $sum: '$quantity' },
        count: { $sum: 1 },
        totalCost: { $sum: '$totalCost' },
        totalRevenue: { $sum: '$revenue' },
        totalProfit: { $sum: '$profit' },
      },
    },
  ]);

  // Get recent movements
  const recentMovements = await InventoryMovement.find({
    tenant: tenantId,
    subProduct: subProductId,
  })
    .populate('performedBy', 'name')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  // Get stock flow for last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const stockFlow = await InventoryMovement.aggregate([
    {
      $match: {
        tenant: new ObjectId(tenantId),
        subProduct: new ObjectId(subProductId),
        createdAt: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          category: '$category',
        },
        totalQuantity: { $sum: '$quantity' },
      },
    },
    { $sort: { '_id.date': 1 } },
  ]);

  // Calculate totals
  const totals = {
    received: 0,
    sold: 0,
    returned: 0,
    adjusted: 0,
    damaged: 0,
  };

  summary.forEach((item) => {
    if (['received', 'purchase'].includes(item._id)) {
      totals.received += item.totalQuantity;
    } else if (item._id === 'sold') {
      totals.sold += item.totalQuantity;
    } else if (item._id === 'return') {
      totals.returned += item.totalQuantity;
    } else if (['adjustment_in', 'adjustment_out'].includes(item._id)) {
      totals.adjusted += item.totalQuantity;
    } else if (['damaged', 'expired', 'written_off'].includes(item._id)) {
      totals.damaged += item.totalQuantity;
    }
  });

  return {
    subProduct: {
      _id: subProduct._id,
      sku: subProduct.sku,
      totalStock: subProduct.totalStock,
      availableStock: subProduct.availableStock,
      reservedStock: subProduct.reservedStock,
      lowStockThreshold: subProduct.lowStockThreshold,
      stockStatus: subProduct.stockStatus,
    },
    totals,
    summary,
    recentMovements,
    stockFlow,
  };
};

// Adjust inventory (increase or decrease with reason)
const adjustInventory = async (subProductId, tenantId, adjustment, reason, userId, notes, reference) => {
  const type = adjustment >= 0 ? 'adjustment_in' : 'adjustment_out';
  
  return createMovement(
    {
      subProductId,
      type,
      quantity: Math.abs(adjustment),
      reason,
      notes,
      reference,
      referenceType: 'adjustment',
      source: 'manual',
    },
    userId,
    tenantId
  );
};

// Record received goods
const recordReceived = async (subProductId, tenantId, data, userId) => {
  return createMovement(
    {
      subProductId,
      type: 'received',
      ...data,
      source: 'manual',
    },
    userId,
    tenantId
  );
};

// Record sale (decrease stock)
const recordSale = async (subProductId, tenantId, quantity, orderId, sellingPrice, userId) => {
  return createMovement(
    {
      subProductId,
      type: 'sold',
      quantity,
      relatedOrder: orderId,
      sellingPrice,
      referenceType: 'order',
      source: 'order',
    },
    userId,
    tenantId
  );
};

// Record return
const recordReturn = async (subProductId, tenantId, data, userId) => {
  return createMovement(
    {
      subProductId,
      type: 'return',
      ...data,
      source: 'manual',
    },
    userId,
    tenantId
  );
};

// Cancel a movement (reverse it)
const cancelMovement = async (movementId, tenantId, userId, reason) => {
  const movement = await InventoryMovement.findOne({
    _id: movementId,
    tenant: tenantId,
  });

  if (!movement) {
    throw new NotFoundError('Movement not found');
  }

  if (movement.status === 'cancelled') {
    throw new ValidationError('Movement already cancelled');
  }

  // Create reversal movement
  const reversalType = movement.type.replace('_in', '_out').replace('_out', '_in');
  const validReversalTypes = {
    received: 'adjustment_out',
    purchase: 'adjustment_out',
    return: 'sold',
    adjustment_in: 'adjustment_out',
    adjustment_out: 'adjustment_in',
    sold: 'return',
    damaged: 'adjustment_in',
    expired: 'adjustment_in',
    written_off: 'adjustment_in',
  };

  const actualReversalType = validReversalTypes[movement.type] || 'adjustment_out';

  const reversal = await createMovement(
    {
      subProductId: movement.subProduct,
      type: actualReversalType,
      quantity: movement.quantity,
      reason: `Reversal of ${movement.type} - ${reason || 'Cancelled'}`,
      reference: `REVERSAL-${movement._id}`,
      referenceType: 'adjustment',
      source: 'manual',
    },
    userId,
    tenantId
  );

  // Mark original as cancelled
  movement.status = 'cancelled';
  movement.notes = (movement.notes || '') + `\n[CANCELLED] Reason: ${reason}. Reversal movement: ${reversal._id}`;
  await movement.save();

  return reversal;
};

// Get low stock items
const getLowStockItems = async (tenantId) => {
  const subProducts = await SubProduct.find({
    tenant: tenantId,
    $expr: { $lte: ['$availableStock', '$lowStockThreshold'] },
    status: { $nin: ['archived', 'discontinued'] },
  })
    .populate('product', 'name slug images')
    .sort({ availableStock: 1 })
    .lean();

  return subProducts.map((sp) => ({
    _id: sp._id,
    sku: sp.sku,
    product: sp.product,
    totalStock: sp.totalStock,
    availableStock: sp.availableStock,
    lowStockThreshold: sp.lowStockThreshold,
    stockStatus: sp.stockStatus,
    reorderPoint: sp.reorderPoint,
    reorderQuantity: sp.reorderQuantity,
  }));
};

// Get inventory valuation
const getInventoryValuation = async (tenantId) => {
  const pipeline = [
    {
      $match: {
        tenant: new ObjectId(tenantId),
        status: { $nin: ['archived', 'discontinued'] },
      },
    },
    {
      $group: {
        _id: null,
        totalItems: { $sum: '$totalStock' },
        totalValue: { $sum: { $multiply: ['$totalStock', '$costPrice'] } },
        totalRetailValue: { $sum: { $multiply: ['$totalStock', '$baseSellingPrice'] } },
      },
    },
  ];

  const [result] = await SubProduct.aggregate(pipeline);

  return {
    totalItems: result?.totalItems || 0,
    totalValue: result?.totalValue || 0,
    totalRetailValue: result?.totalRetailValue || 0,
    potentialProfit: (result?.totalRetailValue || 0) - (result?.totalValue || 0),
  };
};

module.exports = {
  createMovement,
  getMovements,
  getInventorySummary,
  adjustInventory,
  recordReceived,
  recordSale,
  recordReturn,
  cancelMovement,
  getLowStockItems,
  getInventoryValuation,
  MOVEMENT_CATEGORIES,
};
