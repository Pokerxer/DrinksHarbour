// services/warehouseStock.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface WarehouseStockRow {
  _id: string;
  warehouse:
    | string
    | { _id: string; name?: string; code?: string; type?: string };
  subProduct:
    | string
    | {
        _id: string;
        sku?: string;
        imagesOverride?: { url?: string }[];
        product?: {
          _id: string;
          name?: string;
          slug?: string;
          images?: { url?: string }[];
        };
      };
  size: string | { _id: string; size?: string };
  currentQuantity: number;
  reservedQuantity: number;
  zone?: string;
  aisle?: string;
  shelf?: string;
  bin?: string;
}

export type AdjustType = 'received' | 'shipped' | 'adjusted';

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

export const warehouseStockService = {
  async getWarehouseStock(warehouseId: string, token: string) {
    return handle(
      await fetch(`${API_URL}/api/warehouses/${warehouseId}/stock`, {
        headers: auth(token),
      }),
      'Failed to load warehouse stock'
    );
  },
  async adjustStock(
    warehouseId: string,
    body: {
      subProduct: string;
      size: string;
      quantity: number;
      type: AdjustType;
      notes?: string;
    },
    token: string
  ) {
    return handle(
      await fetch(`${API_URL}/api/warehouses/${warehouseId}/stock/adjust`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify(body),
      }),
      'Failed to adjust stock'
    );
  },
  async transferStock(
    body: {
      subProduct: string;
      size: string;
      fromWarehouse: string;
      toWarehouse: string;
      quantity: number;
      notes?: string;
    },
    token: string
  ) {
    return handle(
      await fetch(`${API_URL}/api/warehouses/transfer`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify(body),
      }),
      'Failed to transfer stock'
    );
  },
  async getStockByWarehouse(subProductId: string, token: string) {
    return handle(
      await fetch(
        `${API_URL}/api/subproducts/${subProductId}/stock-by-warehouse`,
        {
          headers: auth(token),
        }
      ),
      'Failed to load stock breakdown'
    );
  },
};
