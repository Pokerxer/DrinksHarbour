// services/subproduct.service.js

const mongoose = require('mongoose');
const SubProduct = require('../models/subProduct');
const Product = require('../models/product');
const Size = require('../models/size');
const Tenant = require('../models/tenant');
const { 
  NotFoundError, 
  ValidationError, 
  ForbiddenError,
  ConflictError 
} = require('../utils/errors');
const { generateSKU } = require('../utils/skuGenerator');

/**
 * Check if MongoDB supports transactions (replica set or sharded cluster)
 */
const isTransactionSupported = () => {
  try {
    // Check if we're connected to a replica set or mongos
    const conn = mongoose.connection;
    // If client is available and topology is known
    if (conn && conn.client && conn.client.topology) {
      const topology = conn.client.topology;
      // Transactions are supported in replica sets and sharded clusters
      return topology.type === 'ReplicaSet' || topology.type === 'Sharded';
    }
    return false;
  } catch (error) {
    return false;
  }
};

/**
 * Calculate selling price based on tenant revenue model
 * Automatically applies markup or handles commission model
 */
const calculatePriceFromRevenueModel = async (costPrice, tenantId) => {
  const tenant = await Tenant.findById(tenantId);
  
  if (!tenant) {
    throw new NotFoundError('Tenant not found');
  }
  
  let baseSellingPrice;
  let marginPercentage;
  
  if (tenant.revenueModel === 'markup') {
    // Calculate selling price from cost + markup percentage
    const markupPercent = tenant.markupPercentage || 25;
    baseSellingPrice = costPrice * (1 + markupPercent / 100);
    
    // Calculate actual margin
    marginPercentage = ((baseSellingPrice - costPrice) / baseSellingPrice * 100).toFixed(2);
  } else if (tenant.revenueModel === 'commission') {
    // For commission model, platform sets price
    // Tenant gets commission on sales
    // For now, use a default 30% markup
    baseSellingPrice = costPrice * 1.3;
    marginPercentage = ((baseSellingPrice - costPrice) / baseSellingPrice * 100).toFixed(2);
  } else {
    // Default to markup model with 25%
    baseSellingPrice = costPrice * 1.25;
    marginPercentage = 20;
  }
  
  return {
    baseSellingPrice: parseFloat(baseSellingPrice.toFixed(2)),
    costPrice,
    marginPercentage: parseFloat(marginPercentage),
    revenueModel: tenant.revenueModel,
    markupPercentage: tenant.markupPercentage,
    commissionPercentage: tenant.commissionPercentage,
  };
};


/**
 * Get tenant's SubProducts with filters
 */
const getMySubProducts = async (tenantId, options) => {
  const {
    page = 1,
    limit = 20,
    status,
    search,
    sort = 'createdAt',
    order = 'desc',
  } = options;

  // Validate pagination
  const pageNum = Math.max(1, page);
  const limitNum = Math.min(Math.max(1, limit), 100);
  const skip = (pageNum - 1) * limitNum;

  // Build query
  const query = { tenant: tenantId };

  if (status) {
    query.status = status;
  }

  // Search across product name and SKU
  if (search && search.trim().length > 0) {
    query.$or = [
      { sku: new RegExp(search, 'i') },
    ];
  }

  // Build sort
  const sortOrder = order === 'desc' ? -1 : 1;
  const sortMap = {
    createdAt: { createdAt: sortOrder },
    updatedAt: { updatedAt: sortOrder },
    sku: { sku: sortOrder },
    totalSold: { totalSold: sortOrder },
    totalRevenue: { totalRevenue: sortOrder },
  };
  const sortOptions = sortMap[sort] || { createdAt: -1 };

  // Execute queries in parallel
  const [total, subProducts] = await Promise.all([
    SubProduct.countDocuments(query),
    SubProduct.find(query)
      .populate({
        path: 'product',
        select: 'name slug type images isAlcoholic abv volumeMl brand category status',
        populate: [
          { path: 'brand', select: 'name slug logo' },
          { path: 'category', select: 'name slug' },
        ],
      })
      .populate({
        path: 'sizes',
        select: 'size displayName sellingPrice stock availability lowStockThreshold',
      })
      .select('-embeddingOverride') // Exclude large fields
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ]);

  // Calculate statistics
  const stats = {
    total,
    active: await SubProduct.countDocuments({ tenant: tenantId, status: 'active' }),
    lowStock: await SubProduct.countDocuments({
      tenant: tenantId,
      status: 'active',
      'sizes.stock': { $lte: 10 },
    }),
    outOfStock: await SubProduct.countDocuments({
      tenant: tenantId,
      status: 'out_of_stock',
    }),
  };

  return {
    subProducts,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
      hasNext: pageNum < Math.ceil(total / limitNum),
      hasPrev: pageNum > 1,
    },
    stats,
  };
};

/**
 * Core logic for creating SubProduct (works with or without session)
 */
