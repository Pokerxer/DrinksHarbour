// controllers/product.controller.js

const asyncHandler = require('../utils/asyncHandler');
const productService = require('../services/product.service');
const { ForbiddenError, ValidationError } = require('../utils/errors');
const cartService = require('../services/cart.service');
const wishlistService = require('../services/wishlist.service');
const Review = require('../models/Review');
const Order  = require('../models/Order');
const cloudinaryService = require('../services/cloudinary.service');
const { logPrivilegedAction } = require('../utils/auditLog');

/**
 * @desc    Create a new product (central catalog)
 * @route   POST /api/products
 * @access  Super-admin OR Approved Tenant
 */
const createProduct = asyncHandler(async (req, res) => {
  const user = req.user;
  const tenant = req.tenant; // Attached by tenant middleware if subdomain/header present

  // Authorization check — super_admin/admin have all tenant_owner privileges
  const isSuperAdmin = ['super_admin', 'admin'].includes(user.role);
  const isApprovedTenant =
    tenant &&
    tenant.status === 'approved' &&
    ['active', 'trialing'].includes(tenant.subscriptionStatus) &&
    ['tenant_owner', 'tenant_admin'].includes(user.role);

  if (!isSuperAdmin && !isApprovedTenant) {
    throw new ForbiddenError(
      'Only super-admins or approved tenants can create products'
    );
  }

  // Call service layer
  const result = await productService.createProduct(req.body, user, tenant);

  // Response varies based on submission source
  const response = {
    success: true,
    message: result.product.status === 'approved' 
      ? 'Product created and published successfully'
      : 'Product created successfully – pending approval',
    data: {
      product: {
        _id: result.product._id,
        name: result.product.name,
        slug: result.product.slug,
        type: result.product.type,
        status: result.product.status,
        submissionSource: result.product.submissionSource,
        submittingTenant: result.product.submittingTenant,
        brand: result.product.brand,
        category: result.product.category,
        images: result.product.images,
        createdAt: result.product.createdAt,
      }
    }
  };

  // Include SubProduct data if tenant submission
  if (result.subProduct) {
    response.data.subProduct = {
      _id: result.subProduct._id,
      sku: result.subProduct.sku,
      status: result.subProduct.status,
      baseSellingPrice: result.subProduct.baseSellingPrice,
      currency: result.subProduct.currency,
      sizesCreated: result.subProduct.sizes?.length || 0,
    };
  }

  res.status(201).json(response);
});


/**
 * @desc    Update product
 * @route   PATCH /api/products/:id
 * @access  Private (Super-admin or product owner)
 */
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const tenant = req.tenant;

  const product = await productService.updateProduct(id, req.body, user, tenant);

  res.status(200).json({
    success: true,
    message: 'Product updated successfully',
    data: { product },
  });
});

/**
 * @desc    Delete product (soft delete)
 * @route   DELETE /api/products/:id
 * @access  Private (Super-admin only)
 */
const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  await productService.deleteProduct(id, user);

  res.status(200).json({
    success: true,
    message: 'Product deleted successfully',
  });
});


/**
 * @desc    Approve pending product
 * @route   PATCH /api/products/:id/approve
 * @access  Private (Super-admin only)
 */
const approveProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  const product = await productService.approveProduct(id, user);

  // Audit: super-admin approval of a pending product
  logPrivilegedAction(req, 'PRODUCT_APPROVE', 'approve', {
    targetType: 'Product',
    targetId: id,
    changes: { before: { status: 'pending' }, after: { status: 'approved' } },
  });

  res.status(200).json({
    success: true,
    message: 'Product approved successfully',
    data: { product },
  });
});

/**
 * @desc    Reject pending product
 * @route   PATCH /api/products/:id/reject
 * @access  Private (Super-admin only)
 */
const rejectProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const user = req.user;

  const product = await productService.rejectProduct(id, reason, user);

  // Audit: super-admin rejection of a pending product
  logPrivilegedAction(req, 'PRODUCT_REJECT', 'reject', {
    targetType: 'Product',
    targetId: id,
    justification: reason,
    changes: { before: { status: 'pending' }, after: { status: 'rejected', rejectedReason: reason } },
  });

  res.status(200).json({
    success: true,
    message: 'Product rejected',
    data: { product },
  });
});

/**
 * @desc    Bulk update products
 * @route   PATCH /api/products/bulk
 * @access  Private (Super-admin)
 */
const bulkUpdateProducts = asyncHandler(async (req, res) => {
  const { updates } = req.body;
  const user = req.user;

  const result = await productService.bulkUpdateProducts(updates, user);

  res.status(200).json({
    success: true,
    message: `Bulk update completed: ${result.success} succeeded, ${result.failed} failed`,
    data: result,
  });
});

/**
 * @desc    Duplicate product
 * @route   POST /api/products/:id/duplicate
 * @access  Private (Super-admin)
 */
const duplicateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  const product = await productService.duplicateProduct(id, user);

  res.status(201).json({
    success: true,
    message: 'Product duplicated successfully',
    data: { product },
  });
});

/**
 * @desc    Archive product
 * @route   PATCH /api/products/:id/archive
 * @access  Private (Super-admin)
 */
const archiveProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  const product = await productService.archiveProduct(id, user);

  res.status(200).json({
    success: true,
    message: 'Product archived successfully',
    data: { product },
  });
});

/**
 * @desc    Restore archived product
 * @route   PATCH /api/products/:id/restore
 * @access  Private (Super-admin)
 */
const restoreProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  const product = await productService.restoreProduct(id, user);

  res.status(200).json({
    success: true,
    message: 'Product restored successfully',
    data: { product },
  });
});

/**
 * @desc    Upload product images
 * @route   POST /api/products/:id/images
 * @access  Private
 */
const uploadProductImages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const files = req.files;
  const user = req.user;

  const images = await productService.uploadProductImages(id, files, user);

  res.status(200).json({
    success: true,
    message: 'Images uploaded successfully',
    data: { images },
  });
});

/**
 * @desc    Delete product image
 * @route   DELETE /api/products/:id/images/:publicId
 * @access  Private
 */
const deleteProductImage = asyncHandler(async (req, res) => {
  const { id, publicId } = req.params;
  const user = req.user;

  const images = await productService.deleteProductImage(id, publicId, user);

  res.status(200).json({
    success: true,
    message: 'Image deleted successfully',
    data: { images },
  });
});

/**
 * @desc    Reorder product images
 * @route   PATCH /api/products/:id/images/reorder
 * @access  Private
 */
const reorderProductImages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { imageOrder } = req.body;
  const user = req.user;

  const images = await productService.reorderProductImages(id, imageOrder, user);

  res.status(200).json({
    success: true,
    message: 'Images reordered successfully',
    data: { images },
  });
});

/**
 * @desc    Set primary product image
 * @route   PATCH /api/products/:id/images/:publicId/primary
 * @access  Private
 */
const setProductPrimaryImage = asyncHandler(async (req, res) => {
  const { id, publicId } = req.params;
  const user = req.user;

  const images = await productService.setProductPrimaryImage(id, publicId, user);

  res.status(200).json({
    success: true,
    message: 'Primary image updated successfully',
    data: { images },
  });
});

/**
 * @desc    Get pending products
 * @route   GET /api/products/pending
 * @access  Private (Super-admin)
 */
const getPendingProducts = asyncHandler(async (req, res) => {
  const filters = {
    submittingTenant: req.query.tenant,
    brand: req.query.brand,
    category: req.query.category,
    type: req.query.type,
    search: req.query.search,
  };

  const pagination = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
    sort: req.query.sort || 'createdAt',
    order: req.query.order || 'desc',
  };

  const result = await productService.getPendingProducts(filters, pagination);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get rejected products
 * @route   GET /api/products/rejected
 * @access  Private (Super-admin)
 */
const getRejectedProducts = asyncHandler(async (req, res) => {
  const filters = {
    submittingTenant: req.query.tenant,
    brand: req.query.brand,
    category: req.query.category,
    type: req.query.type,
    search: req.query.search,
  };

  const pagination = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
    sort: req.query.sort || 'updatedAt',
    order: req.query.order || 'desc',
  };

  const result = await productService.getRejectedProducts(filters, pagination);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get product submission statistics
 * @route   GET /api/products/stats/submissions
 * @access  Private (Super-admin)
 */
const getProductSubmissionStats = asyncHandler(async (req, res) => {
  const stats = await productService.getProductSubmissionStats();

  res.status(200).json({
    success: true,
    data: stats,
  });
});

/**
 * @desc    Bulk approve products
 * @route   POST /api/products/bulk/approve
 * @access  Private (Super-admin)
 */
const bulkApproveProducts = asyncHandler(async (req, res) => {
  const { productIds } = req.body;
  const user = req.user;

  const result = await productService.bulkApproveProducts(productIds, user);

  res.status(200).json({
    success: true,
    message: `Bulk approval completed: ${result.success} succeeded, ${result.failed} failed`,
    data: result,
  });
});

/**
 * @desc    Bulk reject products
 * @route   POST /api/products/bulk/reject
 * @access  Private (Super-admin)
 */
const bulkRejectProducts = asyncHandler(async (req, res) => {
  const { productIds, reason } = req.body;
  const user = req.user;

  const result = await productService.bulkRejectProducts(productIds, reason, user);

  res.status(200).json({
    success: true,
    message: `Bulk rejection completed: ${result.success} succeeded, ${result.failed} failed`,
    data: result,
  });
});

/**
 * @desc    Get product analytics
 * @route   GET /api/products/:id/analytics
 * @access  Private
 */
const getProductAnalytics = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const analytics = await productService.getProductAnalytics(id);

  res.status(200).json({
    success: true,
    data: analytics,
  });
});

/**
 * @desc    Get product performance
 * @route   GET /api/products/:id/performance
 * @access  Private
 */
const getProductPerformance = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  const performance = await productService.getProductPerformance(id, {
    startDate,
    endDate,
  });

  res.status(200).json({
    success: true,
    data: performance,
  });
});

/**
 * @desc    Get product competitors
 * @route   GET /api/products/:id/competitors
 * @access  Public
 */
const getProductCompetitors = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const competitors = await productService.getProductCompetitors(id);

  res.status(200).json({
    success: true,
    data: competitors,
  });
});

/**
 * @desc    Get product recommendations
 * @route   GET /api/products/:id/recommendations
 * @access  Public
 */
