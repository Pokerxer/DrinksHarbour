// services/tax.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export type TaxType = 'output' | 'input';
export type TaxFlow = 'sale' | 'purchase' | 'transfer' | 'return';
export type LedgerSourceType =
  | 'sales_order'
  | 'purchase_order'
  | 'vendor_bill'
  | 'stock_transfer'
  | 'vendor_return';
export type LedgerDirection = 'collected' | 'paid' | 'internal';

export interface Tax {
  _id: string;
  name: string;
  rate: number;
  type: TaxType;
  appliesTo: TaxFlow[];
  isDefault: boolean;
  isActive: boolean;
  createdAt?: string;
}

export interface TaxRecord {
  _id: string;
  tax?: string | null;
  taxName: string;
  taxRate: number;
  sourceType: LedgerSourceType;
  sourceId: string;
  sourceNumber: string;
  direction: LedgerDirection;
  taxableBase: number;
  taxAmount: number;
  currency: string;
  status: 'posted' | 'reversed';
  postedAt: string;
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

class TaxService {
  private getHeaders(token: string) {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  private async unwrap<T>(response: Response, fallbackMessage: string): Promise<Envelope<T>> {
    let body: Envelope<T>;
    try {
      body = (await response.json()) as Envelope<T>;
    } catch {
      throw new Error(response.ok ? fallbackMessage : `${fallbackMessage} (HTTP ${response.status})`);
    }
    if (!response.ok || body.success === false) throw new Error(body.message || fallbackMessage);
    return body;
  }

  async list(token: string, params?: { type?: string; isActive?: boolean }): Promise<Envelope<Tax[]>> {
    const q = new URLSearchParams();
    if (params?.type) q.set('type', params.type);
    if (params?.isActive !== undefined) q.set('isActive', String(params.isActive));
    const res = await fetch(`${API_URL}/api/taxes?${q}`, { headers: this.getHeaders(token) });
    return this.unwrap<Tax[]>(res, 'Failed to load taxes');
  }

  async create(token: string, body: Partial<Tax>): Promise<Envelope<Tax>> {
    const res = await fetch(`${API_URL}/api/taxes`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(body),
    });
    return this.unwrap<Tax>(res, 'Failed to create tax');
  }

  async update(id: string, token: string, body: Partial<Tax>): Promise<Envelope<Tax>> {
    const res = await fetch(`${API_URL}/api/taxes/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(token),
      body: JSON.stringify(body),
    });
    return this.unwrap<Tax>(res, 'Failed to update tax');
  }

  async remove(id: string, token: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`${API_URL}/api/taxes/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    return this.unwrap<null>(res, 'Failed to delete tax');
  }

  async records(
    token: string,
    params?: { sourceType?: string; status?: string; from?: string; to?: string; page?: number; limit?: number }
  ): Promise<Envelope<TaxRecord[]>> {
    const q = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.set(k, String(v));
    });
    const res = await fetch(`${API_URL}/api/taxes/records?${q}`, { headers: this.getHeaders(token) });
    return this.unwrap<TaxRecord[]>(res, 'Failed to load tax ledger');
  }

  async summary(token: string, params?: { from?: string; to?: string }): Promise<
    Envelope<{
      collected: number;
      paid: number;
      internal: number;
      netPayable: number;
      byTax: Array<{ taxName: string; taxRate: number; collected: number; paid: number }>;
    }>
  > {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    const res = await fetch(`${API_URL}/api/taxes/summary?${q}`, { headers: this.getHeaders(token) });
    return this.unwrap(res, 'Failed to load tax summary');
  }
}

export const taxService = new TaxService();
