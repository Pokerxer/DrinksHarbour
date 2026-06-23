// services/warehouse.service.ts — the physical place
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface WarehouseAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface WarehouseContact {
  name?: string;
  phone?: string;
  email?: string;
}

export interface Warehouse {
  _id: string;
  tenant: string;
  name: string;
  code: string;
  type: 'warehouse' | 'store' | 'distribution_center';
  address?: WarehouseAddress;
  contact?: WarehouseContact;
  notes?: string;
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
  contact?: WarehouseContact;
  notes?: string;
  isActive?: boolean;
  isDefault?: boolean;
};

export interface WarehouseSettings {
  /** Pre-selected warehouse id for new stock operations; '' = none */
  defaultWarehouse: string;
  /** Global low-stock threshold for warehouse stock highlighting */
  lowStockThreshold: number;
  valuationMethod: 'fifo' | 'average';
  allowNegativeStock: boolean;
  batchTrackingEnabled: boolean;
  /** Warn when a batch is within this many days of expiry */
  nearExpiryDays: number;

  // Replenishment & alerts
  /** Global default reorder point */
  reorderPoint: number;
  /** Default quantity suggested when reordering */
  reorderQuantity: number;
  /** Flag items at/below the reorder point in warehouse views */
  flagBelowReorderPoint: boolean;
  /** Surface an alert when an item reaches zero on hand */
  outOfStockAlert: boolean;
  /** Max on-hand before an item is flagged overstocked; 0 = disabled */
  overstockCeiling: number;

  // Transfers
  requireTransferApproval: boolean;
  allowInterWarehouseTransfers: boolean;
  /** Transfers at/above this value need approval; 0 = all when approval on */
  transferApprovalThreshold: number;

  // Expiry enforcement
  /** Block selling/picking stock that has expired */
  blockExpiredStock: boolean;
  /** Prefer first-expired-first-out when picking stock */
  fefoPicking: boolean;
  /** Automatically quarantine batches once they expire */
  autoQuarantineExpired: boolean;
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

  async getBatches(
    warehouseId: string,
    token: string,
    params: { subProduct?: string; size?: string } = {}
  ): Promise<{ success: boolean; data: WarehouseBatch[] }> {
    const qs = new URLSearchParams();
    if (params.subProduct) qs.set('subProduct', params.subProduct);
    if (params.size) qs.set('size', params.size);
    const url = `${API_URL}/api/warehouses/${warehouseId}/batches${qs.toString() ? `?${qs}` : ''}`;
    return handle(
      await fetch(url, { headers: auth(token) }),
      'Failed to load batches'
    );
  },

  async getWarehouseSettings(token: string): Promise<{
    success: boolean;
    data: { warehouseSettings: WarehouseSettings };
  }> {
    return handle(
      await fetch(`${API_URL}/api/warehouses/settings`, {
        headers: auth(token),
      }),
      'Failed to load warehouse settings'
    );
  },

  async updateWarehouseSettings(
    token: string,
    warehouseSettings: Partial<WarehouseSettings>
  ): Promise<{
    success: boolean;
    data: { warehouseSettings: WarehouseSettings };
  }> {
    return handle(
      await fetch(`${API_URL}/api/warehouses/settings`, {
        method: 'PATCH',
        headers: jsonAuth(token),
        body: JSON.stringify({ warehouseSettings }),
      }),
      'Failed to update warehouse settings'
    );
  },
};

export interface WarehouseBatch {
  _id: string;
  batchNumber: string;
  quantity: number;
  initialQuantity?: number;
  expiryDate?: string | null;
  receivedDate?: string;
  size?: { _id: string; size?: string } | string;
  subProduct?: string;
  poNumber?: string;
}
