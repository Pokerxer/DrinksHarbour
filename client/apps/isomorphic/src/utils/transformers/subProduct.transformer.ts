// utils/transformers/subProduct.transformer.ts
// Transforms form data to API-ready format for SubProduct creation

export interface SizeFormData {
  size: string;
  displayName?: string;
  sizeCategory?: string;
  unitType?: string;
  volumeMl?: number | null;
  weightGrams?: number | null;
  servingsPerUnit?: number | null;
  unitsPerPack?: number;
  basePrice?: number | null;
  compareAtPrice?: number | null;
  costPrice?: number | null;
  wholesalePrice?: number | null;
  currency?: string;
  markupPercentage?: number;
  roundUp?: string;
  saleDiscountPercentage?: number;
  salePrice?: number | null;
  stock?: number;
  reservedStock?: number;
  availableStock?: number;
  lowStockThreshold?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  availability?: string;
  sku?: string;
  barcode?: string;
  packaging?: string;
  minOrderQuantity?: number;
  maxOrderQuantity?: number | null;
  orderIncrement?: number;
  requiresAgeVerification?: boolean;
  isDefault?: boolean;
  isOnSale?: boolean;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isPopularSize?: boolean;
  isLimitedEdition?: boolean;
  rank?: number;
}

export interface SubProductFormData {
  product: string;
  tenant?: string;
  sku: string;
  baseSellingPrice?: number | null;
  costPrice?: number | null;
  currency?: string;
  taxRate?: number;
  marginPercentage?: number | null;
  markupPercentage?: number;
  roundUp?: string;
  saleDiscountPercentage?: number;
  salePrice?: number | null;
  saleStartDate?: string | null;
  saleEndDate?: string | null;
  saleType?: string;
  saleDiscountValue?: number | null;
  saleBanner?: { url?: string; alt?: string };
  isOnSale?: boolean;
  shortDescriptionOverride?: string;
  descriptionOverride?: string;
  imagesOverride?: Array<{
    url: string;
    alt?: string;
    isPrimary?: boolean;
    order?: number;
  }>;
  customKeywords?: string[];
  embeddingOverride?: number[];
  tenantNotes?: string;
  sizes: SizeFormData[];
  sellWithoutSizeVariants?: boolean;
  defaultSize?: string;
  stockStatus?: string;
  totalStock?: number;
  reservedStock?: number;
  availableStock?: number;
  lowStockThreshold?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  lastRestockDate?: string | null;
  nextRestockDate?: string | null;
  vendor?: string;
  supplierSKU?: string;
  supplierPrice?: number | null;
  leadTimeDays?: number | null;
  minimumOrderQuantity?: number | null;
  estimatedShippingCost?: number | null;
  supplierRating?: number | null;
  vendorNotes?: string;
  vendorContactName?: string;
  vendorPhone?: string;
  vendorEmail?: string;
  vendorWebsite?: string;
  vendorAddress?: string;
  status?: string;
  isFeaturedByTenant?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  isPublished?: boolean;
  visibleInPOS?: boolean;
  visibleInOnlineStore?: boolean;
  activatedAt?: string | null;
  deactivatedAt?: string | null;
  discontinuedAt?: string | null;
  discount?: number;
  discountType?: string;
  discountStart?: string | null;
  discountEnd?: string | null;
  flashSale?: {
    isActive?: boolean;
    startDate?: string | null;
    endDate?: string | null;
    discountPercentage?: number | null;
    remainingQuantity?: number | null;
  };
  bundleDeals?: Array<{
    name?: string;
    products?: string[];
    discount?: number | null;
    validUntil?: string | null;
  }>;
  shipping?: {
    weight?: number | null;
    length?: number | null;
    width?: number | null;
    height?: number | null;
    fragile?: boolean;
    requiresAgeVerification?: boolean;
    hazmat?: boolean;
    shippingClass?: string;
    carrier?: string;
    deliveryArea?: string;
    minDeliveryDays?: number | null;
    maxDeliveryDays?: number | null;
    fixedShippingCost?: number | null;
    isFreeShipping?: boolean;
    freeShippingMinOrder?: number | null;
    freeShippingLabel?: string;
    availableForPickup?: boolean;
  };
  warehouse?: {
    location?: string;
    zone?: string;
    aisle?: string;
    shelf?: string;
    bin?: string;
  };
  // Product creation flags for "create new product" workflow
  createNewProduct?: boolean;
  newProductData?: Record<string, any> | null;
}