const createSubProductCore = async (data, tenantId, user, session = null) => {
  // Handle both direct data and nested subProductData format from frontend
  const subProductData = data.subProductData || data;

  // ========================================================================
  // DEBUG: Log received data
  // ========================================================================
  console.log('📥 Backend received subProductData:', {
    product: subProductData.product,
    createNewProduct: subProductData.createNewProduct,
    newProductData: subProductData.newProductData ? { 
      name: subProductData.newProductData.name, 
      type: subProductData.newProductData.type 
    } : null
  });
  // ========================================================================

  // ========================================================================
  // AUTO-USE SYSTEM TENANT FOR SUPER ADMIN
  // If user is super_admin, automatically use the system tenant
  // ========================================================================
  if (user && user.role === 'super_admin') {
    const systemTenant = await Tenant.findOne({ isSystemTenant: true }).select('_id').lean();
    if (systemTenant) {
      tenantId = systemTenant._id.toString();
      console.log('🔧 Super admin detected - using system tenant:', tenantId);
    }
  }
  // ========================================================================

  const {
    product: productInput,
    costPrice,
    currency = 'NGN',
    taxRate = 0,
    sizes = [],
    sellWithoutSizeVariants = false,
    shortDescriptionOverride,
    descriptionOverride,
    imagesOverride = [],
    customKeywords = [],
    embeddingOverride = [],
    tenantNotes = '',
    stockStatus = 'in_stock',
    totalStock = 0,
    reservedStock = 0,
    availableStock = 0,
    lowStockThreshold = 10,
    reorderPoint = 5,
    reorderQuantity = 50,
    lastRestockDate,
    nextRestockDate,
    vendor,
    supplierSKU,
    supplierPrice,
    leadTimeDays,
    minimumOrderQuantity,
    status = 'draft',
    isFeaturedByTenant = false,
    isNewArrival = false,
    isBestSeller = false,
    activatedAt,
    deactivatedAt,
    discontinuedAt,
    discount = 0,
    discountType,
    discountStart,
    discountEnd,
    flashSale,
    bundleDeals = [],
    shipping = {},
    warehouse = {},
  } = subProductData;

  // Extract product ID - handle both string ID and object with _id
  const productId = typeof productInput === 'object' ? productInput?._id || productInput?.id : productInput;
  const createNewProduct = subProductData.createNewProduct || false;
  const newProductData = subProductData.newProductData || null;

  console.log('🔍 After extraction:', { productId, createNewProduct: !!createNewProduct, hasNewProductData: !!newProductData });

  // Validate required fields
  if (!productId && !createNewProduct) {
    throw new ValidationError('Product ID is required');
  }

  if (!costPrice || costPrice <= 0) {
    throw new ValidationError('Valid cost price is required');
  }

  // Convert to ObjectId if needed
  const { ObjectId } = require('mongoose').Types;
  const tenantObjectId = new ObjectId(tenantId);
  let productObjectId;
  let product;

  if (productId) {
    productObjectId = new ObjectId(productId);
    const tenantObjectId = new ObjectId(tenantId);

    // Allow super_admin to select pending products, others require approved
    const statusFilter = user?.role === 'super_admin' 
      ? { $in: ['approved', 'pending'] }
      : 'approved';

    // Verify product exists and is approved (or pending for super_admin)
    const productQuery = Product.findOne({
      _id: productObjectId,
      status: statusFilter,
    }).lean();
    
    if (session) {
      productQuery.session(session);
    }
    
    product = await productQuery;
  } else if (createNewProduct && newProductData) {
    // Create new Product if product doesn't exist
    console.log('🔧 Creating new Product from SubProduct form...');
    
    if (!newProductData.name || !newProductData.type) {
      throw new ValidationError('Product name and type are required to create a new product');
    }
    
    // Generate slug from name
    const slug = newProductData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Handle brand - look up existing brand or prepare for creation
    let brandId = null;
    if (newProductData.brand && typeof newProductData.brand === 'string' && newProductData.brand.trim()) {
      try {
        const Brand = require('../models/Brand');
        let existingBrand = await Brand.findOne({ 
          $or: [
            { name: { $regex: new RegExp(`^${newProductData.brand}$`, 'i') } },
            { slug: new RegExp(newProductData.brand.toLowerCase().replace(/\s+/g, '-'), 'i') }
          ]
        }).select('_id').lean();
        
        if (existingBrand) {
          brandId = existingBrand._id;
        } else {
          // Create new brand if it doesn't exist
          const newBrand = await Brand.create({
            name: newProductData.brand.trim(),
            slug: newProductData.brand.toLowerCase().replace(/\s+/g, '-'),
            status: 'active',
          });
          brandId = newBrand._id;
        }
      } catch (brandError) {
        console.log('⚠️ Brand lookup/creation failed:', brandError.message);
      }
    }
    
    // Handle category lookup - support both ObjectId and name
    let categoryId = null;
    if (newProductData.category && typeof newProductData.category === 'string' && newProductData.category.trim()) {
      try {
        const Category = require('../models/Category');
        
        // Check if it's a valid 24-character hex ObjectId
        const isObjectId = ObjectId.isValid(newProductData.category) && 
          /^[0-9a-fA-F]{24}$/.test(newProductData.category);
        
        let existingCategory;
        if (isObjectId) {
          // If it's an ObjectId, find by ID
          existingCategory = await Category.findById(newProductData.category).select('_id').lean();
        } else {
          // If it's a name, search by name/slug
          existingCategory = await Category.findOne({ 
            $or: [
              { name: { $regex: new RegExp(`^${newProductData.category}$`, 'i') } },
              { slug: new RegExp(newProductData.category.toLowerCase().replace(/\s+/g, '-'), 'i') }
            ]
          }).select('_id').lean();
        }
        
        if (existingCategory) {
          categoryId = existingCategory._id;
        }
      } catch (categoryError) {
        console.log('⚠️ Category lookup failed:', categoryError.message);
      }
    }
    
    // Handle subCategory lookup - support both ObjectId and name
    let subCategoryId = null;
    if (newProductData.subCategory && typeof newProductData.subCategory === 'string' && newProductData.subCategory.trim()) {
      try {
        const Category = require('../models/Category');
        
        // Check if it's a valid 24-character hex ObjectId
        const isObjectId = ObjectId.isValid(newProductData.subCategory) && 
          /^[0-9a-fA-F]{24}$/.test(newProductData.subCategory);
        
        let existingSubCategory;
        if (isObjectId) {
          // If it's an ObjectId, find by ID
          existingSubCategory = await Category.findById(newProductData.subCategory).select('_id').lean();
        } else {
          // If it's a name, search by name/slug
          existingSubCategory = await Category.findOne({ 
            $or: [
              { name: { $regex: new RegExp(`^${newProductData.subCategory}$`, 'i') } },
              { slug: new RegExp(newProductData.subCategory.toLowerCase().replace(/\s+/g, '-'), 'i') }
            ]
          }).select('_id').lean();
        }
        
        if (existingSubCategory) {
          subCategoryId = existingSubCategory._id;
        }
      } catch (subCategoryError) {
        console.log('⚠️ SubCategory lookup failed:', subCategoryError.message);
      }
    }
    
    // Convert volumeMl and abv to numbers if they're strings
    const volumeMlValue = newProductData.volumeMl 
      ? (typeof newProductData.volumeMl === 'number' ? newProductData.volumeMl : parseInt(newProductData.volumeMl, 10))
      : null;
    const abvValue = newProductData.abv 
      ? (typeof newProductData.abv === 'number' ? newProductData.abv : parseFloat(newProductData.abv))
      : null;
    const proofValue = newProductData.proof 
      ? (typeof newProductData.proof === 'number' ? newProductData.proof : parseInt(newProductData.proof, 10))
      : null;
    const vintageValue = newProductData.vintage 
      ? (typeof newProductData.vintage === 'number' ? newProductData.vintage : parseInt(newProductData.vintage, 10))
      : null;
    
    const productPayload = {
      name: newProductData.name,
      slug: `${slug}-${Date.now()}`,
      type: newProductData.type,
      subType: newProductData.subType || '',
      brand: brandId,
      volumeMl: volumeMlValue,
      abv: abvValue,
      proof: proofValue,
      barcode: newProductData.barcode || '',
      category: categoryId,
      subCategory: subCategoryId,
      originCountry: newProductData.originCountry || '',
      region: newProductData.region || '',
      producer: newProductData.producer || '',
      style: newProductData.style || '',
      vintage: vintageValue,
      description: newProductData.description || '',
      shortDescription: newProductData.shortDescription || '',
      isAlcoholic: newProductData.isAlcoholic !== false,
      status: 'pending', // Set to pending - requires admin approval
      isFeatured: false,
      allowReviews: true,
      requiresAgeVerification: newProductData.isAlcoholic !== false,
      addedAt: new Date(),
      metadata: {
        createdBy: user?._id,
        source: 'tenant_subproduct_form',
      },
    };
    
    // Create the product
    let createdProduct;
    if (session) {
      const products = await Product.create([productPayload], { session });
      createdProduct = products[0];
    } else {
      createdProduct = await Product.create(productPayload);
    }
    
    productObjectId = createdProduct._id;
    product = createdProduct.toObject();
    
    console.log('✅ New Product created with ID:', productObjectId.toString());
  } else {
    throw new ValidationError('Product ID is required');
  }

  if (!product) {
    throw new NotFoundError('Product not found or not approved');
  }

  // Check if SubProduct already exists for this tenant
  console.log('🔍 DEBUG: Checking for existing SubProduct:');
  console.log('  productObjectId:', productObjectId);
  console.log('  tenantObjectId:', tenantObjectId);
  console.log('  productObjectId type:', typeof productObjectId);
  console.log('  tenantObjectId type:', typeof tenantObjectId);
  console.log('  productObjectId.toString():', productObjectId.toString());
  console.log('  tenantObjectId.toString():', tenantObjectId.toString());
  
  // First, try to find ALL subproducts for this tenant to debug
  const allTenantSubProducts = await SubProduct.find({
    tenant: tenantObjectId
  }).select('product sku createdAt').lean();
  
  console.log('🔍 DEBUG: All SubProducts for tenant:', allTenantSubProducts.length);
  allTenantSubProducts.forEach((sp, i) => {
    console.log(`  ${i + 1}. Product: ${sp.product}, SKU: ${sp.sku}, Created: ${sp.createdAt}`);
  });
  
  const existingQuery = SubProduct.findOne({
    product: productObjectId,
    tenant: tenantObjectId,
  }).lean();
  
  if (session) {
    existingQuery.session(session);
  }
  
  const existingSubProduct = await existingQuery;
  
  console.log('🔍 DEBUG: Existing SubProduct found:', existingSubProduct ? 'YES' : 'NO');
  if (existingSubProduct) {
    console.log('  Existing SubProduct details:', {
      _id: existingSubProduct._id,
      product: existingSubProduct.product,
      tenant: existingSubProduct.tenant,
      sku: existingSubProduct.sku,
      createdAt: existingSubProduct.createdAt
    });
    throw new ConflictError(
      'This product is already in your catalog. Please update the existing listing instead.'
    );
  }

  // Always generate SKU server-side (ignore client-provided value for consistency)
  const generatedSKU = await generateSKU(productObjectId, tenantObjectId);

  // Calculate pricing based on tenant revenue model
  const pricing = await calculatePriceFromRevenueModel(costPrice, tenantId);

  // Prepare SubProduct data
  const subProductPayload = {
    product: productObjectId,
    tenant: tenantObjectId,
    sku: generatedSKU,
    baseSellingPrice: pricing.baseSellingPrice,
    costPrice: pricing.costPrice,
    currency,
    taxRate,
    marginPercentage: pricing.marginPercentage,
    markupPercentage: pricing.markupPercentage,
    roundUp: 'none',
    saleDiscountPercentage: 0,
    salePrice: null,
    saleStartDate: null,
    saleEndDate: null,
    saleType: null,
    saleDiscountValue: null,
    saleBanner: { url: '', alt: '' },
    isOnSale: false,
    shortDescriptionOverride,
    descriptionOverride,
    imagesOverride,
    customKeywords,
    embeddingOverride,
    tenantNotes,
    status,
    isFeaturedByTenant,
    isNewArrival,
    isBestSeller,
    activatedAt: activatedAt ? new Date(activatedAt) : (status === 'active' ? new Date() : null),
    deactivatedAt: deactivatedAt ? new Date(deactivatedAt) : null,
    discontinuedAt: discontinuedAt ? new Date(discontinuedAt) : null,
    sellWithoutSizeVariants,
    defaultSize: null,
    stockStatus,
    totalStock,
    reservedStock,
    availableStock,
    lowStockThreshold,
    reorderPoint,
    reorderQuantity,
    lastRestockDate: lastRestockDate ? new Date(lastRestockDate) : null,
    nextRestockDate: nextRestockDate ? new Date(nextRestockDate) : null,
    vendor: vendor && vendor !== '' ? vendor : null,
    supplierSKU,
    supplierPrice,
    leadTimeDays,
    minimumOrderQuantity,
    shipping: {
      weight: shipping?.weight,
      length: shipping?.length,
      width: shipping?.width,
      height: shipping?.height,
      fragile: shipping?.fragile ?? true,
      requiresAgeVerification: shipping?.requiresAgeVerification ?? true,
      hazmat: shipping?.hazmat ?? false,
      shippingClass: shipping?.shippingClass || '',
    },
    warehouse: {
      location: warehouse?.location || '',
      zone: warehouse?.zone || '',
      aisle: warehouse?.aisle || '',
      shelf: warehouse?.shelf || '',
      bin: warehouse?.bin || '',
    },
    discount,
    discountType: discountType && ['fixed', 'percentage'].includes(discountType) ? discountType : null,
    discountStart: discountStart ? new Date(discountStart) : null,
    discountEnd: discountEnd ? new Date(discountEnd) : null,
    flashSale: flashSale || {
      isActive: false,
      startDate: null,
      endDate: null,
      discountPercentage: null,
      remainingQuantity: null,
    },
    bundleDeals,
    addedAt: new Date(),
    metadata: {
      createdBy: user?._id,
      lastModifiedBy: user?._id,
      revenueModel: pricing.revenueModel,
      markupPercentage: pricing.markupPercentage,
      commissionPercentage: pricing.commissionPercentage,
    },
  };

  // Create SubProduct
  let createdSubProduct;
  if (session) {
    const subProduct = await SubProduct.create([subProductPayload], { session });
    createdSubProduct = subProduct[0];
  } else {
    createdSubProduct = await SubProduct.create(subProductPayload);
  }

  // Create sizes if provided and not selling without variants
  if (!sellWithoutSizeVariants && sizes && sizes.length > 0) {
    const createdSizes = session 
      ? await createSizeVariantsWithTransaction(sizes, createdSubProduct._id, currency, tenantId, session)
      : await createSizeVariantsWithoutTransaction(sizes, createdSubProduct._id, currency, tenantId);
    
    createdSubProduct.sizes = createdSizes.map((s) => s._id);
    
    // Calculate total stock from sizes
    const totalSizeStock = createdSizes.reduce((sum, s) => sum + (s.stock || 0), 0);
    createdSubProduct.totalStock = totalSizeStock;
    
    // Determine availability based on sizes
    if (totalSizeStock === 0) {
      createdSubProduct.stockStatus = 'out_of_stock';
      createdSubProduct.availableStock = 0;
    } else if (totalSizeStock <= lowStockThreshold) {
      createdSubProduct.stockStatus = 'low_stock';
      createdSubProduct.availableStock = totalSizeStock;
    } else {
      createdSubProduct.stockStatus = 'in_stock';
      createdSubProduct.availableStock = totalSizeStock;
    }
    
    // Set default size
    const defaultSizeVariant = createdSizes.find(s => s.isDefault) || createdSizes[0];
    if (defaultSizeVariant) {
      createdSubProduct.defaultSize = defaultSizeVariant._id;
    }
    
    if (session) {
      await createdSubProduct.save({ session });
    } else {
      await createdSubProduct.save();
    }
  } else if (sellWithoutSizeVariants) {
    // If selling without variants, set stock from parent
    createdSubProduct.availableStock = totalStock;
    if (totalStock === 0) {
      createdSubProduct.stockStatus = 'out_of_stock';
    } else if (totalStock <= lowStockThreshold) {
      createdSubProduct.stockStatus = 'low_stock';
    } else {
      createdSubProduct.stockStatus = 'in_stock';
    }
    
    if (session) {
      await createdSubProduct.save({ session });
    } else {
      await createdSubProduct.save();
    }
  }

  // Update product tenant count
  const productUpdate = {
    $inc: { tenantCount: 1 },
    $addToSet: { subProducts: createdSubProduct._id },
  };
  
  if (session) {
    await Product.findByIdAndUpdate(productId, productUpdate, { session });
  } else {
    await Product.findByIdAndUpdate(productId, productUpdate);
  }

  // Update tenant stats
  const tenantUpdate = { $inc: { productCount: 1 } };
  if (status === 'active') {
    tenantUpdate.$inc.activeSubProductCount = 1;
  }
  
  if (session) {
    await Tenant.findByIdAndUpdate(tenantId, tenantUpdate, { session });
  } else {
    await Tenant.findByIdAndUpdate(tenantId, tenantUpdate);
  }

  // Send notification to super-admin if a new product was created (status: pending)
  if (createNewProduct && product && product.status === 'pending') {
    try {
      const { sendNewProductPendingNotification } = require('../services/notification.service');
      setImmediate(async () => {
        await sendNewProductPendingNotification(productObjectId, tenantObjectId);
      });
    } catch (notificationError) {
      console.error('⚠️ Failed to send new product notification:', notificationError.message);
    }
  }

  return createdSubProduct;
};

/**
 * Create SubProduct (link product to tenant catalog)
 * Supports both transactional (replica set) and non-transactional (standalone) MongoDB
 */
