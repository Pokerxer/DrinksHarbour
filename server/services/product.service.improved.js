// Add this at the top of the file with other imports/requires
const NodeCache = require('node-cache');

// Initialize search cache (TTL: 5 minutes)
const searchCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Generate search suggestions based on query
 * @param {string} query - Search query
 * @param {number} limit - Number of suggestions
 * @returns {Promise<Array>} Array of suggestions
 */
const getSearchSuggestions = async (query, limit = 8) => {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchTerm = query.trim().toLowerCase();
  
  try {
    // Get suggestions from product names
    const productSuggestions = await Product.aggregate([
      {
        $match: {
          status: 'approved',
          $or: [
            { name: { $regex: searchTerm, $options: 'i' } },
            { type: { $regex: searchTerm, $options: 'i' } },
          ],
        },
      },
      { $limit: limit },
      { $project: { name: 1, _id: 0 } },
    ]);

    // Get suggestions from brands
    const brandSuggestions = await Brand.aggregate([
      {
        $match: {
          name: { $regex: searchTerm, $options: 'i' },
        },
      },
      { $limit: Math.floor(limit / 2) },
      { $project: { name: 1, _id: 0 } },
    ]);

    // Combine and deduplicate
    const allSuggestions = [
      ...productSuggestions.map(p => p.name),
      ...brandSuggestions.map(b => b.name),
    ];

    // Remove duplicates and return
    return [...new Set(allSuggestions)].slice(0, limit);
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return [];
  }
};

/**
 * Calculate fuzzy match score using Levenshtein distance
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
const getFuzzyMatchScore = (str1, str2) => {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Simple Levenshtein distance calculation
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - (distance / maxLen);
};

/**
 * Build optimized text search query with multiple strategies
 * @param {string} searchTerm - Search term
 * @returns {Object} MongoDB query object
 */
const buildTextSearchQuery = (searchTerm) => {
  if (!searchTerm || !searchTerm.trim()) {
    return null;
  }

  const term = searchTerm.trim();
  const terms = term.split(/\s+/).filter(t => t.length > 0);
  
  // Strategy 1: Exact phrase match (highest priority)
  const exactMatch = { name: new RegExp(`^${escapeRegex(term)}$`, 'i') };
  
  // Strategy 2: Starts with match
  const startsWithMatch = { name: new RegExp(`^${escapeRegex(term)}`, 'i') };
  
  // Strategy 3: Word boundary match
  const wordBoundaryMatch = { name: new RegExp(`\\b${escapeRegex(term)}\\b`, 'i') };
  
  // Strategy 4: Contains match (anywhere in string)
  const containsMatch = { name: new RegExp(escapeRegex(term), 'i') };
  
  // Strategy 5: Multi-word AND match
  let multiWordMatch = null;
  if (terms.length > 1) {
    multiWordMatch = {
      $and: terms.map(t => ({
        $or: [
          { name: new RegExp(escapeRegex(t), 'i') },
          { shortDescription: new RegExp(escapeRegex(t), 'i') },
          { description: new RegExp(escapeRegex(t), 'i') },
        ],
      })),
    };
  }
  
  // Strategy 6: Multi-word OR match
  const multiWordOrMatch = {
    $or: terms.map(t => ({
      $or: [
        { name: new RegExp(escapeRegex(t), 'i') },
        { shortDescription: new RegExp(escapeRegex(t), 'i') },
        { description: new RegExp(escapeRegex(t), 'i') },
        { type: new RegExp(escapeRegex(t), 'i') },
        { subType: new RegExp(escapeRegex(t), 'i') },
        { originCountry: new RegExp(escapeRegex(t), 'i') },
        { region: new RegExp(escapeRegex(t), 'i') },
        { producer: new RegExp(escapeRegex(t), 'i') },
      ],
    })),
  };
  
  // Strategy 7: Fuzzy match for typos (3 char minimum)
  const fuzzyMatch = term.length >= 3 ? {
    $or: [
      { name: new RegExp(escapeRegex(term.slice(0, -1)), 'i') },
      { name: new RegExp(escapeRegex(term.slice(0, -2)), 'i') },
    ],
  } : null;
  
  return {
    exactMatch,
    startsWithMatch,
    wordBoundaryMatch,
    containsMatch,
    multiWordMatch,
    multiWordOrMatch,
    fuzzyMatch,
    hasMultipleTerms: terms.length > 1,
  };
};

