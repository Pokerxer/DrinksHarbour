/**
 * Search Service Configuration
 */
const SEARCH_CONFIG = {
  // Caching
  CACHE_ENABLED: true,
  CACHE_TTL_SECONDS: 300, // 5 minutes
  MAX_CACHE_SIZE: 100,
  
  // Search limits
  MAX_RESULTS: 100,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 50,
  
  // Relevance scoring
  RELEVANCE_WEIGHTS: {
    NAME_EXACT: 100,
    NAME_PARTIAL: 50,
    DESCRIPTION: 20,
    TYPE: 30,
    BRAND: 40,
    CATEGORY: 35,
    POPULARITY: 10,
    RATING: 15,
    FEATURED: 25,
  },
  
  // Fuzzy matching
  FUZZY_MATCH_THRESHOLD: 0.6,
  ENABLE_FUZZY_SEARCH: true,
  
  // Performance
  ENABLE_SEMANTIC_SEARCH: false, // Disable by default for performance
  MAX_AGGREGATION_TIME_MS: 5000,
};

/**
 * Simple in-memory cache for search results
 */
class SearchCache {
  constructor() {
    this.cache = new Map();
    this.accessOrder = [];
  }
  
  getKey(params) {
    return JSON.stringify(params);
  }
  
  get(params) {
    if (!SEARCH_CONFIG.CACHE_ENABLED) return null;
    
    const key = this.getKey(params);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() - cached.timestamp > SEARCH_CONFIG.CACHE_TTL_SECONDS * 1000) {
      this.cache.delete(key);
      return null;
    }
    
    // Update access order
    this.updateAccessOrder(key);
    
    return cached.data;
  }
  
  set(params, data) {
    if (!SEARCH_CONFIG.CACHE_ENABLED) return;
    
    const key = this.getKey(params);
    
    // Evict oldest if at capacity
    if (this.cache.size >= SEARCH_CONFIG.MAX_CACHE_SIZE) {
      const oldestKey = this.accessOrder.shift();
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
    
    this.accessOrder.push(key);
  }
  
  updateAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }
  
  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }
}

const searchCache = new SearchCache();

/**
 * Search Analytics - Track popular searches
 */
