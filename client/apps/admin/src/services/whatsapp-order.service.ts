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

export interface InvoiceIssueResult {
  invoiceUrl: string;
  reference: string;
  authorizationUrl: string | null;
  resendOnly: boolean;
}

export const whatsappOrderService = {
  /** Create the order via the normal checkout endpoint (manual block attached). */
  async createOrder(token: string, payload: ManualOrderPayload, idempotencyKey: string): Promise<Order> {
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