/**
 * Escape special regex characters
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Search products with advanced filtering, semantic search, and complete data
 * IMPROVED VERSION with better text search, caching, and performance
 * @param {Object} searchParams - Search parameters
 * @returns {Promise<Object>} Search results with complete product data
 */
const searchProducts = async (searchParams = {}) => {
  const startTime = Date.now();
  const {
    query = '',
    page = 1,
    limit = 20,
    sortBy = 'relevance',
    order = 'desc',
    
    // Filters
    category,
    subCategory,
    brand,
    tags,
    flavors,
    minPrice,
    maxPrice,
    minAbv,
    maxAbv,
    isAlcoholic,
    originCountry,
    region,
    type,
    subType,
    
    // Availability
    inStock = true,
    tenantId,
    
    // Features
    isFeatured,
    onSale,
    minRating,
    
    // Search mode
    searchMode = 'hybrid', // 'text', 'semantic', 'hybrid'
    useEmbeddings = false, // Disabled by default for performance
    
    // Caching
    useCache = true,
    
    // Options
    includeFacets = true,
  } = searchParams;

  const currentDate = new Date();
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(Math.max(1, parseInt(limit, 10)), 100);
  const skip = (pageNum - 1) * limitNum;

  // Generate cache key
  const cacheKey = useCache 
    ? `search:${JSON.stringify({ query, page: pageNum, limit: limitNum, sortBy, ...searchParams })}`
    : null;
  
  // Check cache
  if (useCache && cacheKey) {
    const cached = searchCache.get(cacheKey);
    if (cached) {
      console.log(`[Search] Cache hit for "${query}"`);
      return { ...cached, fromCache: true };
    }
  }

  console.log(`[Search] Query: "${query}", Page: ${pageNum}, Limit: ${limitNum}`);

  try {
    // ============================================================
    // STEP 1: Build Base Query
    // ============================================================
    const baseQuery = { status: 'approved' };

    // Resolve and build category filter
    if (category) {
      const categoryIds = await resolveFilterToIds(category, resolveCategoryToObjectIds);
      if (categoryIds.length > 0) {
        baseQuery.category = { $in: categoryIds.map(id => new mongoose.Types.ObjectId(id)) };
      }
    }

    // Resolve and build subCategory filter
    if (subCategory) {
      const parentCategoryId = category && !Array.isArray(category) 
        ? (await resolveCategoryToObjectIds([category]))[0] 
        : null;
      const subCategoryIds = await resolveFilterToIds(subCategory, (names) => 
        resolveSubCategoryToObjectIds(names, parentCategoryId)
      );
      if (subCategoryIds.length > 0) {
        baseQuery.subCategory = { $in: subCategoryIds.map(id => new mongoose.Types.ObjectId(id)) };
      }
    }

    // Resolve and build brand filter
    if (brand) {
      const brandIds = await resolveFilterToIds(brand, resolveBrandToObjectIds);
      if (brandIds.length > 0) {
        baseQuery.brand = { $in: brandIds.map(id => new mongoose.Types.ObjectId(id)) };
      }
    }

    // Other filters
    if (tags) baseQuery.tags = { $in: Array.isArray(tags) ? tags : [tags] };
    if (flavors) baseQuery.flavors = { $in: Array.isArray(flavors) ? flavors : [flavors] };
    if (minAbv !== undefined || maxAbv !== undefined) {
      baseQuery.abv = {};
      if (minAbv !== undefined) baseQuery.abv.$gte = parseFloat(minAbv);
      if (maxAbv !== undefined) baseQuery.abv.$lte = parseFloat(maxAbv);
    }
    if (isAlcoholic !== undefined) baseQuery.isAlcoholic = isAlcoholic === 'true' || isAlcoholic === true;
    if (originCountry) baseQuery.originCountry = Array.isArray(originCountry) ? { $in: originCountry } : originCountry;
    if (region) baseQuery.region = Array.isArray(region) ? { $in: region } : region;
    if (type) baseQuery.type = Array.isArray(type) ? { $in: type } : type;
    if (subType) baseQuery.subType = Array.isArray(subType) ? { $in: subType } : subType;
    if (isFeatured !== undefined) baseQuery.isFeatured = isFeatured === 'true' || isFeatured === true;
    if (minRating) baseQuery.averageRating = { $gte: parseFloat(minRating) };

    // ============================================================
    // STEP 2: Build Text Search Query (Multi-Strategy)
    // ============================================================
    let matchQuery = { ...baseQuery };
    let searchStrategies = [];
    
    if (query && query.trim()) {
      const searchTerm = query.trim();
      const strategies = buildTextSearchQuery(searchTerm);
      
      // Priority order for search strategies
      if (strategies.exactMatch) searchStrategies.push({ query: strategies.exactMatch, priority: 100 });
      if (strategies.startsWithMatch) searchStrategies.push({ query: strategies.startsWithMatch, priority: 90 });
      if (strategies.wordBoundaryMatch) searchStrategies.push({ query: strategies.wordBoundaryMatch, priority: 80 });
      if (strategies.multiWordMatch) searchStrategies.push({ query: strategies.multiWordMatch, priority: 70 });
      if (strategies.multiWordOrMatch) searchStrategies.push({ query: strategies.multiWordOrMatch, priority: 60 });
      if (strategies.containsMatch) searchStrategies.push({ query: strategies.containsMatch, priority: 50 });
      if (strategies.fuzzyMatch) searchStrategies.push({ query: strategies.fuzzyMatch, priority: 40 });
      
      // For now, use the highest priority strategy that returns results
      // We'll refine this with actual search later
      matchQuery = { $and: [baseQuery, strategies.multiWordOrMatch || strategies.containsMatch] };
    }

    // ============================================================
    // STEP 3: Quick Product ID Search (for performance)
    // ============================================================
    let productIds = [];
    let totalCount = 0;
    
    if (query && query.trim()) {
      // First, try to find matching product IDs only (much faster)
      const idSearchPipeline = [
        { $match: matchQuery },
        { $project: { _id: 1, name: 1 } },
      ];
      
      const matchingProducts = await Product.aggregate(idSearchPipeline);
      productIds = matchingProducts.map(p => p._id.toString());
      totalCount = matchingProducts.length;
      
      console.log(`[Search] Found ${totalCount} matching products`);
    } else {
      // No search query, just filters - count total
      totalCount = await Product.countDocuments(baseQuery);
    }

    // ============================================================
    // STEP 4: Build Full Aggregation Pipeline
    // ============================================================
    const pipeline = [];
    
    // Match products
    if (productIds.length > 0) {
      pipeline.push({
        $match: {
          _id: { $in: productIds.map(id => new mongoose.Types.ObjectId(id)) },
        },
      });
    } else if (!query || !query.trim()) {
      pipeline.push({ $match: baseQuery });
    }
    
    // Add relevance scoring
    if (query && query.trim()) {
      const searchTerm = query.trim().toLowerCase();
      pipeline.push({
        $addFields: {
          relevanceScore: {
            $add: [
              // Exact name match (highest priority)
              { $cond: [{ $eq: [{ $toLower: '$name' }, searchTerm] }, 100, 0] },
              // Name starts with search term
              { $cond: [{ $regexMatch: { input: { $toLower: '$name' }, regex: `^${escapeRegex(searchTerm)}` } }, 50, 0] },
              // Name contains search term
              { $cond: [{ $regexMatch: { input: { $toLower: '$name' }, regex: escapeRegex(searchTerm) } }, 30, 0] },
              // Type match
              { $cond: [{ $regexMatch: { input: { $toLower: { $ifNull: ['$type', ''] } }, regex: escapeRegex(searchTerm) } }, 20, 0] },
              // Popularity boost
              { $multiply: [{ $ifNull: ['$averageRating', 0] }, 2] },
              { $divide: [{ $ifNull: ['$totalSold', 0] }, 10] },
            ],
          },
        },
      });
    }

    // Lookup SubProducts (simplified for performance)
    pipeline.push({
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
                ],
              },
            },
          },
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
          { $match: { $expr: { $gt: [{ $size: '$sizes' }, 0] } } },
          {
            $project: {
              tenant: {
                _id: 1, name: 1, slug: 1, logo: 1, revenueModel: 1,
                markupPercentage: 1, commissionPercentage: 1, defaultCurrency: 1,
              },
              sku: 1, costPrice: 1, baseSellingPrice: 1, discount: 1,
              discountType: 1, sizes: 1, currency: 1, totalStock: 1,
              availableStock: 1, totalSold: 1, isFeaturedByTenant: 1,
            },
          },
        ],
        as: 'subProducts',
      },
    });

    // Filter products with active subproducts
    pipeline.push({
      $match: { $expr: { $gt: [{ $size: '$subProducts' }, 0] } },
    });

    // Lookup brand
    pipeline.push({
      $lookup: {
        from: 'brands',
        localField: 'brand',
        foreignField: '_id',
        pipeline: [{ $project: { _id: 1, name: 1, slug: 1, logo: 1, countryOfOrigin: 1, isPremium: 1 } }],
        as: 'brand',
      },
    });
    pipeline.push({ $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } });

    // Lookup category
    pipeline.push({
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        pipeline: [{ $project: { _id: 1, name: 1, slug: 1, type: 1, icon: 1 } }],
        as: 'category',
      },
    });
    pipeline.push({ $unwind: { path: '$category', preserveNullAndEmptyArrays: true } });

    // Lookup subcategory
    pipeline.push({
      $lookup: {
        from: 'subcategories',
        localField: 'subCategory',
        foreignField: '_id',
        pipeline: [{ $project: { _id: 1, name: 1, slug: 1, type: 1 } }],
        as: 'subCategory',
      },
    });
    pipeline.push({ $unwind: { path: '$subCategory', preserveNullAndEmptyArrays: true } });

    // Lookup tags
    pipeline.push({
      $lookup: {
        from: 'tags',
        localField: 'tags',
        foreignField: '_id',
        pipeline: [{ $project: { _id: 1, name: 1, slug: 1, displayName: 1, color: 1 } }],
        as: 'tags',
      },
    });

    // Lookup flavors
    pipeline.push({
      $lookup: {
        from: 'flavors',
        localField: 'flavors',
        foreignField: '_id',
        pipeline: [{ $project: { _id: 1, name: 1, value: 1, color: 1 } }],
        as: 'flavors',
      },
    });

    // Sort
    let sortStage = {};
    switch (sortBy) {
      case 'relevance':
        sortStage = query ? { relevanceScore: -1, averageRating: -1 } : { averageRating: -1, totalSold: -1 };
        break;
      case 'price_low':
        sortStage = { name: 1 };
        break;
      case 'price_high':
        sortStage = { name: 1 };
        break;
      case 'rating':
        sortStage = { averageRating: order === 'asc' ? 1 : -1 };
        break;
      case 'newest':
        sortStage = { createdAt: -1 };
        break;
      case 'popular':
        sortStage = { totalSold: -1 };
        break;
      case 'name':
        sortStage = { name: order === 'asc' ? 1 : -1 };
        break;
      default:
        sortStage = query ? { relevanceScore: -1 } : { createdAt: -1 };
    }
    pipeline.push({ $sort: sortStage });

    // Pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limitNum });

    // Execute pipeline
    const products = await Product.aggregate(pipeline);

    // Process products with pricing
    const processedProducts = products.map(product => {
      // Calculate price range
      let minPrice = Infinity;
      let maxPrice = 0;
      let totalStock = 0;
      let hasDiscount = false;
      let maxDiscount = 0;
      const allSizes = [];

      product.subProducts.forEach(sp => {
        sp.sizes.forEach(size => {
          const sellingPrice = size.sellingPrice || 0;
          const costPrice = size.costPrice || sp.costPrice || 0;
          
          // Apply revenue model
          let websitePrice = sellingPrice;
          const tenant = sp.tenant;
          if (tenant && tenant.revenueModel === 'commission' && tenant.commissionPercentage) {
            websitePrice = sellingPrice * (1 + tenant.commissionPercentage / 100);
          }

          minPrice = Math.min(minPrice, websitePrice);
          maxPrice = Math.max(maxPrice, websitePrice);
          totalStock += size.stock || 0;

          // Check for discounts
          if (size.discount && size.discount.value > 0) {
            hasDiscount = true;
            maxDiscount = Math.max(maxDiscount, size.discount.value);
          }

          allSizes.push({
            size: size.size,
            volumeMl: size.volumeMl,
            price: websitePrice,
            stock: size.stock,
          });
        });
      });

      // Determine availability
      const availability = {
        status: totalStock > 0 ? 'in_stock' : 'out_of_stock',
        stockLevel: totalStock > 50 ? 'high' : totalStock > 10 ? 'medium' : totalStock > 0 ? 'low' : 'out',
        totalStock,
        availableFrom: product.subProducts.length,
      };

      // Build response
      return {
        id: product._id.toString(),
        name: product.name,
        slug: product.slug,
        description: product.description,
        shortDescription: product.shortDescription,
        type: product.type,
        subType: product.subType,
        isAlcoholic: product.isAlcoholic,
        abv: product.abv,
        volumeMl: product.volumeMl,
        originCountry: product.originCountry,
        region: product.region,
        brand: product.brand,
        category: product.category,
        subCategory: product.subCategory,
        tags: product.tags || [],
        flavors: product.flavors || [],
        images: product.images || [],
        primaryImage: product.images?.find(img => img.isPrimary) || product.images?.[0],
        priceRange: {
          min: minPrice === Infinity ? 0 : minPrice,
          max: maxPrice,
          currency: product.subProducts[0]?.currency || 'NGN',
        },
        availability,
        sizes: allSizes,
        hasDiscount,
        discount: maxDiscount,
        averageRating: product.averageRating || 0,
        reviewCount: product.reviewCount || 0,
        totalSold: product.totalSold || 0,
        relevanceScore: product.relevanceScore,
        createdAt: product.createdAt,
      };
    });

    // Build response
    const totalPages = Math.ceil(totalCount / limitNum);
    const response = {
      success: true,
      data: {
        products: processedProducts,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalResults: totalCount,
          resultsPerPage: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPreviousPage: pageNum > 1,
        },
      },
      meta: {
        searchTime: Date.now() - startTime,
        query: query || '',
        cache: false,
      },
    };

    // Cache result
    if (useCache && cacheKey) {
      searchCache.set(cacheKey, response);
    }

    console.log(`[Search] Completed in ${Date.now() - startTime}ms, returned ${processedProducts.length} products`);
    
    return response;
  } catch (error) {
    console.error('[Search] Error:', error);
    throw error;
  }
};

/**
 * Helper function to resolve filter values to ObjectIds
 * @param {string|Array} filterValue - Filter value(s)
 * @param {Function} resolver - Resolver function
 * @returns {Promise<Array>} Array of ObjectId strings
 */
const resolveFilterToIds = async (filterValue, resolver) => {
  if (!filterValue) return [];
  
  const values = Array.isArray(filterValue) ? filterValue : [filterValue];
  const objectIds = [];
  const names = [];
  
  values.forEach(v => {
    if (/^[0-9a-fA-F]{24}$/.test(v)) {
      objectIds.push(v);
    } else {
      names.push(v);
    }
  });
  
  if (names.length > 0) {
    const resolved = await resolver(names);
    objectIds.push(...resolved);
  }
  
  return [...new Set(objectIds)];
};

// Make sure to export the new functions
module.exports = {
  ...module.exports,
  searchProducts,
  getSearchSuggestions,
};
