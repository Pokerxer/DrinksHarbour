// services/brand.service.js
/**
 * Brand Service - Handles all brand-related business logic
 * 
 * Features:
 * - Advanced filtering with multiple criteria
 * - Pagination with cursor support
 * - Text search with relevance scoring
 * - Field selection
 * - Range queries (product count, popularity, founded year)
 * - Statistics aggregation
 */

const Brand = require('../models/Brand');
const { NotFoundError, ValidationError } = require('../utils/errors');

/**
 * Build boolean filter from query param
 * @param {string} value - Query parameter value
 * @returns {boolean|null} - Boolean value or null if not set
 */
const buildBooleanFilter = (value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
};

/**
 * Build range filter for numeric fields
 * @param {Object} params - Query parameters
 * @param {string} minField - Minimum field name
 * @param {string} maxField - Maximum field name
 * @returns {Object|null} - Range filter object
 */
const buildRangeFilter = (params, minField, maxField) => {
  const range = {};
  
  if (params[minField] !== undefined) {
    range.$gte = parseFloat(params[minField]);
  }
  if (params[maxField] !== undefined) {
    range.$lte = parseFloat(params[maxField]);
  }
  
  return Object.keys(range).length > 0 ? range : null;
};

/**
 * Build array filter for multi-select fields
 * @param {*} value - Query parameter value (string or array)
 * @returns {Object|null} - Array filter object
 */
const buildArrayFilter = (value) => {
  if (!value) return null;
  if (Array.isArray(value)) {
    return { $in: value };
  }
  return value;
};

/**
 * Create a new brand
 */
const createBrand = async (brandData, userId) => {
  try {
    // Check for duplicate name
    const existingBrand = await Brand.findOne({ 
      name: { $regex: new RegExp(`^${brandData.name}$`, 'i') } 
    });
    
    if (existingBrand) {
      throw new ValidationError('A brand with this name already exists');
    }

    // Add creator
    brandData.createdBy = userId;
    brandData.updatedBy = userId;

    // Create brand
    const brand = new Brand(brandData);
    await brand.save();

    return brand;
  } catch (error) {
    if (error.code === 11000) {
      throw new ValidationError('A brand with this slug already exists');
    }
    throw error;
  }
};

/**
 * Get all brands with advanced filtering, sorting, pagination, and aggregation
 */
