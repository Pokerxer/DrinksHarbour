// controllers/brand.controller.js

const brandService = require('../services/brand.service');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');

/**
 * @desc    Create new brand
 * @route   POST /api/brands
 * @access  Private/Admin
 */
exports.createBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.createBrand(req.body, req.user?._id);
  successResponse(res, { brand }, 'Brand created successfully', 201);
});

/**
 * @desc    Get all brands with advanced filtering, sorting, and pagination
 * @route   GET /api/brands
 * @access  Public
 */
exports.getAllBrands = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    featured,
    status = 'active',
    sort = 'name',
    order = 'asc',
    search,
    country,
    category,
    verified,
    brandType,
    isPremium,
    isPopular,
    isTrending,
    isCraft,
    isLocal,
    hasProducts,
    minProductCount,
    maxProductCount,
    minPopularity,
    maxPopularity,
    foundedAfter,
    foundedBefore,
    fields,
    includeStats
  } = req.query;

  const queryParams = {
    page,
    limit,
    featured,
    status,
    sort,
    order,
    search,
    country,
    category,
    verified,
    brandType,
    isPremium,
    isPopular,
    isTrending,
    isCraft,
    isLocal,
    hasProducts,
    minProductCount,
    maxProductCount,
    minPopularity,
    maxPopularity,
    foundedAfter,
    foundedBefore,
    fields,
    includeStats
  };

  const result = await brandService.getAllBrands(queryParams);
  successResponse(res, result, 'Brands retrieved successfully');
});

/**
 * @desc    Get featured brands
 * @route   GET /api/brands/featured
 * @access  Public
 */
exports.getFeaturedBrands = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const brands = await brandService.getFeaturedBrands(limit);
  successResponse(res, { brands }, 'Featured brands retrieved successfully');
});

/**
 * @desc    Get popular brands
 * @route   GET /api/brands/popular
 * @access  Public
 */
exports.getPopularBrands = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const brands = await brandService.getPopularBrands(limit);
  successResponse(res, { brands }, 'Popular brands retrieved successfully');
});

/**
 * @desc    Get brand by ID
 * @route   GET /api/brands/:id
 * @access  Public
 */
exports.getBrandById = asyncHandler(async (req, res) => {
  const brand = await brandService.getBrandById(req.params.id);
  successResponse(res, { brand }, 'Brand retrieved successfully');
});

/**
 * @desc    Get brand by slug
 * @route   GET /api/brands/slug/:slug
 * @access  Public
 */
exports.getBrandBySlug = asyncHandler(async (req, res) => {
  const brand = await brandService.getBrandBySlug(req.params.slug);
  successResponse(res, { brand }, 'Brand retrieved successfully');
});

/**
 * @desc    Update brand
 * @route   PUT /api/brands/:id
 * @access  Private/Admin
 */
exports.updateBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.updateBrand(
    req.params.id,
    req.body,
    req.user?._id
  );
  successResponse(res, { brand }, 'Brand updated successfully');
});

/**
 * @desc    Patch/Partial update brand
 * @route   PATCH /api/brands/:id
 * @access  Private/Admin
 */
exports.patchBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.updateBrand(
    req.params.id,
    req.body,
    req.user?._id
  );
  successResponse(res, { brand }, 'Brand updated successfully');
});

/**
 * @desc    Delete brand
 * @route   DELETE /api/brands/:id
 * @access  Private/Admin
 */
exports.deleteBrand = asyncHandler(async (req, res) => {
  await brandService.deleteBrand(req.params.id);
  successResponse(res, null, 'Brand deleted successfully');
});

/**
 * @desc    Get brand statistics
 * @route   GET /api/brands/stats/overview
 * @access  Public
 */
exports.getBrandStats = asyncHandler(async (req, res) => {
  const stats = await brandService.getBrandStats();
  successResponse(res, { stats }, 'Brand statistics retrieved successfully');
});

/**
 * @desc    Get brands by category
 * @route   GET /api/brands/category/:category
 * @access  Public
 */
exports.getBrandsByCategory = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const brands = await brandService.getBrandsByCategory(req.params.category, limit);
  successResponse(res, { brands }, 'Brands retrieved successfully');
});

/**
 * @desc    Recalculate brand product count
 * @route   POST /api/brands/:id/recalculate
 * @access  Private/Admin
 */
exports.recalculateProductCount = asyncHandler(async (req, res) => {
  await brandService.updateProductCount(req.params.id);
  successResponse(res, null, 'Product count recalculated successfully');
});

/**
 * @desc    Get available filter options
 * @route   GET /api/brands/filters/options
 * @access  Public
 */
exports.getFilterOptions = asyncHandler(async (req, res) => {
  const options = await brandService.getFilterOptions();
  successResponse(res, options, 'Filter options retrieved successfully');
});
