import { z } from 'zod';
import { fileSchema } from './common-rules';

// Media item schema
const mediaItemSchema = z.object({
  url: z.string().optional(),
  alt: z.string().optional(),
  isPrimary: z.boolean().default(false),
  order: z.number().default(0),
});

// Size option schema
const sizeOptionSchema = z.object({
  size: z.string().optional(),
  displayName: z.string().optional(),
  sizeCategory: z.string().optional(),
  unitType: z.string().default('volume_ml'),
  volumeMl: z.number().nullable().optional(),
  weightGrams: z.number().nullable().optional(),
  servingsPerUnit: z.number().nullable().optional(),
  unitsPerPack: z.number().min(1).default(1),
  
  // Pricing
  basePrice: z.number().min(0).nullable().optional(),
  compareAtPrice: z.number().min(0).nullable().optional(),
  costPrice: z.number().min(0).nullable().optional(),
  wholesalePrice: z.number().min(0).nullable().optional(),
  currency: z.string().default('NGN'),
  
  // Auto-calculation fields
  markupPercentage: z.number().min(0).max(500).default(25),
  roundUp: z.enum(['none', '100', '1000']).default('none'),
  saleDiscountPercentage: z.number().min(0).max(100).default(0),
  salePrice: z.number().min(0).nullable().optional(),
  
  // Inventory
  stock: z.number().min(0).default(0),
  reservedStock: z.number().min(0).default(0),
  availableStock: z.number().min(0).default(0),
  lowStockThreshold: z.number().min(0).default(10),
  reorderPoint: z.number().min(0).default(5),
  reorderQuantity: z.number().min(1).default(50),
  availability: z.string().optional(),
  
  // Identification
  sku: z.string().optional(),
  barcode: z.string().optional(),
  
  // Packaging & Details
  packaging: z.string().optional(),
  
  // Order Constraints
  minOrderQuantity: z.number().min(1).optional(),
  maxOrderQuantity: z.number().min(1).optional(),
  orderIncrement: z.number().min(1).optional(),
  requiresAgeVerification: z.boolean().optional(),
  
  // Flags
  isDefault: z.boolean().default(false),
  isOnSale: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isPopularSize: z.boolean().default(false),
  isLimitedEdition: z.boolean().default(false),
  
  // Rank
  rank: z.number().min(1).optional(),
});

// Certification schema
const certificationSchema = z.object({
  name: z.string().optional(),
  issuedBy: z.string().optional(),
  year: z.number().nullable().optional(),
});

// Award schema
const awardSchema = z.object({
  title: z.string().optional(),
  organization: z.string().optional(),
  year: z.number().nullable().optional(),
  medal: z.enum(['gold', 'silver', 'bronze', 'platinum', 'double_gold']).optional(),
  score: z.number().nullable().optional(),
});

// External link schema
const externalLinkSchema = z.object({
  name: z.string().optional(),
  url: z.string().url().optional(),
  type: z.enum(['producer', 'review', 'press', 'social', 'other']).optional(),
});

// Ratings schema
const ratingsSchema = z.object({
  wineSpectator: z.number().min(0).max(100).nullable().optional(),
  robertParker: z.number().min(0).max(100).nullable().optional(),
  jamesSuckling: z.number().min(0).max(100).nullable().optional(),
  decanter: z.number().min(0).max(100).nullable().optional(),
  whiskyAdvocate: z.number().min(0).max(100).nullable().optional(),
  jimMurray: z.number().min(0).max(100).nullable().optional(),
  untappd: z.number().min(0).max(5).nullable().optional(),
});

