// services/stockTransfer.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export type TransferStatus = 'draft' | 'confirmed' | 'completed' | 'cancelled';

export interface TransferItem {
  _id?: string;
  subProductId: string;
  subProductName: string;
  sku: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  transferredQty: number;
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
  items: TransferItem[];
  notes?: string;
  scheduledDate?: string;
  completedDate?: string;
  createdAt?: string;
  updatedAt?: string;
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
  ) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.search) qs.set('search', params.search);
    const url = `${API_URL}/api/stock-transfers${qs.toString() ? `?${qs}` : ''}`;
    return handle(
      await fetch(url, { headers: auth(token) }),
      'Failed to load transfers'
    );
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
};
