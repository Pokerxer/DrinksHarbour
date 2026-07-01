const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface SalesLineItem {
  _id: string;
  lineType?: 'product' | 'section' | 'note';
  product?: string;
  subproduct?: string;
  size?: string;
  sku?: string;
  name?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType?: 'fixed' | 'percentage';
  taxRate?: number;
  taxAmount?: number;
  promoDiscount?: number;
  promoName?: string;
  lineTotal: number;
  fulfilledQty: number;
  postedQty: number;
  returnedQty: number;
  priceOverridden?: boolean;
}

export interface SalesOrderCustomerSnapshot {
  name?: string;
  phone?: string;
  email?: string;
  customerId?: string;
}

export interface SalesOrderAddress {
  name?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface SalesOrderFulfillment {
  _id: string;
  warehouseId: string;
  items: { lineId: string; qty: number }[];
  status: string;
  at: string;
  by?: string;
}

export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted';

export type OrderStatus =
  | 'draft'
  | 'confirmed'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'cancelled';

export interface SalesOrder {
  _id: string;
  tenant?: string;
  soNumber: string;
  docType: 'quotation' | 'order';
  warehouseId?: { _id: string; name: string } | string | null;
  salesperson?: { _id: string; name: string } | null;
  customer?: string;
  customerSnapshot?: SalesOrderCustomerSnapshot;
  pricelist?: string | null;
  appliedPricelist?: { pricelistId?: string; pricelistName?: string };
  currency: string;
  items: SalesLineItem[];
  subtotal: number;
  discountTotal: number;
  promotionTotal?: number;
  taxTotal?: number;
  total: number;
  quoteStatus?: QuoteStatus;
  validUntil?: string;
  orderStatus?: OrderStatus;
  paymentTerms?: string;
  dueDate?: string;
  invoiceAddress?: SalesOrderAddress;
  deliveryAddress?: SalesOrderAddress;
  paymentMethod?: string;
  paymentStatus?: 'unpaid' | 'paid';
  amountPaid?: number;
  loyaltyEarned?: number;
  loyaltyRedeemed?: number;
  pointsRedeemed?: number;
  fulfillments: SalesOrderFulfillment[];
  convertedFrom?: string;
  convertedTo?: string;
  relatedSales?: string[];
  notes?: string;
  terms?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalesOrderLineInput {
  lineType?: 'product' | 'section' | 'note';
  product?: string;
  subproduct?: string;
  size?: string;
  sku?: string;
  name?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  discountType?: 'fixed' | 'percentage';
  taxRate?: number;
  priceOverridden?: boolean;
}

export interface CreateSalesOrderInput {
  docType: 'quotation' | 'order';
  customer?: string;
  customerSnapshot?: SalesOrderCustomerSnapshot;
  pricelist?: string;
  appliedPricelist?: { pricelistId?: string; pricelistName?: string };
  items: SalesOrderLineInput[];
  validUntil?: string;
  paymentTerms?: string;
  invoiceAddress?: SalesOrderAddress;
  deliveryAddress?: SalesOrderAddress;
  notes?: string;
  terms?: string;
}

export interface UpdateSalesOrderInput {
  items?: SalesOrderLineInput[];
  customer?: string;
  customerSnapshot?: SalesOrderCustomerSnapshot;
  pricelist?: string;
  appliedPricelist?: { pricelistId?: string; pricelistName?: string };
  notes?: string;
  terms?: string;
  validUntil?: string;
  paymentTerms?: string;
  invoiceAddress?: SalesOrderAddress;
  deliveryAddress?: SalesOrderAddress;
}

export interface FulfillPosting {
  successCount: number;
  failCount: number;
  failures: { lineId: string; name?: string; reason: string }[];
  postedLineIds: string[];
}

export interface ReturnRestock {
  successCount: number;
  failures: { lineId: string; reason: string }[];
}

export interface SalesOrderResponse {
  success: boolean;
  data: SalesOrder;
  message?: string;
}

export interface SalesOrderGroup {
  _id: string;
  count: number;
  total: number;
  currency: string;
  docs: SalesOrder[];
}

export interface SalesOrderListResponse {
  success: boolean;
  data: SalesOrder[];
  groups?: SalesOrderGroup[];
  message?: string;
  total?: number;
  page?: number;
  totalPages?: number;
}

export interface FulfillResponse {
  success: boolean;
  data: SalesOrder;
  posting: FulfillPosting;
  message?: string;
}

export interface ReturnResponse {
  success: boolean;
  data: SalesOrder;
  restock: ReturnRestock;
  message?: string;
}

export interface BulkActionResult {
  success: boolean;
  results: { id: string; ok: boolean; error?: string; duplicateId?: string; invoiceId?: string }[];
}

async function parseErrorOrThrow(response: Response, fallback: string) {
  if (response.ok) return;
  let message = fallback;
  try {
    const body = await response.json();
    message = body.message || fallback;
  } catch {
    // non-JSON error body — keep fallback
  }
  throw new Error(message);
}

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export const salesOrderService = {
  async list(
    token: string,
    params: {
      docType?: 'quotation' | 'order';
      status?: string;
      customer?: string;
      salesperson?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      limit?: number;
      warehouse?: string;
      paymentMethod?: string;
      paymentStatus?: string;
      groupBy?: string;
      groupBySubOption?: string;
      filters?: string;
    } = {}
  ): Promise<SalesOrderListResponse> {
    const qs = new URLSearchParams();
    if (params.docType) qs.set('docType', params.docType);
    if (params.status) qs.set('status', params.status);
    if (params.customer) qs.set('customer', params.customer);
    if (params.salesperson) qs.set('salesperson', params.salesperson);
    if (params.search) qs.set('search', params.search);
    if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params.dateTo) qs.set('dateTo', params.dateTo);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.warehouse) qs.set('warehouse', params.warehouse);
    if (params.paymentMethod) qs.set('paymentMethod', params.paymentMethod);
    if (params.paymentStatus) qs.set('paymentStatus', params.paymentStatus);
    if (params.groupBy) qs.set('groupBy', params.groupBy);
    if (params.groupBySubOption) qs.set('groupBySubOption', params.groupBySubOption);
    if (params.filters) qs.set('filters', params.filters);
    const url = `${API_URL}/api/sales-orders${qs.toString() ? `?${qs}` : ''}`;
    const response = await fetch(url, { headers: authHeaders(token) });
    await parseErrorOrThrow(response, 'Failed to load sales orders');
    return response.json();
  },