const createSubProduct = async (data, tenantId, user) => {
  try {
    let createdSubProduct;

    // Check if transactions are supported
    if (isTransactionSupported()) {
      // Use transactions for atomic operations
      const session = await mongoose.startSession();
      
      try {
        createdSubProduct = await session.withTransaction(async () => {
          return await createSubProductCore(data, tenantId, user, session);
        });
      } finally {
        session.endSession();
      }
    } else {
      // Fallback to non-transactional execution for standalone MongoDB
      console.log('MongoDB transactions not supported, using non-transactional mode');
      createdSubProduct = await createSubProductCore(data, tenantId, user, null);
    }

    // Populate and return with comprehensive size data
    const populatedSubProduct = await SubProduct.findById(createdSubProduct._id)
      .populate({
        path: 'product',
        select: 'name slug type images isAlcoholic abv volumeMl brand category',
        populate: [
          { path: 'brand', select: 'name slug logo' },
          { path: 'category', select: 'name slug' },
        ],
      })
      .populate({
        path: 'sizes',
        select: 'size displayName unitType sellingPrice costPrice stock availability markupPercentage roundUp saleDiscountPercentage salePrice compareAtPrice wholesalePrice sku barcode volumeMl weightGrams lowStockThreshold reorderPoint reorderQuantity isDefault isOnSale rank',
      })
      .populate({
        path: 'vendor',
        select: 'name contactPerson email phone',
      })
      .lean();

    return {
      ...populatedSubProduct,
      sizes: populatedSubProduct.sizes || [],
    };

  } catch (error) {
    // Handle specific error types
    if (error.name === 'ValidationError' || error.name === 'NotFoundError' || error.name === 'ConflictError') {
      throw error;
    }
    throw new Error(`Failed to create SubProduct: ${error.message}`);
  }
};


/**
 * Get single SubProduct details
 */
const getSubProduct = async (subProductId, tenantId) => {
  if (!/^[0-9a-fA-F]{24}$/.test(subProductId)) {
    throw new ValidationError('Invalid SubProduct ID');
  }

  const subProduct = await SubProduct.findOne({
    _id: subProductId,
    tenant: tenantId,
  })
    .populate({
      path: 'product',
      select: 'name slug type images isAlcoholic abv volumeMl originCountry brand category subCategory tags flavors description tastingNotes',
      populate: [
        { path: 'brand', select: 'name slug logo description' },
        { path: 'category', select: 'name slug type' },
        { path: 'subCategory', select: 'name slug' },
        { path: 'tags', select: 'name slug type color' },
        { path: 'flavors', select: 'name value color' },
      ],
    })
    .populate({
      path: 'sizes',
      select: 'size displayName unitType sellingPrice costPrice compareAtPrice stock lowStockThreshold availability sku barcode weightGrams volumeMl discountValue discountType discountStart discountEnd totalSold',
    })
    .populate({
      path: 'vendor',
      select: 'name contactPerson email phone',
    })
    .lean();

  if (!subProduct) {
    throw new NotFoundError('Product not found in your catalog');
  }

  return subProduct;
};

/**
 * Update SubProduct
 * Handles all updatable fields including pricing, inventory, shipping, warehouse, sizes, etc.
 */