const getAllBrands = async (queryParams = {}) => {
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
    includeStats = 'false'
  } = queryParams;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  // Build filter with advanced options
  const query = {};
  
  // Status filter (support multiple statuses)
  if (status) {
    if (Array.isArray(status)) {
      query.status = { $in: status };
    } else if (status !== 'all') {
      query.status = status;
    }
  }

  // Boolean filters
  if (featured === 'true') query.isFeatured = true;
  if (featured === 'false') query.isFeatured = false;
  if (verified === 'true') query.verified = true;
  if (verified === 'false') query.verified = false;
  if (isPremium === 'true') query.isPremium = true;
  if (isPremium === 'false') query.isPremium = false;
  if (isPopular === 'true') query.isPopular = true;
  if (isPopular === 'false') query.isPopular = false;
  if (isTrending === 'true') query.isTrending = true;
  if (isTrending === 'false') query.isTrending = false;
  if (isCraft === 'true') query.isCraft = true;
  if (isCraft === 'false') query.isCraft = false;
  if (isLocal === 'true') query.isLocal = true;
  if (isLocal === 'false') query.isLocal = false;

  // Category and type filters (support multiple)
  if (country) {
    if (Array.isArray(country)) {
      query.countryOfOrigin = { $in: country };
    } else {
      query.countryOfOrigin = country;
    }
  }
  
  if (category) {
    if (Array.isArray(category)) {
      query.primaryCategory = { $in: category };
    } else {
      query.primaryCategory = category;
    }
  }
  
  if (brandType) {
    if (Array.isArray(brandType)) {
      query.brandType = { $in: brandType };
    } else {
      query.brandType = brandType;
    }
  }

  // Product count range
  if (hasProducts === 'true') {
    query.productCount = { $gt: 0 };
  }
  
  if (minProductCount !== undefined || maxProductCount !== undefined) {
    query.productCount = query.productCount || {};
    if (minProductCount !== undefined) {
      query.productCount.$gte = parseInt(minProductCount);
    }
    if (maxProductCount !== undefined) {
      query.productCount.$lte = parseInt(maxProductCount);
    }
  }

  // Popularity score range
  if (minPopularity !== undefined || maxPopularity !== undefined) {
    query.popularityScore = {};
    if (minPopularity !== undefined) {
      query.popularityScore.$gte = parseFloat(minPopularity);
    }
    if (maxPopularity !== undefined) {
      query.popularityScore.$lte = parseFloat(maxPopularity);
    }
  }

  // Founded year range
  if (foundedAfter !== undefined || foundedBefore !== undefined) {
    query.founded = {};
    if (foundedAfter !== undefined) {
      query.founded.$gte = parseInt(foundedAfter);
    }
    if (foundedBefore !== undefined) {
      query.founded.$lte = parseInt(foundedBefore);
    }
  }
  
  // Advanced search with text index support and relevance scoring
  let searchQuery = {};
  let searchScore = null;
  
  if (search && search.trim()) {
    const searchTerm = search.trim();
    
    // Try text search first (if text index exists)
    try {
      searchQuery = { $text: { $search: searchTerm } };
      searchScore = { score: { $meta: 'textScore' } };
    } catch (e) {
      // Fallback to regex search
      searchQuery = {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
          { shortDescription: { $regex: searchTerm, $options: 'i' } },
          { tagline: { $regex: searchTerm, $options: 'i' } },
          { countryOfOrigin: { $regex: searchTerm, $options: 'i' } },
          { region: { $regex: searchTerm, $options: 'i' } }
        ]
      };
    }
    
    Object.assign(query, searchQuery);
  }

  // Build sort with multiple field support
  const sortObj = {};
  const sortFields = sort.split(',');
  
  sortFields.forEach(field => {
    const trimmedField = field.trim();
    if (trimmedField.startsWith('-')) {
      sortObj[trimmedField.substring(1)] = -1;
    } else {
      sortObj[trimmedField] = order === 'desc' ? -1 : 1;
    }
  });
  
  // Default sorts for specific cases
  if (sort === 'popularity') {
    sortObj.popularityScore = -1;
  } else if (sort === 'products') {
    sortObj.productCount = -1;
  } else if (sort === 'newest') {
    sortObj.createdAt = -1;
  } else if (sort === 'oldest') {
    sortObj.createdAt = 1;
  } else if (sort === 'founded') {
    sortObj.founded = -1;
  } else if (sort === 'name') {
    sortObj.name = order === 'desc' ? -1 : 1;
  }
  
  // Add text score sort if searching
  if (searchScore) {
    sortObj.score = { $meta: 'textScore' };
  }

  // Field selection - include all image fields
  let selectFields = 'name slug logo logoVariants featuredImage bannerImage gallery brandColors description shortDescription productCount isFeatured verified countryOfOrigin primaryCategory brandType founded isPremium popularityScore createdAt';
  
  if (fields) {
    const allowedFields = fields.split(',').map(f => f.trim()).filter(f => 
      ['name', 'slug', 'logo', 'logoVariants', 'featuredImage', 'bannerImage', 'gallery', 
       'brandColors', 'description', 'shortDescription', 'productCount', 
       'isFeatured', 'verified', 'countryOfOrigin', 'primaryCategory', 'brandType', 
       'founded', 'isPremium', 'popularityScore', 'isPopular', 'isTrending', 
       'isCraft', 'isLocal', 'createdAt', 'updatedAt', 'viewCount', 'followersCount',
       'website', 'socialMedia', 'headquarters', 'certifications'].includes(f)
    );
    if (allowedFields.length > 0) {
      selectFields = allowedFields.join(' ');
    }
  }

  // Execute query with optimization
  const queryBuilder = Brand.find(query)
    .select(selectFields)
    .sort(sortObj)
    .skip(skip)
    .limit(limitNum)
    .lean();

  // Add collation for case-insensitive sorting
  queryBuilder.collation({ locale: 'en', strength: 2 });

  // Execute main query and count in parallel
  const [brands, total, stats] = await Promise.all([
    queryBuilder,
    Brand.countDocuments(query),
    includeStats === 'true' ? getBrandStats() : null
  ]);

  // Calculate pagination metadata
  const totalPages = Math.ceil(total / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  return {
    brands,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: totalPages,
      hasMore: hasNextPage,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? pageNum + 1 : null,
      prevPage: hasPrevPage ? pageNum - 1 : null
    },
    filters: {
      applied: {
        status: status || null,
        featured: featured || null,
        verified: verified || null,
        country: country || null,
        category: category || null,
        brandType: brandType || null,
        search: search || null
      }
    },
    stats: stats || undefined
  };
};