// Main product form schema matching server structure
export const productFormSchema = z.object({
  // ═══════════════════════════════════════════════════════════════════
  // IDENTIFICATION
  // ═══════════════════════════════════════════════════════════════════
  name: z.string().min(1, 'Product name is required').max(200),
  slug: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  gtin: z.string().optional(),
  upc: z.string().optional(),

  // ═══════════════════════════════════════════════════════════════════
  // BEVERAGE-SPECIFIC ATTRIBUTES
  // ═══════════════════════════════════════════════════════════════════
  type: z.enum([
    'beer', 'wine', 'sparkling_wine', 'fortified_wine', 'spirit', 'liqueur', 
    'cocktail_ready_to_drink', 'non_alcoholic', 'juice', 'tea', 'coffee', 
    'energy_drink', 'water', 'mixer', 'snack', 'accessory', 'gift', 'other'
  ], { message: 'Product type is required' }),
  subType: z.string().optional(),
  isAlcoholic: z.boolean().default(false),
  abv: z.number().min(0).max(100).nullable().optional(),
  proof: z.number().min(0).max(200).nullable().optional(),
  volumeMl: z.number().nullable().optional(),
  standardSizes: z.array(z.string()).default([]),
  servingSize: z.string().optional(),
  servingsPerContainer: z.number().nullable().optional(),

  // ═══════════════════════════════════════════════════════════════════
  // ORIGIN & PRODUCTION
  // ═══════════════════════════════════════════════════════════════════
  originCountry: z.string().optional(),
  region: z.string().optional(),
  appellation: z.string().optional(),
  producer: z.string().optional(),
  brand: z.string().optional(),
  vintage: z.number().min(1800).max(new Date().getFullYear() + 1).nullable().optional(),
  age: z.number().min(0).nullable().optional(),
  ageStatement: z.string().optional(),
  distilleryName: z.string().optional(),
  breweryName: z.string().optional(),
  wineryName: z.string().optional(),
  productionMethod: z.string().optional(),
  caskType: z.string().optional(),
  finish: z.string().optional(),

  // ═══════════════════════════════════════════════════════════════════
  // CATEGORIZATION
  // ═══════════════════════════════════════════════════════════════════
  category: z.string().optional(),
  subCategory: z.string().optional(),
  tags: z.array(z.string()).default([]),
  flavors: z.array(z.string()).default([]),
  style: z.string().optional(),

  // ═══════════════════════════════════════════════════════════════════
  // DESCRIPTIVE CONTENT
  // ═══════════════════════════════════════════════════════════════════
  shortDescription: z.string().max(280).optional(),
  description: z.string().max(5000).optional(),
  tastingNotes: z.object({
    nose: z.array(z.string()).default([]),
    aroma: z.array(z.string()).default([]),
    palate: z.array(z.string()).default([]),
    taste: z.array(z.string()).default([]),
    finish: z.array(z.string()).default([]),
    mouthfeel: z.array(z.string()).default([]),
    appearance: z.string().optional(),
    color: z.string().optional(),
  }).default({}),
  flavorProfile: z.array(z.string()).default([]),
  foodPairings: z.array(z.string()).default([]),
  servingSuggestions: z.object({
    temperature: z.string().optional(),
    glassware: z.string().optional(),
    garnish: z.array(z.string()).default([]),
    mixers: z.array(z.string()).default([]),
  }).default({}),

  // ═══════════════════════════════════════════════════════════════════
  // DIETARY & ALLERGEN INFO
  // ═══════════════════════════════════════════════════════════════════
  isDietary: z.object({
    vegan: z.boolean().default(false),
    vegetarian: z.boolean().default(false),
    glutenFree: z.boolean().default(false),
    dairyFree: z.boolean().default(false),
    organic: z.boolean().default(false),
    kosher: z.boolean().default(false),
    halal: z.boolean().default(false),
    sugarFree: z.boolean().default(false),
    lowCalorie: z.boolean().default(false),
    lowCarb: z.boolean().default(false),
  }).default({}),
  allergens: z.array(z.string()).default([]),
  ingredients: z.array(z.string()).default([]),
  nutritionalInfo: z.object({
    calories: z.number().nullable().optional(),
    carbohydrates: z.number().nullable().optional(),
    sugar: z.number().nullable().optional(),
    protein: z.number().nullable().optional(),
    fat: z.number().nullable().optional(),
    sodium: z.number().nullable().optional(),
    caffeine: z.number().nullable().optional(),
  }).default({}),

  // ═══════════════════════════════════════════════════════════════════
  // CERTIFICATIONS & AWARDS
  // ═══════════════════════════════════════════════════════════════════
  certifications: z.array(certificationSchema).default([]),
  awards: z.array(awardSchema).default([]),

  // ═══════════════════════════════════════════════════════════════════
  // RATINGS
  // ═══════════════════════════════════════════════════════════════════
  ratings: ratingsSchema.default({}),
  averageRating: z.number().min(0).max(5).default(0),
  reviewCount: z.number().default(0),

  // ═══════════════════════════════════════════════════════════════════
  // MEDIA
  // ═══════════════════════════════════════════════════════════════════
  images: z.array(mediaItemSchema).default([]),
  productImages: z.array(fileSchema).optional(),
  uploadedImages: z.array(z.object({
    url: z.string().optional(),
    publicId: z.string().optional(),
    thumbnail: z.string().optional(),
    isPrimary: z.boolean().default(false),
  })).default([]),
  videos: z.array(z.object({
    url: z.string().optional(),
    type: z.enum(['youtube', 'vimeo', 'direct']).optional(),
    thumbnail: z.string().optional(),
    title: z.string().optional(),
  })).default([]),

  // ═══════════════════════════════════════════════════════════════════
  // RELATED PRODUCTS & EXTERNAL LINKS
  // ═══════════════════════════════════════════════════════════════════
  relatedProducts: z.array(z.string()).default([]),
  externalLinks: z.array(externalLinkSchema).default([]),

  // ═══════════════════════════════════════════════════════════════════
  // SEO
  // ═══════════════════════════════════════════════════════════════════
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  metaKeywords: z.array(z.string()).default([]),
  slug: z.string().optional(),
  canonicalUrl: z.string().optional(),

  // ═══════════════════════════════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════════════════════════════
  isFeatured: z.boolean().default(false),
  allowReviews: z.boolean().default(true),
  requiresAgeVerification: z.boolean().optional(),
  isPublished: z.boolean().default(false),
  publishedAt: z.date().optional(),
  discontinuedAt: z.date().optional(),

  // ═══════════════════════════════════════════════════════════════════
  // ANALYTICS (read-only in form)
  // ═══════════════════════════════════════════════════════════════════
  averageSellingPrice: z.number().optional(),
  totalStockAvailable: z.number().optional(),
  totalSold: z.number().default(0),
  totalRevenue: z.number().default(0),
  viewCount: z.number().default(0),
  wishlistCount: z.number().default(0),

  // ═══════════════════════════════════════════════════════════════════
  // SUBPRODUCT DATA (For initial creation)
  // ═══════════════════════════════════════════════════════════════════
  subProductData: z.object({
    // Core Relationships
    product: z.string().optional(),
    tenant: z.string().optional(),
    createNewProduct: z.boolean().optional().default(false),
    newProductData: z.object({
      name: z.string().optional(),
      type: z.string().optional(),
      subType: z.string().optional(),
      brand: z.string().optional(),
      volumeMl: z.union([z.string(), z.number()]).optional(),
      abv: z.union([z.string(), z.number()]).optional(),
      proof: z.union([z.string(), z.number()]).optional(),
      barcode: z.string().optional(),
      category: z.string().optional(),
      subCategory: z.string().optional(),
      originCountry: z.string().optional(),
      region: z.string().optional(),
      producer: z.string().optional(),
      description: z.string().optional(),
      shortDescription: z.string().optional(),
      isAlcoholic: z.boolean().optional().default(true),
      style: z.string().optional(),
      vintage: z.union([z.string(), z.number()]).optional(),
    }).nullable().optional(),
    
    // Commercial Data
    sku: z.string().optional(),
    baseSellingPrice: z.number().min(0).nullable().optional(),
    costPrice: z.number().min(0).nullable().optional(),
    currency: z.string().default('NGN'),
    taxRate: z.number().min(0).max(100).default(0),
    marginPercentage: z.number().min(0).nullable().optional(),
    markupPercentage: z.number().min(0).max(500).default(25),
    roundUp: z.enum(['none', '100', '1000']).default('none'),
    saleDiscountPercentage: z.number().min(0).max(100).default(0),
    
    // Sale / Discount Pricing
    salePrice: z.number().min(0).nullable().optional(),
    saleStartDate: z.date().nullable().optional(),
    saleEndDate: z.date().nullable().optional(),
    saleType: z.enum(['percentage', 'fixed', 'flash_sale', 'bundle', 'bogo']).nullable().optional(),
    saleDiscountValue: z.number().min(0).nullable().optional(),
    saleBanner: z.object({
      url: z.string().optional(),
      alt: z.string().optional(),
    }).optional(),
    isOnSale: z.boolean().default(false),
    
    // Tenant Overrides
    shortDescriptionOverride: z.string().max(280).optional(),
    descriptionOverride: z.string().max(5000).optional(),
    imagesOverride: z.array(mediaItemSchema).default([]),
    customKeywords: z.array(z.string()).default([]),
    embeddingOverride: z.array(z.number()).default([]),
    tenantNotes: z.string().max(1000).optional(),
    
    // Sizes
    sizes: z.array(sizeOptionSchema).default([]),
    sellWithoutSizeVariants: z.boolean().default(false),
    defaultSize: z.string().optional(),
    
    // Inventory Management
    stockStatus: z.enum(['in_stock', 'low_stock', 'out_of_stock', 'pre_order', 'discontinued']).default('in_stock'),
    totalStock: z.number().min(0).default(0),
    reservedStock: z.number().min(0).default(0),
    availableStock: z.number().min(0).default(0),
    lowStockThreshold: z.number().min(0).default(10),
    reorderPoint: z.number().min(0).default(5),
    reorderQuantity: z.number().min(1).default(50),
    lastRestockDate: z.date().nullable().optional(),
    nextRestockDate: z.date().nullable().optional(),
    
    // Vendor & Sourcing
    vendor: z.string().optional(),
    supplierSKU: z.string().optional(),
    supplierPrice: z.number().min(0).nullable().optional(),
    leadTimeDays: z.number().min(0).nullable().optional(),
    minimumOrderQuantity: z.number().min(0).nullable().optional(),
    
    // Status fields
    status: z.string().default('draft'),
    isFeaturedByTenant: z.boolean().default(false),
    isNewArrival: z.boolean().default(false),
    isBestSeller: z.boolean().default(false),
    addedAt: z.date().optional(),
    activatedAt: z.date().nullable().optional(),
    deactivatedAt: z.date().nullable().optional(),
    discontinuedAt: z.date().nullable().optional(),
    
    // Promotions & Discounts
    discount: z.number().min(0).default(0),
    discountType: z.enum(['fixed', 'percentage']).nullable().optional(),
    discountStart: z.date().nullable().optional(),
    discountEnd: z.date().nullable().optional(),
    flashSale: z.object({
      isActive: z.boolean().default(false),
      startDate: z.date().nullable().optional(),
      endDate: z.date().nullable().optional(),
      discountPercentage: z.number().min(0).nullable().optional(),
      remainingQuantity: z.number().min(0).nullable().optional(),
    }).optional(),
    bundleDeals: z.array(z.object({
      name: z.string().optional(),
      products: z.array(z.string()).optional(),
      discount: z.number().min(0).nullable().optional(),
      validUntil: z.date().nullable().optional(),
    })).default([]),
    
    // Shipping & Logistics
    shipping: z.object({
      weight: z.number().nullable().optional(),
      length: z.number().nullable().optional(),
      width: z.number().nullable().optional(),
      height: z.number().nullable().optional(),
      fragile: z.boolean().default(true),
      requiresAgeVerification: z.boolean().default(true),
      hazmat: z.boolean().default(false),
      shippingClass: z.string().optional(),
    }).default({}),
    warehouse: z.object({
      location: z.string().optional(),
      zone: z.string().optional(),
      aisle: z.string().optional(),
      shelf: z.string().optional(),
      bin: z.string().optional(),
    }).default({}),
  }).optional(),
});

export type CreateProductInput = z.infer<typeof productFormSchema>;
export type { certificationSchema, awardSchema, externalLinkSchema, ratingsSchema };
export type SizeOption = z.infer<typeof sizeOptionSchema>;
