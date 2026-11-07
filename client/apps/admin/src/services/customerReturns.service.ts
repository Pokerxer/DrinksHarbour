const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
export interface CustomerReturn {
  id: string;
  source: 'sales' | 'pos';
  sourceId: string;
  sourceNumber: string;
  reference?: string;
  product: string;
  size: string;
  // Variant identity (DRI-34 contract, emit-only-with-identity like DRI-16/
  // DRI-29): the backend may add these beside the stored `size` snapshot ONLY
  // when the Size itself carries colour/option identity. Identity-less legacy
  // rows keep their exact downstream payload shape.
  colorName?: string;
  colorHexCode?: string;
  optionName?: string;
  // Reserved restock-target contract (DRI-34, backend pending): when a row
  // exposes the exact Size disposition target it may carry these fields. The
  // browser UI surfaces them only when present; NO placeholder is invented
  // while the payload does not carry the target yet (recorded contract gap).
  restockSizeId?: string;
  restockSizeName?: string;
  returned: number;
  restocked: number | null;
  notRestocked: number | null;
  stockEvidence: 'verified' | 'unverified';
  warehouse: { _id: string; name: string; code?: string } | null;
  destinations?: Array<{ _id: string; name: string; code?: string }>;
  reason?: string;
  date: string | null;
}
export interface ReturnIssuer {
  name: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}
export interface CustomerReturnPage {
  rows: CustomerReturn[];
  total: number;
  page: number;
  pages: number;
  summary: {
    count: number;
    returned: number;
    restocked: number;
    notRestocked: number;
    unverified: number;
  };
  locations: Array<{ _id: string; name: string }>;
  issuer: ReturnIssuer;
  invoiceContext?: { id: string; number: string };
}
export interface ReturnFilters {
  invoice?: string;
  page: number;
  search?: string;
  source?: string;
  disposition?: string;
  warehouse?: string;
  from?: string;
  to?: string;
}
export const customerReturnsService = {
  async list(
    token: string,
    filters: ReturnFilters
  ): Promise<CustomerReturnPage> {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value !== undefined) query.set(key, String(value));
    });
    const response = await fetch(
      `${API_URL}/api/inventory/customer-returns?${query}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }
    );
    const result = (await response.json()) as {
      success?: boolean;
      data?: CustomerReturnPage;
      message?: string;
    };
    if (!response.ok || !result.success || !result.data)
      throw new Error(result.message || 'Could not load customer returns');
    return result.data as CustomerReturnPage;
  },
};
