// services/contact.service.ts — unified tenant Contacts directory.
//
// One surface over BOTH in-store (POSCustomer) and ecommerce (User customer)
// customers. The `source` discriminator tells them apart; `key` ("source:id")
// is the opaque handle used for the detail route and every per-contact call.
import type { Order } from './order.service';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export type ContactSource = 'instore' | 'ecommerce' | 'both';

/** Avatar payload sent to the API. `null` clears the stored photo. */
export interface AvatarInput {
  url?: string;
  publicId?: string;
}
export type ContactStatus = 'active' | 'inactive' | 'suspended';

export interface Contact {
  _id: string;
  source: ContactSource;
  /** "source:id" — used for routing + per-contact API calls. */
  key: string;
  ids: { instore?: string; ecommerce?: string };
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatar: string;
  status: ContactStatus;
  loyaltyPoints: number;
  /** Stored-value wallet balance (NGN). A 'both' contact's lives on its in-store record. */
  walletBalance: number;
  totalSpent: number;
  totalOrders: number;
  notes: string;
  createdAt: string;
}

export interface ContactStats {
  total: number;
  instore: number;
  ecommerce: number;
  both: number;
  totalSpent: number;
  loyaltyPoints: number;
}

/** Fields editable for an in-store contact (ecommerce accepts `status` only). */
export interface ContactInput {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  loyaltyPoints?: number;
  totalSpent?: number;
  totalOrders?: number;
  /** Profile photo. Send `null` to remove the current one. */
  avatar?: AvatarInput | null;
  /** Ecommerce-only: the one field an admin may change on a storefront customer. */
  status?: ContactStatus;
}

export interface ContactOrderStats {
  count: number;
  totalSpent: number;
  delivered: number;
  cancelled: number;
}

export interface ContactOrdersPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ContactSpending {
  totalSpent: number;
  orderCount: number;
  avgOrderValue: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  byMonth: { month: string; total: number; count: number }[];
  byPaymentMethod: { method: string; total: number; count: number }[];
  byStatus: { status: string; total: number; count: number }[];
  topProducts: { name: string; quantity: number; total: number }[];
}

// ── Wallet (stored value / store credit) ──────────────────────────────────────

export type WalletTxType = 'credit' | 'debit' | 'adjustment' | 'refund';

export interface WalletTransaction {
  _id: string;
  type: WalletTxType;
  /** Positive integer NGN; direction comes from `type` (debit lowers the balance). */
  amount: number;
  /** Owner balance immediately after this transaction. */
  balanceAfter: number;
  reason: string;
  reference?: string;
  relatedOrder?: { _id: string; orderNumber: string } | null;
  createdBy?: { _id: string; firstName?: string; lastName?: string } | null;
  createdAt: string;
}

export interface WalletStats {
  /** Authoritative current balance, read from the owner record. */
  balance: number;
  credited: number;
  debited: number;
  net: number;
  count: number;
  lastActivityAt: string | null;
}

export interface ContactWallet {
  contact: Contact;
  balance: number;
  stats: WalletStats;
  transactions: WalletTransaction[];
  pagination: ContactOrdersPagination;
}

/** Type / date-range / pagination filters for a contact's wallet ledger. */
export interface WalletParams {
  type?: WalletTxType;
  /** ISO date (yyyy-mm-dd) lower bound, inclusive. */
  from?: string;
  /** ISO date (yyyy-mm-dd) upper bound, inclusive of the whole day. */
  to?: string;
  page?: number;
  limit?: number;
}

/** Admin top-up: always a credit. */
export interface WalletTopUpInput {
  amount: number;
  reason?: string;
}

/** Admin correction: a credit OR debit (a debit may not overdraw). */
export interface WalletAdjustInput {
  type: 'credit' | 'debit';
  amount: number;
  reason?: string;
}

/** Status / date-range / pagination filters for a contact's orders. */
export interface ContactOrdersParams {
  status?: string;
  /** ISO date (yyyy-mm-dd) lower bound, inclusive. */
  from?: string;
  /** ISO date (yyyy-mm-dd) upper bound, inclusive of the whole day. */
  to?: string;
  page?: number;
  limit?: number;
}

export interface ContactListParams {
  source?: ContactSource;
  status?: ContactStatus;
  search?: string;
}

async function handle(res: Response, fallback: string) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || fallback);
  }
  return res.json();
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const jsonAuth = (token: string) => ({
  'Content-Type': 'application/json',
  ...auth(token),
});

