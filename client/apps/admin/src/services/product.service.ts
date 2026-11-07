import { readJson, readError } from './response';
// Services for product API calls
import { readProduct } from './product-read';
import { z } from 'zod';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

// ── Pending approval queue (super-admin) ─────────────────────────────────────
// Real endpoints: GET /api/products/admin/pending (product.service
// getPendingProducts), POST /api/products/:id/approve and POST
// /api/products/:id/reject (both super_admin-guarded server-side).

/** Catalogue publication scope — mirror of server/constants/catalogScope.js. */
export type CatalogPublicationScope = 'canonical' | 'tenant_private';

/** A populated tenant reference the admin catalog endpoints return. */
export interface PopulatedTenantRef {
  _id: string;
  name: string;
  slug?: string;
}

export interface PendingProductDTO {
  _id: string;
  name: string;
  slug?: string;
  type?: string;
  status?: string;
  imageUrl?: string;
  brandName?: string;
  categoryName?: string;
  /** Absent on legacy rows (pre-scope documents) — they read as canonical. */
  publicationScope?: CatalogPublicationScope;
  /** Populated owning tenant display data, when the endpoint returned it. */
  owningTenantName?: string;
  submittingTenantName?: string;
  /** How the product entered the queue: 'tenant' | 'admin' | 'importer' | … */
  submissionSource?: string;
  createdAt?: string;
}

export interface PendingProductPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PendingProductsPageDTO {
  products: PendingProductDTO[];
  pagination: PendingProductPagination;
}

export interface PendingProductsListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  submittingTenant?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Populated tenant refs can come back as the object or a bare id depending on
// how far upstream the populate ran — tolerate both, keep what displays.
const populatedRefSchema = z.union([
  z.object({
    _id: z.string(),
    name: z.string(),
    slug: z.string().optional(),
  }),
  z.string(),
]);
const tenantNameSchema = populatedRefSchema
  .transform((value) => (typeof value === 'string' ? undefined : value.name))
  .nullish()
  .transform((value) => value ?? undefined);
const imageSchema = z.object({
  url: z.string(),
  alt: z.string().optional(),
  isPrimary: z.boolean().optional(),
});
const pendingProductSchema = z
  .object({
    _id: z.string(),
    name: z.string(),
    slug: z.string().optional(),
    type: z.string().optional(),
    status: z.string().optional(),
    images: z.array(imageSchema).nullish(),
    brand: populatedRefSchema.nullish(),
    category: populatedRefSchema.nullish(),
    publicationScope: z
      .enum(['canonical', 'tenant_private'])
      .nullish()
      .transform((value) => value ?? undefined),
    owningTenant: tenantNameSchema,
    submittingTenant: tenantNameSchema,
    submissionSource: z.string().nullish().transform((v) => v ?? undefined),
    createdAt: z.string().or(z.number()).nullish().transform((v) =>
      v === null || v === undefined ? undefined : String(v)
    ),
  })
  .transform((product) => ({
    _id: product._id,
    name: product.name,
    slug: product.slug,
    type: product.type,
    status: product.status,
    imageUrl: product.images?.find((i) => i.isPrimary)?.url ?? product.images?.[0]?.url,
    brandName:
      product.brand && typeof product.brand === 'object' ? product.brand.name : undefined,
    categoryName:
      product.category && typeof product.category === 'object'
        ? product.category.name
        : undefined,
    publicationScope: product.publicationScope,
    owningTenantName: product.owningTenant,
    submittingTenantName: product.submittingTenant,
    submissionSource: product.submissionSource,
    createdAt: product.createdAt,
  }));
