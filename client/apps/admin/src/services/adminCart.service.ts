// client/apps/admin/src/services/adminCart.service.ts
//
// Staff read of the marketplace cart pipeline — the "Live Carts" tab on the
// Orders page. The shopper-facing cart lives in the platform app; this only
// ever reads.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

function authHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

type ApiEnvelope<T> = { success?: boolean; message?: string; data?: T };

/** `res.json()` is `unknown` under this tsconfig — unwrap the envelope once. */
async function unwrap<T>(res: Response, fallbackMessage: string): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!res.ok || !body.success || body.data === undefined) {
    throw new Error(body.message || fallbackMessage);
  }
  return body.data;
}

/** Age bucket, measured from the cart's last update. */
export type CartBucket = 'active' | 'at_risk' | 'abandoned';

/** Registration window for the new-customer view. */
export type RegistrationWindow = '30' | '90' | 'month' | 'all';

export interface AdminCartLine {
  productId?: string;
  subProductId: string;
  sizeId?: string;
  name: string;
  sku: string;
  sizeName: string;
  quantity: number;
  /** The shopper's `priceAtAddition` snapshot — a forecast, not a quotable price. */
  unitPrice: number;
  lineTotal: number;
  addedAt?: string;
  tenantId?: string;
}

export interface AdminCart {
  kind: 'cart';
  _id: string;
  user: { _id: string | null; name: string; email: string; phone: string };
  items: AdminCartLine[];
  /** Count of the lines this caller may see — not the cart's real length. */
  itemCount: number;
  totalQuantity: number;
  /** Value of the visible lines only. */
  value: number;
  /** Lines belonging to other tenants: a count, never their contents. */
  skippedCount: number;
  createdAt?: string;
  updatedAt: string;
  ageHours: number;
  bucket: CartBucket;
}

/** A new customer with no non-empty cart anywhere on the platform. */
export interface AdminSignupRow {
  kind: 'signup';
  _id: string;
  user: { _id: string | null; name: string; email: string; phone: string };
  joinedAt: string;
  registrationWindow: string;
}

export type AdminRow = AdminCart | AdminSignupRow;

export interface AdminCartSummary {
  counts: { all: number; active: number; at_risk: number; abandoned: number };
  totalValue: number;
  totalUnits: number;
  averageValue: number;
}

export interface AdminNewCustomerSummary {
  shoppers: number;
  withCart: number;
  noCart: number;
  totalValue: number;
}

export interface AdminCartListResult {
  mode: 'carts' | 'newCustomers';
  rows: AdminRow[];
  summary: AdminCartSummary | AdminNewCustomerSummary;
  /** Window-wide distinct active customers — only present in new-customer mode. */
  headline?: { shoppers: number };
  pagination: { page: number; pages: number; total: number; limit: number };
  /** 'page' means a value/items sort only ordered the current page. */
  sortScope: 'global' | 'page';
  /** The name search hit its user cap — results are incomplete. */
  searchTruncated: boolean;
  scope: 'platform' | 'tenant';
}

export interface AdminCartListParams {
  page?: number;
  limit?: number;
  search?: string;
  bucket?: CartBucket | '';
  sort?: 'updatedAt' | 'value' | 'items';
  order?: 'asc' | 'desc';
  newCustomers?: 1;
  registeredWithin?: RegistrationWindow;
}

export const adminCartService = {
  async getCarts(
    token: string,
    params: AdminCartListParams = {},
    signal?: AbortSignal
  ): Promise<AdminCartListResult> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const res = await fetch(`${API_URL}/api/cart/admin/list?${qs}`, {
      headers: authHeaders(token),
      signal,
    });
    return unwrap<AdminCartListResult>(res, 'Failed to load carts');
  },
};
