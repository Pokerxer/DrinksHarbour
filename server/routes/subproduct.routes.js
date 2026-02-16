// routes/subproduct.routes.js

const express = require('express');
const router = express.Router();
const subProductController = require('../controllers/subproduct.controller');
const { 
  protect,
  authorize,
  authenticate, 
  attachTenant, 
  tenantAdminOnly,
  tenantAdminOrSuperAdmin,
  superAdminOnly 
} = require('../middleware/auth.middleware');
const { 
  validateSubProductCreation,
  validateSubProductUpdate,
  validateStockBulkUpdate,
  validate 
} = require('../middleware/validation.middleware');
const { body, param } = require('express-validator');
// All SubProduct routes require authentication
router.use(authenticate);
router.use(attachTenant);

// ============================================================
// Tenant SubProduct Management
// ============================================================

/**
 * @route   GET /api/subproducts
 * @desc    Get tenant's SubProducts
 * @access  Private (Tenant admin or Super admin)
 */
router.get('/', tenantAdminOrSuperAdmin, subProductController.getMySubProducts);

/**
 * @route   POST /api/subproducts
 * @desc    Create new SubProduct (link product to tenant)
 * @access  Private (Tenant admin or Super admin)
 */
router.post(
  '/',
  tenantAdminOrSuperAdmin,
  validateSubProductCreation,
  subProductController.createSubProduct
);

/**
 * @route   GET /api/subproducts/:id
 * @desc    Get single SubProduct details
 * @access  Private (Tenant admin or Super admin)
 */
router.get('/:id', tenantAdminOrSuperAdmin, subProductController.getSubProduct);

/**
 * @route   PATCH /api/subproducts/:id
 * @desc    Update SubProduct
 * @access  Private (Tenant admin or Super admin)
 */
router.patch(
  '/:id',
  tenantAdminOrSuperAdmin,
  validateSubProductUpdate,
  subProductController.updateSubProduct
);

/**
 * @route   DELETE /api/subproducts/:id
 * @desc    Delete SubProduct
 * @access  Private (Tenant admin or Super admin)
 */
router.delete('/:id', tenantAdminOrSuperAdmin, subProductController.deleteSubProduct);

/**
 * @route   PATCH /api/subproducts/stock/bulk
 * @desc    Bulk update stock levels
 * @access  Private (Tenant admin or Super admin)
 */
router.patch(
  '/stock/bulk',
  tenantAdminOrSuperAdmin,
  validateStockBulkUpdate,
  subProductController.updateStockBulk
);




// ============================================================
// SubProduct Management Functions
// ============================================================

/**
 * Bulk create SubProducts for multiple products
 * Allows a tenant to add multiple products to their inventory at once
 */
const bulkCreateSubProducts = async (productIds, tenantId, user) => {
  // Validate inputs
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new ValidationError('Product IDs must be a non-empty array');
  }

  if (!tenantId) {
    throw new ValidationError('Tenant ID is required');
  }

  // Check tenant exists and user has permission
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    throw new NotFoundError('Tenant not found');
  }

  // Verify user is authorized (tenant admin or super admin)
  const isSuperAdmin = user.role === 'super_admin';
  const isTenantAdmin = tenant.admin?.toString() === user._id.toString();

  if (!isSuperAdmin && !isTenantAdmin) {
    throw new ForbiddenError('You do not have permission to add products to this tenant');
  }

  // Get all products
  const products = await Product.find({
    _id: { $in: productIds },
    status: 'approved',
  }).populate('brand category');

  if (products.length === 0) {
    throw new NotFoundError('No valid products found');
  }

  // Check for existing SubProducts
  const existingSubProducts = await SubProduct.find({
    product: { $in: productIds },
    tenant: tenantId,
  }).lean();

  const existingProductIds = new Set(
    existingSubProducts.map(sp => sp.product.toString())
  );

  // Filter out products that already exist for this tenant
  const newProducts = products.filter(
    p => !existingProductIds.has(p._id.toString())
  );

  if (newProducts.length === 0) {
    throw new ValidationError('All products already exist for this tenant');
  }

  const results = {
    total: productIds.length,
    created: 0,
    skipped: 0,
    failed: 0,
    subProducts: [],
    errors: [],
  };

  // Create SubProducts
  for (const product of newProducts) {
    try {
      // Generate SKU
      const sku = await generateSKU(product._id, tenantId, {
        strategy: 'hash',
        model: SubProduct,
      });

      // Create SubProduct
      const subProduct = new SubProduct({
        product: product._id,
        tenant: tenantId,
        sku,
        status: 'active',
        availability: 'out_of_stock', // Will be updated when sizes are added
        minOrderQuantity: 1,
        maxOrderQuantity: 100,
        metadata: {
          createdBy: user._id,
          lastModifiedBy: user._id,
        },
      });

      await subProduct.save();

      // Populate for response
      await subProduct.populate('product tenant');

      results.created++;
      results.subProducts.push(subProduct);
    } catch (error) {
      results.failed++;
      results.errors.push({
        productId: product._id,
        productName: product.name,
        error: error.message,
      });
    }
  }

  results.skipped = existingProductIds.size;

  return results;
};

