// services/inventory.service.js

const mongoose = require('mongoose');
const InventoryMovement = require('../models/InventoryMovement');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
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
  console.log('🔧 createMovement called with:', { userId, tenantId, data: { ...data, quantity: data.quantity } });
  
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
  console.log('🔍 Looking for SubProduct:', subProductId, 'tenant:', tenantId);
  
  const subProduct = await SubProduct.findOne({
    _id: subProductId,
    tenant: tenantId,
  }).populate('sizes');

  if (!subProduct) {
    console.error('❌ SubProduct not found:', { subProductId, tenantId });
    throw new NotFoundError('SubProduct not found');
  }

  console.log('✅ SubProduct found:', subProduct._id, 'current stock:', subProduct.totalStock);
  console.log('   Sizes in SubProduct:', subProduct.sizes?.map(s => ({ _id: s._id, size: s.size })) || []);

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
  const updateData = {
    totalStock: quantityAfter,
    availableStock: quantityAfter - (subProduct.reservedStock || 0),
    stockStatus: quantityAfter === 0 ? 'out_of_stock' : quantityAfter <= (subProduct.lowStockThreshold || 10) ? 'low_stock' : 'in_stock',
    lastRestockDate: ['received', 'purchase', 'return'].includes(type) ? new Date() : subProduct.lastRestockDate,
  };

  console.log(`📦 Updating SubProduct ${subProductId} stock:`);
  console.log(`   - quantityBefore: ${quantityBefore}`);
  console.log(`   - quantity: ${quantity}`);
  console.log(`   - quantityAfter: ${quantityAfter}`);
  console.log(`   - totalStock will be: ${quantityAfter}`);
  console.log(`   - availableStock will be: ${quantityAfter - (subProduct.reservedStock || 0)}`);
  console.log(`   - stockStatus will be: ${updateData.stockStatus}`);

  // If this is an incoming movement with a new unit cost, update the overall average cost price
  if (['in', 'adjustment_in', 'return'].includes(category) && unitCost !== undefined && unitCost !== null) {
    const existingPrice = subProduct.costPrice || 0;
    
    if (quantityBefore > 0) {
      const totalPrice = (quantityBefore * existingPrice) + (quantity * unitCost);
      const averagePrice = quantityAfter > 0 ? totalPrice / quantityAfter : unitCost;
      updateData.costPrice = parseFloat(averagePrice.toFixed(4));
      console.log(`📈 Overall price updated: ${existingPrice} -> ${averagePrice.toFixed(4)}`);
    } else {
      updateData.costPrice = parseFloat(Number(unitCost).toFixed(4));
    }
  }

  // If this is an incoming movement and we have sizeId, update size-specific data in Size collection
  // Note: SubProduct.sizes[] is just an array of ObjectIds - we can't store stock there
  // Instead, we update the Size collection directly (below)
  if (['in', 'adjustment_in', 'return'].includes(category) && sizeId) {
    console.log(`⚠️ SizeId provided (${sizeId}) - will update Size collection directly`);
  }

  await SubProduct.findByIdAndUpdate(subProductId, updateData);

  // Also update the Size collection directly if sizeId is provided
  if (sizeId && ['in', 'adjustment_in', 'return'].includes(category)) {
    try {
      const size = await Size.findById(sizeId);
      if (size) {
        const existingSizeStock = size.stock || 0;
        const existingReservedStock = size.reservedStock || 0;
        const newSizeStock = existingSizeStock + quantity;
        
        const sizeUpdate = { 
          stock: newSizeStock,
          availableStock: newSizeStock - existingReservedStock,
        };
        
        // Also update cost price with weighted average
        if (unitCost !== undefined && unitCost !== null && existingSizeStock > 0) {
          const totalPrice = (existingSizeStock * (size.costPrice || 0)) + (quantity * unitCost);
          const averagePrice = newSizeStock > 0 ? totalPrice / newSizeStock : unitCost;
          sizeUpdate.costPrice = parseFloat(averagePrice.toFixed(4));
        } else if (unitCost !== undefined && unitCost !== null) {
          sizeUpdate.costPrice = parseFloat(Number(unitCost).toFixed(4));
        }
        
        await Size.findByIdAndUpdate(sizeId, sizeUpdate);
        console.log(`📦 Size collection updated: ${size.size} stock ${existingSizeStock} -> ${newSizeStock}, availableStock: ${sizeUpdate.availableStock}`);
      }
    } catch (sizeError) {
      console.error('Failed to update Size collection:', sizeError.message);
    }
  } else if (sizeId && ['out', 'adjustment_out'].includes(category)) {
    try {
      const size = await Size.findById(sizeId);
      if (size) {
        const existingSizeStock = size.stock || 0;
        const existingReservedStock = size.reservedStock || 0;
        const newSizeStock = Math.max(0, existingSizeStock - quantity);
        
        await Size.findByIdAndUpdate(sizeId, { 
          stock: newSizeStock,
          availableStock: Math.max(0, newSizeStock - existingReservedStock),
        });
        console.log(`📦 Size collection updated (out): ${size.size} stock ${existingSizeStock} -> ${newSizeStock}`);
      }
    } catch (sizeError) {
      console.error('Failed to update Size collection:', sizeError.message);
    }
  }

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
  
  console.log('📦 adjustInventory called:', { subProductId, tenantId, adjustment, reason, type });
  
  const movement = await createMovement(
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
  
  console.log('✅ Adjustment movement created:', movement._id);
  return movement;
};