// Form data structure matching the schema: { subProductData: { ... } }
export interface SubProductFormInput {
  subProductData: SubProductFormData;
}

const toNumber = (val: any): number | null => {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
};

const cleanDate = (val: any): string | null => {
  if (!val || val === '') return null;
  try {
    const date = new Date(val);
    return isNaN(date.getTime()) ? null : date.toISOString();
  } catch {
    return null;
  }
};

const extractValue = (val: any): any => {
  if (val && typeof val === 'object' && val.target) {
    return val.target.checked ?? val.target.value ?? false;
  }
  return val;
};

const transformSize = (size: SizeFormData): SizeFormData => ({
  ...size,
  unitsPerPack: toNumber(size.unitsPerPack) ?? 1,
  basePrice: toNumber(size.basePrice),
  costPrice: toNumber(size.costPrice),
  stock: toNumber(size.stock) ?? 0,
  volumeMl: toNumber(size.volumeMl),
  weightGrams: toNumber(size.weightGrams),
  servingsPerUnit: toNumber(size.servingsPerUnit),
  compareAtPrice: toNumber(size.compareAtPrice),
  wholesalePrice: toNumber(size.wholesalePrice),
  salePrice: toNumber(size.salePrice),
  saleDiscountPercentage: toNumber(size.saleDiscountPercentage) ?? 0,
  lowStockThreshold: toNumber(size.lowStockThreshold) ?? 10,
  reorderPoint: toNumber(size.reorderPoint) ?? 5,
  reorderQuantity: toNumber(size.reorderQuantity) ?? 50,
  minOrderQuantity: toNumber(size.minOrderQuantity) ?? 1,
  maxOrderQuantity: toNumber(size.maxOrderQuantity),
  orderIncrement: toNumber(size.orderIncrement) ?? 1,
  rank: toNumber(size.rank) ?? 1,
  availableStock: toNumber(size.availableStock) ?? (size.stock || 0),
  reservedStock: toNumber(size.reservedStock) ?? 0,
});