/**
 * Duplicate a SubProduct with a new SKU
 * Creates a copy of an existing SubProduct for the same or different tenant
 */
const duplicateSubProduct = async (subProductId, tenantId) => {
  // Get original SubProduct
  const original = await SubProduct.findById(subProductId)
    .populate('product')
    .lean();

  if (!original) {
    throw new NotFoundError('SubProduct not found');
  }

  // Check if tenant is provided, otherwise use same tenant
  const targetTenantId = tenantId || original.tenant;

  // Verify tenant exists
  const tenant = await Tenant.findById(targetTenantId);
  if (!tenant) {
    throw new NotFoundError('Target tenant not found');
  }

  // Check if product already exists for this tenant
  const existing = await SubProduct.findOne({
    product: original.product._id,
    tenant: targetTenantId,
  });

  if (existing) {
    throw new ValidationError('Product already exists for this tenant');
  }

  // Generate new SKU
  const sku = await generateSKU(original.product._id, targetTenantId, {
    strategy: 'hash',
    model: SubProduct,
  });

  // Create duplicate
  const duplicate = new SubProduct({
    product: original.product._id,
    tenant: targetTenantId,
    sku,
    status: original.status,
    availability: 'out_of_stock', // Start with out of stock
    minOrderQuantity: original.minOrderQuantity,
    maxOrderQuantity: original.maxOrderQuantity,
    metadata: {
      duplicatedFrom: original._id,
      duplicatedAt: new Date(),
    },
  });

  await duplicate.save();

  // Duplicate sizes if they exist
  const sizes = await Size.find({ subProduct: subProductId }).lean();

  const duplicatedSizes = [];
  for (const size of sizes) {
    const sizeSKU = await generateSizeSKU(duplicate._id, size.value, {
      model: Size,
    });

    const newSize = new Size({
      subProduct: duplicate._id,
      value: size.value,
      unit: size.unit,
      volumeMl: size.volumeMl,
      sku: sizeSKU,
      barcode: null, // Don't copy barcode
      stock: 0, // Start with zero stock
      price: size.price,
      costPrice: size.costPrice,
      compareAtPrice: size.compareAtPrice,
      discountedPrice: null,
      availability: 'out_of_stock',
      metadata: {
        duplicatedFrom: size._id,
        duplicatedAt: new Date(),
      },
    });

    await newSize.save();
    duplicatedSizes.push(newSize);
  }

  // Update availability if sizes were added
  if (duplicatedSizes.length > 0) {
    duplicate.availability = 'out_of_stock'; // Will be updated when stock is added
    await duplicate.save();
  }

  // Populate and return
  await duplicate.populate('product tenant');

  return {
    subProduct: duplicate,
    duplicatedSizes: duplicatedSizes.length,
    message: `SubProduct duplicated successfully with ${duplicatedSizes.length} size variants`,
  };
};

/**
 * Transfer SubProduct ownership to another tenant
 * Moves a SubProduct and all its sizes to a new tenant
 */
const transferSubProduct = async (subProductId, newTenantId, user) => {
  // Get SubProduct
  const subProduct = await SubProduct.findById(subProductId)
    .populate('product tenant');

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found');
  }

  // Check user permissions
  const isSuperAdmin = user.role === 'super_admin';
  const isCurrentTenantAdmin = subProduct.tenant.admin?.toString() === user._id.toString();

  if (!isSuperAdmin && !isCurrentTenantAdmin) {
    throw new ForbiddenError('You do not have permission to transfer this product');
  }

  // Verify new tenant exists
  const newTenant = await Tenant.findById(newTenantId);
  if (!newTenant) {
    throw new NotFoundError('Target tenant not found');
  }

  // Check if product already exists for new tenant
  const existing = await SubProduct.findOne({
    product: subProduct.product._id,
    tenant: newTenantId,
  });

  if (existing) {
    throw new ValidationError('Product already exists for target tenant');
  }

  const oldTenantId = subProduct.tenant._id;

  // Generate new SKU for new tenant
  const newSKU = await generateSKU(subProduct.product._id, newTenantId, {
    strategy: 'hash',
    model: SubProduct,
  });

  // Update SubProduct
  subProduct.tenant = newTenantId;
  subProduct.sku = newSKU;
  subProduct.metadata = {
    ...subProduct.metadata,
    transferredFrom: oldTenantId,
    transferredAt: new Date(),
    transferredBy: user._id,
    lastModifiedBy: user._id,
  };

  await subProduct.save();

  // Update all associated sizes with new SKUs
  const sizes = await Size.find({ subProduct: subProductId });

  for (const size of sizes) {
    const newSizeSKU = await generateSizeSKU(subProductId, size.value, {
      model: Size,
    });

    size.sku = newSizeSKU;
    size.metadata = {
      ...size.metadata,
      transferredAt: new Date(),
    };

    await size.save();
  }

  // Populate and return
  await subProduct.populate('product tenant');

  return {
    subProduct,
    transferredSizes: sizes.length,
    oldTenant: oldTenantId,
    newTenant: newTenantId,
    message: 'SubProduct transferred successfully',
  };
};

