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
  notes?: string;
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

class VendorPricelistService {
  private getHeaders(token: string) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  async getPricelists(token: string, params?: {
    vendor?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<ListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.vendor) queryParams.set('vendor', params.vendor);
    if (params?.isActive !== undefined) queryParams.set('isActive', String(params.isActive));
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.limit) queryParams.set('limit', String(params.limit));

    const response = await fetch(
      `${API_URL}/api/vendor-pricelists?${queryParams}`,
      { headers: this.getHeaders(token) }
    );
    return response.json();
  }

  async getPricelist(id: string, token: string): Promise<{ success: boolean; data: VendorPricelist }> {
    const response = await fetch(
      `${API_URL}/api/vendor-pricelists/${id}`,
      { headers: this.getHeaders(token) }
    );
    return response.json();
  }

  async createPricelist(data: Partial<VendorPricelist>, token: string): Promise<CreateResponse> {
    const response = await fetch(`${API_URL}/api/vendor-pricelists`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async updatePricelist(id: string, data: Partial<VendorPricelist>, token: string): Promise<CreateResponse> {
    const response = await fetch(`${API_URL}/api/vendor-pricelists/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async deletePricelist(id: string, token: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/api/vendor-pricelists/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    return response.json();
  }

  async getPriceForProduct(vendorId: string, subProductId: string, token: string, sizeId?: string, quantity?: number): Promise<{
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
    return response.json();
  }

  async getVendorPricesForProduct(subProductId: string, token: string, sizeId?: string): Promise<{
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
    return response.json();
  }
}

export const vendorPricelistService = new VendorPricelistService();
