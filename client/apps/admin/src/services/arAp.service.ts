// services/arAp.service.ts
//
// Typed client for the Accounting Customers/Vendors layer (AR/AP):
// invoices, bills, credit notes, payments, batch payments, products,
// customers, vendors. Same envelope style as accounting.service.ts.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export type PaymentSide = 'customer' | 'vendor';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'pos' | 'wallet';

export interface ArApSummary {
  count: number;
  totalOutstanding: number;
  buckets: Record<string, number>;
}

export interface OpenInvoice {
  _id: string;
  orderNumber?: string;
  date: string;
  dueDate?: string;
  outstanding: number;
  total: number;
  amountPaid: number;
  paymentStatus: string;
  orderStatus?: string;
  customer?: { _id: string; firstName: string; lastName: string } | null;
  customerSnapshot?: { name?: string };
}

export interface OpenBill {
  _id: string;
  billNumber?: string;
  date: string;
  dueDate?: string;
  outstanding: number;
  totalAmount: number;
  paidAmount: number;
  status: string;
  vendor?: { _id: string; name: string } | null;
}

export interface CreditNote {
  _id: string;
  number: string;
  customerName?: string;
  customer?: { _id: string; firstName: string; lastName: string } | null;
  salesOrder?: string;
  date: string;
  reason?: string;
  amount: number;
  taxAmount: number;
  status: 'draft' | 'applied' | 'cancelled';
}

export interface PaymentDoc {
  _id: string;
  number: string;
  customerName?: string;
  vendorName?: string;
  customer?: { _id: string; firstName: string; lastName: string } | null;
  vendor?: { _id: string; name: string } | null;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  allocations: Array<{ salesOrder?: string; vendorBill?: string; amount: number }>;
  batch?: string | null;
  status: 'active' | 'cancelled';
}

export interface BatchPayment {
  _id: string;
  number: string;
  direction: PaymentSide;
  date: string;
  account: '1000' | '1100';
  total: number;
  status: 'open' | 'deposited' | 'cancelled';
  depositedAt?: string;
  payments?: Array<{
    _id: string;
    number: string;
    customerName?: string;
    vendorName?: string;
    amount: number;
    date: string;
    method: string;
    status: string;
  }>;
}

export interface AccountingCustomer {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  walletBalance: number;
  loyaltyPoints: number;
  totalSpent: number;
  totalOrders: number;
  outstanding: number;
  openInvoices: number;
}

export interface AccountingVendor {
  _id: string;
  name: string;
  vendorType?: string;
  email?: string;
  phone?: string;
  paymentTerms?: string;
  outstanding: number;
  openBills: number;
}

export interface AccountingProduct {
  _id: string;
  name: string;
  sku?: string;
  sellingPrice: number;
  stockQuantity: number;
  availability: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: Pagination;
}

type Query = Record<string, string | number | undefined>;

function toQuery(params?: Query): string {
  const q = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

class ArApService {
  private headers(token: string) {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  private async unwrap<T>(res: Response, fallback: string): Promise<Envelope<T>> {
    let body: Envelope<T>;
    try {
      body = (await res.json()) as Envelope<T>;
    } catch {
      throw new Error(res.ok ? fallback : `${fallback} (HTTP ${res.status})`);
    }
    if (!res.ok || body.success === false) throw new Error(body.message || fallback);
    return body;
  }

  private async get<T>(token: string, path: string, params?: Query, fallback = 'Request failed'): Promise<Envelope<T>> {
    const res = await fetch(`${API_URL}/api/accounting/${path}${toQuery(params)}`, {
      headers: this.headers(token),
    });
    return this.unwrap<T>(res, fallback);
  }

  private async post<T>(token: string, path: string, body?: unknown, fallback = 'Request failed'): Promise<Envelope<T>> {
    const res = await fetch(`${API_URL}/api/accounting/${path}`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify(body ?? {}),
    });
    return this.unwrap<T>(res, fallback);
  }

  // Summaries + documents
  receivablesSummary(token: string) {
    return this.get<ArApSummary>(token, 'receivables/summary', undefined, 'Failed to load receivables');
  }
  payablesSummary(token: string) {
    return this.get<ArApSummary>(token, 'payables/summary', undefined, 'Failed to load payables');
  }
  invoices(token: string, params?: Query) {
    return this.get<OpenInvoice[]>(token, 'receivables/invoices', params, 'Failed to load invoices');
  }
  bills(token: string, params?: Query) {
    return this.get<OpenBill[]>(token, 'payables/bills', params, 'Failed to load bills');
  }

  // Credit notes
  creditNotes(token: string, params?: Query) {
    return this.get<CreditNote[]>(token, 'credit-notes', params, 'Failed to load credit notes');
  }
  createCreditNote(
    token: string,
    body: { amount: number; taxAmount?: number; customer?: string; customerName?: string; salesOrder?: string; reason?: string; date?: string }
  ) {
    return this.post<CreditNote>(token, 'credit-notes', body, 'Failed to create credit note');
  }
  cancelCreditNote(token: string, id: string) {
    return this.post<CreditNote>(token, `credit-notes/${id}/cancel`, undefined, 'Failed to cancel credit note');
  }

  // Payments
  payments(token: string, side: PaymentSide, params?: Query) {
    return this.get<PaymentDoc[]>(token, 'payments', { side, ...params }, 'Failed to load payments');
  }
  createPayment(
    token: string,
    side: PaymentSide,
    body: {
      amount: number;
      method: PaymentMethod;
      customer?: string;
      customerName?: string;
      vendor?: string;
      vendorName?: string;
      reference?: string;
      date?: string;
      allocations: Array<{ salesOrder?: string; vendorBill?: string; amount: number }>;
    }
  ) {
    return this.post<PaymentDoc>(token, 'payments', { side, ...body }, 'Failed to record payment');
  }
  cancelPayment(token: string, side: PaymentSide, id: string) {
    return this.post<PaymentDoc>(token, `payments/${id}/cancel`, { side }, 'Failed to cancel payment');
  }

  // Batch payments
  batches(token: string, params?: Query) {
    return this.get<BatchPayment[]>(token, 'batch-payments', params, 'Failed to load batches');
  }
  unbatched(token: string, side: PaymentSide) {
    return this.get<PaymentDoc[]>(token, 'batch-payments/unbatched', { side }, 'Failed to load open payments');
  }
  createBatch(token: string, body: { direction: PaymentSide; paymentIds: string[]; account?: '1000' | '1100' }) {
    return this.post<BatchPayment>(token, 'batch-payments', body, 'Failed to create batch');
  }
  depositBatch(token: string, id: string) {
    return this.post<BatchPayment>(token, `batch-payments/${id}/deposit`, undefined, 'Failed to deposit batch');
  }
  cancelBatch(token: string, id: string) {
    return this.post<BatchPayment>(token, `batch-payments/${id}/cancel`, undefined, 'Failed to cancel batch');
  }

  // Directories
  customers(token: string, params?: Query) {
    return this.get<AccountingCustomer[]>(token, 'customers', params, 'Failed to load customers');
  }
  vendors(token: string, params?: Query) {
    return this.get<AccountingVendor[]>(token, 'vendors', params, 'Failed to load vendors');
  }
  products(token: string, params?: Query) {
    return this.get<AccountingProduct[]>(token, 'products', params, 'Failed to load products');
  }
}

export const arApService = new ArApService();