export const transformFormData = (data: SubProductFormInput) => {
  // Direct access to subProductData - form structure is { subProductData: { ... } }
  const sp = data.subProductData || {};
  
  // Get product name from newProductData if creating new product
  const name = sp.newProductData?.name || '';
  const slug = name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '';
  const subProductStatus = sp.isPublished ? 'active' : 'draft';
  const activatedAt = sp.isPublished ? new Date().toISOString() : null;

  const subProductData: SubProductFormData = {
    product: sp.product || '',
    createNewProduct: sp.createNewProduct ?? false,
    newProductData: sp.newProductData || null,
    tenant: sp.tenant || '',
    sku: sp.sku || '',
    baseSellingPrice: toNumber(sp.baseSellingPrice),
    costPrice: toNumber(sp.costPrice),
    currency: sp.currency || 'NGN',
    taxRate: toNumber(sp.taxRate) ?? 0,
    marginPercentage: toNumber(sp.marginPercentage),
    markupPercentage: sp.markupPercentage ?? 25,
    roundUp: sp.roundUp || 'none',
    saleDiscountPercentage: toNumber(sp.saleDiscountPercentage) ?? 0,
    salePrice: toNumber(sp.salePrice),
    saleStartDate: cleanDate(sp.saleStartDate),
    saleEndDate: cleanDate(sp.saleEndDate),
    saleType: sp.saleType,
    saleDiscountValue: toNumber(sp.saleDiscountValue),
    saleBanner: sp.saleBanner || { url: '', alt: '' },
    isOnSale: extractValue(sp.isOnSale) ?? false,
    shortDescriptionOverride: sp.shortDescriptionOverride || '',
    descriptionOverride: sp.descriptionOverride || '',
    imagesOverride: sp.imagesOverride || [],
    customKeywords: sp.customKeywords || [],
    embeddingOverride: sp.embeddingOverride || [],
    tenantNotes: sp.tenantNotes || '',
    sizes: (sp.sizes || []).map(transformSize),
    sellWithoutSizeVariants: sp.sellWithoutSizeVariants ?? false,
    defaultSize: sp.defaultSize,
    stockStatus: sp.stockStatus || 'in_stock',
    totalStock: toNumber(sp.totalStock) ?? 0,
    reservedStock: toNumber(sp.reservedStock) ?? 0,
    availableStock: toNumber(sp.availableStock) ?? 0,
    lowStockThreshold: toNumber(sp.lowStockThreshold) ?? 10,
    reorderPoint: toNumber(sp.reorderPoint) ?? 5,
    reorderQuantity: toNumber(sp.reorderQuantity) ?? 50,
    lastRestockDate: cleanDate(sp.lastRestockDate),
    nextRestockDate: cleanDate(sp.nextRestockDate),
    vendor: sp.vendor || '',
    supplierSKU: sp.supplierSKU || '',
    supplierPrice: toNumber(sp.supplierPrice),
    leadTimeDays: toNumber(sp.leadTimeDays),
    minimumOrderQuantity: toNumber(sp.minimumOrderQuantity),
    estimatedShippingCost: toNumber(sp.estimatedShippingCost),
    supplierRating: toNumber(sp.supplierRating),
    vendorNotes: sp.vendorNotes || '',
    vendorContactName: sp.vendorContactName || '',
    vendorPhone: sp.vendorPhone || '',
    vendorEmail: sp.vendorEmail || '',
    vendorWebsite: sp.vendorWebsite || '',
    vendorAddress: sp.vendorAddress || '',
    status: subProductStatus,
    isFeaturedByTenant: sp.isFeaturedByTenant ?? false,
    isNewArrival: sp.isNewArrival ?? false,
    isBestSeller: sp.isBestSeller ?? false,
    isPublished: sp.isPublished ?? false,
    visibleInPOS: sp.visibleInPOS ?? true,
    visibleInOnlineStore: sp.visibleInOnlineStore ?? true,
    activatedAt: sp.activatedAt ? cleanDate(sp.activatedAt) : activatedAt,
    deactivatedAt: cleanDate(sp.deactivatedAt),
    discontinuedAt: cleanDate(sp.discontinuedAt),
    discount: toNumber(sp.discount) ?? 0,
    discountType: sp.discountType,
    discountStart: cleanDate(sp.discountStart),
    discountEnd: cleanDate(sp.discountEnd),
    flashSale: sp.flashSale || {
      isActive: false,
      startDate: null,
      endDate: null,
      discountPercentage: null,
      remainingQuantity: null,
    },
    bundleDeals: sp.bundleDeals || [],
    shipping: {
      weight: toNumber(sp.shipping?.weight),
      length: toNumber(sp.shipping?.length),
      width: toNumber(sp.shipping?.width),
      height: toNumber(sp.shipping?.height),
      fragile: sp.shipping?.fragile ?? true,
      requiresAgeVerification: sp.shipping?.requiresAgeVerification ?? true,
      hazmat: sp.shipping?.hazmat ?? false,
      shippingClass: sp.shipping?.shippingClass || '',
      carrier: sp.shipping?.carrier || '',
      deliveryArea: sp.shipping?.deliveryArea || '',
      minDeliveryDays: toNumber(sp.shipping?.minDeliveryDays),
      maxDeliveryDays: toNumber(sp.shipping?.maxDeliveryDays),
      fixedShippingCost: toNumber(sp.shipping?.fixedShippingCost),
      isFreeShipping: sp.shipping?.isFreeShipping ?? false,
      freeShippingMinOrder: toNumber(sp.shipping?.freeShippingMinOrder),
      freeShippingLabel: sp.shipping?.freeShippingLabel || '',
      availableForPickup: sp.shipping?.availableForPickup ?? false,
    },
    warehouse: {
      location: sp.warehouse?.location || '',
      zone: sp.warehouse?.zone || '',
      aisle: sp.warehouse?.aisle || '',
      shelf: sp.warehouse?.shelf || '',
      bin: sp.warehouse?.bin || '',
    },
  };

  // Return the subProductData ready for the server
  // If creating a new product, include the newProductData
  return subProductData;
};