/**
 * Archive a SubProduct
 * Soft delete - keeps data but marks as archived
 */
const archiveSubProduct = async (subProductId, tenantId) => {
  const subProduct = await SubProduct.findOne({
    _id: subProductId,
    tenant: tenantId,
  });

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found for this tenant');
  }

  if (subProduct.status === 'archived') {
    throw new ValidationError('SubProduct is already archived');
  }

  // Store previous status
  const previousStatus = subProduct.status;

  // Update status
  subProduct.status = 'archived';
  subProduct.metadata = {
    ...subProduct.metadata,
    archivedAt: new Date(),
    previousStatus,
  };

  await subProduct.save();

  // Update all sizes to archived
  await Size.updateMany(
    { subProduct: subProductId },
    {
      $set: {
        availability: 'out_of_stock',
        'metadata.archivedAt': new Date(),
      },
    }
  );

  await subProduct.populate('product tenant');

  return {
    subProduct,
    message: 'SubProduct archived successfully',
  };
};

/**
 * Restore an archived SubProduct
 * Reactivates an archived SubProduct
 */
const restoreSubProduct = async (subProductId, tenantId) => {
  const subProduct = await SubProduct.findOne({
    _id: subProductId,
    tenant: tenantId,
  });

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found for this tenant');
  }

  if (subProduct.status !== 'archived') {
    throw new ValidationError('SubProduct is not archived');
  }

  // Restore to previous status or default to active
  const restoredStatus = subProduct.metadata?.previousStatus || 'active';

  subProduct.status = restoredStatus;
  subProduct.metadata = {
    ...subProduct.metadata,
    restoredAt: new Date(),
    archivedAt: undefined,
    previousStatus: undefined,
  };

  await subProduct.save();

  // Recalculate availability based on stock
  const sizes = await Size.find({ subProduct: subProductId });

  let hasStock = false;
  let hasLowStock = false;

  for (const size of sizes) {
    if (size.stock > 0) {
      hasStock = true;
      if (size.stock <= 10) {
        hasLowStock = true;
      }
    }
  }

  // Update availability
  if (hasStock) {
    subProduct.availability = hasLowStock ? 'low_stock' : 'in_stock';
  } else {
    subProduct.availability = 'out_of_stock';
  }

  await subProduct.save();

  // Update sizes availability
  for (const size of sizes) {
    if (size.stock > 0) {
      size.availability = size.stock <= 10 ? 'low_stock' : 'in_stock';
    } else {
      size.availability = 'out_of_stock';
    }
    await size.save();
  }

  await subProduct.populate('product tenant');

  return {
    subProduct,
    message: 'SubProduct restored successfully',
  };
};

// ============================================================
// Pricing & Revenue Functions
// ============================================================

/**
 * Update SubProduct pricing
 * Updates pricing at the size level
 */
const updateSubProductPricing = async (subProductId, pricingData, tenantId) => {
  const subProduct = await SubProduct.findOne({
    _id: subProductId,
    tenant: tenantId,
  });

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found for this tenant');
  }

  const {
    sizeId,
    price,
    costPrice,
    compareAtPrice,
    discount,
  } = pricingData;

  if (!sizeId) {
    throw new ValidationError('Size ID is required');
  }

  // Get size
  const size = await Size.findOne({
    _id: sizeId,
    subProduct: subProductId,
  });

  if (!size) {
    throw new NotFoundError('Size not found for this SubProduct');
  }

  // Validate pricing
  if (price !== undefined) {
    if (price < 0) {
      throw new ValidationError('Price cannot be negative');
    }
    size.price = price;
  }

  if (costPrice !== undefined) {
    if (costPrice < 0) {
      throw new ValidationError('Cost price cannot be negative');
    }
    size.costPrice = costPrice;
  }

  if (compareAtPrice !== undefined) {
    if (compareAtPrice < 0) {
      throw new ValidationError('Compare at price cannot be negative');
    }
    size.compareAtPrice = compareAtPrice;
  }

  // Apply discount if provided
  if (discount !== undefined) {
    if (discount < 0 || discount > 100) {
      throw new ValidationError('Discount must be between 0 and 100');
    }

    if (discount > 0) {
      const discountAmount = (size.price * discount) / 100;
      size.discountedPrice = size.price - discountAmount;
      size.discount = {
        type: 'percentage',
        value: discount,
        startDate: new Date(),
        endDate: null,
      };
    } else {
      size.discountedPrice = null;
      size.discount = null;
    }
  }

  // Update metadata
  size.metadata = {
    ...size.metadata,
    lastPriceUpdate: new Date(),
  };

  await size.save();

  return {
    size,
    message: 'Pricing updated successfully',
  };
};

/**
 * Calculate effective price for a size considering tenant revenue model
 * Returns the actual price customer pays based on markup or commission
 */
