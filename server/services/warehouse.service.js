// services/warehouse.service.js

const mongoose = require('mongoose');
const Warehouse = require('../models/Warehouse');
const SubProduct = require('../models/SubProduct');
const { NotFoundError, ValidationError, ForbiddenError } = require('../utils/errors');

const { ObjectId } = mongoose.Types;

/**
 * Create a new warehouse/location for a tenant
 */
const createWarehouse = async (data, userId, tenantId) => {
  const {
    location,
    locationType = 'warehouse',
    zone,
    aisle,
    shelf,
    bin,
    capacity = 0,
    condition = 'ambient',
    temperature,
    humidityLevel,
    isLightSensitive = false,
    minStockLevel = 0,
    maxStockLevel = 0,
    reorderAlert = true,
    trackExpiration = false,
    expirationWarningDays = 30,
    binManagement = 'single_bin',
    pickPriority = 999,
    pickZone,
    pickPath,
    accessNotes,
    notes,
    subProductId,
    productId,
  } = data;

  if (!location) {
    throw new ValidationError('Location name is required');
  }

  // Check for duplicate location for this tenant
  const existingWarehouse = await Warehouse.findOne({
    tenant: tenantId,
    location,
    isActive: true,
  });

  if (existingWarehouse) {
    throw new ValidationError(`A location named "${location}" already exists`);
  }

  const warehouse = await Warehouse.create({
    tenant: tenantId,
    subProduct: subProductId,
    product: productId,
    location,
    locationType,
    zone,
    aisle,
    shelf,
    bin,
    capacity,
    currentQuantity: 0,
    reservedQuantity: 0,
    condition,
    temperature,
    humidityLevel,
    isLightSensitive,
    minStockLevel,
    maxStockLevel,
    reorderAlert,
    trackExpiration,
    expirationWarningDays,
    binManagement,
    pickPriority,
    pickZone,
    pickPath,
    accessNotes,
    notes,
    createdBy: userId,
    isActive: true,
    status: 'active',
  });

  console.log(`✅ Warehouse created: ${location} for tenant ${tenantId}`);
  return warehouse;
};

/**
 * Get all warehouses for a tenant
 */
