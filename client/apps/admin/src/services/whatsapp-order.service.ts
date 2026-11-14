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
  shipping: CreateOrderPayload['shipping'] & { lga?: string };
  /** Delivery fee quoted by /api/shipping/calculate (server floors it). */
  shippingFee?: number;
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
  manualOrder: { originChannel: 'whatsapp'; printLines?: ManualPrintLine[] };
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

export interface InvoiceIssueResult {
  invoiceUrl: string;
  reference: string;
  authorizationUrl: string | null;
  resendOnly: boolean;
}

export const whatsappOrderService = {
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

/** Per-tenant offers for one product, with REAL marketplace prices.
 *  GET /api/subproducts/product/:productId?includeAll=true (super_admin):
 *  rows = SubProducts with populated tenant + sizes[].pricing per size.
 *  Verified shape (subproduct.service.js getSubProductsByProduct → utils/pricing.js
 *  calculateSizePricing): the size price key is `pricing.finalPrice`; the
 *  `pricing.websitePrice` key only exists in the product.service/search.service
 *  enrichment pipelines, so it is not present on this endpoint. */
export async function fetchTenantOffers(productId: string, token: string): Promise<TenantOffer[]> {
  const res = await fetch(`${API_URL}/api/subproducts/product/${productId}?includeAll=true`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    data?: {
      subProducts?: Array<{
        _id: string;
        tenant?: { _id: string; name: string } | null;
        sizes?: Array<{
          _id: string; displayName?: string; size?: string; sku?: string;
          stock?: number; availableStock?: number;
          pricing?: { finalPrice?: number; platformSellingPrice?: number } | null;
        }>;
      }>;
    };
  };
  if (!res.ok || !body.success) throw new Error(body.message || 'Could not load tenant offers');
  return (body.data?.subProducts || [])
    .filter((sp) => sp.tenant?._id)
    .map((sp) => ({
      subProductId: sp._id,
      tenantId: String(sp.tenant!._id),
      tenantName: sp.tenant!.name || 'Tenant',
      sizes: (sp.sizes || [])
        .map((s) => ({
          sizeId: s._id,
          displayName: s.displayName || s.size || 'Size',
          marketplacePrice: Number(s.pricing?.finalPrice ?? s.pricing?.platformSellingPrice ?? 0),
          availableStock: Number(s.availableStock ?? s.stock ?? 0),
          sku: s.sku,
        }))
        .filter((s) => s.marketplacePrice > 0),
    }))
    .filter((o) => o.sizes.length > 0);
}
