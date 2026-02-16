// services/product.service.js

const Brand = require('../models/Brand');
const mongoose = require('mongoose');
const { searchProducts: searchProductsNew } = require('./search.service');
const { ValidationError, ConflictError, NotFoundError, ForbiddenError } = require('../utils/errors');
const resolveTagReferences = require('../helpers/resolveTagReferences.helper');
const resolveFlavorReferences = require('../helpers/resolveFlavorReference.helper');
const Product = require('../models/Product');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Tenant = require('../models/tenant');
const Sales = require('../models/Sales');
const Review = require('../models/review');
const SubProduct = require('../models/subProduct');
const Size = require('../models/size');
const Tag = require('../models/tag');
const Flavor = require('../models/Flavor');
const Order = require('../models/Order');
const cloudinaryService = require('./cloudinary.service');
const { generateDynamicPriceRanges, buildPagination, applyPostFilters, processProductForDisplay, getSortStage, buildProductQuery, getProductsRatings, getProductsSales } = require('../helpers/buildProductQuery.helper');
const { createSlug, generateUniqueSlug } = require('../utils/slugify');
const { parseCSV, generateCSV } = require('../utils/csvParser');
const { generateEmbedding } = require('../utils/embeddings');
const {
  resolveCategoryToObjectIds,
  resolveSubCategoryToObjectIds,
  resolveBrandToObjectIds,
  buildCategoryFilter,
  buildSubCategoryFilter,
  buildBrandFilter
} = require('../helpers/searchFilter.helper');



// Schema validation constants
const VALID_TYPES = [
  'beer', 'wine', 'sparkling_wine', 'fortified_wine', 'spirit',
  'liqueur', 'cocktail_ready_to_drink', 'non_alcoholic', 'other',
  'juice', 'tea', 'coffee', 'energy_drink', 'water', 'mixer',
  'accessory', 'snack', 'gift'
];

const VALID_STANDARD_SIZES = [
  // Wine & Champagne
  '10cl', '18.7cl', '20cl', '25cl', '37.5cl', '50cl',
  '75cl', '100cl', '150cl', '300cl', '450cl', '600cl', '900cl', '1200cl', '1500cl',
  
  // Spirits
  '5cl', '10cl', '20cl', '35cl', '50cl', '70cl', '1L', '1.5L', '1.75L', '3L',
  
  // Beer & Cider
  '33cl', '35cl', '44cl', '50cl', '56.8cl', '66cl',
  'can-250ml', 'can-330ml', 'can-440ml', 'can-473ml', 'can-500ml', 'can-568ml',
  'bottle-275ml', 'bottle-330ml', 'bottle-355ml', 'bottle-500ml', 'bottle-600ml', 'bottle-750ml',
  'nip-50ml', 'half-pint', 'pint', 'quart',
  
  // Soft Drinks & Water
  '200ml', '250ml', '300ml', '330ml', '500ml', '600ml', '1L', '1.5L', '2L', '3L', '5L',
  
  // Kegs & Bulk
  '5L', '10L', '20L', '30L', '50L', 'keg', 'mini-keg', 'barrel',
  
  // Packs & Sets
  'pack-4', 'pack-6', 'pack-8', 'pack-12', 'pack-24', 'case-12', 'case-24',
  
  // Other
  'unit', 'kg-1', 'set'
];

const VALID_SIZE_ENUMS = [
  '10cl', '20cl', '25cl', '30cl', '33cl', '35cl', '37.5cl', '50cl',
  '60cl', '70cl', '75cl', '100cl', '1L', '1.5L', '2L', '3L', '4.5L',
  '5L', '10L', 'can-330ml', 'can-500ml', 'bottle-750ml', 'magnum',
  'jeroboam', 'pack-6', 'pack-12', 'unit-single', 'set-4', 'kg-0.5', 'kg-1'
];

const VALID_FLAVOR_PROFILES = [
  // Fruity
  'fruity', 'citrus', 'tropical', 'berry', 'apple', 'pear', 'peach', 'cherry', 'plum', 'stone_fruit',
  'dried_fruit', 'raisins', 'prunes', 'figs', 'blackberry', 'cassis', 'dark_cherry', 'red_berry',
  'raspberry', 'strawberry', 'blueberry', 'cranberry', 'redcurrant', 'white_peach', 'nectarine', 'apricot',
  'melon', 'watermelon', 'guava', 'passion_fruit', 'lychee', 'mango', 'pineapple', 'banana', 'orange', 'lemon', 'lime', 'grapefruit',
  'date',
  
  // Sweet
  'vanilla', 'caramel', 'chocolate', 'honey', 'sweet', 'butterscotch', 'toffee', 'maple', 'sugar',
  'dark_chocolate', 'cocoa', 'molasses', 'sugary', 'candy',
  
  // Spicy
  'spicy', 'cinnamon', 'ginger', 'herbal', 'mint', 'pepper', 'cloves', 'nutmeg', 'cardamom', 'spice',
  'peppery', 'clove', 'anise', 'licorice', 'basil', 'thyme', 'rosemary', 'sage',
  
  // Floral
  'floral', 'rose', 'lavender', 'blossom', 'perfumed', 'flower', 'jasmine', 'elderflower',
  'honeysuckle', 'violet', 'hibiscus', 'chamomile',
  
  // Woody
  'oak', 'woody', 'tobacco', 'leather', 'cedar', 'sandalwood', 'oaky', 'pine',
  
  // Nutty
  'nutty', 'almond', 'hazelnut', 'walnut', 'pecan', 'peanuts',
  
  // Earthy
  'earthy', 'mineral', 'wet_stone', 'mushroom', 'forest_floor', 'moss', 'slate', 'chalk', 'petrol', 'truffle',
  
  // Smoky
  'smoky', 'peaty', 'fire', 'charcoal', 'tar', 'medicinal', 'charred', 'burnt', 'ash', 'campfire', 'bacon', 'bbq',
  
  // Creamy
  'creamy', 'buttery', 'dairy', 'custard', 'cream', 'milky', 'yogurt', 'cheese',
  
  // Other
  'dry', 'bitter', 'sour', 'crisp', 'fresh', 'rich', 'full', 'complex', 'balanced', 'smooth',
  'elegant', 'delicate', 'bold', 'intense', 'subtle', 'zesty', 'lively', 'refreshing', 'soft',
  'round', 'velvety', 'tannic', 'astringent', 'bright', 'deep', 'light', 'medium', 'roasted', 'tart',
  'acidic', 'salty', 'savory', 'umami', 'clean', 'malty', 'grainy', 'biscuit', 'bread', 'toast',
  'coffee', 'espresso'
];

const NON_BEVERAGE_TYPES = ['accessory', 'snack', 'gift'];

/**
 * Create a new product in the central catalog
 * @param {Object} inputData - Product data from request body
 * @param {Object} user - Authenticated user object
 * @param {Object|null} tenant - Tenant object (if tenant submission)
 * @returns {Promise<Object>} Created product with optional subproduct
 */
/**
 * Create a new product with comprehensive validation and processing
 * @param {Object} inputData - Product data
 * @param {Object} user - Authenticated user
 * @param {Object} tenant - Tenant context (for tenant submissions)
 * @returns {Promise<Object>} Created product and optional SubProduct
 */
const createProduct = async (inputData, user, tenant = null) => {
  const {
    // Core identification
    name,
    slug,
    barcode,
    gtin,

    // Beverage-specific attributes
    isAlcoholic = false,
    abv,
    proof,
    volumeMl,
    volume,
    standardSizes = [],
    originCountry,
    region,
    producer,
    brand,

    // Categorization
    type,
    subType,
    category,
    subCategory,
    tags = [],
    flavors = [],
    flavorProfile = [],

    // Descriptive content
    shortDescription,
    description,
    tagline,
    tastingNotes = {},
    servingSuggestions = {},
    foodPairings = [],

    // Additional details
    ingredients = [],
    allergens = [],
    nutritionalInfo = {},
    awards = [],

    // Expansion fields
    material,
    shelfLifeDays,
    isPerishable = false,

    // Dietary flags
    isDietary = {},

    // Media
    images = [],
    videos = [],

    // SEO
    metaTitle,
    metaDescription,
    keywords = [],

    // External links
    externalLinks = [],

    // Settings
    isFeatured = false,
    allowReviews = true,
    requiresAgeVerification,
    isPublished = false,
    publishedAt: publishedAtInput,
    discontinuedAt: discontinuedAtInput,

    // SubProduct data (for tenant submissions)
    subProductData,
  } = inputData;

  // ============================================================
  // STEP 1: Validate Required Fields
  // ============================================================
  if (!name || !type) {
    throw new ValidationError('Product name and type are required');
  }

  if (!VALID_TYPES.includes(type)) {
    throw new ValidationError(
      `Invalid product type. Must be one of: ${VALID_TYPES.join(', ')}`
    );
  }

  // ============================================================
  // STEP 2: Validate Standard Sizes
  // ============================================================
  if (standardSizes.length > 0) {
    const invalidSizes = standardSizes.filter(s => !VALID_STANDARD_SIZES.includes(s));
    if (invalidSizes.length > 0) {
      throw new ValidationError(
        `Invalid standard sizes: ${invalidSizes.join(', ')}`
      );
    }
  }

  // ============================================================
  // STEP 3: Validate Flavor Profiles
  // ============================================================
  if (flavorProfile.length > 0) {
    const invalidProfiles = flavorProfile.filter(fp => !VALID_FLAVOR_PROFILES.includes(fp));
    if (invalidProfiles.length > 0) {
      throw new ValidationError(
        `Invalid flavor profiles: ${invalidProfiles.join(', ')}`
      );
    }
  }

  // ============================================================
  // STEP 4: Beverage-Specific Validations
  // ============================================================
  let finalAbv = abv;
  let finalProof = proof;
  let autoRequiresAgeVerification = requiresAgeVerification;

  if (isAlcoholic) {
    if (abv === undefined || abv === null) {
      throw new ValidationError('ABV is required for alcoholic beverages');
    }
    if (abv < 0 || abv > 100) {
      throw new ValidationError('ABV must be between 0 and 100');
    }

    // Auto-calculate proof if not provided
    if (!proof) {
      finalProof = abv * 2;
    }

    // Auto-enable age verification for alcoholic products
    if (autoRequiresAgeVerification === undefined) {
      autoRequiresAgeVerification = true;
    }
  } else {
    finalAbv = 0; // Normalize non-alcoholic to 0
    finalProof = 0;

    if (autoRequiresAgeVerification === undefined) {
      autoRequiresAgeVerification = false;
    }
  }

  // Non-beverage validations
  if (NON_BEVERAGE_TYPES.includes(type)) {
    if (volumeMl) {
      throw new ValidationError(
        'volumeMl should not be set for non-beverage product types'
      );
    }
    if (isAlcoholic) {
      throw new ValidationError(
        'Non-beverage products cannot be marked as alcoholic'
      );
    }
  }

  // ============================================================
  // STEP 5: Determine Submission Source & Permissions
  // ============================================================
  let submissionSource = 'admin';
  let submittingTenant = null;
  let isTenantSubmission = false;

  if (user.role === 'super_admin') {
    submissionSource = 'admin';
  } else if (['tenant_owner', 'tenant_admin'].includes(user.role)) {
    if (!tenant) {
      throw new ForbiddenError('Tenant context required for tenant submissions');
    }

    // Verify tenant is active
    const tenantDoc = await Tenant.findById(tenant._id || tenant);
    if (!tenantDoc) {
      throw new NotFoundError('Tenant not found');
    }

    if (tenantDoc.status !== 'approved' ||
      !['active', 'trialing'].includes(tenantDoc.subscriptionStatus)) {
      throw new ForbiddenError('Tenant account is not active');
    }

    submissionSource = 'tenant';
    submittingTenant = tenantDoc._id;
    isTenantSubmission = true;

    // Tenant submissions MUST include SubProduct data
    if (!subProductData || typeof subProductData !== 'object') {
      throw new ValidationError(
        'subProductData is required for tenant product submissions'
      );
    }

    const { baseSellingPrice, costPrice, sizes } = subProductData;

    if (!baseSellingPrice || baseSellingPrice <= 0) {
      throw new ValidationError('Valid baseSellingPrice is required in subProductData');
    }
    if (!costPrice || costPrice <= 0) {
      throw new ValidationError('Valid costPrice is required in subProductData');
    }
    if (!sizes || !Array.isArray(sizes) || sizes.length === 0) {
      throw new ValidationError('At least one size variant is required in subProductData');
    }
  } else {
    throw new ForbiddenError('Insufficient permissions to create products');
  }

  // ============================================================
  // STEP 6: Check for Duplicates
  // ============================================================
  const duplicateConditions = [];

  if (slug) {
    duplicateConditions.push({ slug: createSlug(slug) });
  }
  if (barcode) {
    duplicateConditions.push({ barcode });
  }
  if (gtin) {
    duplicateConditions.push({ gtin });
  }

  if (duplicateConditions.length > 0) {
    const existingProduct = await Product.findOne({
      $or: duplicateConditions,
      status: { $in: ['pending', 'approved'] },
    }).select('slug barcode gtin name').lean();

    if (existingProduct) {
      const duplicateField =
        existingProduct.slug === createSlug(slug) ? 'slug' :
          existingProduct.barcode === barcode ? 'barcode' : 'gtin';

      throw new ConflictError(
        `Product "${existingProduct.name}" with this ${duplicateField} already exists`
      );
    }
  }

  // ============================================================
  // STEP 7: Generate Slug
  // ============================================================
  let finalSlug;

  if (slug) {
    // Validate provided slug
    finalSlug = createSlug(slug);

    // Check if it already exists
    const existingWithSlug = await Product.findOne({
      slug: finalSlug,
      status: { $in: ['pending', 'approved'] },
    }).select('_id').lean();

    if (existingWithSlug) {
      throw new ConflictError('Product with this slug already exists');
    }
  } else {
    // Auto-generate unique slug
    finalSlug = await generateUniqueSlug(
      name,
      async (testSlug) => {
        const exists = await Product.findOne({
          slug: testSlug,
          status: { $in: ['pending', 'approved'] },
        }).select('_id').lean();
        return !!exists;
      }
    );
  }

  // ============================================================
  // STEP 8: Resolve Brand
  // ============================================================
  let brandId = null;

  if (brand) {
    // Check if it's an ObjectId
    if (/^[0-9a-fA-F]{24}$/.test(brand)) {
      const existingBrand = await Brand.findById(brand).select('_id status').lean();
      if (!existingBrand) {
        throw new ValidationError('Brand ID not found');
      }
      if (existingBrand.status !== 'active') {
        throw new ValidationError('Brand is not active');
      }
      brandId = brand;
    } else {
      // Brand name provided - find or create
      const brandSlug = createSlug(brand);

      let existingBrand = await Brand.findOne({
        $or: [
          { name: new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          { slug: brandSlug },
        ],
      }).select('_id status').lean();

      if (!existingBrand) {
        // Generate unique slug for new brand
        const uniqueBrandSlug = await generateUniqueSlug(
          brand,
          async (testSlug) => {
            const exists = await Brand.findOne({ slug: testSlug }).select('_id').lean();
            return !!exists;
          }
        );

        existingBrand = await Brand.create({
          name: brand,
          slug: uniqueBrandSlug,
          status: 'pending', // Auto-created brands need approval
          brandType: 'general',
          countryOfOrigin: originCountry || 'Unknown',
          createdBy: user._id,
        });
      }

      brandId = existingBrand._id;
    }
  }

  // ============================================================
  // STEP 9: Resolve Category (must exist and be published)
  // ============================================================
  let categoryId = null;

  if (category) {
    if (/^[0-9a-fA-F]{24}$/.test(category)) {
      const existingCategory = await Category.findOne({
        _id: category,
        status: 'published',
      }).lean();
      if (!existingCategory) {
        throw new ValidationError('Category not found or not published');
      }
      categoryId = category;
    } else {
      const existingCategory = await Category.findOne({
        name: new RegExp(`^${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        status: 'published',
      }).lean();
      if (!existingCategory) {
        throw new ValidationError(
          `Category "${category}" not found or not published`
        );
      }
      categoryId = existingCategory._id;
    }
  }

  // ============================================================
  // STEP 10: Resolve SubCategory (must belong to parent category)
  // ============================================================
  let subCategoryId = null;

  if (subCategory && categoryId) {
    if (/^[0-9a-fA-F]{24}$/.test(subCategory)) {
      const existingSub = await SubCategory.findOne({
        _id: subCategory,
        parent: categoryId,
        status: 'published',
      }).lean();
      if (!existingSub) {
        throw new ValidationError(
          'SubCategory not found, does not belong to parent category, or not published'
        );
      }
      subCategoryId = subCategory;
    } else {
      const existingSub = await SubCategory.findOne({
        name: new RegExp(`^${subCategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        parent: categoryId,
        status: 'published',
      }).lean();
      if (!existingSub) {
        throw new ValidationError(
          `SubCategory "${subCategory}" not found under parent category or not published`
        );
      }
      subCategoryId = existingSub._id;
    }
  }

  // ============================================================
  // STEP 11: Resolve Tags & Flavors
  // ============================================================
  const tagIds = await resolveTagReferences(tags);
  const flavorIds = await resolveFlavorReferences(flavors);

  // ============================================================
  // STEP 12: Handle Description (AI generation if needed)
  // ============================================================
  let finalDescription = description;
  let aiGeneratedDescription = false;

  if (!description && shortDescription) {
    finalDescription = shortDescription;
  } else if (!description) {
    // Generate basic description
    const brandName = typeof brand === 'string' ? brand : '';
    const typeName = type.replace(/_/g, ' ');
    finalDescription = `${brandName ? brandName + ' ' : ''}${name} - Premium ${typeName}. ${shortDescription || 'Contact us for detailed information.'}`;
    aiGeneratedDescription = true;
  }

  // ============================================================
  // STEP 13: Process Images
  // ============================================================
  const processedImages = images.map((img, index) => {
    if (typeof img === 'string') {
      // URL provided
      return {
        url: img,
        alt: `${name} - Image ${index + 1}`,
        isPrimary: index === 0,
        order: index,
      };
    } else {
      // Full image object
      return {
        ...img,
        isPrimary: img.isPrimary !== undefined ? img.isPrimary : index === 0,
        order: img.order !== undefined ? img.order : index,
        alt: img.alt || `${name} - Image ${index + 1}`,
      };
    }
  });

  // ============================================================
  // STEP 14: Generate Semantic Embedding
  // ============================================================
  const embeddingText = [
    name,
    tagline,
    finalDescription,
    shortDescription,
    subType,
    flavorProfile.join(' '),
    tastingNotes.aroma?.join(' '),
    tastingNotes.palate?.join(' '),
    servingSuggestions.glassware,
  ].filter(Boolean).join(' ');

  let embedding = null;
  try {
    embedding = await generateEmbedding(embeddingText);
  } catch (error) {
    console.error('Failed to generate embedding:', error.message);
    // Continue without embedding
  }

  // ============================================================
  // STEP 15: Determine Product Status & Approval
  // ============================================================
  let status = 'pending';
  let publishedAt = null;
  let approvedBy = null;

  // If isPublished is explicitly set to true, publish the product
  if (isPublished) {
    status = 'approved';
    publishedAt = publishedAtInput || new Date();
    if (user.role === 'super_admin') {
      approvedBy = user._id;
    }
  } else if (user.role === 'super_admin') {
    status = 'approved';
    publishedAt = new Date();
    approvedBy = user._id;
  }



  // ============================================================
  // STEP 16: Build & Create Central Product
  // ============================================================
  const productData = {
    // Core fields
    name: name.trim(),
    slug: finalSlug,
    barcode: barcode || undefined,
    gtin: gtin || undefined,

    // Beverage attributes
    isAlcoholic,
    abv: finalAbv,
    proof: finalProof,
    volumeMl,
    volume,
    standardSizes,
    originCountry,
    region,
    producer,

    // Relations
    brand: brandId,

    // Classification
    type,
    subType,
    category: categoryId,
    subCategory: subCategoryId,
    tags: tagIds,
    flavors: flavorIds,

    // Content
    shortDescription,
    description: finalDescription,
    tagline,
    aiGeneratedDescription,
    tastingNotes,
    servingSuggestions,
    foodPairings,
    flavorProfile,

    // Additional details
    ingredients,
    allergens,
    nutritionalInfo,
    awards,

    // Expansion fields
    material,
    shelfLifeDays,
    isPerishable,
    isDietary,

    // Media
    images: processedImages,
    videos,

    // SEO
    metaTitle: metaTitle || name,
    metaDescription: metaDescription || shortDescription || finalDescription?.substring(0, 160),
    keywords,

    // External
    externalLinks,

    // Settings
    isFeatured: user.role === 'super_admin' ? isFeatured : false,
    allowReviews,
    requiresAgeVerification: autoRequiresAgeVerification,
    discontinuedAt: discontinuedAtInput || null,

    // Status
    status,
    publishedAt,
    approvedBy,

    // Submission tracking
    submissionSource,
    submittingTenant: isTenantSubmission ? submittingTenant : undefined,
    createdBy: user._id,

    // AI
    embedding,
  };

  const product = await Product.create(productData);

  // ============================================================
  // STEP 17: Update Related Collection Counts (if approved)
  // ============================================================
  if (status === 'approved') {
    const countUpdates = [];

    if (brandId) {
      countUpdates.push(
        Brand.findByIdAndUpdate(brandId, {
          $inc: { productCount: 1, activeProductCount: 1 },
        })
      );
    }

    if (categoryId) {
      countUpdates.push(
        Category.findByIdAndUpdate(categoryId, {
          $inc: { productCount: 1, activeProductCount: 1 },
        })
      );
    }

    if (subCategoryId) {
      countUpdates.push(
        SubCategory.findByIdAndUpdate(subCategoryId, {
          $inc: { productCount: 1, activeProductCount: 1 },
        })
      );
    }

    if (tagIds.length > 0) {
      countUpdates.push(
        Tag.updateMany(
          { _id: { $in: tagIds } },
          { $inc: { productCount: 1 } }
        )
      );
    }

    if (flavorIds.length > 0) {
      countUpdates.push(
        Flavor.updateMany(
          { _id: { $in: flavorIds } },
          { $inc: { productCount: 1 } }
        )
      );
    }

    if (countUpdates.length > 0) {
      await Promise.all(countUpdates);
    }
  }

  // ===============================
  // 🔹 Determine Badge
  // ===============================
  const badge = null;

  // ============================================================
  // STEP 18: Create SubProduct & Sizes (Tenant Submissions)
  // ============================================================
  let subProduct = null;
  let createdSizes = [];

  if (isTenantSubmission) {
    const {
      // Commercial Data
      baseSellingPrice,
      costPrice,
      currency = 'NGN',
      taxRate = 0,
      marginPercentage,
      
      // Sale / Discount Pricing
      salePrice,
      saleStartDate,
      saleEndDate,
      saleType,
      saleDiscountValue,
      saleBanner,
      isOnSale = false,
      
      // Sizes
      sizes = [],
      sellWithoutSizeVariants = false,
      defaultSize,
      
      // Inventory
      stockStatus = 'in_stock',
      lowStockThreshold = 10,
      reorderPoint = 5,
      reorderQuantity = 50,
      
      // Vendor
      vendor,
      supplierSKU,
      supplierPrice,
      leadTimeDays,
      minimumOrderQuantity,
      
      // Tenant Overrides
      shortDescriptionOverride,
      descriptionOverride,
      imagesOverride = [],
      customKeywords = [],
      embeddingOverride,
      tenantNotes,
      
      // Status
      isFeaturedByTenant = false,
      isNewArrival = false,
      isBestSeller = false,
      
      // Promotions
      discount = 0,
      discountType,
      discountStart,
      discountEnd,
      flashSale,
      
      // Shipping
      shipping = {},
      
      // Status (handled separately)
      status: subProductStatus = 'draft',
      activatedAt: subProductActivatedAt = null,
      discontinuedAt: subProductDiscontinuedAt = null,
    } = subProductData;

    // Generate unique SKU
    const subProductSku = await generateSKU(product._id, submittingTenant, {
      strategy: 'hash',
      model: SubProduct,
    });

    const subProductPayload = {
      product: product._id,
      tenant: submittingTenant,
      sku: subProductSku,
      baseSellingPrice,
      costPrice,
      currency,
      taxRate,
      marginPercentage,
      
      // Sale / Discount Pricing
      salePrice,
      saleStartDate,
      saleEndDate,
      saleType,
      saleDiscountValue,
      saleBanner,
      isOnSale,
      
      // Tenant Overrides
      shortDescriptionOverride,
      descriptionOverride,
      imagesOverride,
      customKeywords,
      embeddingOverride,
      tenantNotes,
      
      // Sizes
      sizes: [],
      sellWithoutSizeVariants,
      defaultSize,
      
      // Inventory
      stockStatus,
      totalStock: 0,
      reservedStock: 0,
      availableStock: 0,
      lowStockThreshold,
      reorderPoint,
      reorderQuantity,
      
      // Vendor
      vendor,
      supplierSKU,
      supplierPrice,
      leadTimeDays,
      minimumOrderQuantity,
      
      // Status
      status: subProductStatus,
      isFeaturedByTenant,
      isNewArrival,
      isBestSeller,
      addedAt: new Date(),
      activatedAt: subProductActivatedAt || (subProductStatus === 'active' ? new Date() : null),
      discontinuedAt: subProductDiscontinuedAt,
      
      // Promotions
      discount,
      discountType,
      discountStart,
      discountEnd,
      flashSale,
      
      // Shipping
      shipping,
      
      metadata: {
        createdBy: user._id,
        lastModifiedBy: user._id,
      },
    };

    subProduct = await SubProduct.create(subProductPayload);

    // Create Size variants
    if (sizes && sizes.length > 0) {
      createdSizes = await createSizeVariants(
        sizes,
        subProduct._id,
        currency,
        product.requiresAgeVerification
      );

      // Calculate total stock
      const totalStock = createdSizes.reduce((sum, size) => sum + (size.stock || 0), 0);
      const availableStock = createdSizes.reduce((sum, size) => sum + (size.availableStock || 0), 0);

      // Update SubProduct with sizes and stock
      subProduct.sizes = createdSizes.map(s => s._id);
      subProduct.totalStock = totalStock;
      subProduct.availableStock = availableStock;

      // Set stock status
      if (availableStock === 0) {
        subProduct.stockStatus = 'out_of_stock';
      } else if (availableStock <= (subProduct.lowStockThreshold || 10)) {
        subProduct.stockStatus = 'low_stock';
      } else {
        subProduct.stockStatus = 'in_stock';
      }

      await subProduct.save();
    }

    // Update product's subProducts array
    product.subProducts.push(subProduct._id);
    product.tenantCount = 1;
    await product.save();

    // Update tenant stats
    await Tenant.findByIdAndUpdate(
      submittingTenant,
      {
        $inc: {
          productCount: 1,
          activeSubProductCount: 1,
        },
      }
    );
  }

  // ============================================================
  // STEP 19: Populate & Return Result
  // ============================================================
  const populatedProduct = await Product.findById(product._id)
    .populate('brand', 'name slug logo status countryOfOrigin')
    .populate('category', 'name slug type icon color')
    .populate('subCategory', 'name slug type')
    .populate('tags', 'name slug type color displayName')
    .populate('flavors', 'name value color category')
    .lean();

  const result = {
    product: populatedProduct,
    message: status === 'approved'
      ? 'Product created and approved successfully'
      : 'Product created and pending approval',
  };

  if (subProduct) {
    const populatedSubProduct = await SubProduct.findById(subProduct._id)
      .populate('tenant', 'name slug logo city state country')
      .populate({
        path: 'sizes',
        select: 'size displayName volumeMl sellingPrice costPrice stock availableStock availability currency sku isDefault',
      })
      .lean();

    result.subProduct = populatedSubProduct;
    result.sizes = createdSizes.length;
  }

  return result;
};

// ============================================================
// HELPER: Create Size Variants
// ============================================================

/**
 * Helper: Create size variants for a SubProduct
 * @private
 */
const createSizeVariants = async (
  sizes,
  subProductId,
  defaultCurrency,
  requiresAgeVerification = false
) => {
  const sizePromises = sizes.map(async (sizeData) => {
    const {
      size,
      displayName,
      sizeCategory,
      unitType = 'volume_ml',
      sellingPrice,
      costPrice,
      compareAtPrice,
      currency,
      stock = 0,
      availableStock,
      reservedStock = 0,
      lowStockThreshold = 10,
      reorderPoint = 5,
      reorderQuantity = 50,
      sku,
      barcode,
      weightGrams,
      volumeMl,
      discount,
      isExpiryRequired = false,
      expiryDate,
      isProductionDateRequired = false,
      productionDate,
      batchNumber,
      image,
      minOrderQuantity = 1,
      maxOrderQuantity,
      packaging,
      isDefault = false,
    } = sizeData;

    // Validate required fields
    if (!size) {
      throw new ValidationError('size is required for each size variant');
    }
    if (!sellingPrice || sellingPrice <= 0) {
      throw new ValidationError('Valid sellingPrice is required for each size variant');
    }
    if (!costPrice || costPrice <= 0) {
      throw new ValidationError('Valid costPrice is required for each size variant');
    }

    // Validate size enum
    if (!VALID_SIZE_ENUMS.includes(size)) {
      throw new ValidationError(`Invalid size enum: ${size}. Must be one of: ${VALID_SIZE_ENUMS.join(', ')}`);
    }

    // Calculate available stock
    const finalAvailableStock = availableStock !== undefined
      ? availableStock
      : Math.max(0, stock - reservedStock);

    // Determine availability based on stock
    let availability = 'out_of_stock';
    if (finalAvailableStock > lowStockThreshold) {
      availability = 'in_stock';
    } else if (finalAvailableStock > 0) {
      availability = 'low_stock';
    }

    // Generate SKU if not provided
    const finalSku = sku || await generateSizeSKU(subProductId, size, {
      model: Size,
    });

    // Determine size category if not provided
    let finalSizeCategory = sizeCategory;
    if (!finalSizeCategory && volumeMl) {
      if (volumeMl < 100) {
        finalSizeCategory = 'miniature';
      } else if (volumeMl < 500) {
        finalSizeCategory = 'single_serve';
      } else if (volumeMl < 1000) {
        finalSizeCategory = 'standard';
      } else {
        finalSizeCategory = 'large';
      }
    }

    const sizePayload = {
      subproduct: subProductId,
      size,
      displayName: displayName || size,
      sizeCategory: finalSizeCategory,
      unitType,

      // Pricing
      sellingPrice,
      costPrice,
      compareAtPrice,
      currency: currency || defaultCurrency,

      // Stock
      stock,
      availableStock: finalAvailableStock,
      reservedStock,
      lowStockThreshold,
      reorderPoint,
      reorderQuantity,
      availability,

      // Identifiers
      sku: finalSku,
      barcode,

      // Physical attributes
      weightGrams,
      volumeMl,

      // Discount
      discount: discount || null,

      // Dates
      isExpiryRequired,
      expiryDate,
      isProductionDateRequired,
      productionDate,
      batchNumber,

      // Media
      image,

      // Order limits
      minOrderQuantity,
      maxOrderQuantity,

      // Packaging
      packaging,

      // Flags
      isDefault,
      requiresAgeVerification,
      status: 'active',

      // Stats
      totalSold: 0,
      totalRevenue: 0,
    };

    return Size.create(sizePayload);
  });

  return Promise.all(sizePromises);
};

// ============================================================
// UPDATE PRODUCT
// ============================================================

/**
 * Update existing product with validation and authorization
 * @param {string} productId - Product ID to update
 * @param {Object} updateData - Fields to update
 * @param {Object} user - Authenticated user
 * @param {Object} tenant - Tenant context
 * @returns {Promise<Object>} Updated product
 */
const updateProduct = async (productId, updateData, user, tenant = null) => {
  // ============================================================
  // STEP 1: Validate Product ID
  // ============================================================
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID format');
  }

  // ============================================================
  // STEP 2: Find Product
  // ============================================================
  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // ============================================================
  // STEP 3: Authorization Check
  // ============================================================
  const isSuperAdmin = user.role === 'super_admin';
  const isTenantOwner =
    tenant &&
    product.submittingTenant?.toString() === (tenant._id || tenant).toString() &&
    ['tenant_owner', 'tenant_admin'].includes(user.role);

  if (!isSuperAdmin && !isTenantOwner) {
    throw new ForbiddenError('You do not have permission to update this product');
  }

  // ============================================================
  // STEP 4: Extract & Validate Update Fields
  // ============================================================
  const {
    name,
    slug,
    barcode,
    gtin,
    isAlcoholic,
    abv,
    proof,
    volumeMl,
    volume,
    standardSizes,
    originCountry,
    region,
    producer,
    brand,
    type,
    subType,
    category,
    subCategory,
    tags,
    flavors,
    flavorProfile,
    shortDescription,
    description,
    tagline,
    tastingNotes,
    servingSuggestions,
    foodPairings,
    ingredients,
    allergens,
    nutritionalInfo,
    awards,
    material,
    shelfLifeDays,
    isPerishable,
    isDietary,
    images,
    videos,
    metaTitle,
    metaDescription,
    metaKeywords,
    externalLinks,
    isFeatured,
    allowReviews,
    requiresAgeVerification,
    status, // Only super-admin can change status
  } = updateData;

  // Track if we need to regenerate embedding
  let shouldRegenerateEmbedding = false;

  // ============================================================
  // STEP 5: Validate Status Change (Super-admin Only)
  // ============================================================
  if (status !== undefined && !isSuperAdmin) {
    throw new ForbiddenError('Only super-admins can change product status');
  }

  // ============================================================
  // STEP 6: Update Name & Slug
  // ============================================================
  if (name !== undefined && name !== product.name) {
    product.name = name.trim();
    shouldRegenerateEmbedding = true;

    // Auto-generate new slug if no slug provided
    if (!slug) {
      product.slug = await generateUniqueSlug(
        name,
        async (testSlug) => {
          const exists = await Product.findOne({
            slug: testSlug,
            _id: { $ne: productId },
            status: { $in: ['pending', 'approved'] },
          }).lean();
          return !!exists;
        }
      );
    }
  }

  if (slug !== undefined) {
    const newSlug = createSlug(slug);

    if (newSlug !== product.slug) {
      // Check uniqueness
      const existingWithSlug = await Product.findOne({
        slug: newSlug,
        _id: { $ne: productId },
        status: { $in: ['pending', 'approved'] },
      }).lean();

      if (existingWithSlug) {
        throw new ConflictError('Product with this slug already exists');
      }

      product.slug = newSlug;
    }
  }

  // ============================================================
  // STEP 7: Update Identifiers
  // ============================================================
  if (barcode !== undefined) {
    if (barcode && barcode !== product.barcode) {
      const existingBarcode = await Product.findOne({
        barcode,
        _id: { $ne: productId },
        status: { $in: ['pending', 'approved'] },
      }).lean();

      if (existingBarcode) {
        throw new ConflictError('Product with this barcode already exists');
      }
    }
    product.barcode = barcode || undefined;
  }

  if (gtin !== undefined) {
    if (gtin && gtin !== product.gtin) {
      const existingGtin = await Product.findOne({
        gtin,
        _id: { $ne: productId },
        status: { $in: ['pending', 'approved'] },
      }).lean();

      if (existingGtin) {
        throw new ConflictError('Product with this GTIN already exists');
      }
    }
    product.gtin = gtin || undefined;
  }

  // ============================================================
  // STEP 8: Update Beverage Attributes
  // ============================================================
  if (isAlcoholic !== undefined) {
    product.isAlcoholic = isAlcoholic;

    // Auto-update age verification
    if (requiresAgeVerification === undefined) {
      product.requiresAgeVerification = isAlcoholic;
    }
  }

  if (abv !== undefined) {
    if (product.isAlcoholic && (abv < 0 || abv > 100)) {
      throw new ValidationError('ABV must be between 0 and 100');
    }
    product.abv = product.isAlcoholic ? abv : 0;

    // Auto-calculate proof
    if (proof === undefined && product.isAlcoholic) {
      product.proof = abv * 2;
    }
  }

  if (proof !== undefined) {
    product.proof = proof;
  }

  if (volumeMl !== undefined) product.volumeMl = volumeMl;
  if (volume !== undefined) product.volume = volume;
  if (standardSizes !== undefined) product.standardSizes = standardSizes;
  if (originCountry !== undefined) product.originCountry = originCountry;
  if (region !== undefined) product.region = region;
  if (producer !== undefined) product.producer = producer;

  // ============================================================
  // STEP 9: Update Brand
  // ============================================================
  if (brand !== undefined) {
    const oldBrandId = product.brand;
    let newBrandId = null;

    if (brand) {
      if (/^[0-9a-fA-F]{24}$/.test(brand)) {
        const existingBrand = await Brand.findById(brand).lean();
        if (!existingBrand) {
          throw new ValidationError('Brand not found');
        }
        newBrandId = brand;
      } else {
        // Brand name provided - find or create
        const brandSlug = createSlug(brand);
        let existingBrand = await Brand.findOne({
          $or: [
            { name: new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            { slug: brandSlug },
          ],
        });

        if (!existingBrand) {
          const uniqueBrandSlug = await generateUniqueSlug(brand, async (testSlug) => {
            const exists = await Brand.findOne({ slug: testSlug }).lean();
            return !!exists;
          });

          existingBrand = await Brand.create({
            name: brand,
            slug: uniqueBrandSlug,
            status: 'pending',
            createdBy: user._id,
          });
        }

        newBrandId = existingBrand._id;
      }
    }

    // Update brand counts
    if (oldBrandId && oldBrandId.toString() !== newBrandId?.toString() && product.status === 'approved') {
      await Brand.findByIdAndUpdate(oldBrandId, {
        $inc: { productCount: -1, activeProductCount: -1 },
      });
    }

    if (newBrandId && oldBrandId?.toString() !== newBrandId.toString() && product.status === 'approved') {
      await Brand.findByIdAndUpdate(newBrandId, {
        $inc: { productCount: 1, activeProductCount: 1 },
      });
    }

    product.brand = newBrandId;
  }

  // ============================================================
  // STEP 10: Update Type
  // ============================================================
  if (type !== undefined) {
    if (!VALID_TYPES.includes(type)) {
      throw new ValidationError(`Invalid product type: ${type}`);
    }
    product.type = type;
  }

  if (subType !== undefined) {
    product.subType = subType;
  }

  // ============================================================
  // STEP 11: Update Category & SubCategory
  // ============================================================
  if (category !== undefined) {
    const oldCategoryId = product.category;
    let newCategoryId = null;

    if (category) {
      if (/^[0-9a-fA-F]{24}$/.test(category)) {
        const existingCategory = await Category.findOne({
          _id: category,
          status: 'published',
        }).lean();
        if (!existingCategory) {
          throw new ValidationError('Category not found or not published');
        }
        newCategoryId = category;
      } else {
        const existingCategory = await Category.findOne({
          name: new RegExp(`^${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
          status: 'published',
        }).lean();
        if (!existingCategory) {
          throw new ValidationError('Category not found or not published');
        }
        newCategoryId = existingCategory._id;
      }
    }

    // Update category counts
    if (oldCategoryId && oldCategoryId.toString() !== newCategoryId?.toString() && product.status === 'approved') {
      await Category.findByIdAndUpdate(oldCategoryId, {
        $inc: { productCount: -1, activeProductCount: -1 },
      });
    }

    if (newCategoryId && oldCategoryId?.toString() !== newCategoryId.toString() && product.status === 'approved') {
      await Category.findByIdAndUpdate(newCategoryId, {
        $inc: { productCount: 1, activeProductCount: 1 },
      });
    }

    product.category = newCategoryId;

    // Reset subcategory if category changed
    if (oldCategoryId?.toString() !== newCategoryId?.toString()) {
      product.subCategory = null;
    }
  }

  if (subCategory !== undefined) {
    const oldSubCategoryId = product.subCategory;
    let newSubCategoryId = null;

    if (subCategory && product.category) {
      if (/^[0-9a-fA-F]{24}$/.test(subCategory)) {
        const existingSub = await SubCategory.findOne({
          _id: subCategory,
          parent: product.category,
          status: 'published',
        }).lean();
        if (!existingSub) {
          throw new ValidationError('SubCategory not found under parent category');
        }
        newSubCategoryId = subCategory;
      } else {
        const existingSub = await SubCategory.findOne({
          name: new RegExp(`^${subCategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
          parent: product.category,
          status: 'published',
        }).lean();
        if (!existingSub) {
          throw new ValidationError('SubCategory not found under parent category');
        }
        newSubCategoryId = existingSub._id;
      }
    }

    // Update subcategory counts
    if (oldSubCategoryId && oldSubCategoryId.toString() !== newSubCategoryId?.toString() && product.status === 'approved') {
      await SubCategory.findByIdAndUpdate(oldSubCategoryId, {
        $inc: { productCount: -1, activeProductCount: -1 },
      });
    }

    if (newSubCategoryId && oldSubCategoryId?.toString() !== newSubCategoryId.toString() && product.status === 'approved') {
      await SubCategory.findByIdAndUpdate(newSubCategoryId, {
        $inc: { productCount: 1, activeProductCount: 1 },
      });
    }

    product.subCategory = newSubCategoryId;
  }

  // ============================================================
  // STEP 12: Update Tags & Flavors
  // ============================================================
  if (tags !== undefined) {
    const oldTagIds = product.tags.map(t => t.toString());
    const newTagIds = await resolveTagReferences(tags);

    // Update tag counts if product is approved
    if (product.status === 'approved') {
      const removedTags = oldTagIds.filter(id => !newTagIds.includes(id));
      const addedTags = newTagIds.filter(id => !oldTagIds.includes(id));

      if (removedTags.length > 0) {
        await Tag.updateMany(
          { _id: { $in: removedTags } },
          { $inc: { productCount: -1 } }
        );
      }

      if (addedTags.length > 0) {
        await Tag.updateMany(
          { _id: { $in: addedTags } },
          { $inc: { productCount: 1 } }
        );
      }
    }

    product.tags = newTagIds;
    shouldRegenerateEmbedding = true;
  }

  if (flavors !== undefined) {
    const oldFlavorIds = product.flavors.map(f => f.toString());
    const newFlavorIds = await resolveFlavorReferences(flavors);

    // Update flavor counts if product is approved
    if (product.status === 'approved') {
      const removedFlavors = oldFlavorIds.filter(id => !newFlavorIds.includes(id));
      const addedFlavors = newFlavorIds.filter(id => !oldFlavorIds.includes(id));

      if (removedFlavors.length > 0) {
        await Flavor.updateMany(
          { _id: { $in: removedFlavors } },
          { $inc: { productCount: -1 } }
        );
      }

      if (addedFlavors.length > 0) {
        await Flavor.updateMany(
          { _id: { $in: addedFlavors } },
          { $inc: { productCount: 1 } }
        );
      }
    }

    product.flavors = newFlavorIds;
    shouldRegenerateEmbedding = true;
  }

  if (flavorProfile !== undefined) {
    const invalidProfiles = flavorProfile.filter(fp => !VALID_FLAVOR_PROFILES.includes(fp));
    if (invalidProfiles.length > 0) {
      throw new ValidationError(`Invalid flavor profiles: ${invalidProfiles.join(', ')}`);
    }
    product.flavorProfile = flavorProfile;
    shouldRegenerateEmbedding = true;
  }

  // ============================================================
  // STEP 13: Update Descriptions & Content
  // ============================================================
  if (shortDescription !== undefined) {
    product.shortDescription = shortDescription;
    shouldRegenerateEmbedding = true;
  }

  if (description !== undefined) {
    product.description = description;
    product.aiGeneratedDescription = false;
    shouldRegenerateEmbedding = true;
  }

  if (tagline !== undefined) {
    product.tagline = tagline;
    shouldRegenerateEmbedding = true;
  }

  if (tastingNotes !== undefined) product.tastingNotes = tastingNotes;
  if (servingSuggestions !== undefined) product.servingSuggestions = servingSuggestions;
  if (foodPairings !== undefined) product.foodPairings = foodPairings;
  if (ingredients !== undefined) product.ingredients = ingredients;
  if (allergens !== undefined) product.allergens = allergens;
  if (nutritionalInfo !== undefined) product.nutritionalInfo = nutritionalInfo;
  if (awards !== undefined) product.awards = awards;

  // ============================================================
  // STEP 14: Update Expansion Fields
  // ============================================================
  if (material !== undefined) product.material = material;
  if (shelfLifeDays !== undefined) product.shelfLifeDays = shelfLifeDays;
  if (isPerishable !== undefined) product.isPerishable = isPerishable;
  if (isDietary !== undefined) product.isDietary = isDietary;

  // ============================================================
  // STEP 15: Update Media
  // ============================================================
  if (images !== undefined) {
    const processedImages = images.map((img, index) => {
      if (typeof img === 'string') {
        return {
          url: img,
          alt: `${product.name} - Image ${index + 1}`,
          isPrimary: index === 0,
          order: index,
        };
      } else {
        return {
          ...img,
          isPrimary: img.isPrimary !== undefined ? img.isPrimary : index === 0,
          order: img.order !== undefined ? img.order : index,
          alt: img.alt || `${product.name} - Image ${index + 1}`,
        };
      }
    });
    product.images = processedImages;
  }

  if (videos !== undefined) product.videos = videos;

  // ============================================================
  // STEP 16: Update SEO
  // ============================================================
  if (metaTitle !== undefined) product.metaTitle = metaTitle;
  if (metaDescription !== undefined) product.metaDescription = metaDescription;
  if (keywords !== undefined) product.metaKeywords = keywords;

  // ============================================================
  // STEP 17: Update Settings
  // ============================================================
  if (externalLinks !== undefined) product.externalLinks = externalLinks;

  if (isFeatured !== undefined && isSuperAdmin) {
    product.isFeatured = isFeatured;
  }

  if (allowReviews !== undefined) product.allowReviews = allowReviews;

  if (requiresAgeVerification !== undefined) {
    product.requiresAgeVerification = requiresAgeVerification;
  }

  // ============================================================
  // STEP 18: Handle Status Changes (Super-admin Only)
  // ============================================================
  if (status !== undefined && isSuperAdmin) {
    const oldStatus = product.status;
    product.status = status;

    // Handle status transitions
    if (status === 'approved' && oldStatus !== 'approved') {
      product.publishedAt = new Date();
      product.approvedBy = user._id;

      // Increment counts on related collections
      const updates = [];

      if (product.brand) {
        updates.push(
          Brand.findByIdAndUpdate(product.brand, {
            $inc: { productCount: 1, activeProductCount: 1 },
          })
        );
      }

      if (product.category) {
        updates.push(
          Category.findByIdAndUpdate(product.category, {
            $inc: { productCount: 1, activeProductCount: 1 },
          })
        );
      }

      if (product.subCategory) {
        updates.push(
          SubCategory.findByIdAndUpdate(product.subCategory, {
            $inc: { productCount: 1, activeProductCount: 1 },
          })
        );
      }

      if (product.tags.length > 0) {
        updates.push(
          Tag.updateMany(
            { _id: { $in: product.tags } },
            { $inc: { productCount: 1 } }
          )
        );
      }

      if (product.flavors.length > 0) {
        updates.push(
          Flavor.updateMany(
            { _id: { $in: product.flavors } },
            { $inc: { productCount: 1 } }
          )
        );
      }

      await Promise.all(updates);
    } else if (status === 'archived' && oldStatus === 'approved') {
      // Decrement counts
      const updates = [];

      if (product.brand) {
        updates.push(
          Brand.findByIdAndUpdate(product.brand, {
            $inc: { activeProductCount: -1 },
          })
        );
      }

      if (product.category) {
        updates.push(
          Category.findByIdAndUpdate(product.category, {
            $inc: { activeProductCount: -1 },
          })
        );
      }

      if (product.subCategory) {
        updates.push(
          SubCategory.findByIdAndUpdate(product.subCategory, {
            $inc: { activeProductCount: -1 },
          })
        );
      }

      await Promise.all(updates);
    } else if (status === 'rejected' && oldStatus === 'pending') {
      product.rejectedAt = new Date();
      product.rejectedBy = user._id;
    }
  }

  // ============================================================
  // STEP 19: Regenerate Embedding if Needed
  // ============================================================
  if (shouldRegenerateEmbedding) {
    const embeddingText = [
      product.name,
      product.tagline,
      product.description,
      product.shortDescription,
      product.subType,
      product.flavorProfile.join(' '),
      product.tastingNotes?.aroma?.join(' '),
      product.tastingNotes?.palate?.join(' '),
      product.servingSuggestions?.glassware,
    ].filter(Boolean).join(' ');

    try {
      product.embedding = await generateEmbedding(embeddingText);
    } catch (error) {
      console.error('Failed to regenerate embedding:', error.message);
      // Continue without updating embedding
    }
  }

  // ============================================================
  // STEP 20: Save & Return
  // ============================================================
  product.updatedAt = new Date();
  await product.save();

  // Populate and return
  const updatedProduct = await Product.findById(product._id)
    .populate('brand', 'name slug logo status countryOfOrigin')
    .populate('category', 'name slug type icon color')
    .populate('subCategory', 'name slug type')
    .populate('tags', 'name slug type color displayName')
    .populate('flavors', 'name value color category')
    .lean();

  return updatedProduct;
};

/**
 * Delete product (soft delete - archive)
 */
const deleteProduct = async (productId, user) => {
  // Validate
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  // Only super-admin can delete
  if (user.role !== 'super_admin') {
    throw new ForbiddenError('Only super-admins can delete products');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Check if product has active SubProducts
  const activeSubProducts = await SubProduct.countDocuments({
    product: productId,
    status: 'active',
  });

  if (activeSubProducts > 0) {
    throw new ValidationError(
      `Cannot delete product with ${activeSubProducts} active listings. Archive them first.`
    );
  }

  // Soft delete - change status to archived
  product.status = 'archived';
  await product.save();

  // Decrement counts on related collections
  const updates = [];
  if (product.brand) {
    updates.push(
      Brand.findByIdAndUpdate(product.brand, {
        $inc: { productCount: -1, activeProductCount: -1 },
      })
    );
  }
  if (product.category) {
    updates.push(
      Category.findByIdAndUpdate(product.category, {
        $inc: { productCount: -1, activeProductCount: -1 },
      })
    );
  }
  if (product.subCategory) {
    updates.push(
      SubCategory.findByIdAndUpdate(product.subCategory, {
        $inc: { productCount: -1, activeProductCount: -1 },
      })
    );
  }

  await Promise.all(updates);

  return { message: 'Product archived successfully' };
};

/**
 * Get product by barcode
 */
const getProductByBarcode = async (barcode) => {
  const product = await Product.findOne({ barcode, status: 'approved' })
    .populate('brand', 'name slug logo')
    .populate('category', 'name slug')
    .populate('subCategory', 'name slug')
    .populate('tags', 'name slug type color')
    .populate('flavors', 'name value color')
    .lean();

  if (!product) {
    throw new NotFoundError(`Product with barcode "${barcode}" not found`);
  }

  // Get active SubProducts
  const subProducts = await SubProduct.find({
    product: product._id,
    status: 'active',
  })
    .populate({
      path: 'tenant',
      match: {
        status: 'approved',
        subscriptionStatus: { $in: ['active', 'trialing'] },
      },
      select: 'name slug logo',
    })
    .populate({
      path: 'sizes',
      match: { availability: { $in: ['available', 'low_stock'] } },
      select: 'size displayName sellingPrice stock availability',
    })
    .select('tenant sku baseSellingPrice sizes')
    .lean();

  product.subProducts = subProducts.filter(sp => sp.tenant);

  return product;
};

/**
 * Import products from CSV/JSON file
 */
const importProducts = async (file, user) => {
  const results = {
    success: 0,
    failed: 0,
    errors: [],
    imported: [],
  };

  try {
    let productsData = [];

    // Parse file based on type
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      productsData = await parseCSV(file.buffer);
    } else if (
      file.mimetype === 'application/json' ||
      file.originalname.endsWith('.json')
    ) {
      productsData = JSON.parse(file.buffer.toString());
    } else {
      throw new ValidationError(
        'Unsupported file format. Please upload CSV or JSON'
      );
    }

    // Validate data structure
    if (!Array.isArray(productsData) || productsData.length === 0) {
      throw new ValidationError('Import file contains no valid product data');
    }

    // Process each product
    for (let i = 0; i < productsData.length; i++) {
      const productData = productsData[i];

      try {
        // Validate required fields
        if (!productData.name || !productData.type) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: 'Missing required fields: name and type',
            data: productData,
          });
          continue;
        }

        // Check if product already exists (by barcode or slug)
        let existingProduct = null;
        if (productData.barcode) {
          existingProduct = await Product.findOne({
            barcode: productData.barcode,
          });
        }

        if (!existingProduct && productData.slug) {
          existingProduct = await Product.findOne({ slug: productData.slug });
        }

        if (existingProduct) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: 'Product already exists',
            existingId: existingProduct._id,
            data: productData,
          });
          continue;
        }

        // Generate slug if not provided
        let slug = productData.slug;
        if (!slug) {
          slug = await generateUniqueSlug(productData.name, async (testSlug) => {
            const exists = await Product.findOne({ slug: testSlug }).lean();
            return !!exists;
          });
        }

        // Resolve brand
        let brandId = null;
        if (productData.brand) {
          const brandSlug = createSlug(productData.brand);
          let brand = await Brand.findOne({
            $or: [
              { name: new RegExp(`^${productData.brand}$`, 'i') },
              { slug: brandSlug },
            ],
          });

          if (!brand) {
            const uniqueBrandSlug = await generateUniqueSlug(
              productData.brand,
              async (testSlug) => {
                const exists = await Brand.findOne({ slug: testSlug }).lean();
                return !!exists;
              }
            );

            brand = await Brand.create({
              name: productData.brand,
              slug: uniqueBrandSlug,
              status: 'active',
            });
          }

          brandId = brand._id;
        }

        // Resolve category
        let categoryId = null;
        if (productData.category) {
          const category = await Category.findOne({
            name: new RegExp(`^${productData.category}$`, 'i'),
            status: 'published',
          });

          if (category) {
            categoryId = category._id;
          }
        }

        // Create product
        const product = await Product.create({
          name: productData.name,
          slug,
          barcode: productData.barcode,
          gtin: productData.gtin,
          type: productData.type,
          isAlcoholic: productData.isAlcoholic === 'true' || productData.isAlcoholic === true,
          abv: parseFloat(productData.abv) || 0,
          volumeMl: parseInt(productData.volumeMl),
          originCountry: productData.originCountry,
          region: productData.region,
          producer: productData.producer,
          brand: brandId,
          category: categoryId,
          shortDescription: productData.shortDescription,
          description: productData.description,
          status: 'approved',
          publishedAt: new Date(),
          approvedBy: user._id,
          submissionSource: 'importer',
        });

        results.success++;
        results.imported.push({
          id: product._id,
          name: product.name,
          slug: product.slug,
        });
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          error: error.message,
          data: productData,
        });
      }
    }

    return results;
  } catch (error) {
    throw new ValidationError(`Import failed: ${error.message}`);
  }
};

