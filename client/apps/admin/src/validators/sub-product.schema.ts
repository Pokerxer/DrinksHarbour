import { z } from 'zod';

// Helper to convert empty strings to null for optional number fields
const optionalNumber = z.preprocess(
  (val) => {
    if (val === '' || val === null || val === undefined) return undefined;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? undefined : parsed;
    }
    return val;
  },
  z.number().optional()
);

// Helper for optional number with min(0)
const optionalPositiveNumber = z.preprocess(
  (val) => {
    if (val === '' || val === null || val === undefined) return undefined;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? undefined : parsed;
    }
    return val;
  },
  z.number({ invalid_type_error: 'Please enter a valid number' })
    .optional()
);

// Size option schema for sub-product variants
export const sizeOptionSchema = z.object({
  _id: z.string().optional(),
  size: z.string({ required_error: 'Size selection is required' })
    .min(1, 'Please select a size from the dropdown'),
  displayName: z.string().optional(),
  sizeCategory: z.string().default('standard'),
  unitType: z.string().optional(),
  volumeMl: optionalNumber,
  weightGrams: optionalNumber,
  servingsPerUnit: optionalNumber,
  unitsPerPack: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 6 : Number(val),
    z.number().default(6)
  ),
  basePrice: optionalNumber,
  compareAtPrice: optionalNumber,
  costPrice: optionalNumber,
  wholesalePrice: optionalNumber,
  currency: z.string().default('NGN'),
  markupPercentage: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 25 : Number(val),
    z.number().min(0).max(500).default(25)
  ),
  roundUp: z.enum(['none', '100', '500', '1000']).default('100'),
  pricingStrategy: z.enum(['cost_plus', 'market_based', 'value_based', 'penetration']).default('cost_plus'),
  minPrice: optionalNumber,
  maxPrice: optionalNumber,
  competitorPrice: z.string().max(500).default(''),
  saleDiscountPercentage: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 0 : Number(val),
    z.number().min(0).max(100).default(0)
  ),
  salePrice: optionalNumber,
  stock: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 0 : Math.max(0, Number(val) || 0),
    z.number().min(0).default(0)
  ),
  reservedStock: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 0 : Math.max(0, Number(val) || 0),
    z.number().min(0).default(0)
  ),
  availableStock: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 0 : Math.max(0, Number(val) || 0),
    z.number().min(0).default(0)
  ),
  lowStockThreshold: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 10 : Number(val),
    z.number().min(0).default(10)
  ),
  reorderPoint: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 5 : Number(val),
    z.number().min(0).default(5)
  ),
  reorderQuantity: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 50 : Number(val),
    z.number().min(1).default(50)
  ),
  availability: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  packaging: z.string().optional(),
  minOrderQuantity: optionalPositiveNumber,
  maxOrderQuantity: optionalPositiveNumber,
  orderIncrement: optionalPositiveNumber,
  requiresAgeVerification: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  isOnSale: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isPopularSize: z.boolean().default(false),
  isLimitedEdition: z.boolean().default(false),
  rank: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 1 : Number(val),
    z.number().default(1)
  ),
});

// Media item schema
const mediaItemSchema = z.object({
  url: z.string(),
  alt: z.string().optional(),
  isPrimary: z.boolean().optional(),
  order: z.number().optional(),
});

