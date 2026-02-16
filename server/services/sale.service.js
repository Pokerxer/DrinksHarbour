// services/sale.service.js

const Sale = require('../models/Sale');
const SubProduct = require('../models/SubProduct');
const { ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Create a new sale
 */
const createSale = async (saleData) => {
  const { name, type, discountValue, startDate, endDate, products, categories } = saleData;

  // Validate dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (end <= start) {
    throw new ValidationError('End date must be after start date');
  }

  const sale = new Sale({
    ...saleData,
    currentUsageCount: 0,
  });

  await sale.save();

  // Apply sale to products if specified
  if (products && products.length > 0) {
    await applySaleToProducts(sale._id, products);
  }

  return sale;
};

/**
 * Get all sales with filters
 */
const getAllSales = async (query = {}) => {
  const { page = 1, limit = 20, status, type, search, tenant } = query;

  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (type) {
    filter.type = type;
  }

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  if (tenant) {
    filter.$or = [
      { tenant },
      { isGlobal: true },
    ];
  }

  const sales = await Sale.find(filter)
    .populate('products', 'name slug images')
    .populate('categories', 'name slug icon')
    .populate('createdBy', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Sale.countDocuments(filter);

  return {
    sales,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get sale by ID
 */
const getSaleById = async (id) => {
  const sale = await Sale.findById(id)
    .populate('products', 'name slug images baseSellingPrice')
    .populate('categories', 'name slug')
    .populate('subproducts')
    .populate('excludedProducts', 'name slug')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email');

  if (!sale) {
    throw new NotFoundError('Sale not found');
  }

  return sale;
};

/**
 * Update sale
 */
const updateSale = async (id, updateData, userId) => {
  const sale = await Sale.findById(id);

  if (!sale) {
    throw new NotFoundError('Sale not found');
  }

  // Validate dates if both are being updated
  if (updateData.startDate && updateData.endDate) {
    const start = new Date(updateData.startDate);
    const end = new Date(updateData.endDate);
    if (end <= start) {
      throw new ValidationError('End date must be after start date');
    }
  }

  Object.assign(sale, updateData);
  sale.updatedBy = userId;
  await sale.save();

  // Re-apply sale to products if products list changed
  if (updateData.products) {
    await applySaleToProducts(sale._id, updateData.products);
  }

  return sale;
};

/**
 * Delete sale
 */
const deleteSale = async (id) => {
  const sale = await Sale.findById(id);

  if (!sale) {
    throw new NotFoundError('Sale not found');
  }

  // Remove sale from products
  await removeSaleFromProducts(id);

  await sale.deleteOne();

  return { message: 'Sale deleted successfully' };
};

/**
 * Toggle sale status
 */
const toggleSaleStatus = async (id) => {
  const sale = await Sale.findById(id);

  if (!sale) {
    throw new NotFoundError('Sale not found');
  }

  sale.isActive = !sale.isActive;
  await sale.save();

  if (!sale.isActive) {
    await removeSaleFromProducts(id);
  } else {
    await applySaleToProducts(id, sale.products);
  }

  return sale;
};

/**
 * Get active sales for display
 */
const getActiveSales = async (options = {}) => {
  const { limit = 10, type, tenant } = options;
  const now = new Date();

  const query = {
    isActive: true,
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now },
    'displaySettings.showOnHomepage': true,
  };

  if (tenant) {
    query.$or = [
      { tenant },
      { isGlobal: true },
    ];
  }

  if (type) {
    query.type = type;
  }

  const sales = await Sale.find(query)
    .sort({ 'displaySettings.homepagePosition': 1, startDate: -1 })
    .limit(limit)
    .select('name description type discountType discountValue bannerImage startDate endDate displaySettings');

  return sales;
};

/**
 * Get sale by product
 */
const getSaleByProduct = async (productId) => {
  const now = new Date();

  const sale = await Sale.findOne({
    products: productId,
    isActive: true,
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now },
  });

  return sale;
};

/**
 * Apply sale to products
 */
const applySaleToProducts = async (saleId, productIds) => {
  const sale = await Sale.findById(saleId);
  
  if (!sale) {
    throw new NotFoundError('Sale not found');
  }

  // Calculate sale price based on discount type
  const calculateSalePrice = (basePrice) => {
    switch (sale.discountType) {
      case 'percentage':
        return basePrice * (1 - sale.discountValue / 100);
      case 'fixed':
        return Math.max(0, basePrice - sale.discountValue);
      case 'bogo':
        return basePrice; // Handle differently
      default:
        return basePrice;
    }
  };

  // Update all subproducts of included products
  await SubProduct.updateMany(
    { product: { $in: productIds } },
    {
      $set: {
        salePrice: calculateSalePrice(this.baseSellingPrice),
        saleStartDate: sale.startDate,
        saleEndDate: sale.endDate,
        saleType: sale.type,
        saleDiscountValue: sale.discountValue,
        isOnSale: true,
        saleBanner: sale.bannerImage,
      }
    }
  );

  return { message: `Sale applied to ${productIds.length} products` };
};

/**
 * Remove sale from products
 */
const removeSaleFromProducts = async (saleId) => {
  await SubProduct.updateMany(
    { saleStartDate: saleId }, // This won't work directly, need different approach
    {
      $set: {
        salePrice: null,
        saleStartDate: null,
        saleEndDate: null,
        saleType: null,
        saleDiscountValue: null,
        isOnSale: false,
        saleBanner: null,
      }
    }
  );

  return { message: 'Sale removed from products' };
};

/**
 * Increment sale view count
 */
const incrementViewCount = async (saleId) => {
  await Sale.findByIdAndUpdate(saleId, {
    $inc: { viewCount: 1 },
  });
};

/**
 * Increment sale conversion
 */
const incrementConversion = async (saleId, revenue = 0) => {
  await Sale.findByIdAndUpdate(saleId, {
    $inc: { conversionCount: 1, totalRevenue: revenue },
  });
};

/**
 * End sale manually
 */
const endSale = async (id) => {
  const sale = await Sale.findById(id);

  if (!sale) {
    throw new NotFoundError('Sale not found');
  }

  sale.status = 'ended';
  sale.isActive = false;
  await sale.save();

  // Remove sale from products
  await removeSaleFromProducts(id);

  return sale;
};

module.exports = {
  createSale,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
  toggleSaleStatus,
  getActiveSales,
  getSaleByProduct,
  applySaleToProducts,
  removeSaleFromProducts,
  incrementViewCount,
  incrementConversion,
  endSale,
};
