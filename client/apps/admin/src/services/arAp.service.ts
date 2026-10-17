// services/arAp.service.ts
//
// Typed client for the Accounting Customers/Vendors layer (AR/AP):
// invoices, bills, credit notes, payments, batch payments, products,
// customers, vendors. Same envelope style as accounting.service.ts.

const ACCOUNTING_URL = '/api/accounting';

export type PaymentSide = 'customer' | 'vendor';

export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'card'
  | 'pos'
  | 'wallet';

export interface ArApSummary {
  count: number;
  totalOutstanding: number;
  onAccount?: number;
  reviewCount?: number;
  reviewBalanceCount?: number;
  reviewOutstanding?: number;
  buckets: Record<string, number>;
}

export interface InvoiceReturnSummary {
  status: 'none' | 'partial' | 'full' | 'review';
  returnedUnits: number;
  recordedUnits: number;
  soldUnits: number;
  needsReview: boolean;
  refundRecorded: boolean;
  truncated: boolean;
  lines: Array<{
    source: 'sales' | 'pos';
    sourceId: string;
    sourceNumber: string;
    reference?: string;
    product: string;
    returned: number;
  }>;
}
export interface OpenInvoice {
  _id: string;
  currency?: string;
  orderNumber?: string;
  date: string;
  dueDate?: string;
  outstanding: number;
  total: number;
  amountPaid: number;
  creditedAmount?: number;
  paymentStatus: string;
  refundedAmount?: number;
  creditNoteAmount?: number;
  returnSummary?: InvoiceReturnSummary;
  orderStatus?: string;
  source?: 'sales' | 'pos';
  persisted?: boolean;
  sourceId?: string;
  sourceNumber?: string;
  state?: 'draft' | 'posted' | 'cancelled';
  reconciliationIssue?: string;
  customer?: { _id: string; firstName: string; lastName: string } | null;
  customerSnapshot?: {
    name?: string;
    customerId?: string;
    email?: string;
    phone?: string;
  };
}

export interface SavedInvoice extends OpenInvoice {
  checkedAt?: string;
  postedAt?: string;
  detailContext?: {
    issuer: {
      name: string;
      address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
      };
      bankAccounts: Array<{
        bankName: string;
        accountNumber: string;
        accountName?: string;
      }>;
    };
    activity: Array<{
      id: string;
      kind: 'receipt' | 'credit' | 'refund' | 'pos_receipt';
      label: string;
      date?: string;
      amount: number;
      status: string;
      scope: 'invoice' | 'customer_account' | 'source_document';
      method?: string;
      reference?: string;
    }>;
  };
  editableDraft?: boolean;
  number: string;
  source: 'sales' | 'pos';
  sourceId: string;
  state: 'draft' | 'posted' | 'cancelled';
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingFee?: number;
  tipAmount?: number;
  roundingAmount?: number;
  promotionTotal?: number;
  couponDiscount?: number;
  pricelistCartDiscount?: number;
  loyaltyRedeemed?: number;
  invoiceAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  notes?: string;
  terms?: string;
  items: Array<{
    lineType: string;
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
    taxAmount?: number;
    lineTotal?: number;
    promoDiscount?: number;
    packSize?: number;
    uom?: string;
  }>;
}

export interface OpenBill {
  _id: string;
  billNumber?: string;
  vendorName?: string;
  date: string;
  dueDate?: string;
  outstanding: number;
  totalAmount: number;
  paidAmount: number;
  status: string;
  vendor?: { _id: string; name: string } | null;
}

export interface CreditAllocation {
  invoice?: { id: string; number: string };
  salesOrder: string;
  amount: number;
  appliedAt: string;
  appliedBy?: string;
}

export interface CreditNote {
  _id: string;
  /** Absent while the note is a draft — allocated when it is posted. */
  number?: string;
  customerName?: string;
  customer?: { _id: string; firstName: string; lastName: string } | null;
  salesOrder?: string;
  date: string;
  reason?: string;
  amount: number;
  taxAmount: number;
  status: 'draft' | 'applied' | 'cancelled';
  /** VAT-inclusive credit the customer holds and has not spent on an invoice. */
  unappliedAmount: number;
  invoice?: { id: string; number: string };
  allocations: CreditAllocation[];
  postedAt?: string;
}