export const validateRequiredFields = (data: SubProductFormInput): string[] => {
  const missing: string[] = [];
  const sp = data.subProductData || {};

  // Check product - either existing product OR new product being created
  const productId = sp.product;
  const createNew = sp.createNewProduct;
  const newProductData = sp.newProductData;
  const hasProduct = productId || 
    (createNew === true && newProductData?.name && newProductData?.type);
  
  if (!hasProduct) missing.push('Product');
  
  // Cost price is optional when creating new product
  const costPrice = toNumber(sp.costPrice);
  if (!createNew && (!costPrice || costPrice <= 0)) missing.push('Cost Price');

  return missing;
};

// Transform backend response to form data format for editing
export const transformBackendToForm = (backendData: any): SubProductFormInput => {
  const sp = backendData;
  const product = sp.product || {};

  // Extract product ID whether it's in _id or id format
  const productId = product._id || product.id || '';
  
  // Transform sizes from backend format
  const transformedSizes = (sp.sizes || []).map((size: any) => ({
    size: size.size || '',
    displayName: size.displayName || '',
    sizeCategory: size.sizeCategory || '',
    unitType: size.unitType || 'volume_ml',
    volumeMl: size.volumeMl ?? null,
    weightGrams: size.weightGrams ?? null,
    servingsPerUnit: size.servingsPerUnit ?? null,
    unitsPerPack: size.unitsPerPack ?? 1,
    basePrice: size.basePrice ?? null,
    compareAtPrice: size.compareAtPrice ?? null,
    costPrice: size.costPrice ?? null,
    wholesalePrice: size.wholesalePrice ?? null,
    currency: size.currency || sp.currency || 'NGN',
    markupPercentage: size.markupPercentage ?? 25,
    roundUp: size.roundUp || 'none',
    saleDiscountPercentage: size.saleDiscountPercentage ?? 0,
    salePrice: size.salePrice ?? null,
    stock: size.stock ?? 0,
    reservedStock: size.reservedStock ?? 0,
    availableStock: size.availableStock ?? 0,
    lowStockThreshold: size.lowStockThreshold ?? 10,
    reorderPoint: size.reorderPoint ?? 5,
    reorderQuantity: size.reorderQuantity ?? 50,
    sku: size.sku || '',
    barcode: size.barcode || '',
    isDefault: size.isDefault ?? false,
    isOnSale: size.isOnSale ?? false,
    rank: size.rank ?? 1,
  }));

  // Return structure matching the form schema: { subProductData: { ... } }
  return {
    subProductData: {
      product: productId,
      createNewProduct: false,
      newProductData: null,
      sku: sp.sku || '',
      baseSellingPrice: sp.baseSellingPrice ?? null,
      costPrice: sp.costPrice ?? null,
      currency: sp.currency || 'NGN',
      taxRate: sp.taxRate ?? 0,
      marginPercentage: sp.marginPercentage ?? null,
      markupPercentage: sp.markupPercentage ?? 25,
      roundUp: sp.roundUp || 'none',
      saleDiscountPercentage: sp.inputSaleDiscountPercentage ?? sp.saleDiscountPercentage ?? 0,
      salePrice: sp.salePrice ?? null,
      saleStartDate: sp.saleStartDate ? new Date(sp.saleStartDate).toISOString().slice(0, 16) : null,
      saleEndDate: sp.saleEndDate ? new Date(sp.saleEndDate).toISOString().slice(0, 16) : null,
      saleType: sp.saleType || '',
      saleDiscountValue: sp.saleDiscountValue ?? null,
      saleBanner: sp.saleBanner || { url: '', alt: '' },
      isOnSale: sp.isOnSale ?? false,
      shortDescriptionOverride: sp.shortDescriptionOverride || '',
      descriptionOverride: sp.descriptionOverride || '',
      imagesOverride: sp.imagesOverride || [],
      customKeywords: sp.customKeywords || [],
      embeddingOverride: sp.embeddingOverride || [],
      tenantNotes: sp.tenantNotes || '',
      sizes: transformedSizes,
      sellWithoutSizeVariants: sp.sellWithoutSizeVariants ?? false,
      defaultSize: sp.defaultSize?._id || sp.defaultSize || '',
      stockStatus: sp.stockStatus || 'in_stock',
      totalStock: sp.totalStock ?? 0,
      reservedStock: sp.reservedStock ?? 0,
      availableStock: sp.availableStock ?? 0,
      lowStockThreshold: sp.lowStockThreshold ?? 10,
      reorderPoint: sp.reorderPoint ?? 5,
      reorderQuantity: sp.reorderQuantity ?? 50,
      lastRestockDate: sp.lastRestockDate ? new Date(sp.lastRestockDate).toISOString().slice(0, 16) : null,
      nextRestockDate: sp.nextRestockDate ? new Date(sp.nextRestockDate).toISOString().slice(0, 16) : null,
      vendor: sp.vendor || '',
      supplierSKU: sp.supplierSKU || '',
      supplierPrice: sp.supplierPrice ?? null,
      leadTimeDays: sp.leadTimeDays ?? null,
      minimumOrderQuantity: sp.minimumOrderQuantity ?? null,
      estimatedShippingCost: sp.estimatedShippingCost ?? null,
      supplierRating: sp.supplierRating ?? null,
      vendorNotes: sp.vendorNotes || '',
      vendorContactName: sp.vendorContactName || '',
      vendorPhone: sp.vendorPhone || '',
      vendorEmail: sp.vendorEmail || '',
      vendorWebsite: sp.vendorWebsite || '',
      vendorAddress: sp.vendorAddress || '',
      status: sp.status || 'draft',
      isFeaturedByTenant: sp.isFeaturedByTenant ?? false,
      isNewArrival: sp.isNewArrival ?? false,
      isBestSeller: sp.isBestSeller ?? false,
      isPublished: sp.isPublished ?? false,
      visibleInPOS: sp.visibleInPOS ?? true,
      visibleInOnlineStore: sp.visibleInOnlineStore ?? true,
      activatedAt: sp.activatedAt ? new Date(sp.activatedAt).toISOString().slice(0, 16) : null,
      deactivatedAt: sp.deactivatedAt ? new Date(sp.deactivatedAt).toISOString().slice(0, 16) : null,
      discontinuedAt: sp.discontinuedAt ? new Date(sp.discontinuedAt).toISOString().slice(0, 16) : null,
      discount: sp.discount ?? 0,
      discountType: sp.discountType || '',
      discountStart: sp.discountStart ? new Date(sp.discountStart).toISOString().slice(0, 16) : null,
      discountEnd: sp.discountEnd ? new Date(sp.discountEnd).toISOString().slice(0, 16) : null,
      flashSale: sp.flashSale || {
        isActive: false,
        startDate: null,
        endDate: null,
        discountPercentage: null,
        remainingQuantity: null,
      },
      bundleDeals: sp.bundleDeals || [],
      shipping: sp.shipping ? {
        weight: sp.shipping.weight ?? null,
        length: sp.shipping.length ?? null,
        width: sp.shipping.width ?? null,
        height: sp.shipping.height ?? null,
        fragile: sp.shipping.fragile ?? true,
        requiresAgeVerification: sp.shipping.requiresAgeVerification ?? true,
        hazmat: sp.shipping.hazmat ?? false,
        shippingClass: sp.shipping.shippingClass || '',
        carrier: sp.shipping.carrier || '',
        deliveryArea: sp.shipping.deliveryArea || '',
        minDeliveryDays: sp.shipping.minDeliveryDays ?? null,
        maxDeliveryDays: sp.shipping.maxDeliveryDays ?? null,
        fixedShippingCost: sp.shipping.fixedShippingCost ?? null,
        isFreeShipping: sp.shipping.isFreeShipping ?? false,
        freeShippingMinOrder: sp.shipping.freeShippingMinOrder ?? null,
        freeShippingLabel: sp.shipping.freeShippingLabel || '',
        availableForPickup: sp.shipping.availableForPickup ?? false,
      } : {
        weight: null,
        length: null,
        width: null,
        height: null,
        fragile: true,
        requiresAgeVerification: true,
        hazmat: false,
        shippingClass: '',
        carrier: '',
        deliveryArea: '',
        minDeliveryDays: null,
        maxDeliveryDays: null,
        fixedShippingCost: null,
        isFreeShipping: false,
        freeShippingMinOrder: null,
        freeShippingLabel: '',
        availableForPickup: false,
      },
      warehouse: sp.warehouse || {
        location: '',
        zone: '',
        aisle: '',
        shelf: '',
        bin: '',
      },
    },
  };
};

export default transformFormData;