/**
 * Get featured brands
 */
const getFeaturedBrands = async (limit = 10) => {
  const brands = await Brand.find({
    status: 'active',
    isFeatured: true
  })
    .select('name slug logo logoVariants featuredImage bannerImage gallery brandColors description shortDescription productCount countryOfOrigin primaryCategory brandType founded')
    .sort({ displayOrder: 1, popularityScore: -1, name: 1 })
    .limit(parseInt(limit))
    .lean();

  return brands;
};

/**
 * Get popular brands
 */
const getPopularBrands = async (limit = 10) => {
  const brands = await Brand.find({
    status: 'active',
    $or: [
      { isPopular: true },
      { popularityScore: { $gte: 60 } }
    ]
  })
    .select('name slug logo logoVariants featuredImage bannerImage gallery brandColors description shortDescription productCount popularityScore countryOfOrigin primaryCategory')
    .sort({ popularityScore: -1, productCount: -1 })
    .limit(parseInt(limit))
    .lean();

  return brands;
};

/**
 * Get brand by ID
 */
const getBrandById = async (brandId) => {
  const brand = await Brand.findById(brandId)
    .select('-__v')
    .lean();

  if (!brand) {
    throw new NotFoundError('Brand not found');
  }

  return brand;
};

/**
 * Get brand by slug
 */
const getBrandBySlug = async (slug) => {
  const brand = await Brand.findOne({
    slug,
    status: 'active'
  })
    .select('-__v')
    .lean();

  if (!brand) {
    throw new NotFoundError('Brand not found');
  }

  // Increment view count asynchronously (don't await)
  Brand.findByIdAndUpdate(brand._id, { $inc: { viewCount: 1 } }).exec();

  return brand;
};

/**
 * Update brand
 */
const updateBrand = async (brandId, updateData, userId) => {
  // Check if brand exists
  const existingBrand = await Brand.findById(brandId);
  
  if (!existingBrand) {
    throw new NotFoundError('Brand not found');
  }

  // Check for name conflict if name is being updated
  if (updateData.name && updateData.name !== existingBrand.name) {
    const nameExists = await Brand.findOne({
      _id: { $ne: brandId },
      name: { $regex: new RegExp(`^${updateData.name}$`, 'i') }
    });
    
    if (nameExists) {
      throw new ValidationError('A brand with this name already exists');
    }
  }

  // Add updater
  updateData.updatedBy = userId;

  const brand = await Brand.findByIdAndUpdate(
    brandId,
    updateData,
    { new: true, runValidators: true }
  );

  return brand;
};

/**
 * Delete brand (soft delete by setting status to archived)
 */
const deleteBrand = async (brandId) => {
  const brand = await Brand.findByIdAndUpdate(
    brandId,
    { status: 'archived' },
    { new: true }
  );

  if (!brand) {
    throw new NotFoundError('Brand not found');
  }

  return brand;
};

/**
 * Get brand statistics
 */
const getBrandStats = async () => {
  const stats = await Brand.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: null,
        totalBrands: { $sum: 1 },
        featuredBrands: {
          $sum: { $cond: [{ $eq: ['$isFeatured', true] }, 1, 0] }
        },
        verifiedBrands: {
          $sum: { $cond: [{ $eq: ['$verified', true] }, 1, 0] }
        },
        premiumBrands: {
          $sum: { $cond: [{ $eq: ['$isPremium', true] }, 1, 0] }
        },
        totalProducts: { $sum: '$productCount' },
        averagePopularity: { $avg: '$popularityScore' }
      }
    }
  ]);

  return stats[0] || {
    totalBrands: 0,
    featuredBrands: 0,
    verifiedBrands: 0,
    premiumBrands: 0,
    totalProducts: 0,
    averagePopularity: 0
  };
};

