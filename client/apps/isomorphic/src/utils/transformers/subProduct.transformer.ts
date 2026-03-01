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
  _id?: string;
  id?: string;
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
  pricingStrategy?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  competitorPrice?: string;
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

const toNumber = (val: any): number | undefined => {
  if (val === null || val === undefined || val === '') return undefined;
  const num = Number(val);
  return isNaN(num) ? undefined : num;
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

const toBoolean = (val: any): boolean | undefined => {
  if (val === null || val === undefined || val === '') return undefined;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const lower = val.toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
  }
  return undefined;
};

const transformSize = (size: SizeFormData): SizeFormData => {
  const volumeMl = toNumber(size.volumeMl);
  return {
    ...size,
    unitsPerPack: toNumber(size.unitsPerPack) ?? 1,
    basePrice: toNumber(size.basePrice) ?? 0,
    costPrice: toNumber(size.costPrice) ?? 0,
    stock: toNumber(size.stock) ?? 0,
    volumeMl: volumeMl !== undefined && volumeMl > 0 ? volumeMl : 0,
    weightGrams: toNumber(size.weightGrams) ?? 0,
    servingsPerUnit: toNumber(size.servingsPerUnit) ?? 0,
    compareAtPrice: toNumber(size.compareAtPrice) ?? 0,
    wholesalePrice: toNumber(size.wholesalePrice) ?? 0,
    salePrice: toNumber(size.salePrice) ?? 0,
    saleDiscountPercentage: toNumber(size.saleDiscountPercentage) ?? 0,
    lowStockThreshold: toNumber(size.lowStockThreshold) ?? 10,
    reorderPoint: toNumber(size.reorderPoint) ?? 5,
    reorderQuantity: toNumber(size.reorderQuantity) ?? 50,
    minOrderQuantity: toNumber(size.minOrderQuantity) ?? 1,
    maxOrderQuantity: toNumber(size.maxOrderQuantity) ?? 0,
    orderIncrement: toNumber(size.orderIncrement) ?? 1,
    rank: toNumber(size.rank) ?? 1,
    availableStock: toNumber(size.availableStock) ?? 0,
    reservedStock: toNumber(size.reservedStock) ?? 0,
    isOnSale: toBoolean(size.isOnSale) ?? false,
    isDefault: toBoolean(size.isDefault) ?? false,
    isFeatured: toBoolean(size.isFeatured) ?? false,
    isBestSeller: toBoolean(size.isBestSeller) ?? false,
    isPopularSize: toBoolean(size.isPopularSize) ?? false,
    isLimitedEdition: toBoolean(size.isLimitedEdition) ?? false,
    requiresAgeVerification: toBoolean(size.requiresAgeVerification) ?? false,
  };
};