const updateSubProduct = async (subProductId, updateData, tenantId, user = null) => {
  if (!/^[0-9a-fA-F]{24}$/.test(subProductId)) {
    throw new ValidationError('Invalid SubProduct ID');
  }

  const { ObjectId } = require('mongoose').Types;
  const tenantObjectId = new ObjectId(tenantId);

  const subProduct = await SubProduct.findOne({
    _id: subProductId,
    tenant: tenantObjectId,
  });

  if (!subProduct) {
    throw new NotFoundError('Product not found in your catalog');
  }

  // Handle both direct data and nested subProductData format from frontend
  const data = updateData.subProductData || updateData;

  console.log('📥 UpdateSubProduct received data keys:', Object.keys(data));

  // ========================================================================
  // PRICING FIELDS
  // ========================================================================
  if (data.baseSellingPrice !== undefined) {
    if (data.baseSellingPrice <= 0) {
      throw new ValidationError('Base selling price must be greater than 0');
    }
    subProduct.baseSellingPrice = data.baseSellingPrice;
  }

  if (data.costPrice !== undefined) {
    if (data.costPrice <= 0) {
      throw new ValidationError('Cost price must be greater than 0');
    }
    subProduct.costPrice = data.costPrice;
    
    // Recalculate margin when cost price changes
    if (subProduct.baseSellingPrice > 0) {
      subProduct.marginPercentage = ((subProduct.baseSellingPrice - data.costPrice) / subProduct.baseSellingPrice * 100).toFixed(2);
    }
  }

  if (data.currency !== undefined) {
    const validCurrencies = ['NGN', 'USD', 'EUR', 'GBP'];
    if (!validCurrencies.includes(data.currency)) {
      throw new ValidationError('Invalid currency');
    }
    subProduct.currency = data.currency;
  }

  if (data.taxRate !== undefined) {
    subProduct.taxRate = data.taxRate;
  }

  if (data.markupPercentage !== undefined) {
    subProduct.markupPercentage = data.markupPercentage;
    // Recalculate selling price based on new markup
    if (subProduct.costPrice > 0) {
      let newPrice = subProduct.costPrice * (1 + (data.markupPercentage / 100));
      if (subProduct.roundUp && subProduct.roundUp !== 'none') {
        if (subProduct.roundUp === '100') {
          newPrice = Math.ceil(newPrice / 100) * 100;
        } else if (subProduct.roundUp === '1000') {
          newPrice = Math.ceil(newPrice / 1000) * 1000;
        }
      }
      subProduct.baseSellingPrice = Number(newPrice.toFixed(2));
    }
  }

  if (data.roundUp !== undefined) {
    subProduct.roundUp = data.roundUp;
  }

  // ========================================================================
  // SALE/DISCOUNT FIELDS
  // ========================================================================
  if (data.isOnSale !== undefined) {
    subProduct.isOnSale = data.isOnSale;
  }

  if (data.salePrice !== undefined) {
    subProduct.salePrice = data.salePrice;
  }

  if (data.saleDiscountPercentage !== undefined) {
    subProduct.saleDiscountPercentage = data.saleDiscountPercentage;
  }

  if (data.saleType !== undefined) {
    subProduct.saleType = data.saleType;
  }

  if (data.saleDiscountValue !== undefined) {
    subProduct.saleDiscountValue = data.saleDiscountValue;
  }

  if (data.saleBanner !== undefined) {
    subProduct.saleBanner = {
      url: data.saleBanner?.url || '',
      alt: data.saleBanner?.alt || ''
    };
  }

  if (data.saleStartDate !== undefined) {
    subProduct.saleStartDate = data.saleStartDate ? new Date(data.saleStartDate) : null;
  }

  if (data.saleEndDate !== undefined) {
    subProduct.saleEndDate = data.saleEndDate ? new Date(data.saleEndDate) : null;
  }

  // ========================================================================
  // OVERRIDE FIELDS
  // ========================================================================
  if (data.shortDescriptionOverride !== undefined) {
    subProduct.shortDescriptionOverride = data.shortDescriptionOverride;
  }

  if (data.descriptionOverride !== undefined) {
    subProduct.descriptionOverride = data.descriptionOverride;
  }

  if (data.imagesOverride !== undefined) {
    subProduct.imagesOverride = data.imagesOverride;
  }

  if (data.customKeywords !== undefined) {
    subProduct.customKeywords = data.customKeywords;
  }

  if (data.embeddingOverride !== undefined) {
    subProduct.embeddingOverride = data.embeddingOverride;
  }

  if (data.tenantNotes !== undefined) {
    subProduct.tenantNotes = data.tenantNotes;
  }

  // ========================================================================
  // STATUS & VISIBILITY FIELDS
  // ========================================================================
  if (data.status !== undefined) {
    const validStatuses = ['pending', 'active', 'low_stock', 'out_of_stock', 'discontinued', 'hidden', 'draft', 'archived'];
    if (!validStatuses.includes(data.status)) {
      throw new ValidationError('Invalid status');
    }
    
    const oldStatus = subProduct.status;
    subProduct.status = data.status;

    // Update tenant counts
    if (oldStatus === 'active' && data.status !== 'active') {
      await Tenant.findByIdAndUpdate(tenantId, {
        $inc: { activeSubProductCount: -1 },
      });
    } else if (oldStatus !== 'active' && data.status === 'active') {
      await Tenant.findByIdAndUpdate(tenantId, {
        $inc: { activeSubProductCount: 1 },
      });
    }
  }

  if (data.isFeaturedByTenant !== undefined) {
    subProduct.isFeaturedByTenant = data.isFeaturedByTenant;
  }

  if (data.isNewArrival !== undefined) {
    subProduct.isNewArrival = data.isNewArrival;
  }

  if (data.isBestSeller !== undefined) {
    subProduct.isBestSeller = data.isBestSeller;
  }

  if (data.activatedAt !== undefined) {
    subProduct.activatedAt = data.activatedAt ? new Date(data.activatedAt) : null;
  }

  if (data.deactivatedAt !== undefined) {
    subProduct.deactivatedAt = data.deactivatedAt ? new Date(data.deactivatedAt) : null;
  }

  if (data.discontinuedAt !== undefined) {
    subProduct.discontinuedAt = data.discontinuedAt ? new Date(data.discontinuedAt) : null;
  }

  // ========================================================================
  // INVENTORY FIELDS
  // ========================================================================
  if (data.stockStatus !== undefined) {
    const validStockStatuses = ['in_stock', 'low_stock', 'out_of_stock', 'pre_order', 'discontinued'];
    if (!validStockStatuses.includes(data.stockStatus)) {
      throw new ValidationError('Invalid stock status');
    }
    subProduct.stockStatus = data.stockStatus;
  }

  if (data.totalStock !== undefined) {
    subProduct.totalStock = data.totalStock;
  }

  if (data.reservedStock !== undefined) {
    subProduct.reservedStock = data.reservedStock;
  }

  if (data.availableStock !== undefined) {
    subProduct.availableStock = data.availableStock;
  }

  if (data.lowStockThreshold !== undefined) {
    subProduct.lowStockThreshold = data.lowStockThreshold;
  }

  if (data.reorderPoint !== undefined) {
    subProduct.reorderPoint = data.reorderPoint;
  }

  if (data.reorderQuantity !== undefined) {
    subProduct.reorderQuantity = data.reorderQuantity;
  }

  if (data.lastRestockDate !== undefined) {
    subProduct.lastRestockDate = data.lastRestockDate ? new Date(data.lastRestockDate) : null;
  }

  if (data.nextRestockDate !== undefined) {
    subProduct.nextRestockDate = data.nextRestockDate ? new Date(data.nextRestockDate) : null;
  }

  // ========================================================================
  // SIZE VARIANTS
  // ========================================================================
  if (data.sellWithoutSizeVariants !== undefined) {
    subProduct.sellWithoutSizeVariants = data.sellWithoutSizeVariants;
  }

  // ========================================================================
  // VENDOR & SOURCING FIELDS
  // ========================================================================
  if (data.vendor !== undefined) {
    subProduct.vendor = data.vendor && data.vendor !== '' ? data.vendor : null;
  }

  if (data.supplierSKU !== undefined) {
    subProduct.supplierSKU = data.supplierSKU;
  }

  if (data.supplierPrice !== undefined) {
    subProduct.supplierPrice = data.supplierPrice;
  }

  if (data.leadTimeDays !== undefined) {
    subProduct.leadTimeDays = data.leadTimeDays;
  }

  if (data.minimumOrderQuantity !== undefined) {
    subProduct.minimumOrderQuantity = data.minimumOrderQuantity;
  }

  // ========================================================================
  // SHIPPING FIELDS
  // ========================================================================
  if (data.shipping !== undefined) {
    subProduct.shipping = {
      weight: data.shipping?.weight ?? subProduct.shipping?.weight,
      length: data.shipping?.length ?? subProduct.shipping?.length,
      width: data.shipping?.width ?? subProduct.shipping?.width,
      height: data.shipping?.height ?? subProduct.shipping?.height,
      fragile: data.shipping?.fragile ?? subProduct.shipping?.fragile ?? true,
      requiresAgeVerification: data.shipping?.requiresAgeVerification ?? subProduct.shipping?.requiresAgeVerification ?? true,
      hazmat: data.shipping?.hazmat ?? subProduct.shipping?.hazmat ?? false,
      shippingClass: data.shipping?.shippingClass ?? subProduct.shipping?.shippingClass ?? '',
    };
  }

  // ========================================================================
  // WAREHOUSE FIELDS
  // ========================================================================
  if (data.warehouse !== undefined) {
    subProduct.warehouse = {
      location: data.warehouse?.location ?? subProduct.warehouse?.location ?? '',
      zone: data.warehouse?.zone ?? subProduct.warehouse?.zone ?? '',
      aisle: data.warehouse?.aisle ?? subProduct.warehouse?.aisle ?? '',
      shelf: data.warehouse?.shelf ?? subProduct.warehouse?.shelf ?? '',
      bin: data.warehouse?.bin ?? subProduct.warehouse?.bin ?? '',
    };
  }

  // ========================================================================
  // PROMOTION FIELDS
  // ========================================================================
  if (data.discount !== undefined) {
    subProduct.discount = data.discount;
  }

  if (data.discountType !== undefined) {
    const validDiscountTypes = ['fixed', 'percentage', null];
    if (data.discountType !== null && !validDiscountTypes.includes(data.discountType)) {
      throw new ValidationError('Invalid discount type');
    }
    subProduct.discountType = data.discountType;
  }

  if (data.discountStart !== undefined) {
    subProduct.discountStart = data.discountStart ? new Date(data.discountStart) : null;
  }

  if (data.discountEnd !== undefined) {
    subProduct.discountEnd = data.discountEnd ? new Date(data.discountEnd) : null;
  }

  // ========================================================================
  // FLASH SALE FIELDS
  // ========================================================================
  if (data.flashSale !== undefined) {
    subProduct.flashSale = {
      isActive: data.flashSale?.isActive ?? subProduct.flashSale?.isActive ?? false,
      startDate: data.flashSale?.startDate ? new Date(data.flashSale.startDate) : (subProduct.flashSale?.startDate || null),
      endDate: data.flashSale?.endDate ? new Date(data.flashSale.endDate) : (subProduct.flashSale?.endDate || null),
      discountPercentage: data.flashSale?.discountPercentage ?? subProduct.flashSale?.discountPercentage ?? null,
      remainingQuantity: data.flashSale?.remainingQuantity ?? subProduct.flashSale?.remainingQuantity ?? null,
    };
  }

  // ========================================================================
  // BUNDLE DEALS
  // ========================================================================
  if (data.bundleDeals !== undefined) {
    subProduct.bundleDeals = data.bundleDeals;
  }

  // ========================================================================
  // AUTO-CALCULATE STOCK STATUS
  // ========================================================================
  // If totalStock was updated, auto-update stock status
  if (data.totalStock !== undefined && !data.stockStatus) {
    if (data.totalStock === 0) {
      subProduct.stockStatus = 'out_of_stock';
      subProduct.availableStock = 0;
    } else if (data.totalStock <= (subProduct.lowStockThreshold || 10)) {
      subProduct.stockStatus = 'low_stock';
      subProduct.availableStock = data.totalStock - (subProduct.reservedStock || 0);
    } else {
      subProduct.stockStatus = 'in_stock';
      subProduct.availableStock = data.totalStock - (subProduct.reservedStock || 0);
    }
  }

  // Update metadata
  if (user) {
    subProduct.metadata = {
      ...subProduct.metadata,
      lastModifiedBy: user._id,
    };
  }

  await subProduct.save();

  console.log('✅ SubProduct updated successfully:', subProduct._id);

  // ========================================================================
  // HANDLE SIZE VARIANTS UPDATE
  // ========================================================================
  if (data.sizes !== undefined && Array.isArray(data.sizes)) {
    const Size = require('../models/Size');
    
    if (data.sellWithoutSizeVariants) {
      // If selling without variants, delete all existing sizes
      await Size.deleteMany({ subproduct: subProductId });
      subProduct.sizes = [];
      subProduct.defaultSize = null;
    } else {
      // Get existing sizes to preserve IDs for updates
      const existingSizes = await Size.find({ subproduct: subProductId }).lean();
      const existingSizeMap = new Map(existingSizes.map(s => [s.size, s]));
      
      const updatedSizeIds = [];
      
      for (const sizeData of data.sizes) {
        const existingSize = existingSizeMap.get(sizeData.size);
        
        if (existingSize) {
          // Update existing size
          Object.assign(existingSize, {
            displayName: sizeData.displayName || existingSize.displayName,
            sizeCategory: sizeData.sizeCategory || existingSize.sizeCategory,
            unitType: sizeData.unitType || existingSize.unitType,
            volumeMl: sizeData.volumeMl ?? existingSize.volumeMl,
            weightGrams: sizeData.weightGrams ?? existingSize.weightGrams,
            servingsPerUnit: sizeData.servingsPerUnit ?? existingSize.servingsPerUnit,
            unitsPerPack: sizeData.unitsPerPack ?? existingSize.unitsPerPack,
            basePrice: sizeData.basePrice ?? existingSize.basePrice,
            compareAtPrice: sizeData.compareAtPrice ?? existingSize.compareAtPrice,
            costPrice: sizeData.costPrice ?? existingSize.costPrice,
            wholesalePrice: sizeData.wholesalePrice ?? existingSize.wholesalePrice,
            currency: sizeData.currency || existingSize.currency || subProduct.currency,
            stock: sizeData.stock ?? existingSize.stock,
            reservedStock: sizeData.reservedStock ?? existingSize.reservedStock,
            availableStock: sizeData.availableStock ?? existingSize.availableStock,
            lowStockThreshold: sizeData.lowStockThreshold ?? existingSize.lowStockThreshold,
            reorderPoint: sizeData.reorderPoint ?? existingSize.reorderPoint,
            reorderQuantity: sizeData.reorderQuantity ?? existingSize.reorderQuantity,
            sku: sizeData.sku || existingSize.sku,
            barcode: sizeData.barcode || existingSize.barcode,
            markupPercentage: sizeData.markupPercentage ?? existingSize.markupPercentage,
            roundUp: sizeData.roundUp || existingSize.roundUp || 'none',
            saleDiscountPercentage: sizeData.saleDiscountPercentage ?? existingSize.saleDiscountPercentage,
            salePrice: sizeData.salePrice ?? existingSize.salePrice,
            isDefault: sizeData.isDefault ?? existingSize.isDefault,
            isOnSale: sizeData.isOnSale ?? existingSize.isOnSale,
            rank: sizeData.rank ?? existingSize.rank,
          });
          
          const updated = await Size.findByIdAndUpdate(existingSize._id, existingSize, { new: true });
          updatedSizeIds.push(updated._id);
        } else {
          // Create new size
          const newSizePayload = {
            subproduct: subProductId,
            product: subProduct.product,
            tenant: tenantObjectId,
            size: sizeData.size,
            displayName: sizeData.displayName || sizeData.size,
            sizeCategory: sizeData.sizeCategory || '',
            unitType: sizeData.unitType || 'volume_ml',
            volumeMl: sizeData.volumeMl ?? null,
            weightGrams: sizeData.weightGrams ?? null,
            servingsPerUnit: sizeData.servingsPerUnit ?? null,
            unitsPerPack: sizeData.unitsPerPack ?? 1,
            basePrice: sizeData.basePrice ?? subProduct.baseSellingPrice,
            compareAtPrice: sizeData.compareAtPrice ?? null,
            costPrice: sizeData.costPrice ?? subProduct.costPrice,
            wholesalePrice: sizeData.wholesalePrice ?? null,
            currency: sizeData.currency || subProduct.currency,
            stock: sizeData.stock ?? 0,
            reservedStock: sizeData.reservedStock ?? 0,
            availableStock: sizeData.availableStock ?? 0,
            lowStockThreshold: sizeData.lowStockThreshold ?? 10,
            reorderPoint: sizeData.reorderPoint ?? 5,
            reorderQuantity: sizeData.reorderQuantity ?? 50,
            sku: sizeData.sku || '',
            barcode: sizeData.barcode || '',
            markupPercentage: sizeData.markupPercentage ?? subProduct.markupPercentage,
            roundUp: sizeData.roundUp || 'none',
            saleDiscountPercentage: sizeData.saleDiscountPercentage ?? 0,
            salePrice: sizeData.salePrice ?? null,
            isDefault: sizeData.isDefault ?? false,
            isOnSale: sizeData.isOnSale ?? false,
            rank: sizeData.rank ?? (data.sizes.indexOf(sizeData) + 1),
          };
          
          const newSize = await Size.create(newSizePayload);
          updatedSizeIds.push(newSize._id);
        }
      }
      
      // Delete sizes that are no longer in the update
      const sizesToDelete = existingSizes.filter(s => !updatedSizeIds.includes(s._id));
      if (sizesToDelete.length > 0) {
        await Size.deleteMany({ 
          _id: { $in: sizesToDelete.map(s => s._id) }
        });
      }
      
      subProduct.sizes = updatedSizeIds;
      
      // Calculate total stock from sizes
      const updatedSizes = await Size.find({ _id: { $in: updatedSizeIds } }).lean();
      const totalSizeStock = updatedSizes.reduce((sum, s) => sum + (s.stock || 0), 0);
      subProduct.totalStock = totalSizeStock;
      subProduct.availableStock = totalSizeStock - (subProduct.reservedStock || 0);
      
      // Update stock status based on sizes
      if (totalSizeStock === 0) {
        subProduct.stockStatus = 'out_of_stock';
      } else if (totalSizeStock <= (subProduct.lowStockThreshold || 10)) {
        subProduct.stockStatus = 'low_stock';
      } else {
        subProduct.stockStatus = 'in_stock';
      }
      
      // Set default size if not set
      if (!subProduct.defaultSize && updatedSizes.length > 0) {
        const defaultSize = updatedSizes.find(s => s.isDefault) || updatedSizes[0];
        subProduct.defaultSize = defaultSize._id;
      }
    }
    
await subProduct.save();
  }

  // ========================================================================
  // POPULATE AND RETURN
  // ========================================================================
  // POPULATE AND RETURN
  // ========================================================================
  const updatedSubProduct = await SubProduct.findById(subProduct._id)
    .populate({
      path: 'product',
      select: 'name slug type images brand category',
      populate: [
        { path: 'brand', select: 'name slug logo' },
        { path: 'category', select: 'name slug' },
      ],
    })
    .populate({
      path: 'sizes',
    })
    .populate({
      path: 'defaultSize',
      select: 'size displayName',
    })
    .lean();

  return updatedSubProduct;
};

/**
 * Delete SubProduct
 */
const deleteSubProduct = async (subProductId, tenantId) => {
  if (!/^[0-9a-fA-F]{24}$/.test(subProductId)) {
    throw new ValidationError('Invalid SubProduct ID');
  }

  const subProduct = await SubProduct.findOne({
    _id: subProductId,
    tenant: tenantId,
  });

  if (!subProduct) {
    throw new NotFoundError('Product not found in your catalog');
  }

  const productId = subProduct.product;
  const wasActive = subProduct.status === 'active';

  // Delete associated sizes
  await Size.deleteMany({ subproduct: subProductId });

  // Delete SubProduct
  await SubProduct.findByIdAndDelete(subProductId);

  // Update product tenant count
  await Product.findByIdAndUpdate(productId, {
    $inc: { tenantCount: -1 },
    $pull: { subProducts: subProductId },
  });

  // Update tenant stats
  const updates = { $inc: { productCount: -1 } };
  if (wasActive) {
    updates.$inc.activeSubProductCount = -1;
  }
  await Tenant.findByIdAndUpdate(tenantId, updates);

  return { message: 'Product removed from catalog successfully' };
};