/**
 * Get brands by category
 */
const getBrandsByCategory = async (category, limit = 10) => {
  const brands = await Brand.find({
    status: 'active',
    primaryCategory: category
  })
    .select('name slug logo logoVariants featuredImage bannerImage gallery brandColors description shortDescription productCount countryOfOrigin')
    .sort({ popularityScore: -1, productCount: -1 })
    .limit(parseInt(limit))
    .lean();

  return brands;
};

/**
 * Update brand product count
 */
const updateProductCount = async (brandId) => {
  const Product = require('../models/Product');
  
  const stats = await Product.aggregate([
    { $match: { brand: brandId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
        }
      }
    }
  ]);
  
  if (stats.length > 0) {
    await Brand.findByIdAndUpdate(brandId, {
      productCount: stats[0].total,
      activeProductCount: stats[0].active
    });
  }
};

/**
 * Get available filter options for brands
 * Returns unique values for filterable fields
 */
const getFilterOptions = async () => {
  const [
    countries,
    categories,
    brandTypes,
    statusCounts,
    yearRange
  ] = await Promise.all([
    // Get unique countries
    Brand.distinct('countryOfOrigin', { status: 'active', countryOfOrigin: { $exists: true, $ne: null } }),
    
    // Get unique categories
    Brand.distinct('primaryCategory', { status: 'active', primaryCategory: { $exists: true, $ne: null } }),
    
    // Get unique brand types
    Brand.distinct('brandType', { status: 'active', brandType: { $exists: true, $ne: null } }),
    
    // Get counts by status
    Brand.aggregate([
      { $match: { status: { $exists: true } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    
    // Get min/max founded years
    Brand.aggregate([
      { $match: { status: 'active', founded: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: null,
          minYear: { $min: '$founded' },
          maxYear: { $max: '$founded' }
        }
      }
    ])
  ]);

  // Get product count ranges
  const productCountRanges = await Brand.aggregate([
    { $match: { status: 'active' } },
    {
      $bucket: {
        groupBy: '$productCount',
        boundaries: [0, 1, 5, 10, 20, 50, 100],
        default: '100+',
        output: {
          count: { $sum: 1 }
        }
      }
    }
  ]);

  // Get popularity score distribution
  const popularityRanges = await Brand.aggregate([
    { $match: { status: 'active' } },
    {
      $bucket: {
        groupBy: '$popularityScore',
        boundaries: [0, 20, 40, 60, 80, 100],
        default: '100+',
        output: {
          count: { $sum: 1 }
        }
      }
    }
  ]);

  return {
    filters: {
      countries: countries.sort(),
      categories: categories.sort(),
      brandTypes: brandTypes.sort(),
      statuses: statusCounts.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {})
    },
    ranges: {
      founded: yearRange[0] || { minYear: null, maxYear: null },
      productCount: {
        ranges: productCountRanges,
        min: 0,
        max: 100
      },
      popularity: {
        ranges: popularityRanges,
        min: 0,
        max: 100
      }
    },
    booleans: {
      featured: await Brand.countDocuments({ status: 'active', isFeatured: true }),
      verified: await Brand.countDocuments({ status: 'active', verified: true }),
      premium: await Brand.countDocuments({ status: 'active', isPremium: true }),
      popular: await Brand.countDocuments({ status: 'active', isPopular: true }),
      trending: await Brand.countDocuments({ status: 'active', isTrending: true }),
      craft: await Brand.countDocuments({ status: 'active', isCraft: true }),
      local: await Brand.countDocuments({ status: 'active', isLocal: true })
    }
  };
};

module.exports = {
  createBrand,
  getAllBrands,
  getFeaturedBrands,
  getPopularBrands,
  getBrandById,
  getBrandBySlug,
  updateBrand,
  deleteBrand,
  getBrandStats,
  getBrandsByCategory,
  updateProductCount,
  getFilterOptions
};
