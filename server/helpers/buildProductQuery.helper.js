const asyncHandler = require('express-async-handler');
const Review = require('../models/review');
const Sales = require('../models/Sales');

/**
 * Build the product query based on filters
 */
const buildProductQuery = (filters) => {
    const query = { status: 'approved' };
    
    // Text search
    if (filters.search) {
        query.$text = { $search: filters.search };
    }
    
    // Type filter
    if (filters.type) {
        query.type = filters.type;
    }
    
    // Category filter
    if (filters.category) {
        if (filters.category.match(/^[0-9a-fA-F]{24}$/)) {
            query.category = filters.category;
        } else {
            // This will be handled in the lookup stage
            query['category.slug'] = filters.category;
        }
    }
    
    // Subcategory filter
    if (filters.subCategory) {
        if (filters.subCategory.match(/^[0-9a-fA-F]{24}$/)) {
            query.subCategory = filters.subCategory;
        } else {
            query['subCategory.slug'] = filters.subCategory;
        }
    }
    
    // Brand filter - handled separately in getAllProducts using buildBrandFilter
    // Note: brand filter is resolved from name to ObjectId before query execution
    
    // Origin country filter
    if (filters.originCountry) {
        query.originCountry = filters.originCountry;
    }
    
    // ABV range filter
    if (filters.minAbv || filters.maxAbv) {
        query.abv = {};
        if (filters.minAbv) query.abv.$gte = parseFloat(filters.minAbv);
        if (filters.maxAbv) query.abv.$lte = parseFloat(filters.maxAbv);
    }
    
    // Alcoholic filter
    if (filters.isAlcoholic !== undefined) {
        query.isAlcoholic = filters.isAlcoholic === 'true';
    }
    
    return query;
};


