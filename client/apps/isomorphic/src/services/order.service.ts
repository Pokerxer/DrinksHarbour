const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

function authHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export interface OrderItem {
  product: { _id: string; name: string; images?: { url: string }[] } | null;
  subproduct?: { _id: string; name: string; sku?: string } | null;
  size?: { _id: string; name: string } | null;
  tenant?: { _id: string; name: string } | null;
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  discountAmount?: number;
  tenantRevenueShare?: number;
  platformCommission?: number;
  tenantRevenueModel?: string;
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
  coordinates?: { lat: number; lon: number };
}

export interface Order {
  _id: string;
  orderNumber: string;
  user?: { _id: string; firstName: string; lastName: string; email: string } | null;
  items: OrderItem[];
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentDetails?: { reference?: string; transactionId?: string; paidAt?: string; channel?: string; notes?: string; failureReason?: string };
  paymentReference?: string;
  paidAt?: string;
  refundDetails?: { amount?: number; reason?: string; createdAt?: string };
  shippingAddress?: ShippingAddress;
  shippingMethod?: string;
  shippingInfo?: any;
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
}

export interface OrdersResponse {
  orders: Order[];
  pagination: { page: number; limit: number; total: number; pages: number };
  counts: Record<string, number>;
}

export const orderService = {
  async getOrders(
    token: string,
    params: {
      page?: number; limit?: number; search?: string;
      status?: string; payment?: string; from?: string; to?: string;
      sort?: string; order?: 'asc' | 'desc';
    } = {}
  ): Promise<OrdersResponse> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') qs.set(k, String(v)); });
    const res  = await fetch(`${API_URL}/api/orders?${qs}`, { headers: authHeaders(token) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to fetch orders');
    return data.data;
  },

  async getOrder(token: string, id: string): Promise<Order> {
    const res  = await fetch(`${API_URL}/api/orders/${id}`, { headers: authHeaders(token) });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Order not found');
    return data.data.order;
  },

  async updateStatus(token: string, id: string, status: string, reason?: string): Promise<Order> {
    const res  = await fetch(`${API_URL}/api/orders/${id}/status`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ status, reason }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update status');
    return data.data.order;
  },

  async updatePayment(
    token: string,
    id: string,
    action: 'mark_paid' | 'mark_failed' | 'mark_refunded',
    opts: { reference?: string; notes?: string; amount?: number } = {}
  ): Promise<Order> {
    const res  = await fetch(`${API_URL}/api/orders/${id}/payment`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ action, ...opts }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update payment');
    return data.data.order;
  },

  async cancelOrder(token: string, id: string, reason?: string): Promise<Order> {
    const res  = await fetch(`${API_URL}/api/orders/${id}/cancel`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to cancel order');
    return data.data.order;
  },
};