  async create(
    input: CreateSalesOrderInput,
    token: string
  ): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(input),
    });
    await parseErrorOrThrow(response, 'Failed to create sales order');
    return response.json();
  },

  async get(id: string, token: string): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}`, {
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to load sales order');
    return response.json();
  },

  async update(
    id: string,
    patch: UpdateSalesOrderInput,
    token: string
  ): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(patch),
    });
    await parseErrorOrThrow(response, 'Failed to update sales order');
    return response.json();
  },

  async cancel(id: string, token: string): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to cancel sales order');
    return response.json();
  },

  async send(id: string, token: string): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/send`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to send quotation');
    return response.json();
  },

  async accept(id: string, token: string): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/accept`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to accept quotation');
    return response.json();
  },

  async reject(id: string, token: string): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/reject`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to reject quotation');
    return response.json();
  },

  async convert(id: string, token: string): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/convert`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to convert quotation');
    return response.json();
  },

  async confirm(
    id: string,
    body: {
      paymentMethod: string;
      amountTendered?: number;
      splitPayments?: unknown[];
      redeemPoints?: number;
    },
    token: string
  ): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/confirm`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    await parseErrorOrThrow(response, 'Failed to confirm order');
    return response.json();
  },

  async fulfill(
    id: string,
    body: { warehouseId: string; items: { lineId: string; qty: number }[] },
    token: string
  ): Promise<FulfillResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/fulfill`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    await parseErrorOrThrow(response, 'Failed to fulfill order');
    return response.json();
  },

  async return(
    id: string,
    body: { warehouseId: string; items: { lineId: string; qty: number }[] },
    token: string
  ): Promise<ReturnResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/return`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    await parseErrorOrThrow(response, 'Failed to return order items');
    return response.json();
  },

  async duplicate(id: string, token: string): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/duplicate`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to duplicate order');
    return response.json();
  },

  async importCsv(csv: string, docType: 'quotation' | 'order', token: string): Promise<{ success: boolean; data: { created: number; errors: { row: number; message: string }[] } }> {
    const response = await fetch(`${API_URL}/api/sales-orders/import`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ csv, docType }),
    });
    await parseErrorOrThrow(response, 'Failed to import orders');
    return response.json();
  },

  async generatePaymentLink(id: string, token: string): Promise<{ success: boolean; data: { paymentLink: string } }> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/payment-link`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to generate payment link');
    return response.json();
  },

  async accruedRevenue(id: string, token: string): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/accrued-revenue`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to record accrued revenue');
    return response.json();
  },

  async createProject(id: string, token: string): Promise<{ success: boolean; data: { projectId: string; name: string; status: string } }> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/create-project`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to create project');
    return response.json();
  },

  async getActivities(id: string, token: string): Promise<{ success: boolean; data: any[] }> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/activities`, {
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to load activities');
    return response.json();
  },

  async createActivity(
    id: string,
    body: { type: 'note' | 'message' | 'log'; subject: string; description?: string },
    token: string
  ): Promise<{ success: boolean; data: any }> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/activities`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    await parseErrorOrThrow(response, 'Failed to create activity');
    return response.json();
  },

  async updatePrices(id: string, token: string): Promise<SalesOrderResponse> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/update-prices`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to update prices');
    return response.json();
  },

  async getCustomFields(token: string): Promise<{ success: boolean; data: any[] }> {
    const response = await fetch(`${API_URL}/api/sales-orders/custom-fields`, {
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to load custom fields');
    return response.json();
  },

  async createCustomField(body: { fieldName: string; fieldType: string; options?: string[]; isRequired?: boolean }, token: string): Promise<{ success: boolean; data: any }> {
    const response = await fetch(`${API_URL}/api/sales-orders/custom-fields`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    await parseErrorOrThrow(response, 'Failed to create custom field');
    return response.json();
  },

  async sendEmail(id: string, token: string): Promise<{ success: boolean; data: { emailSent: boolean } }> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/send-email`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to send email');
    return response.json();
  },

  async requestSignature(id: string, token: string): Promise<{ success: boolean; data: { signatureUrl: string } }> {
    const response = await fetch(`${API_URL}/api/sales-orders/${id}/request-signature`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    await parseErrorOrThrow(response, 'Failed to request signature');
    return response.json();
  },

  async bulkAction(endpoint: string, ids: string[], extra?: Record<string, unknown>, token: string): Promise<BulkActionResult> {
    const response = await fetch(`${API_URL}/api/sales/bulk/${endpoint}`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ ids, ...extra }),
    });
    await parseErrorOrThrow(response, 'Bulk action failed');
    return response.json();
  },

  async markAsSent(ids: string[], token: string): Promise<BulkActionResult> {
    return salesOrderService.bulkAction('mark-sent', ids, {}, token);
  },

  async bulkDuplicate(ids: string[], token: string): Promise<BulkActionResult> {
    return salesOrderService.bulkAction('duplicate', ids, {}, token);
  },

  async bulkDelete(ids: string[], token: string): Promise<BulkActionResult> {
    return salesOrderService.bulkAction('delete', ids, {}, token);
  },

  async bulkCancel(ids: string[], token: string): Promise<BulkActionResult> {
    return salesOrderService.bulkAction('cancel', ids, {}, token);
  },

  async bulkCreateInvoice(ids: string[], token: string): Promise<BulkActionResult> {
    return salesOrderService.bulkAction('create-invoice', ids, {}, token);
  },

  async bulkAccruedRevenue(ids: string[], token: string): Promise<BulkActionResult> {
    return salesOrderService.bulkAction('accrued-revenue', ids, {}, token);
  },

  async bulkFollowers(ids: string[], action: 'add' | 'remove', userId: string, token: string): Promise<BulkActionResult> {
    return salesOrderService.bulkAction('followers', ids, { action, userId }, token);
  },

  async bulkSendEmail(ids: string[], to: string, subject: string, body: string, token: string): Promise<BulkActionResult> {
    return salesOrderService.bulkAction('send-email', ids, { to, subject, body }, token);
  },
};