const searchAnalytics = {
  queries: new Map(),
  
  track(query, resultsCount, duration) {
    if (!query || query.trim().length < 2) return;
    
    const normalizedQuery = query.toLowerCase().trim();
    const existing = this.queries.get(normalizedQuery);
    
    if (existing) {
      existing.count += 1;
      existing.lastSearched = Date.now();
      existing.avgResults = (existing.avgResults * existing.count + resultsCount) / (existing.count + 1);
    } else {
      this.queries.set(normalizedQuery, {
        query: normalizedQuery,
        count: 1,
        firstSearched: Date.now(),
        lastSearched: Date.now(),
        avgResults: resultsCount,
      });
    }
  },
  
  getPopular(limit = 10) {
    return Array.from(this.queries.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(item => item.query);
  },
  
  getSuggestions(partial, limit = 5) {
    const normalizedPartial = partial.toLowerCase().trim();
    return Array.from(this.queries.values())
      .filter(item => item.query.includes(normalizedPartial))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(item => item.query);
  },
};

/**
 * Build base query from search parameters
 */
async function buildSearchQuery(params) {
  const {
    query,
    category,
    subCategory,
    brand,
    tags,
    flavors,
    minAbv,
    maxAbv,
    isAlcoholic,
    originCountry,
    region,
    type,
    subType,
    isFeatured,
    minRating,
    includePending = false, // New parameter
  } = params;
  
  // For super admin, include both approved and pending products
  const baseQuery = includePending 
    ? { status: { $in: ['approved', 'pending'] } }
    : { status: 'approved' };
  
  // Text search
  if (query && query.trim()) {
    const searchTerm = query.trim();
    const searchRegex = new RegExp(searchTerm, 'i');
    
    baseQuery.$or = [
      { name: searchRegex },
      { shortDescription: searchRegex },
      { description: searchRegex },
      { type: searchRegex },
      { subType: searchRegex },
      { originCountry: searchRegex },
      { region: searchRegex },
      { producer: searchRegex },
      { flavorProfile: { $in: [searchRegex] } },
    ];
  }
  
  // Category filter
  if (category) {
    const categoryIds = await resolveCategoryIds(category);
    if (categoryIds.length) {
      baseQuery.category = { $in: categoryIds };
    }
  }
  
  // SubCategory filter
  if (subCategory) {
    const subCategoryIds = await resolveSubCategoryIds(subCategory);
    if (subCategoryIds.length) {
      baseQuery.subCategory = { $in: subCategoryIds };
    }
  }
  
  // Brand filter
  if (brand) {
    const brandIds = await resolveBrandIds(brand);
    if (brandIds.length) {
      baseQuery.brand = { $in: brandIds };
    }
  }
  
  // Tags filter
  if (tags) {
    baseQuery.tags = { $in: Array.isArray(tags) ? tags : [tags] };
  }
  
  // Flavors filter
  if (flavors) {
    baseQuery.flavors = { $in: Array.isArray(flavors) ? flavors : [flavors] };
  }
  
  // ABV range
  if (minAbv !== undefined || maxAbv !== undefined) {
    baseQuery.abv = {};
    if (minAbv !== undefined) baseQuery.abv.$gte = parseFloat(minAbv);
    if (maxAbv !== undefined) baseQuery.abv.$lte = parseFloat(maxAbv);
  }
  
  // Other filters
  if (isAlcoholic !== undefined) {
    baseQuery.isAlcoholic = isAlcoholic === true || isAlcoholic === 'true';
  }
  
  if (originCountry) {
    baseQuery.originCountry = Array.isArray(originCountry) 
      ? { $in: originCountry } 
      : originCountry;
  }
  
  if (region) {
    baseQuery.region = Array.isArray(region) ? { $in: region } : region;
  }
  
  if (type) {
    baseQuery.type = Array.isArray(type) ? { $in: type } : type;
  }
  
  if (subType) {
    baseQuery.subType = Array.isArray(subType) ? { $in: subType } : subType;
  }
  
  if (isFeatured !== undefined) {
    baseQuery.isFeatured = isFeatured === true || isFeatured === 'true';
  }
  
  if (minRating) {
    baseQuery.averageRating = { $gte: parseFloat(minRating) };
  }
  
  return baseQuery;
}

/**
 * Helper functions to resolve IDs
 */
async function resolveCategoryIds(category) {
  if (Array.isArray(category)) {
    const ids = [];
    for (const c of category) {
      if (/^[0-9a-fA-F]{24}$/.test(c)) {
        ids.push(new mongoose.Types.ObjectId(c));
      } else {
        const resolved = await resolveCategoryToObjectIds([c]);
        ids.push(...resolved.map(id => new mongoose.Types.ObjectId(id)));
      }
    }
    return ids;
  } else {
    if (/^[0-9a-fA-F]{24}$/.test(category)) {
      return [new mongoose.Types.ObjectId(category)];
    } else {
      const resolved = await resolveCategoryToObjectIds([category]);
      return resolved.map(id => new mongoose.Types.ObjectId(id));
    }
  }
}

async function resolveSubCategoryIds(subCategory) {
  if (Array.isArray(subCategory)) {
    const ids = [];
    for (const s of subCategory) {
      if (/^[0-9a-fA-F]{24}$/.test(s)) {
        ids.push(new mongoose.Types.ObjectId(s));
      } else {
        const resolved = await resolveSubCategoryToObjectIds([s]);
        ids.push(...resolved.map(id => new mongoose.Types.ObjectId(id)));
      }
    }
    return ids;
  } else {
    if (/^[0-9a-fA-F]{24}$/.test(subCategory)) {
      return [new mongoose.Types.ObjectId(subCategory)];
    } else {
      const resolved = await resolveSubCategoryToObjectIds([subCategory]);
      return resolved.map(id => new mongoose.Types.ObjectId(id));
    }
  }
}

async function resolveBrandIds(brand) {
  if (Array.isArray(brand)) {
    const ids = [];
    for (const b of brand) {
      if (/^[0-9a-fA-F]{24}$/.test(b)) {
        ids.push(new mongoose.Types.ObjectId(b));
      } else {
        const resolved = await resolveBrandToObjectIds([b]);
        ids.push(...resolved.map(id => new mongoose.Types.ObjectId(id)));
      }
    }
    return ids;
  } else {
    if (/^[0-9a-fA-F]{24}$/.test(brand)) {
      return [new mongoose.Types.ObjectId(brand)];
    } else {
      const resolved = await resolveBrandToObjectIds([brand]);
      return resolved.map(id => new mongoose.Types.ObjectId(id));
    }
  }
}

/**
 * Build aggregation pipeline for product search
 */
function buildAggregationPipeline(baseQuery, options) {
  const { tenantId, inStock = true, query } = options;
  
  const pipeline = [
    // Match base criteria
    { $match: baseQuery },
    
    // Lookup SubProducts
    {
      $lookup: {
        from: 'subproducts',
        let: { productId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$product', '$$productId'] },
                  { $eq: ['$status', 'active'] },
                  ...(tenantId ? [{ $eq: ['$tenant', new mongoose.Types.ObjectId(tenantId)] }] : []),
                ],
              },
            },
          },
          // Lookup tenant
          {
            $lookup: {
              from: 'tenants',
              localField: 'tenant',
              foreignField: '_id',
              as: 'tenant',
            },
          },
          { $unwind: '$tenant' },
          {
            $match: {
              'tenant.status': 'approved',
              'tenant.subscriptionStatus': { $in: ['active', 'trialing'] },
            },
          },
          // Lookup sizes
          {
            $lookup: {
              from: 'sizes',
              localField: '_id',
              foreignField: 'subproduct',
              as: 'sizes',
              pipeline: [
                {
                  $match: {
                    status: 'active',
                    availability: { $in: ['available', 'in_stock', 'low_stock'] },
                    ...(inStock ? { stock: { $gt: 0 } } : {}),
                  },
                },
              ],
            },
          },
          // Filter subproducts with sizes
          {
            $match: {
              $expr: { $gt: [{ $size: '$sizes' }, 0] },
            },
          },
          {
            $project: {
              'tenant._id': 1,
              'tenant.name': 1,
              'tenant.slug': 1,
              'tenant.logo': 1,
              'tenant.city': 1,
              'tenant.state': 1,
              'tenant.country': 1,
              'tenant.revenueModel': 1,
              'tenant.markupPercentage': 1,
              'tenant.commissionPercentage': 1,
              'tenant.defaultCurrency': 1,
              sku: 1,
              costPrice: 1,
              baseSellingPrice: 1,
              discount: 1,
              discountType: 1,
              sizes: 1,
              currency: 1,
              totalStock: 1,
              availableStock: 1,
              totalSold: 1,
              isFeaturedByTenant: 1,
            },
          },
        ],
        as: 'subProducts',
      },
    },
    
    // Filter products with subproducts
    {
      $match: {
        $expr: { $gt: [{ $size: '$subProducts' }, 0] },
      },
    },
    
    // Lookup brand
    {
      $lookup: {
        from: 'brands',
        localField: 'brand',
        foreignField: '_id',
        pipeline: [{ $project: { _id: 1, name: 1, slug: 1, logo: 1, countryOfOrigin: 1, isPremium: 1 } }],
        as: 'brand',
      },
    },
    { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
    
    // Lookup category
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        pipeline: [{ $project: { _id: 1, name: 1, slug: 1, type: 1, icon: 1, color: 1, displayName: 1 } }],
        as: 'category',
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    
    // Lookup subcategory
    {
      $lookup: {
        from: 'subcategories',
        localField: 'subCategory',
        foreignField: '_id',
        pipeline: [{ $project: { _id: 1, name: 1, slug: 1, type: 1, displayName: 1 } }],
        as: 'subCategory',
      },
    },
    { $unwind: { path: '$subCategory', preserveNullAndEmptyArrays: true } },
    
    // Lookup tags
    {
      $lookup: {
        from: 'tags',
        localField: 'tags',
        foreignField: '_id',
        pipeline: [{ $project: { _id: 1, name: 1, slug: 1, displayName: 1, color: 1 } }],
        as: 'tags',
      },
    },
    
    // Lookup flavors
    {
      $lookup: {
        from: 'flavors',
        localField: 'flavors',
        foreignField: '_id',
        pipeline: [{ $project: { _id: 1, name: 1, value: 1, color: 1 } }],
        as: 'flavors',
      },
    },
    
    // Calculate relevance score
    {
      $addFields: {
        relevanceScore: calculateRelevanceScore(query),
      },
    },
  ];
  
  return pipeline;
}