/**
 * Export tenant products to CSV
 */
const exportTenantProducts = async (tenantId, format = 'csv') => {
  // Get all SubProducts for tenant
  const subProducts = await SubProduct.find({ tenant: tenantId })
    .populate({
      path: 'product',
      select: 'name slug type isAlcoholic abv volumeMl originCountry brand category',
      populate: [
        { path: 'brand', select: 'name' },
        { path: 'category', select: 'name' },
      ],
    })
    .populate({
      path: 'sizes',
      select: 'size displayName sellingPrice costPrice stock availability',
    })
    .lean();

  // Transform to export format
  const exportData = subProducts.flatMap((sp) => {
    const baseData = {
      productName: sp.product?.name || 'N/A',
      productSlug: sp.product?.slug || 'N/A',
      sku: sp.sku,
      type: sp.product?.type || 'N/A',
      isAlcoholic: sp.product?.isAlcoholic ? 'Yes' : 'No',
      abv: sp.product?.abv || 0,
      volumeMl: sp.product?.volumeMl || '',
      originCountry: sp.product?.originCountry || '',
      brand: sp.product?.brand?.name || '',
      category: sp.product?.category?.name || '',
      baseSellingPrice: sp.baseSellingPrice,
      costPrice: sp.costPrice,
      currency: sp.currency,
      status: sp.status,
      totalSold: sp.totalSold || 0,
      totalRevenue: sp.totalRevenue || 0,
    };

    // If no sizes, return base data
    if (!sp.sizes || sp.sizes.length === 0) {
      return [baseData];
    }

    // Return row for each size
    return sp.sizes.map((size) => ({
      ...baseData,
      size: size.size,
      sizeDisplayName: size.displayName,
      sizeSellingPrice: size.sellingPrice,
      sizeCostPrice: size.costPrice,
      sizeStock: size.stock,
      sizeAvailability: size.availability,
    }));
  });

  // Generate file
  if (format === 'csv') {
    const csv = generateCSV(exportData);
    const filename = `tenant-products-${tenantId}-${Date.now()}.csv`;

    return {
      data: csv,
      filename,
      contentType: 'text/csv',
    };
  } else if (format === 'json') {
    const filename = `tenant-products-${tenantId}-${Date.now()}.json`;

    return {
      data: JSON.stringify(exportData, null, 2),
      filename,
      contentType: 'application/json',
    };
  } else {
    throw new ValidationError('Unsupported export format');
  }
};

/**
 * Export all products (super-admin)
 */
const exportAllProducts = async (format = 'csv', status = null) => {
  const query = status ? { status } : {};

  const products = await Product.find(query)
    .populate('brand', 'name')
    .populate('category', 'name')
    .populate('subCategory', 'name')
    .lean();

  const exportData = products.map((p) => ({
    id: p._id,
    name: p.name,
    slug: p.slug,
    barcode: p.barcode || '',
    gtin: p.gtin || '',
    type: p.type,
    isAlcoholic: p.isAlcoholic ? 'Yes' : 'No',
    abv: p.abv || 0,
    volumeMl: p.volumeMl || '',
    originCountry: p.originCountry || '',
    region: p.region || '',
    producer: p.producer || '',
    brand: p.brand?.name || '',
    category: p.category?.name || '',
    subCategory: p.subCategory?.name || '',
    shortDescription: p.shortDescription || '',
    status: p.status,
    tenantCount: p.tenantCount || 0,
    averageSellingPrice: p.averageSellingPrice || 0,
    totalStockAvailable: p.totalStockAvailable || 0,
    publishedAt: p.publishedAt || '',
    createdAt: p.createdAt,
  }));

  if (format === 'csv') {
    const csv = generateCSV(exportData);
    const filename = `all-products-${status || 'all'}-${Date.now()}.csv`;

    return {
      data: csv,
      filename,
      contentType: 'text/csv',
    };
  } else if (format === 'json') {
    const filename = `all-products-${status || 'all'}-${Date.now()}.json`;

    return {
      data: JSON.stringify(exportData, null, 2),
      filename,
      contentType: 'application/json',
    };
  } else {
    throw new ValidationError('Unsupported export format');
  }
};


/**
 * Approve pending product
 */
const approveProduct = async (productId, user) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  if (user.role !== 'super_admin') {
    throw new ForbiddenError('Only super-admins can approve products');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  if (product.status === 'approved') {
    throw new ValidationError('Product is already approved');
  }

  // Update product status
  product.status = 'approved';
  product.publishedAt = new Date();
  product.approvedBy = user._id;
  product.rejectedReason = undefined; // Clear rejection reason if previously rejected

  await product.save();

  // Update counts on related collections
  const updates = [];

  if (product.brand) {
    updates.push(
      Brand.findByIdAndUpdate(product.brand, {
        $inc: { productCount: 1, activeProductCount: 1 },
      })
    );
  }

  if (product.category) {
    updates.push(
      Category.findByIdAndUpdate(product.category, {
        $inc: { productCount: 1, activeProductCount: 1 },
      })
    );
  }

  if (product.subCategory) {
    updates.push(
      SubCategory.findByIdAndUpdate(product.subCategory, {
        $inc: { productCount: 1, activeProductCount: 1 },
      })
    );
  }

  await Promise.all(updates);

  // Populate and return
  const approvedProduct = await Product.findById(product._id)
    .populate('brand', 'name slug logo')
    .populate('category', 'name slug')
    .populate('subCategory', 'name slug')
    .populate('approvedBy', 'firstName lastName email')
    .lean();

  // TODO: Notify submitting tenant of approval
  // if (product.submittingTenant) {
  //   await notifyTenantOfApproval(product.submittingTenant, approvedProduct);
  // }

  return approvedProduct;
};

/**
 * Reject pending product
 */
const rejectProduct = async (productId, reason, user) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  if (user.role !== 'super_admin') {
    throw new ForbiddenError('Only super-admins can reject products');
  }

  if (!reason || reason.trim().length === 0) {
    throw new ValidationError('Rejection reason is required');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  if (product.status === 'rejected') {
    throw new ValidationError('Product is already rejected');
  }

  // Update product status
  product.status = 'rejected';
  product.rejectedReason = reason.trim();
  product.publishedAt = undefined;

  await product.save();

  // Populate and return
  const rejectedProduct = await Product.findById(product._id)
    .populate('brand', 'name slug logo')
    .populate('category', 'name slug')
    .populate('submittingTenant', 'name slug')
    .lean();

  // TODO: Notify submitting tenant of rejection
  // if (product.submittingTenant) {
  //   await notifyTenantOfRejection(product.submittingTenant, rejectedProduct, reason);
  // }

  return rejectedProduct;
};


// ============================================================
// PRODUCT MANAGEMENT FUNCTIONS
// ============================================================

/**
 * Bulk update multiple products
 */
const bulkUpdateProducts = async (updates, user) => {
  const isSuperAdmin = user.role === 'super_admin';

  if (!isSuperAdmin) {
    throw new ForbiddenError('Only super-admins can perform bulk updates');
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    throw new ValidationError('Updates array is required');
  }

  if (updates.length > 100) {
    throw new ValidationError('Maximum 100 products can be updated at once');
  }

  const results = {
    success: 0,
    failed: 0,
    errors: [],
    updated: [],
  };

  for (const update of updates) {
    try {
      const { productId, ...updateData } = update;

      if (!productId || !/^[0-9a-fA-F]{24}$/.test(productId)) {
        results.failed++;
        results.errors.push({
          productId,
          error: 'Invalid product ID',
        });
        continue;
      }

      const product = await Product.findById(productId);
      if (!product) {
        results.failed++;
        results.errors.push({
          productId,
          error: 'Product not found',
        });
        continue;
      }

      // Apply updates
      Object.keys(updateData).forEach((key) => {
        if (updateData[key] !== undefined) {
          product[key] = updateData[key];
        }
      });

      await product.save();

      results.success++;
      results.updated.push({
        productId,
        name: product.name,
        slug: product.slug,
      });
    } catch (error) {
      results.failed++;
      results.errors.push({
        productId: update.productId,
        error: error.message,
      });
    }
  }

  return results;
};

/**
 * Duplicate/clone product with new slug
 */
const duplicateProduct = async (productId, user) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const isSuperAdmin = user.role === 'super_admin';

  if (!isSuperAdmin) {
    throw new ForbiddenError('Only super-admins can duplicate products');
  }

  // Get original product
  const originalProduct = await Product.findById(productId).lean();
  if (!originalProduct) {
    throw new NotFoundError('Product not found');
  }

  // Generate unique slug
  const newSlug = await generateUniqueSlug(
    `${originalProduct.name}-copy`,
    async (testSlug) => {
      const exists = await Product.findOne({
        slug: testSlug,
        status: { $in: ['pending', 'approved'] },
      }).lean();
      return !!exists;
    }
  );

  // Create duplicate
  const duplicateData = {
    ...originalProduct,
    _id: undefined,
    slug: newSlug,
    name: `${originalProduct.name} (Copy)`,
    barcode: undefined, // Remove unique identifiers
    gtin: undefined,
    status: 'pending', // Reset to pending
    publishedAt: undefined,
    approvedBy: undefined,
    rejectedReason: undefined,
    subProducts: [], // Don't copy SubProducts
    tenantCount: 0,
    totalStockAvailable: 0,
    averageSellingPrice: 0,
    createdAt: undefined,
    updatedAt: undefined,
  };

  const duplicatedProduct = await Product.create(duplicateData);

  return duplicatedProduct;
};

/**
 * Archive product (soft delete)
 */
const archiveProduct = async (productId, user) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const isSuperAdmin = user.role === 'super_admin';

  if (!isSuperAdmin) {
    throw new ForbiddenError('Only super-admins can archive products');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  if (product.status === 'archived') {
    throw new ValidationError('Product is already archived');
  }

  const oldStatus = product.status;
  product.status = 'archived';
  await product.save();

  // Update counts if product was approved
  if (oldStatus === 'approved') {
    const updates = [];

    if (product.brand) {
      updates.push(
        Brand.findByIdAndUpdate(product.brand, {
          $inc: { activeProductCount: -1 },
        })
      );
    }

    if (product.category) {
      updates.push(
        Category.findByIdAndUpdate(product.category, {
          $inc: { activeProductCount: -1 },
        })
      );
    }

    if (product.subCategory) {
      updates.push(
        SubCategory.findByIdAndUpdate(product.subCategory, {
          $inc: { activeProductCount: -1 },
        })
      );
    }

    await Promise.all(updates);
  }

  return product;
};

/**
 * Restore archived product
 */
const restoreProduct = async (productId, user) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const isSuperAdmin = user.role === 'super_admin';

  if (!isSuperAdmin) {
    throw new ForbiddenError('Only super-admins can restore products');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  if (product.status !== 'archived') {
    throw new ValidationError('Product is not archived');
  }

  // Restore to pending status (requires re-approval)
  product.status = 'pending';
  product.publishedAt = undefined;
  product.approvedBy = undefined;
  await product.save();

  return product;
};


/**
 * Get pending products for approval queue
 */
const getPendingProducts = async (filters = {}, pagination = {}) => {
  const {
    submittingTenant,
    brand,
    category,
    type,
    search,
  } = filters;

  const {
    page = 1,
    limit = 20,
    sort = 'createdAt',
    order = 'desc',
  } = pagination;

  // Build query
  const query = { status: 'pending' };

  if (submittingTenant) {
    query.submittingTenant = submittingTenant;
  }

  if (brand) {
    query.brand = brand;
  }

  if (category) {
    query.category = category;
  }

  if (type) {
    query.type = type;
  }

  if (search && search.trim().length > 0) {
    query.$or = [
      { name: new RegExp(search, 'i') },
      { slug: new RegExp(search, 'i') },
      { barcode: new RegExp(search, 'i') },
    ];
  }

  // Pagination
  const pageNum = Math.max(1, page);
  const limitNum = Math.min(Math.max(1, limit), 100);
  const skip = (pageNum - 1) * limitNum;

  // Sort
  const sortOrder = order === 'desc' ? -1 : 1;
  const sortOptions = { [sort]: sortOrder };

  // Execute queries
  const [total, products] = await Promise.all([
    Product.countDocuments(query),
    Product.find(query)
      .populate('brand', 'name slug logo')
      .populate('category', 'name slug')
      .populate('subCategory', 'name slug')
      .populate('submittingTenant', 'name slug')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ]);

  return {
    products,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
      hasNext: pageNum < Math.ceil(total / limitNum),
      hasPrev: pageNum > 1,
    },
  };
};