const transformNewProductData = (data: Record<string, unknown> | null | undefined): Record<string, unknown> | null => {
  if (!data) return null;
  
  const volumeMl = toNumber(data.volumeMl as string | number | null | undefined);
  const abv = toNumber(data.abv as string | number | null | undefined);
  
  return {
    ...data,
    volumeMl: volumeMl !== undefined && volumeMl > 0 ? volumeMl : undefined,
    abv: abv !== undefined && abv >= 0 ? abv : undefined,
  };
};

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
    newProductData: transformNewProductData(sp.newProductData as Record<string, unknown> | null | undefined),
    tenant: sp.tenant || '',
    sku: sp.sku || '',
    baseSellingPrice: toNumber(sp.baseSellingPrice) ?? 0,
    costPrice: toNumber(sp.costPrice) ?? 0,
    currency: sp.currency || 'NGN',
    taxRate: toNumber(sp.taxRate) ?? 0,
    marginPercentage: toNumber(sp.marginPercentage) ?? 0,
    markupPercentage: sp.markupPercentage ?? 25,
    roundUp: sp.roundUp || 'none',
    pricingStrategy: sp.pricingStrategy || 'cost_plus',
    minPrice: toNumber(sp.minPrice) ?? null,
    maxPrice: toNumber(sp.maxPrice) ?? null,
    competitorPrice: sp.competitorPrice || '',
    saleDiscountPercentage: toNumber(sp.saleDiscountPercentage) ?? 0,
    salePrice: toNumber(sp.salePrice) ?? 0,
    saleStartDate: cleanDate(sp.saleStartDate),
    saleEndDate: cleanDate(sp.saleEndDate),
    saleType: sp.saleType || '',
    saleDiscountValue: toNumber(sp.saleDiscountValue) ?? 0,
    saleBanner: sp.saleBanner || { url: '', alt: '' },
    isOnSale: toBoolean(sp.isOnSale) ?? false,
    shortDescriptionOverride: sp.shortDescriptionOverride || '',
    descriptionOverride: sp.descriptionOverride || '',
    imagesOverride: sp.imagesOverride || [],
    customKeywords: sp.customKeywords || [],
    embeddingOverride: sp.embeddingOverride || [],
    tenantNotes: sp.tenantNotes || '',
    sizes: (sp.sizes || []).map(transformSize),
    sellWithoutSizeVariants: sp.sellWithoutSizeVariants ?? false,
    defaultSize: sp.defaultSize || '',
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
    supplierPrice: toNumber(sp.supplierPrice) ?? 0,
    leadTimeDays: toNumber(sp.leadTimeDays) ?? 0,
    minimumOrderQuantity: toNumber(sp.minimumOrderQuantity) ?? 0,
    estimatedShippingCost: toNumber(sp.estimatedShippingCost) ?? 0,
    supplierRating: toNumber(sp.supplierRating) ?? 0,
    vendorNotes: sp.vendorNotes || '',
    vendorContactName: sp.vendorContactName || '',
    vendorPhone: sp.vendorPhone || '',
    vendorEmail: sp.vendorEmail || '',
    vendorWebsite: sp.vendorWebsite || '',
    vendorAddress: sp.vendorAddress || '',
    status: subProductStatus,
    isFeaturedByTenant: toBoolean(sp.isFeaturedByTenant) ?? false,
    isNewArrival: toBoolean(sp.isNewArrival) ?? false,
    isBestSeller: toBoolean(sp.isBestSeller) ?? false,
    isPublished: toBoolean(sp.isPublished) ?? false,
    visibleInPOS: toBoolean(sp.visibleInPOS) ?? true,
    visibleInOnlineStore: toBoolean(sp.visibleInOnlineStore) ?? true,
    activatedAt: sp.activatedAt ? cleanDate(sp.activatedAt) : activatedAt,
    deactivatedAt: cleanDate(sp.deactivatedAt),
    discontinuedAt: cleanDate(sp.discontinuedAt),
    discount: toNumber(sp.discount) ?? 0,
    discountType: sp.discountType || '',
    discountStart: cleanDate(sp.discountStart),
    discountEnd: cleanDate(sp.discountEnd),
    flashSale: sp.flashSale || {
      isActive: false,
      startDate: null,
      endDate: null,
      discountPercentage: 0,
      remainingQuantity: 0,
    },
    bundleDeals: sp.bundleDeals || [],
    shipping: {
      weight: toNumber(sp.shipping?.weight) ?? 0,
      length: toNumber(sp.shipping?.length) ?? 0,
      width: toNumber(sp.shipping?.width) ?? 0,
      height: toNumber(sp.shipping?.height) ?? 0,
      fragile: toBoolean(sp.shipping?.fragile) ?? true,
      requiresAgeVerification: toBoolean(sp.shipping?.requiresAgeVerification) ?? true,
      hazmat: toBoolean(sp.shipping?.hazmat) ?? false,
      shippingClass: sp.shipping?.shippingClass || '',
      carrier: sp.shipping?.carrier || '',
      deliveryArea: sp.shipping?.deliveryArea || '',
      minDeliveryDays: toNumber(sp.shipping?.minDeliveryDays) ?? 0,
      maxDeliveryDays: toNumber(sp.shipping?.maxDeliveryDays) ?? 0,
      fixedShippingCost: toNumber(sp.shipping?.fixedShippingCost) ?? 0,
      isFreeShipping: toBoolean(sp.shipping?.isFreeShipping) ?? false,
      freeShippingMinOrder: toNumber(sp.shipping?.freeShippingMinOrder) ?? 0,
      freeShippingLabel: sp.shipping?.freeShippingLabel || '',
      availableForPickup: toBoolean(sp.shipping?.availableForPickup) ?? false,
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
    volumeMl: size.volumeMl ?? 0,
    weightGrams: size.weightGrams ?? 0,
    servingsPerUnit: size.servingsPerUnit ?? 0,
    unitsPerPack: size.unitsPerPack ?? 1,
    basePrice: size.basePrice ?? 0,
    compareAtPrice: size.compareAtPrice ?? 0,
    costPrice: size.costPrice ?? 0,
    wholesalePrice: size.wholesalePrice ?? 0,
    currency: size.currency || sp.currency || 'NGN',
    markupPercentage: size.markupPercentage ?? 25,
    roundUp: size.roundUp || 'none',
    saleDiscountPercentage: size.saleDiscountPercentage ?? 0,
    salePrice: size.salePrice ?? 0,
    stock: size.stock ?? 0,
    reservedStock: size.reservedStock ?? 0,
    availableStock: size.availableStock ?? 0,
    lowStockThreshold: size.lowStockThreshold ?? 10,
    reorderPoint: size.reorderPoint ?? 5,
    reorderQuantity: size.reorderQuantity ?? 50,
    sku: size.sku || '',
    barcode: size.barcode || '',
    isDefault: toBoolean(size.isDefault) ?? false,
    isOnSale: toBoolean(size.isOnSale) ?? false,
    rank: size.rank ?? 1,
  }));

  // Return structure matching the form schema: { subProductData: { ... } }
  return {
    subProductData: {
      _id: sp._id || sp.id,
      product: productId,
      createNewProduct: false,
      newProductData: null,
      sku: sp.sku || '',
      baseSellingPrice: sp.baseSellingPrice ?? 0,
      costPrice: sp.costPrice ?? 0,
      currency: sp.currency || 'NGN',
      taxRate: sp.taxRate ?? 0,
      marginPercentage: sp.marginPercentage ?? 0,
      markupPercentage: sp.markupPercentage ?? 25,
      roundUp: sp.roundUp || 'none',
      pricingStrategy: sp.pricingStrategy || 'cost_plus',
      minPrice: sp.minPrice ?? null,
      maxPrice: sp.maxPrice ?? null,
      competitorPrice: sp.competitorPrice || '',
      saleDiscountPercentage: sp.inputSaleDiscountPercentage ?? sp.saleDiscountPercentage ?? 0,
      salePrice: sp.salePrice ?? 0,
      saleStartDate: sp.saleStartDate ? new Date(sp.saleStartDate).toISOString().slice(0, 16) : '',
      saleEndDate: sp.saleEndDate ? new Date(sp.saleEndDate).toISOString().slice(0, 16) : '',
      saleType: sp.saleType || '',
      saleDiscountValue: sp.saleDiscountValue ?? 0,
      saleBanner: sp.saleBanner || { url: '', alt: '' },
      isOnSale: toBoolean(sp.isOnSale) ?? false,
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
      lastRestockDate: sp.lastRestockDate ? new Date(sp.lastRestockDate).toISOString().slice(0, 16) : '',
      vendor: sp.vendor || '',
      supplierSKU: sp.supplierSKU || '',
      supplierPrice: sp.supplierPrice ?? 0,
      leadTimeDays: sp.leadTimeDays ?? 0,
      minimumOrderQuantity: sp.minimumOrderQuantity ?? 0,
      estimatedShippingCost: sp.estimatedShippingCost ?? 0,
      supplierRating: sp.supplierRating ?? 0,
      vendorNotes: sp.vendorNotes || '',
      vendorContactName: sp.vendorContactName || '',
      vendorPhone: sp.vendorPhone || '',
      vendorEmail: sp.vendorEmail || '',
      vendorWebsite: sp.vendorWebsite || '',
      vendorAddress: sp.vendorAddress || '',
      status: sp.status || 'draft',
      isFeaturedByTenant: toBoolean(sp.isFeaturedByTenant) ?? false,
      isNewArrival: toBoolean(sp.isNewArrival) ?? false,
      isBestSeller: toBoolean(sp.isBestSeller) ?? false,
      isPublished: toBoolean(sp.isPublished) ?? false,
      visibleInPOS: toBoolean(sp.visibleInPOS) ?? true,
      visibleInOnlineStore: toBoolean(sp.visibleInOnlineStore) ?? true,
      activatedAt: sp.activatedAt ? new Date(sp.activatedAt).toISOString().slice(0, 16) : '',
      deactivatedAt: sp.deactivatedAt ? new Date(sp.deactivatedAt).toISOString().slice(0, 16) : '',
      discontinuedAt: sp.discontinuedAt ? new Date(sp.discontinuedAt).toISOString().slice(0, 16) : '',
      discount: sp.discount ?? 0,
      discountType: sp.discountType || '',
      discountStart: sp.discountStart ? new Date(sp.discountStart).toISOString().slice(0, 16) : '',
      discountEnd: sp.discountEnd ? new Date(sp.discountEnd).toISOString().slice(0, 16) : '',
      flashSale: sp.flashSale || {
        isActive: false,
        startDate: '',
        endDate: '',
        discountPercentage: 0,
        remainingQuantity: 0,
      },
      bundleDeals: sp.bundleDeals || [],
      // Handle shipping - could be ObjectId, populated object, number (corrupt), string, or null
      shipping: (() => {
        const ship = sp.shipping;
        const emptyShipping = {
          weight: 0, length: 0, width: 0, height: 0,
          fragile: true, requiresAgeVerification: true, hazmat: false,
          shippingClass: '', carrier: '', deliveryArea: '',
          minDeliveryDays: 0, maxDeliveryDays: 0,
          fixedShippingCost: 0, isFreeShipping: false,
          freeShippingMinOrder: 0, freeShippingLabel: '', availableForPickup: false,
        };
        // Handle null, undefined, numbers (corrupt data like 6000), or non-object strings
        if (!ship || typeof ship === 'number' || typeof ship === 'string') {
          return emptyShipping;
        }
        // If it's a populated object with actual data
        if (typeof ship === 'object' && ship._id) {
          return {
            weight: ship.weight ?? 0,
            length: ship.length ?? 0,
            width: ship.width ?? 0,
            height: ship.height ?? 0,
            fragile: toBoolean(ship.fragile) ?? true,
            requiresAgeVerification: toBoolean(ship.requiresAgeVerification) ?? true,
            hazmat: toBoolean(ship.hazmat) ?? false,
            shippingClass: ship.shippingClass || '',
            carrier: ship.carrier || '',
            deliveryArea: ship.deliveryArea || '',
            minDeliveryDays: ship.minDeliveryDays ?? 0,
            maxDeliveryDays: ship.maxDeliveryDays ?? 0,
            fixedShippingCost: ship.fixedShippingCost ?? 0,
            isFreeShipping: toBoolean(ship.isFreeShipping) ?? false,
            freeShippingMinOrder: ship.freeShippingMinOrder ?? 0,
            freeShippingLabel: ship.freeShippingLabel || '',
            availableForPickup: toBoolean(ship.availableForPickup) ?? false,
          };
        }
        // If it's just an ObjectId (not populated) or any other invalid format, return empty
        return emptyShipping;
      })(),
      // Handle warehouse - could be ObjectId, populated object, number (corrupt), string, or null
      warehouse: (() => {
        const wh = sp.warehouse;
        const emptyWarehouse = { location: '', zone: '', aisle: '', shelf: '', bin: '' };
        // Handle null, undefined, numbers (corrupt data), or non-object strings
        if (!wh || typeof wh === 'number' || typeof wh === 'string') {
          return emptyWarehouse;
        }
        // If it's a populated object with actual data
        if (typeof wh === 'object' && wh._id) {
          return {
            location: wh.location || '',
            zone: wh.zone || '',
            aisle: wh.aisle || '',
            shelf: wh.shelf || '',
            bin: wh.bin || '',
          };
        }
        // If it's just an ObjectId (not populated) or any other invalid format, return empty
        return emptyWarehouse;
      })(),
    },
  };
};

export default transformFormData;
