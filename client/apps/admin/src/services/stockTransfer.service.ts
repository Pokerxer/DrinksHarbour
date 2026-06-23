// services/stockTransfer.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export type TransferStatus =
  | 'draft'
  | 'pending_approval'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'rejected';

export interface TransferItem {
  _id?: string;
  subProductId: string;
  subProductName: string;
  sku: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  transferredQty: number;
  costPrice?: number;
}

export interface StockTransfer {
  _id: string;
  transferNumber: string;
  sourceWarehouse:
    | string
    | { _id: string; name: string; code: string; type?: string };
  destinationWarehouse:
    | string
    | { _id: string; name: string; code: string; type?: string };
  status: TransferStatus;
  currency?: string;
  items: TransferItem[];
  notes?: string;
  scheduledDate?: string;
  completedDate?: string;
  confirmedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: { _id: string; name: string };
  confirmedBy?: { _id: string; name: string };
  completedBy?: { _id: string; name: string };
  cancelledBy?: { _id: string; name: string };
  cancelledAt?: string;
  /** Snapshot value (Σ qty × unit cost) used by the approval gate. */
  totalValue?: number;
  approvedBy?: { _id: string; name: string };
  approvedAt?: string;
  rejectedBy?: { _id: string; name: string };
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface TransferStats {
  draft: number;
  pending_approval: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  rejected: number;
}

export interface ListResponse {
  success: boolean;
  data: StockTransfer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  stats: TransferStats;
}

async function handle(res: Response, fallback: string) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || fallback);
  }
  return res.json();
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const jsonAuth = (token: string) => ({
  'Content-Type': 'application/json',
  ...auth(token),
});

export const stockTransferService = {
  async create(
    body: {
      sourceWarehouse: string;
      destinationWarehouse: string;
      items: Omit<TransferItem, '_id' | 'transferredQty'>[];
      notes?: string;
      scheduledDate?: string;
      status?: 'draft' | 'confirmed';
      currency?: string;
    },
    token: string
  ) {
    return handle(
      await fetch(`${API_URL}/api/stock-transfers`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify(body),
      }),
      'Failed to create transfer'
    );
  },

  async list(
    token: string,
    params?: { status?: string; page?: number; limit?: number; search?: string }
  ): Promise<ListResponse> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.search) qs.set('search', params.search);
    const url = `${API_URL}/api/stock-transfers${qs.toString() ? `?${qs}` : ''}`;
    return handle(
      await fetch(url, { headers: auth(token) }),
      'Failed to load transfers'
    ) as Promise<ListResponse>;
  },

  async get(id: string, token: string) {
    return handle(
      await fetch(`${API_URL}/api/stock-transfers/${id}`, {
        headers: auth(token),
      }),
      'Failed to load transfer'
    );
  },

  async update(
    id: string,
    body: Partial<{
      sourceWarehouse: string;
      destinationWarehouse: string;
      items: Omit<TransferItem, '_id' | 'transferredQty'>[];
      notes: string;
      scheduledDate: string;
    }>,
    token: string
  ) {
    return handle(
      await fetch(`${API_URL}/api/stock-transfers/${id}`, {
        method: 'PATCH',
        headers: jsonAuth(token),
        body: JSON.stringify(body),
      }),
      'Failed to update transfer'
    );
  },

  async remove(id: string, token: string) {
    return handle(
      await fetch(`${API_URL}/api/stock-transfers/${id}`, {
        method: 'DELETE',
        headers: auth(token),
      }),
      'Failed to delete transfer'
    );
  },

  async updateStatus(id: string, status: TransferStatus, token: string) {
    return handle(
      await fetch(`${API_URL}/api/stock-transfers/${id}/status`, {
        method: 'PATCH',
        headers: jsonAuth(token),
        body: JSON.stringify({ status }),
      }),
      'Failed to update transfer status'
    );
  },

  async approve(id: string, token: string) {
    return handle(
      await fetch(`${API_URL}/api/stock-transfers/${id}/approve`, {
        method: 'PATCH',
        headers: jsonAuth(token),
      }),
      'Failed to approve transfer'
    );
  },

  async reject(id: string, reason: string, token: string) {
    return handle(
      await fetch(`${API_URL}/api/stock-transfers/${id}/reject`, {
        method: 'PATCH',
        headers: jsonAuth(token),
        body: JSON.stringify({ reason }),
      }),
      'Failed to reject transfer'
    );
  },
};