/**
 * Get rejected products
 */
const getRejectedProducts = async (filters = {}, pagination = {}) => {
  const {
    submittingTenant,
    brand,
    category,
    type,
    search,
  } = filters;

  const {
    page = 1,
    limit = 20,
    sort = 'updatedAt',
    order = 'desc',
  } = pagination;

  // Build query
  const query = { status: 'rejected' };

  if (submittingTenant) {
    query.submittingTenant = submittingTenant;
  }

  if (brand) {
    query.brand = brand;
  }

  if (category) {
    query.category = category;
  }

  if (type) {
    query.type = type;
  }

  if (search && search.trim().length > 0) {
    query.$or = [
      { name: new RegExp(search, 'i') },
      { slug: new RegExp(search, 'i') },
    ];
  }

  // Pagination
  const pageNum = Math.max(1, page);
  const limitNum = Math.min(Math.max(1, limit), 100);
  const skip = (pageNum - 1) * limitNum;

  // Sort
  const sortOrder = order === 'desc' ? -1 : 1;
  const sortOptions = { [sort]: sortOrder };

  // Execute queries
  const [total, products] = await Promise.all([
    Product.countDocuments(query),
    Product.find(query)
      .populate('brand', 'name slug logo')
      .populate('category', 'name slug')
      .populate('submittingTenant', 'name slug')
      .select('name slug type rejectedReason createdAt updatedAt')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ]);

  return {
    products,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
      hasNext: pageNum < Math.ceil(total / limitNum),
      hasPrev: pageNum > 1,
    },
  };
};

/**
 * Get product submission statistics
 */
const getProductSubmissionStats = async () => {
  const stats = await Product.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const byTenant = await Product.aggregate([
    {
      $match: {
        submittingTenant: { $exists: true },
      },
    },
    {
      $group: {
        _id: {
          tenant: '$submittingTenant',
          status: '$status',
        },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: '$_id.tenant',
        submissions: {
          $push: {
            status: '$_id.status',
            count: '$count',
          },
        },
        total: { $sum: '$count' },
      },
    },
    {
      $lookup: {
        from: 'tenants',
        localField: '_id',
        foreignField: '_id',
        as: 'tenant',
      },
    },
    {
      $unwind: '$tenant',
    },
    {
      $project: {
        tenantId: '$_id',
        tenantName: '$tenant.name',
        tenantSlug: '$tenant.slug',
        submissions: 1,
        total: 1,
      },
    },
    {
      $sort: { total: -1 },
    },
    {
      $limit: 10,
    },
  ]);

  const byDate = await Product.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  return {
    byStatus: stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {}),
    byTenant,
    byDate,
    total: await Product.countDocuments(),
    pending: await Product.countDocuments({ status: 'pending' }),
    approved: await Product.countDocuments({ status: 'approved' }),
    rejected: await Product.countDocuments({ status: 'rejected' }),
    archived: await Product.countDocuments({ status: 'archived' }),
  };
};

/**
 * Bulk approve products
 */
const bulkApproveProducts = async (productIds, user) => {
  if (user.role !== 'super_admin') {
    throw new ForbiddenError('Only super-admins can approve products');
  }

  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new ValidationError('Product IDs array is required');
  }

  if (productIds.length > 50) {
    throw new ValidationError('Maximum 50 products can be approved at once');
  }

  const results = {
    success: 0,
    failed: 0,
    errors: [],
    approved: [],
  };

  for (const productId of productIds) {
    try {
      const product = await approveProduct(productId, user);
      results.success++;
      results.approved.push({
        productId,
        name: product.name,
        slug: product.slug,
      });
    } catch (error) {
      results.failed++;
      results.errors.push({
        productId,
        error: error.message,
      });
    }
  }

  return results;
};

/**
 * Bulk reject products
 */
const bulkRejectProducts = async (productIds, reason, user) => {
  if (user.role !== 'super_admin') {
    throw new ForbiddenError('Only super-admins can reject products');
  }

  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new ValidationError('Product IDs array is required');
  }

  if (!reason || reason.trim().length === 0) {
    throw new ValidationError('Rejection reason is required');
  }

  if (productIds.length > 50) {
    throw new ValidationError('Maximum 50 products can be rejected at once');
  }

  const results = {
    success: 0,
    failed: 0,
    errors: [],
    rejected: [],
  };

  for (const productId of productIds) {
    try {
      const product = await rejectProduct(productId, reason, user);
      results.success++;
      results.rejected.push({
        productId,
        name: product.name,
        slug: product.slug,
      });
    } catch (error) {
      results.failed++;
      results.errors.push({
        productId,
        error: error.message,
      });
    }
  }

  return results;
};

// ============================================================
// PRODUCT ANALYTICS FUNCTIONS
// ============================================================

/**
 * Get comprehensive product analytics
 */
const getProductAnalytics = async (productId) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const product = await Product.findById(productId).lean();
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Get analytics in parallel
  const [
    salesData,
    revenueData,
    reviewData,
    viewsData,
    conversionData,
    inventoryData,
    tenantData,
  ] = await Promise.all([
    getProductSalesData(productId),
    getProductRevenueData(productId),
    getProductReviewData(productId),
    getProductViewsData(productId),
    getProductConversionData(productId),
    getProductInventoryData(productId),
    getProductTenantData(productId),
  ]);

  return {
    product: {
      id: product._id,
      name: product.name,
      slug: product.slug,
      type: product.type,
      status: product.status,
    },
    sales: salesData,
    revenue: revenueData,
    reviews: reviewData,
    views: viewsData,
    conversion: conversionData,
    inventory: inventoryData,
    tenants: tenantData,
    generatedAt: new Date(),
  };
};

/**
 * Helper: Get product sales data
 */
const getProductSalesData = async (productId) => {
  const salesAgg = await Sales.aggregate([
    {
      $match: {
        product: productId,
        fulfillmentStatus: { $in: ['fulfilled', 'delivered'] },
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$quantity' },
        totalOrders: { $sum: 1 },
        averageQuantity: { $avg: '$quantity' },
        firstSaleDate: { $min: '$soldAt' },
        lastSaleDate: { $max: '$soldAt' },
      },
    },
  ]);

  const data = salesAgg[0] || {
    totalSales: 0,
    totalOrders: 0,
    averageQuantity: 0,
    firstSaleDate: null,
    lastSaleDate: null,
  };

  // Get sales by channel
  const salesByChannel = await Sales.aggregate([
    {
      $match: {
        product: productId,
        fulfillmentStatus: { $in: ['fulfilled', 'delivered'] },
      },
    },
    {
      $group: {
        _id: '$channel',
        sales: { $sum: '$quantity' },
        orders: { $sum: 1 },
      },
    },
  ]);

  return {
    ...data,
    byChannel: salesByChannel.reduce((acc, item) => {
      acc[item._id] = {
        sales: item.sales,
        orders: item.orders,
      };
      return acc;
    }, {}),
  };
};

/**
 * Helper: Get product revenue data
 */
const getProductRevenueData = async (productId) => {
  const revenueAgg = await Sales.aggregate([
    {
      $match: {
        product: productId,
        fulfillmentStatus: { $in: ['fulfilled', 'delivered'] },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$finalItemPrice' },
        platformRevenue: { $sum: '$platformAmount' },
        tenantRevenue: { $sum: '$tenantAmount' },
        averageOrderValue: { $avg: '$finalItemPrice' },
        minOrderValue: { $min: '$finalItemPrice' },
        maxOrderValue: { $max: '$finalItemPrice' },
      },
    },
  ]);

  return revenueAgg[0] || {
    totalRevenue: 0,
    platformRevenue: 0,
    tenantRevenue: 0,
    averageOrderValue: 0,
    minOrderValue: 0,
    maxOrderValue: 0,
  };
};

/**
 * Helper: Get product review data
 */
const getProductReviewData = async (productId) => {
  const reviewAgg = await Review.aggregate([
    {
      $match: {
        product: productId,
        status: 'approved',
      },
    },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        totalHelpful: { $sum: '$helpfulCount' },
        verifiedPurchases: {
          $sum: { $cond: ['$isVerifiedPurchase', 1, 0] },
        },
      },
    },
  ]);

  // Get rating distribution
  const distribution = await Review.aggregate([
    {
      $match: {
        product: productId,
        status: 'approved',
      },
    },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 },
      },
    },
    {
      $sort: { _id: -1 },
    },
  ]);

  const reviewData = reviewAgg[0] || {
    totalReviews: 0,
    averageRating: 0,
    totalHelpful: 0,
    verifiedPurchases: 0,
  };

  return {
    ...reviewData,
    distribution: distribution.reduce((acc, item) => {
      acc[`${item._id}star`] = item.count;
      return acc;
    }, {}),
  };
};

/**
 * Helper: Get product views data (placeholder - requires analytics tracking)
 */
const getProductViewsData = async (productId) => {
  // TODO: Integrate with analytics service
  // This would track page views, unique visitors, etc.
  return {
    totalViews: 0,
    uniqueVisitors: 0,
    averageTimeOnPage: 0,
    bounceRate: 0,
  };
};

/**
 * Helper: Get product conversion data
 */
const getProductConversionData = async (productId) => {
  // Get total views (placeholder)
  const totalViews = 0; // TODO: From analytics

  // Get sales
  const totalSales = await Sales.countDocuments({
    product: productId,
    fulfillmentStatus: { $in: ['fulfilled', 'delivered'] },
  });

  const conversionRate = totalViews > 0 ? (totalSales / totalViews) * 100 : 0;

  // Get cart additions (placeholder)
  const cartAdditions = 0; // TODO: From cart tracking

  return {
    totalViews,
    totalSales,
    conversionRate,
    cartAdditions,
    cartConversionRate: cartAdditions > 0 ? (totalSales / cartAdditions) * 100 : 0,
  };
};

/**
 * Helper: Get product inventory data
 */
const getProductInventoryData = async (productId) => {
  const subProducts = await SubProduct.find({
    product: productId,
    status: 'active',
  })
    .populate('sizes')
    .lean();

  let totalStock = 0;
  let totalValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  subProducts.forEach((sp) => {
    if (sp.sizes && sp.sizes.length > 0) {
      sp.sizes.forEach((size) => {
        totalStock += size.stock || 0;
        totalValue += (size.stock || 0) * (size.costPrice || 0);

        if (size.availability === 'low_stock') lowStockCount++;
        if (size.availability === 'out_of_stock') outOfStockCount++;
      });
    }
  });

  return {
    totalStock,
    totalValue,
    lowStockVariants: lowStockCount,
    outOfStockVariants: outOfStockCount,
    activeVariants: subProducts.reduce((sum, sp) => sum + (sp.sizes?.length || 0), 0),
  };
};

/**
 * Helper: Get product tenant data
 */
const getProductTenantData = async (productId) => {
  const tenantCount = await SubProduct.countDocuments({
    product: productId,
    status: 'active',
  });

  const priceRange = await SubProduct.aggregate([
    {
      $match: {
        product: productId,
        status: 'active',
      },
    },
    {
      $lookup: {
        from: 'sizes',
        localField: 'sizes',
        foreignField: '_id',
        as: 'sizeData',
      },
    },
    {
      $unwind: '$sizeData',
    },
    {
      $group: {
        _id: null,
        minPrice: { $min: '$sizeData.sellingPrice' },
        maxPrice: { $max: '$sizeData.sellingPrice' },
        avgPrice: { $avg: '$sizeData.sellingPrice' },
      },
    },
  ]);

  return {
    tenantCount,
    priceRange: priceRange[0] || {
      minPrice: 0,
      maxPrice: 0,
      avgPrice: 0,
    },
  };
};

/**
 * Get product performance over time
 */
const getProductPerformance = async (productId, dateRange = {}) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const { startDate, endDate } = dateRange;

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  // Sales over time
  const salesOverTime = await Sales.aggregate([
    {
      $match: {
        product: productId,
        soldAt: { $gte: start, $lte: end },
        fulfillmentStatus: { $in: ['fulfilled', 'delivered'] },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$soldAt' },
        },
        sales: { $sum: '$quantity' },
        revenue: { $sum: '$finalItemPrice' },
        orders: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  // Reviews over time
  const reviewsOverTime = await Review.aggregate([
    {
      $match: {
        product: productId,
        createdAt: { $gte: start, $lte: end },
        status: 'approved',
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        },
        reviews: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  return {
    dateRange: {
      start,
      end,
      days: Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
    },
    salesOverTime,
    reviewsOverTime,
  };
};

/**
 * Get product competitors (similar products)
 */
const getProductCompetitors = async (productId) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const product = await Product.findById(productId).lean();
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Find similar products
  const query = {
    _id: { $ne: productId },
    status: 'approved',
    $or: [
      { category: product.category },
      { subCategory: product.subCategory },
      { brand: product.brand },
      { type: product.type },
    ],
  };

  // If product has ABV, find similar ABV range
  if (product.abv) {
    query.abv = {
      $gte: product.abv - 5,
      $lte: product.abv + 5,
    };
  }

  const competitors = await Product.find(query)
    .populate('brand', 'name slug logo')
    .populate('category', 'name slug')
    .select('name slug type abv images tenantCount averageSellingPrice')
    .limit(10)
    .lean();

  // Get their sales and review data
  const competitorsWithData = await Promise.all(
    competitors.map(async (comp) => {
      const [sales, reviews] = await Promise.all([
        Sales.aggregate([
          {
            $match: {
              product: comp._id,
              fulfillmentStatus: { $in: ['fulfilled', 'delivered'] },
            },
          },
          {
            $group: {
              _id: null,
              totalSales: { $sum: '$quantity' },
              totalRevenue: { $sum: '$finalItemPrice' },
            },
          },
        ]),
        Review.aggregate([
          {
            $match: {
              product: comp._id,
              status: 'approved',
            },
          },
          {
            $group: {
              _id: null,
              avgRating: { $avg: '$rating' },
              totalReviews: { $sum: 1 },
            },
          },
        ]),
      ]);

      return {
        ...comp,
        sales: sales[0] || { totalSales: 0, totalRevenue: 0 },
        reviews: reviews[0] || { avgRating: 0, totalReviews: 0 },
      };
    })
  );

  return {
    product: {
      id: product._id,
      name: product.name,
      slug: product.slug,
    },
    competitors: competitorsWithData,
  };
};

/**
 * Get AI-based product recommendations
 */
const getProductRecommendations = async (productId, limit = 10) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const product = await Product.findById(productId)
    .populate('tags')
    .populate('flavors')
    .lean();

  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Build recommendation query
  const query = {
    _id: { $ne: productId },
    status: 'approved',
  };

  // Score-based matching
  const recommendations = await Product.aggregate([
    {
      $match: query,
    },
    {
      $addFields: {
        score: {
          $add: [
            // Category match: 30 points
            {
              $cond: [{ $eq: ['$category', product.category] }, 30, 0],
            },
            // SubCategory match: 20 points
            {
              $cond: [{ $eq: ['$subCategory', product.subCategory] }, 20, 0],
            },
            // Brand match: 15 points
            {
              $cond: [{ $eq: ['$brand', product.brand] }, 15, 0],
            },
            // Type match: 10 points
            {
              $cond: [{ $eq: ['$type', product.type] }, 10, 0],
            },
            // Similar ABV: 5 points
            {
              $cond: [
                {
                  $and: [
                    { $gte: ['$abv', product.abv - 5] },
                    { $lte: ['$abv', product.abv + 5] },
                  ],
                },
                5,
                0,
              ],
            },
          ],
        },
      },
    },
    {
      $match: {
        score: { $gt: 0 },
      },
    },
    {
      $sort: { score: -1, tenantCount: -1 },
    },
    {
      $limit: limit,
    },
    {
      $lookup: {
        from: 'brands',
        localField: 'brand',
        foreignField: '_id',
        as: 'brand',
      },
    },
    {
      $unwind: {
        path: '$brand',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'category',
      },
    },
    {
      $unwind: {
        path: '$category',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        name: 1,
        slug: 1,
        type: 1,
        images: 1,
        abv: 1,
        tenantCount: 1,
        averageSellingPrice: 1,
        brand: { name: 1, slug: 1, logo: 1 },
        category: { name: 1, slug: 1 },
        score: 1,
      },
    },
  ]);

  return {
    product: {
      id: product._id,
      name: product.name,
      slug: product.slug,
    },
    recommendations,
  };
};




// ============================================================
// PRODUCT SEARCH & DISCOVERY FUNCTIONS
// ============================================================

/**
 * Advanced product search with multiple filters and ranking
 */
// services/product.service.js

/**
 * Search products with advanced filtering, semantic search, and complete data
 * @param {Object} searchParams - Search parameters
 * @returns {Promise<Object>} Search results with complete product data
 */
const searchProducts = async (searchParams = {}) => {
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
    
    // Search mode - using semantic search with local embeddings
    searchMode = 'semantic', // 'text', 'semantic', 'hybrid'
    useEmbeddings = true, // Enabled - using local transformers.js model
  } = searchParams;

  const currentDate = new Date();
  const skip = (page - 1) * limit;

  // ============================================================
  // STEP 1: Build Base Query
  // ============================================================
  const baseQuery = {
    status: 'approved',
  };

  // Resolve and build category filter
  let categoryFilter = null;
  if (category) {
    if (Array.isArray(category)) {
      const names = category.filter(c => !/^[0-9a-fA-F]{24}$/.test(c));
      const objectIds = category.filter(c => /^[0-9a-fA-F]{24}$/.test(c));
      let resolvedIds = [];
      if (names.length > 0) {
        resolvedIds = await resolveCategoryToObjectIds(names);
      }
      const allIds = [...objectIds, ...resolvedIds];
      if (allIds.length > 0) {
        categoryFilter = { category: { $in: allIds.map(id => new mongoose.Types.ObjectId(id)) } };
      }
    } else {
      if (/^[0-9a-fA-F]{24}$/.test(category)) {
        categoryFilter = { category: new mongoose.Types.ObjectId(category) };
      } else {
        const resolved = await resolveCategoryToObjectIds([category]);
        if (resolved.length > 0) {
          categoryFilter = { category: { $in: resolved.map(id => new mongoose.Types.ObjectId(id)) } };
        }
      }
    }
    if (categoryFilter) {
      Object.assign(baseQuery, categoryFilter);
    }
  }

  // Resolve and build subCategory filter
  let subCategoryFilter = null;
  if (subCategory) {
    const resolvedCategoryIds = category && !Array.isArray(category) && !/^[0-9a-fA-F]{24}$/.test(category)
      ? await resolveCategoryToObjectIds([category])
      : [];
    const parentCategoryId = resolvedCategoryIds.length > 0 ? resolvedCategoryIds[0] : null;

    if (Array.isArray(subCategory)) {
      const names = subCategory.filter(s => !/^[0-9a-fA-F]{24}$/.test(s));
      const objectIds = subCategory.filter(s => /^[0-9a-fA-F]{24}$/.test(s));
      let resolvedIds = [];
      if (names.length > 0) {
        resolvedIds = await resolveSubCategoryToObjectIds(names, parentCategoryId);
      }
      const allIds = [...objectIds, ...resolvedIds];
      if (allIds.length > 0) {
        subCategoryFilter = { subCategory: { $in: allIds.map(id => new mongoose.Types.ObjectId(id)) } };
      }
    } else {
      if (/^[0-9a-fA-F]{24}$/.test(subCategory)) {
        subCategoryFilter = { subCategory: new mongoose.Types.ObjectId(subCategory) };
      } else {
        const resolved = await resolveSubCategoryToObjectIds([subCategory], parentCategoryId);
        if (resolved.length > 0) {
          subCategoryFilter = { subCategory: { $in: resolved.map(id => new mongoose.Types.ObjectId(id)) } };
        }
      }
    }
    if (subCategoryFilter) {
      Object.assign(baseQuery, subCategoryFilter);
    }
  }

  // Resolve and build brand filter
  if (brand) {
    let brandFilter = null;
    if (Array.isArray(brand)) {
      const names = brand.filter(b => !/^[0-9a-fA-F]{24}$/.test(b));
      const objectIds = brand.filter(b => /^[0-9a-fA-F]{24}$/.test(b));
      let resolvedIds = [];
      if (names.length > 0) {
        resolvedIds = await resolveBrandToObjectIds(names);
      }
      const allIds = [...objectIds, ...resolvedIds];
      if (allIds.length > 0) {
        brandFilter = { brand: { $in: allIds.map(id => new mongoose.Types.ObjectId(id)) } };
      }
    } else {
      if (/^[0-9a-fA-F]{24}$/.test(brand)) {
        brandFilter = { brand: new mongoose.Types.ObjectId(brand) };
      } else {
        const resolved = await resolveBrandToObjectIds([brand]);
        if (resolved.length > 0) {
          brandFilter = { brand: { $in: resolved.map(id => new mongoose.Types.ObjectId(id)) } };
        }
      }
    }
    if (brandFilter) {
      Object.assign(baseQuery, brandFilter);
    }
  }

  // Text search query - Enhanced for better product name search
  let textSearchQuery = null;
  if (query && query.trim()) {
    const searchTerm = query.trim();
    const searchRegex = new RegExp(searchTerm, 'i');
    
    textSearchQuery = {
      $or: [
        { name: searchRegex },
        { shortDescription: searchRegex },
        { description: searchRegex },
        { type: searchRegex },
        { subType: searchRegex },
        { originCountry: searchRegex },
        { region: searchRegex },
        { producer: searchRegex },
        { flavorProfile: searchRegex },
        { metaKeywords: searchRegex },
        { barcode: searchRegex },
        { sku: searchRegex },
        { upc: searchRegex },
        { gtin: searchRegex },
      ],
    };
  }

  // Tags filter
  if (tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags];
    baseQuery.tags = { $in: tagArray };
  }

  // Flavors filter
  if (flavors) {
    const flavorArray = Array.isArray(flavors) ? flavors : [flavors];
    baseQuery.flavors = { $in: flavorArray };
  }

  // ABV range
  if (minAbv !== undefined || maxAbv !== undefined) {
    baseQuery.abv = {};
    if (minAbv !== undefined) baseQuery.abv.$gte = parseFloat(minAbv);
    if (maxAbv !== undefined) baseQuery.abv.$lte = parseFloat(maxAbv);
  }

  // Alcoholic filter
  if (isAlcoholic !== undefined) {
    baseQuery.isAlcoholic = isAlcoholic === 'true' || isAlcoholic === true;
  }

  // Origin filter
  if (originCountry) {
    if (Array.isArray(originCountry)) {
      baseQuery.originCountry = { $in: originCountry };
    } else {
      baseQuery.originCountry = originCountry;
    }
  }

  // Region filter
  if (region) {
    if (Array.isArray(region)) {
      baseQuery.region = { $in: region };
    } else {
      baseQuery.region = region;
    }
  }

  // Type filter
  if (type) {
    if (Array.isArray(type)) {
      baseQuery.type = { $in: type };
    } else {
      baseQuery.type = type;
    }
  }

  // SubType filter
  if (subType) {
    if (Array.isArray(subType)) {
      baseQuery.subType = { $in: subType };
    } else {
      baseQuery.subType = subType;
    }
  }

  // Featured filter
  if (isFeatured !== undefined) {
    baseQuery.isFeatured = isFeatured === 'true' || isFeatured === true;
  }

  // Rating filter
  if (minRating) {
    baseQuery.averageRating = { $gte: parseFloat(minRating) };
  }

  // Merge text search with base query
  const matchQuery = textSearchQuery 
    ? { $and: [baseQuery, textSearchQuery] }
    : baseQuery;

  // ============================================================
  // STEP 2: Semantic Search (if enabled and query provided)
  // ============================================================
  let semanticBoost = {};
  
  if (useEmbeddings && query && query.trim() && (searchMode === 'semantic' || searchMode === 'hybrid')) {
    try {
      // Generate embedding for search query
      const queryEmbedding = await generateEmbedding(query.trim());
      
      if (queryEmbedding && queryEmbedding.length > 0) {
        // Calculate cosine similarity with product embeddings
        semanticBoost = {
          vectorSimilarity: {
            $let: {
              vars: {
                dotProduct: {
                  $sum: {
                    $map: {
                      input: { $range: [0, { $size: { $ifNull: ['$embedding', []] } }] },
                      as: 'i',
                      in: {
                        $multiply: [
                          { $arrayElemAt: [{ $ifNull: ['$embedding', []] }, '$$i'] },
                          { $arrayElemAt: [queryEmbedding, '$$i'] },
                        ],
                      },
                    },
                  },
                },
              },
              in: '$$dotProduct',
            },
          },
        };
      }
    } catch (error) {
      console.warn('Semantic search failed, falling back to text search:', error.message);
    }
  }

  // ============================================================
  // STEP 3: Build Aggregation Pipeline
  // ============================================================
  const pipeline = [
    // Match base criteria
    { $match: matchQuery },
    
    // Add semantic similarity score if available
    ...(Object.keys(semanticBoost).length > 0 ? [
      { $addFields: semanticBoost },
    ] : []),
    
    // Lookup SubProducts with complete filtering
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
                  ...(tenantId ? [{ $eq: ['$tenant', mongoose.Types.ObjectId(tenantId)] }] : []),
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
          // Filter active tenants
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
                {
                  $project: {
                    size: 1,
                    displayName: 1,
                    volumeMl: 1,
                    weightGrams: 1,
                    sellingPrice: 1,
                    costPrice: 1,
                    compareAtPrice: 1,
                    currency: 1,
                    stock: 1,
                    availableStock: 1,
                    availability: 1,
                    discount: 1,
                    sku: 1,
                    isDefault: 1,
                  },
                },
              ],
            },
          },
          // Only include subproducts with available sizes
          {
            $match: {
              $expr: { $gt: [{ $size: '$sizes' }, 0] },
            },
          },
          {
            $project: {
              tenant: {
                _id: 1,
                name: 1,
                slug: 1,
                logo: 1,
                primaryColor: 1,
                city: 1,
                state: 1,
                country: 1,
                revenueModel: 1,
                markupPercentage: 1,
                commissionPercentage: 1,
                defaultCurrency: 1,
              },
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
    
    // Only include products with active subproducts
    {
      $match: {
        $expr: { $gt: [{ $size: '$subProducts' }, 0] },
      },
    },
    
    // Lookup brand with complete info
    {
      $lookup: {
        from: 'brands',
        localField: 'brand',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              logo: 1,
              status: 1,
              countryOfOrigin: 1,
              isPremium: 1,
              description: 1,
            },
          },
        ],
        as: 'brand',
      },
    },
    { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
    
    // Lookup category with complete info
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              type: 1,
              description: 1,
              shortDescription: 1,
              icon: 1,
              color: 1,
              displayName: 1,
              tagline: 1,
            },
          },
        ],
        as: 'category',
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    
    // Lookup subcategory with complete info
    {
      $lookup: {
        from: 'subcategories',
        localField: 'subCategory',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              type: 1,
              subType: 1,
              description: 1,
              shortDescription: 1,
              displayName: 1,
              characteristics: 1,
              typicalFlavors: 1,
            },
          },
        ],
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
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              displayName: 1,
              type: 1,
              color: 1,
              category: 1,
            },
          },
        ],
        as: 'tags',
      },
    },
    
    // Lookup flavors
    {
      $lookup: {
        from: 'flavors',
        localField: 'flavors',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
              value: 1,
              color: 1,
              category: 1,
              intensity: 1,
            },
          },
        ],
        as: 'flavors',
      },
    },
    
    // Add computed fields
    {
      $addFields: {
        tenantCount: { $size: '$subProducts' },
        totalAvailableStock: {
          $sum: {
            $map: {
              input: '$subProducts',
              as: 'sub',
              in: {
                $sum: {
                  $map: {
                    input: '$$sub.sizes',
                    as: 'size',
                    in: { $ifNull: ['$$size.availableStock', 0] },
                  },
                },
              },
            },
          },
        },
        totalSold: {
          $sum: {
            $map: {
              input: '$subProducts',
              as: 'sub',
              in: { $ifNull: ['$$sub.totalSold', 0] },
            },
          },
        },
        // Calculate relevance score
        relevanceScore: {
          $add: [
            // Text match score (if text search was used)
            ...(textSearchQuery ? [
              {
                $cond: [
                  { $regexMatch: { input: '$name', regex: query, options: 'i' } },
                  15,
                  0,
                ],
              },
              {
                $cond: [
                  { $regexMatch: { input: { $ifNull: ['$shortDescription', ''] }, regex: query, options: 'i' } },
                  8,
                  0,
                ],
              },
              {
                $cond: [
                  { $regexMatch: { input: { $ifNull: ['$type', ''] }, regex: query, options: 'i' } },
                  5,
                  0,
                ],
              },
            ] : [0]),
            // Semantic similarity score (if available)
            ...(Object.keys(semanticBoost).length > 0 ? [
              { $multiply: [{ $ifNull: ['$vectorSimilarity', 0] }, 20] },
            ] : [0]),
            // Popularity boost
            { $multiply: [{ $ifNull: ['$averageRating', 0] }, 2] },
            { $divide: [{ $ifNull: ['$totalSold', 0] }, 10] },
            // Featured boost
            { $cond: [{ $eq: ['$isFeatured', true] }, 5, 0] },
          ],
        },
      },
    },
  ];

  // ============================================================
  // STEP 4: Apply Price Filter (Post-Aggregation)
  // ============================================================
  // Price filtering needs to be done after SubProduct/Size lookup
  // We'll handle this in the processing step

  // ============================================================
  // STEP 5: Apply Sorting
  // ============================================================
  let sortStage = {};
  
  switch (sortBy) {
    case 'relevance':
      sortStage = { relevanceScore: -1, averageRating: -1, totalSold: -1 };
      break;
    case 'price_low':
      // Will sort after price calculation
      sortStage = { name: 1 };
      break;
    case 'price_high':
      // Will sort after price calculation
      sortStage = { name: 1 };
      break;
    case 'rating':
      sortStage = { averageRating: order === 'asc' ? 1 : -1, reviewCount: -1 };
      break;
    case 'newest':
      sortStage = { createdAt: -1 };
      break;
    case 'popular':
      sortStage = { totalSold: -1, averageRating: -1 };
      break;
    case 'name':
      sortStage = { name: order === 'asc' ? 1 : -1 };
      break;
    default:
      sortStage = { relevanceScore: -1 };
  }

  pipeline.push({ $sort: sortStage });

  // ============================================================
  // STEP 6: Execute Pipeline for Total Count
  // ============================================================
  const countPipeline = [...pipeline, { $count: 'total' }];
  const countResult = await Product.aggregate(countPipeline);
  const totalResults = countResult.length > 0 ? countResult[0].total : 0;

  // ============================================================
  // STEP 7: Execute Pipeline with Pagination
  // ============================================================
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });

  const searchResults = await Product.aggregate(pipeline);

  // ============================================================
  // STEP 8: Process and Enrich Products
  // ============================================================
  const processedProducts = searchResults.map(product => {
    // ===============================
    // Process SubProducts with Website Pricing
    // ===============================
    const processedSubProducts = (product.subProducts || []).map((subProduct) => {
      const tenant = subProduct.tenant;
      const revenueModel = tenant.revenueModel || 'markup';
      const markupPercentage = tenant.markupPercentage || 40;
      const commissionPercentage = tenant.commissionPercentage || 10;

      // Process each size with website pricing
      const processedSizes = (subProduct.sizes || []).map((size) => {
        const sellingPrice = size.sellingPrice || 0;
        const costPrice = size.costPrice || subProduct.costPrice || 0;

        // Check and calculate discount
        let hasActiveDiscount = false;
        let discountedSellingPrice = sellingPrice;
        let discountInfo = null;
        let discountSource = null;

        const checkDiscountActive = (discount) => {
          if (!discount || !discount.value || !discount.type) return false;
          const now = currentDate;
          const discountStart = discount.startDate || discount.discountStart;
          const discountEnd = discount.endDate || discount.discountEnd;
          if (discountStart && now < new Date(discountStart)) return false;
          if (discountEnd && now > new Date(discountEnd)) return false;
          return true;
        };

        const calculateDiscountedPrice = (basePrice, discount) => {
          if (discount.type === 'percentage') {
            const discountAmount = (basePrice * discount.value) / 100;
            return Math.max(0, basePrice - discountAmount);
          } else if (discount.type === 'fixed') {
            return Math.max(0, basePrice - discount.value);
          }
          return basePrice;
        };

        // Priority 1: Size-level discount
        if (size.discount && checkDiscountActive(size.discount)) {
          hasActiveDiscount = true;
          discountSource = 'size';
          discountedSellingPrice = calculateDiscountedPrice(sellingPrice, size.discount);

          discountInfo = {
            type: size.discount.type,
            value: size.discount.value,
            originalPrice: sellingPrice,
            savings: sellingPrice - discountedSellingPrice,
            source: 'size',
            startDate: size.discount.startDate || size.discount.discountStart,
            endDate: size.discount.endDate || size.discount.discountEnd,
            label: size.discount.type === 'percentage'
              ? `${size.discount.value}% OFF`
              : `Save ${getCurrencySymbol(size.currency)}${size.discount.value}`,
          };
        }
        // Priority 2: SubProduct-level discount
        else if (subProduct.discount && checkDiscountActive(subProduct.discount)) {
          hasActiveDiscount = true;
          discountSource = 'subproduct';
          discountedSellingPrice = calculateDiscountedPrice(sellingPrice, subProduct.discount);

          discountInfo = {
            type: subProduct.discount.type || subProduct.discountType,
            value: subProduct.discount.value,
            originalPrice: sellingPrice,
            savings: sellingPrice - discountedSellingPrice,
            source: 'subproduct',
            startDate: subProduct.discount.startDate || subProduct.discountStart,
            endDate: subProduct.discount.endDate || subProduct.discountEnd,
            label: (subProduct.discount.type || subProduct.discountType) === 'percentage'
              ? `${subProduct.discount.value}% OFF`
              : `Save ${getCurrencySymbol(size.currency)}${subProduct.discount.value}`,
          };
        }

        const tenantPrice = hasActiveDiscount ? discountedSellingPrice : sellingPrice;

        // Calculate website price based on revenue model
        let websitePrice = tenantPrice;
        let platformFee = 0;
        let tenantRevenue = 0;
        let platformRevenue = 0;

        if (revenueModel === 'markup') {
          websitePrice = tenantPrice;
          tenantRevenue = tenantPrice - costPrice;
          platformFee = 0;
          platformRevenue = 0;
        } else if (revenueModel === 'commission') {
          platformFee = (tenantPrice * commissionPercentage) / 100;
          websitePrice = tenantPrice + platformFee;
          tenantRevenue = tenantPrice - costPrice;
          platformRevenue = platformFee;
        }

        // Update discount info with website prices
        if (hasActiveDiscount && discountInfo) {
          const originalWebsitePrice = revenueModel === 'commission'
            ? sellingPrice + (sellingPrice * commissionPercentage) / 100
            : sellingPrice;

          discountInfo.originalPrice = originalWebsitePrice;
          discountInfo.savings = originalWebsitePrice - websitePrice;
        }

        return {
          _id: size._id,
          size: size.displayName || size.size,
          volumeMl: size.volumeMl,
          weightGrams: size.weightGrams,
          sku: size.sku,
          isDefault: size.isDefault,

          // Stock
          stock: size.availableStock || size.stock || 0,
          availability: size.availability,

          // Pricing Breakdown
          pricing: {
            costPrice,
            sellingPrice,
            tenantPrice,
            websitePrice,
            originalWebsitePrice: hasActiveDiscount
              ? (revenueModel === 'commission'
                ? sellingPrice + (sellingPrice * commissionPercentage) / 100
                : sellingPrice)
              : websitePrice,
            platformFee,
            tenantRevenue,
            platformRevenue,
            displayPrice: websitePrice.toFixed(2),
            formattedPrice: formatPrice(websitePrice, size.currency || tenant.defaultCurrency || 'NGN'),
            compareAtPrice: size.compareAtPrice
              ? (revenueModel === 'commission'
                ? size.compareAtPrice + (size.compareAtPrice * commissionPercentage) / 100
                : size.compareAtPrice
              ).toFixed(2)
              : null,
            currency: size.currency || tenant.defaultCurrency || 'NGN',
            currencySymbol: getCurrencySymbol(size.currency || tenant.defaultCurrency || 'NGN'),
            revenueModel,
            ...(revenueModel === 'markup' && { markupPercentage }),
            ...(revenueModel === 'commission' && { commissionPercentage }),
          },

          discount: discountInfo,

          metadata: {
            priceCalculatedAt: new Date(),
            taxIncluded: false,
            discountSource,
          },
        };
      });

      const sizePrices = processedSizes.map((s) => s.pricing.websitePrice);
      const minSizePrice = Math.min(...sizePrices);
      const maxSizePrice = Math.max(...sizePrices);

      return {
        _id: subProduct._id,
        sku: subProduct.sku,
        tenant: {
          _id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          logo: tenant.logo,
          primaryColor: tenant.primaryColor,
          city: tenant.city,
          state: tenant.state,
          country: tenant.country,
          revenueModel: tenant.revenueModel,
        },
        sizes: processedSizes,
        priceRange: {
          min: minSizePrice,
          max: maxSizePrice,
          currency: processedSizes[0]?.pricing.currency || 'NGN',
          display: minSizePrice === maxSizePrice
            ? `${getCurrencySymbol(processedSizes[0]?.pricing.currency || 'NGN')}${minSizePrice.toFixed(2)}`
            : `${getCurrencySymbol(processedSizes[0]?.pricing.currency || 'NGN')}${minSizePrice.toFixed(2)} - ${getCurrencySymbol(processedSizes[0]?.pricing.currency || 'NGN')}${maxSizePrice.toFixed(2)}`,
        },
        totalStock: processedSizes.reduce((sum, s) => sum + s.stock, 0),
        availableSizes: processedSizes.length,
        isFeatured: subProduct.isFeaturedByTenant || false,
      };
    });

    // ===============================
    // Calculate Overall Price Range
    // ===============================
    let globalPriceRange = { min: 0, max: 0, display: '₦0.00', currency: 'NGN' };

    if (processedSubProducts.length) {
      const allPrices = processedSubProducts.flatMap((sp) =>
        sp.sizes.map((size) => ({
          price: size.pricing.websitePrice,
          currency: size.pricing.currency,
        }))
      );

      if (allPrices.length) {
        const priceValues = allPrices.map((p) => p.price);
        const minProductPrice = Math.min(...priceValues);
        const maxProductPrice = Math.max(...priceValues);
        const currency = allPrices[0].currency;
        const currencySymbol = getCurrencySymbol(currency);

        globalPriceRange = {
          min: minProductPrice,
          max: maxProductPrice,
          currency,
          display: minProductPrice === maxProductPrice
            ? `${currencySymbol}${minProductPrice.toFixed(2)}`
            : `${currencySymbol}${minProductPrice.toFixed(2)} - ${currencySymbol}${maxProductPrice.toFixed(2)}`,
        };
      }
    }

    // Return product object for price filtering
    return {
      product,
      processedSubProducts,
      globalPriceRange,
    };
  });

  // ============================================================
  // STEP 9: Apply Price Filters
  // ============================================================
  let filteredProducts = processedProducts;

  if (minPrice !== undefined || maxPrice !== undefined) {
    filteredProducts = processedProducts.filter(({ globalPriceRange }) => {
      if (minPrice !== undefined && globalPriceRange.min < parseFloat(minPrice)) {
        return false;
      }
      if (maxPrice !== undefined && globalPriceRange.max > parseFloat(maxPrice)) {
        return false;
      }
      return true;
    });
  }

  // Filter products on sale
  if (onSale === true || onSale === 'true') {
    filteredProducts = filteredProducts.filter(({ processedSubProducts }) => {
      return processedSubProducts.some(sp => 
        // Check for discount on sizes OR sale pricing on subProduct
        sp.sizes.some(size => size.discount && size.discount.value > 0) ||
        sp.sizes.some(size => size.pricing.discount && size.pricing.discount.source === 'sale') ||
        (sp.isOnSale === true && sp.salePrice > 0)
      );
    });
  }

  // ============================================================
  // STEP 10: Apply Price Sorting
  // ============================================================
  if (sortBy === 'price_low' || sortBy === 'price_high') {
    filteredProducts.sort((a, b) => {
      const priceA = a.globalPriceRange.min;
      const priceB = b.globalPriceRange.min;
      return sortBy === 'price_low' ? priceA - priceB : priceB - priceA;
    });
  }

  // ============================================================
  // STEP 11: Build Final Products
  // ============================================================
  const finalProducts = filteredProducts.map(({ product, processedSubProducts, globalPriceRange }) => {
    // Calculate Stock Totals
    const stockInfo = processedSubProducts.reduce(
      (totals, subProduct) => ({
        totalStock: totals.totalStock + subProduct.totalStock,
        availableStock: totals.availableStock + subProduct.totalStock,
        tenants: totals.tenants + 1,
        totalSizes: totals.totalSizes + subProduct.availableSizes,
      }),
      { totalStock: 0, availableStock: 0, tenants: 0, totalSizes: 0 }
    );

    // Calculate Highest Active Discount
    let highestDiscount = {
      value: 0,
      type: 'none',
      label: null,
      savings: 0,
    };

    processedSubProducts.forEach((subProduct) => {
      subProduct.sizes.forEach((size) => {
        if (size.discount && size.discount.savings > highestDiscount.savings) {
          highestDiscount = size.discount;
        }
      });
    });

    // Calculate Availability Status
    const availability = {
      status: stockInfo.availableStock > 0 ? 'in_stock' : 'out_of_stock',
      stockLevel: stockInfo.availableStock > 50 ? 'high'
        : stockInfo.availableStock > 10 ? 'medium'
        : stockInfo.availableStock > 0 ? 'low' : 'out',
      availableFrom: stockInfo.tenants,
      message: getAvailabilityMessage(stockInfo),
    };

    // Calculate Size Variants
    const sizeVariants = [
      ...new Set(
        processedSubProducts.flatMap((sp) => sp.sizes.map((size) => size.size))
      ),
    ];

    // Calculate Badge
    const badge = assignProductBadge(product, stockInfo, highestDiscount.value > 0 ? highestDiscount : null);

    // Build Display-Ready Product
    return {
      _id: product._id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,
      tagline: product.tagline,

      images: product.images || [],
      primaryImage: product.images?.find((img) => img.isPrimary) || product.images?.[0],

      type: product.type,
      subType: product.subType,
      isAlcoholic: product.isAlcoholic,
      abv: product.abv,
      proof: product.proof,
      volume: product.volume,
      volumeMl: product.volumeMl,

      originCountry: product.originCountry,
      region: product.region,
      producer: product.producer,

      brand: product.brand ? {
        _id: product.brand._id,
        name: product.brand.name,
        slug: product.brand.slug,
        logo: product.brand.logo,
        countryOfOrigin: product.brand.countryOfOrigin,
        isPremium: product.brand.isPremium,
      } : null,

      category: product.category ? {
        _id: product.category._id,
        name: product.category.name,
        slug: product.category.slug,
        type: product.category.type,
        icon: product.category.icon,
        color: product.category.color,
        displayName: product.category.displayName,
        tagline: product.category.tagline,
      } : null,

      subCategory: product.subCategory ? {
        _id: product.subCategory._id,
        name: product.subCategory.name,
        slug: product.subCategory.slug,
        type: product.subCategory.type,
        subType: product.subCategory.subType,
        displayName: product.subCategory.displayName,
        description: product.subCategory.description,
        characteristics: product.subCategory.characteristics,
        typicalFlavors: product.subCategory.typicalFlavors,
      } : null,

      tags: (product.tags || []).map((tag) => ({
        _id: tag._id,
        name: tag.name,
        slug: tag.slug,
        displayName: tag.displayName,
        type: tag.type,
        color: tag.color,
        category: tag.category,
      })),

      flavors: (product.flavors || []).map((flavor) => ({
        _id: flavor._id,
        name: flavor.name,
        value: flavor.value,
        color: flavor.color,
        category: flavor.category,
        intensity: flavor.intensity,
      })),

      flavorProfile: product.flavorProfile || [],
      tastingNotes: product.tastingNotes,
      servingSuggestions: product.servingSuggestions,
      foodPairings: product.foodPairings || [],
      awards: product.awards || [],

      priceRange: globalPriceRange,
      availability,
      stockInfo,
      discount: highestDiscount.value > 0 ? highestDiscount : null,
      badge,
      sizeVariants,
      tenantCount: stockInfo.tenants,

      averageRating: product.averageRating || 0,
      reviewCount: product.reviewCount || 0,
      totalSold: product.totalSold || 0,

      isFeatured: product.isFeatured || false,
      requiresAgeVerification: product.requiresAgeVerification || product.isAlcoholic,
      status: product.status,

      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      publishedAt: product.publishedAt,

      availableAt: processedSubProducts,

      pricingInfo: {
        revenueModels: [...new Set(processedSubProducts.map((sp) => sp.tenant.revenueModel))],
        currenciesAvailable: [...new Set(processedSubProducts.flatMap((sp) => sp.sizes.map((s) => s.pricing.currency)))],
        hasDiscounts: highestDiscount.value > 0,
        lowestPrice: globalPriceRange.min,
        highestPrice: globalPriceRange.max,
      },

      // Search relevance
      relevanceScore: product.relevanceScore,
      vectorSimilarity: product.vectorSimilarity,
    };
  });

  // ============================================================
  // STEP 12: Get Available Filters
  // ============================================================
  const availableFilters = await getSearchFilters(matchQuery);

  // ============================================================
  // STEP 13: Build Response
  // ============================================================
  const totalPages = Math.ceil(filteredProducts.length / limit);

  return {
    products: finalProducts,
    pagination: {
      currentPage: page,
      totalPages,
      totalResults: filteredProducts.length,
      resultsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    filters: availableFilters,
    searchMeta: {
      query,
      searchMode,
      useEmbeddings,
      sortBy,
      order,
      appliedFilters: {
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
        isFeatured,
        onSale,
        minRating,
        inStock,
        tenantId,
      },
      resultsFound: filteredProducts.length,
      searchTime: null, // Can add timing if needed
    },
  };
};