const getWarehouses = async (tenantId, options = {}) => {
  const {
    page = 1,
    limit = 50,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    locationType,
    status,
    isActive = true,
    subProductId,
  } = options;

  const query = { tenant: tenantId };

  if (isActive !== undefined) query.isActive = isActive;
  if (locationType) query.locationType = locationType;
  if (status) query.status = status;
  if (subProductId) query.subProduct = subProductId;

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [warehouses, total] = await Promise.all([
    Warehouse.find(query)
      .populate('subProduct', 'sku')
      .populate('product', 'name slug')
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Warehouse.countDocuments(query),
  ]);

  return {
    warehouses,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get a single warehouse by ID
 */
const getWarehouseById = async (warehouseId, tenantId) => {
  const warehouse = await Warehouse.findOne({
    _id: warehouseId,
    tenant: tenantId,
  })
    .populate('subProduct', 'sku totalStock')
    .populate('product', 'name slug images')
    .populate('createdBy', 'name email')
    .lean();

  if (!warehouse) {
    throw new NotFoundError('Warehouse not found');
  }

  return warehouse;
};

/**
 * Update a warehouse
 */
const updateWarehouse = async (warehouseId, data, tenantId, userId) => {
  const warehouse = await Warehouse.findOne({
    _id: warehouseId,
    tenant: tenantId,
  });

  if (!warehouse) {
    throw new NotFoundError('Warehouse not found');
  }

  // Fields that can be updated
  const allowedFields = [
    'location',
    'locationType',
    'zone',
    'aisle',
    'shelf',
    'bin',
    'capacity',
    'condition',
    'temperature',
    'humidityLevel',
    'isLightSensitive',
    'minStockLevel',
    'maxStockLevel',
    'reorderAlert',
    'trackExpiration',
    'expirationWarningDays',
    'binManagement',
    'pickPriority',
    'pickZone',
    'pickPath',
    'isAccessible',
    'accessNotes',
    'notes',
    'status',
  ];

  // Apply updates
  allowedFields.forEach((field) => {
    if (data[field] !== undefined) {
      warehouse[field] = data[field];
    }
  });

  await warehouse.save();

  console.log(`✅ Warehouse updated: ${warehouse.location} by user ${userId}`);
  return warehouse;
};

/**
 * Delete (soft delete) a warehouse
 */
const deleteWarehouse = async (warehouseId, tenantId, userId) => {
  const warehouse = await Warehouse.findOne({
    _id: warehouseId,
    tenant: tenantId,
  });

  if (!warehouse) {
    throw new NotFoundError('Warehouse not found');
  }

  // Check if warehouse has stock
  if (warehouse.currentQuantity > 0) {
    throw new ValidationError(
      `Cannot delete warehouse with ${warehouse.currentQuantity} units in stock. Please transfer or remove stock first.`
    );
  }

  warehouse.isActive = false;
  warehouse.status = 'inactive';
  await warehouse.save();

  console.log(`✅ Warehouse deleted: ${warehouse.location} by user ${userId}`);
  return { success: true, message: 'Warehouse deleted successfully' };
};

/**
 * Get inventory at a specific warehouse
 */
const getWarehouseInventory = async (warehouseId, tenantId, options = {}) => {
  const { page = 1, limit = 50 } = options;

  const warehouse = await Warehouse.findOne({
    _id: warehouseId,
    tenant: tenantId,
  }).lean();

  if (!warehouse) {
    throw new NotFoundError('Warehouse not found');
  }

  // Get all movements for this warehouse
  const InventoryMovement = require('../models/InventoryMovement');

  const movements = await InventoryMovement.find({
    tenant: tenantId,
    warehouse: warehouseId,
  })
    .populate('subProduct', 'sku')
    .populate('product', 'name')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await InventoryMovement.countDocuments({
    tenant: tenantId,
    warehouse: warehouseId,
  });

  return {
    warehouse,
    movements,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Adjust stock at a specific warehouse
 */
const adjustWarehouseStock = async (warehouseId, quantity, type, tenantId, userId, notes) => {
  const warehouse = await Warehouse.findOne({
    _id: warehouseId,
    tenant: tenantId,
  });

  if (!warehouse) {
    throw new NotFoundError('Warehouse not found');
  }

  if (quantity <= 0) {
    throw new ValidationError('Quantity must be greater than 0');
  }

  // Add movement to warehouse history
  await warehouse.addMovement(type, quantity, `ADJ-${Date.now()}`, notes, userId);

  console.log(`✅ Warehouse stock adjusted: ${type} ${quantity} at ${warehouse.location}`);
  return warehouse;
};

/**
 * Get low stock warehouses
 */
const getLowStockWarehouses = async (tenantId) => {
  const warehouses = await Warehouse.find({
    tenant: tenantId,
    isActive: true,
    $expr: { $lte: ['$currentQuantity', '$minStockLevel'] },
  })
    .populate('subProduct', 'sku')
    .populate('product', 'name')
    .sort({ currentQuantity: 1 })
    .lean();

  return warehouses;
};

/**
 * Get warehouse capacity utilization
 */
const getCapacityUtilization = async (tenantId) => {
  const result = await Warehouse.aggregate([
    {
      $match: {
        tenant: new ObjectId(tenantId),
        isActive: true,
        capacity: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: '$locationType',
        totalCapacity: { $sum: '$capacity' },
        totalUsed: { $sum: '$currentQuantity' },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        locationType: '$_id',
        totalCapacity: 1,
        totalUsed: 1,
        count: 1,
        utilization: {
          $cond: [
            { $eq: ['$totalCapacity', 0] },
            0,
            { $multiply: [{ $divide: ['$totalUsed', '$totalCapacity'] }, 100] },
          ],
        },
      },
    },
  ]);

  return result;
};

module.exports = {
  createWarehouse,
  getWarehouses,
  getWarehouseById,
  updateWarehouse,
  deleteWarehouse,
  getWarehouseInventory,
  adjustWarehouseStock,
  getLowStockWarehouses,
  getCapacityUtilization,
};
