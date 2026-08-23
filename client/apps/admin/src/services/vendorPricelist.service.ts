// services/vendorPricelist.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface VendorPricelist {
  _id: string;
  name: string;
  vendor?: string;
  vendorName: string;
  currency: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  discountPercent: number;
  notes?: string;
  items: PricelistItem[];
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  source?: 'manual' | 'auto';
  autoManaged?: boolean;
  lastSyncedAt?: string;
  lastSyncedPO?: { id?: string; poNumber?: string };
  updatedAt?: string;
}

export interface HistoryEntry {
  unitPrice: number;
  basePrice?: number;
  date?: string;
  source: 'po' | 'manual';
  poId?: string;
  poNumber?: string;
  userId?: string;
  changePercent?: number;
}

export interface PricelistItem {
  subProductId: string;
  subProductName: string;
  sku?: string;
  productName?: string;
  sizeId?: string;
  sizeName?: string;
  vendorProductCode?: string;
  vendorProductName?: string;
  basePrice?: number;
  unitPrice: number;
  discountPercent: number;
  minQuantity: number;
  maxQuantity?: number;
  leadTimeDays: number;
  packaging?: string;
  packagingQty: number;
  isPreferred: boolean;
  lastPriceUpdate?: string;
  previousPrice?: number;
  previousPriceDate?: string;
  priceHistory?: HistoryEntry[];
  notes?: string;
}

export interface MatrixVendorPrice {
  vendorId: string;
  vendorName: string;
  pricelistId: string;
  pricelistName: string;
  currency: string;
  unitPrice: number;
  discountPercent: number;
  leadTimeDays?: number;
  vendorProductCode?: string;
}

export interface MatrixGroup {
  subProductId: string;
  sizeId: string | null;
  subProductName: string;
  sizeName: string | null;
  sku: string;
  vendors: MatrixVendorPrice[];
}

interface CreateResponse {
  success: boolean;
  data: VendorPricelist;
  message?: string;
}

interface ListResponse {
  success: boolean;
  data: VendorPricelist[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

class ApiError extends Error {}

async function handle<T>(res: Response, fallback: string): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON response (proxy error page, HTML 500, …) — fall through to the
    // generic error below so callers always get a real Error, never a parse crash.
  }
  if (!res.ok) {
    const msg =
      !!body &&
      typeof body === 'object' &&
      'message' in body &&
      typeof (body as { message?: unknown }).message === 'string'
        ? (body as { message: string }).message
        : fallback;
    throw new ApiError(msg);
  }
  return body as T;
}

class VendorPricelistService {
  private getHeaders(token: string) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  async getPricelists(
    token: string,
    params?: {
      vendor?: string;
      isActive?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<ListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.vendor) queryParams.set('vendor', params.vendor);
    if (params?.isActive !== undefined)
      queryParams.set('isActive', String(params.isActive));
    if (params?.search) queryParams.set('search', params.search);
    queryParams.set('page', String(params?.page ?? 1));
    queryParams.set('limit', String(params?.limit ?? 100));

    const response = await fetch(
      `${API_URL}/api/vendor-pricelists?${queryParams}`,
      { headers: this.getHeaders(token) }
    );
    return handle<ListResponse>(response, 'Failed to load pricelists');
  }

  async getPricelist(
    id: string,
    token: string
  ): Promise<{ success: boolean; data: VendorPricelist }> {
    const response = await fetch(`${API_URL}/api/vendor-pricelists/${id}`, {
      headers: this.getHeaders(token),
    });
    return handle<{ success: boolean; data: VendorPricelist }>(
      response,
      'Failed to load pricelist'
    );
  }

  async createPricelist(
    data: Partial<VendorPricelist>,
    token: string
  ): Promise<CreateResponse> {
    const response = await fetch(`${API_URL}/api/vendor-pricelists`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });
    return handle<CreateResponse>(response, 'Failed to create pricelist');
  }

  async updatePricelist(
    id: string,
    data: Partial<VendorPricelist>,
    token: string
  ): Promise<CreateResponse> {
    const response = await fetch(`${API_URL}/api/vendor-pricelists/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });
    return handle<CreateResponse>(response, 'Failed to save pricelist');
  }

  async deletePricelist(
    id: string,
    token: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/api/vendor-pricelists/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    return handle<{ success: boolean; message: string }>(
      response,
      'Failed to delete pricelist'
    );
  }

  async getPriceForProduct(
    vendorId: string,
    subProductId: string,
    token: string,
    sizeId?: string,
    quantity?: number
  ): Promise<{
    success: boolean;
    data: {
      pricelistId: string;
      pricelistName: string;
      currency: string;
      unitPrice: number;
      discountPercent: number;
    } | null;
  }> {
    const queryParams = new URLSearchParams({ vendorId, subProductId });
    if (sizeId) queryParams.set('sizeId', sizeId);
    if (quantity) queryParams.set('quantity', String(quantity));

    const response = await fetch(
      `${API_URL}/api/vendor-pricelists/product/price?${queryParams}`,
      { headers: this.getHeaders(token) }
    );
    return handle<{
      success: boolean;
      data: {
        pricelistId: string;
        pricelistName: string;
        currency: string;
        unitPrice: number;
        discountPercent: number;
      } | null;
    }>(response, 'Failed to resolve price');
  }

  async getVendorPricesForProduct(
    subProductId: string,
    token: string,
    sizeId?: string
  ): Promise<{
    success: boolean;
    data: Array<{
      pricelistId: string;
      pricelistName: string;
      vendor: { _id: string; name: string; email?: string; phone?: string };
      currency: string;
      unitPrice: number;
      discountPercent: number;
      leadTimeDays?: number;
      vendorProductCode?: string;
    }>;
  }> {
    const queryParams = new URLSearchParams({ subProductId });
    if (sizeId) queryParams.set('sizeId', sizeId);

    const response = await fetch(
      `${API_URL}/api/vendor-pricelists/product/vendor-prices?${queryParams}`,
      { headers: this.getHeaders(token) }
    );
    return handle<{
      success: boolean;
      data: Array<{
        pricelistId: string;
        pricelistName: string;
        vendor: { _id: string; name: string; email?: string; phone?: string };
        currency: string;
        unitPrice: number;
        discountPercent: number;
        leadTimeDays?: number;
        vendorProductCode?: string;
      }>;
    }>(response, 'Failed to load vendor prices');
  }

  async syncNow(
    id: string,
    token: string
  ): Promise<{
    success: boolean;
    data?: VendorPricelist;
    result?: {
      created: boolean;
      updated: number;
      added: number;
      changed: number;
      poNumber: string;
    };
    message?: string;
  }> {
    const response = await fetch(
      `${API_URL}/api/vendor-pricelists/${id}/sync-now`,
      {
        method: 'POST',
        headers: this.getHeaders(token),
      }
    );
    return handle<{
      success: boolean;
      data?: VendorPricelist;
      result?: {
        created: boolean;
        updated: number;
        added: number;
        changed: number;
        poNumber: string;
      };
      message?: string;
    }>(response, 'Sync failed');
  }

  async getMatrix(
    token: string,
    search?: string
  ): Promise<{ success: boolean; data: MatrixGroup[] }> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const response = await fetch(
      `${API_URL}/api/vendor-pricelists/matrix?${params}`,
      { headers: this.getHeaders(token) }
    );
    return handle<{ success: boolean; data: MatrixGroup[] }>(
      response,
      'Failed to load price matrix'
    );
  }
}

export const vendorPricelistService = new VendorPricelistService();