/**
 * Bulk update stock levels
 */
const updateStockBulk = async (updates, tenantId) => {
  const results = {
    success: 0,
    failed: 0,
    errors: [],
    updated: [],
  };

  for (const update of updates) {
    try {
      const { sizeId, stock, availability } = update;

      if (!sizeId) {
        results.failed++;
        results.errors.push({
          sizeId,
          error: 'Size ID is required',
        });
        continue;
      }

      if (stock !== undefined && (stock < 0 || !Number.isInteger(stock))) {
        results.failed++;
        results.errors.push({
          sizeId,
          error: 'Stock must be a non-negative integer',
        });
        continue;
      }

      // Find size and verify it belongs to tenant's SubProduct
      const size = await Size.findById(sizeId)
        .populate({
          path: 'subproduct',
          select: 'tenant',
        })
        .lean();

      if (!size) {
        results.failed++;
        results.errors.push({
          sizeId,
          error: 'Size not found',
        });
        continue;
      }

      if (size.subproduct.tenant.toString() !== tenantId.toString()) {
        results.failed++;
        results.errors.push({
          sizeId,
          error: 'This size does not belong to your catalog',
        });
        continue;
      }

      // Update stock
      const updateFields = {};
      if (stock !== undefined) {
        updateFields.stock = stock;
        
        // Auto-update availability based on stock
        if (stock === 0) {
          updateFields.availability = 'out_of_stock';
        } else if (stock <= (size.lowStockThreshold || 10)) {
          updateFields.availability = 'low_stock';
        } else {
          updateFields.availability = 'available';
        }
      }

      // Manual availability override
      if (availability) {
        const validAvailabilities = [
          'available',
          'low_stock',
          'out_of_stock',
          'pre_order',
          'coming_soon',
          'discontinued',
        ];
        if (validAvailabilities.includes(availability)) {
          updateFields.availability = availability;
        }
      }

      await Size.findByIdAndUpdate(sizeId, updateFields);

      results.success++;
      results.updated.push({
        sizeId,
        newStock: stock,
        newAvailability: updateFields.availability,
      });
    } catch (error) {
      results.failed++;
      results.errors.push({
        sizeId: update.sizeId,
        error: error.message,
      });
    }
  }

  return results;
};

/**
 * Helper: Create size variants for SubProduct
 */
const createSizeVariants = async (sizes, subProductId, defaultCurrency, tenantId) => {
  const VALID_SIZE_ENUMS = [
    // Wine & Champagne
    '10cl', '18.7cl', '20cl', '25cl', '37.5cl', '50cl', '75cl', '100cl',
    '150cl', '300cl', '450cl', '600cl', '900cl', '1200cl', '1500cl', '1800cl',
    // Spirits
    '5cl', '10cl', '20cl', '35cl', '50ml', '70cl', '1L', '1.5L', '1.75L', '3L',
    // Beer & Cider
    '27.5cl', '33cl', '35cl', '44cl', '50cl', '56.8cl', '66cl',
    'bottle-275ml', 'bottle-330ml', 'bottle-355ml', 'bottle-500ml',
    'bottle-568ml', 'bottle-600ml', 'bottle-650ml', 'bottle-750ml',
    // Beer Cans
    'can-200ml', 'can-250ml', 'can-330ml', 'can-355ml', 'can-440ml',
    'can-473ml', 'can-500ml', 'can-568ml',
    // Soft Drinks & Water
    '200ml', '250ml', '300ml', '330ml', '355ml', '500ml', '600ml', '750ml',
    '1L', '1.25L', '1.5L', '2L', '2.5L', '3L', '5L',
    // Multi-Packs
    'pack-4', 'pack-6', 'pack-8', 'pack-10', 'pack-12', 'pack-18',
    'pack-24', 'pack-30', 'pack-36', 'case-6', 'case-12', 'case-24',
    // Coffee & Tea
    '50g', '100g', '125g', '200g', '250g', '340g', '500g', '1kg', '2kg',
    // Tea Bags
    'teabag-20', 'teabag-25', 'teabag-40', 'teabag-50', 'teabag-100',
    // Single Serve
    'unit-single', 'shot-25ml', 'shot-35ml', 'shot-50ml',
    // Gift Sets
    'set-2', 'set-3', 'set-4', 'set-6', 'set-12', 'gift-set', 'tasting-set', 'variety-pack',
    // Custom
    'custom', 'variable', 'assorted',
  ];

  if (!sizes || sizes.length === 0) {
    return [];
  }

  const createdSizes = [];
  const errors = [];

  for (let i = 0; i < sizes.length; i++) {
    const sizeData = sizes[i];
    
    try {
      const {
        size,
        displayName,
        sizeCategory,
        unitType = 'volume_ml',
        volumeMl,
        weightGrams,
        servingsPerUnit,
        unitsPerPack = 1,
        basePrice: sellingPrice,
        compareAtPrice,
        costPrice: sizeCostPrice,
        wholesalePrice,
        currency = defaultCurrency,
        // Auto-calculation fields
        markupPercentage = 25,
        roundUp = 'none',
        saleDiscountPercentage = 0,
        salePrice,
        // Inventory
        stock = 0,
        reservedStock = 0,
        availableStock,
        lowStockThreshold = 10,
        reorderPoint = 5,
        reorderQuantity = 50,
        availability,
        // Identification
        sku: sizeSku,
        barcode,
        // Flags
        isDefault = false,
        isOnSale = false,
        isFeatured = false,
        isBestSeller = false,
        isPopularSize = false,
        isLimitedEdition = false,
        // Order constraints
        minOrderQuantity,
        maxOrderQuantity,
        orderIncrement,
        requiresAgeVerification = false,
        // Packaging & Details
        packaging,
        // Rank
        rank,
      } = sizeData;

      // Validate required fields
      if (!size) {
        throw new ValidationError(`Size at index ${i} is required`);
      }

      // Validate size enum
      if (!VALID_SIZE_ENUMS.includes(size)) {
        console.warn(`Size enum "${size}" not in validated list, allowing anyway`);
      }

      // Calculate selling price if not provided but cost price and markup are
      let finalSellingPrice = sellingPrice;
      if ((!finalSellingPrice || finalSellingPrice === 0) && sizeCostPrice && sizeCostPrice > 0 && markupPercentage) {
        finalSellingPrice = sizeCostPrice * (1 + markupPercentage / 100);
        if (roundUp === '100') {
          finalSellingPrice = Math.ceil(finalSellingPrice / 100) * 100;
        } else if (roundUp === '1000') {
          finalSellingPrice = Math.ceil(finalSellingPrice / 1000) * 1000;
        }
      }

      // Calculate sale price if discount percentage provided
      let finalSalePrice = salePrice;
      if ((!finalSalePrice || finalSalePrice === 0) && finalSellingPrice && finalSellingPrice > 0 && saleDiscountPercentage > 0) {
        finalSalePrice = finalSellingPrice * (1 - saleDiscountPercentage / 100);
      }

      // Determine availability if not explicitly set
      let finalAvailability = availability;
      if (!finalAvailability) {
        if (stock === 0) {
          finalAvailability = 'out_of_stock';
        } else if (stock <= lowStockThreshold) {
          finalAvailability = 'low_stock';
        } else {
          finalAvailability = 'available';
        }
      }

      // Generate SKU if not provided
      let finalSku = sizeSku;
      if (!finalSku) {
        finalSku = await generateSizeSKU(subProductId, size, { model: Size });
      }

      const sizePayload = {
        subproduct: subProductId,
        size,
        displayName: displayName || size,
        sizeCategory: sizeCategory || 'standard',
        unitType,
        volumeMl: volumeMl || null,
        weightGrams: weightGrams || null,
        servingsPerUnit: servingsPerUnit || null,
        unitsPerPack,
        sellingPrice: finalSellingPrice || 0,
        compareAtPrice: compareAtPrice || null,
        costPrice: sizeCostPrice || 0,
        wholesalePrice: wholesalePrice || null,
        currency: currency || defaultCurrency,
        // Auto-calculation fields stored for reference
        markupPercentage,
        roundUp,
        saleDiscountPercentage,
        salePrice: finalSalePrice || null,
        // Inventory
        stock,
        reservedStock: reservedStock || 0,
        availableStock: availableStock ?? (stock > 0 ? stock : 0),
        lowStockThreshold,
        reorderPoint,
        reorderQuantity,
        availability: finalAvailability,
        // Identification
        sku: finalSku,
        barcode: barcode || null,
        // Flags
        isDefault,
        isOnSale,
        isFeatured,
        isBestSeller,
        isPopularSize,
        isLimitedEdition,
        // Order constraints
        minOrderQuantity: minOrderQuantity || 1,
        maxOrderQuantity: maxOrderQuantity || null,
        orderIncrement: orderIncrement || 1,
        requiresAgeVerification,
        // Packaging & Details
        packaging: packaging || '',
        // Rank
        rank: rank || (i + 1),
        // Analytics
        totalSold: 0,
        totalRevenue: 0,
      };

      const createdSize = await Size.create(sizePayload);
      createdSizes.push(createdSize);
    } catch (error) {
      errors.push({
        index: i,
        size: sizeData?.size,
        error: error.message,
      });
    }
  }

  if (errors.length > 0 && createdSizes.length === 0) {
    throw new ValidationError(`Failed to create any size variants: ${errors.map(e => e.error).join(', ')}`);
  }

  if (errors.length > 0) {
    console.warn(`Created ${createdSizes.length} sizes with ${errors.length} errors:`, errors);
  }

  return createdSizes;
};

/**
 * Helper: Generate SKU for size variant
 */
const generateSizeSKU = async (subProductId, size, options = {}) => {
  const { model: SizeModel = Size } = options;
  
  const subProduct = await SubProduct.findById(subProductId).lean();
  if (!subProduct) {
    throw new NotFoundError('SubProduct not found');
  }

  const timestamp = Date.now().toString(36).slice(-4);
  const sizeSlug = size.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4);
  const random = Math.random().toString(36).slice(2, 5).toUpperCase();
  
  return `SKU-${subProduct.sku?.slice(-6) || 'UNK'}-${sizeSlug}-${timestamp}${random}`;
};

/**
 * Create size variants within a transaction session
 */
