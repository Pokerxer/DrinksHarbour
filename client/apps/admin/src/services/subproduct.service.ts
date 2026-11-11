import { readJson, readError } from './response';
// Services for subproduct API calls

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface SubProductGenerationResult {
  data: Record<string, string | string[]>;
  metadata?: { provider?: string; model?: string };
}

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
  seoH1?: string;
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

/** Response contract of POST /api/subproducts (controller wraps the populated
 * SubProduct as `data.subProduct`; `product` is a populated object on the
 * create-new-identity path, a bare id string when linking an existing one). */
export interface CreateSubProductResponse {
  success?: boolean;
  message?: string;
  data?: {
    subProduct?: {
      _id?: string;
      id?: string;
      product?: string | { name?: string; status?: string; publicationScope?: string };
    };
  };
}

export const subproductService = {
  /** Shape of POST /api/subproducts. The populated central `product` is the
   * create flow's only client-side catalogue-scope signal: with
   * GENERAL_CATALOG_SCOPE_ENABLED it carries `status` AND `publicationScope`
   * ('tenant_private' for Owner/Admin-created identities); legacy servers
   * (flag off) return pending products with NO publicationScope field. */
  async createSubProduct(
    data: CreateSubProductInput,
    token: string
  ): Promise<CreateSubProductResponse> {
    const response = await fetch(`${API_URL}/api/subproducts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await readJson<{message?: string; details?: unknown}>(response);
      const err = new Error(error.message || 'Failed to create subproduct');
      // Preserve structured details (e.g. existingSubProductId on conflicts)
      // so callers can offer an actionable next step.
      (err as any).details = error.details;
      throw err;
    }

    return readJson<CreateSubProductResponse>(response);
  },

  async getSubProducts<T = unknown>(token: string, params?: Record<string, any>): Promise<T> {
    // Convert all params to strings for URLSearchParams
    const stringParams: Record<string, string> = {};
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          stringParams[key] = String(value);
        }
      }
    }
    const queryString =
      Object.keys(stringParams).length > 0
        ? new URLSearchParams(stringParams).toString()
        : '';
    const url = `${API_URL}/api/subproducts${queryString ? `?${queryString}` : ''}`;

    console.log('SubProduct service: fetching from', url);
    console.log('Authorization token present:', !!token);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let message = errorText;
      try {
        const parsed = JSON.parse(errorText) as { message?: string };
        if (parsed?.message) message = parsed.message;
      } catch {
        // Non-JSON body (proxy error page, plain text) — use it verbatim.
      }
      // One line, with the server's own reason attached. The callers swallow
      // this error (`catch { setInitial([]) }`), so if the status is logged
      // without the reason, a 500 is undiagnosable from the browser alone.
      const reason = message || `HTTP ${response.status}`;
      console.error(
        `SubProduct service error ${response.status} on ${url}: ${reason}`
      );
      throw new Error(reason);
    }

    return readJson<T>(response);
  },

  async getSubProduct<T = unknown>(
    id: string,
    token: string,
    params?: Record<string, string>,
    signal?: AbortSignal
  ): Promise<T> {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    const response = await fetch(`${API_URL}/api/subproducts/${id}${qs}`, {
      signal,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to fetch subproduct');
    }

    return readJson<T>(response);
  },

  /**
   * Live Purchased/Sold stats for one sub-product, computed server-side from
   * Orders and PurchaseOrders (the sources the history panels read). The
   * expanded list row calls this on expand — the list payload's counters are
   * stale by construction.
   */
  async getSubProductStats<T = unknown>(
    id: string,
    token: string
  ): Promise<T> {
    const response = await fetch(`${API_URL}/api/subproducts/${id}/stats`, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to fetch product stats');
    }
    return readJson<T>(response);
  },

  async updateSubProduct(
    id: string,
    data: Partial<SubProductData>,
    token: string,
    tenantSlug?: string
  ) {
    const response = await fetch(`${API_URL}/api/subproducts/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(tenantSlug ? { 'x-tenant-slug': tenantSlug } : {}),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to update subproduct');
    }

    return readJson(response);
  },

  async deleteSubProduct(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/subproducts/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to delete subproduct');
    }

    return readJson(response);
  },

  async getSubProductsByTenant(tenantId: string, token: string) {
    const response = await fetch(
      `${API_URL}/api/subproducts/tenant/${tenantId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to fetch tenant subproducts');
    }

    return readJson(response);
  },

  async getSubProductsByProduct(productId: string, token: string) {
    const response = await fetch(
      `${API_URL}/api/subproducts/product/${productId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to fetch product subproducts');
    }

    return readJson(response);
  },

  async updateStock(id: string, stockData: any, token: string) {
    const response = await fetch(`${API_URL}/api/subproducts/${id}/stock`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(stockData),
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to update stock');
    }

    return readJson(response);
  },

  async applyDiscount(id: string, discountData: any, token: string) {
    const response = await fetch(`${API_URL}/api/subproducts/discount/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subProductId: id, ...discountData }),
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to apply discount');
    }

    return readJson(response);
  },

  async removeDiscount(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/subproducts/discount/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subProductId: id }),
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to remove discount');
    }

    return readJson(response);
  },

  async duplicateSubProduct(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/subproducts/${id}/duplicate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to duplicate subproduct');
    }

    return readJson(response);
  },

  async archiveSubProduct(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/subproducts/${id}/archive`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to archive subproduct');
    }
    return readJson(response);
  },

  async bulkPromote(
    payload: {
      ids?: string[];
      applyToAll?: boolean;
      saleType: 'percentage' | 'fixed';
      saleDiscountValue: number;
      saleStartDate?: string;
      saleEndDate?: string;
    },
    token: string
  ) {
    const response = await fetch(`${API_URL}/api/subproducts/bulk-promote`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to apply promotion');
    }
    return readJson(response);
  },

  async bulkUnpromote(
    payload: { ids?: string[]; applyToAll?: boolean },
    token: string
  ) {
    const response = await fetch(`${API_URL}/api/subproducts/bulk-unpromote`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to remove promotion');
    }
    return readJson(response);
  },

  async restoreSubProduct(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/subproducts/${id}/restore`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to restore subproduct');
    }
    return readJson(response);
  },

  async generateSubProductContent(
    productId: string | null,
    subProductId: string | null,
    token: string,
    inlineContext?: Record<string, any> | null,
    mode: 'content' | 'seo' = 'content'
  ) {
    const response = await fetch(
      `${API_URL}/api/gemini/generate-subproduct-content`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId, subProductId, inlineContext, mode }),
      }
    );

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(
        error.message || 'Failed to generate sub-product content'
      );
    }

    return readJson<SubProductGenerationResult>(response);
  },

  async adminSetSubProductStatus(
    id: string,
    status: string,
    token: string,
    priceOverrides?: {
      useTenantDefault?: boolean;
      baseWebsitePrice?: number;
      sizes?: Array<{
        id: string;
        useTenantDefault?: boolean;
        websitePrice?: number;
        packUnitPrice?: number;
      }>;
    },
    declineReason?: string
  ) {
    const response = await fetch(
      `${API_URL}/api/subproducts/${id}/admin-status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, priceOverrides, declineReason }),
      }
    );

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to update sub-product status');
    }

    return readJson(response);
  },

  /**
   * PATCH a stored Size (e.g. the purchase form committing an edited pack
   * size as the size's new default packaging quantity). Server-side
   * `subProductService.updateSize` whitelists normal size fields and gates
   * marketplace overrides.
   */
  async updateSize(
    subProductId: string,
    sizeId: string,
    patch: Record<string, unknown>,
    token: string
  ) {
    const response = await fetch(
      `${API_URL}/api/subproducts/${encodeURIComponent(subProductId)}/sizes/${encodeURIComponent(sizeId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      }
    );

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to update this size');
    }

    return readJson(response);
  },
};
