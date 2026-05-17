import type {
  POSAuthResponse,
  POSStaff,
  POSSessionInfo,
  POSProduct,
  POSOrderResponse,
  POSRefundResponse,
  POSDashboardData,
  POSSession,
  POSClosingControl,
  POSRecentOrder,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

function authHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const body = await res.json() as ApiResponse<T>;
  if (!res.ok || !body.success) throw new Error(body.message || 'Request failed');
  return body.data;
}

export const posApi = {
  async staffLogin(tenantSlug: string, staffId: string, pin?: string, password?: string) {
    return request<POSAuthResponse>(`${API_URL}/api/pos/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantSlug, staffId, pin, password }),
    });
  },

  async listStaff(tenantSlug: string) {
    return request<{ staff: POSStaff[]; tenant: { _id: string; slug: string; name: string } }>(
      `${API_URL}/api/pos/staff?tenantSlug=${encodeURIComponent(tenantSlug)}`
    );
  },

  async getSessionInfo(token: string, terminalType?: 'retail' | 'wholesale') {
    const qs = terminalType ? `?terminalType=${terminalType}` : '';
    return request<POSSessionInfo>(`${API_URL}/api/pos/session-info${qs}`, { headers: authHeaders(token) });
  },

  async getProducts(token: string, params?: { search?: string; category?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.category) qs.set('category', params.category);
    if (params?.limit) qs.set('limit', String(params.limit));
    return request<{ products: POSProduct[]; total: number }>(`${API_URL}/api/pos/products?${qs}`, { headers: authHeaders(token) });
  },

  async createOrder(token: string, order: Record<string, unknown>) {
    return request<{ order: POSOrderResponse }>(`${API_URL}/api/pos/orders`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(order),
    });
  },

  async refundOrder(
    token: string,
    orderId: string,
    items: { orderItemIndex: number; quantity: number; discPct?: number; unitPrice?: number; reason?: string; restock?: boolean }[],
    reason?: string,
    refundPaymentMethod?: string,
  ) {
    return request<POSRefundResponse>(`${API_URL}/api/pos/orders/${orderId}/refund`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ items, reason, refundPaymentMethod }),
    });
  },

  async voidOrder(token: string, orderId: string, reason?: string) {
    return request<{ _id: string; status: string }>(`${API_URL}/api/pos/orders/${orderId}/void`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ reason }),
    });
  },

  async getDashboard(token: string) {
    return request<POSDashboardData>(`${API_URL}/api/pos/dashboard`, { headers: authHeaders(token) });
  },

  async getCurrentSession(token: string) {
    return request<POSSession | null>(`${API_URL}/api/pos/sessions/current`, { headers: authHeaders(token) });
  },

  async openSession(token: string, openingCash?: number, terminalType?: 'retail' | 'wholesale', notes?: string) {
    const res = await request<{ session: POSSession }>(`${API_URL}/api/pos/sessions/open`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ openingCash, terminalType: terminalType ?? 'retail', notes }),
    });
    return res.session;
  },

  async closeSession(token: string, sessionId: string, countedBalances: { method: string; counted: number }[], closingNotes?: string) {
    const res = await request<{ session: POSSession; hasDifference: boolean }>(`${API_URL}/api/pos/sessions/${sessionId}/close`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ countedBalances, closingNotes }),
    });
    return res.session;
  },

  async switchCashier(token: string, sessionId: string, pin: string) {
    return request<{ session: POSSession; staff: POSStaff }>(`${API_URL}/api/pos/sessions/${sessionId}/switch-cashier`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ pin }),
    });
  },

  async getClosingControl(token: string, sessionId: string) {
    return request<POSClosingControl>(`${API_URL}/api/pos/sessions/${sessionId}/closing-control`, { headers: authHeaders(token) });
  },

  async getSessions(token: string, page?: number, limit?: number) {
    const qs = new URLSearchParams();
    if (page) qs.set('page', String(page));
    if (limit) qs.set('limit', String(limit));
    return request<{ sessions: POSSession[]; total: number }>(`${API_URL}/api/pos/sessions?${qs}`, { headers: authHeaders(token) });
  },

  async getSessionOrders(token: string, sessionId: string) {
    return request<POSRecentOrder[]>(`${API_URL}/api/pos/sessions/${sessionId}/orders`, { headers: authHeaders(token) });
  },

  async listCashiers(token: string) {
    return request<POSStaff[]>(`${API_URL}/api/pos/cashiers`, { headers: authHeaders(token) });
  },
};