// ============================================================
// HELPER: Get Available Search Filters
// ============================================================

async function getSearchFilters(baseQuery) {
  // Get all products matching base query for filter options
  const products = await Product.find(baseQuery)
    .populate('category', 'name slug')
    .populate('subCategory', 'name slug')
    .populate('brand', 'name slug')
    .populate('tags', 'name slug displayName')
    .populate('flavors', 'name value')
    .lean();

  // Extract unique values
  const categories = [...new Map(
    products
      .filter(p => p.category)
      .map(p => [p.category._id.toString(), p.category])
  ).values()];

  const subCategories = [...new Map(
    products
      .filter(p => p.subCategory)
      .map(p => [p.subCategory._id.toString(), p.subCategory])
  ).values()];

  const brands = [...new Map(
    products
      .filter(p => p.brand)
      .map(p => [p.brand._id.toString(), p.brand])
  ).values()];

  const tags = [...new Map(
    products
      .flatMap(p => p.tags || [])
      .map(t => [t._id.toString(), t])
  ).values()];

  const flavors = [...new Map(
    products
      .flatMap(p => p.flavors || [])
      .map(f => [f._id.toString(), f])
  ).values()];

  const countries = [...new Set(products.map(p => p.originCountry).filter(Boolean))];
  const regions = [...new Set(products.map(p => p.region).filter(Boolean))];
  const types = [...new Set(products.map(p => p.type).filter(Boolean))];

  // Calculate price range
  const prices = products.map(p => p.priceRange?.min || 0).filter(p => p > 0);
  const priceRange = prices.length > 0 ? {
    min: Math.min(...prices),
    max: Math.max(...prices),
  } : null;

  // Calculate ABV range
  const abvs = products.filter(p => p.isAlcoholic).map(p => p.abv).filter(Boolean);
  const abvRange = abvs.length > 0 ? {
    min: Math.min(...abvs),
    max: Math.max(...abvs),
  } : null;

  return {
    categories,
    subCategories,
    brands,
    tags,
    flavors,
    countries,
    regions,
    types,
    priceRange,
    abvRange,
  };
}

// ============================================================
// HELPER: Generate Embedding (Placeholder)
// ============================================================



/**
 * Get sort stage for search
 */
const getSortStageForSearch = (sort, order) => {
  const sortOrder = order === 'desc' ? -1 : 1;

  const sortMap = {
    relevance: { searchScore: -1, tenantCount: -1, avgRating: -1 },
    price_asc: { minPrice: 1 },
    price_desc: { minPrice: -1 },
    name: { name: sortOrder },
    rating: { avgRating: sortOrder, reviewCount: -1 },
    popularity: { tenantCount: -1, reviewCount: -1 },
    newest: { createdAt: -1 },
  };

  return sortMap[sort] || sortMap.relevance;
};

/**
 * Get available filters based on current search
 */

/**
 * Get available filters based on current query
 */
const getAvailableFilters = async (query) => {
  try {
    // Get filter options in parallel
    const [
      types,
      categories,
      brands,
      origins,
      flavors,
      priceStats
    ] = await Promise.all([
      Product.distinct('type', query),
      Category.find({ status: 'published' }, 'name slug').lean(),
      Brand.find({ status: 'active' }, 'name slug logo').lean(),
      Product.distinct('originCountry', query).then(origins => origins.filter(Boolean).sort()),
      Flavor.find({ status: 'active' }, 'name value').lean(),
      // Get price statistics to generate dynamic ranges
      Product.aggregate([
        { $match: query },
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
                      { $eq: ['$status', 'active'] }
                    ]
                  }
                }
              },
              {
                $lookup: {
                  from: 'tenants',
                  localField: 'tenant',
                  foreignField: '_id',
                  as: 'tenant'
                }
              },
              { $unwind: '$tenant' },
              {
                $lookup: {
                  from: 'sizes',
                  localField: '_id',
                  foreignField: 'subproduct',
                  as: 'sizes',
                  pipeline: [
                    {
                      $match: {
                        availability: { $in: ['available', 'low_stock'] },
                        stock: { $gt: 0 }
                      }
                    }
                  ]
                }
              },
              {
                $project: {
                  tenant: 1,
                  costPrice: 1,
                  baseSellingPrice: 1,
                  discount: 1,
                  discountType: 1,
                  discountStart: 1,
                  discountEnd: 1,
                  sizes: 1
                }
              }
            ],
            as: 'subProducts'
          }
        },
        {
          $addFields: {
            activeSubProducts: {
              $filter: {
                input: '$subProducts',
                as: 'sub',
                cond: {
                  $and: [
                    { $ifNull: ['$$sub.tenant', false] },
                    { $gt: [{ $size: '$$sub.sizes' }, 0] }
                  ]
                }
              }
            }
          }
        },
        {
          $match: {
            $expr: { $gt: [{ $size: '$activeSubProducts' }, 0] }
          }
        },
        {
          $project: {
            minPrice: {
              $min: {
                $map: {
                  input: '$activeSubProducts',
                  as: 'sub',
                  in: {
                    $min: {
                      $map: {
                        input: '$$sub.sizes',
                        as: 'size',
                        in: {
                          $cond: [
                            { $eq: ['$$sub.tenant.revenueModel', 'markup'] },
                            { $multiply: ['$$size.costPrice', { $add: [1, { $divide: ['$$sub.tenant.markupPercentage', 100] }] }] },
                            '$$size.sellingPrice'
                          ]
                        }
                      }
                    }
                  }
                }
              }
            },
            maxPrice: {
              $max: {
                $map: {
                  input: '$activeSubProducts',
                  as: 'sub',
                  in: {
                    $max: {
                      $map: {
                        input: '$$sub.sizes',
                        as: 'size',
                        in: {
                          $cond: [
                            { $eq: ['$$sub.tenant.revenueModel', 'markup'] },
                            { $multiply: ['$$size.costPrice', { $add: [1, { $divide: ['$$sub.tenant.markupPercentage', 100] }] }] },
                            '$$size.sellingPrice'
                          ]
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            minPrice: { $min: '$minPrice' },
            maxPrice: { $max: '$maxPrice' },
            avgPrice: { $avg: { $avg: ['$minPrice', '$maxPrice'] } }
          }
        }
      ])
    ]);

    // Generate dynamic price ranges based on actual price data
    const priceRanges = generateDynamicPriceRanges(priceStats[0]);

    return {
      types: types.filter(Boolean).sort(),
      categories: categories.map(cat => ({ name: cat.name, slug: cat.slug })),
      brands: brands.map(brand => ({ name: brand.name, slug: brand.slug, logo: brand.logo })),
      origins: origins,
      flavors: flavors.map(flavor => ({ name: flavor.name, value: flavor.value })),
      priceRanges,
      priceStats: priceStats[0] || null
    };
  } catch (error) {
    console.error('Error fetching available filters:', error);
    return {};
  }
};


/**
 * Get products by category
 */
const getProductsByCategory = async (categoryId, filters = {}, pagination = {}) => {
  if (!/^[0-9a-fA-F]{24}$/.test(categoryId)) {
    throw new ValidationError('Invalid category ID');
  }

  const category = await Category.findById(categoryId).lean();
  if (!category) {
    throw new NotFoundError('Category not found');
  }

  // Include subcategories
  const subCategories = await SubCategory.find({ parent: categoryId })
    .select('_id')
    .lean();
  const subCategoryIds = subCategories.map((sc) => sc._id);

  const query = {
    $or: [
      { category: categoryId },
      { subCategory: { $in: subCategoryIds } },
    ],
  };

  return searchProducts('', { ...filters, ...query }, pagination);
};

/**
 * Get products by brand
 */
const getProductsByBrand = async (brandId, filters = {}, pagination = {}) => {
  if (!/^[0-9a-fA-F]{24}$/.test(brandId)) {
    throw new ValidationError('Invalid brand ID');
  }

  const brand = await Brand.findById(brandId).lean();
  if (!brand) {
    throw new NotFoundError('Brand not found');
  }

  return searchProducts('', { ...filters, brand: brandId }, pagination);
};

/**
 * Get products by tags
 */
const getProductsByTags = async (tagIds, filters = {}, pagination = {}) => {
  if (!Array.isArray(tagIds) || tagIds.length === 0) {
    throw new ValidationError('Tag IDs array is required');
  }

  // Validate tag IDs
  const validTagIds = tagIds.filter((id) => /^[0-9a-fA-F]{24}$/.test(id));

  if (validTagIds.length === 0) {
    throw new ValidationError('No valid tag IDs provided');
  }

  return searchProducts('', { ...filters, tags: validTagIds }, pagination);
};

/**
 * Get products by flavors
 */
const getProductsByFlavors = async (flavorIds, filters = {}, pagination = {}) => {
  if (!Array.isArray(flavorIds) || flavorIds.length === 0) {
    throw new ValidationError('Flavor IDs array is required');
  }

  // Validate flavor IDs
  const validFlavorIds = flavorIds.filter((id) => /^[0-9a-fA-F]{24}$/.test(id));

  if (validFlavorIds.length === 0) {
    throw new ValidationError('No valid flavor IDs provided');
  }

  return searchProducts('', { ...filters, flavors: validFlavorIds }, pagination);
};

/**
 * Get trending products
 */
const getTrendingProducts = async (limit = 10, dateRange = 7) => {
  const Sales = require('../models/Sales');
  const SubProduct = require('../models/subProduct');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);

  // Get products with most sales in date range
  const trendingProductIds = await Sales.aggregate([
    {
      $match: {
        soldAt: { $gte: startDate },
        fulfillmentStatus: { $in: ['fulfilled', 'delivered'] },
      },
    },
    {
      $group: {
        _id: '$product',
        totalSales: { $sum: '$quantity' },
        revenue: { $sum: '$finalItemPrice' },
        uniqueTenants: { $addToSet: '$tenant' },
        uniqueSizes: { $addToSet: '$size' },
      },
    },
    {
      $project: {
        totalSales: 1,
        revenue: 1,
        tenantCount: { $size: '$uniqueTenants' },
        sizeVariations: { $size: '$uniqueSizes' },
      },
    },
    {
      $sort: { totalSales: -1 },
    },
    {
      $limit: limit,
    },
  ]);

  const productIds = trendingProductIds.map((item) => item._id);

  // If no trending products from sales, fallback to featured or random products
  let products;
  if (productIds.length === 0) {
    // Try featured products first
    products = await Product.find({
      status: 'approved',
      isFeatured: true,
    })
      .populate('brand', 'name slug logo description')
      .populate('category', 'name slug icon description')
      .select(
        'name slug type description images primaryImage abv volumeMl tenantCount averageRating reviewCount priceRange sale originPrice isAlcoholic flavorNotes country tags isFeatured'
      )
      .limit(limit)
      .lean();

    // If no featured products, get random approved products
    if (products.length === 0) {
      products = await Product.aggregate([
        { $match: { status: 'approved' } },
        { $sample: { size: limit } },
        {
          $lookup: {
            from: 'brands',
            localField: 'brand',
            foreignField: '_id',
            pipeline: [{ $project: { name: 1, slug: 1, logo: 1, description: 1 } }],
            as: 'brand',
          },
        },
        { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            pipeline: [{ $project: { name: 1, slug: 1, icon: 1, description: 1 } }],
            as: 'category',
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            name: 1,
            slug: 1,
            type: 1,
            description: 1,
            images: 1,
            primaryImage: 1,
            abv: 1,
            volumeMl: 1,
            tenantCount: 1,
            averageRating: 1,
            reviewCount: 1,
            priceRange: 1,
            sale: 1,
            originPrice: 1,
            isAlcoholic: 1,
            flavorNotes: 1,
            country: 1,
            tags: 1,
            isFeatured: 1,
            brand: 1,
            category: 1,
          },
        },
      ]);
    }
  } else {
    // Get full product details for trending products
    products = await Product.find({
      _id: { $in: productIds },
      status: 'approved',
    })
      .populate('brand', 'name slug logo description')
      .populate('category', 'name slug icon description')
      .select(
        'name slug type description images primaryImage abv volumeMl tenantCount averageRating reviewCount priceRange sale originPrice isAlcoholic flavorNotes country tags isFeatured'
      )
      .lean();
  }

  // Fetch SubProducts for each product to get sizes, tenants, and pricing details
  const productsWithDetails = await Promise.all(
    products.map(async (product) => {
      // Get all SubProducts for this product
      const subProducts = await SubProduct.find({
        product: product._id,
        status: 'active',
        availability: { $in: ['available', 'low_stock'] },
      })
        .populate('tenant', 'name slug logo city state country')
        .populate('sizes.size', 'volume unit displayName')
        .select(
          'tenant baseSellingPrice costPrice discountPercentage finalPrice currency sizes stockQuantity availability minOrderQuantity maxOrderQuantity revenueModel'
        )
        .lean();

      // Extract unique sizes across all SubProducts
      const uniqueSizes = [];
      const sizesMap = new Map();

      subProducts.forEach((subProduct) => {
        subProduct.sizes.forEach((sizeObj) => {
          const sizeKey = sizeObj.size?._id?.toString();
          if (sizeKey && !sizesMap.has(sizeKey)) {
            sizesMap.set(sizeKey, {
              _id: sizeObj.size._id,
              volume: sizeObj.size.volume,
              unit: sizeObj.size.unit,
              displayName: sizeObj.size.displayName,
              minPrice: sizeObj.sellingPrice,
              maxPrice: sizeObj.sellingPrice,
              stock: sizeObj.stock,
              availability: sizeObj.availability,
            });
          } else if (sizeKey) {
            // Update price range
            const existing = sizesMap.get(sizeKey);
            existing.minPrice = Math.min(existing.minPrice, sizeObj.sellingPrice);
            existing.maxPrice = Math.max(existing.maxPrice, sizeObj.sellingPrice);
            existing.stock += sizeObj.stock;
          }
        });
      });

      uniqueSizes.push(...sizesMap.values());

      // Extract unique tenants
      const uniqueTenants = subProducts
        .filter((sp) => sp.tenant)
        .map((sp) => ({
          _id: sp.tenant._id,
          name: sp.tenant.name,
          slug: sp.tenant.slug,
          logo: sp.tenant.logo,
          city: sp.tenant.city,
          state: sp.tenant.state,
          country: sp.tenant.country,
        }));

      // Remove duplicates
      const tenantsMap = new Map();
      uniqueTenants.forEach((tenant) => {
        tenantsMap.set(tenant._id.toString(), tenant);
      });
      const tenants = Array.from(tenantsMap.values());

      // Calculate pricing statistics
      const allPrices = subProducts.map((sp) => sp.finalPrice || sp.baseSellingPrice);
      const websitePrice = {
        min: allPrices.length > 0 ? Math.min(...allPrices) : product.priceRange?.min || 0,
        max: allPrices.length > 0 ? Math.max(...allPrices) : product.priceRange?.max || 0,
        currency: subProducts[0]?.currency || 'NGN',
      };

      // Calculate total stock across all SubProducts
      const totalStock = subProducts.reduce((sum, sp) => {
        const subProductStock = sp.sizes.reduce((sizeSum, size) => sizeSum + (size.stock || 0), 0);
        return sum + subProductStock;
      }, 0);

      // Get trending stats
      const stats = trendingProductIds.find(
        (item) => item._id.toString() === product._id.toString()
      );

      // Calculate discount info
      const hasDiscount = subProducts.some((sp) => sp.discountPercentage > 0);
      const maxDiscount = hasDiscount
        ? Math.max(...subProducts.map((sp) => sp.discountPercentage || 0))
        : 0;

      return {
        ...product,
        
        // Pricing Information
        websitePrice,
        hasDiscount,
        maxDiscount: maxDiscount > 0 ? maxDiscount : null,
        
        // Size Variations
        sizes: uniqueSizes.sort((a, b) => a.volume - b.volume),
        sizeCount: uniqueSizes.length,
        
        // Tenant Information
        tenants,
        tenantCount: tenants.length,
        
        // Stock Information
        totalStock,
        isInStock: totalStock > 0,
        stockLevel:
          totalStock === 0
            ? 'out_of_stock'
            : totalStock < 10
            ? 'low_stock'
            : 'in_stock',
        
        // SubProduct Count
        subProductCount: subProducts.length,
        
        // Trending Statistics
        trending: stats
          ? {
              quantitySold: stats.totalSales,
              revenue: stats.revenue,
              period: `${dateRange} days`,
              tenantsSelling: stats.tenantCount,
              sizeVariations: stats.sizeVariations,
              averageRevenuePerSale: stats.totalSales > 0 
                ? (stats.revenue / stats.totalSales).toFixed(2) 
                : 0,
            }
          : null,
        
        // Availability Summary
        availability: {
          total: subProducts.length,
          available: subProducts.filter((sp) => sp.availability === 'available').length,
          lowStock: subProducts.filter((sp) => sp.availability === 'low_stock').length,
          outOfStock: subProducts.filter((sp) => sp.availability === 'out_of_stock').length,
        },
        
        // Order Limits
        orderLimits: {
          min: Math.min(...subProducts.map((sp) => sp.minOrderQuantity || 1)),
          max: Math.max(...subProducts.map((sp) => sp.maxOrderQuantity || 100)),
        },
      };
    })
  );

  // Sort by original trending order if we have trending data
  if (productIds.length > 0) {
    return productIds
      .map((id) =>
        productsWithDetails.find((p) => p._id.toString() === id.toString())
      )
      .filter(Boolean);
  }

  return productsWithDetails;
};

/**
 * Get trending products summary (lighter version for quick stats)
 */
const getTrendingProductsSummary = async (limit = 10, dateRange = 7) => {
  const Sales = require('../models/Sales');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);

  const trending = await Sales.aggregate([
    {
      $match: {
        soldAt: { $gte: startDate },
        fulfillmentStatus: { $in: ['fulfilled', 'delivered'] },
      },
    },
    {
      $group: {
        _id: '$product',
        totalSales: { $sum: '$quantity' },
        revenue: { $sum: '$finalItemPrice' },
        uniqueTenants: { $addToSet: '$tenant' },
        uniqueSizes: { $addToSet: '$size' },
        averagePrice: { $avg: '$finalItemPrice' },
      },
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              name: 1,
              slug: 1,
              primaryImage: 1,
              priceRange: 1,
              averageRating: 1,
              reviewCount: 1,
            },
          },
        ],
        as: 'product',
      },
    },
    {
      $unwind: '$product',
    },
    {
      $project: {
        product: 1,
        totalSales: 1,
        revenue: 1,
        tenantCount: { $size: '$uniqueTenants' },
        sizeVariations: { $size: '$uniqueSizes' },
        averagePrice: { $round: ['$averagePrice', 2] },
      },
    },
    {
      $sort: { totalSales: -1 },
    },
    {
      $limit: limit,
    },
  ]);

  return trending;
};

/**
 * Get trending products by category
 */
const getTrendingProductsByCategory = async (categoryId, limit = 10, dateRange = 7) => {
  const Sales = require('../models/Sales');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);

  const trending = await Sales.aggregate([
    {
      $match: {
        soldAt: { $gte: startDate },
        fulfillmentStatus: { $in: ['fulfilled', 'delivered'] },
      },
    },
    {
      $lookup: {
        from: 'products',
        localField: 'product',
        foreignField: '_id',
        as: 'productData',
      },
    },
    {
      $unwind: '$productData',
    },
    {
      $match: {
        'productData.category': mongoose.Types.ObjectId(categoryId),
        'productData.status': 'approved',
      },
    },
    {
      $group: {
        _id: '$product',
        totalSales: { $sum: '$quantity' },
        revenue: { $sum: '$finalItemPrice' },
      },
    },
    {
      $sort: { totalSales: -1 },
    },
    {
      $limit: limit,
    },
  ]);

  const productIds = trending.map((item) => item._id);

  if (productIds.length === 0) {
    return [];
  }

  // Use the main getTrendingProducts function to get full details
  const products = await Product.find({
    _id: { $in: productIds },
    status: 'approved',
  })
    .populate('brand', 'name slug logo')
    .populate('category', 'name slug icon')
    .lean();

  return products;
};


/**
 * Get seasonal products
 */
const getSeasonalProducts = async (season, limit = 20) => {
  const validSeasons = ['spring', 'summer', 'fall', 'winter'];

  if (!validSeasons.includes(season)) {
    throw new ValidationError(`Invalid season. Must be one of: ${validSeasons.join(', ')}`);
  }

  // Get tags associated with season
  const seasonTags = await Tag.find({
    name: new RegExp(season, 'i'),
    status: 'active',
  })
    .select('_id')
    .lean();

  const tagIds = seasonTags.map((tag) => tag._id);

  // Season-specific type mapping
  const typeFilters = {
    spring: ['sparkling_wine', 'wine', 'cocktail_ready_to_drink'],
    summer: ['beer', 'cocktail_ready_to_drink', 'non_alcoholic', 'mixer'],
    fall: ['wine', 'spirit', 'fortified_wine'],
    winter: ['spirit', 'fortified_wine', 'liqueur'],
  };

  const query = {
    status: 'approved',
    $or: [
      { tags: { $in: tagIds } },
      { type: { $in: typeFilters[season] } },
    ],
  };

  const products = await Product.find(query)
    .populate('brand', 'name slug logo')
    .populate('category', 'name slug')
    .select('name slug type images abv tenantCount')
    .limit(limit)
    .lean();

  return products;
};

// ============================================================
// PRODUCT INVENTORY FUNCTIONS
// ============================================================

/**
 * Get comprehensive product stock status across all tenants
 */
