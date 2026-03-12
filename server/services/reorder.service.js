// services/reorder.service.js

const mongoose = require('mongoose');
const ReorderRule = require('../models/ReorderRule');
const SubProduct = require('../models/SubProduct');
const { NotFoundError, ValidationError } = require('../utils/errors');

const { ObjectId } = mongoose.Types;

/**
 * Create a new reorder rule
 */
const createRule = async (data, userId, tenantId) => {
  const {
    subProductId,
    productId,
    sizeId,
    warehouseId,
    name,
    description,
    triggerType = 'reorder_point',
    minQuantity,
    reorderPoint,
    daysOfStock,
    forecastDays,
    quantityType = 'fixed',
    orderQuantity,
    maxStockLevel,
    daysOfSupply,
    preferredVendor,
    vendorName,
    leadTimeDays,
    unitCost,
    minimumOrderQuantity,
    isAutomatic = false,
    autoCreatePurchaseOrder = false,
    autoApprove = false,
    notifyOnTrigger = true,
    notifyEmails = [],
    checkFrequency = 'daily',
    notes,
    tags,
  } = data;

  if (!subProductId) {
    throw new ValidationError('SubProduct ID is required');
  }
  if (!name) {
    throw new ValidationError('Rule name is required');
  }

  // Verify subproduct exists and belongs to tenant
  const subProduct = await SubProduct.findOne({
    _id: subProductId,
    tenant: tenantId,
  });

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found');
  }

  // Calculate next check time based on frequency
  const now = new Date();
  let nextCheckAt;
  switch (checkFrequency) {
    case 'realtime':
      nextCheckAt = now;
      break;
    case 'hourly':
      nextCheckAt = new Date(now.getTime() + 60 * 60 * 1000);
      break;
    case 'weekly':
      nextCheckAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'daily':
    default:
      nextCheckAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  const rule = await ReorderRule.create({
    tenant: tenantId,
    subProduct: subProductId,
    product: productId || subProduct.product,
    size: sizeId,
    warehouse: warehouseId,
    name,
    description,
    triggerType,
    minQuantity: minQuantity ?? subProduct.lowStockThreshold,
    reorderPoint: reorderPoint ?? subProduct.reorderPoint,
    daysOfStock,
    forecastDays,
    quantityType,
    orderQuantity: orderQuantity ?? subProduct.reorderQuantity,
    maxStockLevel,
    daysOfSupply,
    preferredVendor,
    vendorName,
    leadTimeDays: leadTimeDays ?? subProduct.leadTimeDays,
    unitCost: unitCost ?? subProduct.costPrice,
    minimumOrderQuantity: minimumOrderQuantity ?? subProduct.minimumOrderQuantity,
    isAutomatic,
    autoCreatePurchaseOrder,
    autoApprove,
    notifyOnTrigger,
    notifyEmails,
    checkFrequency,
    nextCheckAt,
    status: 'active',
    isActive: true,
    createdBy: userId,
    notes,
    tags,
  });

  console.log(`✅ Reorder rule created: ${name} for subProduct ${subProductId}`);
  return rule;
};

/**
 * Get all reorder rules for a tenant
 */