const calculateEffectivePrice = async (subProductId, sizeId) => {
  const subProduct = await SubProduct.findById(subProductId).populate('tenant');

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found');
  }

  const size = await Size.findOne({
    _id: sizeId,
    subProduct: subProductId,
  });

  if (!size) {
    throw new NotFoundError('Size not found');
  }

  const tenant = subProduct.tenant;
  const basePrice = size.discountedPrice || size.price;

  let effectivePrice = basePrice;
  let breakdown = {
    basePrice,
    discountedPrice: size.discountedPrice,
    discount: size.discount,
    tenantRevenueModel: tenant.revenueModel,
  };

  // Apply tenant revenue model
  if (tenant.revenueModel === 'markup') {
    // Tenant sets their own price (markup on cost)
    // Price is already set by tenant, no calculation needed
    breakdown.markupPercentage = tenant.markupPercentage;
    breakdown.costPrice = size.costPrice;
    
    if (size.costPrice) {
      const markup = ((basePrice - size.costPrice) / size.costPrice) * 100;
      breakdown.actualMarkup = markup.toFixed(2);
    }
  } else if (tenant.revenueModel === 'commission') {
    // Platform sets price, tenant gets commission
    // Add platform commission to base price
    const commissionRate = tenant.commissionRate || 10;
    const commission = (basePrice * commissionRate) / 100;
    effectivePrice = basePrice + commission;

    breakdown.commissionRate = commissionRate;
    breakdown.commissionAmount = commission.toFixed(2);
    breakdown.platformRevenue = basePrice.toFixed(2);
    breakdown.tenantRevenue = commission.toFixed(2);
  }

  breakdown.effectivePrice = effectivePrice.toFixed(2);

  return breakdown;
};

/**
 * Apply bulk discount to multiple SubProducts
 * Applies same discount to all sizes of selected SubProducts
 */
const applyBulkDiscount = async (subProductIds, discount, tenantId) => {
  if (!Array.isArray(subProductIds) || subProductIds.length === 0) {
    throw new ValidationError('SubProduct IDs must be a non-empty array');
  }

  const { type, value, startDate, endDate } = discount;

  if (!type || !value) {
    throw new ValidationError('Discount type and value are required');
  }

  if (type !== 'percentage' && type !== 'fixed') {
    throw new ValidationError('Discount type must be percentage or fixed');
  }

  if (type === 'percentage' && (value < 0 || value > 100)) {
    throw new ValidationError('Percentage discount must be between 0 and 100');
  }

  if (type === 'fixed' && value < 0) {
    throw new ValidationError('Fixed discount cannot be negative');
  }

  // Verify all SubProducts belong to tenant
  const subProducts = await SubProduct.find({
    _id: { $in: subProductIds },
    tenant: tenantId,
  });

  if (subProducts.length !== subProductIds.length) {
    throw new ValidationError('Some SubProducts not found or do not belong to this tenant');
  }

  const results = {
    total: subProductIds.length,
    updated: 0,
    failed: 0,
    errors: [],
  };

  // Get all sizes for these SubProducts
  const sizes = await Size.find({
    subProduct: { $in: subProductIds },
  });

  for (const size of sizes) {
    try {
      let discountedPrice;

      if (type === 'percentage') {
        const discountAmount = (size.price * value) / 100;
        discountedPrice = size.price - discountAmount;
      } else {
        discountedPrice = size.price - value;
      }

      // Ensure price doesn't go negative
      if (discountedPrice < 0) {
        discountedPrice = 0;
      }

      size.discountedPrice = discountedPrice;
      size.discount = {
        type,
        value,
        startDate: startDate || new Date(),
        endDate: endDate || null,
      };

      size.metadata = {
        ...size.metadata,
        bulkDiscountAppliedAt: new Date(),
      };

      await size.save();
      results.updated++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        sizeId: size._id,
        error: error.message,
      });
    }
  }

  return {
    results,
    message: `Bulk discount applied to ${results.updated} size variants`,
  };
};

/**
 * Remove bulk discount from multiple SubProducts
 * Clears discounts from all sizes of selected SubProducts
 */
const removeBulkDiscount = async (subProductIds, tenantId) => {
  if (!Array.isArray(subProductIds) || subProductIds.length === 0) {
    throw new ValidationError('SubProduct IDs must be a non-empty array');
  }

  // Verify all SubProducts belong to tenant
  const subProducts = await SubProduct.find({
    _id: { $in: subProductIds },
    tenant: tenantId,
  });

  if (subProducts.length !== subProductIds.length) {
    throw new ValidationError('Some SubProducts not found or do not belong to this tenant');
  }

  // Update all sizes
  const result = await Size.updateMany(
    {
      subProduct: { $in: subProductIds },
    },
    {
      $set: {
        discountedPrice: null,
        discount: null,
      },
      $unset: {
        'metadata.bulkDiscountAppliedAt': '',
      },
    }
  );

  return {
    modifiedCount: result.modifiedCount,
    message: `Bulk discount removed from ${result.modifiedCount} size variants`,
  };
};