const getProductStockStatus = async (productId) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const product = await Product.findById(productId).lean();
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Get all active SubProducts with sizes
  const subProducts = await SubProduct.find({
    product: productId,
    status: 'active',
  })
    .populate({
      path: 'tenant',
      select: 'name slug city state country',
    })
    .populate({
      path: 'sizes',
      select: 'size displayName stock availability lowStockThreshold sellingPrice',
    })
    .lean();

  // Calculate totals
  let totalStock = 0;
  let totalValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  const tenantStockData = [];

  subProducts.forEach((sp) => {
    let tenantStock = 0;
    let tenantValue = 0;

    if (sp.sizes && sp.sizes.length > 0) {
      sp.sizes.forEach((size) => {
        const stock = size.stock || 0;
        totalStock += stock;
        tenantStock += stock;

        const value = stock * (size.sellingPrice || 0);
        totalValue += value;
        tenantValue += value;

        if (size.availability === 'low_stock') lowStockCount++;
        if (size.availability === 'out_of_stock') outOfStockCount++;
      });
    }

    tenantStockData.push({
      tenant: {
        id: sp.tenant._id,
        name: sp.tenant.name,
        slug: sp.tenant.slug,
        location: {
          city: sp.tenant.city,
          state: sp.tenant.state,
          country: sp.tenant.country,
        },
      },
      stock: tenantStock,
      value: tenantValue,
      sizes: sp.sizes.map((size) => ({
        size: size.size,
        displayName: size.displayName,
        stock: size.stock,
        availability: size.availability,
        isLowStock: size.stock <= size.lowStockThreshold && size.stock > 0,
      })),
    });
  });

  // Sort by stock (highest first)
  tenantStockData.sort((a, b) => b.stock - a.stock);

  return {
    product: {
      id: product._id,
      name: product.name,
      slug: product.slug,
    },
    summary: {
      totalStock,
      totalValue,
      averageStockPerTenant: subProducts.length > 0 ? totalStock / subProducts.length : 0,
      tenantsWithStock: subProducts.length,
      lowStockVariants: lowStockCount,
      outOfStockVariants: outOfStockCount,
    },
    byTenant: tenantStockData,
    lastUpdated: new Date(),
  };
};

/**
 * Get product price range across all tenants
 */
const getProductPriceRange = async (productId) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const priceData = await SubProduct.aggregate([
    {
      $match: {
        product: productId,
        status: 'active',
      },
    },
    {
      $lookup: {
        from: 'sizes',
        localField: 'sizes',
        foreignField: '_id',
        as: 'sizeData',
      },
    },
    {
      $unwind: '$sizeData',
    },
    {
      $group: {
        _id: '$sizeData.size',
        minPrice: { $min: '$sizeData.sellingPrice' },
        maxPrice: { $max: '$sizeData.sellingPrice' },
        avgPrice: { $avg: '$sizeData.sellingPrice' },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { avgPrice: 1 },
    },
  ]);

  // Overall price range
  const overallMin = Math.min(...priceData.map((p) => p.minPrice));
  const overallMax = Math.max(...priceData.map((p) => p.maxPrice));
  const overallAvg =
    priceData.reduce((sum, p) => sum + p.avgPrice, 0) / priceData.length;

  return {
    overall: {
      min: overallMin,
      max: overallMax,
      avg: overallAvg,
      currency: 'NGN', // TODO: Handle multiple currencies
    },
    bySize: priceData.map((item) => ({
      size: item._id,
      minPrice: item.minPrice,
      maxPrice: item.maxPrice,
      avgPrice: item.avgPrice,
      availableFrom: item.count,
    })),
  };
};



// ============================================================
// PRODUCT REVIEWS FUNCTIONS
// ============================================================


/**
 * Get product reviews with filters and pagination
 */
const getProductReviews = async (productId, filters = {}, pagination = {}) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const {
    rating,
    verified,
    withImages,
    sortBy = 'helpful',
  } = filters;

  const {
    page = 1,
    limit = 10,
  } = pagination;

  // Build query
  const query = {
    product: productId,
    status: 'approved',
  };

  if (rating) {
    query.rating = parseInt(rating);
  }

  if (verified === true || verified === 'true') {
    query.isVerifiedPurchase = true;
  }

  if (withImages === true || withImages === 'true') {
    query.images = { $exists: true, $ne: [] };
  }

  // Pagination
  const pageNum = Math.max(1, page);
  const limitNum = Math.min(Math.max(1, limit), 50);
  const skip = (pageNum - 1) * limitNum;

  // Sort
  const sortMap = {
    helpful: { helpfulCount: -1, createdAt: -1 },
    recent: { createdAt: -1 },
    rating_high: { rating: -1, createdAt: -1 },
    rating_low: { rating: 1, createdAt: -1 },
  };
  const sortOptions = sortMap[sortBy] || sortMap.helpful;

  // Execute queries
  const [total, reviews] = await Promise.all([
    Review.countDocuments(query),
    Review.find(query)
      .populate('user', 'firstName lastName avatar')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ]);

  return {
    reviews,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
      hasNext: pageNum < Math.ceil(total / limitNum),
      hasPrev: pageNum > 1,
    },
  };
};

/**
 * Get product rating distribution
 */
const getProductRatingDistribution = async (productId) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const distribution = await Review.aggregate([
    {
      $match: {
        product: productId,
        status: 'approved',
      },
    },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 },
      },
    },
    {
      $sort: { _id: -1 },
    },
  ]);

  // Get total reviews
  const totalReviews = distribution.reduce((sum, item) => sum + item.count, 0);

  // Calculate average
  const totalRating = distribution.reduce(
    (sum, item) => sum + item._id * item.count,
    0
  );
  const averageRating = totalReviews > 0 ? totalRating / totalReviews : 0;

  // Format distribution
  const formattedDistribution = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  };

  distribution.forEach((item) => {
    formattedDistribution[item._id] = item.count;
  });

  // Calculate percentages
  const distributionWithPercentages = {};
  Object.keys(formattedDistribution).forEach((rating) => {
    const count = formattedDistribution[rating];
    distributionWithPercentages[`${rating}star`] = {
      count,
      percentage: totalReviews > 0 ? (count / totalReviews) * 100 : 0,
    };
  });

  return {
    average: Math.round(averageRating * 10) / 10,
    total: totalReviews,
    distribution: distributionWithPercentages,
  };
};

/**
 * Get product review summary (AI-generated insights)
 */
const getProductReviewSummary = async (productId) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  // Get recent reviews
  const reviews = await Review.find({
    product: productId,
    status: 'approved',
  })
    .select('rating comment tastingNotes')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  if (reviews.length === 0) {
    return {
      summary: 'No reviews yet',
      highlights: [],
      concerns: [],
      commonThemes: [],
    };
  }

  // Get rating distribution
  const distribution = await getProductRatingDistribution(productId);

  // Extract common themes (simple keyword extraction)
  const positiveKeywords = new Map();
  const negativeKeywords = new Map();

  reviews.forEach((review) => {
    const comment = review.comment?.toLowerCase() || '';

    // Positive indicators
    const positiveWords = [
      'excellent', 'great', 'love', 'amazing', 'perfect',
      'delicious', 'smooth', 'fantastic', 'wonderful', 'best',
    ];

    // Negative indicators
    const negativeWords = [
      'bad', 'terrible', 'awful', 'poor', 'disappointing',
      'harsh', 'bitter', 'weak', 'worst', 'horrible',
    ];

    positiveWords.forEach((word) => {
      if (comment.includes(word)) {
        positiveKeywords.set(word, (positiveKeywords.get(word) || 0) + 1);
      }
    });

    negativeWords.forEach((word) => {
      if (comment.includes(word)) {
        negativeKeywords.set(word, (negativeKeywords.get(word) || 0) + 1);
      }
    });
  });

  // Get top themes
  const highlights = Array.from(positiveKeywords.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, count]) => ({ theme: word, mentions: count }));

  const concerns = Array.from(negativeKeywords.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, count]) => ({ theme: word, mentions: count }));

  return {
    summary: `Based on ${reviews.length} reviews with an average rating of ${distribution.average}/5`,
    highlights,
    concerns,
    distribution: distribution.distribution,
    totalReviews: reviews.length,
  };
};



// ============================================================
// PRODUCT RELATIONS FUNCTIONS
// ============================================================


/**
 * Get frequently bought together products
 */
const getFrequentlyBoughtTogether = async (productId, limit = 5) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  // Find orders containing this product
  const ordersWithProduct = await Order.aggregate([
    {
      $match: {
        'items.product': productId,
        status: { $in: ['delivered', 'shipped', 'processing'] },
      },
    },
    {
      $unwind: '$items',
    },
    {
      $match: {
        'items.product': { $ne: productId },
      },
    },
    {
      $group: {
        _id: '$items.product',
        frequency: { $sum: 1 },
        totalQuantity: { $sum: '$items.quantity' },
      },
    },
    {
      $sort: { frequency: -1 },
    },
    {
      $limit: limit,
    },
  ]);

  if (ordersWithProduct.length === 0) {
    // Fallback to related products if no co-purchase data
    return getRelatedProducts(productId, limit);
  }

  const productIds = ordersWithProduct.map((item) => item._id);

  // Get full product details
  const products = await Product.find({
    _id: { $in: productIds },
    status: 'approved',
  })
    .populate('brand', 'name slug logo')
    .populate('category', 'name slug')
    .select('name slug type images abv tenantCount averageSellingPrice')
    .lean();

  // Add frequency data
  const productsWithFrequency = products.map((product) => {
    const frequencyData = ordersWithProduct.find(
      (item) => item._id.toString() === product._id.toString()
    );
    return {
      ...product,
      boughtTogether: {
        frequency: frequencyData.frequency,
        totalQuantity: frequencyData.totalQuantity,
      },
    };
  });

  // Sort by original frequency order
  return productIds.map((id) =>
    productsWithFrequency.find((p) => p._id.toString() === id.toString())
  );
};

/**
 * Get cross-sell products (complementary products)
 */
const getProductCrossSells = async (productId, limit = 4) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const product = await Product.findById(productId).lean();
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Define cross-sell rules based on product type
  const crossSellRules = {
    wine: ['wine_glass', 'wine_opener', 'cheese', 'snack'],
    beer: ['beer_glass', 'snack', 'mixer'],
    spirit: ['mixer', 'glass', 'snack', 'ice'],
    cocktail_ready_to_drink: ['glass', 'ice', 'snack'],
  };

  const complementaryTypes = crossSellRules[product.type] || [];

  // Find complementary products
  const crossSells = await Product.find({
    _id: { $ne: productId },
    status: 'approved',
    $or: [
      { type: { $in: complementaryTypes } },
      { tags: { $in: product.tags || [] } },
    ],
  })
    .populate('brand', 'name slug logo')
    .populate('category', 'name slug')
    .select('name slug type images tenantCount averageSellingPrice')
    .limit(limit)
    .lean();

  return crossSells;
};

/**
 * Get up-sell products (premium alternatives)
 */
const getProductUpSells = async (productId, limit = 4) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const product = await Product.findById(productId).lean();
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  const currentPrice = product.averageSellingPrice || 0;

  // Find premium alternatives (same category/type but higher price)
  const upSells = await Product.find({
    _id: { $ne: productId },
    status: 'approved',
    type: product.type,
    category: product.category,
    averageSellingPrice: {
      $gte: currentPrice * 1.2, // At least 20% more expensive
      $lte: currentPrice * 3, // Max 3x more expensive
    },
  })
    .populate('brand', 'name slug logo')
    .populate('category', 'name slug')
    .select('name slug type images abv tenantCount averageSellingPrice')
    .sort({ averageSellingPrice: 1 }) // Cheapest premium option first
    .limit(limit)
    .lean();

  return upSells;
};

// ============================================================
// PRODUCT VARIANTS FUNCTIONS
// ============================================================

/**
 * Get all product variants (sizes) across all tenants
 */
const getProductVariants = async (productId) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const product = await Product.findById(productId).lean();
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Get all SubProducts with sizes
  const variants = await SubProduct.aggregate([
    {
      $match: {
        product: productId,
        status: 'active',
      },
    },
    {
      $lookup: {
        from: 'tenants',
        localField: 'tenant',
        foreignField: '_id',
        as: 'tenantData',
      },
    },
    {
      $unwind: '$tenantData',
    },
    {
      $match: {
        'tenantData.status': 'approved',
        'tenantData.subscriptionStatus': { $in: ['active', 'trialing'] },
      },
    },
    {
      $lookup: {
        from: 'sizes',
        localField: 'sizes',
        foreignField: '_id',
        as: 'sizeData',
      },
    },
    {
      $unwind: '$sizeData',
    },
    {
      $group: {
        _id: '$sizeData.size',
        variants: {
          $push: {
            tenant: {
              id: '$tenantData._id',
              name: '$tenantData.name',
              slug: '$tenantData.slug',
            },
            subProductId: '$_id',
            sizeId: '$sizeData._id',
            sku: '$sizeData.sku',
            price: '$sizeData.sellingPrice',
            stock: '$sizeData.stock',
            availability: '$sizeData.availability',
            displayName: '$sizeData.displayName',
          },
        },
        minPrice: { $min: '$sizeData.sellingPrice' },
        maxPrice: { $max: '$sizeData.sellingPrice' },
        totalStock: { $sum: '$sizeData.stock' },
        tenantCount: { $sum: 1 },
      },
    },
    {
      $sort: { minPrice: 1 },
    },
  ]);

  return {
    product: {
      id: product._id,
      name: product.name,
      slug: product.slug,
    },
    variants,
  };
};

/**
 * Compare product variants (prices, availability, etc.)
 */
const compareProductVariants = async (productId) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const variants = await getProductVariants(productId);

  // Calculate comparison metrics
  const comparison = {
    totalVariants: variants.variants.length,
    totalTenants: new Set(
      variants.variants.flatMap((v) => v.variants.map((t) => t.tenant.id.toString()))
    ).size,
    priceRange: {
      min: Math.min(...variants.variants.map((v) => v.minPrice)),
      max: Math.max(...variants.variants.map((v) => v.maxPrice)),
    },
    averagePrice: 0,
    totalStock: 0,
    bestValue: null,
    cheapestOption: null,
    mostExpensiveOption: null,
  };

  // Calculate averages
  const allPrices = variants.variants.flatMap((v) =>
    v.variants.map((t) => t.price)
  );
  comparison.averagePrice =
    allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length;

  comparison.totalStock = variants.variants.reduce(
    (sum, v) => sum + v.totalStock,
    0
  );

  // Find best value (lowest price with good availability)
  const availableVariants = variants.variants.flatMap((v) =>
    v.variants.filter((t) => t.stock > 0)
  );

  if (availableVariants.length > 0) {
    comparison.cheapestOption = availableVariants.reduce((min, variant) =>
      variant.price < min.price ? variant : min
    );

    comparison.mostExpensiveOption = availableVariants.reduce((max, variant) =>
      variant.price > max.price ? variant : max
    );

    // Best value: good stock and competitive price
    comparison.bestValue = availableVariants
      .filter((v) => v.stock >= 10)
      .sort((a, b) => a.price - b.price)[0];
  }

  return {
    ...comparison,
    variants: variants.variants,
  };
};

// ============================================================
// PRODUCT PRICE MANAGEMENT FUNCTIONS
// ============================================================

/**
 * Update product pricing (affects all SubProducts)
 */
const updateProductPricing = async (productId, pricingData, user) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const isSuperAdmin = user.role === 'super_admin';
  if (!isSuperAdmin) {
    throw new ForbiddenError('Only super-admins can update global product pricing');
  }

  const { averageSellingPrice } = pricingData;

  if (averageSellingPrice !== undefined && averageSellingPrice < 0) {
    throw new ValidationError('Price cannot be negative');
  }

  const product = await Product.findByIdAndUpdate(
    productId,
    { averageSellingPrice },
    { new: true }
  );

  if (!product) {
    throw new NotFoundError('Product not found');
  }

  return product;
};

/**
 * Get product price history
 */
const getProductPriceHistory = async (productId, dateRange = {}) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const { startDate, endDate } = dateRange;
  const start = startDate
    ? new Date(startDate)
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
  const end = endDate ? new Date(endDate) : new Date();

  // Get historical sales data to track price changes
  const priceHistory = await Sales.aggregate([
    {
      $match: {
        product: productId,
        soldAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$soldAt' },
        },
        avgPrice: { $avg: '$priceAtSale' },
        minPrice: { $min: '$priceAtSale' },
        maxPrice: { $max: '$priceAtSale' },
        volume: { $sum: '$quantity' },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  return {
    dateRange: { start, end },
    history: priceHistory.map((item) => ({
      date: item._id,
      average: item.avgPrice,
      min: item.minPrice,
      max: item.maxPrice,
      volume: item.volume,
    })),
  };
};

/**
 * Schedule price change
 */
const schedulePriceChange = async (productId, newPrice, effectiveDate, user) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const isSuperAdmin = user.role === 'super_admin';
  if (!isSuperAdmin) {
    throw new ForbiddenError('Only super-admins can schedule price changes');
  }

  if (!newPrice || newPrice < 0) {
    throw new ValidationError('Valid price is required');
  }

  if (!effectiveDate || new Date(effectiveDate) <= new Date()) {
    throw new ValidationError('Effective date must be in the future');
  }

  // Store scheduled price change
  // TODO: Implement scheduled jobs system (e.g., Bull Queue, node-cron)
  // For now, store in a separate ScheduledPriceChange collection

  const ScheduledPriceChange = require('../models/ScheduledPriceChange');

  const scheduledChange = await ScheduledPriceChange.create({
    product: productId,
    currentPrice: null, // Will be set from product
    newPrice,
    effectiveDate: new Date(effectiveDate),
    scheduledBy: user._id,
    status: 'pending',
  });

  return scheduledChange;
};

// ============================================================
// PRODUCT IMAGE MANAGEMENT FUNCTIONS (Extended)
// ============================================================

/**
 * Upload product images (already exists, but extended)
 */
const uploadProductImages = async (productId, files, user, options = {}) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Authorization check
  const isSuperAdmin = user.role === 'super_admin';
  const isTenantOwner =
    product.submittingTenant?.toString() === user.tenant?.toString() &&
    ['tenant_owner', 'tenant_admin'].includes(user.role);

  if (!isSuperAdmin && !isTenantOwner) {
    throw new ForbiddenError('You do not have permission to update this product');
  }

  if (!files || files.length === 0) {
    throw new ValidationError('No files provided');
  }

  const { tags = [], context = {} } = options;

  // Upload images to Cloudinary
  const uploadResults = await cloudinaryService.uploadMultipleImages(files, {
    folder: `products/${productId}`,
    tags: ['product', productId.toString(), ...tags],
    context: {
      productId: productId.toString(),
      productName: product.name,
      ...context,
    },
  });

  // Add to product images
  const newImages = uploadResults.map((result, index) => ({
    url: result.url,
    publicId: result.publicId,
    resourceType: result.resourceType,
    format: result.format,
    width: result.width,
    height: result.height,
    size: result.size,
    thumbnail: result.thumbnail,
    order: product.images.length + index,
    isPrimary: product.images.length === 0 && index === 0,
    uploadedBy: user._id,
    uploadedAt: new Date(),
    alt: `${product.name} - Image ${product.images.length + index + 1}`,
  }));

  product.images.push(...newImages);
  await product.save();

  return {
    uploaded: newImages.length,
    images: product.images,
  };
};

/**
 * Delete product image
 */
const deleteProductImage = async (productId, publicId, user) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Authorization check
  const isSuperAdmin = user.role === 'super_admin';
  const isTenantOwner =
    product.submittingTenant?.toString() === user.tenant?.toString() &&
    ['tenant_owner', 'tenant_admin'].includes(user.role);

  if (!isSuperAdmin && !isTenantOwner) {
    throw new ForbiddenError('You do not have permission to update this product');
  }

  // Find image
  const imageIndex = product.images.findIndex((img) => img.publicId === publicId);
  if (imageIndex === -1) {
    throw new NotFoundError('Image not found');
  }

  const wasPrimary = product.images[imageIndex].isPrimary;

  // Delete from Cloudinary
  await cloudinaryService.deleteImage(publicId);

  // Remove from product
  product.images.splice(imageIndex, 1);

  // If deleted image was primary, set first image as primary
  if (wasPrimary && product.images.length > 0) {
    product.images[0].isPrimary = true;
  }

  await product.save();

  return {
    deleted: publicId,
    remaining: product.images.length,
    images: product.images,
  };
};

/**
 * Reorder product images
 */
const reorderProductImages = async (productId, imageOrder, user) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Authorization check
  const isSuperAdmin = user.role === 'super_admin';
  const isTenantOwner =
    product.submittingTenant?.toString() === user.tenant?.toString() &&
    ['tenant_owner', 'tenant_admin'].includes(user.role);

  if (!isSuperAdmin && !isTenantOwner) {
    throw new ForbiddenError('You do not have permission to update this product');
  }

  if (!Array.isArray(imageOrder)) {
    throw new ValidationError('Image order must be an array of public IDs');
  }

  // Validate all publicIds exist
  const imageMap = new Map(product.images.map((img) => [img.publicId, img]));
  const reorderedImages = [];

  for (let i = 0; i < imageOrder.length; i++) {
    const publicId = imageOrder[i];
    const image = imageMap.get(publicId);

    if (!image) {
      throw new ValidationError(`Image with publicId ${publicId} not found`);
    }

    image.order = i;
    reorderedImages.push(image);
  }

  product.images = reorderedImages;
  await product.save();

  return {
    reordered: true,
    count: reorderedImages.length,
    images: product.images,
  };
};

/**
 * Set primary product image
 */
const setProductPrimaryImage = async (productId, publicId, user) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Authorization check
  const isSuperAdmin = user.role === 'super_admin';
  const isTenantOwner =
    product.submittingTenant?.toString() === user.tenant?.toString() &&
    ['tenant_owner', 'tenant_admin'].includes(user.role);

  if (!isSuperAdmin && !isTenantOwner) {
    throw new ForbiddenError('You do not have permission to update this product');
  }

  // Find image
  const imageIndex = product.images.findIndex((img) => img.publicId === publicId);
  if (imageIndex === -1) {
    throw new NotFoundError('Image not found');
  }

  // Unset all primary flags
  product.images.forEach((img) => {
    img.isPrimary = false;
  });

  // Set new primary
  product.images[imageIndex].isPrimary = true;

  await product.save();

  return {
    primary: publicId,
    images: product.images,
  };
};

/**
 * Update image metadata (alt text, tags, etc.)
 */
const updateProductImageMetadata = async (productId, publicId, metadata, user) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Authorization check
  const isSuperAdmin = user.role === 'super_admin';
  const isTenantOwner =
    product.submittingTenant?.toString() === user.tenant?.toString() &&
    ['tenant_owner', 'tenant_admin'].includes(user.role);

  if (!isSuperAdmin && !isTenantOwner) {
    throw new ForbiddenError('You do not have permission to update this product');
  }

  // Find image
  const image = product.images.find((img) => img.publicId === publicId);
  if (!image) {
    throw new NotFoundError('Image not found');
  }

  // Update metadata
  const { alt, caption, tags } = metadata;

  if (alt !== undefined) image.alt = alt;
  if (caption !== undefined) image.caption = caption;
  if (tags !== undefined) image.tags = tags;

  await product.save();

  // Update Cloudinary metadata
  if (tags) {
    await cloudinaryService.updateImageMetadata(publicId, {
      tags: ['product', productId.toString(), ...tags],
    });
  }

  return {
    updated: publicId,
    metadata: {
      alt: image.alt,
      caption: image.caption,
      tags: image.tags,
    },
  };
};

/**
 * Get optimized image URL with transformations
 */
const getOptimizedImageUrl = (publicId, transformations = {}) => {
  const {
    width,
    height,
    crop = 'fill',
    quality = 'auto',
    format = 'auto',
  } = transformations;

  const transformParams = [];

  if (width) transformParams.push(`w_${width}`);
  if (height) transformParams.push(`h_${height}`);
  if (crop) transformParams.push(`c_${crop}`);
  if (quality) transformParams.push(`q_${quality}`);
  if (format) transformParams.push(`f_${format}`);

  return cloudinaryService.getTransformedUrl(publicId, transformParams);
};

/**
 * Bulk delete product images
 */
const bulkDeleteProductImages = async (productId, publicIds, user) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  if (!Array.isArray(publicIds) || publicIds.length === 0) {
    throw new ValidationError('Public IDs array is required');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Authorization check
  const isSuperAdmin = user.role === 'super_admin';
  const isTenantOwner =
    product.submittingTenant?.toString() === user.tenant?.toString() &&
    ['tenant_owner', 'tenant_admin'].includes(user.role);

  if (!isSuperAdmin && !isTenantOwner) {
    throw new ForbiddenError('You do not have permission to update this product');
  }

  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };

  // Delete from Cloudinary
  await cloudinaryService.deleteMultipleImages(publicIds);

  // Remove from product
  for (const publicId of publicIds) {
    const imageIndex = product.images.findIndex((img) => img.publicId === publicId);

    if (imageIndex !== -1) {
      product.images.splice(imageIndex, 1);
      results.success++;
    } else {
      results.failed++;
      results.errors.push({
        publicId,
        error: 'Image not found',
      });
    }
  }

  // Ensure we have a primary image
  if (product.images.length > 0 && !product.images.some((img) => img.isPrimary)) {
    product.images[0].isPrimary = true;
  }

  await product.save();

  return {
    ...results,
    remaining: product.images.length,
  };
};





// services/product.service.js


/**
 * Get all products with advanced filtering, pagination, and complete data
 * @param {Object} queryParams - Query parameters for filtering and pagination
 * @returns {Promise<Object>} Products with pagination and filters
 */