const getProductsRatings = async (productIds) => {
  if (!productIds || !productIds.length) return {};

  try {
    const ratings = await Review.aggregate([
      {
        $match: {
          product: { $in: productIds },
          status: 'approved',
        },
      },
      {
        $group: {
          _id: '$product',
          average: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    return ratings.reduce((map, rating) => {
      map[rating._id.toString()] = {
        average: parseFloat(rating.average.toFixed(1)),
        count: rating.count,
      };
      return map;
    }, {});
  } catch (error) {
    console.error('Error fetching ratings:', error);
    return {};
  }
};

/**
 * Get product sales in bulk
 */
const getProductsSales = async (productIds) => {
  if (!productIds || !productIds.length) return {};

  try {
    const sales = await Sales.aggregate([
      {
        $match: {
          product: { $in: productIds },
          fulfillmentStatus: { $in: ['fulfilled', 'delivered'] },
        },
      },
      {
        $group: {
          _id: '$product',
          totalSold: { $sum: '$quantity' },
        },
      },
    ]);

    return sales.reduce((map, sale) => {
      map[sale._id.toString()] = sale.totalSold;
      return map;
    }, {});
  } catch (error) {
    console.error('Error fetching sales:', error);
    return {};
  }
};

/**
 * Get sort stage for aggregation
 */
const getSortStage = (sort, order) => {
    const orderVal = order === 'desc' ? -1 : 1;
    
    const sortMap = {
        'createdAt': { createdAt: orderVal },
        'updatedAt': { updatedAt: orderVal },
        'price': { 'computed.minPrice': orderVal },
        'name': { name: orderVal },
        'abv': { abv: orderVal },
        'popularity': { 'stats.totalSold': orderVal },
        'rating': { 'stats.averageRating': orderVal }
    };
    
    return sortMap[sort] || { createdAt: -1 };
};

/**
 * Process product for frontend display
 */
const processProductForDisplay = async (product, tenantMap, ratingInfo, totalSold) => {
    // Calculate price range
    const priceInfo = calculateProductPriceRange(product, tenantMap);
    
    // Calculate availability
    const availabilityInfo = calculateProductAvailability(product);
    
    // Aggregate sizes
    const sizesInfo = aggregateProductSizes(product, tenantMap);
    
    // Aggregate tenant info
    const tenantInfo = aggregateTenantInfo(product, tenantMap);
    
    // Determine badge
    const badgeInfo = determineProductBadge(product, priceInfo, availabilityInfo, totalSold);
    
    // Get primary image
    const primaryImage = product.images?.find(img => img.isPrimary) || product.images?.[0] || null;
    
    // Build processed product
    return {
        id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.shortDescription || 
                    (product.description ? product.description.substring(0, 150) + '...' : ''),
        
        // Beverage-specific attributes
        isAlcoholic: product.isAlcoholic,
        abv: product.abv,
        volumeMl: product.volumeMl,
        originCountry: product.originCountry,
        region: product.region,
        producer: product.producer,
        
        // Categorization
        type: product.type,
        subType: product.subType,
        category: product.category || null,
        subCategory: product.subCategory || null,
        
        // Brand & flavors
        brand: product.brand || null,
        flavors: product.flavors || [],
        tags: product.tags || [],
        
        // Media
        images: product.images || [],
        primaryImage: primaryImage,
        
        // Pricing & availability
        priceRange: priceInfo,
        availability: availabilityInfo,
        
        // Sizes
        sizes: sizesInfo,
        
        // Tenant information
        tenants: tenantInfo,
        
        // Badges & status
        badge: badgeInfo,
        rating: ratingInfo.average,
        reviewCount: ratingInfo.count,
        
        // Aggregated stats
        stats: {
            tenantCount: availabilityInfo.tenantCount,
            totalStock: availabilityInfo.totalStock,
            totalSold: totalSold,
            averageRating: ratingInfo.average,
            reviewCount: ratingInfo.count
        },
        
        // SEO
        metaTitle: product.metaTitle,
        metaDescription: product.metaDescription,
        
        // Dates
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        publishedAt: product.publishedAt
    };
};

/**
 * Calculate price range for a product
 */
const calculateProductPriceRange = (product, tenantMap) => {
    let minPrice = Infinity;
    let maxPrice = 0;
    const currencies = new Set();
    
    if (!product.activeSubProducts || product.activeSubProducts.length === 0) {
        return {
            min: 0,
            max: 0,
            formatted: 'Not available',
            currency: 'NGN'
        };
    }
    
    for (const subProduct of product.activeSubProducts) {
        const tenant = tenantMap[subProduct.tenant._id.toString()];
        if (!tenant) continue;
        
        const currency = tenant.defaultCurrency || 'NGN';
        currencies.add(currency);
        
        if (subProduct.sizes && subProduct.sizes.length > 0) {
            for (const size of subProduct.sizes) {
                const effectivePrice = calculateEffectivePrice(
                    size.costPrice || subProduct.costPrice,
                    size.sellingPrice,
                    tenant,
                    size.discountValue,
                    size.discountType,
                    size.discountStart,
                    size.discountEnd
                );
                
                minPrice = Math.min(minPrice, effectivePrice);
                maxPrice = Math.max(maxPrice, effectivePrice);
            }
        } else if (subProduct.stockQuantity > 0) {
            const effectivePrice = calculateEffectivePrice(
                subProduct.costPrice,
                subProduct.baseSellingPrice,
                tenant,
                subProduct.discount,
                subProduct.discountType,
                subProduct.discountStart,
                subProduct.discountEnd
            );
            
            minPrice = Math.min(minPrice, effectivePrice);
            maxPrice = Math.max(maxPrice, effectivePrice);
        }
    }
    
    // Determine primary currency (use NGN if multiple currencies)
    const primaryCurrency = currencies.size === 1 ? [...currencies][0] : 'NGN';
    
    // Format price range
    let formatted;
    if (minPrice === Infinity || maxPrice === 0) {
        formatted = 'Not available';
    } else if (minPrice === maxPrice) {
        formatted = formatPrice(minPrice, primaryCurrency);
    } else {
        formatted = `${formatPrice(minPrice, primaryCurrency)} - ${formatPrice(maxPrice, primaryCurrency)}`;
    }
    
    return {
        min: minPrice === Infinity ? 0 : minPrice,
        max: maxPrice,
        formatted,
        currency: primaryCurrency
    };
};

/**
 * Calculate effective price with discount validation
 */
const calculateEffectivePrice = (costPrice, basePrice, tenant, discountValue = 0, discountType = null, discountStart, discountEnd) => {
    let price = basePrice;
    const now = new Date();
    
    // Apply tenant revenue model
    if (tenant.revenueModel === 'markup' && tenant.markupPercentage) {
        price = costPrice * (1 + tenant.markupPercentage / 100);
    }
    
    // Apply discount if active and valid
    if (discountValue > 0 && discountType) {
        const isDiscountActive = (!discountStart || now >= new Date(discountStart)) &&
                                (!discountEnd || now <= new Date(discountEnd));
        
        if (isDiscountActive) {
            if (discountType === 'percentage') {
                price = price * (1 - discountValue / 100);
            } else if (discountType === 'fixed') {
                price = Math.max(0, price - discountValue);
            }
        }
    }
    
    return Math.round(price * 100) / 100;
};

/**
 * Format price with currency
 */
const formatPrice = (price, currency = 'NGN') => {
    try {
        const formatter = new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return formatter.format(price);
    } catch (error) {
        // Fallback formatting
        return `${currency} ${price.toFixed(2)}`;
    }
};

/**
 * Calculate product availability
 */
const calculateProductAvailability = (product) => {
    let totalStock = 0;
    let availableSizes = 0;
    const tenantIds = new Set();
    
    for (const subProduct of product.activeSubProducts || []) {
        if (subProduct.tenant) {
            tenantIds.add(subProduct.tenant._id.toString());
        }
        
        if (subProduct.sizes && subProduct.sizes.length > 0) {
            for (const size of subProduct.sizes) {
                totalStock += size.stock || 0;
                availableSizes++;
            }
        } else if (subProduct.stockQuantity > 0) {
            totalStock += subProduct.stockQuantity;
            availableSizes++;
        }
    }
    
    return {
        totalStock,
        availableSizes,
        tenantCount: tenantIds.size,
        isAvailable: totalStock > 0,
        availabilitySummary: getAvailabilitySummary(tenantIds.size, totalStock)
    };
};

/**
 * Get availability summary
 */
const getAvailabilitySummary = (tenantCount, totalStock) => {
    if (tenantCount === 0) return 'Not available yet';
    if (tenantCount === 1) return `Available from 1 shop${totalStock > 0 ? ` (${totalStock} in stock)` : ''}`;
    return `Available from ${tenantCount} shops${totalStock > 0 ? ` (${totalStock} total stock)` : ''}`;
};

/**
 * Aggregate product sizes
 */
const aggregateProductSizes = (product, tenantMap) => {
    const sizeMap = new Map();
    
    if (!product.activeSubProducts || product.activeSubProducts.length === 0) {
        return [];
    }
    
    for (const subProduct of product.activeSubProducts) {
        const tenant = tenantMap[subProduct.tenant._id.toString()];
        if (!tenant) continue;
        
        if (subProduct.sizes && subProduct.sizes.length > 0) {
            for (const size of subProduct.sizes) {
                const effectivePrice = calculateEffectivePrice(
                    size.costPrice || subProduct.costPrice,
                    size.sellingPrice,
                    tenant,
                    size.discountValue,
                    size.discountType,
                    size.discountStart,
                    size.discountEnd
                );
                
                const sizeKey = `${size.size}-${size.volumeMl || ''}`;
                
                if (!sizeMap.has(sizeKey)) {
                    sizeMap.set(sizeKey, {
                        size: size.size,
                        displayName: size.displayName || size.size,
                        volumeMl: size.volumeMl,
                        priceRange: {
                            min: effectivePrice,
                            max: effectivePrice,
                            currency: size.currency || tenant.defaultCurrency || 'NGN'
                        },
                        availability: size.availability,
                        stock: size.stock || 0,
                        isLowStock: size.stock > 0 && size.stock <= (size.lowStockThreshold || 6),
                        tenants: [{
                            id: subProduct.tenant._id,
                            name: subProduct.tenant.name,
                            slug: subProduct.tenant.slug,
                            price: effectivePrice,
                            currency: size.currency || tenant.defaultCurrency || 'NGN'
                        }]
                    });
                } else {
                    const existing = sizeMap.get(sizeKey);
                    existing.priceRange.min = Math.min(existing.priceRange.min, effectivePrice);
                    existing.priceRange.max = Math.max(existing.priceRange.max, effectivePrice);
                    existing.tenants.push({
                        id: subProduct.tenant._id,
                        name: subProduct.tenant.name,
                        slug: subProduct.tenant.slug,
                        price: effectivePrice,
                        currency: size.currency || tenant.defaultCurrency || 'NGN'
                    });
                }
            }
        }
    }
    
    return Array.from(sizeMap.values()).map(size => ({
        ...size,
        priceRange: {
            ...size.priceRange,
            formatted: size.priceRange.min === size.priceRange.max
                ? formatPrice(size.priceRange.min, size.priceRange.currency)
                : `${formatPrice(size.priceRange.min, size.priceRange.currency)} - ${formatPrice(size.priceRange.max, size.priceRange.currency)}`
        }
    }));
};

/**
 * Aggregate tenant information
 */
const aggregateTenantInfo = (product, tenantMap) => {
    const tenants = new Map();
    
    for (const subProduct of product.activeSubProducts || []) {
        if (!subProduct.tenant) continue;
        
        const tenantId = subProduct.tenant._id.toString();
        const tenant = tenantMap[tenantId];
        
        if (!tenants.has(tenantId)) {
            tenants.set(tenantId, {
                _id: subProduct.tenant._id,
                name: subProduct.tenant.name,
                slug: subProduct.tenant.slug,
                logo: subProduct.tenant.logo,
                primaryColor: subProduct.tenant.primaryColor,
                country: subProduct.tenant.country,
                city: subProduct.tenant.city,
                subdomain: `${subProduct.tenant.slug}.drinksharbour.com`,
                minPrice: Infinity,
                maxPrice: 0,
                currency: tenant?.defaultCurrency || 'NGN'
            });
        }
        
        // Calculate tenant's price range
        const tenantInfo = tenants.get(tenantId);
        
        if (subProduct.sizes && subProduct.sizes.length > 0) {
            for (const size of subProduct.sizes) {
                const effectivePrice = calculateEffectivePrice(
                    size.costPrice || subProduct.costPrice,
                    size.sellingPrice,
                    tenant,
                    size.discountValue,
                    size.discountType,
                    size.discountStart,
                    size.discountEnd
                );
                
                tenantInfo.minPrice = Math.min(tenantInfo.minPrice, effectivePrice);
                tenantInfo.maxPrice = Math.max(tenantInfo.maxPrice, effectivePrice);
            }
        } else if (subProduct.stockQuantity > 0) {
            const effectivePrice = calculateEffectivePrice(
                subProduct.costPrice,
                subProduct.baseSellingPrice,
                tenant,
                subProduct.discount,
                subProduct.discountType,
                subProduct.discountStart,
                subProduct.discountEnd
            );
            
            tenantInfo.minPrice = Math.min(tenantInfo.minPrice, effectivePrice);
            tenantInfo.maxPrice = Math.max(tenantInfo.maxPrice, effectivePrice);
        }
    }
    
    return Array.from(tenants.values()).map(tenant => ({
        ...tenant,
        minPrice: tenant.minPrice === Infinity ? 0 : tenant.minPrice,
        maxPrice: tenant.maxPrice,
        priceFormatted: tenant.minPrice === tenant.maxPrice
            ? formatPrice(tenant.minPrice, tenant.currency)
            : `${formatPrice(tenant.minPrice, tenant.currency)} - ${formatPrice(tenant.maxPrice, tenant.currency)}`
    
    }));
};

/**
 * Determine product badge
 */
const determineProductBadge = (product, priceInfo, availabilityInfo, totalSold) => {
    const now = new Date();
    const createdAt = new Date(product.createdAt);
    const updatedAt = new Date(product.updatedAt);
    
    // New arrival (within last 7 days)
    if (now.getTime() - createdAt.getTime() <= 7 * 24 * 60 * 60 * 1000) {
        return {
            type: 'new',
            text: 'New Arrival',
            color: '#10B981',
            priority: 1
        };
    }
    
    // Limited stock
    if (availabilityInfo.totalStock > 0 && availabilityInfo.totalStock <= 5) {
        return {
            type: 'limited',
            text: 'Limited Stock',
            color: '#F59E0B',
            priority: 2
        };
    }
    
    // Best seller
    if (totalSold > 100) {
        return {
            type: 'bestseller',
            text: 'Best Seller',
            color: '#EF4444',
            priority: 3
        };
    }
    
    // Recently updated (within last 3 days)
    if (now.getTime() - updatedAt.getTime() <= 3 * 24 * 60 * 60 * 1000) {
        return {
            type: 'updated',
            text: 'Recently Updated',
            color: '#3B82F6',
            priority: 4
        };
    }
    
    return null;
};



/**
 * Apply post-processing filters
 */
const applyPostFilters = (products, filters) => {
    let filtered = [...products];
    
    // Price filter
    if (filters.minPrice || filters.maxPrice) {
        const min = filters.minPrice ? parseFloat(filters.minPrice) : -Infinity;
        const max = filters.maxPrice ? parseFloat(filters.maxPrice) : Infinity;
        
        filtered = filtered.filter(product => {
            return product.priceRange.min >= min && product.priceRange.max <= max;
        });
    }
    
    // Tenant filter
    if (filters.tenant) {
        filtered = filtered.filter(product =>
            product.tenants.some(t =>
                t.slug === filters.tenant ||
                t._id.toString() === filters.tenant ||
                t.name.toLowerCase().includes(filters.tenant.toLowerCase())
            )
        );
    }
    
    // Flavor filter
    if (filters.flavor) {
        filtered = filtered.filter(product =>
            product.flavors.some(f =>
                f.value === filters.flavor ||
                f.name.toLowerCase().includes(filters.flavor.toLowerCase())
            )
        );
    }
    
    // Tag filter
    if (filters.tag) {
        filtered = filtered.filter(product =>
            product.tags.some(t =>
                t.slug === filters.tag ||
                t.name.toLowerCase().includes(filters.tag.toLowerCase())
            )
        );
    }
    
    return filtered;
};

/**
 * Build pagination object
 */
const buildPagination = (page, limit, total) => {
    const pages = Math.ceil(total / limit);
    
    return {
        page,
        limit,
        total,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1,
        nextPage: page < pages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null
    };
};


/**
 * Generate dynamic price ranges based on actual product prices
 */
const generateDynamicPriceRanges = (priceStats) => {
    if (!priceStats || !priceStats.minPrice || !priceStats.maxPrice) {
        // Fallback to sensible defaults if no price data
        return generateDefaultPriceRanges();
    }

    const minPrice = priceStats.minPrice;
    const maxPrice = priceStats.maxPrice;
    const avgPrice = priceStats.avgPrice || (minPrice + maxPrice) / 2;

    // Determine scale based on price range
    const priceRange = maxPrice - minPrice;
    
    // For very high-end products (e.g., > ₦10M)
    if (maxPrice > 10000000) {
        return generatePremiumPriceRanges(minPrice, maxPrice);
    }
    
    // For high-end products (e.g., ₦1M - ₦10M)
    if (maxPrice > 1000000) {
        return generateHighEndPriceRanges(minPrice, maxPrice);
    }
    
    // For mid-range products (e.g., ₦100K - ₦1M)
    if (maxPrice > 100000) {
        return generateMidRangePriceRanges(minPrice, maxPrice);
    }
    
    // For affordable products (< ₦100K)
    return generateAffordablePriceRanges(minPrice, maxPrice);
};

/**
 * Generate price ranges for premium beverages (₦10M+)
 */
const generatePremiumPriceRanges = (minPrice, maxPrice) => {
    const ranges = [];
    const steps = determineOptimalSteps(minPrice, maxPrice);
    
    for (let i = 0; i < steps.length - 1; i++) {
        const from = steps[i];
        const to = steps[i + 1];
        ranges.push({
            label: `${formatPriceLabel(from)} - ${formatPriceLabel(to)}`,
            min: from,
            max: to
        });
    }
    
    // Add "Over X" for the highest bracket
    const lastStep = steps[steps.length - 1];
    if (maxPrice > lastStep) {
        ranges.push({
            label: `Over ${formatPriceLabel(lastStep)}`,
            min: lastStep,
            max: null
        });
    }
    
    return ranges;
};

/**
 * Generate price ranges for high-end beverages (₦1M - ₦10M)
 */
const generateHighEndPriceRanges = (minPrice, maxPrice) => {
    return [
        { label: 'Under ₦1M', min: 0, max: 1000000 },
        { label: '₦1M - ₦2.5M', min: 1000000, max: 2500000 },
        { label: '₦2.5M - ₦5M', min: 2500000, max: 5000000 },
        { label: '₦5M - ₦10M', min: 5000000, max: 10000000 },
        ...(maxPrice > 10000000 ? [{ label: 'Over ₦10M', min: 10000000, max: null }] : [])
    ];
};

/**
 * Generate price ranges for mid-range beverages (₦100K - ₦1M)
 */
const generateMidRangePriceRanges = (minPrice, maxPrice) => {
    return [
        { label: 'Under ₦100K', min: 0, max: 100000 },
        { label: '₦100K - ₦250K', min: 100000, max: 250000 },
        { label: '₦250K - ₦500K', min: 250000, max: 500000 },
        { label: '₦500K - ₦1M', min: 500000, max: 1000000 },
        ...(maxPrice > 1000000 ? [{ label: 'Over ₦1M', min: 1000000, max: null }] : [])
    ];
};

/**
 * Generate price ranges for affordable beverages (< ₦100K)
 */
const generateAffordablePriceRanges = (minPrice, maxPrice) => {
    const ranges = [];
    
    // Dynamic affordable ranges based on actual min/max
    const stepSize = determineAffordableStepSize(maxPrice);
    
    for (let price = 0; price < maxPrice; price += stepSize) {
        const nextPrice = Math.min(price + stepSize, maxPrice);
        if (nextPrice <= price) break;
        
        ranges.push({
            label: `${formatPriceLabel(price)} - ${formatPriceLabel(nextPrice)}`,
            min: price,
            max: nextPrice
        });
    }
    
    // Add "Over X" if max is beyond our last bracket
    const lastRange = ranges[ranges.length - 1];
    if (lastRange && maxPrice > lastRange.max) {
        ranges.push({
            label: `Over ${formatPriceLabel(lastRange.max)}`,
            min: lastRange.max,
            max: null
        });
    }
    
    return ranges;
};

/**
 * Determine optimal step sizes for premium price ranges
 */
const determineOptimalSteps = (minPrice, maxPrice) => {
    const steps = [];
    const range = maxPrice - minPrice;
    
    // Use logarithmic scaling for premium products
    const start = Math.pow(10, Math.floor(Math.log10(minPrice > 0 ? minPrice : 1000)));
    let current = Math.max(minPrice, start);
    
    while (current < maxPrice) {
        steps.push(current);
        
        // Increase step size as price increases
        if (current < 1000000) {
            current *= 2; // Double for lower premium
        } else if (current < 10000000) {
            current += 2500000; // Add 2.5M increments
        } else {
            current += 5000000; // Add 5M increments for ultra-premium
        }
    }
    
    steps.push(current); // Add final step
    
    return steps;
};

/**
 * Determine step size for affordable ranges
 */
const determineAffordableStepSize = (maxPrice) => {
    if (maxPrice <= 5000) return 1000; // Under ₦5K: ₦1K steps
    if (maxPrice <= 20000) return 5000; // Under ₦20K: ₦5K steps
    if (maxPrice <= 50000) return 10000; // Under ₦50K: ₦10K steps
    if (maxPrice <= 100000) return 25000; // Under ₦100K: ₦25K steps
    return 50000; // Default: ₦50K steps
};

/**
 * Format price label for display (with abbreviations for large amounts)
 */
const formatPriceLabel = (amount) => {
    if (amount >= 1000000000) {
        return `₦${(amount / 1000000000).toFixed(1)}B`; // Billions
    } else if (amount >= 1000000) {
        return `₦${(amount / 1000000).toFixed(1)}M`; // Millions
    } else if (amount >= 1000) {
        return `₦${(amount / 1000).toFixed(0)}K`; // Thousands
    } else {
        return `₦${amount.toFixed(0)}`;
    }
};

/**
 * Generate default price ranges when no data is available
 */
const generateDefaultPriceRanges = () => {
    return [
        { label: 'Under ₦5,000', min: 0, max: 5000 },
        { label: '₦5,000 - ₦10,000', min: 5000, max: 10000 },
        { label: '₦10,000 - ₦25,000', min: 10000, max: 25000 },
        { label: '₦25,000 - ₦50,000', min: 25000, max: 50000 },
        { label: '₦50,000 - ₦100,000', min: 50000, max: 100000 },
        { label: '₦100,000 - ₦250,000', min: 100000, max: 250000 },
        { label: '₦250,000 - ₦500,000', min: 250000, max: 500000 },
        { label: '₦500,000 - ₦1M', min: 500000, max: 1000000 },
        { label: '₦1M - ₦5M', min: 1000000, max: 5000000 },
        { label: '₦5M - ₦10M', min: 5000000, max: 10000000 },
        { label: 'Over ₦10M', min: 10000000, max: null }
    ];
};



module.exports = {
    buildProductQuery,
    determineProductBadge,
    aggregateTenantInfo,
    aggregateProductSizes,
    getAvailabilitySummary,
    calculateProductAvailability,
    calculateProductPriceRange,
    processProductForDisplay,
    getSortStage,
    buildProductQuery,
    calculateEffectivePrice,
    formatPrice,
    applyPostFilters,
    buildPagination,
    generateDynamicPriceRanges,
    generatePremiumPriceRanges,
    generateHighEndPriceRanges,
    generateMidRangePriceRanges,
    generateAffordablePriceRanges,
    determineOptimalSteps,
    determineAffordableStepSize,
    formatPriceLabel,
    generateDefaultPriceRanges,
    getProductsRatings,
    getProductsSales,
};