const createSizeVariantsWithTransaction = async (sizes, subProductId, defaultCurrency, tenantId, session) => {
  const createdSizes = [];
  const errors = [];
  
  for (let i = 0; i < sizes.length; i++) {
    const sizeData = sizes[i];
    
    try {
      const {
        size,
        displayName,
        sizeCategory,
        unitType = 'volume_ml',
        volumeMl,
        weightGrams,
        servingsPerUnit,
        unitsPerPack = 1,
        basePrice: sellingPrice,
        compareAtPrice,
        costPrice: sizeCostPrice,
        wholesalePrice,
        currency = defaultCurrency,
        markupPercentage = 25,
        roundUp = 'none',
        saleDiscountPercentage = 0,
        salePrice,
        stock = 0,
        reservedStock = 0,
        availableStock,
        lowStockThreshold = 10,
        reorderPoint = 5,
        reorderQuantity = 50,
        availability,
        sku: sizeSku,
        barcode,
        isDefault = false,
        isOnSale = false,
        isFeatured = false,
        isBestSeller = false,
        isPopularSize = false,
        isLimitedEdition = false,
        minOrderQuantity,
        maxOrderQuantity,
        orderIncrement,
        requiresAgeVerification = false,
        packaging,
        rank,
      } = sizeData;

      // Validate required fields
      if (!size) {
        throw new ValidationError(`Size at index ${i} is required`);
      }

      // Calculate selling price based on tenant revenue model
      let finalSellingPrice = sellingPrice;
      if ((!finalSellingPrice || finalSellingPrice === 0) && sizeCostPrice && sizeCostPrice > 0) {
        const pricing = await calculatePriceFromRevenueModel(sizeCostPrice, tenantId);
        finalSellingPrice = pricing.baseSellingPrice;
      }

      // Calculate sale price if discount percentage provided
      let finalSalePrice = salePrice;
      if ((!finalSalePrice || finalSalePrice === 0) && finalSellingPrice && finalSellingPrice > 0 && saleDiscountPercentage > 0) {
        finalSalePrice = finalSellingPrice * (1 - saleDiscountPercentage / 100);
      }

      // Determine availability if not explicitly set
      let finalAvailability = availability;
      if (!finalAvailability) {
        if (stock === 0) {
          finalAvailability = 'out_of_stock';
        } else if (stock <= lowStockThreshold) {
          finalAvailability = 'low_stock';
        } else {
          finalAvailability = 'available';
        }
      }

      // Generate SKU if not provided
      let finalSku = sizeSku;
      if (!finalSku) {
        finalSku = await generateSizeSKU(subProductId, size);
      }

      const sizePayload = {
        subproduct: subProductId,
        size,
        displayName: displayName || size,
        sizeCategory: sizeCategory || 'standard',
        unitType,
        volumeMl: volumeMl || null,
        weightGrams: weightGrams || null,
        servingsPerUnit: servingsPerUnit || null,
        unitsPerPack,
        sellingPrice: finalSellingPrice || 0,
        compareAtPrice: compareAtPrice || null,
        costPrice: sizeCostPrice || 0,
        wholesalePrice: wholesalePrice || null,
        currency: currency || defaultCurrency,
        markupPercentage,
        roundUp,
        saleDiscountPercentage,
        salePrice: finalSalePrice || null,
        stock,
        reservedStock: reservedStock || 0,
        availableStock: availableStock ?? (stock > 0 ? stock : 0),
        lowStockThreshold,
        reorderPoint,
        reorderQuantity,
        availability: finalAvailability,
        sku: finalSku,
        barcode: barcode || null,
        isDefault,
        isOnSale,
        isFeatured,
        isBestSeller,
        isPopularSize,
        isLimitedEdition,
        minOrderQuantity: minOrderQuantity || 1,
        maxOrderQuantity: maxOrderQuantity || null,
        orderIncrement: orderIncrement || 1,
        requiresAgeVerification,
        packaging: packaging || '',
        rank: rank || (i + 1),
        totalSold: 0,
        totalRevenue: 0,
      };

      const createdSize = await Size.create([sizePayload], { session });
      createdSizes.push(createdSize[0]);
    } catch (error) {
      errors.push({
        index: i,
        size: sizeData?.size,
        error: error.message,
      });
    }
  }

  if (errors.length > 0 && createdSizes.length === 0) {
    throw new ValidationError(`Failed to create any size variants: ${errors.map(e => e.error).join(', ')}`);
  }

  if (errors.length > 0) {
    console.warn(`Created ${createdSizes.length} sizes with ${errors.length} errors:`, errors);
  }

  return createdSizes;
};

/**
 * Create size variants without transaction (for standalone MongoDB)
 */
const createSizeVariantsWithoutTransaction = async (sizes, subProductId, defaultCurrency, tenantId) => {
  const createdSizes = [];
  const errors = [];

  for (let i = 0; i < sizes.length; i++) {
    const sizeData = sizes[i];

    try {
      const {
        size,
        displayName,
        sizeCategory,
        unitType = 'volume_ml',
        volumeMl,
        weightGrams,
        servingsPerUnit,
        unitsPerPack = 1,
        basePrice: sellingPrice,
        compareAtPrice,
        costPrice: sizeCostPrice,
        wholesalePrice,
        currency = defaultCurrency,
        markupPercentage = 25,
        roundUp = 'none',
        saleDiscountPercentage = 0,
        salePrice,
        stock = 0,
        reservedStock = 0,
        availableStock,
        lowStockThreshold = 10,
        reorderPoint = 5,
        reorderQuantity = 50,
        availability,
        sku: sizeSku,
        barcode,
        isDefault = false,
        isOnSale = false,
        isFeatured = false,
        isBestSeller = false,
        isPopularSize = false,
        isLimitedEdition = false,
        minOrderQuantity,
        maxOrderQuantity,
        orderIncrement,
        requiresAgeVerification = false,
        packaging,
        rank,
      } = sizeData;

      // Validate required fields
      if (!size) {
        throw new ValidationError(`Size at index ${i} is required`);
      }

      // Calculate selling price based on tenant revenue model
      let finalSellingPrice = sellingPrice;
      if ((!finalSellingPrice || finalSellingPrice === 0) && sizeCostPrice && sizeCostPrice > 0) {
        const pricing = await calculatePriceFromRevenueModel(sizeCostPrice, tenantId);
        finalSellingPrice = pricing.baseSellingPrice;
      }

      // Calculate sale price if discount percentage provided
      let finalSalePrice = salePrice;
      if ((!finalSalePrice || finalSalePrice === 0) && finalSellingPrice && finalSellingPrice > 0 && saleDiscountPercentage > 0) {
        finalSalePrice = finalSellingPrice * (1 - saleDiscountPercentage / 100);
      }

      // Determine availability if not explicitly set
      let finalAvailability = availability;
      if (!finalAvailability) {
        if (stock === 0) {
          finalAvailability = 'out_of_stock';
        } else if (stock <= lowStockThreshold) {
          finalAvailability = 'low_stock';
        } else {
          finalAvailability = 'available';
        }
      }

      // Generate SKU if not provided
      let finalSku = sizeSku;
      if (!finalSku) {
        finalSku = await generateSizeSKU(subProductId, size);
      }

      const sizePayload = {
        subproduct: subProductId,
        size,
        displayName: displayName || size,
        sizeCategory: sizeCategory || 'standard',
        unitType,
        volumeMl: volumeMl || null,
        weightGrams: weightGrams || null,
        servingsPerUnit: servingsPerUnit || null,
        unitsPerPack,
        sellingPrice: finalSellingPrice || 0,
        compareAtPrice: compareAtPrice || null,
        costPrice: sizeCostPrice || 0,
        wholesalePrice: wholesalePrice || null,
        currency: currency || defaultCurrency,
        markupPercentage,
        roundUp,
        saleDiscountPercentage,
        salePrice: finalSalePrice || null,
        stock,
        reservedStock: reservedStock || 0,
        availableStock: availableStock ?? (stock > 0 ? stock : 0),
        lowStockThreshold,
        reorderPoint,
        reorderQuantity,
        availability: finalAvailability,
        sku: finalSku,
        barcode: barcode || null,
        isDefault,
        isOnSale,
        isFeatured,
        isBestSeller,
        isPopularSize,
        isLimitedEdition,
        minOrderQuantity: minOrderQuantity || 1,
        maxOrderQuantity: maxOrderQuantity || null,
        orderIncrement: orderIncrement || 1,
        requiresAgeVerification,
        packaging: packaging || '',
        rank: rank || (i + 1),
        totalSold: 0,
        totalRevenue: 0,
      };

      const createdSize = await Size.create(sizePayload);
      createdSizes.push(createdSize);
    } catch (error) {
      errors.push({
        index: i,
        size: sizeData?.size,
        error: error.message,
      });
    }
  }

  if (errors.length > 0 && createdSizes.length === 0) {
    throw new ValidationError(`Failed to create any size variants: ${errors.map(e => e.error).join(', ')}`);
  }

  if (errors.length > 0) {
    console.warn(`Created ${createdSizes.length} sizes with ${errors.length} errors:`, errors);
  }

  return createdSizes;
};


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


// ============================================================
// Inventory Management Functions
// ============================================================

/**
 * Get comprehensive inventory for a SubProduct
 * Returns current stock, value, and size breakdown
 */
const getSubProductInventory = async (subProductId, tenantId) => {
  const subProduct = await SubProduct.findOne({
    _id: subProductId,
    tenant: tenantId,
  }).populate('product tenant');

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found for this tenant');
  }

  // Get all sizes with stock information
  const sizes = await Size.find({ subProduct: subProductId })
    .sort({ volumeMl: 1 });

  // Calculate inventory metrics
  let totalStock = 0;
  let totalValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  const sizeInventory = sizes.map(size => {
    const effectivePrice = size.costPrice || size.price;
    const sizeValue = size.stock * effectivePrice;

    totalStock += size.stock;
    totalValue += sizeValue;

    if (size.availability === 'low_stock') lowStockCount++;
    if (size.availability === 'out_of_stock') outOfStockCount++;

    return {
      sizeId: size._id,
      size: `${size.value}${size.unit}`,
      sku: size.sku,
      barcode: size.barcode,
      stock: size.stock,
      reorderPoint: size.reorderPoint || 10,
      reorderQuantity: size.reorderQuantity || 50,
      availability: size.availability,
      price: size.price,
      costPrice: size.costPrice,
      stockValue: sizeValue.toFixed(2),
      needsReorder: size.stock <= (size.reorderPoint || 10),
    };
  });

  return {
    subProduct: {
      id: subProduct._id,
      sku: subProduct.sku,
      product: subProduct.product.name,
      tenant: subProduct.tenant.businessName,
      status: subProduct.status,
      availability: subProduct.availability,
    },
    inventory: {
      totalStock,
      totalValue: totalValue.toFixed(2),
      totalSizes: sizes.length,
      lowStockCount,
      outOfStockCount,
      inStockCount: sizes.length - outOfStockCount,
    },
    sizes: sizeInventory,
    alerts: {
      needsReorder: sizeInventory.filter(s => s.needsReorder).length,
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
    },
  };
};

/**
 * Adjust stock for a specific size
 * Supports increase, decrease, and set operations with reason tracking
 */
const adjustStock = async (subProductId, sizeId, adjustment, reason, user) => {
  const { type, quantity } = adjustment;

  if (!['increase', 'decrease', 'set'].includes(type)) {
    throw new ValidationError('Adjustment type must be increase, decrease, or set');
  }

  if (typeof quantity !== 'number' || quantity < 0) {
    throw new ValidationError('Quantity must be a positive number');
  }

  // Get size
  const size = await Size.findOne({
    _id: sizeId,
    subProduct: subProductId,
  });

  if (!size) {
    throw new NotFoundError('Size not found for this SubProduct');
  }

  const previousStock = size.stock;
  let newStock;

  // Calculate new stock based on adjustment type
  switch (type) {
    case 'increase':
      newStock = previousStock + quantity;
      break;
    case 'decrease':
      newStock = Math.max(0, previousStock - quantity);
      break;
    case 'set':
      newStock = quantity;
      break;
  }

  // Update stock
  size.stock = newStock;

  // Update availability based on new stock
  if (newStock === 0) {
    size.availability = 'out_of_stock';
  } else if (newStock <= (size.reorderPoint || 10)) {
    size.availability = 'low_stock';
  } else {
    size.availability = 'in_stock';
  }

  // Add stock movement record to metadata
  if (!size.metadata) size.metadata = {};
  if (!size.metadata.stockMovements) size.metadata.stockMovements = [];

  size.metadata.stockMovements.push({
    date: new Date(),
    type,
    previousStock,
    quantity,
    newStock,
    reason: reason || 'Manual adjustment',
    adjustedBy: user._id,
  });

  // Keep only last 100 movements
  if (size.metadata.stockMovements.length > 100) {
    size.metadata.stockMovements = size.metadata.stockMovements.slice(-100);
  }

  size.metadata.lastStockUpdate = new Date();

  await size.save();

  // Update SubProduct availability
  const subProduct = await SubProduct.findById(subProductId);
  const allSizes = await Size.find({ subProduct: subProductId });

  const hasStock = allSizes.some(s => s.stock > 0);
  const hasLowStock = allSizes.some(s => s.availability === 'low_stock');

  if (!hasStock) {
    subProduct.availability = 'out_of_stock';
  } else if (hasLowStock) {
    subProduct.availability = 'low_stock';
  } else {
    subProduct.availability = 'in_stock';
  }

  await subProduct.save();

  return {
    size: {
      sizeId: size._id,
      size: `${size.value}${size.unit}`,
      previousStock,
      newStock,
      availability: size.availability,
    },
    adjustment: {
      type,
      quantity,
      reason,
      adjustedBy: user._id,
      adjustedAt: new Date(),
    },
    message: `Stock ${type}d successfully`,
  };
};