const getAllProducts = async (queryParams) => {
  // ============================================================
  // 1. EXTRACT AND VALIDATE QUERY PARAMETERS
  // ============================================================
  const {
    page = 1,
    limit = 20,
    sort = 'createdAt',
    order = 'desc',
    type,
    category,
    subCategory,
    brand,
    originCountry,
    minAbv,
    maxAbv,
    minPrice,
    maxPrice,
    isAlcoholic,
    flavor,
    tag,
    tenant,
    search,
    inStock = 'true',
    status = 'approved',
    featured,
    trending,
    onSale,
    newArrivals,
  } = queryParams;

  // Validate and sanitize pagination
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(Math.max(1, parseInt(limit)), 100); // Cap at 100
  const skip = (pageNum - 1) * limitNum;

  const currentDate = new Date();

  // ============================================================
  // 2. BUILD BASE QUERY
  // ============================================================
  const query = buildProductQuery({
    type,
    category,
    subCategory,
    originCountry,
    minAbv,
    maxAbv,
    isAlcoholic,
    search,
    status,
    featured,
  });

  // Handle brand filter separately - resolve name to ObjectId
  if (brand) {
    const brandFilter = await buildBrandFilter(brand);
    if (brandFilter) {
      Object.assign(query, brandFilter);
    }
  }

  // ============================================================
  // 3. BUILD AGGREGATION PIPELINE
  // ============================================================
  const pipeline = [
    // Match base query
    { $match: query },

    // Lookup SubProducts with complete data
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
          // Filter active tenants only
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
                    ...(inStock === 'true' ? { stock: { $gt: 0 } } : {}),
                  },
                },
                {
                  $project: {
                    size: 1,
                    displayName: 1,
                    volumeMl: 1,
                    sellingPrice: 1,
                    costPrice: 1,
                    compareAtPrice: 1,
                    discountedPrice: 1,
                    currency: 1,
                    stock: 1,
                    availableStock: 1,
                    availability: 1,
                    discount: 1,
                    sku: 1,
                    isDefault: 1,
                  },
                },
              ],
            },
          },
          {
            $project: {
              tenant: {
                _id: 1,
                name: 1,
                slug: 1,
                logo: 1,
                primaryColor: 1,
                city: 1,
                state: 1,
                country: 1,
                revenueModel: 1,
                markupPercentage: 1,
                commissionPercentage: 1,
                defaultCurrency: 1,
              },
              sku: 1,
              costPrice: 1,
              baseSellingPrice: 1,
              discount: 1,
              discountType: 1,
              discountedPrice: 1,
              discountStart: 1,
              discountEnd: 1,
              sizes: 1,
              currency: 1,
              totalStock: 1,
              availableStock: 1,
              totalSold: 1,
              totalRevenue: 1,
              isFeaturedByTenant: 1,
              status: 1,
              // Sale fields
              salePrice: 1,
              saleStartDate: 1,
              saleEndDate: 1,
              saleType: 1,
              saleDiscountValue: 1,
              isOnSale: 1,
            },
          },
        ],
        as: 'subProducts',
      },
    },

    // Lookup brand with complete info
    {
      $lookup: {
        from: 'brands',
        localField: 'brand',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              logo: 1,
              status: 1,
              countryOfOrigin: 1,
              isPremium: 1,
              description: 1,
            },
          },
        ],
        as: 'brand',
      },
    },
    { 
      $unwind: { 
        path: '$brand',
        preserveNullAndEmptyArrays: true 
      } 
    },

    // Lookup category with complete info
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              type: 1,
              description: 1,
              shortDescription: 1,
              icon: 1,
              color: 1,
              status: 1,
              displayName: 1,
              tagline: 1,
              showOnHomepage: 1,
              isFeatured: 1,
            },
          },
        ],
        as: 'category',
      },
    },
    { 
      $unwind: { 
        path: '$category',
        preserveNullAndEmptyArrays: true 
      } 
    },

    // Lookup subcategory with complete info
    {
      $lookup: {
        from: 'subcategories',
        localField: 'subCategory',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              type: 1,
              subType: 1,
              description: 1,
              shortDescription: 1,
              displayName: 1,
              status: 1,
              parent: 1,
              parentPath: 1,
              characteristics: 1,
              typicalFlavors: 1,
              seasonal: 1,
            },
          },
        ],
        as: 'subCategory',
      },
    },
    { 
      $unwind: { 
        path: '$subCategory',
        preserveNullAndEmptyArrays: true 
      } 
    },

    // Lookup tags with complete info
    {
      $lookup: {
        from: 'tags',
        localField: 'tags',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              displayName: 1,
              type: 1,
              color: 1,
              category: 1,
              icon: 1,
            },
          },
        ],
        as: 'tags',
      },
    },

    // Lookup flavors with complete info
    {
      $lookup: {
        from: 'flavors',
        localField: 'flavors',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
              value: 1,
              color: 1,
              category: 1,
              intensity: 1,
              description: 1,
            },
          },
        ],
        as: 'flavors',
      },
    },

    // Add computed fields
    {
      $addFields: {
        // Filter subProducts with available sizes
        activeSubProducts: {
          $filter: {
            input: '$subProducts',
            as: 'sub',
            cond: {
              $and: [
                { $ifNull: ['$$sub.tenant', false] },
                { $gt: [{ $size: '$$sub.sizes' }, 0] },
              ],
            },
          },
        },
        // Tenant count
        tenantCount: { $size: { $ifNull: ['$subProducts', []] } },
        // Total available stock across all tenants
        totalAvailableStock: {
          $sum: {
            $map: {
              input: { $ifNull: ['$subProducts', []] },
              as: 'sub',
              in: {
                $sum: {
                  $map: {
                    input: { $ifNull: ['$$sub.sizes', []] },
                    as: 'size',
                    in: { $ifNull: ['$$size.availableStock', 0] },
                  },
                },
              },
            },
          },
        },
        // Total sold across all tenants
        totalSold: {
          $sum: {
            $map: {
              input: { $ifNull: ['$subProducts', []] },
              as: 'sub',
              in: { $ifNull: ['$$sub.totalSold', 0] },
            },
          },
        },
      },
    },

    // Filter out products with no active subProducts (if inStock=true)
    ...(inStock === 'true'
      ? [
          {
            $match: {
              $expr: { $gt: [{ $size: '$activeSubProducts' }, 0] },
            },
          },
        ]
      : []),

    // Filter by tenant if specified
    ...(tenant
      ? [
          {
            $match: {
              'activeSubProducts.tenant.slug': tenant,
            },
          },
        ]
      : []),

    // Sort
    { $sort: getSortStage(sort, order) },

    // Pagination
    { $skip: skip },
    { $limit: limitNum },

    // Project final fields
    {
      $project: {
        _id: 1,
        name: 1,
        slug: 1,
        shortDescription: 1,
        description: 1,
        tagline: 1,
        images: 1,
        type: 1,
        subType: 1,
        isAlcoholic: 1,
        abv: 1,
        proof: 1,
        volume: 1,
        volumeMl: 1,
        originCountry: 1,
        region: 1,
        producer: 1,
        brand: 1,
        category: 1,
        subCategory: 1,
        tags: 1,
        flavors: 1,
        flavorProfile: 1,
        tastingNotes: 1,
        servingSuggestions: 1,
        foodPairings: 1,
        awards: 1,
        ingredients: 1,
        allergens: 1,
        nutritionalInfo: 1,
        isDietary: 1,
        status: 1,
        isFeatured: 1,
        requiresAgeVerification: 1,
        averageRating: 1,
        reviewCount: 1,
        activeSubProducts: 1,
        tenantCount: 1,
        totalAvailableStock: 1,
        totalSold: 1,
        createdAt: 1,
        updatedAt: 1,
        publishedAt: 1,
      },
    },
  ];

  // ============================================================
  // 4. EXECUTE QUERIES IN PARALLEL
  // ============================================================
  const totalPromise = Product.countDocuments(query);
  const productsPromise = Product.aggregate(pipeline);

  const [totalProducts, products] = await Promise.all([
    totalPromise,
    productsPromise,
  ]);

  // Early return if no products
  if (!products.length) {
    return {
      products: [],
      pagination: buildPagination(pageNum, limitNum, totalProducts),
      filters: {
        applied: queryParams,
        available: {},
      },
    };
  }

  // ============================================================
  // 5. PROCESS PRODUCTS FOR DISPLAY WITH PRICING
  // ============================================================
  const processedProducts = products.map((product) => {
    // ===============================
    // Process SubProducts with Website Pricing
    // ===============================
    const processedSubProducts = (product.activeSubProducts || []).map((subProduct) => {
      const tenant = subProduct.tenant;
      const revenueModel = tenant.revenueModel || 'markup';
      const tenantMarkupPercentage = tenant.markupPercentage || 20;
      const platformMarkupPercentage = 15; // Platform markup on top of tenant price

      // Process each size with website pricing
      const processedSizes = (subProduct.sizes || []).map((size) => {
        // Base prices
        const sellingPrice = size.sellingPrice || 0; // This is tenant's sellingPrice (already includes tenant markup)
        const costPrice = size.costPrice || subProduct.costPrice || 0; // Tenant's cost from supplier

        // ──────────────────────────────────────────────────────────────────────
        // New Pricing Model (Platform adds markup on top of tenant price)
        // ──────────────────────────────────────────────────────────────────────
        // 1. Tenant buys at: costPrice
        // 2. Tenant sets sellingPrice (with their markup already included)
        // 3. Platform adds markup: sellingPrice × (1 + platformMarkupPercentage/100)
        // 4. Customer pays: websitePrice
        // 5. Tenant receives: sellingPrice (tenantRevenueShare)
        // 6. Platform earns: websitePrice - sellingPrice (platformCommission)
        // ──────────────────────────────────────────────────────────────────────

        // Calculate discount based on actual discount fields
        let hasActiveDiscount = false;
        let discountedTenantPrice = sellingPrice;
        let discountInfo = null;
        let discountSource = null;

        // Helper: Check if discount is active
        const checkDiscountActive = (discount) => {
          if (!discount || !discount.value || !discount.type) return false;

          const now = new Date();
          const discountStart = discount.startDate || discount.discountStart;
          const discountEnd = discount.endDate || discount.discountEnd;

          if (discountStart && now < new Date(discountStart)) return false;
          if (discountEnd && now > new Date(discountEnd)) return false;

          return true;
        };

        // Helper: Calculate discounted price
        const calculateDiscountedPrice = (basePrice, discount) => {
          if (discount.type === 'percentage') {
            const discountAmount = (basePrice * discount.value) / 100;
            return Math.max(0, basePrice - discountAmount);
          } else if (discount.type === 'fixed') {
            return Math.max(0, basePrice - discount.value);
          }
          return basePrice;
        };

        // Priority 1: Size-level discount
        if (size.discount && checkDiscountActive(size.discount)) {
          hasActiveDiscount = true;
          discountSource = 'size';
          discountedTenantPrice = calculateDiscountedPrice(sellingPrice, size.discount);

          discountInfo = {
            type: size.discount.type,
            value: size.discount.value,
            originalPrice: sellingPrice,
            savings: sellingPrice - discountedTenantPrice,
            source: 'size',
            startDate: size.discount.startDate || size.discount.discountStart,
            endDate: size.discount.endDate || size.discount.discountEnd,
            label:
              size.discount.type === 'percentage'
                ? `${size.discount.value}% OFF`
                : `Save ${getCurrencySymbol(size.currency)}${size.discount.value}`,
          };
        }
        // Priority 2: SubProduct-level discount
        else if (subProduct.discount && checkDiscountActive(subProduct.discount)) {
          hasActiveDiscount = true;
          discountSource = 'subproduct';
          discountedTenantPrice = calculateDiscountedPrice(sellingPrice, subProduct.discount);

          discountInfo = {
            type: subProduct.discount.type || subProduct.discountType,
            value: subProduct.discount.value,
            originalPrice: sellingPrice,
            savings: sellingPrice - discountedTenantPrice,
            source: 'subproduct',
            startDate: subProduct.discount.startDate || subProduct.discountStart,
            endDate: subProduct.discount.endDate || subProduct.discountEnd,
            label:
              (subProduct.discount.type || subProduct.discountType) === 'percentage'
                ? `${subProduct.discount.value}% OFF`
                : `Save ${getCurrencySymbol(size.currency)}${subProduct.discount.value}`,
          };
        }
        // Priority 3: SubProduct sale pricing (salePrice field)
        else if (subProduct.isOnSale && subProduct.salePrice) {
          const now = new Date();
          const saleStart = subProduct.saleStartDate ? new Date(subProduct.saleStartDate) : null;
          const saleEnd = subProduct.saleEndDate ? new Date(subProduct.saleEndDate) : null;
          
          // Check if sale is active based on dates
          const isSaleActive = (!saleStart || now >= saleStart) && (!saleEnd || now <= saleEnd);
          
          if (isSaleActive) {
            hasActiveDiscount = true;
            discountSource = 'sale';
            discountedTenantPrice = subProduct.salePrice;
            
            discountInfo = {
              type: subProduct.saleType || 'fixed',
              value: subProduct.saleDiscountValue || 0,
              originalPrice: sellingPrice,
              savings: sellingPrice - subProduct.salePrice,
              source: 'sale',
              startDate: saleStart,
              endDate: saleEnd,
              label: subProduct.saleType === 'percentage' 
                ? `${subProduct.saleDiscountValue}% OFF`
                : `Sale`,
            };
          }
        }

        // Use discounted price or selling price for tenant price
        const tenantPrice = hasActiveDiscount ? discountedTenantPrice : sellingPrice;

        // Calculate website price (platform adds markup on tenant price)
        // Formula: websitePrice = tenantPrice × (1 + platformMarkupPercentage/100)
        const platformMultiplier = 1 + (platformMarkupPercentage / 100);
        const websitePrice = tenantPrice * platformMultiplier;
        const platformCommission = websitePrice - tenantPrice;

        // Calculate tenant revenue (tenant gets their selling price)
        const tenantRevenue = tenantPrice;

        // Calculate original website price before discount for display
        const originalWebsitePrice = sellingPrice * platformMultiplier;

        // Update discount info with website prices
        if (hasActiveDiscount && discountInfo) {
          discountInfo.originalPrice = originalWebsitePrice;
          discountInfo.savings = originalWebsitePrice - websitePrice;
        }

        return {
          _id: size._id,
          size: size.displayName || size.size,
          volumeMl: size.volumeMl,
          sku: size.sku,
          isDefault: size.isDefault,

          // Stock
          stock: size.availableStock || size.stock || 0,
          availability: size.availability,

          // Pricing Breakdown
          pricing: {
            // Tenant-level prices
            costPrice,
            sellingPrice,
            tenantPrice,

            // Website prices (platform markup applied)
            websitePrice,
            originalWebsitePrice: hasActiveDiscount ? originalWebsitePrice : websitePrice,

            // Revenue breakdown
            platformFee: platformCommission,
            tenantRevenue,
            platformRevenue: platformCommission,

            // Platform markup info
            platformMarkupPercentage,

            // Display prices
            displayPrice: websitePrice.toFixed(2),
            formattedPrice: formatPrice(websitePrice, size.currency || tenant.defaultCurrency || 'NGN'),
            compareAtPrice: size.compareAtPrice
              ? size.compareAtPrice * platformMultiplier
              : null,
            currency: size.currency || tenant.defaultCurrency || 'NGN',
            currencySymbol: getCurrencySymbol(size.currency || tenant.defaultCurrency || 'NGN'),

            // Revenue model info
            revenueModel: 'platform_markup',
          },

          // Discount info (only if active)
          discount: discountInfo,

          // Metadata
          metadata: {
            priceCalculatedAt: new Date(),
            taxIncluded: false,
            discountSource,
          },
        };
      });

       // Find cheapest and most expensive sizes
      const sizePrices = processedSizes.map((s) => s.pricing.websitePrice);
      const minSizePrice = Math.min(...sizePrices);
      const maxSizePrice = Math.max(...sizePrices);

      return {
        _id: subProduct._id,
        sku: subProduct.sku,

        // Tenant info
        tenant: {
          _id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          logo: tenant.logo,
          primaryColor: tenant.primaryColor,
          city: tenant.city,
          state: tenant.state,
          country: tenant.country,
          revenueModel: tenant.revenueModel,
        },

        // Sizes with pricing
        sizes: processedSizes,

        // Price range for this tenant
        priceRange: {
          min: minSizePrice,
          max: maxSizePrice,
          currency: processedSizes[0]?.pricing.currency || 'NGN',
          display:
            minSizePrice === maxSizePrice
              ? `${getCurrencySymbol(processedSizes[0]?.pricing.currency || 'NGN')}${minSizePrice.toFixed(2)}`
              : `${getCurrencySymbol(processedSizes[0]?.pricing.currency || 'NGN')}${minSizePrice.toFixed(2)} - ${getCurrencySymbol(processedSizes[0]?.pricing.currency || 'NGN')}${maxSizePrice.toFixed(2)}`,
        },

        // Stock summary
        totalStock: processedSizes.reduce((sum, s) => sum + s.stock, 0),
        availableSizes: processedSizes.length,

        // Featured
        isFeatured: subProduct.isFeaturedByTenant || false,

        // Sale fields
        isOnSale: subProduct.isOnSale || false,
        salePrice: subProduct.salePrice || null,
        saleStartDate: subProduct.saleStartDate || null,
        saleEndDate: subProduct.saleEndDate || null,
        saleType: subProduct.saleType || null,
        saleDiscountValue: subProduct.saleDiscountValue || null,
      };
    });

    // ===============================
    // Calculate Overall Price Range
    // ===============================
    let globalPriceRange = { min: 0, max: 0, display: '₦0.00', currency: 'NGN' };

    if (processedSubProducts.length) {
      const allPrices = processedSubProducts.flatMap((sp) =>
        sp.sizes.map((size) => ({
          price: size.pricing.websitePrice,
          currency: size.pricing.currency,
        }))
      );

      if (allPrices.length) {
        const priceValues = allPrices.map((p) => p.price);
        const minPrice = Math.min(...priceValues);
        const maxPrice = Math.max(...priceValues);
        const currency = allPrices[0].currency;
        const currencySymbol = getCurrencySymbol(currency);

        globalPriceRange = {
          min: minPrice,
          max: maxPrice,
          currency,
          display:
            minPrice === maxPrice
              ? `${currencySymbol}${minPrice.toFixed(2)}`
              : `${currencySymbol}${minPrice.toFixed(2)} - ${currencySymbol}${maxPrice.toFixed(2)}`,
        };
      }
    }

    // ===============================
    // Calculate Stock Totals
    // ===============================
    const stockInfo = processedSubProducts.reduce(
      (totals, subProduct) => ({
        totalStock: totals.totalStock + subProduct.totalStock,
        availableStock: totals.availableStock + subProduct.totalStock,
        tenants: totals.tenants + 1,
        totalSizes: totals.totalSizes + subProduct.availableSizes,
      }),
      { totalStock: 0, availableStock: 0, tenants: 0, totalSizes: 0 }
    );

    // ===============================
    // Calculate Highest Active Discount
    // ===============================
    let highestDiscount = {
      value: 0,
      type: 'none',
      label: null,
      savings: 0,
    };

    processedSubProducts.forEach((subProduct) => {
      subProduct.sizes.forEach((size) => {
        if (size.discount && size.discount.savings > highestDiscount.savings) {
          highestDiscount = size.discount;
        }
      });
    });

    // ===============================
    // Calculate Availability Status
    // ===============================
    const availability = {
      status: stockInfo.availableStock > 0 ? 'in_stock' : 'out_of_stock',
      stockLevel:
        stockInfo.availableStock > 50
          ? 'high'
          : stockInfo.availableStock > 10
          ? 'medium'
          : stockInfo.availableStock > 0
          ? 'low'
          : 'out',
      availableFrom: stockInfo.tenants,
      message: getAvailabilityMessage(stockInfo),
    };

    // ===============================
    // Calculate Size Variants
    // ===============================
    const sizeVariants = [
      ...new Set(
        processedSubProducts.flatMap((sp) => sp.sizes.map((size) => size.size))
      ),
    ];

    // ===============================
    // Build Display-Ready Product
    // ===============================
    return {
      // Basic Info
      _id: product._id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,
      tagline: product.tagline,

      // Images
      images: product.images || [],
      primaryImage: product.images?.find((img) => img.isPrimary) || product.images?.[0],

      // Classification
      type: product.type,
      subType: product.subType,
      isAlcoholic: product.isAlcoholic,
      abv: product.abv,
      proof: product.proof,
      volume: product.volume,
      volumeMl: product.volumeMl,

      // Origin
      originCountry: product.originCountry,
      region: product.region,
      producer: product.producer,

      // Relations
      brand: product.brand
        ? {
            _id: product.brand._id,
            name: product.brand.name,
            slug: product.brand.slug,
            logo: product.brand.logo,
            countryOfOrigin: product.brand.countryOfOrigin,
            isPremium: product.brand.isPremium,
          }
        : null,
      category: product.category
        ? {
            _id: product.category._id,
            name: product.category.name,
            slug: product.category.slug,
            type: product.category.type,
            icon: product.category.icon,
            color: product.category.color,
            displayName: product.category.displayName,
            tagline: product.category.tagline,
          }
        : null,
      subCategory: product.subCategory
        ? {
            _id: product.subCategory._id,
            name: product.subCategory.name,
            slug: product.subCategory.slug,
            type: product.subCategory.type,
            subType: product.subCategory.subType,
            displayName: product.subCategory.displayName,
            description: product.subCategory.description,
            characteristics: product.subCategory.characteristics,
            typicalFlavors: product.subCategory.typicalFlavors,
            seasonal: product.subCategory.seasonal,
          }
        : null,
      tags: (product.tags || []).map((tag) => ({
        _id: tag._id,
        name: tag.name,
        slug: tag.slug,
        displayName: tag.displayName,
        type: tag.type,
        color: tag.color,
        category: tag.category,
      })),
      flavors: (product.flavors || []).map((flavor) => ({
        _id: flavor._id,
        name: flavor.name,
        value: flavor.value,
        color: flavor.color,
        category: flavor.category,
        intensity: flavor.intensity,
      })),

      // Product Details
      flavorProfile: product.flavorProfile || [],
      tastingNotes: product.tastingNotes,
      servingSuggestions: product.servingSuggestions,
      foodPairings: product.foodPairings || [],
      awards: product.awards || [],
      ingredients: product.ingredients || [],
      allergens: product.allergens || [],
      nutritionalInfo: product.nutritionalInfo,
      isDietary: product.isDietary,

      // Pricing (Global across all tenants)
      priceRange: globalPriceRange,

      // Stock & Availability
      availability,
      stockInfo,

      // Discount
      discount: highestDiscount.value > 0 ? highestDiscount : null,

      // Badge (single highest-priority badge or null)
      badge: assignProductBadge(
        product,
        stockInfo,
        highestDiscount.value > 0 ? highestDiscount : null
      ),

      // Variants
      sizeVariants,
      tenantCount: stockInfo.tenants,

      // Ratings & Sales
      averageRating: product.averageRating || 0,
      reviewCount: product.reviewCount || 0,
      totalSold: product.totalSold || 0,

      // Status & Flags
      isFeatured: product.isFeatured || false,
      requiresAgeVerification: product.requiresAgeVerification || product.isAlcoholic,
      status: product.status,

      // Timestamps
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      publishedAt: product.publishedAt,

      // Available at (with full pricing breakdown)
      availableAt: processedSubProducts,

      // Pricing metadata
      pricingInfo: {
        revenueModels: [...new Set(processedSubProducts.map((sp) => sp.tenant.revenueModel))],
        currenciesAvailable: [
          ...new Set(processedSubProducts.flatMap((sp) => sp.sizes.map((s) => s.pricing.currency))),
        ],
        hasDiscounts: highestDiscount.value > 0,
        lowestPrice: globalPriceRange.min,
        highestPrice: globalPriceRange.max,
      },
    };
  });

  // ============================================================
  // 6. APPLY POST-PROCESSING FILTERS
  // ============================================================
  let filteredProducts = processedProducts;

  // Filter by price range (using website prices)
  if (minPrice || maxPrice) {
    const min = minPrice ? parseFloat(minPrice) : 0;
    const max = maxPrice ? parseFloat(maxPrice) : Infinity;

    filteredProducts = filteredProducts.filter(
      (p) => p.priceRange.min >= min && p.priceRange.max <= max
    );
  }

  // Filter by flavor
  if (flavor) {
    const flavorArray = Array.isArray(flavor) ? flavor : [flavor];
    filteredProducts = filteredProducts.filter((p) =>
      p.flavors.some((f) => flavorArray.includes(f.value) || flavorArray.includes(f._id.toString()))
    );
  }

  // Filter by tag
  if (tag) {
    const tagArray = Array.isArray(tag) ? tag : [tag];
    filteredProducts = filteredProducts.filter((p) =>
      p.tags.some((t) => tagArray.includes(t.slug) || tagArray.includes(t._id.toString()))
    );
  }

  // Filter by trending
  if (trending === 'true') {
    filteredProducts = filteredProducts.filter((p) => p.totalSold > 0);
    filteredProducts.sort((a, b) => b.totalSold - a.totalSold);
  }

  // Filter by on sale
  if (onSale === 'true') {
    filteredProducts = filteredProducts.filter((p) => {
      // Check for discount OR sale pricing
      if (p.discount?.value > 0) return true;
      // Check if any subProduct has active sale
      return p.availableAt?.some(sp => sp.sizes?.some(s => s.discount?.source === 'sale') || sp.isOnSale === true);
    });
  }

  // Filter by new arrivals (last 30 days)
  if (newArrivals === 'true') {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    filteredProducts = filteredProducts.filter((p) => new Date(p.createdAt) >= thirtyDaysAgo);
    filteredProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // ============================================================
  // 7. GET AVAILABLE FILTERS
  // ============================================================
  const availableFilters = await getAvailableFilters(query);

  // ============================================================
  // 8. RETURN RESPONSE
  // ============================================================
  return {
    products: filteredProducts,
    pagination: buildPagination(pageNum, limitNum, totalProducts),
    filters: {
      applied: queryParams,
      available: availableFilters,
    },
    meta: {
      totalProducts,
      displayedProducts: filteredProducts.length,
      hasFilters: Object.keys(queryParams).length > 2,
    },
  };
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get currency symbol
 */
function getCurrencySymbol(currency) {
  const symbols = {
    NGN: '₦',
    USD: '$',
    GBP: '£',
    EUR: '€',
    ZAR: 'R',
  };
  return symbols[currency] || currency;
}

/**
 * Format price with currency
 */
function formatPrice(price, currency) {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${price.toFixed(2)}`;
}

/**
 * Get availability message
 */
function getAvailabilityMessage(stockInfo) {
  if (stockInfo.availableStock === 0) {
    return 'Out of stock';
  }

  if (stockInfo.tenants === 1) {
    return `In stock (${stockInfo.availableStock} available)`;
  }

  return `Available from ${stockInfo.tenants} sellers (${stockInfo.availableStock} total)`;
}


// ============================================================
// BADGE DEFINITIONS & ASSIGNMENT
// ============================================================

/**
 * Master registry of all supported badges.
 * Each entry defines the badge's display name, hex colour, and a
 * numeric priority.  Lower priority wins — only the single highest-
 * priority (lowest number) badge is ever returned for a product.
 *
 * Priority order (1 = shown first):
 *   1. Limited Stock   – scarcity is the strongest purchase trigger
 *   2. On Sale          – active discount is next most urgent
 *   3. New Arrival      – freshness signal for new listings
 *   4. Best Seller      – social-proof badge
 *   5. Top Rated        – quality signal when reviews exist
 *   6. Featured         – editorial/curated pick
 *   7. Trending         – rising interest (weakest default signal)
 */
const BADGE_REGISTRY = {
  limited_stock: { name: 'Limited Stock', color: '#E53E3E', priority: 1 },
  on_sale: { name: 'On Sale', color: '#DD6B20', priority: 2 },
  new_arrival: { name: 'New Arrival', color: '#38A169', priority: 3 },
  best_seller: { name: 'Best Seller', color: '#3182CE', priority: 4 },
  top_rated: { name: 'Top Rated', color: '#805AD5', priority: 5 },
  featured: { name: 'Featured', color: '#D53F8C', priority: 6 },
  trending: { name: 'Trending', color: '#E53E3E', priority: 7 },
};

/**
 * Thresholds that drive badge eligibility.
 * Centralised here so they can be tuned without touching logic.
 */
const BADGE_THRESHOLDS = {
  NEW_ARRIVAL_DAYS: 14,
  TOP_RATED_MIN_REVIEWS: 5,
  TOP_RATED_MIN_RATING: 4.0,
  BEST_SELLER_MIN_SOLD: 50,
  LIMITED_STOCK_MAX: 10,
  TRENDING_MIN_SOLD_30D: 20,
};

/**
 * Determine the single most-relevant badge for a product.
 *
 * Evaluation order mirrors BADGE_REGISTRY priority so that the first
 * match found is guaranteed to be the highest-priority eligible badge.
 *
 * @param {Object}  product         – The fully-processed product object (post-pipeline).
 * @param {Object}  stockInfo       – Aggregated stock totals { totalStock, availableStock, tenants, totalSizes }.
 * @param {Object}  highestDiscount – The best active discount across all sizes { value, type, savings }.
 * @returns {Object|null}           – Badge object { type, name, color } or null if no badge applies.
 */
function assignProductBadge(product, stockInfo, highestDiscount) {
  const now = new Date();
  const candidates = [];

  // ── 1. LIMITED STOCK ─────────────────────────────────────────
  // Fires only when the product IS in stock but units are scarce.
  if (
    stockInfo.availableStock > 0 &&
    stockInfo.availableStock <= BADGE_THRESHOLDS.LIMITED_STOCK_MAX
  ) {
    candidates.push(BADGE_REGISTRY.limited_stock);
  }

  // ── 2. ON SALE ───────────────────────────────────────────────
  // An active discount with a positive savings value qualifies.
  if (highestDiscount && highestDiscount.value > 0 && highestDiscount.savings > 0) {
    candidates.push(BADGE_REGISTRY.on_sale);
  }

  // ── 3. NEW ARRIVAL ───────────────────────────────────────────
  // Product was created within the last NEW_ARRIVAL_DAYS.
  if (product.createdAt) {
    const diffDays = (now - new Date(product.createdAt)) / (1000 * 60 * 60 * 24);
    if (diffDays <= BADGE_THRESHOLDS.NEW_ARRIVAL_DAYS) {
      candidates.push(BADGE_REGISTRY.new_arrival);
    }
  }

  // ── 4. BEST SELLER ───────────────────────────────────────────
  // Minimum total units sold across all tenants.
  if ((product.totalSold || 0) >= BADGE_THRESHOLDS.BEST_SELLER_MIN_SOLD) {
    candidates.push(BADGE_REGISTRY.best_seller);
  }

  // ── 5. TOP RATED ─────────────────────────────────────────────
  // Requires both a minimum review count AND a minimum average rating
  // to avoid rewarding products with just a single 5-star review.
  if (
    (product.reviewCount || 0) >= BADGE_THRESHOLDS.TOP_RATED_MIN_REVIEWS &&
    (product.averageRating || 0) >= BADGE_THRESHOLDS.TOP_RATED_MIN_RATING
  ) {
    candidates.push(BADGE_REGISTRY.top_rated);
  }

  // ── 6. FEATURED ──────────────────────────────────────────────
  // Explicitly flagged by an admin via isFeatured on the Product doc.
  if (product.isFeatured) {
    candidates.push(BADGE_REGISTRY.featured);
  }

  // ── 7. TRENDING ──────────────────────────────────────────────
  // Rising interest: meaningful sales but not yet at Best Seller level.
  // This keeps Trending and Best Seller mutually exclusive at the source.
  if (
    (product.totalSold || 0) >= BADGE_THRESHOLDS.TRENDING_MIN_SOLD_30D &&
    (product.totalSold || 0) < BADGE_THRESHOLDS.BEST_SELLER_MIN_SOLD
  ) {
    candidates.push(BADGE_REGISTRY.trending);
  }

  // ── PICK THE SINGLE HIGHEST-PRIORITY BADGE ───────────────────
  if (candidates.length === 0) return null;

  const winner = candidates.reduce(
    (best, badge) => (badge.priority < best.priority ? badge : best)
  );

  // Resolve the type key from the registry
  const type = Object.keys(BADGE_REGISTRY).find(
    (key) => BADGE_REGISTRY[key] === winner
  );

  return { type, name: winner.name, color: winner.color };
}





/**
 * Get featured products
 */
const getFeaturedProducts = async (page = 1, limit = 12) => {
  const pageNum = Math.max(1, page);
  const limitNum = Math.min(Math.max(1, limit), 50);
  const skip = (pageNum - 1) * limitNum;

  // Query for featured products (you can define "featured" logic)
  // For now, using recent bestsellers
  const totalPromise = Product.countDocuments({ status: 'approved' });

  const products = await Product.aggregate([
    { $match: { status: 'approved' } },

    // Lookup active SubProducts
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
                    availability: { $in: ['available', 'low_stock'] },
                    stock: { $gt: 0 },
                  },
                },
              ],
            },
          },
        ],
        as: 'subProducts',
      },
    },

    // Only products with availability
    {
      $match: {
        $expr: { $gt: [{ $size: '$subProducts' }, 0] },
      },
    },

    // Populate relations
    {
      $lookup: {
        from: 'brands',
        localField: 'brand',
        foreignField: '_id',
        as: 'brand',
      },
    },
    { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },

    // Sort by tenantCount (most available) and recent
    { $sort: { tenantCount: -1, createdAt: -1 } },

    { $skip: skip },
    { $limit: limitNum },
  ]);

  const total = await totalPromise;

  // Process products
  const tenantIds = [
    ...new Set(
      products.flatMap((p) =>
        (p.subProducts || []).map((sp) => sp.tenant._id.toString())
      )
    ),
  ];

  const tenants = await Tenant.find({ _id: { $in: tenantIds } })
    .select(
      'revenueModel markupPercentage commissionPercentage defaultCurrency name slug logo'
    )
    .lean();

  const tenantMap = tenants.reduce((map, tenant) => {
    map[tenant._id.toString()] = tenant;
    return map;
  }, {});

  const productIds = products.map((p) => p._id);
  const [ratings, sales] = await Promise.all([
    getProductsRatings(productIds),
    getProductsSales(productIds),
  ]);

  const processedProducts = await Promise.all(
    products.map(async (product) =>
      processProductForDisplay(
        product,
        tenantMap,
        ratings[product._id.toString()] || { average: 0, count: 0 },
        sales[product._id.toString()] || 0
      )
    )
  );

  return {
    products: processedProducts,
    pagination: buildPagination(pageNum, limitNum, total),
  };
};

/**
 * Get new arrivals
 */
const getNewArrivals = async (page = 1, limit = 12, days = 30) => {
  const pageNum = Math.max(1, page);
  const limitNum = Math.min(Math.max(1, limit), 50);
  const skip = (pageNum - 1) * limitNum;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Helper functions (same as in getAllProducts)
  const getCurrencySymbol = (currency) => {
    const symbols = { NGN: '₦', USD: '$', GBP: '£', EUR: '€', ZAR: 'R' };
    return symbols[currency] || currency;
  };

  const formatPrice = (price, currency) => {
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${price.toFixed(2)}`;
  };

  const getAvailabilityMessage = (stockInfo) => {
    if (stockInfo.availableStock === 0) return 'Currently out of stock';
    if (stockInfo.tenants === 1) return `Available from ${stockInfo.tenants} vendor`;
    return `Available from ${stockInfo.tenants} vendors`;
  };

  const assignProductBadge = (product, stockInfo, discount) => {
    if (discount?.value > 0) return { type: 'sale', name: 'SALE', color: '#ef4444' };
    
    const isNew = product.createdAt && new Date(product.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (isNew) return { type: 'new', name: 'NEW', color: '#10B981' };
    
    if (product.isFeatured) return { type: 'featured', name: 'FEATURED', color: '#8b5cf6' };
    
    return null;
  };

  const query = {
    status: 'approved',
    publishedAt: { $gte: cutoffDate },
  };

  const totalPromise = Product.countDocuments(query);

  const products = await Product.aggregate([
    { $match: query },

    // Lookup active SubProducts
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
                    availability: { $in: ['available', 'low_stock'] },
                    stock: { $gt: 0 },
                  },
                },
              ],
            },
          },
        ],
        as: 'subProducts',
      },
    },

    // Populate relations
    {
      $lookup: {
        from: 'brands',
        localField: 'brand',
        foreignField: '_id',
        as: 'brand',
      },
    },
    { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },

    { $sort: { publishedAt: -1, createdAt: -1 } },
    { $skip: skip },
    { $limit: limitNum },
  ]);

  const total = await totalPromise;

  // Process products (same as featured)
  const tenantIds = [
    ...new Set(
      products.flatMap((p) =>
        (p.subProducts || []).map((sp) => sp.tenant._id.toString())
      )
    ),
  ];

  const tenants = await Tenant.find({ _id: { $in: tenantIds } })
    .select(
      'revenueModel markupPercentage commissionPercentage defaultCurrency name slug logo'
    )
    .lean();

  const tenantMap = tenants.reduce((map, tenant) => {
    map[tenant._id.toString()] = tenant;
    return map;
  }, {});

  const productIds = products.map((p) => p._id);
  const [ratings, sales] = await Promise.all([
    getProductsRatings(productIds),
    getProductsSales(productIds),
  ]);

  const processedProducts = await Promise.all(
    products.map(async (product) =>
      processProductForDisplay(
        product,
        tenantMap,
        ratings[product._id.toString()] || { average: 0, count: 0 },
        sales[product._id.toString()] || 0
      )
    )
  );

  return {
    products: processedProducts,
    pagination: buildPagination(pageNum, limitNum, total),
  };
};

/**
 * Get bestsellers
 */