/**
 * Calculate relevance score for sorting
 */
function calculateRelevanceScore(query) {
  if (!query) {
    return {
      $add: [
        { $multiply: [{ $ifNull: ['$averageRating', 0] }, SEARCH_CONFIG.RELEVANCE_WEIGHTS.RATING] },
        { $multiply: [{ $ifNull: ['$totalSold', 0] }, SEARCH_CONFIG.RELEVANCE_WEIGHTS.POPULARITY] },
        { $cond: [{ $eq: ['$isFeatured', true] }, SEARCH_CONFIG.RELEVANCE_WEIGHTS.FEATURED, 0] },
      ],
    };
  }
  
  const searchRegex = new RegExp(query, 'i');
  const exactRegex = new RegExp(`^${query}$`, 'i');
  
  return {
    $add: [
      // Exact name match (highest priority)
      {
        $cond: [
          { $regexMatch: { input: '$name', regex: exactRegex } },
          SEARCH_CONFIG.RELEVANCE_WEIGHTS.NAME_EXACT,
          0,
        ],
      },
      // Partial name match
      {
        $cond: [
          { $regexMatch: { input: '$name', regex: searchRegex } },
          SEARCH_CONFIG.RELEVANCE_WEIGHTS.NAME_PARTIAL,
          0,
        ],
      },
      // Brand match
      {
        $cond: [
          { $regexMatch: { input: { $ifNull: ['$brand.name', ''] }, regex: searchRegex } },
          SEARCH_CONFIG.RELEVANCE_WEIGHTS.BRAND,
          0,
        ],
      },
      // Category match
      {
        $cond: [
          { $regexMatch: { input: { $ifNull: ['$category.name', ''] }, regex: searchRegex } },
          SEARCH_CONFIG.RELEVANCE_WEIGHTS.CATEGORY,
          0,
        ],
      },
      // Type match
      {
        $cond: [
          { $regexMatch: { input: { $ifNull: ['$type', ''] }, regex: searchRegex } },
          SEARCH_CONFIG.RELEVANCE_WEIGHTS.TYPE,
          0,
        ],
      },
      // Boosters
      { $multiply: [{ $ifNull: ['$averageRating', 0] }, SEARCH_CONFIG.RELEVANCE_WEIGHTS.RATING] },
      { $multiply: [{ $ifNull: ['$totalSold', 0] }, SEARCH_CONFIG.RELEVANCE_WEIGHTS.POPULARITY] },
      { $cond: [{ $eq: ['$isFeatured', true] }, SEARCH_CONFIG.RELEVANCE_WEIGHTS.FEATURED, 0] },
    ],
  };
}