/**
 * Get stock movement history for a SubProduct
 * Returns all stock adjustments within date range
 */
const getStockMovements = async (subProductId, dateRange = {}) => {
  const subProduct = await SubProduct.findById(subProductId)
    .populate('product tenant');

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found');
  }

  const { startDate, endDate } = dateRange;
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
  const end = endDate ? new Date(endDate) : new Date();

  // Get all sizes
  const sizes = await Size.find({ subProduct: subProductId });

  // Collect all movements
  const movements = [];

  for (const size of sizes) {
    if (size.metadata?.stockMovements) {
      const sizeMovements = size.metadata.stockMovements
        .filter(movement => {
          const movementDate = new Date(movement.date);
          return movementDate >= start && movementDate <= end;
        })
        .map(movement => ({
          ...movement,
          sizeId: size._id,
          size: `${size.value}${size.unit}`,
          sku: size.sku,
        }));

      movements.push(...sizeMovements);
    }
  }

  // Sort by date descending
  movements.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Calculate summary
  const summary = {
    totalMovements: movements.length,
    increases: movements.filter(m => m.type === 'increase').length,
    decreases: movements.filter(m => m.type === 'decrease').length,
    sets: movements.filter(m => m.type === 'set').length,
    totalQuantityAdded: movements
      .filter(m => m.type === 'increase')
      .reduce((sum, m) => sum + m.quantity, 0),
    totalQuantityRemoved: movements
      .filter(m => m.type === 'decrease')
      .reduce((sum, m) => sum + m.quantity, 0),
  };

  return {
    subProduct: {
      id: subProduct._id,
      product: subProduct.product.name,
      tenant: subProduct.tenant.businessName,
    },
    dateRange: {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    },
    movements,
    summary,
  };
};

/**
 * Get SubProducts with low stock for a tenant
 * Returns products below reorder threshold
 */
const getLowStockSubProducts = async (tenantId, threshold = 10) => {
  const subProducts = await SubProduct.find({
    tenant: tenantId,
    status: { $ne: 'archived' },
    availability: 'low_stock',
  }).populate('product');

  const lowStockItems = [];

  for (const subProduct of subProducts) {
    const sizes = await Size.find({
      subProduct: subProduct._id,
      stock: { $gt: 0, $lte: threshold },
    });

    if (sizes.length > 0) {
      lowStockItems.push({
        subProductId: subProduct._id,
        sku: subProduct.sku,
        product: subProduct.product.name,
        status: subProduct.status,
        sizes: sizes.map(size => ({
          sizeId: size._id,
          size: `${size.value}${size.unit}`,
          sku: size.sku,
          stock: size.stock,
          reorderPoint: size.reorderPoint || threshold,
          reorderQuantity: size.reorderQuantity || 50,
          needsReorder: size.stock <= (size.reorderPoint || threshold),
        })),
        totalLowStockSizes: sizes.length,
      });
    }
  }

  return {
    tenant: tenantId,
    threshold,
    totalLowStockProducts: lowStockItems.length,
    products: lowStockItems,
  };
};

/**
 * Get SubProducts that are out of stock for a tenant
 * Returns products with zero stock
 */
const getOutOfStockSubProducts = async (tenantId) => {
  const subProducts = await SubProduct.find({
    tenant: tenantId,
    status: { $ne: 'archived' },
    availability: 'out_of_stock',
  }).populate('product');

  const outOfStockItems = [];

  for (const subProduct of subProducts) {
    const sizes = await Size.find({
      subProduct: subProduct._id,
      stock: 0,
    });

    if (sizes.length > 0) {
      outOfStockItems.push({
        subProductId: subProduct._id,
        sku: subProduct.sku,
        product: subProduct.product.name,
        status: subProduct.status,
        sizes: sizes.map(size => ({
          sizeId: size._id,
          size: `${size.value}${size.unit}`,
          sku: size.sku,
          stock: 0,
          reorderQuantity: size.reorderQuantity || 50,
          lastStockUpdate: size.metadata?.lastStockUpdate,
        })),
        totalOutOfStockSizes: sizes.length,
      });
    }
  }

  return {
    tenant: tenantId,
    totalOutOfStockProducts: outOfStockItems.length,
    products: outOfStockItems,
  };
};

/**
 * Set reorder points for SubProduct sizes
 * Configures automatic reorder triggers
 */
const setReorderPoints = async (subProductId, reorderData, tenantId) => {
  const subProduct = await SubProduct.findOne({
    _id: subProductId,
    tenant: tenantId,
  });

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found for this tenant');
  }

  const { sizeId, reorderPoint, reorderQuantity } = reorderData;

  if (!sizeId) {
    throw new ValidationError('Size ID is required');
  }

  if (reorderPoint !== undefined && (reorderPoint < 0 || !Number.isInteger(reorderPoint))) {
    throw new ValidationError('Reorder point must be a non-negative integer');
  }

  if (reorderQuantity !== undefined && (reorderQuantity <= 0 || !Number.isInteger(reorderQuantity))) {
    throw new ValidationError('Reorder quantity must be a positive integer');
  }

  const size = await Size.findOne({
    _id: sizeId,
    subProduct: subProductId,
  });

  if (!size) {
    throw new NotFoundError('Size not found for this SubProduct');
  }

  // Update reorder settings
  if (reorderPoint !== undefined) {
    size.reorderPoint = reorderPoint;
  }

  if (reorderQuantity !== undefined) {
    size.reorderQuantity = reorderQuantity;
  }

  // Update availability if stock is at or below new reorder point
  if (size.stock > 0 && size.stock <= size.reorderPoint) {
    size.availability = 'low_stock';
  }

  await size.save();

  return {
    size: {
      sizeId: size._id,
      size: `${size.value}${size.unit}`,
      stock: size.stock,
      reorderPoint: size.reorderPoint,
      reorderQuantity: size.reorderQuantity,
      availability: size.availability,
      needsReorder: size.stock <= size.reorderPoint,
    },
    message: 'Reorder settings updated successfully',
  };
};

// ============================================================
// Sales & Analytics Functions
// ============================================================

/**
 * Get sales data for a SubProduct
 * Returns sales performance within date range
 */
const getSubProductSales = async (subProductId, dateRange = {}) => {
  const subProduct = await SubProduct.findById(subProductId)
    .populate('product tenant');

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found');
  }

  const { startDate, endDate } = dateRange;
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  // Aggregate sales data
  const salesData = await Sales.aggregate([
    {
      $match: {
        product: subProduct.product._id,
        tenant: subProduct.tenant._id,
        saleDate: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
          size: '$size',
        },
        totalQuantity: { $sum: '$quantitySold' },
        totalRevenue: { $sum: { $multiply: ['$sellingPrice', '$quantitySold'] } },
        avgPrice: { $avg: '$sellingPrice' },
        orderCount: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.date': 1 },
    },
  ]);

  // Calculate totals
  const totals = await Sales.aggregate([
    {
      $match: {
        product: subProduct.product._id,
        tenant: subProduct.tenant._id,
        saleDate: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: null,
        totalQuantitySold: { $sum: '$quantitySold' },
        totalRevenue: { $sum: { $multiply: ['$sellingPrice', '$quantitySold'] } },
        avgPrice: { $avg: '$sellingPrice' },
        totalOrders: { $sum: 1 },
      },
    },
  ]);

  const summary = totals[0] || {
    totalQuantitySold: 0,
    totalRevenue: 0,
    avgPrice: 0,
    totalOrders: 0,
  };

  return {
    subProduct: {
      id: subProduct._id,
      product: subProduct.product.name,
      tenant: subProduct.tenant.businessName,
    },
    dateRange: {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    },
    summary: {
      totalQuantitySold: summary.totalQuantitySold,
      totalRevenue: summary.totalRevenue.toFixed(2),
      avgPrice: summary.avgPrice.toFixed(2),
      totalOrders: summary.totalOrders,
    },
    dailySales: salesData.map(item => ({
      date: item._id.date,
      sizeId: item._id.size,
      quantity: item.totalQuantity,
      revenue: item.totalRevenue.toFixed(2),
      avgPrice: item.avgPrice.toFixed(2),
      orders: item.orderCount,
    })),
  };
};

/**
 * Get revenue data for a SubProduct
 * Returns detailed revenue breakdown
 */
const getSubProductRevenue = async (subProductId, dateRange = {}) => {
  const subProduct = await SubProduct.findById(subProductId)
    .populate('product tenant');

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found');
  }

  const { startDate, endDate } = dateRange;
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  // Get sizes for cost calculation
  const sizes = await Size.find({ subProduct: subProductId });
  const sizeCostMap = new Map(
    sizes.map(s => [s._id.toString(), s.costPrice || 0])
  );

  // Aggregate revenue data
  const revenueData = await Sales.aggregate([
    {
      $match: {
        product: subProduct.product._id,
        tenant: subProduct.tenant._id,
        saleDate: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: '$size',
        totalRevenue: { $sum: { $multiply: ['$sellingPrice', '$quantitySold'] } },
        totalQuantity: { $sum: '$quantitySold' },
        avgSellingPrice: { $avg: '$sellingPrice' },
      },
    },
  ]);

  // Calculate profit for each size
  const revenueBySize = revenueData.map(item => {
    const costPrice = sizeCostMap.get(item._id.toString()) || 0;
    const totalCost = costPrice * item.totalQuantity;
    const profit = item.totalRevenue - totalCost;
    const profitMargin = item.totalRevenue > 0 ? (profit / item.totalRevenue) * 100 : 0;

    return {
      sizeId: item._id,
      revenue: item.totalRevenue.toFixed(2),
      quantity: item.totalQuantity,
      avgSellingPrice: item.avgSellingPrice.toFixed(2),
      cost: totalCost.toFixed(2),
      profit: profit.toFixed(2),
      profitMargin: profitMargin.toFixed(2),
    };
  });

  // Calculate totals
  const totalRevenue = revenueBySize.reduce((sum, item) => sum + parseFloat(item.revenue), 0);
  const totalCost = revenueBySize.reduce((sum, item) => sum + parseFloat(item.cost), 0);
  const totalProfit = totalRevenue - totalCost;
  const overallProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return {
    subProduct: {
      id: subProduct._id,
      product: subProduct.product.name,
      tenant: subProduct.tenant.businessName,
    },
    dateRange: {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    },
    summary: {
      totalRevenue: totalRevenue.toFixed(2),
      totalCost: totalCost.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      profitMargin: overallProfitMargin.toFixed(2),
    },
    revenueBySize,
  };
};