const getProductRecommendations = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit) || 10;

  const recommendations = await productService.getProductRecommendations(id, limit);

  res.status(200).json({
    success: true,
    data: recommendations,
  });
});

/**
 * @desc    Get product by barcode
 * @route   GET /api/products/barcode/:barcode
 * @access  Public
 */
const getProductByBarcode = asyncHandler(async (req, res) => {
  const { barcode } = req.params;

  if (!barcode || barcode.trim().length === 0) {
    throw new ValidationError('Barcode is required');
  }

  const product = await productService.getProductByBarcode(barcode);

  res.status(200).json({
    success: true,
    data: { product },
  });
});

/**
 * @desc    Import products from CSV/JSON
 * @route   POST /api/products/import
 * @access  Private (Super-admin only)
 */
const importProducts = asyncHandler(async (req, res) => {
  const user = req.user;
  const file = req.file;

  if (!file) {
    throw new ValidationError('Import file is required');
  }

  const result = await productService.importProducts(file, user);

  res.status(200).json({
    success: true,
    message: `Import completed: ${result.success} succeeded, ${result.failed} failed`,
    data: result,
  });
});

/**
 * @desc    Export tenant products to CSV
 * @route   GET /api/products/export/tenant
 * @access  Private (Tenant admin)
 */
const exportTenantProducts = asyncHandler(async (req, res) => {
  const tenant = req.tenant;
  const { format = 'csv' } = req.query;

  if (!tenant) {
    throw new ValidationError('Tenant context required');
  }

  const result = await productService.exportTenantProducts(tenant._id, format);

  // Set download headers
  res.setHeader('Content-Type', result.contentType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${result.filename}"`
  );

  res.send(result.data);
});

/**
 * @desc    Export all products (super-admin)
 * @route   GET /api/products/export/all
 * @access  Private (Super-admin only)
 */
const exportAllProducts = asyncHandler(async (req, res) => {
  const { format = 'csv', status } = req.query;

  const result = await productService.exportAllProducts(format, status);

  res.setHeader('Content-Type', result.contentType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${result.filename}"`
  );

  res.send(result.data);
});


// ============================================================
// SEARCH & DISCOVERY CONTROLLERS
// ============================================================

/**
 * @desc    Search products
 * @route   GET /api/products/search
 * @access  Public
 */
const searchProducts = asyncHandler(async (req, res) => {
  const { q: query } = req.query;

  // Check if user is super_admin to include pending products
  const isSuperAdmin = req.user?.role === 'super_admin';

  // Get status from query - if empty string, include all statuses
  const statusParam = req.query.status;
  
  const searchParams = {
    query,
    category: req.query.category ? req.query.category.split(',') : undefined,
    subCategory: req.query.subCategory ? req.query.subCategory.split(',') : undefined,
    brand: req.query.brand ? req.query.brand.split(',') : undefined,
    tags: req.query.tags ? req.query.tags.split(',') : undefined,
    flavors: req.query.flavors ? req.query.flavors.split(',') : undefined,
    type: req.query.type ? req.query.type.split(',') : undefined,
    minPrice: req.query.minPrice,
    maxPrice: req.query.maxPrice,
    minAbv: req.query.minAbv,
    maxAbv: req.query.maxAbv,
    isAlcoholic: req.query.isAlcoholic,
    originCountry: req.query.country,
    inStock: req.query.inStock === 'true',
    tenantId: req.query.tenant,
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
    sort: req.query.sort || 'relevance',
    order: req.query.order || 'desc',
    includePending: isSuperAdmin,
    status: statusParam === '' ? undefined : (statusParam || 'approved'),
    // Sale / discount filters
    onSale: req.query.onSale === 'true' ? true : undefined,
    saleType: req.query.saleType || undefined,
    minRating: req.query.minRating ? parseFloat(req.query.minRating) : undefined,
  };

  const result = await productService.searchProducts(searchParams);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get category details by slug
 * @route   GET /api/categories/slug/:slug
 * @access  Public
 */
const getCategoryBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  
  const Category = require('../models/Category');
  const SubCategory = require('../models/SubCategory');
  
  // First try to find in Category collection
  let category = await Category.findOne({ slug, status: 'published' }).lean();
  
  if (!category) {
    // Try SubCategory collection
    category = await SubCategory.findOne({ slug, status: 'published' }).lean();
    
    if (category) {
      // Fetch parent category info
      if (category.parent) {
        const parentCategory = await Category.findById(category.parent).lean();
        category.parentCategory = parentCategory;
      }
      category.type = 'subcategory';
    }
  } else {
    category.type = 'category';
  }
  
  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Category not found',
    });
  }
  
  // Get subcategories if it's a main category
  if (category.type === 'category' && category.subCategories?.length > 0) {
    const subCategories = await SubCategory.find({
      _id: { $in: category.subCategories },
      status: 'published'
    }).select('name slug icon color tagline description').lean();
    category.subcategories = subCategories;
  }
  
  // Increment view count
  await Category.findByIdAndUpdate(category._id, { $inc: { viewCount: 1 } });
  
  res.status(200).json({
    success: true,
    data: category,
  });
});

/**
 * @desc    Get products by category
 * @route   GET /api/products/category/:categoryId
 * @access  Public
 */
const getProductsByCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;

  const filters = {
    brand: req.query.brand,
    type: req.query.type,
    minPrice: req.query.minPrice,
    maxPrice: req.query.maxPrice,
    inStock: req.query.inStock === 'true',
  };

  const pagination = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
    sort: req.query.sort || 'popularity',
    order: req.query.order || 'desc',
  };

  const result = await productService.getProductsByCategory(
    categoryId,
    filters,
    pagination
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get products by brand
 * @route   GET /api/products/brand/:brandId
 * @access  Public
 */
const getProductsByBrand = asyncHandler(async (req, res) => {
  const { brandId } = req.params;

  const filters = {
    category: req.query.category,
    type: req.query.type,
    minPrice: req.query.minPrice,
    maxPrice: req.query.maxPrice,
    inStock: req.query.inStock === 'true',
  };

  const pagination = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
    sort: req.query.sort || 'popularity',
    order: req.query.order || 'desc',
  };

  const result = await productService.getProductsByBrand(
    brandId,
    filters,
    pagination
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get products by tags
 * @route   GET /api/products/tags
 * @access  Public
 */
const getProductsByTags = asyncHandler(async (req, res) => {
  const { tags } = req.query;

  if (!tags) {
    throw new ValidationError('Tags parameter is required');
  }

  const tagIds = tags.split(',');

  const pagination = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
    sort: req.query.sort || 'popularity',
    order: req.query.order || 'desc',
  };

  const result = await productService.getProductsByTags(tagIds, {}, pagination);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get products by flavors
 * @route   GET /api/products/flavors
 * @access  Public
 */
const getProductsByFlavors = asyncHandler(async (req, res) => {
  const { flavors } = req.query;

  if (!flavors) {
    throw new ValidationError('Flavors parameter is required');
  }

  const flavorIds = flavors.split(',');

  const pagination = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
    sort: req.query.sort || 'popularity',
    order: req.query.order || 'desc',
  };

  const result = await productService.getProductsByFlavors(flavorIds, {}, pagination);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get trending products
 * @route   GET /api/products/trending
 * @access  Public
 */
const getTrendingProducts = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const days = parseInt(req.query.days) || 7;

  const products = await productService.getTrendingProducts(limit, days);

  res.status(200).json({
    success: true,
    data: { products },
  });
});

/**
 * @desc    Get seasonal products
 * @route   GET /api/products/seasonal/:season
 * @access  Public
 */
const getSeasonalProducts = asyncHandler(async (req, res) => {
  const { season } = req.params;
  const limit = parseInt(req.query.limit) || 20;

  const products = await productService.getSeasonalProducts(season, limit);

  res.status(200).json({
    success: true,
    data: { products, season },
  });
});

// ============================================================
// INVENTORY CONTROLLERS
// ============================================================

/**
 * @desc    Get product stock status
 * @route   GET /api/products/:id/stock
 * @access  Public
 */
const getProductStockStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const stockStatus = await productService.getProductStockStatus(id);

  res.status(200).json({
    success: true,
    data: stockStatus,
  });
});

/**
 * @desc    Get product price range
 * @route   GET /api/products/:id/pricing
 * @access  Public
 */
const getProductPriceRange = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const priceRange = await productService.getProductPriceRange(id);

  res.status(200).json({
    success: true,
    data: priceRange,
  });
});



// ============================================================
// REVIEWS CONTROLLERS
// ============================================================

/**
 * @desc    Get product reviews
 * @route   GET /api/products/:id/reviews
 * @access  Public
 */
const getProductReviews = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const filters = {
    rating: req.query.rating,
    verified: req.query.verified,
    withImages: req.query.withImages,
    sortBy: req.query.sort || 'helpful',
  };

  const pagination = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10,
  };

  const result = await productService.getProductReviews(id, filters, pagination);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get product rating distribution
 * @route   GET /api/products/:id/reviews/distribution
 * @access  Public
 */
const getProductRatingDistribution = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const distribution = await productService.getProductRatingDistribution(id);

  res.status(200).json({
    success: true,
    data: distribution,
  });
});

/**
 * @desc    Get product review summary
 * @route   GET /api/products/:id/reviews/summary
 * @access  Public
 */
const getProductReviewSummary = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const summary = await productService.getProductReviewSummary(id);

  res.status(200).json({
    success: true,
    data: summary,
  });
});

/**
 * @desc    Check if the logged-in user is eligible to review a product
 * @route   GET /api/products/:id/reviews/eligibility
 * @access  Private
 */