/**
 * Main search function - Improved version
 */
const searchProducts = async (searchParams = {}) => {
  const startTime = Date.now();
  
  try {
    // Validate and normalize parameters
    const params = validateSearchParams(searchParams);
    
    // Check cache
    const cacheKey = { ...params, timestamp: Math.floor(Date.now() / (SEARCH_CONFIG.CACHE_TTL_SECONDS * 1000)) };
    const cached = searchCache.get(cacheKey);
    if (cached) {
      console.log(`[Search] Cache hit for query: "${params.query}"`);
      return cached;
    }
    
    console.log(`[Search] Processing query: "${params.query}"`);
    
    // Build base query
    const baseQuery = await buildSearchQuery(params);
    
    // Build aggregation pipeline
    const pipeline = buildAggregationPipeline(baseQuery, params);
    
    // Apply sorting
    const sortStage = buildSortStage(params.sortBy, params.order, params.query);
    pipeline.push({ $sort: sortStage });
    
    // Get total count
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Product.aggregate(countPipeline).maxTimeMS(SEARCH_CONFIG.MAX_AGGREGATION_TIME_MS);
    const totalResults = countResult.length > 0 ? countResult[0].total : 0;
    
    // Apply pagination
    const skip = (params.page - 1) * params.limit;
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: params.limit });
    
    // Execute search
    const searchResults = await Product.aggregate(pipeline).maxTimeMS(SEARCH_CONFIG.MAX_AGGREGATION_TIME_MS);
    
    // Process results
    const processedProducts = searchResults.map(product => processProduct(product));
    
    // Apply price filters
    let filteredProducts = processedProducts;
    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      filteredProducts = applyPriceFilter(processedProducts, params.minPrice, params.maxPrice);
    }
    
    // Apply on-sale filter
    if (params.onSale) {
      filteredProducts = applyOnSaleFilter(filteredProducts);
    }
    
    // Sort by price if needed
    if (params.sortBy === 'price_low' || params.sortBy === 'price_high') {
      filteredProducts = sortByPrice(filteredProducts, params.sortBy);
    }
    
    // Build final response
    const totalPages = Math.ceil(filteredProducts.length / params.limit);
    const response = {
      products: filteredProducts,
      pagination: {
        currentPage: params.page,
        totalPages,
        totalResults: filteredProducts.length,
        resultsPerPage: params.limit,
        hasNextPage: params.page < totalPages,
        hasPreviousPage: params.page > 1,
      },
      filters: await getAvailableFilters(baseQuery),
      searchMeta: {
        query: params.query,
        appliedFilters: params,
        resultsFound: filteredProducts.length,
        searchTime: Date.now() - startTime,
        fromCache: false,
      },
    };
    
    // Cache results
    searchCache.set(cacheKey, response);
    
    // Track analytics
    searchAnalytics.track(params.query, filteredProducts.length, Date.now() - startTime);
    
    console.log(`[Search] Completed in ${Date.now() - startTime}ms, found ${filteredProducts.length} products`);
    
    return response;
    
  } catch (error) {
    console.error('[Search] Error:', error);
    
    // Return empty results on error
    return {
      products: [],
      pagination: {
        currentPage: searchParams.page || 1,
        totalPages: 0,
        totalResults: 0,
        resultsPerPage: searchParams.limit || SEARCH_CONFIG.DEFAULT_LIMIT,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      filters: {},
      searchMeta: {
        query: searchParams.query,
        error: error.message,
        searchTime: Date.now() - startTime,
      },
    };
  }
};