const getBestsellers = async (page = 1, limit = 12) => {
  const pageNum = Math.max(1, page);
  const limitNum = Math.min(Math.max(1, limit), 50);
  const skip = (pageNum - 1) * limitNum;

  // Get top-selling product IDs
  const topSellers = await Sales.aggregate([
    {
      $match: {
        fulfillmentStatus: { $in: ['fulfilled', 'delivered'] },
      },
    },
    {
      $group: {
        _id: '$product',
        totalSold: { $sum: '$quantity' },
      },
    },
    { $sort: { totalSold: -1 } },
    { $skip: skip },
    { $limit: limitNum },
  ]);

  if (!topSellers.length) {
    return {
      products: [],
      pagination: buildPagination(pageNum, limitNum, 0),
    };
  }

  const productIds = topSellers.map((ts) => ts._id);

  const products = await Product.aggregate([
    {
      $match: {
        _id: { $in: productIds },
        status: 'approved',
      },
    },

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
            },
          },
        ],
        as: 'subProducts',
      },
    },

    // Populate relations
    {
      $lookup: {
        from: 'brands',
        localField: 'brand',
        foreignField: '_id',
        as: 'brand',
      },
    },
    { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
  ]);

  // Sort products by sales count
  const salesMap = topSellers.reduce((map, ts) => {
    map[ts._id.toString()] = ts.totalSold;
    return map;
  }, {});

  products.sort(
    (a, b) =>
      salesMap[b._id.toString()] - salesMap[a._id.toString()]
  );

  // Process products
  const tenantIds = [
    ...new Set(
      products.flatMap((p) =>
        (p.subProducts || []).map((sp) => sp.tenant._id.toString())
      )
    ),
  ];

  const tenants = await Tenant.find({ _id: { $in: tenantIds } })
    .select(
      'revenueModel markupPercentage commissionPercentage defaultCurrency name slug logo'
    )
    .lean();

  const tenantMap = tenants.reduce((map, tenant) => {
    map[tenant._id.toString()] = tenant;
    return map;
  }, {});

  const ratings = await getProductsRatings(productIds);

  // Apply the same comprehensive pricing processing as getAllProducts
  const processedProducts = products.map((product) => {
    // Rename subProducts to activeSubProducts for compatibility
    product.activeSubProducts = product.subProducts || [];
    
    // Process SubProducts with Website Pricing (same logic as getAllProducts)
    const processedSubProducts = (product.activeSubProducts || []).map((subProduct) => {
      const tenant = subProduct.tenant;
      const revenueModel = tenant.revenueModel || 'markup';
      const tenantMarkupPercentage = tenant.markupPercentage || 20;
      const platformMarkupPercentage = 15; // Platform markup on top of tenant price

      // Process each size with website pricing
      const processedSizes = (subProduct.sizes || []).map((size) => {
        // Base prices
        const sellingPrice = size.sellingPrice || 0;
        const costPrice = size.costPrice || subProduct.costPrice || 0;

        // Calculate discount based on actual discount fields
        let hasActiveDiscount = false;
        let discountedTenantPrice = sellingPrice;
        let discountInfo = null;
        let discountSource = null;

        // Helper: Check if discount is active
        const checkDiscountActive = (discount) => {
          if (!discount || !discount.value || !discount.type) return false;
          const now = new Date();
          const discountStart = discount.startDate || discount.discountStart;
          const discountEnd = discount.endDate || discount.discountEnd;
          if (discountStart && now < new Date(discountStart)) return false;
          if (discountEnd && now > new Date(discountEnd)) return false;
          return true;
        };

        // Helper: Calculate discounted price
        const calculateDiscountedPrice = (basePrice, discount) => {
          if (discount.type === 'percentage') {
            const discountAmount = (basePrice * discount.value) / 100;
            return Math.max(0, basePrice - discountAmount);
          } else if (discount.type === 'fixed') {
            return Math.max(0, basePrice - discount.value);
          }
          return basePrice;
        };

        // Priority 1: Size-level discount
        if (size.discount && checkDiscountActive(size.discount)) {
          hasActiveDiscount = true;
          discountSource = 'size';
          discountedTenantPrice = calculateDiscountedPrice(sellingPrice, size.discount);
          discountInfo = {
            type: size.discount.type,
            value: size.discount.value,
            originalPrice: sellingPrice,
            savings: sellingPrice - discountedTenantPrice,
            source: 'size',
            startDate: size.discount.startDate || size.discount.discountStart,
            endDate: size.discount.endDate || size.discount.discountEnd,
            label: size.discount.type === 'percentage'
              ? `${size.discount.value}% OFF`
              : `Save ${getCurrencySymbol(size.currency)}${size.discount.value}`,
          };
        }
        // Priority 2: SubProduct-level discount
        else if (subProduct.discount && checkDiscountActive(subProduct.discount)) {
          hasActiveDiscount = true;
          discountSource = 'subproduct';
          discountedTenantPrice = calculateDiscountedPrice(sellingPrice, subProduct.discount);
          discountInfo = {
            type: subProduct.discount.type || subProduct.discountType,
            value: subProduct.discount.value,
            originalPrice: sellingPrice,
            savings: sellingPrice - discountedTenantPrice,
            source: 'subproduct',
            startDate: subProduct.discount.startDate || subProduct.discountStart,
            endDate: subProduct.discount.endDate || subProduct.discountEnd,
            label: (subProduct.discount.type || subProduct.discountType) === 'percentage'
              ? `${subProduct.discount.value}% OFF`
              : `Save ${getCurrencySymbol(size.currency)}${subProduct.discount.value}`,
          };
        }
        // Priority 3: SubProduct sale pricing (salePrice field)
        else if (subProduct.isOnSale && subProduct.salePrice) {
          const now = new Date();
          const saleStart = subProduct.saleStartDate ? new Date(subProduct.saleStartDate) : null;
          const saleEnd = subProduct.saleEndDate ? new Date(subProduct.saleEndDate) : null;
          
          const isSaleActive = (!saleStart || now >= saleStart) && (!saleEnd || now <= saleEnd);
          
          if (isSaleActive) {
            hasActiveDiscount = true;
            discountSource = 'sale';
            discountedTenantPrice = subProduct.salePrice;
            
            discountInfo = {
              type: subProduct.saleType || 'fixed',
              value: subProduct.saleDiscountValue || 0,
              originalPrice: sellingPrice,
              savings: sellingPrice - subProduct.salePrice,
              source: 'sale',
              startDate: saleStart,
              endDate: saleEnd,
              label: subProduct.saleType === 'percentage' 
                ? `${subProduct.saleDiscountValue}% OFF`
                : `Sale`,
            };
          }
        }

        // Use discounted price or selling price for tenant price
        const tenantPrice = hasActiveDiscount ? discountedTenantPrice : sellingPrice;

        // Calculate website price (platform adds markup on tenant price)
        const platformMultiplier = 1 + (platformMarkupPercentage / 100);
        const websitePrice = tenantPrice * platformMultiplier;
        const platformCommission = websitePrice - tenantPrice;
        const tenantRevenue = tenantPrice;
        const originalWebsitePrice = sellingPrice * platformMultiplier;

        // Update discount info with website prices
        if (hasActiveDiscount && discountInfo) {
          discountInfo.originalPrice = originalWebsitePrice;
          discountInfo.savings = originalWebsitePrice - websitePrice;
        }

        return {
          _id: size._id,
          size: size.displayName || size.size,
          volumeMl: size.volumeMl,
          sku: size.sku,
          isDefault: size.isDefault,
          stock: size.availableStock || size.stock || 0,
          availability: size.availability,
          pricing: {
            costPrice,
            sellingPrice,
            tenantPrice,
            websitePrice,
            originalWebsitePrice: hasActiveDiscount ? originalWebsitePrice : websitePrice,
            platformFee: platformCommission,
            tenantRevenue,
            platformRevenue: platformCommission,
            platformMarkupPercentage,
            displayPrice: websitePrice.toFixed(2),
            formattedPrice: formatPrice(websitePrice, size.currency || tenant.defaultCurrency || 'NGN'),
            compareAtPrice: size.compareAtPrice ? size.compareAtPrice * platformMultiplier : null,
            currency: size.currency || tenant.defaultCurrency || 'NGN',
            currencySymbol: getCurrencySymbol(size.currency || tenant.defaultCurrency || 'NGN'),
            revenueModel: 'platform_markup',
          },
          discount: discountInfo,
          metadata: {
            priceCalculatedAt: new Date(),
            taxIncluded: false,
            discountSource,
          },
        };
      });

      // Find cheapest and most expensive sizes
      const sizePrices = processedSizes.map((s) => s.pricing.websitePrice);
      const minSizePrice = Math.min(...sizePrices);
      const maxSizePrice = Math.max(...sizePrices);

      return {
        _id: subProduct._id,
        sku: subProduct.sku,
        tenant: {
          _id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          logo: tenant.logo,
          primaryColor: tenant.primaryColor,
          city: tenant.city,
          state: tenant.state,
          country: tenant.country,
          revenueModel: tenant.revenueModel,
        },
        sizes: processedSizes,
        priceRange: {
          min: minSizePrice,
          max: maxSizePrice,
          currency: processedSizes[0]?.pricing.currency || 'NGN',
          display: minSizePrice === maxSizePrice
            ? `${getCurrencySymbol(processedSizes[0]?.pricing.currency || 'NGN')}${minSizePrice.toFixed(2)}`
            : `${getCurrencySymbol(processedSizes[0]?.pricing.currency || 'NGN')}${minSizePrice.toFixed(2)} - ${getCurrencySymbol(processedSizes[0]?.pricing.currency || 'NGN')}${maxSizePrice.toFixed(2)}`,
        },
        totalStock: processedSizes.reduce((sum, s) => sum + s.stock, 0),
        availableSizes: processedSizes.length,
        isFeatured: subProduct.isFeaturedByTenant || false,
        isOnSale: subProduct.isOnSale || false,
        salePrice: subProduct.salePrice || null,
        saleStartDate: subProduct.saleStartDate || null,
        saleEndDate: subProduct.saleEndDate || null,
        saleType: subProduct.saleType || null,
        saleDiscountValue: subProduct.saleDiscountValue || null,
      };
    });

    // Calculate Overall Price Range
    let globalPriceRange = { min: 0, max: 0, display: '₦0.00', currency: 'NGN' };

    if (processedSubProducts.length) {
      const allPrices = processedSubProducts.flatMap((sp) =>
        sp.sizes.map((size) => ({
          price: size.pricing.websitePrice,
          currency: size.pricing.currency,
        }))
      );

      if (allPrices.length) {
        const priceValues = allPrices.map((p) => p.price);
        const minPrice = Math.min(...priceValues);
        const maxPrice = Math.max(...priceValues);
        const currency = allPrices[0].currency;
        const currencySymbol = getCurrencySymbol(currency);

        globalPriceRange = {
          min: minPrice,
          max: maxPrice,
          currency,
          display: minPrice === maxPrice
            ? `${currencySymbol}${minPrice.toFixed(2)}`
            : `${currencySymbol}${minPrice.toFixed(2)} - ${currencySymbol}${maxPrice.toFixed(2)}`,
        };
      }
    }

    // Calculate Stock Totals
    const stockInfo = processedSubProducts.reduce(
      (totals, subProduct) => ({
        totalStock: totals.totalStock + subProduct.totalStock,
        availableStock: totals.availableStock + subProduct.totalStock,
        tenants: totals.tenants + 1,
        totalSizes: totals.totalSizes + subProduct.availableSizes,
      }),
      { totalStock: 0, availableStock: 0, tenants: 0, totalSizes: 0 }
    );

    // Calculate Highest Active Discount
    let highestDiscount = { value: 0, type: 'none', label: null, savings: 0 };
    processedSubProducts.forEach((subProduct) => {
      subProduct.sizes.forEach((size) => {
        if (size.discount && size.discount.savings > highestDiscount.savings) {
          highestDiscount = size.discount;
        }
      });
    });

    // Calculate Availability Status
    const availability = {
      status: stockInfo.availableStock > 0 ? 'in_stock' : 'out_of_stock',
      stockLevel: stockInfo.availableStock > 50 ? 'high' : 
                  stockInfo.availableStock > 10 ? 'medium' : 
                  stockInfo.availableStock > 0 ? 'low' : 'out',
      availableFrom: stockInfo.tenants,
      message: getAvailabilityMessage(stockInfo),
      totalStock: stockInfo.totalStock,
      inStock: stockInfo.availableStock > 0,
    };

    // Build Display-Ready Product (same as getAllProducts)
    return {
      _id: product._id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,
      tagline: product.tagline,
      images: product.images || [],
      primaryImage: product.images?.find((img) => img.isPrimary) || product.images?.[0],
      type: product.type,
      subType: product.subType,
      isAlcoholic: product.isAlcoholic,
      abv: product.abv,
      proof: product.proof,
      volume: product.volume,
      volumeMl: product.volumeMl,
      originCountry: product.originCountry,
      region: product.region,
      producer: product.producer,
      brand: product.brand ? {
        _id: product.brand._id,
        name: product.brand.name,
        slug: product.brand.slug,
        logo: product.brand.logo,
        countryOfOrigin: product.brand.countryOfOrigin,
        isPremium: product.brand.isPremium,
      } : null,
      category: product.category ? {
        _id: product.category._id,
        name: product.category.name,
        slug: product.category.slug,
        type: product.category.type,
        icon: product.category.icon,
        color: product.category.color,
        displayName: product.category.displayName,
        tagline: product.category.tagline,
      } : null,
      subCategory: product.subCategory ? {
        _id: product.subCategory._id,
        name: product.subCategory.name,
        slug: product.subCategory.slug,
        type: product.subCategory.type,
        subType: product.subCategory.subType,
        displayName: product.subCategory.displayName,
        description: product.subCategory.description,
        characteristics: product.subCategory.characteristics,
        typicalFlavors: product.subCategory.typicalFlavors,
        seasonal: product.subCategory.seasonal,
      } : null,
      tags: (product.tags || []).map((tag) => ({
        _id: tag._id,
        name: tag.name,
        slug: tag.slug,
        displayName: tag.displayName,
        type: tag.type,
        color: tag.color,
        category: tag.category,
      })),
      flavors: (product.flavors || []).map((flavor) => ({
        _id: flavor._id,
        name: flavor.name,
        value: flavor.value,
        color: flavor.color,
        category: flavor.category,
        intensity: flavor.intensity,
      })),
      priceRange: globalPriceRange,
      availability,
      stockInfo,
      discount: highestDiscount.value > 0 ? highestDiscount : null,
      badge: assignProductBadge(product, stockInfo, highestDiscount.value > 0 ? highestDiscount : null),
      sizeVariants: [...new Set(processedSubProducts.flatMap((sp) => sp.sizes.map((size) => size.size)))],
      tenantCount: stockInfo.tenants,
      averageRating: ratings[product._id.toString()]?.average || 0,
      reviewCount: ratings[product._id.toString()]?.count || 0,
      totalSold: sales[product._id.toString()] || 0,
      isFeatured: product.isFeatured || false,
      requiresAgeVerification: product.requiresAgeVerification || product.isAlcoholic,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      publishedAt: product.publishedAt,
      availableAt: processedSubProducts,
      pricingInfo: {
        revenueModels: [...new Set(processedSubProducts.map((sp) => sp.tenant.revenueModel))],
        currenciesAvailable: [...new Set(processedSubProducts.flatMap((sp) => sp.sizes.map((s) => s.pricing.currency)))],
        hasDiscounts: highestDiscount.value > 0,
        lowestPrice: globalPriceRange.min,
        highestPrice: globalPriceRange.max,
      },
    };
  });

  // Get total count of bestsellers
  const totalCount = await Sales.aggregate([
    {
      $match: {
        fulfillmentStatus: { $in: ['fulfilled', 'delivered'] },
      },
    },
    {
      $group: {
        _id: '$product',
      },
    },
    { $count: 'total' },
  ]);

  const total = totalCount[0]?.total || 0;

  return {
    products: processedProducts,
    pagination: buildPagination(pageNum, limitNum, total),
  };
};


/**
 * Get product by slug with full details, pricing, and availability.
 * Returns a comprehensive product object ready for display on a product detail page.
 * 
 * @param {string} slug - Product slug
 * @returns {Promise<Object>} Fully processed product with vendors, pricing, reviews, and badge
 * @throws {NotFoundError} If product doesn't exist or is unavailable
 */
