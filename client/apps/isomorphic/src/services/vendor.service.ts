const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface Vendor {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  taxId?: string;
  notes?: string;
  paymentTerms?: 'prepaid' | 'net_7' | 'net_14' | 'net_30' | 'net_60';
  isActive?: boolean;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  contactPerson?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  bankDetails?: {
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
  };
}

export interface CreateVendorInput {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  taxId?: string;
  notes?: string;
  paymentTerms?: string;
  address?: Vendor['address'];
  contactPerson?: Vendor['contactPerson'];
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok || !body.success)
    throw new Error(body.message || 'Request failed');
  return body;
}

export const vendorService = {
  async search(query: string, token: string): Promise<Vendor[]> {
    if (!query || query.trim().length < 2) return [];
    const qs = new URLSearchParams({ q: query.trim(), limit: '10' });
    const res = await apiFetch<{ success: boolean; vendors: Vendor[] }>(
      `${API_URL}/api/vendors/search?${qs}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.vendors || [];
  },

  async getAll(token: string): Promise<Vendor[]> {
    const res = await apiFetch<{ success: boolean; data: Vendor[] }>(
      `${API_URL}/api/vendors`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data || [];
  },

  async getById(id: string, token: string): Promise<Vendor> {
    const res = await apiFetch<{ success: boolean; data: Vendor }>(
      `${API_URL}/api/vendors/${id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  },

  async create(input: CreateVendorInput, token: string): Promise<Vendor> {
    const res = await apiFetch<{ success: boolean; data: Vendor }>(
      `${API_URL}/api/vendors`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      }
    );
    return res.data;
  },

  async update(
    id: string,
    input: Partial<CreateVendorInput>,
    token: string
  ): Promise<Vendor> {
    const res = await apiFetch<{ success: boolean; data: Vendor }>(
      `${API_URL}/api/vendors/${id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      }
    );
    return res.data;
  },

  async delete(
    id: string,
    token: string
  ): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>(
      `${API_URL}/api/vendors/${id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
    );
  },
};