export const contactService = {
  async getContacts(
    token: string,
    params?: ContactListParams
  ): Promise<{
    success: boolean;
    data: { contacts: Contact[]; stats: ContactStats };
  }> {
    const qs = new URLSearchParams();
    if (params?.source) qs.set('source', params.source);
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    const url = `${API_URL}/api/contacts${qs.toString() ? `?${qs}` : ''}`;
    return handle(
      await fetch(url, { headers: auth(token) }),
      'Failed to load contacts'
    );
  },

  /** `key` is "source:id" as returned on each Contact. */
  async getContact(
    key: string,
    token: string
  ): Promise<{ success: boolean; data: { contact: Contact } }> {
    return handle(
      await fetch(`${API_URL}/api/contacts/${key.replace(':', '/')}`, {
        headers: auth(token),
      }),
      'Failed to load contact'
    );
  },

  /** Creates an in-store contact (a POSCustomer). */
  async createContact(
    data: ContactInput,
    token: string
  ): Promise<{ success: boolean; data: { contact: Contact } }> {
    return handle(
      await fetch(`${API_URL}/api/contacts`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify(data),
      }),
      'Failed to create contact'
    );
  },

  async updateContact(
    key: string,
    data: Partial<ContactInput>,
    token: string
  ): Promise<{ success: boolean; data: { contact: Contact } }> {
    return handle(
      await fetch(`${API_URL}/api/contacts/${key.replace(':', '/')}`, {
        method: 'PATCH',
        headers: jsonAuth(token),
        body: JSON.stringify(data),
      }),
      'Failed to update contact'
    );
  },

  async removeContact(
    key: string,
    token: string
  ): Promise<{ success: boolean; message: string }> {
    return handle(
      await fetch(`${API_URL}/api/contacts/${key.replace(':', '/')}`, {
        method: 'DELETE',
        headers: auth(token),
      }),
      'Failed to remove contact'
    );
  },

  /** Tenant-scoped orders for one contact (by ecommerce account or POS snapshot). */
  async getContactOrders(
    key: string,
    token: string,
    params?: ContactOrdersParams
  ): Promise<{
    success: boolean;
    data: {
      contact: Contact;
      orders: Order[];
      stats: ContactOrderStats;
      pagination: ContactOrdersPagination;
    };
  }> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return handle(
      await fetch(
        `${API_URL}/api/contacts/${key.replace(':', '/')}/orders${suffix}`,
        { headers: auth(token) }
      ),
      'Failed to load orders'
    );
  },

  /** Lifetime spending analytics for one contact (totals + breakdowns). */
  async getContactSpending(
    key: string,
    token: string
  ): Promise<{
    success: boolean;
    data: { contact: Contact; spending: ContactSpending };
  }> {
    return handle(
      await fetch(`${API_URL}/api/contacts/${key.replace(':', '/')}/spending`, {
        headers: auth(token),
      }),
      'Failed to load spending'
    );
  },

  /** Stored-value wallet: balance + lifetime stats + a paginated, filterable ledger. */
  async getContactWallet(
    key: string,
    token: string,
    params?: WalletParams
  ): Promise<{ success: boolean; data: ContactWallet }> {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return handle(
      await fetch(
        `${API_URL}/api/contacts/${key.replace(':', '/')}/wallet${suffix}`,
        { headers: auth(token) }
      ),
      'Failed to load wallet'
    );
  },

  /** Admin top-up — credits the wallet. Returns the new balance + the ledger row. */
  async topUpWallet(
    key: string,
    token: string,
    data: WalletTopUpInput
  ): Promise<{
    success: boolean;
    data: { balance: number; transaction: WalletTransaction };
  }> {
    return handle(
      await fetch(
        `${API_URL}/api/contacts/${key.replace(':', '/')}/wallet/topup`,
        {
          method: 'POST',
          headers: jsonAuth(token),
          body: JSON.stringify(data),
        }
      ),
      'Failed to top up wallet'
    );
  },

  /** Admin correction — credits OR debits the wallet (a debit may not overdraw). */
  async adjustWallet(
    key: string,
    token: string,
    data: WalletAdjustInput
  ): Promise<{
    success: boolean;
    data: { balance: number; transaction: WalletTransaction };
  }> {
    return handle(
      await fetch(
        `${API_URL}/api/contacts/${key.replace(':', '/')}/wallet/adjust`,
        {
          method: 'POST',
          headers: jsonAuth(token),
          body: JSON.stringify(data),
        }
      ),
      'Failed to adjust wallet'
    );
  },
};