// Record received goods
const recordReceived = async (subProductId, tenantId, data, userId) => {
  console.log('📦 recordReceived called:', { subProductId, tenantId, data, userId });
  
  const movement = await createMovement(
    {
      subProductId,
      type: 'received',
      ...data,
      source: 'manual',
    },
    userId,
    tenantId
  );
  
  console.log('✅ Movement created:', movement._id);
  return movement;
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

// Get Next PO Number
const getNextPONumber = async (tenantId) => {
  const PurchaseOrder = require('../models/PurchaseOrder');
  
  // Find the most recent PO for this tenant
  const lastPO = await PurchaseOrder.findOne({ tenant: tenantId })
    .sort({ createdAt: -1 })
    .lean();

  if (!lastPO || !lastPO.poNumber) {
    return 'PO000001';
  }

  // Extract the number, increment, and pad
  const match = lastPO.poNumber.match(/^PO(\d+)$/i);
  if (match && match[1]) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `PO${String(nextNum).padStart(6, '0')}`;
  }

  return 'PO000001';
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

/**
 * Transfer stock between warehouses
 */
const transferStock = async (data, userId, tenantId) => {
  const {
    subProductId,
    sourceWarehouseId,
    destinationWarehouseId,
    quantity,
    notes,
    reference,
  } = data;

  if (!subProductId) {
    throw new ValidationError('SubProduct ID is required');
  }
  if (!sourceWarehouseId || !destinationWarehouseId) {
    throw new ValidationError('Source and destination warehouse IDs are required');
  }
  if (sourceWarehouseId === destinationWarehouseId) {
    throw new ValidationError('Source and destination warehouses must be different');
  }
  if (!quantity || quantity <= 0) {
    throw new ValidationError('Quantity must be greater than 0');
  }

  // Get subproduct to verify ownership
  const subProduct = await SubProduct.findOne({
    _id: subProductId,
    tenant: tenantId,
  });

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found');
  }

  // Verify source warehouse has sufficient stock
  const sourceWarehouse = await Warehouse.findOne({
    _id: sourceWarehouseId,
    tenant: tenantId,
  });

  if (!sourceWarehouse) {
    throw new NotFoundError('Source warehouse not found');
  }

  if (sourceWarehouse.currentQuantity < quantity) {
    throw new ValidationError(
      `Insufficient stock in source warehouse. Available: ${sourceWarehouse.currentQuantity}, Requested: ${quantity}`
    );
  }

  // Verify destination warehouse exists
  const destWarehouse = await Warehouse.findOne({
    _id: destinationWarehouseId,
    tenant: tenantId,
  });

  if (!destWarehouse) {
    throw new NotFoundError('Destination warehouse not found');
  }

  // Check capacity at destination
  if (destWarehouse.capacity > 0 && destWarehouse.currentQuantity + quantity > destWarehouse.capacity) {
    throw new ValidationError(
      `Insufficient capacity in destination warehouse. Available: ${destWarehouse.capacity - destWarehouse.currentQuantity}, Requested: ${quantity}`
    );
  }

  // Generate transfer reference
  const transferRef = reference || `TRF-${Date.now().toString(36).toUpperCase()}`;

  // Create transfer out movement
  const transferOut = await createMovement(
    {
      subProductId,
      type: 'transfer_out',
      quantity,
      warehouseId: sourceWarehouseId,
      destinationWarehouseId,
      reference: transferRef,
      referenceType: 'transfer',
      notes: `Transfer to ${destWarehouse.location}. ${notes || ''}`,
      source: 'manual',
    },
    userId,
    tenantId
  );

  // Create transfer in movement
  const transferIn = await createMovement(
    {
      subProductId,
      type: 'transfer_in',
      quantity,
      warehouseId: destinationWarehouseId,
      sourceWarehouseId,
      reference: transferRef,
      referenceType: 'transfer',
      notes: `Transfer from ${sourceWarehouse.location}. ${notes || ''}`,
      source: 'manual',
    },
    userId,
    tenantId
  );

  // Update warehouse quantities
  await Warehouse.findByIdAndUpdate(sourceWarehouseId, {
    $inc: { currentQuantity: -quantity },
  });

  await Warehouse.findByIdAndUpdate(destinationWarehouseId, {
    $inc: { currentQuantity: quantity },
  });

  console.log(`✅ Transfer completed: ${quantity} units from ${sourceWarehouse.location} to ${destWarehouse.location}`);

  return {
    transferReference: transferRef,
    transferOut,
    transferIn,
    quantity,
    sourceWarehouse: {
      id: sourceWarehouse._id,
      location: sourceWarehouse.location,
      newQuantity: sourceWarehouse.currentQuantity - quantity,
    },
    destinationWarehouse: {
      id: destWarehouse._id,
      location: destWarehouse.location,
      newQuantity: destWarehouse.currentQuantity + quantity,
    },
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
  getNextPONumber,
  getLowStockItems,
  getInventoryValuation,
  transferStock,
  MOVEMENT_CATEGORIES,
};