const pendingPageSchema = z.object({
  products: z.array(pendingProductSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    pages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});

interface ProductData {
  name: string;
  type: string;
  category: string;
  description?: string;
  basePrice?: number;
  images?: Array<{
    url: string;
    alt?: string;
    isPrimary?: boolean;
  }>;
  [key: string]: any;
}

export const productService = {
  async createProduct(data: ProductData, token: string) {
    const response = await fetch(`${API_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to create product');
    }

    return readJson(response);
  },

  async createSubProduct(data: ProductData, token: string) {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    console.log('=== SERVICE CALL ===');
    console.log('URL:', `${API_URL}/api/subproducts`);
    console.log('Token exists:', !!token);
    console.log('Token length:', token?.length);
    
    try {
      const response = await fetch(`${API_URL}/api/subproducts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const error = await readError(response);
        console.log('Response error:', error);
        throw new Error(error.message || 'Failed to create sub product');
      }

      return readJson(response);
    } catch (err: any) {
      console.error('Fetch error:', err);
      throw err;
    }
  },

  async getProducts(token: string, params?: Record<string, any>) {
    // Use admin/list endpoint — returns ALL products from DB regardless of status/tenant
    const queryString = params ? new URLSearchParams(params).toString() : '';
    const url = `${API_URL}/api/products/admin/list${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to fetch products');
    }

    return readJson(response);
  },

  async getProductById(id: string, token: string, includePending: boolean = false, signal?: AbortSignal) {
    const url = includePending
      ? `${API_URL}/api/products/${id}?includePending=true`
      : `${API_URL}/api/products/${id}`;
    return readProduct(url, token, signal);
  },

  async getAdminProductDetails(id: string, token: string, signal?: AbortSignal) {
    return readProduct(`${API_URL}/api/products/admin/${id}/details`, token, signal);
  },

  async getProductSalesHistory(id: string, token: string, signal?: AbortSignal) {
    return readProduct(`${API_URL}/api/products/admin/${id}/sales`, token, signal);
  },

  /**
   * Industry-scoped size guidance (2026-11-03): the server's
   * getSizesForType(type) — the single sizing authority. Fashion types get
   * apparel/numeric/waist/inseam/kids/shoe sizes; beverage keeps its bottle
   * families. Always includes 'custom'/'variable' escape hatches.
   */
  async getSizeGuidance(token: string, type: string, signal?: AbortSignal): Promise<string[]> {
    const response = await fetch(
      `${API_URL}/api/products/size-guidance?type=${encodeURIComponent(type)}`,
      { headers: { Authorization: `Bearer ${token}` }, signal },
    );
    if (!response.ok) {
      throw new Error('Failed to fetch size guidance');
    }
    const result = (await response.json()) as { data?: { sizes?: string[] } };
    return result?.data?.sizes || [];
  },

  async getProductStock(id: string, token: string, signal?: AbortSignal) {
    return readProduct(`${API_URL}/api/products/admin/${id}/stock`, token, signal);
  },

  async updateProduct(id: string, data: Partial<ProductData>, token: string) {
    const response = await fetch(`${API_URL}/api/products/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to update product');
    }

    return readJson(response);
  },

  async generateCatalogContent(productId: string, token: string, mode: 'content' | 'seo') {
    const response = await fetch(`${API_URL}/api/gemini/generate-subproduct-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ productId, target: 'product', mode }),
    });
    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to generate product draft');
    }
    return readJson<{ data: Record<string, string | string[]>; metadata?: { provider?: string; model?: string } }>(response);
  },

  async generateFromSubProduct(productId: string, token: string) {
    const response = await fetch(`${API_URL}/api/gemini/generate-from-subproduct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ productId }),
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to generate product details');
    }

    return readJson(response);
  },

  async deleteProduct(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/products/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to delete product');
    }

    return readJson(response);
  },

  // ── Pending approval queue (super-admin) ──────────────────────────

  /**
   * Pending central products awaiting super-admin approval. Supports the
   * service's filters (query names mirror server/controllers
   * productController.getPendingProducts: `tenant`, `type`, `search`).
   */
  async getPendingProducts(
    token: string,
    params?: PendingProductsListParams,
    signal?: AbortSignal
  ): Promise<PendingProductsPageDTO> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search?.trim()) query.set('search', params.search.trim());
    if (params?.type?.trim()) query.set('type', params.type.trim());
    if (params?.submittingTenant?.trim())
      query.set('tenant', params.submittingTenant.trim());
    if (params?.sort) query.set('sort', params.sort);
    if (params?.order) query.set('order', params.order);
    const qs = query.toString();

    const response = await fetch(
      `${API_URL}/api/products/admin/pending${qs ? `?${qs}` : ''}`,
      {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
        signal,
      }
    );
    if (!response.ok) {
      const error = await readError(response);
      throw new Error(
        error.message || 'Failed to load the pending products queue'
      );
    }
    const result = await readJson<{ data?: unknown }>(response);
    // The endpoint always wraps in `{ success, data: { products, pagination } }`
    // — unwrap it, falling back to a bare payload for future endpoints.
    return pendingPageSchema.parse(
      result && typeof result === 'object' && 'data' in result
        ? result.data
        : result
    );
  },

  /** Approve a pending central product (super-admin only, server-guarded). */
  async approveProduct(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/products/${id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to approve product');
    }

    return readJson<{ success: boolean; message: string }>(response);
  },

  /** Reject a pending central product — the server records the reason. */
  async rejectProduct(id: string, token: string, reason: string) {
    const response = await fetch(`${API_URL}/api/products/${id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      const error = await readError(response);
      throw new Error(error.message || 'Failed to reject product');
    }

    return readJson<{ success: boolean; message: string }>(response);
  },
};