const getProductBySlug = async (slug) => {
  // ══════════════════════════════════════════════════════════════════════════
  // 1. FETCH BASE PRODUCT
  // ══════════════════════════════════════════════════════════════════════════
  const product = await Product.findOne({ slug, status: 'approved' })
    .populate('brand', 'name slug logo description website countryOfOrigin verified')
    .populate('category', 'name slug type description icon')
    .populate('subCategory', 'name slug subType description')
    .populate('tags', 'name slug type color description')
    .populate('flavors', 'name value color description')
    .lean();

  console.log(product);
  if (!product) {
    throw new NotFoundError(`Product with slug "${slug}" not found`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. FETCH ACTIVE SUBPRODUCTS WITH TENANTS & SIZES
  // ══════════════════════════════════════════════════════════════════════════
  const subProducts = await SubProduct.find({
    product: product._id,
    status: 'active',
  })
    .populate({
      path: 'tenant',
      match: {
        status: 'approved',
        subscriptionStatus: { $in: ['active', 'trialing'] },
      },
      select:
        'name slug logo primaryColor revenueModel markupPercentage commissionPercentage defaultCurrency country city state',
    })
    .populate({
      path: 'sizes',
      match: {
        status: 'active',
        availability: { $in: ['available', 'in_stock', 'low_stock', 'pre_order', 'limited_stock'] },
      },
      select:
        'size displayName sellingPrice costPrice discountedPrice compareAtPrice stock availableStock availability currency discount discountValue discountType discountStart discountEnd lowStockThreshold sku barcode weightGrams volumeMl minOrderQuantity maxOrderQuantity isDefault',
    })
    .select(
      'tenant sku baseSellingPrice costPrice currency discount discountType discountedPrice discountStart discountEnd sizes shortDescriptionOverride imagesOverride status totalSold totalRevenue isFeaturedByTenant'
    )
    .lean();

  // Filter out SubProducts with no active tenant or no available sizes
  const activeSubProducts = subProducts.filter(
    (sp) => sp.tenant && sp.sizes && sp.sizes.length > 0
  );

  if (activeSubProducts.length === 0) {
    throw new NotFoundError(
      'Product is not currently available from any seller'
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. BUILD TENANT MAP FOR REVENUE CALCULATIONS
  // ══════════════════════════════════════════════════════════════════════════
  const tenantIds = activeSubProducts.map((sp) => sp.tenant._id.toString());
  const tenants = await Tenant.find({ _id: { $in: tenantIds } })
    .select(
      'revenueModel markupPercentage commissionPercentage defaultCurrency name slug logo city state country'
    )
    .lean();

  const tenantMap = tenants.reduce((map, tenant) => {
    map[tenant._id.toString()] = tenant;
    return map;
  }, {});

  // ══════════════════════════════════════════════════════════════════════════
  // 4. FETCH RATINGS, SALES, AND REVIEWS IN PARALLEL
  // ══════════════════════════════════════════════════════════════════════════
  const [ratingsData, salesData, reviewsPreview, topReviews] = await Promise.all([
    getProductRatings(product._id),
    getProductSales(product._id),
    getReviewsPreview(product._id, 5), // 5 most recent reviews
    Review.find({ product: product._id, status: 'approved' })
      .sort({ helpful: -1, createdAt: -1 })
      .limit(3)
      .populate('user', 'firstName lastName avatar')
      .select('rating title comment helpful verifiedPurchase createdAt user images')
      .lean(),
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // 5. PROCESS SUBPRODUCTS WITH WEBSITE PRICING
  // ══════════════════════════════════════════════════════════════════════════
  const processedSubProducts = activeSubProducts.map((subProduct) => {
    const tenant = subProduct.tenant;
    const revenueModel = tenant.revenueModel || 'markup';
    const markupPercentage = tenant.markupPercentage || 40;
    const commissionPercentage = tenant.commissionPercentage || 10;

    // Process each size with website pricing
    const processedSizes = (subProduct.sizes || []).map((size) => {
      const sellingPrice = size.sellingPrice || 0;
      const costPrice = size.costPrice || subProduct.costPrice || 0;
      const discountedPrice = size.discountedPrice;

      // Determine effective tenant price
      let tenantPrice = discountedPrice || sellingPrice;

      // Calculate website price based on revenue model
      let websitePrice = tenantPrice;
      let platformFee = 0;

      if (revenueModel === 'commission') {
        platformFee = (tenantPrice * commissionPercentage) / 100;
        websitePrice = tenantPrice + platformFee;
      }

      // Calculate discount info
      let discountInfo = null;
      if (size.discount?.value && isDiscountActive(size.discount)) {
        const originalWebsitePrice =
          revenueModel === 'commission'
            ? sellingPrice + (sellingPrice * commissionPercentage) / 100
            : sellingPrice;

        discountInfo = {
          type: size.discount.type || 'percentage',
          value: size.discount.value,
          savings: originalWebsitePrice - websitePrice,
          originalPrice: originalWebsitePrice,
          label:
            size.discount.type === 'percentage'
              ? `${size.discount.value}% OFF`
              : `Save ${getCurrencySymbol(size.currency)}${size.discount.value}`,
        };
      }

      return {
        _id: size._id,
        size: size.displayName || size.size,
        volumeMl: size.volumeMl,
        weightGrams: size.weightGrams,
        sku: size.sku,
        barcode: size.barcode,
        isDefault: size.isDefault,

        // Stock
        stock: size.availableStock || size.stock || 0,
        availability: size.availability,
        lowStockThreshold: size.lowStockThreshold,
        isLowStock: size.stock > 0 && size.stock <= (size.lowStockThreshold || 5),

        // Order constraints
        minOrderQuantity: size.minOrderQuantity || 1,
        maxOrderQuantity: size.maxOrderQuantity,

        // Pricing breakdown
        pricing: {
          costPrice,
          sellingPrice,
          tenantPrice,
          websitePrice,
          originalWebsitePrice: discountInfo?.originalPrice || websitePrice,
          platformFee,
          displayPrice: websitePrice.toFixed(2),
          compareAtPrice: size.compareAtPrice
            ? (
              revenueModel === 'commission'
                ? size.compareAtPrice + (size.compareAtPrice * commissionPercentage) / 100
                : size.compareAtPrice
            ).toFixed(2)
            : null,
          currency: size.currency || tenant.defaultCurrency || 'NGN',
          currencySymbol: getCurrencySymbol(
            size.currency || tenant.defaultCurrency || 'NGN'
          ),
          revenueModel,
          ...(revenueModel === 'markup' && { markupPercentage }),
          ...(revenueModel === 'commission' && { commissionPercentage }),
        },

        // Discount
        discount: discountInfo,
      };
    });

    // Find price range for this vendor
    const sizePrices = processedSizes.map((s) => s.pricing.websitePrice);
    const minSizePrice = Math.min(...sizePrices);
    const maxSizePrice = Math.max(...sizePrices);

    return {
      _id: subProduct._id,
      sku: subProduct.sku,

      // Tenant info
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        logo: tenant.logo,
        primaryColor: tenant.primaryColor,
        city: tenant.city,
        state: tenant.state,
        country: tenant.country,
        revenueModel: tenant.revenueModel,
      },

      // Sizes with pricing
      sizes: processedSizes,

      // Price range for this tenant
      priceRange: {
        min: minSizePrice,
        max: maxSizePrice,
        currency: processedSizes[0]?.pricing.currency || 'NGN',
        display:
          minSizePrice === maxSizePrice
            ? `${getCurrencySymbol(processedSizes[0]?.pricing.currency || 'NGN')}${minSizePrice.toFixed(2)}`
            : `${getCurrencySymbol(processedSizes[0]?.pricing.currency || 'NGN')}${minSizePrice.toFixed(2)} - ${getCurrencySymbol(processedSizes[0]?.pricing.currency || 'NGN')}${maxSizePrice.toFixed(2)}`,
      },

      // Stock summary
      totalStock: processedSizes.reduce((sum, s) => sum + s.stock, 0),
      availableSizes: processedSizes.length,

      // Overrides
      shortDescriptionOverride: subProduct.shortDescriptionOverride,
      imagesOverride: subProduct.imagesOverride,

      // Featured
      isFeatured: subProduct.isFeaturedByTenant || false,

      // Stats
      totalSold: subProduct.totalSold || 0,
      totalRevenue: subProduct.totalRevenue || 0,
    };
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 6. CALCULATE GLOBAL PRICE RANGE & STOCK INFO
  // ══════════════════════════════════════════════════════════════════════════
  let globalPriceRange = { min: 0, max: 0, display: '₦0.00', currency: 'NGN' };

  if (processedSubProducts.length) {
    const allPrices = processedSubProducts.flatMap((sp) =>
      sp.sizes.map((size) => ({
        price: size.pricing.websitePrice,
        currency: size.pricing.currency,
      }))
    );

    if (allPrices.length) {
      const priceValues = allPrices.map((p) => p.price);
      const minPrice = Math.min(...priceValues);
      const maxPrice = Math.max(...priceValues);
      const currency = allPrices[0].currency;
      const currencySymbol = getCurrencySymbol(currency);

      globalPriceRange = {
        min: minPrice,
        max: maxPrice,
        currency,
        display:
          minPrice === maxPrice
            ? `${currencySymbol}${minPrice.toFixed(2)}`
            : `${currencySymbol}${minPrice.toFixed(2)} - ${currencySymbol}${maxPrice.toFixed(2)}`,
      };
    }
  }

  const stockInfo = processedSubProducts.reduce(
    (totals, subProduct) => ({
      totalStock: totals.totalStock + subProduct.totalStock,
      availableStock: totals.availableStock + subProduct.totalStock,
      tenants: totals.tenants + 1,
      totalSizes: totals.totalSizes + subProduct.availableSizes,
    }),
    { totalStock: 0, availableStock: 0, tenants: 0, totalSizes: 0 }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 7. CALCULATE HIGHEST ACTIVE DISCOUNT
  // ══════════════════════════════════════════════════════════════════════════
  let highestDiscount = {
    value: 0,
    type: 'none',
    label: null,
    savings: 0,
  };

  processedSubProducts.forEach((subProduct) => {
    subProduct.sizes.forEach((size) => {
      if (size.discount && size.discount.savings > highestDiscount.savings) {
        highestDiscount = size.discount;
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 8. CALCULATE AVAILABILITY STATUS
  // ══════════════════════════════════════════════════════════════════════════
  const availability = {
    status: stockInfo.availableStock > 0 ? 'in_stock' : 'out_of_stock',
    stockLevel:
      stockInfo.availableStock > 50
        ? 'high'
        : stockInfo.availableStock > 10
          ? 'medium'
          : stockInfo.availableStock > 0
            ? 'low'
            : 'out',
    availableFrom: stockInfo.tenants,
    message: getAvailabilityMessage(stockInfo),
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 9. CALCULATE SIZE VARIANTS AVAILABLE
  // ══════════════════════════════════════════════════════════════════════════
  const sizeVariants = [
    ...new Set(
      processedSubProducts.flatMap((sp) => sp.sizes.map((size) => size.size))
    ),
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // 10. ASSIGN PRODUCT BADGE
  // ══════════════════════════════════════════════════════════════════════════
  const badge = assignProductBadge(
    product,
    stockInfo,
    highestDiscount.value > 0 ? highestDiscount : null
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 11. GET RATING DISTRIBUTION FOR DETAIL VIEW
  // ══════════════════════════════════════════════════════════════════════════
  const ratingDistribution = await Review.aggregate([
    { $match: { product: product._id, status: 'approved' } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  const distributionMap = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  ratingDistribution.forEach((item) => {
    distributionMap[item._id] = item.count;
  });

  const totalReviews = Object.values(distributionMap).reduce((a, b) => a + b, 0);
  const ratingBreakdown = Object.entries(distributionMap).map(([stars, count]) => ({
    stars: parseInt(stars),
    count,
    percentage: totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0,
  }));

  // ══════════════════════════════════════════════════════════════════════════
  // 12. BUILD COMPREHENSIVE PRODUCT RESPONSE
  // ══════════════════════════════════════════════════════════════════════════
  return {
    // ─── Basic Info ────────────────────────────────────────────────────────
    _id: product._id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    description: product.description,
    tagline: product.tagline,

    // ─── Images ────────────────────────────────────────────────────────────
    images: product.images || [],
    primaryImage: product.images?.find((img) => img.isPrimary) || product.images?.[0],
    videos: product.videos || [],

    // ─── Classification ────────────────────────────────────────────────────
    type: product.type,
    subType: product.subType,
    isAlcoholic: product.isAlcoholic,
    abv: product.abv,
    proof: product.proof,
    volume: product.volume,
    volumeMl: product.volumeMl,

    // ─── Origin ────────────────────────────────────────────────────────────
    originCountry: product.originCountry,
    region: product.region,
    producer: product.producer,
    vintage: product.vintage,
    age: product.age,

    // ─── Relations ─────────────────────────────────────────────────────────
    brand: product.brand
      ? {
        _id: product.brand._id,
        name: product.brand.name,
        slug: product.brand.slug,
        logo: product.brand.logo,
        description: product.brand.description,
        website: product.brand.website,
        countryOfOrigin: product.brand.countryOfOrigin,
        verified: product.brand.verified,
      }
      : null,
    category: product.category
      ? {
        _id: product.category._id,
        name: product.category.name,
        slug: product.category.slug,
        type: product.category.type,
        description: product.category.description,
        icon: product.category.icon,
      }
      : null,
    subCategory: product.subCategory
      ? {
        _id: product.subCategory._id,
        name: product.subCategory.name,
        slug: product.subCategory.slug,
        subType: product.subCategory.subType,
        description: product.subCategory.description,
      }
      : null,
    tags: (product.tags || []).map((tag) => ({
      _id: tag._id,
      name: tag.name,
      slug: tag.slug,
      type: tag.type,
      color: tag.color,
      description: tag.description,
    })),
    flavors: (product.flavors || []).map((flavor) => ({
      _id: flavor._id,
      name: flavor.name,
      value: flavor.value,
      color: flavor.color,
      description: flavor.description,
    })),
    flavorProfile: product.flavorProfile || [],

    // ─── Product Details ───────────────────────────────────────────────────
    tastingNotes: product.tastingNotes,
    servingSuggestions: product.servingSuggestions,
    foodPairings: product.foodPairings || [],
    awards: product.awards || [],
    certifications: product.certifications || [],
    ratings: product.ratings,

    // ─── Ingredients & Dietary ─────────────────────────────────────────────
    ingredients: product.ingredients || [],
    allergens: product.allergens || [],
    nutritionalInfo: product.nutritionalInfo,
    isDietary: product.isDietary || {},

    // ─── Pricing (Global across all vendors) ──────────────────────────────
    priceRange: globalPriceRange,

    // ─── Stock & Availability ──────────────────────────────────────────────
    availability,
    stockInfo,

    // ─── Discount ──────────────────────────────────────────────────────────
    discount: highestDiscount.value > 0 ? highestDiscount : null,

    // ─── Badge ─────────────────────────────────────────────────────────────
    badge,

    // ─── Variants ──────────────────────────────────────────────────────────
    sizeVariants,
    standardSizes: product.standardSizes || [],
    tenantCount: stockInfo.tenants,

    // ─── Ratings & Reviews ─────────────────────────────────────────────────
    averageRating: ratingsData.average || 0,
    reviewCount: ratingsData.count || 0,
    ratingBreakdown,
    reviews: {
      preview: reviewsPreview,
      top: topReviews,
      summary: {
        total: ratingsData.count || 0,
        average: ratingsData.average || 0,
        distribution: distributionMap,
        recommendationRate: totalReviews > 0
          ? Math.round(((distributionMap[5] + distributionMap[4]) / totalReviews) * 100)
          : 0,
      },
    },

    // ─── Sales Stats ───────────────────────────────────────────────────────
    totalSold: salesData || 0,
    viewCount: product.viewCount || 0,
    wishlistCount: product.wishlistCount || 0,

    // ─── Status ────────────────────────────────────────────────────────────
    isFeatured: product.isFeatured || false,
    status: product.status,
    requiresAgeVerification: product.requiresAgeVerification,

    // ─── Timestamps ────────────────────────────────────────────────────────
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    publishedAt: product.publishedAt,

    // ─── Available At (with full pricing breakdown) ────────────────────────
    availableAt: processedSubProducts,

    // ─── SEO & Meta ────────────────────────────────────────────────────────
    seo: {
      metaTitle: product.metaTitle || product.name,
      metaDescription:
        product.metaDescription || product.shortDescription || product.description,
      metaKeywords: product.metaKeywords || [],
      canonicalUrl: product.canonicalUrl,
    },

    // ─── External Links ────────────────────────────────────────────────────
    externalLinks: product.externalLinks || [],

    // ─── Related Products (IDs only — client can fetch separately) ────────
    relatedProductIds: product.relatedProducts || [],

    // ─── Pricing Info (Metadata) ───────────────────────────────────────────
    pricingInfo: {
      revenueModels: [
        ...new Set(processedSubProducts.map((sp) => sp.tenant.revenueModel)),
      ],
      currenciesAvailable: [
        ...new Set(
          processedSubProducts.flatMap((sp) =>
            sp.sizes.map((s) => s.pricing.currency)
          )
        ),
      ],
      hasDiscounts: highestDiscount.value > 0,
      lowestPrice: globalPriceRange.min,
      highestPrice: globalPriceRange.max,
    },
  };
};



/**
 * Get product by ID with full details
 */
const getProductById = async (id) => {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    throw new ValidationError('Invalid product ID format');
  }

  const product = await Product.findOne({ _id: id, status: 'approved' })
    .populate('brand', 'name slug logo description website countryOfOrigin verified')
    .populate('category', 'name slug type description')
    .populate('subCategory', 'name slug subType')
    .populate('tags', 'name slug type color description')
    .populate('flavors', 'name value color description')
    .lean();

  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Get active SubProducts with tenants and sizes
  const subProducts = await SubProduct.find({
    product: product._id,
    status: 'active',
  })
    .populate({
      path: 'tenant',
      match: {
        status: 'approved',
        subscriptionStatus: { $in: ['active', 'trialing'] },
      },
      select:
        'name slug logo primaryColor revenueModel markupPercentage commissionPercentage defaultCurrency country city state',
    })
    .populate({
      path: 'sizes',
      match: {
        availability: { $in: ['available', 'low_stock', 'pre_order'] },
      },
      select:
        'size displayName sellingPrice costPrice stock availability currency discountValue discountType discountStart discountEnd lowStockThreshold sku barcode weightGrams volumeMl minOrderQuantity maxOrderQuantity',
    })
    .select(
      'tenant sku baseSellingPrice costPrice currency discount discountType discountStart discountEnd sizes shortDescriptionOverride imagesOverride status totalSold totalRevenue'
    )
    .lean();

  product.subProducts = subProducts.filter((sp) => sp.tenant);

  if (product.subProducts.length === 0) {
    throw new NotFoundError('Product is not currently available from any seller');
  }

  // Build tenant map
  const tenantIds = product.subProducts.map((sp) => sp.tenant._id.toString());
  const tenants = await Tenant.find({ _id: { $in: tenantIds } })
    .select(
      'revenueModel markupPercentage commissionPercentage defaultCurrency name slug logo'
    )
    .lean();

  const tenantMap = tenants.reduce((map, tenant) => {
    map[tenant._id.toString()] = tenant;
    return map;
  }, {});

  // Get ratings, sales, and reviews
  const [ratingsData, salesData, reviewsPreview] = await Promise.all([
    getProductRatings(product._id),
    getProductSales(product._id),
    getReviewsPreview(product._id, 3),
  ]);

  // Process product
  const processed = await processProductForDisplay(
    product,
    tenantMap,
    ratingsData,
    salesData
  );

  // Add additional details
  processed.reviews = {
    preview: reviewsPreview,
    ratings: ratingsData,
  };

  processed.details = {
    tastingNotes: product.tastingNotes,
    externalLinks: product.externalLinks,
    metaKeywords: product.metaKeywords,
  };

  return processed;
};

/**
 * Get product ratings with breakdown
 */
const getProductRatings = async (productId) => {
  try {
    const [ratingsData, distribution] = await Promise.all([
      // Average and count
      Review.aggregate([
        {
          $match: {
            product: productId,
            status: 'approved',
          },
        },
        {
          $group: {
            _id: null,
            average: { $avg: '$rating' },
            count: { $sum: 1 },
          },
        },
      ]),
      // Rating distribution
      Review.aggregate([
        {
          $match: {
            product: productId,
            status: 'approved',
          },
        },
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: -1 },
        },
      ]),
    ]);

    const avgData = ratingsData[0] || { average: 0, count: 0 };

    // Build distribution map
    const distributionMap = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    distribution.forEach((item) => {
      distributionMap[item._id] = item.count;
    });

    return {
      average: parseFloat(avgData.average.toFixed(1)),
      count: avgData.count,
      distribution: distributionMap,
    };
  } catch (error) {
    console.error('Error fetching product ratings:', error);
    return { average: 0, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
  }
};

/**
 * Get product total sales
 */
const getProductSales = async (productId) => {
  try {
    const salesData = await Sales.aggregate([
      {
        $match: {
          product: productId,
          fulfillmentStatus: { $in: ['fulfilled', 'delivered'] },
        },
      },
      {
        $group: {
          _id: null,
          totalSold: { $sum: '$quantity' },
        },
      },
    ]);

    return salesData[0]?.totalSold || 0;
  } catch (error) {
    console.error('Error fetching product sales:', error);
    return 0;
  }
};

/**
 * Get preview of recent reviews
 */
const getReviewsPreview = async (productId, limit = 3) => {
  try {
    const reviews = await Review.find({
      product: productId,
      status: 'approved',
    })
      .populate('user', 'firstName lastName displayName avatar')
      .select('rating title comment images createdAt isVerifiedPurchase helpfulCount')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return reviews.map((review) => ({
      id: review._id,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      images: review.images || [],
      createdAt: review.createdAt,
      isVerifiedPurchase: review.isVerifiedPurchase,
      helpfulCount: review.helpfulCount,
      user: {
        name: review.user?.displayName || `${review.user?.firstName} ${review.user?.lastName}`,
        avatar: review.user?.avatar,
      },
    }));
  } catch (error) {
    console.error('Error fetching reviews preview:', error);
    return [];
  }
};

/**
 * Get product availability across tenants
 */
/**
 * Get product availability by location
 */
const getProductAvailability = async (productId, location = {}) => {
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID');
  }

  const { city, state, country } = location;

  // Build location query
  const locationQuery = {};
  if (city) locationQuery['tenant.city'] = new RegExp(city, 'i');
  if (state) locationQuery['tenant.state'] = new RegExp(state, 'i');
  if (country) locationQuery['tenant.country'] = new RegExp(country, 'i');

  const availability = await SubProduct.aggregate([
    {
      $match: {
        product: productId,
        status: 'active',
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
    {
      $unwind: '$tenant',
    },
    {
      $match: {
        'tenant.status': 'approved',
        ...locationQuery,
      },
    },
    {
      $lookup: {
        from: 'sizes',
        localField: 'sizes',
        foreignField: '_id',
        as: 'sizeData',
      },
    },
    {
      $project: {
        tenant: {
          id: '$tenant._id',
          name: '$tenant.name',
          slug: '$tenant.slug',
          city: '$tenant.city',
          state: '$tenant.state',
          country: '$tenant.country',
        },
        availableSizes: {
          $filter: {
            input: '$sizeData',
            as: 'size',
            cond: {
              $and: [
                { $gt: ['$$size.stock', 0] },
                { $in: ['$$size.availability', ['available', 'low_stock']] },
              ],
            },
          },
        },
      },
    },
    {
      $match: {
        availableSizes: { $ne: [] },
      },
    },
  ]);

  return {
    searchLocation: location,
    tenantsFound: availability.length,
    availability: availability.map((item) => ({
      tenant: item.tenant,
      sizesAvailable: item.availableSizes.length,
      sizes: item.availableSizes.map((size) => ({
        size: size.size,
        stock: size.stock,
        price: size.sellingPrice,
      })),
    })),
  };
};

// services/product.service.js

/**
 * Get related products using multiple strategies with complete data
 * @param {string} productId - Product ID to find related products for
 * @param {Object} options - Options for related products
 * @returns {Promise<Object>} Related products with metadata
 */
const getRelatedProducts = async (productId, options = {}) => {
  const {
    limit = 12,
    strategy = 'mixed', // 'mixed', 'semantic', 'category', 'brand', 'collaborative'
    includeOutOfStock = false,
    maxPrice,
    minPrice,
  } = options;

  // ============================================================
  // STEP 1: Validate Product ID & Find Product
  // ============================================================
  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    throw new ValidationError('Invalid product ID format');
  }

  const product = await Product.findById(productId)
    .populate('brand', 'name slug primaryCategory countryOfOrigin isPremium')
    .populate('category', 'name slug type icon color')
    .populate('subCategory', 'name slug type subType characteristics typicalFlavors')
    .populate('tags', 'slug name displayName type color')
    .populate('flavors', 'value name color category')
    .lean();

  if (!product) {
    throw new NotFoundError('Product not found');
  }

  if (product.status !== 'approved') {
    throw new ValidationError('Product is not available');
  }

  // ============================================================
  // STEP 2: Build Base Query (Exclude Current Product)
  // ============================================================
  const baseQuery = {
    _id: { $ne: productId },
    status: 'approved',
  };

  // ============================================================
  // STEP 3: Get Related Products Using Different Strategies
  // ============================================================
  let relatedProducts = [];
  let strategyUsed = strategy;

  switch (strategy) {
    case 'semantic':
      relatedProducts = await getSemanticRelatedProducts(product, baseQuery, limit, includeOutOfStock);
      break;

    case 'category':
      relatedProducts = await getCategoryRelatedProducts(product, baseQuery, limit, includeOutOfStock);
      break;

    case 'brand':
      relatedProducts = await getBrandRelatedProducts(product, baseQuery, limit, includeOutOfStock);
      break;

    case 'collaborative':
      relatedProducts = await getCollaborativeRelatedProducts(product, baseQuery, limit, includeOutOfStock);
      break;

    case 'mixed':
    default:
      relatedProducts = await getMixedRelatedProducts(product, baseQuery, limit, includeOutOfStock);
      strategyUsed = 'mixed';
      break;
  }

  // ============================================================
  // STEP 4: Apply Price Filters
  // ============================================================
  if (minPrice || maxPrice) {
    relatedProducts = relatedProducts.filter(p => {
      const priceMin = p.priceRange?.min || 0;
      const priceMax = p.priceRange?.max || Infinity;

      if (minPrice && priceMin < minPrice) return false;
      if (maxPrice && priceMax > maxPrice) return false;

      return true;
    });
  }

  // ============================================================
  // STEP 5: Calculate Similarity Scores & Sort
  // ============================================================
  const scoredProducts = relatedProducts.map(relatedProduct => {
    const score = calculateSimilarityScore(product, relatedProduct);
    return {
      ...relatedProduct,
      similarityScore: score,
      matchReasons: getMatchReasons(product, relatedProduct),
    };
  });

  // Sort by similarity score (highest first)
  scoredProducts.sort((a, b) => b.similarityScore - a.similarityScore);

  // Limit results
  const limitedProducts = scoredProducts.slice(0, limit);

  // ============================================================
  // STEP 6: Return Results with Metadata
  // ============================================================
  return {
    products: limitedProducts,
    pagination: {
      totalResults: scoredProducts.length,
      displayed: limitedProducts.length,
      hasMore: scoredProducts.length > limit,
    },
    meta: {
      totalFound: scoredProducts.length,
      displayed: limitedProducts.length,
      strategy: strategyUsed,
      sourceProduct: {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        category: product.category?.name,
        subCategory: product.subCategory?.name,
        brand: product.brand?.name,
        type: product.type,
      },
      filters: {
        minPrice: minPrice || null,
        maxPrice: maxPrice || null,
        includeOutOfStock,
      },
    },
  };
};

// ============================================================
// STRATEGY 1: SEMANTIC SIMILARITY (Using Embeddings)
// ============================================================

async function getSemanticRelatedProducts(product, baseQuery, limit, includeOutOfStock) {
  if (!product.embedding || product.embedding.length === 0) {
    console.warn('Product has no embedding, falling back to category-based');
    return getCategoryRelatedProducts(product, baseQuery, limit, includeOutOfStock);
  }

  const pipeline = [
    {
      $match: {
        ...baseQuery,
        embedding: { $exists: true, $ne: [] },
      },
    },
    {
      $addFields: {
        vectorSimilarity: {
          $let: {
            vars: {
              dotProduct: {
                $sum: {
                  $map: {
                    input: { $range: [0, { $size: '$embedding' }] },
                    as: 'i',
                    in: {
                      $multiply: [
                        { $arrayElemAt: ['$embedding', '$$i'] },
                        { $arrayElemAt: [product.embedding, '$$i'] },
                      ],
                    },
                  },
                },
              },
            },
            in: '$$dotProduct',
          },
        },
      },
    },
    { $sort: { vectorSimilarity: -1 } },
    { $limit: limit * 3 },
  ];

  const products = await Product.aggregate(pipeline);
  return await enrichRelatedProducts(products, includeOutOfStock);
}

// ============================================================
// STRATEGY 2: CATEGORY-BASED SIMILARITY
// ============================================================

async function getCategoryRelatedProducts(product, baseQuery, limit, includeOutOfStock) {
  const query = {
    ...baseQuery,
    $or: [
      ...(product.subCategory ? [{ subCategory: product.subCategory }] : []),
      ...(product.category ? [{ 
        category: product.category,
        type: product.type,
      }] : []),
      ...(product.category ? [{ category: product.category }] : []),
    ],
  };

  const products = await Product.find(query)
    .limit(limit * 3)
    .sort({ averageRating: -1, totalSold: -1 })
    .lean();

  return await enrichRelatedProducts(products, includeOutOfStock);
}

// ============================================================
// STRATEGY 3: BRAND-BASED SIMILARITY
// ============================================================

async function getBrandRelatedProducts(product, baseQuery, limit, includeOutOfStock) {
  if (!product.brand) {
    return getCategoryRelatedProducts(product, baseQuery, limit, includeOutOfStock);
  }

  const query = {
    ...baseQuery,
    brand: product.brand._id,
  };

  const products = await Product.find(query)
    .limit(limit * 3)
    .sort({ averageRating: -1, totalSold: -1 })
    .lean();

  return await enrichRelatedProducts(products, includeOutOfStock);
}

// ============================================================
// STRATEGY 4: COLLABORATIVE FILTERING
// ============================================================

async function getCollaborativeRelatedProducts(product, baseQuery, limit, includeOutOfStock) {
  console.warn('Collaborative filtering not fully implemented, using mixed strategy');
  return getMixedRelatedProducts(product, baseQuery, limit, includeOutOfStock);
}

// ============================================================
// STRATEGY 5: MIXED APPROACH (Best Results)
// ============================================================

async function getMixedRelatedProducts(product, baseQuery, limit, includeOutOfStock) {
  const weights = {
    sameSubCategory: 10,
    sameBrand: 8,
    sameCategory: 6,
    similarPrice: 5,
    similarAbv: 4,
    sharedTags: 3,
    sharedFlavors: 3,
    sameType: 2,
  };

  const pipeline = [
    { $match: baseQuery },
    {
      $addFields: {
        score: {
          $add: [
            ...(product.subCategory ? [{
              $cond: [
                { $eq: ['$subCategory', product.subCategory] },
                weights.sameSubCategory,
                0,
              ],
            }] : [0]),
            ...(product.brand ? [{
              $cond: [
                { $eq: ['$brand', product.brand._id] },
                weights.sameBrand,
                0,
              ],
            }] : [0]),
            ...(product.category ? [{
              $cond: [
                { $eq: ['$category', product.category._id] },
                weights.sameCategory,
                0,
              ],
            }] : [0]),
            {
              $cond: [
                { $eq: ['$type', product.type] },
                weights.sameType,
                0,
              ],
            },
            ...(product.isAlcoholic ? [{
              $cond: [
                {
                  $and: [
                    { $gte: ['$abv', product.abv - 2] },
                    { $lte: ['$abv', product.abv + 2] },
                  ],
                },
                weights.similarAbv,
                0,
              ],
            }] : [0]),
            {
              $multiply: [
                {
                  $size: {
                    $setIntersection: [
                      '$tags',
                      product.tags?.map(t => t._id) || [],
                    ],
                  },
                },
                weights.sharedTags,
              ],
            },
            {
              $multiply: [
                {
                  $size: {
                    $setIntersection: [
                      '$flavors',
                      product.flavors?.map(f => f._id) || [],
                    ],
                  },
                },
                weights.sharedFlavors,
              ],
            },
          ],
        },
      },
    },
    { $match: { score: { $gt: 0 } } },
    { $sort: { score: -1, averageRating: -1, totalSold: -1 } },
    { $limit: limit * 3 },
  ];

  const products = await Product.aggregate(pipeline);
  return await enrichRelatedProducts(products, includeOutOfStock);
}

// ============================================================
// HELPER: ENRICH RELATED PRODUCTS WITH COMPLETE DATA
// ============================================================

async function enrichRelatedProducts(products, includeOutOfStock) {
  if (!products || products.length === 0) {
    return [];
  }

  const productIds = products.map(p => p._id);
  const currentDate = new Date();

  // Fetch full product data with complete population
  const enrichedProducts = await Product.aggregate([
    { $match: { _id: { $in: productIds } } },
    
    // Lookup SubProducts with complete data
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
          // Filter active tenants
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
                    ...(includeOutOfStock ? {} : { stock: { $gt: 0 } }),
                  },
                },
                {
                  $project: {
                    size: 1,
                    displayName: 1,
                    volumeMl: 1,
                    sellingPrice: 1,
                    costPrice: 1,
                    compareAtPrice: 1,
                    currency: 1,
                    stock: 1,
                    availableStock: 1,
                    availability: 1,
                    discount: 1,
                    sku: 1,
                    isDefault: 1,
                  },
                },
              ],
            },
          },
          {
            $match: {
              $expr: { $gt: [{ $size: '$sizes' }, 0] },
            },
          },
          {
            $project: {
              tenant: {
                _id: 1,
                name: 1,
                slug: 1,
                logo: 1,
                primaryColor: 1,
                city: 1,
                state: 1,
                country: 1,
                revenueModel: 1,
                markupPercentage: 1,
                commissionPercentage: 1,
                defaultCurrency: 1,
              },
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
    
    {
      $match: {
        $expr: { $gt: [{ $size: '$subProducts' }, 0] },
      },
    },
    
    // Lookup brand with complete info
    {
      $lookup: {
        from: 'brands',
        localField: 'brand',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              logo: 1,
              status: 1,
              countryOfOrigin: 1,
              isPremium: 1,
              description: 1,
            },
          },
        ],
        as: 'brand',
      },
    },
    { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
    
    // Lookup category with complete info
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              type: 1,
              description: 1,
              shortDescription: 1,
              icon: 1,
              color: 1,
              displayName: 1,
              tagline: 1,
            },
          },
        ],
        as: 'category',
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    
    // Lookup subcategory with complete info
    {
      $lookup: {
        from: 'subcategories',
        localField: 'subCategory',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              type: 1,
              subType: 1,
              description: 1,
              shortDescription: 1,
              displayName: 1,
              characteristics: 1,
              typicalFlavors: 1,
            },
          },
        ],
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
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              displayName: 1,
              type: 1,
              color: 1,
              category: 1,
            },
          },
        ],
        as: 'tags',
      },
    },
    
    // Lookup flavors
    {
      $lookup: {
        from: 'flavors',
        localField: 'flavors',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
              value: 1,
              color: 1,
              category: 1,
              intensity: 1,
            },
          },
        ],
        as: 'flavors',
      },
    },
    
    // Add computed fields
    {
      $addFields: {
        tenantCount: { $size: '$subProducts' },
        totalAvailableStock: {
          $sum: {
            $map: {
              input: '$subProducts',
              as: 'sub',
              in: {
                $sum: {
                  $map: {
                    input: '$$sub.sizes',
                    as: 'size',
                    in: { $ifNull: ['$$size.availableStock', 0] },
                  },
                },
              },
            },
          },
        },
        totalSold: {
          $sum: {
            $map: {
              input: '$subProducts',
              as: 'sub',
              in: { $ifNull: ['$$sub.totalSold', 0] },
            },
          },
        },
      },
    },
    
    // Project final fields
    {
      $project: {
        _id: 1,
        name: 1,
        slug: 1,
        shortDescription: 1,
        description: 1,
        tagline: 1,
        images: 1,
        type: 1,
        subType: 1,
        isAlcoholic: 1,
        abv: 1,
        proof: 1,
        volume: 1,
        volumeMl: 1,
        originCountry: 1,
        region: 1,
        producer: 1,
        brand: 1,
        category: 1,
        subCategory: 1,
        tags: 1,
        flavors: 1,
        flavorProfile: 1,
        tastingNotes: 1,
        servingSuggestions: 1,
        foodPairings: 1,
        awards: 1,
        status: 1,
        isFeatured: 1,
        requiresAgeVerification: 1,
        averageRating: 1,
        reviewCount: 1,
        subProducts: 1,
        tenantCount: 1,
        totalAvailableStock: 1,
        totalSold: 1,
        createdAt: 1,
        updatedAt: 1,
        publishedAt: 1,
        score: 1,
        vectorSimilarity: 1,
      },
    },
  ]);

  // Process each product with complete pricing
  return enrichedProducts.map(product => {
    // ===============================
    // Process SubProducts with Website Pricing
    // ===============================
    const processedSubProducts = (product.subProducts || []).map((subProduct) => {
      const tenant = subProduct.tenant;
      const revenueModel = tenant.revenueModel || 'markup';
      const markupPercentage = tenant.markupPercentage || 40;
      const commissionPercentage = tenant.commissionPercentage || 10;

      // Process each size with website pricing
      const processedSizes = (subProduct.sizes || []).map((size) => {
        const sellingPrice = size.sellingPrice || 0;
        const costPrice = size.costPrice || subProduct.costPrice || 0;

        // Check and calculate discount
        let hasActiveDiscount = false;
        let discountedSellingPrice = sellingPrice;
        let discountInfo = null;
        let discountSource = null;

        const checkDiscountActive = (discount) => {
          if (!discount || !discount.value || !discount.type) return false;
          const now = currentDate;
          const discountStart = discount.startDate || discount.discountStart;
          const discountEnd = discount.endDate || discount.discountEnd;
          if (discountStart && now < new Date(discountStart)) return false;
          if (discountEnd && now > new Date(discountEnd)) return false;
          return true;
        };

        const calculateDiscountedPrice = (basePrice, discount) => {
          if (discount.type === 'percentage') {
            const discountAmount = (basePrice * discount.value) / 100;
            return Math.max(0, basePrice - discountAmount);
          } else if (discount.type === 'fixed') {
            return Math.max(0, basePrice - discount.value);
          }
          return basePrice;
        };

        // Priority 1: Size-level discount
        if (size.discount && checkDiscountActive(size.discount)) {
          hasActiveDiscount = true;
          discountSource = 'size';
          discountedSellingPrice = calculateDiscountedPrice(sellingPrice, size.discount);

          discountInfo = {
            type: size.discount.type,
            value: size.discount.value,
            originalPrice: sellingPrice,
            savings: sellingPrice - discountedSellingPrice,
            source: 'size',
            startDate: size.discount.startDate || size.discount.discountStart,
            endDate: size.discount.endDate || size.discount.discountEnd,
            label: size.discount.type === 'percentage'
              ? `${size.discount.value}% OFF`
              : `Save ${getCurrencySymbol(size.currency)}${size.discount.value}`,
          };
        }
        // Priority 2: SubProduct-level discount
        else if (subProduct.discount && checkDiscountActive(subProduct.discount)) {
          hasActiveDiscount = true;
          discountSource = 'subproduct';
          discountedSellingPrice = calculateDiscountedPrice(sellingPrice, subProduct.discount);

          discountInfo = {
            type: subProduct.discount.type || subProduct.discountType,
            value: subProduct.discount.value,
            originalPrice: sellingPrice,
            savings: sellingPrice - discountedSellingPrice,
            source: 'subproduct',
            startDate: subProduct.discount.startDate || subProduct.discountStart,
            endDate: subProduct.discount.endDate || subProduct.discountEnd,
            label: (subProduct.discount.type || subProduct.discountType) === 'percentage'
              ? `${subProduct.discount.value}% OFF`
              : `Save ${getCurrencySymbol(size.currency)}${subProduct.discount.value}`,
          };
        }

        const tenantPrice = hasActiveDiscount ? discountedSellingPrice : sellingPrice;

        // Calculate website price based on revenue model
        let websitePrice = tenantPrice;
        let platformFee = 0;
        let tenantRevenue = 0;
        let platformRevenue = 0;

        if (revenueModel === 'markup') {
          websitePrice = tenantPrice;
          tenantRevenue = tenantPrice - costPrice;
          platformFee = 0;
          platformRevenue = 0;
        } else if (revenueModel === 'commission') {
          platformFee = (tenantPrice * commissionPercentage) / 100;
          websitePrice = tenantPrice + platformFee;
          tenantRevenue = tenantPrice - costPrice;
          platformRevenue = platformFee;
        }

        // Update discount info with website prices
        if (hasActiveDiscount && discountInfo) {
          const originalWebsitePrice = revenueModel === 'commission'
            ? sellingPrice + (sellingPrice * commissionPercentage) / 100
            : sellingPrice;

          discountInfo.originalPrice = originalWebsitePrice;
          discountInfo.savings = originalWebsitePrice - websitePrice;
        }

        return {
          _id: size._id,
          size: size.displayName || size.size,
          volumeMl: size.volumeMl,
          sku: size.sku,
          isDefault: size.isDefault,

          // Stock
          stock: size.availableStock || size.stock || 0,
          availability: size.availability,

          // Pricing Breakdown
          pricing: {
            costPrice,
            sellingPrice,
            tenantPrice,
            websitePrice,
            originalWebsitePrice: hasActiveDiscount
              ? (revenueModel === 'commission'
                ? sellingPrice + (sellingPrice * commissionPercentage) / 100
                : sellingPrice)
              : websitePrice,
            platformFee,
            tenantRevenue,
            platformRevenue,
            displayPrice: websitePrice.toFixed(2),
            formattedPrice: formatPrice(websitePrice, size.currency || tenant.defaultCurrency || 'NGN'),
            compareAtPrice: size.compareAtPrice
              ? (revenueModel === 'commission'
                ? size.compareAtPrice + (size.compareAtPrice * commissionPercentage) / 100
                : size.compareAtPrice
              ).toFixed(2)
              : null,
            currency: size.currency || tenant.defaultCurrency || 'NGN',
            currencySymbol: getCurrencySymbol(size.currency || tenant.defaultCurrency || 'NGN'),
            revenueModel,
            ...(revenueModel === 'markup' && { markupPercentage }),
            ...(revenueModel === 'commission' && { commissionPercentage }),
          },

          discount: discountInfo,

          metadata: {
            priceCalculatedAt: new Date(),
            taxIncluded: false,
            discountSource,
          },
        };
      });

      const sizePrices = processedSizes.map((s) => s.pricing.websitePrice);
      const minSizePrice = Math.min(...sizePrices);
      const maxSizePrice = Math.max(...sizePrices);

      return {
        _id: subProduct._id,
        sku: subProduct.sku,
        tenant: {
          _id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          logo: tenant.logo,
          primaryColor: tenant.primaryColor,
          city: tenant.city,
          state: tenant.state,
          country: tenant.country,
          revenueModel: tenant.revenueModel,
        },
        sizes: processedSizes,
        priceRange: {
          min: minSizePrice,
          max: maxSizePrice,
          currency: processedSizes[0]?.pricing.currency || 'NGN',
          display: minSizePrice === maxSizePrice
            ? `${getCurrencySymbol(processedSizes[0]?.pricing.currency || 'NGN')}${minSizePrice.toFixed(2)}`
            : `${getCurrencySymbol(processedSizes[0]?.pricing.currency || 'NGN')}${minSizePrice.toFixed(2)} - ${getCurrencySymbol(processedSizes[0]?.pricing.currency || 'NGN')}${maxSizePrice.toFixed(2)}`,
        },
        totalStock: processedSizes.reduce((sum, s) => sum + s.stock, 0),
        availableSizes: processedSizes.length,
        isFeatured: subProduct.isFeaturedByTenant || false,
      };
    });

    // ===============================
    // Calculate Overall Price Range
    // ===============================
    let globalPriceRange = { min: 0, max: 0, display: '₦0.00', currency: 'NGN' };

    if (processedSubProducts.length) {
      const allPrices = processedSubProducts.flatMap((sp) =>
        sp.sizes.map((size) => ({
          price: size.pricing.websitePrice,
          currency: size.pricing.currency,
        }))
      );

      if (allPrices.length) {
        const priceValues = allPrices.map((p) => p.price);
        const minPrice = Math.min(...priceValues);
        const maxPrice = Math.max(...priceValues);
        const currency = allPrices[0].currency;
        const currencySymbol = getCurrencySymbol(currency);

        globalPriceRange = {
          min: minPrice,
          max: maxPrice,
          currency,
          display: minPrice === maxPrice
            ? `${currencySymbol}${minPrice.toFixed(2)}`
            : `${currencySymbol}${minPrice.toFixed(2)} - ${currencySymbol}${maxPrice.toFixed(2)}`,
        };
      }
    }

    // ===============================
    // Calculate Stock Totals
    // ===============================
    const stockInfo = processedSubProducts.reduce(
      (totals, subProduct) => ({
        totalStock: totals.totalStock + subProduct.totalStock,
        availableStock: totals.availableStock + subProduct.totalStock,
        tenants: totals.tenants + 1,
        totalSizes: totals.totalSizes + subProduct.availableSizes,
      }),
      { totalStock: 0, availableStock: 0, tenants: 0, totalSizes: 0 }
    );

    // ===============================
    // Calculate Highest Active Discount
    // ===============================
    let highestDiscount = {
      value: 0,
      type: 'none',
      label: null,
      savings: 0,
    };

    processedSubProducts.forEach((subProduct) => {
      subProduct.sizes.forEach((size) => {
        if (size.discount && size.discount.savings > highestDiscount.savings) {
          highestDiscount = size.discount;
        }
      });
    });

    // ===============================
    // Calculate Availability Status
    // ===============================
    const availability = {
      status: stockInfo.availableStock > 0 ? 'in_stock' : 'out_of_stock',
      stockLevel: stockInfo.availableStock > 50 ? 'high'
        : stockInfo.availableStock > 10 ? 'medium'
        : stockInfo.availableStock > 0 ? 'low' : 'out',
      availableFrom: stockInfo.tenants,
      message: getAvailabilityMessage(stockInfo),
    };

    // ===============================
    // Calculate Size Variants
    // ===============================
    const sizeVariants = [
      ...new Set(
        processedSubProducts.flatMap((sp) => sp.sizes.map((size) => size.size))
      ),
    ];

    // ===============================
    // Calculate Badge
    // ===============================
    const badge = assignProductBadge(product, stockInfo, highestDiscount.value > 0 ? highestDiscount : null);

    // ===============================
    // Build Display-Ready Product
    // ===============================
    return {
      _id: product._id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,
      tagline: product.tagline,

      images: product.images || [],
      primaryImage: product.images?.find((img) => img.isPrimary) || product.images?.[0],

      type: product.type,
      subType: product.subType,
      isAlcoholic: product.isAlcoholic,
      abv: product.abv,
      proof: product.proof,
      volume: product.volume,
      volumeMl: product.volumeMl,

      originCountry: product.originCountry,
      region: product.region,
      producer: product.producer,

      brand: product.brand ? {
        _id: product.brand._id,
        name: product.brand.name,
        slug: product.brand.slug,
        logo: product.brand.logo,
        countryOfOrigin: product.brand.countryOfOrigin,
        isPremium: product.brand.isPremium,
      } : null,

      category: product.category ? {
        _id: product.category._id,
        name: product.category.name,
        slug: product.category.slug,
        type: product.category.type,
        icon: product.category.icon,
        color: product.category.color,
        displayName: product.category.displayName,
        tagline: product.category.tagline,
      } : null,

      subCategory: product.subCategory ? {
        _id: product.subCategory._id,
        name: product.subCategory.name,
        slug: product.subCategory.slug,
        type: product.subCategory.type,
        subType: product.subCategory.subType,
        displayName: product.subCategory.displayName,
        description: product.subCategory.description,
        characteristics: product.subCategory.characteristics,
        typicalFlavors: product.subCategory.typicalFlavors,
      } : null,

      tags: (product.tags || []).map((tag) => ({
        _id: tag._id,
        name: tag.name,
        slug: tag.slug,
        displayName: tag.displayName,
        type: tag.type,
        color: tag.color,
        category: tag.category,
      })),

      flavors: (product.flavors || []).map((flavor) => ({
        _id: flavor._id,
        name: flavor.name,
        value: flavor.value,
        color: flavor.color,
        category: flavor.category,
        intensity: flavor.intensity,
      })),

      flavorProfile: product.flavorProfile || [],
      tastingNotes: product.tastingNotes,
      servingSuggestions: product.servingSuggestions,
      foodPairings: product.foodPairings || [],
      awards: product.awards || [],

      priceRange: globalPriceRange,
      availability,
      stockInfo,
      discount: highestDiscount.value > 0 ? highestDiscount : null,
      badge,
      sizeVariants,
      tenantCount: stockInfo.tenants,

      averageRating: product.averageRating || 0,
      reviewCount: product.reviewCount || 0,
      totalSold: product.totalSold || 0,

      isFeatured: product.isFeatured || false,
      requiresAgeVerification: product.requiresAgeVerification || product.isAlcoholic,
      status: product.status,

      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      publishedAt: product.publishedAt,

      availableAt: processedSubProducts,

      pricingInfo: {
        revenueModels: [...new Set(processedSubProducts.map((sp) => sp.tenant.revenueModel))],
        currenciesAvailable: [...new Set(processedSubProducts.flatMap((sp) => sp.sizes.map((s) => s.pricing.currency)))],
        hasDiscounts: highestDiscount.value > 0,
        lowestPrice: globalPriceRange.min,
        highestPrice: globalPriceRange.max,
      },

      // Preserve aggregation scores
      score: product.score,
      vectorSimilarity: product.vectorSimilarity,
    };
  });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function calculateSimilarityScore(sourceProduct, relatedProduct) {
  let score = 0;
  
  if (sourceProduct.subCategory?._id?.toString() === relatedProduct.subCategory?._id?.toString()) {
    score += 30;
  }
  
  if (sourceProduct.brand?._id?.toString() === relatedProduct.brand?._id?.toString()) {
    score += 25;
  }
  
  if (sourceProduct.category?._id?.toString() === relatedProduct.category?._id?.toString()) {
    score += 20;
  }
  
  if (sourceProduct.type === relatedProduct.type) {
    score += 15;
  }
  
  if (sourceProduct.isAlcoholic && relatedProduct.isAlcoholic) {
    const abvDiff = Math.abs(sourceProduct.abv - relatedProduct.abv);
    if (abvDiff <= 2) {
      score += 10;
    } else if (abvDiff <= 5) {
      score += 5;
    }
  }
  
  const sourceTags = sourceProduct.tags?.map(t => t._id?.toString() || t.toString()) || [];
  const relatedTags = relatedProduct.tags?.map(t => t._id?.toString() || t.toString()) || [];
  const sharedTags = sourceTags.filter(t => relatedTags.includes(t)).length;
  score += sharedTags * 5;
  
  const sourceFlavors = sourceProduct.flavors?.map(f => f._id?.toString() || f.toString()) || [];
  const relatedFlavors = relatedProduct.flavors?.map(f => f._id?.toString() || f.toString()) || [];
  const sharedFlavors = sourceFlavors.filter(f => relatedFlavors.includes(f)).length;
  score += sharedFlavors * 5;
  
  if (sourceProduct.priceRange && relatedProduct.priceRange) {
    const sourceAvg = (sourceProduct.priceRange.min + sourceProduct.priceRange.max) / 2;
    const relatedAvg = (relatedProduct.priceRange.min + relatedProduct.priceRange.max) / 2;
    const priceDiff = Math.abs(sourceAvg - relatedAvg) / sourceAvg;
    
    if (priceDiff <= 0.3) {
      score += 10;
    } else if (priceDiff <= 0.5) {
      score += 5;
    }
  }
  
  if (relatedProduct.averageRating >= 4.5) {
    score += 5;
  } else if (relatedProduct.averageRating >= 4.0) {
    score += 3;
  }
  
  if (relatedProduct.isFeatured) {
    score += 3;
  }
  
  if (relatedProduct.score) {
    score += relatedProduct.score;
  }
  
  if (relatedProduct.vectorSimilarity) {
    score += relatedProduct.vectorSimilarity * 10;
  }
  
  return score;
}

function getMatchReasons(sourceProduct, relatedProduct) {
  const reasons = [];
  
  if (sourceProduct.subCategory?._id?.toString() === relatedProduct.subCategory?._id?.toString()) {
    reasons.push(`Same category: ${relatedProduct.subCategory?.name}`);
  }
  
  if (sourceProduct.brand?._id?.toString() === relatedProduct.brand?._id?.toString()) {
    reasons.push(`Same brand: ${relatedProduct.brand?.name}`);
  }
  
  if (sourceProduct.type === relatedProduct.type) {
    reasons.push(`Same type: ${relatedProduct.type?.replace(/_/g, ' ')}`);
  }
  
  const sourceFlavors = sourceProduct.flavors?.map(f => f.value) || [];
  const relatedFlavors = relatedProduct.flavors?.map(f => f.value) || [];
  const sharedFlavors = sourceFlavors.filter(f => relatedFlavors.includes(f));
  
  if (sharedFlavors.length > 0) {
    reasons.push(`Similar flavors: ${sharedFlavors.slice(0, 3).join(', ')}`);
  }
  
  if (sourceProduct.isAlcoholic && relatedProduct.isAlcoholic) {
    const abvDiff = Math.abs(sourceProduct.abv - relatedProduct.abv);
    if (abvDiff <= 2) {
      reasons.push(`Similar strength: ${relatedProduct.abv}% ABV`);
    }
  }
  
  if (relatedProduct.averageRating >= 4.5) {
    reasons.push('Highly rated');
  }
  
  if (relatedProduct.isFeatured) {
    reasons.push('Featured product');
  }
  
  return reasons;
}


// ============================================================================
// IMPROVED SEARCH FUNCTIONS
// ============================================================================

/**
 * Escape special regex characters
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  approveProduct,
  rejectProduct,
  getProductByBarcode,
  importProducts,
  exportTenantProducts,
  exportAllProducts,
  // Product Management
  bulkUpdateProducts,
  duplicateProduct,
  archiveProduct,
  restoreProduct,
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
  getAllProducts,
  getFeaturedProducts,
  getNewArrivals,
  getBestsellers,
  getProductBySlug,
  getProductById,
  getProductRatings,
  getProductSales,
  getReviewsPreview,
  searchProducts,
  getSearchSuggestions,
  getProductAvailability,
  getRelatedProducts,
  getAvailableFilters,


  // Search & Discovery
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

  // Image Management (Extended)
  uploadProductImages,
  deleteProductImage,
  reorderProductImages,
  setProductPrimaryImage,
  updateProductImageMetadata,
  getOptimizedImageUrl,
  bulkDeleteProductImages,
};