/** What a customer's credit panel renders. */
export interface CustomerCredit {
  customer: string;
  /** Credit held and unspent. */
  balance: number;
  data: CreditNote[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface PaymentSummary {
  sourceAmount?: number;
  refundedAmount?: number;
  activeAmount: number;
  allocated: number;
  unallocated: number;
  cancelledAmount: number;
}
export interface PaymentDoc {
  readOnly?: boolean;
  source?: 'sales' | 'pos';
  sourceHref?: string;
  sourceId?: string;
  invoice?: { id: string; label: string; href: string };
  refundedAmount?: number;
  refundIssue?: string;
  _id: string;
  number: string;
  customerName?: string;
  vendorName?: string;
  customer?: { _id: string; firstName: string; lastName: string } | null;
  vendor?: { _id: string; name: string } | null;
  date: string;
  amount: number;
  method: PaymentMethod | 'split';
  reference?: string;
  allocations: Array<{
    salesOrder?: string;
    vendorBill?: string;
    amount: number;
    document?: {
      id: string;
      label: string;
      href: string;
      status?: string;
      outstanding?: number;
    };
    purchaseOrder?: { id: string; label: string; href: string };
  }>;
  batch?: string | null;
  status: 'active' | 'cancelled';
}

export type BatchAccount = '1000' | '1100' | '2200';
export interface BatchMember {
  key: string;
  _id?: string;
  origin: 'accounting' | 'sales' | 'pos';
  account: BatchAccount;
  paymentId?: string;
  journalId?: string;
  sourceId?: string;
  number: string;
  name: string;
  date: string;
  method: string;
  capturedAmount: number;
  refundedAmount: number;
  amount: number;
  sourceHref?: string;
  invoice?: { id: string; label: string; href: string };
  allocations?: PaymentDoc['allocations'];
}
export interface BatchSummary {
  openCount: number;
  openAmount: number;
  completedCount: number;
  completedAmount: number;
  cancelledCount: number;
  cancelledAmount: number;
}
export interface BatchPayment {
  _id: string;
  number: string;
  direction: PaymentSide;
  date: string;
  account: BatchAccount;
  total: number;
  status: 'open' | 'deposited' | 'cancelled';
  depositedAt?: string;
  members?: BatchMember[];
  historyAvailable?: boolean;
  needsReview?: boolean;
  reviewReason?: string;
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
  /** Credit held and unspent. Distinct from `outstanding`, which is owed. */
  creditBalance: number;
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

export interface CreditNoteSummary {
  count: number;
  postedTotal: number;
  appliedTotal: number;
  available: number;
  draftTotal: number;
}

interface Envelope<T> {
  summary?: CreditNoteSummary;
  paymentSummary?: PaymentSummary;
  batchSummary?: BatchSummary;
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
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  private async unwrap<T>(
    res: Response,
    fallback: string
  ): Promise<Envelope<T>> {
    let body: Envelope<T>;
    try {
      body = (await res.json()) as Envelope<T>;
    } catch {
      throw new Error(res.ok ? fallback : `${fallback} (HTTP ${res.status})`);
    }
    if (!res.ok || body.success === false)
      throw new Error(body.message || fallback);
    return body;
  }

  issueInvoice(token: string, id: string, dueDate?: string) {
    return this.post<{ _id: string }>(
      token,
      `receivables/invoices/${id}/issue`,
      { dueDate }
    );
  }
  saveInvoiceDraft(token: string, sourceId: string) {
    return this.post<SavedInvoice>(token, 'receivables/invoices/drafts', {
      sourceId,
    });
  }
  invoice(token: string, id: string) {
    return this.get<SavedInvoice>(token, `receivables/invoices/${id}`);
  }
  reconcileInvoice(token: string, id: string) {
    return this.post<SavedInvoice>(
      token,
      `receivables/invoices/${id}/reconcile`
    );
  }

  private async get<T>(
    token: string,
    path: string,
    params?: Query,
    fallback = 'Request failed'
  ): Promise<Envelope<T>> {
    const res = await fetch(`${ACCOUNTING_URL}/${path}${toQuery(params)}`, {
      headers: this.headers(token),
    });
    return this.unwrap<T>(res, fallback);
  }

  private async post<T>(
    token: string,
    path: string,
    body?: unknown,
    fallback = 'Request failed'
  ): Promise<Envelope<T>> {
    const res = await fetch(`${ACCOUNTING_URL}/${path}`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify(body ?? {}),
    });
    return this.unwrap<T>(res, fallback);
  }

  // Summaries + documents
  receivablesSummary(token: string, invoiceLedger = false) {
    return this.get<ArApSummary>(
      token,
      invoiceLedger ? 'receivables/invoices/summary' : 'receivables/summary',
      undefined,
      'Failed to load receivables'
    );
  }
  payablesSummary(token: string) {
    return this.get<ArApSummary>(
      token,
      'payables/summary',
      undefined,
      'Failed to load payables'
    );
  }
  invoices(token: string, params?: Query) {
    return this.get<OpenInvoice[]>(
      token,
      'receivables/invoices',
      params,
      'Failed to load invoices'
    );
  }
  bills(token: string, params?: Query) {
    return this.get<OpenBill[]>(
      token,
      'payables/bills',
      params,
      'Failed to load bills'
    );
  }

  // Credit notes
  creditNotes(token: string, params?: Query) {
    return this.get<CreditNote[]>(
      token,
      'credit-notes',
      params,
      'Failed to load credit notes'
    );
  }
  /**
   * Creates a DRAFT unless `post: true`. A draft has not touched the ledger, so
   * nothing needs reversing if it turns out to be wrong.
   */
  createCreditNote(
    token: string,
    body: {
      amount: number;
      taxAmount?: number;
      customer?: string;
      customerName?: string;
      salesOrder?: string;
      reason?: string;
      date?: string;
      post?: boolean;
    }
  ) {
    return this.post<CreditNote>(
      token,
      'credit-notes',
      body,
      'Failed to create credit note'
    );
  }
  postCreditNote(token: string, id: string) {
    return this.post<CreditNote>(
      token,
      `credit-notes/${id}/post`,
      undefined,
      'Failed to post credit note'
    );
  }
  /** Spend unapplied credit on an invoice. Moves no journal entry. */
  applyCredit(
    token: string,
    body: { salesOrder: string; amount?: number; customer?: string }
  ) {
    return this.post<{ salesOrder: string; customer: string; applied: number }>(
      token,
      'credit-notes/apply',
      body,
      'Failed to apply credit'
    );
  }
  customerCredits(token: string, customerId: string, params?: Query) {
    return this.get<CustomerCredit>(
      token,
      `customer-credits/${customerId}`,
      params,
      'Failed to load customer credit'
    );
  }
  cancelCreditNote(token: string, id: string) {
    return this.post<CreditNote>(
      token,
      `credit-notes/${id}/cancel`,
      undefined,
      'Failed to cancel credit note'
    );
  }

  // Payments
  payments(token: string, side: PaymentSide, params?: Query) {
    return this.get<PaymentDoc[]>(
      token,
      'payments',
      { side, ...params },
      'Failed to load payments'
    );
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
      allocations: Array<{
        salesOrder?: string;
        vendorBill?: string;
        amount: number;
      }>;
    }
  ) {
    return this.post<PaymentDoc>(
      token,
      'payments',
      { side, ...body },
      'Failed to record payment'
    );
  }
  cancelPayment(token: string, side: PaymentSide, id: string) {
    return this.post<PaymentDoc>(
      token,
      `payments/${id}/cancel`,
      { side },
      'Failed to cancel payment'
    );
  }

  // Batch payments
  batches(token: string, params?: Query) {
    return this.get<BatchPayment[]>(
      token,
      'batch-payments',
      params,
      'Failed to load batches'
    );
  }
  unbatched(token: string, side: PaymentSide, params?: Query) {
    return this.get<BatchMember[]>(
      token,
      'batch-payments/unbatched',
      { side, ...params },
      'Failed to load open payments'
    );
  }
  createBatch(
    token: string,
    body: {
      direction: PaymentSide;
      paymentIds: string[];
      account?: BatchAccount;
      expectedMembers?: Array<
        Pick<
          BatchMember,
          'key' | 'amount' | 'capturedAmount' | 'refundedAmount'
        >
      >;
    }
  ) {
    return this.post<BatchPayment>(
      token,
      'batch-payments',
      body,
      'Failed to create batch'
    );
  }
  depositBatch(token: string, id: string) {
    return this.post<BatchPayment>(
      token,
      `batch-payments/${id}/deposit`,
      undefined,
      'Failed to deposit batch'
    );
  }
  previewBatchSelection(
    token: string,
    body: {
      direction: PaymentSide;
      account: BatchAccount;
      paymentIds: string[];
    }
  ) {
    return this.post<BatchMember[]>(
      token,
      'batch-payments/preview',
      body,
      'Could not check selected payments'
    );
  }
  cancelBatch(token: string, id: string) {
    return this.post<BatchPayment>(
      token,
      `batch-payments/${id}/cancel`,
      undefined,
      'Failed to cancel batch'
    );
  }

  // Directories
  customers(token: string, params?: Query) {
    return this.get<AccountingCustomer[]>(
      token,
      'customers',
      params,
      'Failed to load customers'
    );
  }
  vendors(token: string, params?: Query) {
    return this.get<AccountingVendor[]>(
      token,
      'vendors',
      params,
      'Failed to load vendors'
    );
  }
  products(token: string, params?: Query) {
    return this.get<AccountingProduct[]>(
      token,
      'products',
      params,
      'Failed to load products'
    );
  }
}

export const arApService = new ArApService();