/**
 * Get top selling SubProducts for a tenant
 * Returns best performers by sales volume or revenue
 */
const getTopSellingSubProducts = async (tenantId, limit = 10, dateRange = {}) => {
  const { startDate, endDate } = dateRange;
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  // Get all SubProducts for tenant
  const subProducts = await SubProduct.find({ tenant: tenantId })
    .populate('product')
    .lean();

  const productIds = subProducts.map(sp => sp.product._id);

  // Aggregate sales by product
  const salesData = await Sales.aggregate([
    {
      $match: {
        product: { $in: productIds },
        tenant: tenantId,
        saleDate: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: '$product',
        totalQuantitySold: { $sum: '$quantitySold' },
        totalRevenue: { $sum: { $multiply: ['$sellingPrice', '$quantitySold'] } },
        avgPrice: { $avg: '$sellingPrice' },
        totalOrders: { $sum: 1 },
      },
    },
    {
      $sort: { totalRevenue: -1 },
    },
    {
      $limit: limit,
    },
  ]);

  // Map to SubProducts
  const topSelling = salesData.map(item => {
    const subProduct = subProducts.find(sp => sp.product._id.toString() === item._id.toString());
    
    return {
      subProductId: subProduct._id,
      sku: subProduct.sku,
      product: subProduct.product.name,
      brand: subProduct.product.brand?.name,
      quantitySold: item.totalQuantitySold,
      revenue: item.totalRevenue.toFixed(2),
      avgPrice: item.avgPrice.toFixed(2),
      totalOrders: item.totalOrders,
      availability: subProduct.availability,
    };
  });

  return {
    tenant: tenantId,
    dateRange: {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    },
    limit,
    topSelling,
  };
};

/**
 * Get conversion rate for a SubProduct
 * Calculates views to purchase conversion
 */
const getSubProductConversionRate = async (subProductId) => {
  const subProduct = await SubProduct.findById(subProductId)
    .populate('product tenant');

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found');
  }

  // Get analytics data (views, clicks, etc.)
  // Note: This assumes you have a ProductView or Analytics model
  const ProductView = require('../models/ProductView'); // Adjust if needed
  
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get total views
  const totalViews = await ProductView.countDocuments({
    product: subProduct.product._id,
    tenant: subProduct.tenant._id,
    viewedAt: { $gte: last30Days },
  });

  // Get total orders
  const totalOrders = await Sales.countDocuments({
    product: subProduct.product._id,
    tenant: subProduct.tenant._id,
    saleDate: { $gte: last30Days },
  });

  // Calculate conversion rate
  const conversionRate = totalViews > 0 ? (totalOrders / totalViews) * 100 : 0;

  // Get add to cart rate (if CartItem model exists)
  let addToCartRate = 0;
  try {
    const CartItem = require('../models/CartItem');
    const totalCartAdds = await CartItem.countDocuments({
      product: subProduct.product._id,
      createdAt: { $gte: last30Days },
    });
    addToCartRate = totalViews > 0 ? (totalCartAdds / totalViews) * 100 : 0;
  } catch (err) {
    // CartItem model might not exist
    console.log('CartItem model not found, skipping add to cart rate');
  }

  return {
    subProduct: {
      id: subProduct._id,
      product: subProduct.product.name,
      tenant: subProduct.tenant.businessName,
    },
    period: 'Last 30 days',
    metrics: {
      totalViews,
      totalOrders,
      conversionRate: conversionRate.toFixed(2),
      addToCartRate: addToCartRate.toFixed(2),
    },
  };
};

/**
 * Get average order value for a SubProduct
 * Calculates AOV and related metrics
 */
const getSubProductAverageOrderValue = async (subProductId) => {
  const subProduct = await SubProduct.findById(subProductId)
    .populate('product tenant');

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found');
  }

  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Aggregate order data
  const orderData = await Sales.aggregate([
    {
      $match: {
        product: subProduct.product._id,
        tenant: subProduct.tenant._id,
        saleDate: { $gte: last30Days },
      },
    },
    {
      $group: {
        _id: '$orderId',
        orderValue: { $sum: { $multiply: ['$sellingPrice', '$quantitySold'] } },
        itemCount: { $sum: '$quantitySold' },
      },
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$orderValue' },
        avgOrderValue: { $avg: '$orderValue' },
        avgItemsPerOrder: { $avg: '$itemCount' },
      },
    },
  ]);

  const metrics = orderData[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    avgItemsPerOrder: 0,
  };

  return {
    subProduct: {
      id: subProduct._id,
      product: subProduct.product.name,
      tenant: subProduct.tenant.businessName,
    },
    period: 'Last 30 days',
    metrics: {
      totalOrders: metrics.totalOrders,
      totalRevenue: metrics.totalRevenue.toFixed(2),
      avgOrderValue: metrics.avgOrderValue.toFixed(2),
      avgItemsPerOrder: metrics.avgItemsPerOrder.toFixed(2),
    },
  };
};

/**
 * Get all SubProducts with filters
 */
const getAllSubProducts = async (filters = {}) => {
  const {
    page = 1,
    limit = 20,
    status,
    search,
    sort = 'createdAt',
    order = 'desc',
  } = filters;

  const query = {};
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { sku: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sortOrder = order === 'desc' ? -1 : 1;

  const [subProducts, total] = await Promise.all([
    SubProduct.find(query)
      .populate('product', 'name slug images')
      .populate('tenant', 'name businessName')
      .sort({ [sort]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    SubProduct.countDocuments(query),
  ]);

  return {
    subProducts,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  };
};

/**
 * Get SubProducts by tenant
 */
const getSubProductsByTenant = async (tenantId, filters = {}) => {
  const { page = 1, limit = 20, status } = filters;

  const query = { tenant: tenantId };
  if (status) query.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [subProducts, total] = await Promise.all([
    SubProduct.find(query)
      .populate('product', 'name slug images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    SubProduct.countDocuments(query),
  ]);

  return {
    subProducts,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  };
};

/**
 * Get SubProducts by product
 */
const getSubProductsByProduct = async (productId) => {
  const subProducts = await SubProduct.find({ product: productId })
    .populate('product', 'name slug images')
    .populate('tenant', 'name businessName')
    .populate('sizes')
    .lean();

  return subProducts;
};

/**
 * Get SubProduct by ID
 */
const getSubProductById = async (id) => {
  const subProduct = await SubProduct.findById(id)
    .populate('product', 'name slug images description')
    .populate('tenant', 'name businessName')
    .populate('sizes')
    .lean();

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found');
  }

  return subProduct;
};

/**
 * Get SubProduct by SKU
 */
const getSubProductBySKU = async (sku) => {
  const subProduct = await SubProduct.findOne({ sku })
    .populate('product', 'name slug images description')
    .populate('tenant', 'name businessName')
    .populate('sizes')
    .lean();

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found');
  }

  return subProduct;
};

/**
 * Helper function to resolve system tenant for super admin
 */
const resolveSystemTenant = async (tenantId, user) => {
  if (user && user.role === 'super_admin') {
    const systemTenant = await Tenant.findOne({ isSystemTenant: true }).select('_id').lean();
    if (systemTenant) {
      console.log('🔧 Super admin detected - using system tenant:', systemTenant._id);
      return systemTenant._id.toString();
    }
  }
  return tenantId;
};

/**
 * Add size to SubProduct
 */
const addSize = async (subProductId, sizeData, tenantId, user = null) => {
  // Resolve system tenant for super admin
  tenantId = await resolveSystemTenant(tenantId, user);

  const subProduct = await SubProduct.findOne({
    _id: subProductId,
    tenant: tenantId,
  });

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found for this tenant');
  }

  if (!subProduct.sizes) {
    subProduct.sizes = [];
  }

  const newSize = {
    ...sizeData,
    subProduct: subProductId,
  };

  const Size = require('../models/Size');
  const size = new Size(newSize);
  await size.save();

  subProduct.sizes.push(size._id);
  await subProduct.save();

  return size;
};

/**
 * Update size
 */
const updateSize = async (subProductId, sizeId, updateData, tenantId, user = null) => {
  // Resolve system tenant for super admin
  tenantId = await resolveSystemTenant(tenantId, user);

  const subProduct = await SubProduct.findOne({
    _id: subProductId,
    tenant: tenantId,
  });

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found for this tenant');
  }

  const Size = require('../models/Size');
  const size = await Size.findOne({ _id: sizeId, subProduct: subProductId });

  if (!size) {
    throw new NotFoundError('Size not found');
  }

  Object.assign(size, updateData);
  await size.save();

  return size;
};

/**
 * Delete size
 */
const deleteSize = async (subProductId, sizeId, tenantId, user = null) => {
  // Resolve system tenant for super admin
  tenantId = await resolveSystemTenant(tenantId, user);

  const subProduct = await SubProduct.findOne({
    _id: subProductId,
    tenant: tenantId,
  });

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found for this tenant');
  }

  const Size = require('../models/Size');
  const size = await Size.findOne({ _id: sizeId, subProduct: subProductId });

  if (!size) {
    throw new NotFoundError('Size not found');
  }

  await size.deleteOne();

  subProduct.sizes = subProduct.sizes.filter(s => s.toString() !== sizeId);
  await subProduct.save();

  return true;
};

/**
 * Update stock for SubProduct
 */
const updateStock = async (subProductId, stockData, tenantId, user = null) => {
  // Resolve system tenant for super admin
  tenantId = await resolveSystemTenant(tenantId, user);

  const { stock, sizeId } = stockData;

  if (sizeId) {
    const Size = require('../models/Size');
    const size = await Size.findOne({ _id: sizeId, subProduct: subProductId });

    if (!size) {
      throw new NotFoundError('Size not found');
    }

    size.stock = stock;
    await size.save();

    return size;
  } else {
    const subProduct = await SubProduct.findOne({
      _id: subProductId,
      tenant: tenantId,
    });

    if (!subProduct) {
      throw new NotFoundError('SubProduct not found for this tenant');
    }

    return { stock, message: 'Stock updated at SubProduct level (no size specified)' };
  }
};

/**
 * Get stock status for SubProduct
 */
const getStockStatus = async (subProductId) => {
  const subProduct = await SubProduct.findById(subProductId)
    .populate('sizes')
    .lean();

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found');
  }

  let totalStock = 0;
  let inStock = false;
  let lowStock = false;

  if (subProduct.sizes && subProduct.sizes.length > 0) {
    totalStock = subProduct.sizes.reduce((sum, size) => sum + (size.stock || 0), 0);
    inStock = totalStock > 0;
    lowStock = totalStock > 0 && totalStock <= 10;
  }

  return {
    subProductId: subProduct._id,
    totalStock,
    inStock,
    lowStock,
    outOfStock: totalStock === 0,
    status: totalStock === 0 ? 'out_of_stock' : lowStock ? 'low_stock' : 'in_stock',
  };
};


module.exports = {
  getMySubProducts,
  createSubProduct,
  getSubProduct,
  updateSubProduct,
  deleteSubProduct,
  updateStockBulk,
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

  // Inventory Management
  getSubProductInventory,
  adjustStock,
  getStockMovements,
  getLowStockSubProducts,
  getOutOfStockSubProducts,
  setReorderPoints,
  
  // Sales & Analytics
  getSubProductSales,
  getSubProductRevenue,
  getTopSellingSubProducts,
  getSubProductConversionRate,
  getSubProductAverageOrderValue,

  // Additional functions for routes
  getAllSubProducts,
  getSubProductsByTenant,
  getSubProductsByProduct,
  getSubProductById,
  getSubProductBySKU,
  addSize,
  updateSize,
  deleteSize,
  updateStock,
  getStockStatus,
};