/**
 * Validate and normalize search parameters
 */
function validateSearchParams(params) {
  return {
    query: (params.query || '').trim(),
    page: Math.max(1, parseInt(params.page) || 1),
    limit: Math.min(SEARCH_CONFIG.MAX_LIMIT, Math.max(1, parseInt(params.limit) || SEARCH_CONFIG.DEFAULT_LIMIT)),
    sortBy: ['relevance', 'price_low', 'price_high', 'rating', 'newest', 'popular', 'name'].includes(params.sortBy) 
      ? params.sortBy 
      : 'relevance',
    order: params.order === 'asc' ? 'asc' : 'desc',
    
    // Filters
    category: params.category,
    subCategory: params.subCategory,
    brand: params.brand,
    tags: params.tags,
    flavors: params.flavors,
    minPrice: params.minPrice !== undefined ? parseFloat(params.minPrice) : undefined,
    maxPrice: params.maxPrice !== undefined ? parseFloat(params.maxPrice) : undefined,
    minAbv: params.minAbv !== undefined ? parseFloat(params.minAbv) : undefined,
    maxAbv: params.maxAbv !== undefined ? parseFloat(params.maxAbv) : undefined,
    isAlcoholic: params.isAlcoholic,
    originCountry: params.originCountry,
    region: params.region,
    type: params.type,
    subType: params.subType,
    isFeatured: params.isFeatured,
    onSale: params.onSale === true || params.onSale === 'true',
    minRating: params.minRating !== undefined ? parseFloat(params.minRating) : undefined,
    inStock: params.inStock !== false && params.inStock !== 'false',
    tenantId: params.tenantId,
  };
}