const getRules = async (tenantId, options = {}) => {
  const {
    subProductId,
    status,
    isActive,
    page = 1,
    limit = 50,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const query = { tenant: tenantId };

  if (subProductId) query.subProduct = subProductId;
  if (status) query.status = status;
  if (isActive !== undefined) query.isActive = isActive;

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [rules, total] = await Promise.all([
    ReorderRule.find(query)
      .populate('subProduct', 'sku totalStock availableStock lowStockThreshold reorderPoint reorderQuantity')
      .populate('product', 'name slug')
      .populate('warehouse', 'location')
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    ReorderRule.countDocuments(query),
  ]);

  return {
    rules,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get a single reorder rule by ID
 */
const getRuleById = async (ruleId, tenantId) => {
  const rule = await ReorderRule.findOne({
    _id: ruleId,
    tenant: tenantId,
  })
    .populate('subProduct', 'sku totalStock availableStock lowStockThreshold reorderPoint reorderQuantity salesVelocity')
    .populate('product', 'name slug images')
    .populate('warehouse', 'location zone aisle')
    .populate('createdBy', 'name email')
    .lean();

  if (!rule) {
    throw new NotFoundError('Reorder rule not found');
  }

  return rule;
};

/**
 * Update a reorder rule
 */
const updateRule = async (ruleId, data, tenantId, userId) => {
  const rule = await ReorderRule.findOne({
    _id: ruleId,
    tenant: tenantId,
  });

  if (!rule) {
    throw new NotFoundError('Reorder rule not found');
  }

  const allowedFields = [
    'name',
    'description',
    'triggerType',
    'minQuantity',
    'reorderPoint',
    'daysOfStock',
    'forecastDays',
    'quantityType',
    'orderQuantity',
    'maxStockLevel',
    'daysOfSupply',
    'preferredVendor',
    'vendorName',
    'leadTimeDays',
    'unitCost',
    'minimumOrderQuantity',
    'isAutomatic',
    'autoCreatePurchaseOrder',
    'autoApprove',
    'notifyOnTrigger',
    'notifyEmails',
    'checkFrequency',
    'status',
    'isActive',
    'notes',
    'tags',
  ];

  allowedFields.forEach((field) => {
    if (data[field] !== undefined) {
      rule[field] = data[field];
    }
  });

  rule.updatedBy = userId;

  // Recalculate next check time if frequency changed
  if (data.checkFrequency) {
    const now = new Date();
    switch (data.checkFrequency) {
      case 'realtime':
        rule.nextCheckAt = now;
        break;
      case 'hourly':
        rule.nextCheckAt = new Date(now.getTime() + 60 * 60 * 1000);
        break;
      case 'weekly':
        rule.nextCheckAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'daily':
      default:
        rule.nextCheckAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  await rule.save();

  console.log(`✅ Reorder rule updated: ${rule.name}`);
  return rule;
};

/**
 * Delete a reorder rule
 */
const deleteRule = async (ruleId, tenantId) => {
  const rule = await ReorderRule.findOne({
    _id: ruleId,
    tenant: tenantId,
  });

  if (!rule) {
    throw new NotFoundError('Reorder rule not found');
  }

  await ReorderRule.findByIdAndDelete(ruleId);

  console.log(`✅ Reorder rule deleted: ${rule.name}`);
  return { success: true, message: 'Reorder rule deleted successfully' };
};

/**
 * Check and trigger rules for a tenant
 */
const checkRules = async (tenantId) => {
  const dueRules = await ReorderRule.findDueForCheck(tenantId);
  const results = [];

  for (const rule of dueRules) {
    const subProduct = rule.subProduct;
    if (!subProduct) continue;

    const currentStock = subProduct.availableStock || subProduct.totalStock || 0;
    const salesVelocity = subProduct.salesVelocity || 0;

    const shouldTrigger = rule.checkTrigger(currentStock, salesVelocity);

    if (shouldTrigger) {
      const orderQuantity = rule.calculateOrderQuantity(currentStock, salesVelocity);

      // Trigger the rule
      await rule.trigger(currentStock, orderQuantity, 'Auto-triggered by scheduler');

      results.push({
        ruleId: rule._id,
        ruleName: rule.name,
        subProductId: subProduct._id,
        sku: subProduct.sku,
        currentStock,
        orderQuantity,
        triggered: true,
      });

      // TODO: If autoCreatePurchaseOrder is true, create a purchase order
      // TODO: If notifyOnTrigger is true, send notifications
    }

    // Update next check time
    const now = new Date();
    switch (rule.checkFrequency) {
      case 'realtime':
        rule.nextCheckAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
        break;
      case 'hourly':
        rule.nextCheckAt = new Date(now.getTime() + 60 * 60 * 1000);
        break;
      case 'weekly':
        rule.nextCheckAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'daily':
      default:
        rule.nextCheckAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
    rule.lastCheckedAt = now;
    await rule.save();
  }

  return results;
};

/**
 * Manually trigger a rule
 */
const triggerRule = async (ruleId, tenantId, userId, notes) => {
  const rule = await ReorderRule.findOne({
    _id: ruleId,
    tenant: tenantId,
  }).populate('subProduct', 'sku totalStock availableStock salesVelocity');

  if (!rule) {
    throw new NotFoundError('Reorder rule not found');
  }

  const subProduct = rule.subProduct;
  const currentStock = subProduct?.availableStock || subProduct?.totalStock || 0;
  const salesVelocity = subProduct?.salesVelocity || 0;
  const orderQuantity = rule.calculateOrderQuantity(currentStock, salesVelocity);

  await rule.trigger(currentStock, orderQuantity, notes || 'Manually triggered');

  console.log(`✅ Reorder rule manually triggered: ${rule.name}`);

  return {
    rule,
    currentStock,
    orderQuantity,
    triggered: true,
  };
};

/**
 * Get reorder suggestions for a tenant
 */
const getReorderSuggestions = async (tenantId) => {
  // Get all subproducts that need reordering
  const subProducts = await SubProduct.find({
    tenant: tenantId,
    status: { $nin: ['archived', 'discontinued'] },
    $expr: { $lte: ['$availableStock', '$reorderPoint'] },
  })
    .populate('product', 'name slug images')
    .sort({ availableStock: 1 })
    .limit(50)
    .lean();

  return subProducts.map((sp) => ({
    subProductId: sp._id,
    sku: sp.sku,
    product: sp.product,
    currentStock: sp.availableStock || 0,
    reorderPoint: sp.reorderPoint || 10,
    reorderQuantity: sp.reorderQuantity || 50,
    suggestedQuantity: Math.max(
      sp.reorderQuantity || 50,
      (sp.reorderPoint || 10) * 2 - (sp.availableStock || 0)
    ),
    leadTimeDays: sp.leadTimeDays || 7,
    unitCost: sp.costPrice || 0,
    estimatedCost: (sp.costPrice || 0) * (sp.reorderQuantity || 50),
    urgency: sp.availableStock <= 0 ? 'critical' : sp.availableStock <= (sp.reorderPoint || 10) / 2 ? 'high' : 'normal',
  }));
};

module.exports = {
  createRule,
  getRules,
  getRuleById,
  updateRule,
  deleteRule,
  checkRules,
  triggerRule,
  getReorderSuggestions,
};
