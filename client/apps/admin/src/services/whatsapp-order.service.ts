// client/apps/admin/src/services/whatsapp-order.service.ts
import { orderService, type CreateOrderPayload, type Order } from './order.service';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

function authHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

type ApiEnvelope<T> = { success?: boolean; message?: string; data?: T };
async function unwrap<T>(res: Response, fallback: string): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!res.ok || !body.success || body.data === undefined) throw new Error(body.message || fallback);
  return body.data;
}

/** Manual order payload — the checkout contract plus the manual-intake block.
 *  `lga` extends the checkout shipping block: the manual builder collects it
 *  explicitly (the storefront derives city from the LGA picker too). */
export type ManualOrderPayload = Omit<CreateOrderPayload, 'couponCode' | 'note'> & {
  shipping: CreateOrderPayload['shipping'] & { lga?: string; coordinates?: { latitude: number; longitude: number } };
  /** Calculated pre-waiver fee, or the exact manual fee. */
  shippingFee?: number;
  shippingInfo?: {
    baseFee: number;
    source?: 'google' | 'zone';
    distanceKm?: number;
    routeType?: 'direct' | 'single-vendor' | 'multi-vendor';
    stops?: number;
    zone?: string;
    zoneLabel?: string;
    daysMin?: number;
    daysMax?: number;
  };
  manualOrder: { originChannel: 'whatsapp' };
};

/** Presentation layout lines for manually-intaked orders — sections, notes and
 *  per-line descriptions rendered on the printed quotation & invoice.
 *  `productIndex` points into the order's `items` array (null for non-products). */
export interface ManualPrintLine {
  lineType: 'product' | 'section' | 'note';
  name: string;
  description: string;
  productIndex: number | null;
}

/** Manual order payload v2 — v1 plus the printLines presentation block. */
export type ManualOrderPayloadV2 = Omit<ManualOrderPayload, 'manualOrder'> & {
  manualOrder: { originChannel: 'whatsapp'; printLines?: ManualPrintLine[]; deliveryFeeOverride?: number; customerId?: string };
};

/** The client line model for ALL builder line types (products, sections, notes). */
export interface BuilderLine {
  /** Stable client key (crypto.randomUUID()). */
  key: string;
  lineType: 'product' | 'section' | 'note';
  subProductId?: string;
  productId?: string;
  sizeId?: string;
  productName?: string;
  sizeName?: string;
  tenantId?: string;
  tenantName?: string;
  quantity: number;
  /** Server-priced (preview) — null/absent means "pricing…". */
  unitPrice?: number;
  availableStock?: number;
  /** Per-line note / section fallback text. */
  description?: string;
}

export interface TenantOffer {
  productId: string;
  subProductId: string;
  tenantId: string;
  tenantName: string;
  sizes: Array<{
    sizeId: string;
    displayName: string;
    /** calculateSizePricing output (real customer price). */
    marketplacePrice: number;
    availableStock: number;
    sku?: string;
  }>;
}

export interface WhatsAppCustomer {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  loyaltyPoints: number;
  loyaltyTier: string;
}

export interface WhatsAppDeliveryAddress {
  id: string;
  label: string;
  address: string;
  lga: string;
  state: string;
  zipCode: string;
  country: string;
  pin?: { lat: number; lon: number };
}

export interface WhatsAppCustomerContext {
  customer: WhatsAppCustomer;
  addresses: WhatsAppDeliveryAddress[];
}

export interface InvoiceIssueResult {
  invoiceUrl: string;
  reference: string;
  authorizationUrl: string | null;
  resendOnly: boolean;
}

export const whatsappOrderService = {
  async searchCustomers(token: string, search: string, signal: AbortSignal) {
    const query = new URLSearchParams({ search });
    const res = await fetch(`${API_URL}/api/whatsapp-orders/customers?${query}`, {
      headers: authHeaders(token), cache: 'no-store', signal,
    });
    return unwrap<{ customers: WhatsAppCustomer[] }>(res, 'Could not find customers');
  },

  async getCustomerContext(token: string, customerId: string, signal: AbortSignal) {
    const url = `${API_URL}/api/whatsapp-orders/customers/${encodeURIComponent(customerId)}`;
    const res = await fetch(url, { headers: authHeaders(token), cache: 'no-store', signal });
    return unwrap<WhatsAppCustomerContext>(res, 'Could not refresh customer details');
  },

  async saveCustomer(token: string, customer: Pick<WhatsAppCustomer, 'firstName' | 'lastName' | 'email' | 'phone'>) {
    const res = await fetch(`${API_URL}/api/whatsapp-orders/customers`, {
      method: 'POST', headers: authHeaders(token), body: JSON.stringify(customer),
    });
    return unwrap<{ customer: WhatsAppCustomer }>(res, 'Could not save customer');
  },

  /** Create the order via the normal checkout endpoint (manual block attached;
   *  printLines ride inside `manualOrder`). */
  async createOrder(token: string, payload: ManualOrderPayloadV2, idempotencyKey: string): Promise<Order> {
    return orderService.createOrder(token, payload as unknown as CreateOrderPayload, idempotencyKey);
  },

  /** Orders transcribed from WhatsApp: source=manual, ordered newest first. */
  async listManualOrders(token: string, params: { page?: number; limit?: number } = {}): Promise<unknown> {
    const qs = new URLSearchParams({ source: 'manual', sort: 'createdAt', order: 'desc',
      page: String(params.page ?? 1), limit: String(params.limit ?? 20) });
    const res = await fetch(`${API_URL}/api/orders?${qs}`, { headers: authHeaders(token) });
    return unwrap(res, 'Failed to load WhatsApp orders');
  },

  async issueInvoice(token: string, orderId: string, force = false): Promise<InvoiceIssueResult> {
    const res = await fetch(`${API_URL}/api/whatsapp-orders/${orderId}/invoice`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ force }),
    });
    return unwrap<InvoiceIssueResult>(res, 'Failed to issue the invoice');
  },
};

/** Orderable checkout offers for the requested catalogue products. */
export async function fetchCatalogueOffers(productIds: string[], token: string, signal?: AbortSignal): Promise<TenantOffer[]> {
  if (!productIds.length) return [];
  const params = new URLSearchParams({ productIds: [...new Set(productIds)].join(',') });
  const res = await fetch(`${API_URL}/api/whatsapp-orders/catalogue/offers?${params}`, {
    headers: authHeaders(token), cache: 'no-store', signal,
  });
  const { offers } = await unwrap<{ offers: TenantOffer[] }>(res, 'Could not load tenant offers');
  return offers;
}