const checkReviewEligibility = asyncHandler(async (req, res) => {
  const { id: productId } = req.params;
  const userId = req.user._id;

  // Already reviewed?
  const existing = await Review.findOne({ user: userId, product: productId })
    .select('_id rating status createdAt sizeName')
    .lean();

  if (existing) {
    return res.status(200).json({
      success: true,
      data: {
        canReview: false,
        reason: 'already_reviewed',
        existingReview: existing,
      },
    });
  }

  // Find all delivered orders that contain this product
  const orders = await Order.find({
    user: userId,
    status: 'delivered',
    'items.product': productId,
  })
    .select('orderNumber placedAt items')
    .populate('items.size', 'displayName size volumeMl')
    .lean();

  if (!orders.length) {
    return res.status(200).json({
      success: true,
      data: { canReview: false, reason: 'not_purchased' },
    });
  }

  // Build a de-duplicated list of purchased size/subproduct combos for this product
  const purchasedSizes = [];
  const seen = new Set();

  for (const order of orders) {
    for (const item of order.items) {
      if (String(item.product) !== String(productId)) continue;

      const sizeId   = item.size?._id   ? String(item.size._id)   : null;
      const subId    = item.subproduct  ? String(item.subproduct)  : null;
      const key      = sizeId ?? subId ?? String(order._id);
      if (seen.has(key)) continue;
      seen.add(key);

      purchasedSizes.push({
        orderId:      order._id,
        orderNumber:  order.orderNumber,
        orderDate:    order.placedAt,
        subproductId: item.subproduct || null,
        sizeId:       sizeId || null,
        sizeName:     item.size?.displayName || item.size?.size || null,
      });
    }
  }

  res.status(200).json({
    success: true,
    data: {
      canReview:     purchasedSizes.length > 0,
      reason:        purchasedSizes.length > 0 ? 'eligible' : 'not_purchased',
      purchasedSizes,
    },
  });
});

/**
 * @desc    Submit a product review (verified-purchase only, supports image uploads)
 * @route   POST /api/products/:id/reviews
 * @access  Private (logged-in users only)
 */
const submitProductReview = asyncHandler(async (req, res) => {
  const { id: productId } = req.params;
  const userId = req.user._id;
  const { rating, title, comment, orderId, subproductId, sizeId, sizeName } = req.body;

  // ── Validate inputs ────────────────────────────────────────────────────────
  if (!rating || !comment?.trim()) {
    return res.status(400).json({ success: false, message: 'Rating and comment are required' });
  }
  const ratingNum = parseInt(rating, 10);
  if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
  }
  if (comment.trim().length < 10) {
    return res.status(400).json({ success: false, message: 'Review must be at least 10 characters' });
  }

  // ── Duplicate check ────────────────────────────────────────────────────────
  const existing = await Review.findOne({ user: userId, product: productId });
  if (existing) {
    return res.status(400).json({ success: false, message: 'You have already submitted a review for this product' });
  }

  // ── Verify purchase ────────────────────────────────────────────────────────
  const orderQuery = {
    user:           userId,
    status:         'delivered',
    'items.product': productId,
  };
  if (orderId) orderQuery._id = orderId;

  const order = await Order.findOne(orderQuery).lean();
  if (!order) {
    return res.status(403).json({
      success: false,
      message: 'You can only review products you have purchased and received.',
    });
  }

  // If a specific sizeId was supplied, confirm it belongs to this order
  if (sizeId) {
    const sizeInOrder = order.items.some(
      item =>
        String(item.product) === String(productId) &&
        item.size && String(item.size) === String(sizeId)
    );
    if (!sizeInOrder) {
      return res.status(403).json({
        success: false,
        message: 'The selected size does not match your order.',
      });
    }
  }

  // ── Upload review images to Cloudinary ────────────────────────────────────
  let images = [];
  if (req.files && req.files.length > 0) {
    const uploadResults = await Promise.all(
      req.files.map(file =>
        cloudinaryService.uploadImage(file.buffer, {
          folder: 'reviews',
          tags:   ['review', String(productId)],
        })
      )
    );
    images = uploadResults.map(u => ({ url: u.url, publicId: u.publicId, alt: '' }));
  }

  // ── Create review ──────────────────────────────────────────────────────────
  const review = await Review.create({
    user:               userId,
    product:            productId,
    order:              order._id,
    subproduct:         subproductId || undefined,
    sizeId:             sizeId       || undefined,
    sizeName:           sizeName     || undefined,
    rating:             ratingNum,
    title:              title?.trim()   || undefined,
    comment:            comment.trim(),
    images,
    isVerifiedPurchase: true,
    status:             'pending',
  });

  res.status(201).json({
    success: true,
    message: 'Thank you! Your review has been submitted and will appear after moderation.',
    data: { review },
  });
});

/**
 * @desc    Mark a review as helpful (one vote per user, toggleable)
 * @route   POST /api/products/reviews/:reviewId/helpful
 * @access  Private
 */
const markReviewHelpful = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user._id;

  const review = await Review.findById(reviewId);
  if (!review || review.status !== 'approved') {
    return res.status(404).json({ success: false, message: 'Review not found' });
  }

  const alreadyVoted = review.helpfulVoters.some(v => String(v) === String(userId));

  if (alreadyVoted) {
    // Toggle off — remove vote
    review.helpfulVoters = review.helpfulVoters.filter(v => String(v) !== String(userId));
    review.helpfulCount  = Math.max(0, (review.helpfulCount || 0) - 1);
    await review.save();
    return res.json({ success: true, data: { helpfulCount: review.helpfulCount, voted: false } });
  }

  review.helpfulVoters.push(userId);
  review.helpfulCount = (review.helpfulCount || 0) + 1;
  await review.save();

  res.json({ success: true, data: { helpfulCount: review.helpfulCount, voted: true } });
});


const getAllProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 12, ...filters } = req.query;
  
  // getAllProducts function is broken - use searchProducts instead
  const result = await productService.searchProducts({
    ...filters,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    status: 'approved',
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Search products (public)
 * @route   GET /api/search/products
 * @access  Public
 */
const searchProductsPublic = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 12, q, query,
    category, subCategory,
    brand,
    // Normalize client-side param names → service param names
    sort,          // client sends "sort", service expects "sortBy"
    origin,        // client sends "origin", service expects "originCountry"
    flavor,        // client sends "flavor", service expects "flavors"
    minABV,        // client sends "minABV", service expects "minAbv"
    maxABV,        // client sends "maxABV", service expects "maxAbv"
    ...filters
  } = req.query;

  const searchParams = {
    ...filters,
    query: query || q || '',
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    category: category ? (Array.isArray(category) ? category : category.split(',')) : undefined,
    subCategory: subCategory ? (Array.isArray(subCategory) ? subCategory : subCategory.split(',')) : undefined,
    brand: brand ? (Array.isArray(brand) ? brand : brand.split(',')) : undefined,
    // Normalized names
    ...(sort        && { sortBy: sort }),
    ...(origin      && { originCountry: Array.isArray(origin) ? origin : origin.split(',') }),
    ...(flavor      && { flavors: Array.isArray(flavor) ? flavor : flavor.split(',') }),
    ...(minABV      && { minAbv: parseFloat(minABV) }),
    ...(maxABV      && { maxAbv: parseFloat(maxABV) }),
    // Public shop always shows only approved/published products — not overridable via query param
    status: 'approved',
  };

  const result = await productService.searchProducts(searchParams);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Catalog-wide filter facets for the public shop (brands, origins,
 *          categories, subcategories, price bounds) — computed over the whole
 *          visible catalog so filter options are never limited to one page.
 * @route   GET /api/products/filter-options
 * @access  Public
 */
const getProductFilterOptions = asyncHandler(async (req, res) => {
  const Product = require('../models/Product');

  const [facets] = await Product.aggregate([
    { $match: { status: 'approved', isPublished: true } },
    {
      $facet: {
        brands: [
          { $match: { brand: { $ne: null } } },
          { $group: { _id: '$brand' } },
          { $lookup: { from: 'brands', localField: '_id', foreignField: '_id', as: 'b' } },
          { $unwind: '$b' },
          { $project: { _id: 0, name: '$b.name', slug: '$b.slug' } },
          { $sort: { name: 1 } },
        ],
        origins: [
          { $match: { originCountry: { $nin: [null, ''] } } },
          { $group: { _id: '$originCountry' } },
          { $sort: { _id: 1 } },
        ],
        categories: [
          { $match: { category: { $ne: null } } },
          { $group: { _id: '$category' } },
          { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'c' } },
          { $unwind: '$c' },
          { $project: { _id: 0, name: '$c.name', slug: '$c.slug' } },
          { $sort: { name: 1 } },
        ],
        subCategories: [
          { $match: { subCategory: { $ne: null } } },
          { $group: { _id: '$subCategory' } },
          { $lookup: { from: 'subcategories', localField: '_id', foreignField: '_id', as: 's' } },
          { $unwind: '$s' },
          { $project: { _id: 0, name: '$s.name', slug: '$s.slug' } },
          { $sort: { name: 1 } },
        ],
        price: [
          { $match: { basePrice: { $gt: 0 } } },
          { $group: { _id: null, min: { $min: '$basePrice' }, max: { $max: '$basePrice' } } },
        ],
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      brands: facets.brands,
      origins: facets.origins.map((o) => o._id),
      categories: facets.categories,
      subCategories: facets.subCategories,
      priceRange: {
        min: facets.price[0]?.min ?? 0,
        max: facets.price[0]?.max ?? 0,
      },
    },
  });
});

/**
 * @desc    Get featured products
 * @route   GET /api/products/featured
 * @access  Public
 */
const getFeaturedProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 12 } = req.query;
  
  const result = await productService.getFeaturedProducts(
    parseInt(page),
    parseInt(limit)
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get new arrivals
 * @route   GET /api/products/new
 * @access  Public
 */
const getNewArrivals = asyncHandler(async (req, res) => {
  const { page = 1, limit = 12, days = 30 } = req.query;
  
  const result = await productService.getNewArrivals(
    parseInt(page),
    parseInt(limit),
    parseInt(days)
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Get bestsellers
 * @route   GET /api/products/bestsellers
 * @access  Public
 */
const getBestsellers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 12 } = req.query;
  
  const result = await productService.getBestsellers(
    parseInt(page),
    parseInt(limit)
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});



/**
 * @desc    Get product availability across tenants
 * @route   GET /api/products/:id/availability
 * @access  Public
 */
const getProductAvailability = asyncHandler(async (req, res) => {
  const availability = await productService.getProductAvailability(req.params.id);

  res.status(200).json({
    success: true,
    data: availability,
  });
});

/**
 * @desc    Get related products
 * @route   GET /api/products/:id/related
 * @access  Public
 */
const getRelatedProducts = asyncHandler(async (req, res) => {
  const { limit = 6 } = req.query;
  
  const products = await productService.getRelatedProducts(
    req.params.id,
    parseInt(limit)
  );

  res.status(200).json({
    success: true,
    data: { products },
  });
});


/**
 * @desc    Get product by slug (SEO-friendly URL)
 * @route   GET /api/products/slug/:slug
 * @access  Public
 */
const getProductBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  if (!slug || slug.trim().length === 0) {
    throw new ValidationError('Product slug is required');
  }

  const product = await productService.getProductBySlug(slug);

  res.status(200).json({
    success: true,
    data: { product },
  });
});

