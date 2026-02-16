// Services for subproduct API calls

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface SizeData {
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

export interface SubProductData {
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
  sizes?: SizeData[];
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
  status?: string;
  isFeaturedByTenant?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
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
  };
  warehouse?: {
    location?: string;
    zone?: string;
    aisle?: string;
    shelf?: string;
    bin?: string;
  };
}

export interface CreateSubProductInput {
  name: string;
  slug?: string;
  sku?: string;
  barcode?: string;
  gtin?: string;
  upc?: string;
  type: string;
  subType?: string;
  isAlcoholic?: boolean;
  abv?: number | null;
  proof?: number | null;
  volumeMl?: number | null;
  standardSizes?: string[];
  servingSize?: string;
  servingsPerContainer?: number | null;
  originCountry?: string;
  region?: string;
  appellation?: string;
  producer?: string;
  brand?: string;
  vintage?: number | null;
  age?: number | null;
  ageStatement?: string;
  distilleryName?: string;
  breweryName?: string;
  wineryName?: string;
  productionMethod?: string;
  caskType?: string;
  finish?: string;
  category?: string;
  subCategory?: string;
  tags?: string[];
  flavors?: string[];
  style?: string;
  shortDescription?: string;
  description?: string;
  tastingNotes?: {
    nose?: string[];
    aroma?: string[];
    palate?: string[];
    taste?: string[];
    finish?: string[];
    mouthfeel?: string[];
    appearance?: string;
    color?: string;
  };
  flavorProfile?: string[];
  foodPairings?: string[];
  servingSuggestions?: {
    temperature?: string;
    glassware?: string;
    garnish?: string[];
    mixers?: string[];
  };
  isDietary?: {
    vegan?: boolean;
    vegetarian?: boolean;
    glutenFree?: boolean;
    dairyFree?: boolean;
    organic?: boolean;
    kosher?: boolean;
    halal?: boolean;
    sugarFree?: boolean;
    lowCalorie?: boolean;
    lowCarb?: boolean;
  };
  allergens?: string[];
  ingredients?: string[];
  nutritionalInfo?: {
    calories?: number | null;
    carbohydrates?: number | null;
    sugar?: number | null;
    protein?: number | null;
    fat?: number | null;
    sodium?: number | null;
    caffeine?: number | null;
  };
  certifications?: Array<{
    name?: string;
    issuedBy?: string;
    year?: number | null;
  }>;
  awards?: Array<{
    title?: string;
    organization?: string;
    year?: number | null;
    medal?: string;
    score?: number | null;
  }>;
  ratings?: {
    wineSpectator?: number | null;
    robertParker?: number | null;
    jamesSuckling?: number | null;
    decanter?: number | null;
    whiskyAdvocate?: number | null;
    jimMurray?: number | null;
    untappd?: number | null;
  };
  averageRating?: number;
  reviewCount?: number;
  images?: Array<{
    url: string;
    alt?: string;
    isPrimary?: boolean;
    order?: number;
  }>;
  uploadedImages?: Array<{
    url?: string;
    publicId?: string;
    thumbnail?: string;
    isPrimary?: boolean;
  }>;
  videos?: Array<{
    url?: string;
    type?: string;
    thumbnail?: string;
    title?: string;
  }>;
  relatedProducts?: string[];
  externalLinks?: Array<{
    name?: string;
    url?: string;
    type?: string;
  }>;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  canonicalUrl?: string;
  isFeatured?: boolean;
  allowReviews?: boolean;
  requiresAgeVerification?: boolean;
  isPublished?: boolean;
  publishedAt?: string | null;
  discontinuedAt?: string | null;
  subProductData: SubProductData;
}

export const subproductService = {
  async createSubProduct(data: CreateSubProductInput, token: string) {
    const response = await fetch(`${API_URL}/api/subproducts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create subproduct');
    }

    return response.json();
  },

  async getSubProducts(token: string, params?: Record<string, any>) {
    const queryString = params ? new URLSearchParams(params).toString() : '';
    const url = `${API_URL}/api/subproducts${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch subproducts');
    }

    return response.json();
  },

  async getSubProduct(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/subproducts/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch subproduct');
    }

    return response.json();
  },

  async updateSubProduct(id: string, data: Partial<SubProductData>, token: string) {
    const response = await fetch(`${API_URL}/api/subproducts/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update subproduct');
    }

    return response.json();
  },

  async deleteSubProduct(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/subproducts/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete subproduct');
    }

    return response.json();
  },

  async getSubProductsByTenant(tenantId: string, token: string) {
    const response = await fetch(`${API_URL}/api/subproducts/tenant/${tenantId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch tenant subproducts');
    }

    return response.json();
  },

  async getSubProductsByProduct(productId: string, token: string) {
    const response = await fetch(`${API_URL}/api/subproducts/product/${productId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch product subproducts');
    }

    return response.json();
  },

  async updateStock(id: string, stockData: any, token: string) {
    const response = await fetch(`${API_URL}/api/subproducts/${id}/stock`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(stockData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update stock');
    }

    return response.json();
  },

  async applyDiscount(id: string, discountData: any, token: string) {
    const response = await fetch(`${API_URL}/api/subproducts/discount/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ subProductId: id, ...discountData }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to apply discount');
    }

    return response.json();
  },

  async removeDiscount(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/subproducts/discount/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ subProductId: id }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to remove discount');
    }

    return response.json();
  },

  async duplicateSubProduct(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/subproducts/${id}/duplicate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to duplicate subproduct');
    }

    return response.json();
  },

  async archiveSubProduct(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/subproducts/${id}/archive`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to archive subproduct');
    }

    return response.json();
  },
};