/**
 * Get SubProduct price history
 * Returns historical pricing data for a SubProduct
 */
const getSubProductPriceHistory = async (subProductId) => {
  const subProduct = await SubProduct.findById(subProductId)
    .populate('product tenant');

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found');
  }

  // Get all sizes
  const sizes = await Size.find({ subProduct: subProductId }).sort({ createdAt: 1 });

  // Get sales data for price history
  const salesData = await Sales.aggregate([
    {
      $match: {
        product: subProduct.product._id,
        tenant: subProduct.tenant._id,
      },
    },
    {
      $group: {
        _id: {
          date: {
            $dateToString: { format: '%Y-%m-%d', date: '$saleDate' },
          },
          size: '$size',
        },
        avgPrice: { $avg: '$sellingPrice' },
        minPrice: { $min: '$sellingPrice' },
        maxPrice: { $max: '$sellingPrice' },
        totalSales: { $sum: '$quantitySold' },
        totalRevenue: { $sum: { $multiply: ['$sellingPrice', '$quantitySold'] } },
      },
    },
    {
      $sort: { '_id.date': 1 },
    },
    {
      $limit: 90, // Last 90 days
    },
  ]);

  // Format current pricing
  const currentPricing = sizes.map(size => ({
    sizeId: size._id,
    size: `${size.value}${size.unit}`,
    price: size.price,
    costPrice: size.costPrice,
    compareAtPrice: size.compareAtPrice,
    discountedPrice: size.discountedPrice,
    discount: size.discount,
    lastUpdated: size.metadata?.lastPriceUpdate || size.updatedAt,
  }));

  // Format historical data
  const history = salesData.map(item => ({
    date: item._id.date,
    sizeId: item._id.size,
    avgPrice: item.avgPrice.toFixed(2),
    minPrice: item.minPrice.toFixed(2),
    maxPrice: item.maxPrice.toFixed(2),
    totalSales: item.totalSales,
    totalRevenue: item.totalRevenue.toFixed(2),
  }));

  // Calculate price trends
  let priceChange = null;
  if (history.length >= 2) {
    const recent = history[history.length - 1];
    const previous = history[history.length - 2];
    const change = ((recent.avgPrice - previous.avgPrice) / previous.avgPrice) * 100;
    
    priceChange = {
      percentage: change.toFixed(2),
      direction: change > 0 ? 'increase' : 'decrease',
      amount: (recent.avgPrice - previous.avgPrice).toFixed(2),
    };
  }

  return {
    subProduct: {
      id: subProduct._id,
      product: subProduct.product.name,
      tenant: subProduct.tenant.businessName,
    },
    currentPricing,
    history,
    priceChange,
    summary: {
      totalDataPoints: history.length,
      dateRange: history.length > 0 ? {
        from: history[0].date,
        to: history[history.length - 1].date,
      } : null,
    },
  };
};

module.exports = {
  // ... existing exports
  bulkCreateSubProducts,
  duplicateSubProduct,
  transferSubProduct,
  archiveSubProduct,
  restoreSubProduct,
  updateSubProductPricing,
  calculateEffectivePrice,
  applyBulkDiscount,
  removeBulkDiscount,
  getSubProductPriceHistory,
};

// ============================================================
// CONTROLLERS - controllers/subproduct.controller.js
// ============================================================

const subProductService = require('../services/subproduct.service');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    Bulk create SubProducts
 * @route   POST /api/subproducts/bulk
 * @access  Private (Tenant Admin, Super Admin)
 */
const bulkCreate = asyncHandler(async (req, res) => {
  const { productIds, tenantId } = req.body;

  const results = await subProductService.bulkCreateSubProducts(
    productIds,
    tenantId,
    req.user
  );

  res.status(201).json({
    success: true,
    data: results,
  });
});

/**
 * @desc    Duplicate SubProduct
 * @route   POST /api/subproducts/:id/duplicate
 * @access  Private (Tenant Admin, Super Admin)
 */
const duplicate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.body;

  const result = await subProductService.duplicateSubProduct(id, tenantId);

  res.status(201).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Transfer SubProduct to another tenant
 * @route   POST /api/subproducts/:id/transfer
 * @access  Private (Tenant Admin, Super Admin)
 */
