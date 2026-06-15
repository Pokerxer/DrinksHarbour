// services/warehouse.service.ts — the physical place
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface WarehouseAddress {
  line1?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface Warehouse {
  _id: string;
  tenant: string;
  name: string;
  code: string;
  type: 'warehouse' | 'store' | 'distribution_center';
  address?: WarehouseAddress;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WarehouseInput = {
  name: string;
  code: string;
  type: Warehouse['type'];
  address?: WarehouseAddress;
  isActive?: boolean;
  isDefault?: boolean;
};

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

export const warehouseService = {
  async getWarehouses(
    token: string,
    params?: { isActive?: boolean; type?: string }
  ) {
    const qs = new URLSearchParams();
    if (params?.isActive !== undefined)
      qs.set('isActive', String(params.isActive));
    if (params?.type) qs.set('type', params.type);
    const url = `${API_URL}/api/warehouses${qs.toString() ? `?${qs}` : ''}`;
    return handle(
      await fetch(url, { headers: auth(token) }),
      'Failed to load warehouses'
    );
  },
  async getWarehouseById(id: string, token: string) {
    return handle(
      await fetch(`${API_URL}/api/warehouses/${id}`, { headers: auth(token) }),
      'Failed to load warehouse'
    );
  },
  async createWarehouse(data: WarehouseInput, token: string) {
    return handle(
      await fetch(`${API_URL}/api/warehouses`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify(data),
      }),
      'Failed to create warehouse'
    );
  },
  async updateWarehouse(
    id: string,
    data: Partial<WarehouseInput>,
    token: string
  ) {
    return handle(
      await fetch(`${API_URL}/api/warehouses/${id}`, {
        method: 'PATCH',
        headers: jsonAuth(token),
        body: JSON.stringify(data),
      }),
      'Failed to update warehouse'
    );
  },
  async deleteWarehouse(id: string, token: string) {
    return handle(
      await fetch(`${API_URL}/api/warehouses/${id}`, {
        method: 'DELETE',
        headers: auth(token),
      }),
      'Failed to delete warehouse'
    );
  },
};
