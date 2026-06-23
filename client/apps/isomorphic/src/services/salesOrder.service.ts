const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface SalesLineItem {
  _id: string;
  product?: string;
  subproduct?: string;
  size?: string;
  sku?: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate?: number;
  taxAmount?: number;
  promoDiscount?: number;
  promoName?: string;
  lineTotal: number;
  fulfilledQty: number;
  postedQty: number;
  returnedQty: number;
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
  product?: string;
  subproduct?: string;
  size?: string;
  sku?: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
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

export interface SalesOrderListResponse {
  success: boolean;
  data: SalesOrder[];
  message?: string;
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
    params: { docType?: 'quotation' | 'order'; status?: string; customer?: string } = {}
  ): Promise<SalesOrderListResponse> {
    const qs = new URLSearchParams();
    if (params.docType) qs.set('docType', params.docType);
    if (params.status) qs.set('status', params.status);
    if (params.customer) qs.set('customer', params.customer);
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
};