const transfer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newTenantId } = req.body;

  const result = await subProductService.transferSubProduct(
    id,
    newTenantId,
    req.user
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Archive SubProduct
 * @route   PATCH /api/subproducts/:id/archive
 * @access  Private (Tenant Admin, Super Admin)
 */
const archive = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.body;

  const result = await subProductService.archiveSubProduct(id, tenantId);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Restore archived SubProduct
 * @route   PATCH /api/subproducts/:id/restore
 * @access  Private (Tenant Admin, Super Admin)
 */
const restore = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.body;

  const result = await subProductService.restoreSubProduct(id, tenantId);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Update SubProduct pricing
 * @route   PATCH /api/subproducts/:id/pricing
 * @access  Private (Tenant Admin, Super Admin)
 */
const updatePricing = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tenantId, ...pricingData } = req.body;

  const result = await subProductService.updateSubProductPricing(
    id,
    pricingData,
    tenantId
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Calculate effective price
 * @route   GET /api/subproducts/:id/sizes/:sizeId/effective-price
 * @access  Public
 */
const getEffectivePrice = asyncHandler(async (req, res) => {
  const { id, sizeId } = req.params;

  const breakdown = await subProductService.calculateEffectivePrice(id, sizeId);

  res.status(200).json({
    success: true,
    data: breakdown,
  });
});

/**
 * @desc    Apply bulk discount
 * @route   POST /api/subproducts/discount/apply
 * @access  Private (Tenant Admin, Super Admin)
 */
const applyDiscount = asyncHandler(async (req, res) => {
  const { subProductIds, discount, tenantId } = req.body;

  const result = await subProductService.applyBulkDiscount(
    subProductIds,
    discount,
    tenantId
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Remove bulk discount
 * @route   POST /api/subproducts/discount/remove
 * @access  Private (Tenant Admin, Super Admin)
 */
const removeDiscount = asyncHandler(async (req, res) => {
  const { subProductIds, tenantId } = req.body;

  const result = await subProductService.removeBulkDiscount(
    subProductIds,
    tenantId
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get SubProduct price history
 * @route   GET /api/subproducts/:id/price-history
 * @access  Private (Tenant Admin, Super Admin)
 */
const getPriceHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const history = await subProductService.getSubProductPriceHistory(id);

  res.status(200).json({
    success: true,
    data: history,
  });
});

module.exports = {
  // ... existing exports
  bulkCreate,
  duplicate,
  transfer,
  archive,
  restore,
  updatePricing,
  getEffectivePrice,
  applyDiscount,
  removeDiscount,
  getPriceHistory,
};

// ============================================================
// ROUTES - routes/subproduct.routes.js
// ============================================================



// ============================================================
// Validation Schemas
// ============================================================

const bulkCreateValidation = [
  body('productIds')
    .isArray({ min: 1 })
    .withMessage('Product IDs must be a non-empty array'),
  body('productIds.*')
    .isMongoId()
    .withMessage('Each product ID must be a valid MongoDB ID'),
  body('tenantId')
    .isMongoId()
    .withMessage('Tenant ID must be a valid MongoDB ID'),
];

const duplicateValidation = [
  param('id')
    .isMongoId()
    .withMessage('SubProduct ID must be a valid MongoDB ID'),
  body('tenantId')
    .optional()
    .isMongoId()
    .withMessage('Tenant ID must be a valid MongoDB ID'),
];

const transferValidation = [
  param('id')
    .isMongoId()
    .withMessage('SubProduct ID must be a valid MongoDB ID'),
  body('newTenantId')
    .isMongoId()
    .withMessage('New tenant ID must be a valid MongoDB ID'),
];

const archiveRestoreValidation = [
  param('id')
    .isMongoId()
    .withMessage('SubProduct ID must be a valid MongoDB ID'),
  body('tenantId')
    .isMongoId()
    .withMessage('Tenant ID must be a valid MongoDB ID'),
];

const updatePricingValidation = [
  param('id')
    .isMongoId()
    .withMessage('SubProduct ID must be a valid MongoDB ID'),
  body('tenantId')
    .isMongoId()
    .withMessage('Tenant ID must be a valid MongoDB ID'),
  body('sizeId')
    .isMongoId()
    .withMessage('Size ID must be a valid MongoDB ID'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('costPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cost price must be a positive number'),
  body('compareAtPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Compare at price must be a positive number'),
  body('discount')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount must be between 0 and 100'),
];

const effectivePriceValidation = [
  param('id')
    .isMongoId()
    .withMessage('SubProduct ID must be a valid MongoDB ID'),
  param('sizeId')
    .isMongoId()
    .withMessage('Size ID must be a valid MongoDB ID'),
];

const bulkDiscountValidation = [
  body('subProductIds')
    .isArray({ min: 1 })
    .withMessage('SubProduct IDs must be a non-empty array'),
  body('subProductIds.*')
    .isMongoId()
    .withMessage('Each SubProduct ID must be a valid MongoDB ID'),
  body('tenantId')
    .isMongoId()
    .withMessage('Tenant ID must be a valid MongoDB ID'),
  body('discount.type')
    .isIn(['percentage', 'fixed'])
    .withMessage('Discount type must be percentage or fixed'),
  body('discount.value')
    .isFloat({ min: 0 })
    .withMessage('Discount value must be a positive number'),
  body('discount.startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  body('discount.endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
];

const removeDiscountValidation = [
  body('subProductIds')
    .isArray({ min: 1 })
    .withMessage('SubProduct IDs must be a non-empty array'),
  body('subProductIds.*')
    .isMongoId()
    .withMessage('Each SubProduct ID must be a valid MongoDB ID'),
  body('tenantId')
    .isMongoId()
    .withMessage('Tenant ID must be a valid MongoDB ID'),
];

// ============================================================
// Routes
// ============================================================

// Bulk operations
router.post(
  '/bulk',
  protect,
  authorize('tenant_admin', 'super_admin'),
  bulkCreateValidation,
  validate,
  subProductController.bulkCreate
);

// Duplicate
router.post(
  '/:id/duplicate',
  protect,
  authorize('tenant_admin', 'super_admin'),
  duplicateValidation,
  validate,
  subProductController.duplicate
);

// Transfer
router.post(
  '/:id/transfer',
  protect,
  authorize('tenant_admin', 'super_admin'),
  transferValidation,
  validate,
  subProductController.transfer
);

// Archive
router.patch(
  '/:id/archive',
  protect,
  authorize('tenant_admin', 'super_admin'),
  archiveRestoreValidation,
  validate,
  subProductController.archive
);

// Restore
router.patch(
  '/:id/restore',
  protect,
  authorize('tenant_admin', 'super_admin'),
  archiveRestoreValidation,
  validate,
  subProductController.restore
);

// Pricing
router.patch(
  '/:id/pricing',
  protect,
  authorize('tenant_admin', 'super_admin'),
  updatePricingValidation,
  validate,
  subProductController.updatePricing
);

// Effective price (public)
router.get(
  '/:id/sizes/:sizeId/effective-price',
  effectivePriceValidation,
  validate,
  subProductController.getEffectivePrice
);

// Bulk discount
router.post(
  '/discount/apply',
  protect,
  authorize('tenant_admin', 'super_admin'),
  bulkDiscountValidation,
  validate,
  subProductController.applyDiscount
);

router.post(
  '/discount/remove',
  protect,
  authorize('tenant_admin', 'super_admin'),
  removeDiscountValidation,
  validate,
  subProductController.removeDiscount
);

// Price history
router.get(
  '/:id/price-history',
  protect,
  authorize('tenant_admin', 'super_admin'),
  param('id').isMongoId(),
  validate,
  subProductController.getPriceHistory
);

// ============================================================
// SubProduct Management Routes
// ============================================================

/**
 * @route   POST /api/subproducts/bulk
 * @desc    Bulk create SubProducts for multiple products
 * @access  Private (Tenant Admin, Super Admin)
 */
router.post(
  '/bulk',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.bulkCreate
);

/**
 * @route   POST /api/subproducts/:id/duplicate
 * @desc    Duplicate a SubProduct with new SKU
 * @access  Private (Tenant Admin, Super Admin)
 */
router.post(
  '/:id/duplicate',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.duplicate
);

/**
 * @route   POST /api/subproducts/:id/transfer
 * @desc    Transfer SubProduct ownership to another tenant
 * @access  Private (Tenant Admin, Super Admin)
 */
router.post(
  '/:id/transfer',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.transfer
);

/**
 * @route   PATCH /api/subproducts/:id/archive
 * @desc    Archive a SubProduct (soft delete)
 * @access  Private (Tenant Admin, Super Admin)
 */
router.patch(
  '/:id/archive',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.archive
);

/**
 * @route   PATCH /api/subproducts/:id/restore
 * @desc    Restore an archived SubProduct
 * @access  Private (Tenant Admin, Super Admin)
 */
router.patch(
  '/:id/restore',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.restore
);

// ============================================================
// Pricing & Revenue Routes
// ============================================================

/**
 * @route   PATCH /api/subproducts/:id/pricing
 * @desc    Update SubProduct pricing at size level
 * @access  Private (Tenant Admin, Super Admin)
 */
router.patch(
  '/:id/pricing',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.updatePricing
);

/**
 * @route   GET /api/subproducts/:id/sizes/:sizeId/effective-price
 * @desc    Calculate effective price considering tenant revenue model
 * @access  Public
 */
router.get(
  '/:id/sizes/:sizeId/effective-price',
  subProductController.getEffectivePrice
);

/**
 * @route   POST /api/subproducts/discount/apply
 * @desc    Apply bulk discount to multiple SubProducts
 * @access  Private (Tenant Admin, Super Admin)
 */
router.post(
  '/discount/apply',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.applyDiscount
);

/**
 * @route   POST /api/subproducts/discount/remove
 * @desc    Remove bulk discount from multiple SubProducts
 * @access  Private (Tenant Admin, Super Admin)
 */
router.post(
  '/discount/remove',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.removeDiscount
);

/**
 * @route   GET /api/subproducts/:id/price-history
 * @desc    Get SubProduct price history with trends
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/:id/price-history',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.getPriceHistory
);

// ============================================================
// Existing Routes (from your file)
// ============================================================

/**
 * @route   POST /api/subproducts
 * @desc    Create a new SubProduct
 * @access  Private (Tenant Admin, Super Admin)
 */
router.post(
  '/',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.createSubProduct
);

/**
 * @route   GET /api/subproducts
 * @desc    Get all SubProducts with filters
 * @access  Public
 */
router.get(
  '/',
  subProductController.getAllSubProducts
);

/**
 * @route   GET /api/subproducts/tenant/:tenantId
 * @desc    Get SubProducts by tenant
 * @access  Public
 */
router.get(
  '/tenant/:tenantId',
  subProductController.getSubProductsByTenant
);

/**
 * @route   GET /api/subproducts/product/:productId
 * @desc    Get SubProducts by product
 * @access  Public
 */
router.get(
  '/product/:productId',
  subProductController.getSubProductsByProduct
);

/**
 * @route   GET /api/subproducts/:id
 * @desc    Get SubProduct by ID
 * @access  Public
 */
router.get(
  '/:id',
  subProductController.getSubProductById
);

/**
 * @route   GET /api/subproducts/sku/:sku
 * @desc    Get SubProduct by SKU
 * @access  Public
 */
router.get(
  '/sku/:sku',
  subProductController.getSubProductBySKU
);

/**
 * @route   PATCH /api/subproducts/:id
 * @desc    Update SubProduct
 * @access  Private (Tenant Admin, Super Admin)
 */
router.patch(
  '/:id',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.updateSubProduct
);

/**
 * @route   DELETE /api/subproducts/:id
 * @desc    Delete SubProduct
 * @access  Private (Tenant Admin, Super Admin)
 */
router.delete(
  '/:id',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.deleteSubProduct
);

/**
 * @route   POST /api/subproducts/:id/sizes
 * @desc    Add size to SubProduct
 * @access  Private (Tenant Admin, Super Admin)
 */
router.post(
  '/:id/sizes',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.addSize
);

/**
 * @route   PATCH /api/subproducts/:id/sizes/:sizeId
 * @desc    Update size
 * @access  Private (Tenant Admin, Super Admin)
 */
router.patch(
  '/:id/sizes/:sizeId',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.updateSize
);

/**
 * @route   DELETE /api/subproducts/:id/sizes/:sizeId
 * @desc    Delete size
 * @access  Private (Tenant Admin, Super Admin)
 */
router.delete(
  '/:id/sizes/:sizeId',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.deleteSize
);

/**
 * @route   PATCH /api/subproducts/:id/stock
 * @desc    Update stock for SubProduct
 * @access  Private (Tenant Admin, Super Admin)
 */
router.patch(
  '/:id/stock',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.updateStock
);

/**
 * @route   GET /api/subproducts/:id/stock-status
 * @desc    Get stock status for SubProduct
 * @access  Public
 */
router.get(
  '/:id/stock-status',
  subProductController.getStockStatus
);

// ============================================================
// Inventory Management Routes
// ============================================================

/**
 * @route   GET /api/subproducts/:id/inventory
 * @desc    Get comprehensive inventory for SubProduct
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/:id/inventory',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.getInventory
);

/**
 * @route   POST /api/subproducts/:id/sizes/:sizeId/adjust-stock
 * @desc    Adjust stock for a specific size
 * @access  Private (Tenant Admin, Super Admin)
 */
router.post(
  '/:id/sizes/:sizeId/adjust-stock',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.adjustStock
);

/**
 * @route   GET /api/subproducts/:id/stock-movements
 * @desc    Get stock movement history
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/:id/stock-movements',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.getStockMovements
);

/**
 * @route   GET /api/subproducts/tenant/:tenantId/low-stock
 * @desc    Get SubProducts with low stock
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/tenant/:tenantId/low-stock',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.getLowStock
);

/**
 * @route   GET /api/subproducts/tenant/:tenantId/out-of-stock
 * @desc    Get SubProducts that are out of stock
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/tenant/:tenantId/out-of-stock',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.getOutOfStock
);

/**
 * @route   POST /api/subproducts/:id/reorder-points
 * @desc    Set reorder points for SubProduct sizes
 * @access  Private (Tenant Admin, Super Admin)
 */
router.post(
  '/:id/reorder-points',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.setReorderPoints
);

// ============================================================
// Sales & Analytics Routes
// ============================================================

/**
 * @route   GET /api/subproducts/:id/sales
 * @desc    Get sales data for SubProduct
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/:id/sales',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.getSales
);

/**
 * @route   GET /api/subproducts/:id/revenue
 * @desc    Get revenue data with profit breakdown
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/:id/revenue',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.getRevenue
);

/**
 * @route   GET /api/subproducts/tenant/:tenantId/top-selling
 * @desc    Get top selling SubProducts for tenant
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/tenant/:tenantId/top-selling',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.getTopSelling
);

/**
 * @route   GET /api/subproducts/:id/conversion-rate
 * @desc    Get conversion rate metrics
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/:id/conversion-rate',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.getConversionRate
);

/**
 * @route   GET /api/subproducts/:id/average-order-value
 * @desc    Get average order value metrics
 * @access  Private (Tenant Admin, Super Admin)
 */
router.get(
  '/:id/average-order-value',
  protect,
  authorize('tenant_admin', 'super_admin'),
  subProductController.getAverageOrderValue
);

module.exports = router;