/**
 * Build sort stage for aggregation
 */
function buildSortStage(sortBy, order, query) {
  const sortOrder = order === 'asc' ? 1 : -1;
  
  switch (sortBy) {
    case 'relevance':
      return query 
        ? { relevanceScore: -1, averageRating: -1, totalSold: -1 }
        : { totalSold: -1, averageRating: -1, createdAt: -1 };
    case 'rating':
      return { averageRating: sortOrder, reviewCount: -1 };
    case 'newest':
      return { createdAt: -1 };
    case 'popular':
      return { totalSold: -1, averageRating: -1 };
    case 'name':
      return { name: sortOrder };
    case 'price_low':
    case 'price_high':
      // Price sorting done post-processing
      return { name: 1 };
    default:
      return { relevanceScore: -1 };
  }
}

/**
 * Process a single product
 */
function processProduct(product) {
  const processedSubProducts = (product.subProducts || []).map(subProduct => {
    const tenant = subProduct.tenant;
    const revenueModel = tenant?.revenueModel || 'markup';
    const commissionPercentage = tenant?.commissionPercentage || 10;
    
    const processedSizes = (subProduct.sizes || []).map(size => {
      const sellingPrice = size.sellingPrice || 0;
      const costPrice = size.costPrice || subProduct.costPrice || 0;
      
      // Calculate discount
      let discount = null;
      if (size.discount && isDiscountActive(size.discount)) {
        discount = calculateDiscount(sellingPrice, size.discount, commissionPercentage);
      } else if (subProduct.discount && isDiscountActive(subProduct.discount)) {
        discount = calculateDiscount(sellingPrice, subProduct.discount, commissionPercentage);
      }
      
      // Calculate website price
      let websitePrice = discount ? discount.discountedPrice : sellingPrice;
      if (revenueModel === 'commission') {
        websitePrice = websitePrice * (1 + commissionPercentage / 100);
      }
      
      return {
        _id: size._id,
        size: size.displayName || size.size,
        volumeMl: size.volumeMl,
        sku: size.sku,
        stock: size.availableStock || size.stock || 0,
        availability: size.availability,
        price: {
          cost: costPrice,
          selling: sellingPrice,
          website: Math.round(websitePrice * 100) / 100,
          currency: size.currency || tenant?.defaultCurrency || 'NGN',
        },
        discount,
      };
    });
    
    const prices = processedSizes.map(s => s.price.website);
    
    return {
      _id: subProduct._id,
      sku: subProduct.sku,
      tenant: {
        _id: tenant?._id,
        name: tenant?.name,
        slug: tenant?.slug,
        city: tenant?.city,
        state: tenant?.state,
        country: tenant?.country,
      },
      sizes: processedSizes,
      priceRange: {
        min: Math.min(...prices),
        max: Math.max(...prices),
      },
      totalStock: processedSizes.reduce((sum, s) => sum + s.stock, 0),
    };
  });
  
  // Calculate global price range
  const allPrices = processedSubProducts.flatMap(sp => 
    sp.sizes.map(s => s.price.website)
  );
  
  const globalPriceRange = allPrices.length > 0 ? {
    min: Math.min(...allPrices),
    max: Math.max(...allPrices),
    currency: processedSubProducts[0]?.sizes[0]?.price.currency || 'NGN',
  } : { min: 0, max: 0, currency: 'NGN' };
  
  // Calculate stock info
  const totalStock = processedSubProducts.reduce((sum, sp) => sum + sp.totalStock, 0);
  
  // Calculate highest discount
  const highestDiscount = processedSubProducts
    .flatMap(sp => sp.sizes.map(s => s.discount))
    .filter(Boolean)
    .sort((a, b) => (b?.value || 0) - (a?.value || 0))[0] || null;
  
  return {
    _id: product._id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    description: product.description,
    type: product.type,
    isAlcoholic: product.isAlcoholic,
    abv: product.abv,
    volumeMl: product.volumeMl,
    originCountry: product.originCountry,
    brand: product.brand,
    category: product.category,
    subCategory: product.subCategory,
    tags: product.tags || [],
    flavors: product.flavors || [],
    images: product.images || [],
    primaryImage: product.images?.find(img => img.isPrimary) || product.images?.[0],
    status: product.status, // Include status for pending indication
    
    priceRange: globalPriceRange,
    availability: {
      status: totalStock > 0 ? 'in_stock' : 'out_of_stock',
      stockLevel: totalStock > 50 ? 'high' : totalStock > 10 ? 'medium' : totalStock > 0 ? 'low' : 'out',
      totalStock,
      tenantCount: processedSubProducts.length,
    },
    discount: highestDiscount,
    averageRating: product.averageRating || 0,
    reviewCount: product.reviewCount || 0,
    isFeatured: product.isFeatured || false,
    
    availableAt: processedSubProducts,
    relevanceScore: product.relevanceScore || 0,
  };
}

