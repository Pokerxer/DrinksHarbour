import { z } from 'zod';

// Helper to convert empty strings to null for optional number fields
const optionalNumber = z.preprocess(
  (val) => {
    if (val === '' || val === null || val === undefined) return null;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    }
    return val;
  },
  z.number().nullable().optional()
);

// Helper for optional number with min(0)
const optionalPositiveNumber = z.preprocess(
  (val) => {
    if (val === '' || val === null || val === undefined) return null;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    }
    return val;
  },
  z.number().min(0).nullable().optional()
);

// Size option schema for sub-product variants
export const sizeOptionSchema = z.object({
  size: z.string().optional(),
  displayName: z.string().optional(),
  sizeCategory: z.string().optional(),
  unitType: z.string().optional(),
  volumeMl: optionalNumber,
  weightGrams: optionalNumber,
  servingsPerUnit: optionalNumber,
  unitsPerPack: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 1 : Number(val),
    z.number().default(1)
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
  roundUp: z.enum(['none', '100', '1000']).default('none'),
  saleDiscountPercentage: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 0 : Number(val),
    z.number().min(0).max(100).default(0)
  ),
  salePrice: optionalNumber,
  stock: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 0 : Number(val),
    z.number().min(0).default(0)
  ),
  reservedStock: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 0 : Number(val),
    z.number().min(0).default(0)
  ),
  availableStock: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 0 : Number(val),
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
  name: z.string().optional(),
  type: z.string().optional(),
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
  roundUp: z.enum(['none', '100', '1000']).default('none'),
  saleDiscountPercentage: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 0 : Number(val),
    z.number().min(0).max(100).default(0)
  ),
  
  // Sale / Discount Pricing
  salePrice: optionalPositiveNumber,
  saleStartDate: z.string().nullable().optional(),
  saleEndDate: z.string().nullable().optional(),
  saleType: z.enum(['percentage', 'fixed', 'flash_sale', 'bundle', 'bogo']).nullable().optional(),
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
  stockStatus: z.enum(['in_stock', 'low_stock', 'out_of_stock', 'pre_order', 'discontinued']).default('out_of_stock'),
  totalStock: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 0 : Number(val),
    z.number().min(0).default(0)
  ),
  reservedStock: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 0 : Number(val),
    z.number().min(0).default(0)
  ),
  availableStock: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? 0 : Number(val),
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
  
  // Vendor & Sourcing
  vendor: z.string().optional(),
  supplierSKU: z.string().optional(),
  supplierPrice: optionalPositiveNumber,
  leadTimeDays: optionalPositiveNumber,
  minimumOrderQuantity: optionalPositiveNumber,
  estimatedShippingCost: optionalPositiveNumber,
  supplierRating: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return null;
      if (typeof val === 'string') {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? null : parsed;
      }
      return val;
    },
    z.number().min(1).max(5).nullable().optional()
  ),
  vendorNotes: z.string().optional(),
  vendorContactName: z.string().optional(),
  vendorPhone: z.string().optional(),
  vendorEmail: z.string().optional(),
  vendorWebsite: z.string().optional(),
  vendorAddress: z.string().optional(),
  
  // Status fields
  status: z.string().default('draft'),
  isFeaturedByTenant: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isPublished: z.boolean().default(false),
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
  discountType: z.enum(['fixed', 'percentage']).nullable().optional(),
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
});

export type SubProductInput = z.infer<typeof subProductFormSchema>;
export type SubProductData = z.infer<typeof subProductDataSchema>;
export type SizeOption = z.infer<typeof sizeOptionSchema>;