// New product data schema (for creating product on-the-fly)
const newProductDataSchema = z.object({
  name: z.string({ required_error: 'Product name is required when creating a new product' })
    .min(1, 'Please enter a product name'),
  type: z.string({ required_error: 'Product type is required when creating a new product' })
    .min(1, 'Please select a product type'),
  subType: z.string().optional(),
  brand: z.string().optional(),
  volumeMl: z.union([z.string(), z.number()]).nullable().optional(),
  abv: z.union([z.string(), z.number()]).nullable().optional(),
  proof: z.union([z.string(), z.number()]).nullable().optional(),
  barcode: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  originCountry: z.string().optional(),
  region: z.string().optional(),
  producer: z.string().optional(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  isAlcoholic: z.boolean().default(true),
  style: z.string().optional(),
  vintage: z.union([z.string(), z.number()]).nullable().optional(),
}).nullable().optional();

// Core sub-product data schema (the actual sub-product fields)
const subProductDataSchema = z.object({
  // Core Relationships
  _id: z.string().optional(),
  id: z.string().optional(),
  product: z.string().optional(),
  tenant: z.string().optional(),
  createNewProduct: z.boolean().default(false),
  newProductData: newProductDataSchema,
  
  // Commercial Data
  sku: z.string().optional(),
  baseSellingPrice: optionalPositiveNumber,
  costPrice: optionalPositiveNumber,
  currency: z.string().default('NGN'),
  taxRate: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 0 : Number(val),
    z.number().min(0).max(100).default(0)
  ),
  marginPercentage: optionalPositiveNumber,
  markupPercentage: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 25 : Number(val),
    z.number().min(0).max(500).default(25)
  ),
  roundUp: z.enum(['none', '100', '500', '1000']).default('100'),
  pricingStrategy: z.enum(['cost_plus', 'market_based', 'value_based', 'penetration']).default('cost_plus'),
  minPrice: optionalNumber,
  maxPrice: optionalNumber,
  competitorPrice: z.string().max(500).default(''),
  saleDiscountPercentage: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 0 : Number(val),
    z.number().min(0).max(100).default(0)
  ),
  
  // Sale / Discount Pricing
  salePrice: optionalPositiveNumber,
  saleStartDate: z.string().nullable().optional(),
  saleEndDate: z.string().nullable().optional(),
  saleType: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 'percentage' : val,
    z.enum(['percentage', 'fixed', 'flash_sale', 'bundle', 'bogo']).default('percentage')
  ),
  saleDiscountValue: optionalPositiveNumber,
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
  stockStatus: z.enum(['in_stock', 'low_stock', 'out_of_stock', 'pre_order', 'discontinued']).catch('in_stock'),
  totalStock: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 0 : Math.max(0, Number(val) || 0),
    z.number().min(0).default(0)
  ),
  reservedStock: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 0 : Math.max(0, Number(val) || 0),
    z.number().min(0).default(0)
  ),
  availableStock: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 0 : Math.max(0, Number(val) || 0),
    z.number().min(0).default(0)
  ),
  lowStockThreshold: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 10 : Number(val),
    z.number().min(0).default(10)
  ),
  reorderPoint: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 5 : Number(val),
    z.number().min(0).default(5)
  ),
  reorderQuantity: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 50 : Number(val),
    z.number().min(1).default(50)
  ),
  lastRestockDate: z.string().nullable().optional(),
  nextRestockDate: z.string().nullable().optional(),
  tracking:  z.enum(['none', 'serial', 'lot']).default('none'),
  valuation: z.enum(['fifo', 'avco', 'standard']).default('fifo'),
  routes:    z.array(z.string()).default(['buy']),

  // Vendor & Sourcing
  vendor: z.string().optional(),
  supplierSKU: z.string().optional(),
  supplierPrice: optionalPositiveNumber,
  leadTimeDays: optionalPositiveNumber,
  minimumOrderQuantity: optionalPositiveNumber,
  estimatedShippingCost: optionalPositiveNumber,
  supplierRating: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return 0;
      if (typeof val === 'string') {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? 0 : parsed;
      }
      return val;
    },
    z.number().min(0).max(5).default(0)
  ),
  vendorNotes: z.string().optional(),
  vendorContactName: z.string().optional(),
  vendorPhone: z.string().optional(),
  vendorEmail: z.string().optional(),
  vendorWebsite: z.string().optional(),
  vendorAddress: z.string().optional(),
  
  // Status fields
  status: z.string().default('active'),
  isFeaturedByTenant: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isPublished: z.boolean().default(true),
  visibleInPOS: z.boolean().default(true),
  visibleInOnlineStore: z.boolean().default(true),
  addedAt: z.string().optional(),
  activatedAt: z.string().nullable().optional(),
  deactivatedAt: z.string().nullable().optional(),
  discontinuedAt: z.string().nullable().optional(),
  
  // Promotions & Discounts
  discount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 0 : Number(val),
    z.number().min(0).default(0)
  ),
  discountType: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 'percentage' : val,
    z.enum(['fixed', 'percentage']).default('percentage')
  ),
  discountStart: z.string().nullable().optional(),
  discountEnd: z.string().nullable().optional(),
  flashSale: z.object({
    isActive: z.boolean().default(false),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    discountPercentage: optionalPositiveNumber,
    remainingQuantity: optionalPositiveNumber,
  }).optional(),
  bundleDeals: z.array(z.object({
    name: z.string().optional(),
    products: z.array(z.string()).optional(),
    discount: optionalPositiveNumber,
    validUntil: z.string().nullable().optional(),
  })).default([]),
  
  // Shipping & Logistics
  shipping: z.object({
    weight: optionalNumber,
    length: optionalNumber,
    width: optionalNumber,
    height: optionalNumber,
    fragile: z.boolean().default(true),
    requiresAgeVerification: z.boolean().default(true),
    hazmat: z.boolean().default(false),
    shippingClass: z.string().optional(),
    carrier: z.string().optional(),
    deliveryArea: z.string().optional(),
    minDeliveryDays: optionalNumber,
    maxDeliveryDays: optionalNumber,
    fixedShippingCost: optionalNumber,
    isFreeShipping: z.boolean().default(false),
    freeShippingMinOrder: optionalNumber,
    freeShippingLabel: z.string().optional(),
    availableForPickup: z.boolean().default(false),
  }).optional(),
  warehouse: z.object({
    location: z.string().optional(),
    zone: z.string().optional(),
    aisle: z.string().optional(),
    shelf: z.string().optional(),
    bin: z.string().optional(),
  }).optional(),
});

// Main form schema - wraps subProductData to match component paths like 'subProductData.product'
export const subProductFormSchema = z.object({
  subProductData: subProductDataSchema,
}).superRefine((data, ctx) => {
  const sp = data.subProductData;
  const isCreatingNewProduct = sp.createNewProduct;

  // Either a parent product must be selected, or createNewProduct must be true
  if (!isCreatingNewProduct && (!sp.product || sp.product.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Please select a parent product or enable "Create New Product"',
      path: ['subProductData', 'product'],
    });
  }

  // When linking to an existing product, cost price is required
  if (!isCreatingNewProduct) {
    const cost = typeof sp.costPrice === 'number' ? sp.costPrice : Number(sp.costPrice);
    if (!cost || cost <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cost price must be greater than 0',
        path: ['subProductData', 'costPrice'],
      });
    }
  }

  // When creating a new product, name and type are required
  if (isCreatingNewProduct) {
    if (!sp.newProductData?.name || sp.newProductData.name.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Product name is required',
        path: ['subProductData', 'newProductData', 'name'],
      });
    }
    if (!sp.newProductData?.type || sp.newProductData.type.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Product type is required',
        path: ['subProductData', 'newProductData', 'type'],
      });
    }
  }

  // Each size variant must have a size selected
  (sp.sizes || []).forEach((size, i) => {
    if (!size.size || size.size.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Size is required',
        path: ['subProductData', 'sizes', i, 'size'],
      });
    }
  });
});

export type SubProductInput = z.infer<typeof subProductFormSchema>;
export type SubProductData = z.infer<typeof subProductDataSchema>;
export type SizeOption = z.infer<typeof sizeOptionSchema>;