/**
 * Check if discount is active
 */
function isDiscountActive(discount) {
  if (!discount || !discount.value) return false;
  const now = new Date();
  if (discount.startDate && now < new Date(discount.startDate)) return false;
  if (discount.endDate && now > new Date(discount.endDate)) return false;
  return true;
}

/**
 * Calculate discount
 */
function calculateDiscount(price, discount, commissionPercentage) {
  let discountedPrice = price;
  
  if (discount.type === 'percentage') {
    discountedPrice = price * (1 - discount.value / 100);
  } else if (discount.type === 'fixed') {
    discountedPrice = Math.max(0, price - discount.value);
  }
  
  return {
    type: discount.type,
    value: discount.value,
    originalPrice: price,
    discountedPrice: Math.round(discountedPrice * 100) / 100,
    savings: Math.round((price - discountedPrice) * 100) / 100,
  };
}

/**
 * Apply price filter
 */
function applyPriceFilter(products, minPrice, maxPrice) {
  return products.filter(product => {
    const { min, max } = product.priceRange;
    if (minPrice !== undefined && max < minPrice) return false;
    if (maxPrice !== undefined && min > maxPrice) return false;
    return true;
  });
}

/**
 * Apply on-sale filter
 */
function applyOnSaleFilter(products) {
  return products.filter(product => 
    product.discount !== null || 
    product.availableAt.some(sp => sp.sizes.some(s => s.discount !== null))
  );
}

/**
 * Sort products by price
 */
function sortByPrice(products, sortBy) {
  return products.sort((a, b) => {
    const priceA = a.priceRange.min;
    const priceB = b.priceRange.min;
    return sortBy === 'price_low' ? priceA - priceB : priceB - priceA;
  });
}

/**
 * Get available filters
 */
async function getAvailableFilters(baseQuery) {
  try {
    const products = await Product.find(baseQuery)
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .populate('brand', 'name slug')
      .populate('tags', 'name slug displayName')
      .populate('flavors', 'name value')
      .lean();
    
    const extractUnique = (items, key) => [...new Map(
      items.filter(item => item).map(item => [item._id.toString(), item])
    ).values()];
    
    return {
      categories: extractUnique(products.map(p => p.category)),
      subCategories: extractUnique(products.map(p => p.subCategory)),
      brands: extractUnique(products.map(p => p.brand)),
      tags: extractUnique(products.flatMap(p => p.tags || [])),
      flavors: extractUnique(products.flatMap(p => p.flavors || [])),
      countries: [...new Set(products.map(p => p.originCountry).filter(Boolean))],
      types: [...new Set(products.map(p => p.type).filter(Boolean))],
    };
  } catch (error) {
    console.error('[Search] Error getting filters:', error);
    return {};
  }
}

// Export search analytics for use in other parts of the app
searchProducts.analytics = searchAnalytics;
searchProducts.cache = searchCache;
searchProducts.config = SEARCH_CONFIG;

module.exports = { searchProducts };
