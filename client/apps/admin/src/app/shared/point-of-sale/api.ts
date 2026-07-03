import type {
  POSAuthResponse,
  POSStaff,
  POSSessionInfo,
  POSProduct,
  POSOrderResponse,
  POSHoldOrder,
  POSRecallCart,
  POSRefundResponse,
  POSDashboardData,
  POSSession,
  POSClosingControl,
  POSRecentOrder,
  POSCashMovement,
  POSSettings,
  POSCombo,
  POSCustomer,
  POSCustomerAddress,
  POSShop,
  POSNotification,
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
  const body = (await res.json()) as ApiResponse<T>;
  // Do NOT signOut() here. This handler runs for every POS request, including
  // staff-login: a wrong PIN returns 401, and calling signOut() destroyed the
  // NextAuth session and bounced the cashier to /signin with "session expired".
  // Surface the server's message instead and let callers handle re-auth.
  if (res.status === 401) {
    throw new Error(body.message || 'Unauthorized. Please re-authenticate.');
  }
  if (!res.ok || !body.success)
    throw new Error(body.message || 'Request failed');
  return body.data;
}

export const posApi = {
  async staffLogin(
    tenantSlug: string,
    staffId: string,
    pin?: string,
    password?: string
  ) {
    return request<POSAuthResponse>(`${API_URL}/api/pos/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantSlug, staffId, pin, password }),
    });
  },

  async listStaff(tenantSlug: string) {
    return request<{
      staff: POSStaff[];
      tenant: { _id: string; slug: string; name: string };
    }>(`${API_URL}/api/pos/staff?tenantSlug=${encodeURIComponent(tenantSlug)}`);
  },

  async getSessionInfo(token: string, terminalType?: 'retail' | 'wholesale') {
    const qs = terminalType ? `?terminalType=${terminalType}` : '';
    return request<POSSessionInfo>(`${API_URL}/api/pos/session-info${qs}`, {
      headers: authHeaders(token),
    });
  },

  async getProducts(
    token: string,
    params?: {
      search?: string;
      category?: string;
      limit?: number;
      shopId?: string;
      warehouseId?: string;
    }
  ) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.category) qs.set('category', params.category);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.shopId) qs.set('shopId', params.shopId);
    if (params?.warehouseId) qs.set('warehouseId', params.warehouseId);
    return request<{ products: POSProduct[]; total: number }>(
      `${API_URL}/api/pos/products?${qs}`,
      { headers: authHeaders(token) }
    );
  },

  // Lightweight category/subcategory/brand map for every sub-product (not
  // gated by visibleInPOS/limit). Used by purchases analytics for full
  // attribution coverage.
  async getProductMeta(token: string) {
    return request<{
      meta: {
        _id: string;
        categoryId: string | null;
        categoryName: string | null;
        subCategoryId: string | null;
        subCategoryName: string | null;
        brandId: string | null;
        brandName: string | null;
      }[];
      total: number;
    }>(`${API_URL}/api/pos/product-meta`, { headers: authHeaders(token) });
  },

  async getPricelists(
    token: string,
    shopId?: string,
    customerId?: string,
    warehouseId?: string
  ) {
    const qs = new URLSearchParams();
    if (shopId) qs.set('shopId', shopId);
    // When a saved customer is selected, the server folds their assigned pricelist
    // into the allowed set and resolves it as the auto-pick.
    if (customerId) qs.set('customerId', customerId);
    if (warehouseId) qs.set('warehouseId', warehouseId);
    return request<{ pricelists: any[]; resolvedId: string | null }>(
      `${API_URL}/api/pos/pricelists?${qs}`,
      { headers: authHeaders(token) }
    );
  },

  async getCategories() {
    return request<{
      categories: {
        _id: string;
        name: string;
        parent?: string;
        level?: number;
      }[];
      total: number;
    }>(`${API_URL}/api/categories`);
  },

  async getBrands(params?: { search?: string; limit?: number }) {
    const qs = new URLSearchParams({
      status: 'active',
      limit: String(params?.limit ?? 200),
    });
    if (params?.search) qs.set('search', params.search);
    return request<{ brands: { _id: string; name: string }[] }>(
      `${API_URL}/api/brands?${qs}`
    );
  },

  async getCombos(token: string) {
    return request<{ combos: POSCombo[] }>(`${API_URL}/api/pos/combos`, {
      headers: authHeaders(token),
    });
  },

  async createOrder(token: string, order: Record<string, unknown>) {
    return request<{ order: POSOrderResponse }>(`${API_URL}/api/pos/orders`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(order),
    });
  },

  async holdOrder(token: string, data: Record<string, unknown>) {
    return request<{ order: POSHoldOrder }>(`${API_URL}/api/pos/orders/hold`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
  },

  async getHeldOrders(token: string) {
    return request<{ orders: POSHoldOrder[] }>(
      `${API_URL}/api/pos/orders/held`,
      {
        headers: authHeaders(token),
      }
    );
  },

  async recallHeldOrder(token: string, orderId: string) {
    return request<{ cart: POSRecallCart }>(
      `${API_URL}/api/pos/orders/${orderId}/recall`,
      { method: 'POST', headers: authHeaders(token) }
    );
  },

  async refundOrder(
    token: string,
    orderId: string,
    items: {
      orderItemIndex: number;
      quantity: number;
      discPct?: number;
      unitPrice?: number;
      reason?: string;
      restock?: boolean;
    }[],
    reason?: string,
    refundPaymentMethod?: string
  ) {
    return request<POSRefundResponse>(
      `${API_URL}/api/pos/orders/${orderId}/refund`,
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ items, reason, refundPaymentMethod }),
      }
    );
  },

  async voidOrder(token: string, orderId: string, reason?: string) {
    return request<{ _id: string; status: string }>(
      `${API_URL}/api/pos/orders/${orderId}/void`,
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ reason }),
      }
    );
  },

  async getDashboard(token: string) {
    return request<POSDashboardData>(`${API_URL}/api/pos/dashboard`, {
      headers: authHeaders(token),
    });
  },

  async getCurrentSession(token: string) {
    return request<POSSession | null>(`${API_URL}/api/pos/sessions/current`, {
      headers: authHeaders(token),
    });
  },

  async openSession(
    token: string,
    openingCash?: number,
    terminalType?: 'retail' | 'wholesale',
    notes?: string
  ) {
    const res = await request<{ session: POSSession }>(
      `${API_URL}/api/pos/sessions/open`,
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          openingCash,
          terminalType: terminalType ?? 'retail',
          notes,
        }),
      }
    );
    return res.session;
  },

  async closeSession(
    token: string,
    sessionId: string,
    countedBalances: { method: string; counted: number }[],
    closingNotes?: string
  ) {
    const res = await request<{ session: POSSession; hasDifference: boolean }>(
      `${API_URL}/api/pos/sessions/${sessionId}/close`,
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ countedBalances, closingNotes }),
      }
    );
    return res.session;
  },

  async switchCashier(token: string, sessionId: string, pin: string) {
    return request<{ session: POSSession; staff: POSStaff }>(
      `${API_URL}/api/pos/sessions/${sessionId}/switch-cashier`,
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ pin }),
      }
    );
  },

  async getClosingControl(token: string, sessionId: string) {
    return request<POSClosingControl>(
      `${API_URL}/api/pos/sessions/${sessionId}/closing-control`,
      { headers: authHeaders(token) }
    );
  },

  async recordCashMove(
    token: string,
    sessionId: string,
    type: 'in' | 'out',
    amount: number,
    reason?: string
  ) {
    return request<{
      movement: POSCashMovement;
      cashMovements: POSCashMovement[];
    }>(`${API_URL}/api/pos/sessions/${sessionId}/cash-move`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ type, amount, reason }),
    });
  },

  async getCashMoves(token: string, sessionId: string) {
    return request<{ cashMovements: POSCashMovement[] }>(
      `${API_URL}/api/pos/sessions/${sessionId}/cash-moves`,
      { headers: authHeaders(token) }
    );
  },

  async getSessions(
    token: string,
    page?: number,
    limit?: number,
    status?: 'open' | 'closed',
    dateFrom?: string,
    dateTo?: string
  ) {
    const qs = new URLSearchParams();
    if (page) qs.set('page', String(page));
    if (limit) qs.set('limit', String(limit));
    if (status) qs.set('status', status);
    if (dateFrom) qs.set('dateFrom', dateFrom);
    if (dateTo) qs.set('dateTo', dateTo);
    return request<{
      sessions: POSSession[];
      total: number;
      page: number;
      limit: number;
    }>(`${API_URL}/api/pos/sessions?${qs}`, { headers: authHeaders(token) });
  },

  async getAllOrders(
    token: string,
    params?: { page?: number; limit?: number }
  ) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    return request<POSRecentOrder[]>(`${API_URL}/api/pos/orders?${qs}`, {
      headers: authHeaders(token),
    });
  },

  async getSessionOrders(token: string, sessionId: string) {
    return request<POSRecentOrder[]>(
      `${API_URL}/api/pos/sessions/${sessionId}/orders`,
      { headers: authHeaders(token) }
    );
  },

  async listCashiers(token: string) {
    return request<POSStaff[]>(`${API_URL}/api/pos/cashiers`, {
      headers: authHeaders(token),
    });
  },

  async getBankAccounts(token: string) {
    return request<{
      bankAccounts: {
        bankName: string;
        accountNumber: string;
        accountName?: string;
      }[];
    }>(`${API_URL}/api/pos/tenant/bank-accounts`, {
      headers: authHeaders(token),
    });
  },

  async updateBankAccounts(
    token: string,
    bankAccounts: {
      bankName: string;
      accountNumber: string;
      accountName?: string;
    }[]
  ) {
    return request<{
      bankAccounts: {
        bankName: string;
        accountNumber: string;
        accountName?: string;
      }[];
    }>(`${API_URL}/api/pos/tenant/bank-accounts`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ bankAccounts }),
    });
  },

  async getPOSSettings(token: string) {
    return request<{ posSettings: POSSettings }>(
      `${API_URL}/api/pos/tenant/settings`,
      { headers: authHeaders(token) }
    );
  },

  async updatePOSSettings(token: string, posSettings: POSSettings) {
    return request<{ posSettings: POSSettings }>(
      `${API_URL}/api/pos/tenant/settings`,
      {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify({ posSettings }),
      }
    );
  },

  async searchCustomers(token: string, q: string, limit = 20) {
    const qs = new URLSearchParams({ q, limit: String(limit) });
    return request<{ customers: POSCustomer[] }>(
      `${API_URL}/api/pos/customers?${qs}`,
      { headers: authHeaders(token) }
    );
  },

  async createCustomer(
    token: string,
    data: {
      firstName: string;
      lastName?: string;
      email?: string;
      phone?: string;
      notes?: string;
    }
  ) {
    const res = await fetch(`${API_URL}/api/pos/customers`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    const body = (await res.json()) as ApiResponse<{ customer: POSCustomer }>;
    if (res.status === 409 && body.data?.customer) {
      const err = new Error(body.message || 'Duplicate') as Error & {
        customer: POSCustomer;
      };
      err.customer = body.data.customer;
      throw err;
    }
    if (!res.ok || !body.success)
      throw new Error(body.message || 'Request failed');
    return body.data;
  },

  async getCustomer(token: string, id: string) {
    return request<{ customer: POSCustomer }>(
      `${API_URL}/api/pos/customers/${id}`,
      { headers: authHeaders(token) }
    );
  },

  // Best-effort default billing/delivery address for a POSCustomer, used by the
  // Sales create page to prefill its invoice/delivery blocks. Resolved by the
  // server from the customer's linked ecommerce Address, falling back to their
  // most recent non-cancelled Order's shipping address. null = no default found.
  async getCustomerDefaultAddress(token: string, id: string) {
    return request<{ address: POSCustomerAddress | null }>(
      `${API_URL}/api/pos/customers/${id}/default-address`,
      { headers: authHeaders(token) }
    );
  },

  async updateCustomerLoyalty(
    token: string,
    id: string,
    earned: number,
    redeemed: number,
    orderTotal: number,
    // Links the earn/redeem ledger rows to the sale so a refund/void can reverse them.
    orderId?: string
  ) {
    return request<{ customer: POSCustomer }>(
      `${API_URL}/api/pos/customers/${id}/loyalty`,
      {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify({ earned, redeemed, orderTotal, orderId }),
      }
    );
  },

  async getSessionReport(token: string, sessionId: string) {
    return request<{
      session: POSSession;
      summary: {
        totalOrders: number;
        voidedOrders: number;
        refundOrders: number;
        grossRevenue: number;
        totalDiscounts: number;
        totalRefunds: number;
        netRevenue: number;
        durationMins: number;
      };
      paymentTotals: Record<string, number>;
      cashSummary: {
        openingCash: number;
        cashSales: number;
        cashIn: number;
        cashOut: number;
        expectedCash: number;
        countedCash: number | null;
        difference: number | null;
      };
      cashMovements: POSCashMovement[];
      productBreakdown: {
        name: string;
        qty: number;
        gross: number;
        discounts: number;
        net: number;
      }[];
      hourlySales: { hour: string; orders: number; revenue: number }[];
    }>(`${API_URL}/api/pos/reports/session/${sessionId}`, {
      headers: authHeaders(token),
    });
  },

  async getDailyReport(token: string, date?: string) {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    return request<{
      date: string;
      sessions: {
        _id: string;
        terminalType: string;
        status: string;
        openedAt: string;
        closedAt?: string;
        orderCount: number;
        revenue: number;
      }[];
      totals: {
        sessionCount: number;
        totalOrders: number;
        voidedOrders: number;
        refundOrders: number;
        grossRevenue: number;
        totalDiscounts: number;
        totalRefunds: number;
        netRevenue: number;
        paymentTotals: Record<string, number>;
      };
    }>(`${API_URL}/api/pos/reports/daily${qs}`, {
      headers: authHeaders(token),
    });
  },

  async getReportSummary(
    token: string,
    params?: { dateFrom?: string; dateTo?: string }
  ) {
    const qs = new URLSearchParams();
    if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params?.dateTo) qs.set('dateTo', params.dateTo);
    return request<{
      dateFrom: string;
      dateTo: string;
      totals: {
        sessionCount: number;
        totalOrders: number;
        voidedOrders: number;
        refundOrders: number;
        grossRevenue: number;
        totalDiscounts: number;
        totalRefunds: number;
        netRevenue: number;
        avgOrderValue: number;
        paymentTotals: Record<string, number>;
      };
      dailySales: { date: string; orders: number; revenue: number }[];
      topProducts: {
        name: string;
        qty: number;
        gross: number;
        discounts: number;
        net: number;
      }[];
    }>(`${API_URL}/api/pos/reports/summary?${qs}`, {
      headers: authHeaders(token),
    });
  },

  async getNotifications(token: string, since?: string) {
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    return request<{ notifications: POSNotification[] }>(
      `${API_URL}/api/pos/notifications${qs}`,
      { headers: authHeaders(token) }
    );
  },

  async listShops(token: string) {
    return request<{ shops: POSShop[] }>(`${API_URL}/api/pos/shops`, {
      headers: authHeaders(token),
    });
  },

  async createShop(
    token: string,
    data: {
      name: string;
      mode: 'retail' | 'wholesale';
      color?: string;
      description?: string;
      warehouse?: string | null;
    }
  ) {
    return request<{ shop: POSShop }>(`${API_URL}/api/pos/shops`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
  },

  async updateShop(
    token: string,
    shopId: string,
    data: Partial<{
      name: string;
      mode: 'retail' | 'wholesale';
      color: string;
      description: string;
      active: boolean;
      warehouse: string | null;
    }>
  ) {
    return request<{ shop: POSShop }>(`${API_URL}/api/pos/shops/${shopId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
  },

  async deleteShop(token: string, shopId: string) {
    return request<{ message: string }>(`${API_URL}/api/pos/shops/${shopId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
  },

  async getWarehouses(token: string) {
    return request<{
      warehouses: { _id: string; name: string; isDefault?: boolean }[];
    }>(`${API_URL}/api/warehouses?active=true`, {
      headers: authHeaders(token),
    });
  },

  async getSalesOrdersForPOS(
    token: string,
    params: {
      search?: string;
      docType?: 'quotation' | 'order';
      status?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries({ limit: '50', ...params }).filter(
          ([, v]) => v != null && v !== undefined && v !== ''
        )
      ) as Record<string, string>
    ).toString();
    return request<{
      salesOrders: unknown[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(
      `${API_URL}/api/pos/sales-orders?${qs}`,
      {
        headers: authHeaders(token),
      }
    );
  },

  // Reconcile a linked Sales Order after a POS sale. The POS sale already
  // deducted stock and recorded revenue, so this only marks the SO fulfilled +
  // paid (quotations are converted to orders first) — no second stock movement
  // and no duplicate Sales rows. Runs under the POS token (not the admin route).
  async reconcileSalesOrder(
    token: string,
    id: string,
    body: {
      paymentMethod?: string;
      items?: { subProductId: string; sizeId?: string; quantity: number }[];
    }
  ) {
    return request<unknown>(`${API_URL}/api/pos/sales-orders/${id}/reconcile`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
  },
};
