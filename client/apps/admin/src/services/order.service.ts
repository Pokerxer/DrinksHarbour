const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

function authHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

/** Envelope every /api/orders endpoint returns. */
type ApiEnvelope<T> = { success?: boolean; message?: string; data?: T };

/** Unwraps the `{ success, data }` envelope, turning API errors into throws.
 *  `res.json()` is typed `unknown` under this tsconfig, so parse in one place
 *  rather than sprinkling casts through every method. */
async function unwrap<T>(res: Response, fallbackMessage: string): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!res.ok || !body.success || body.data === undefined) {
    throw new Error(body.message || fallbackMessage);
  }
  return body.data;
}

export interface OrderItem {
  product: { _id: string; name: string; slug?: string; images?: { url: string }[] } | null;
  subproduct?: { _id: string; name: string; sku?: string } | null;
  /** Size documents have `size` ("75cl") and `displayName` — there is no `name` field. */
  size?: { _id: string; size?: string; displayName?: string } | null;
  tenant?: { _id: string; name: string } | null;
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  discountAmount?: number;
  tenantRevenueShare?: number;
  platformCommission?: number;
  tenantRevenueModel?: string;
  packRateApplied?: boolean;
}

export interface ShippingAddress {
  fullName?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  landmark?: string;
  additionalInstructions?: string;
  coordinates?: { latitude?: number; longitude?: number; placeId?: string };
}

/** Shipping calculation metadata snapshotted at checkout. */
export interface ShippingInfo {
  distanceKm?: number | null;
  routeType?: 'direct' | 'single-vendor' | 'multi-vendor' | null;
  stops?: number | null;
  daysMin?: number | null;
  daysMax?: number | null;
  zone?: string | null;
  zoneLabel?: string | null;
  isFree?: boolean;
  source?: 'google' | 'zone' | null;
}

export interface OrderRefundLine {
  orderItemIndex?: number;
  quantity?: number;
  unitPrice?: number;
  discPct?: number;
  amount?: number;
  restock?: boolean;
  reason?: string;
}

export interface OrderRefund {
  receiptNumber?: string;
  items?: OrderRefundLine[];
  totalRefunded?: number;
  reason?: string;
  refundedAt?: string;
  paymentMethod?: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  user?: { _id: string; firstName: string; lastName: string; email: string } | null;
  /** Snapshot captured at checkout for guest orders */
  customer?: { firstName?: string; lastName?: string; email?: string; phone?: string } | null;
  items: OrderItem[];
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentDetails?: {
    reference?: string;
    transactionId?: string;
    paidAt?: string;
    channel?: string;
    notes?: string;
    failureReason?: string;
    change?: number;
    splitPayments?: { method: string; amount: number }[];
    /** POS walk-in / named customer snapshot — POS orders have no shippingAddress */
    customer?: { firstName?: string; lastName?: string; phone?: string; customerId?: string | null };
  };
  paymentReference?: string;
  paidAt?: string;
  refundDetails?: { amount?: number; reason?: string; createdAt?: string };
  shippingAddress?: ShippingAddress;
  shippingMethod?: string;
  shippingInfo?: ShippingInfo;
  platformCommissionTotal?: number;
  status: string;
  placedAt: string;
  confirmedAt?: string;
  processingAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;

  // Origin / POS
  source?: 'web' | 'pos' | 'app' | 'manual';
  receiptNumber?: string;
  posStaff?: { _id: string; firstName?: string; lastName?: string; posName?: string; email?: string } | null;
  isVoided?: boolean;
  voidedAt?: string;
  voidReason?: string;
  refunds?: OrderRefund[];

  coupon?: { _id: string; code: string; discountType?: string; discountValue?: number } | null;
  billingAddress?: ShippingAddress | null;
  ageVerifiedAtOrderTime?: boolean;
  appliedPricelist?: { pricelistName?: string; thresholdDiscount?: number };
}

export interface OrderListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  payment?: string;
  source?: string;
  from?: string;
  to?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface OrdersResponse {
  orders: Order[];
  pagination: { page: number; limit: number; total: number; pages: number };
  counts: Record<string, number>;
}

export const orderService = {
  async getOrders(
    token: string,
    params: OrderListParams = {},
    signal?: AbortSignal
  ): Promise<OrdersResponse> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') qs.set(k, String(v)); });
    const res = await fetch(`${API_URL}/api/orders?${qs}`, { headers: authHeaders(token), signal });
    return unwrap<OrdersResponse>(res, 'Failed to fetch orders');
  },

  /**
   * Pull every order matching the current filters (not just the visible page) so
   * exports reflect what the admin is actually looking at. The API caps `limit`
   * at 100, so this walks the pages.
   */
  async getAllMatchingOrders(
    token: string,
    params: OrderListParams = {},
    { maxOrders = 5000 }: { maxOrders?: number } = {}
  ): Promise<Order[]> {
    const pageSize = 100;
    const all: Order[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const res = await this.getOrders(token, { ...params, page, limit: pageSize });
      all.push(...res.orders);
      totalPages = res.pagination.pages || 1;
      page += 1;
    } while (page <= totalPages && all.length < maxOrders);

    return all;
  },

  async getOrder(token: string, id: string): Promise<Order> {
    const res = await fetch(`${API_URL}/api/orders/${id}`, { headers: authHeaders(token) });
    const { order } = await unwrap<{ order: Order }>(res, 'Order not found');
    return order;
  },

  async updateStatus(token: string, id: string, status: string, reason?: string): Promise<Order> {
    const res = await fetch(`${API_URL}/api/orders/${id}/status`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ status, reason }),
    });
    const { order } = await unwrap<{ order: Order }>(res, 'Failed to update status');
    return order;
  },

  async updatePayment(
    token: string,
    id: string,
    action: 'mark_paid' | 'mark_failed' | 'mark_refunded',
    opts: { reference?: string; notes?: string; amount?: number } = {}
  ): Promise<Order> {
    const res = await fetch(`${API_URL}/api/orders/${id}/payment`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ action, ...opts }),
    });
    const { order } = await unwrap<{ order: Order }>(res, 'Failed to update payment');
    return order;
  },

  async cancelOrder(token: string, id: string, reason?: string): Promise<Order> {
    const res = await fetch(`${API_URL}/api/orders/${id}/cancel`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ reason }),
    });
    const { order } = await unwrap<{ order: Order }>(res, 'Failed to cancel order');
    return order;
  },
};