/**
 * @desc    Get product by ID (alias: fetchProduct)
 * @route   GET /api/products/:id
 * @access  Public
 */
const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { includePending } = req.query;

  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    throw new ValidationError('Valid product ID is required');
  }

  // Allow including pending products when editing SubProducts
  const shouldIncludePending = includePending === 'true' || includePending === '1';
  const product = await productService.getProductById(id, shouldIncludePending);

  res.status(200).json({
    success: true,
    data: { product },
  });
});

// Alias for getProductById
const fetchProduct = getProductById;

/**
 * @desc    Add product to cart
 * @route   POST /api/products/:id/cart
 * @access  Private
 * @body    { subProductId, sizeId, quantity, tenantId? }
 */
const addProductToCart = asyncHandler(async (req, res) => {
  const { id: productId } = req.params;
  const { subProductId, sizeId, quantity = 1, tenantId } = req.body;
  const userId = req.user._id;

  // Validate required fields
  if (!subProductId || !sizeId) {
    throw new ValidationError('subProductId and sizeId are required');
  }

  if (quantity < 1 || quantity > 100) {
    throw new ValidationError('Quantity must be between 1 and 100');
  }

  // Add to cart
  const result = await cartService.addToCart({
    userId,
    productId,
    subProductId,
    sizeId,
    tenantId,
    quantity,
  });

  res.status(200).json({
    success: true,
    message: 'Product added to cart successfully',
    data: {
      cart: result.cart,
      item: result.addedItem,
    },
  });
});

/**
 * @desc    Add product to wishlist
 * @route   POST /api/products/:id/wishlist
 * @access  Private
 * @body    { subProductId?, note?, priority? }
 */
const addProductToWishlist = asyncHandler(async (req, res) => {
  const { id: productId } = req.params;
  const { subProductId, note, priority = 'medium' } = req.body;
  const userId = req.user._id;

  // Validate priority if provided
  const validPriorities = ['high', 'medium', 'low', 'gift'];
  if (priority && !validPriorities.includes(priority)) {
    throw new ValidationError(
      `Priority must be one of: ${validPriorities.join(', ')}`
    );
  }

  // Add to wishlist
  const result = await wishlistService.addToWishlist({
    userId,
    productId,
    subProductId,
    note,
    priority,
  });

  res.status(200).json({
    success: true,
    message: result.isNew
      ? 'Product added to wishlist successfully'
      : 'Product already in wishlist',
    data: {
      wishlist: result.wishlist,
      item: result.item,
    },
  });
});

/**
 * @desc    Remove product from wishlist
 * @route   DELETE /api/products/:id/wishlist
 * @access  Private
 */
const removeProductFromWishlist = asyncHandler(async (req, res) => {
  const { id: productId } = req.params;
  const userId = req.user._id;

  const wishlist = await wishlistService.removeFromWishlist(userId, productId);

  res.status(200).json({
    success: true,
    message: 'Product removed from wishlist successfully',
    data: { wishlist },
  });
});

/**
 * @desc    Get the authenticated user's wishlist
 * @route   GET /api/products/wishlist
 * @access  Private
 */
const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await wishlistService.getWishlist(req.user._id);
  res.status(200).json({ success: true, data: wishlist });
});

/**
 * @desc    Clear the authenticated user's wishlist
 * @route   DELETE /api/products/wishlist
 * @access  Private
 */
const clearWishlistController = asyncHandler(async (req, res) => {
  const wishlist = await wishlistService.clearWishlist(req.user._id);
  res.status(200).json({ success: true, message: 'Wishlist cleared', data: wishlist });
});

// ============================================================
// PRODUCT RELATIONS CONTROLLERS
// ============================================================



/**
 * @desc    Get frequently bought together
 * @route   GET /api/products/:id/bought-together
 * @access  Public
 */
const getFrequentlyBoughtTogether = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit) || 5;

  const products = await productService.getFrequentlyBoughtTogether(id, limit);

  res.status(200).json({
    success: true,
    data: { products },
  });
});

/**
 * @desc    Get cross-sell products
 * @route   GET /api/products/:id/cross-sells
 * @access  Public
 */
const getProductCrossSells = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit) || 4;

  const products = await productService.getProductCrossSells(id, limit);

  res.status(200).json({
    success: true,
    data: { products },
  });
});

/**
 * @desc    Get up-sell products
 * @route   GET /api/products/:id/up-sells
 * @access  Public
 */
const getProductUpSells = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit) || 4;

  const products = await productService.getProductUpSells(id, limit);

  res.status(200).json({
    success: true,
    data: { products },
  });
});

// ============================================================
// PRODUCT VARIANTS CONTROLLERS
// ============================================================

/**
 * @desc    Get product variants
 * @route   GET /api/products/:id/variants
 * @access  Public
 */
const getProductVariants = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const variants = await productService.getProductVariants(id);

  res.status(200).json({
    success: true,
    data: variants,
  });
});

/**
 * @desc    Compare product variants
 * @route   GET /api/products/:id/variants/compare
 * @access  Public
 */
const compareProductVariants = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const comparison = await productService.compareProductVariants(id);

  res.status(200).json({
    success: true,
    data: comparison,
  });
});

// ============================================================
// PRICE MANAGEMENT CONTROLLERS
// ============================================================

/**
 * @desc    Update product pricing
 * @route   PATCH /api/products/:id/pricing
 * @access  Private (Super-admin)
 */
const updateProductPricing = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  const product = await productService.updateProductPricing(id, req.body, user);

  res.status(200).json({
    success: true,
    message: 'Product pricing updated successfully',
    data: { product },
  });
});

/**
 * @desc    Get product price history
 * @route   GET /api/products/:id/pricing/history
 * @access  Private
 */
const getProductPriceHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  const history = await productService.getProductPriceHistory(id, {
    startDate,
    endDate,
  });

  res.status(200).json({
    success: true,
    data: history,
  });
});

/**
 * @desc    Schedule price change
 * @route   POST /api/products/:id/pricing/schedule
 * @access  Private (Super-admin)
 */
const schedulePriceChange = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPrice, effectiveDate } = req.body;
  const user = req.user;

  const scheduled = await productService.schedulePriceChange(
    id,
    newPrice,
    effectiveDate,
    user
  );

  res.status(201).json({
    success: true,
    message: 'Price change scheduled successfully',
    data: { scheduled },
  });
});

// ============================================================
// IMAGE MANAGEMENT CONTROLLERS (Extended)
// ============================================================

/**
 * @desc    Update image metadata
 * @route   PATCH /api/products/:id/images/:publicId/metadata
 * @access  Private
 */
const updateProductImageMetadata = asyncHandler(async (req, res) => {
  const { id, publicId } = req.params;
  const user = req.user;

  const result = await productService.updateProductImageMetadata(
    id,
    publicId,
    req.body,
    user
  );

  res.status(200).json({
    success: true,
    message: 'Image metadata updated successfully',
    data: result,
  });
});

/**
 * @desc    Bulk delete images
 * @route   DELETE /api/products/:id/images/bulk
 * @access  Private
 */
const bulkDeleteProductImages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { publicIds } = req.body;
  const user = req.user;

  const result = await productService.bulkDeleteProductImages(id, publicIds, user);

  res.status(200).json({
    success: true,
    message: `Bulk delete completed: ${result.success} deleted, ${result.failed} failed`,
    data: result,
  });
});







/**
 * @desc    Get personalized product recommendations based on recently viewed
 * @route   GET /api/products/recommendations/personalized
 * @access  Private
 */
const getPersonalizedRecommendations = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  
  if (!req.user || !req.user._id) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }

  const recommendations = await productService.getPersonalizedRecommendations(req.user._id, limit);
  
  successResponse(res, {
    count: recommendations.length,
    data: recommendations,
  }, 'Personalized recommendations fetched successfully');
});

const getAdminProductList = asyncHandler(async (req, res) => {
  const result = await productService.getAdminProductList({
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search,
    status: req.query.status,
    category: req.query.category,
    subCategory: req.query.subCategory,
    brand: req.query.brand,
  });
  res.status(200).json({ success: true, data: result });
});

module.exports = {
    createProduct,
    getAdminProductList,
    approveProduct,
    rejectProduct,
    updateProduct,
    deleteProduct,
    // Product Management
    bulkUpdateProducts,
    duplicateProduct,
    archiveProduct,
    restoreProduct,
    uploadProductImages,
    deleteProductImage,
    reorderProductImages,
    setProductPrimaryImage,
    getPendingProducts,
    getRejectedProducts,
    getProductSubmissionStats,
    bulkApproveProducts,
    bulkRejectProducts,

    // Product Analytics
    getProductAnalytics,
    getProductPerformance,
    getProductCompetitors,
    getProductRecommendations,
  getPersonalizedRecommendations,

    // Search & Discovery
    searchProducts,
    getCategoryBySlug,
    getProductsByCategory,
    getProductsByBrand,
    getProductsByTags,
    getProductsByFlavors,
    getTrendingProducts,
    getSeasonalProducts,
  
    // Inventory
    getProductStockStatus,
    getProductPriceRange,
    getProductAvailability,
  
    // Reviews
    getProductReviews,
    getProductRatingDistribution,
    getProductReviewSummary,
    checkReviewEligibility,
    submitProductReview,
    markReviewHelpful,

    getProductByBarcode,
    importProducts,
    exportTenantProducts,
    exportAllProducts,
    getAllProducts,
    searchProductsPublic,
    getProductFilterOptions,
    getFeaturedProducts,
    getNewArrivals,
    getBestsellers,
    getProductBySlug,
    getProductById,
    getRelatedProducts,
    fetchProduct, // Alias
    addProductToCart,
    addProductToWishlist,
    removeProductFromWishlist,
    getWishlist,
    clearWishlistController,

    // Product Relations
    getRelatedProducts,
    getFrequentlyBoughtTogether,
    getProductCrossSells,
    getProductUpSells,
  
    // Product Variants
    getProductVariants,
    compareProductVariants,
  
    // Price Management
    updateProductPricing,
    getProductPriceHistory,
    schedulePriceChange,
  
    // Image Management
    updateProductImageMetadata,
    bulkDeleteProductImages,
};