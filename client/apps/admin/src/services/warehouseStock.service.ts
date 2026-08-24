// services/warehouseStock.service.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

/**
 * Server-computed warehouse reporting status for one stock line, derived from the
 * tenant's warehouseSettings (low-stock / reorder / overstock / near-expiry
 * thresholds). The server is the source of truth; the client renders these flags.
 */
export interface StockFlags {
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  outOfStock: boolean;
  lowStock: boolean;
  belowReorder: boolean;
  overstocked: boolean;
  nearExpiry: boolean;
  available: number;
  reorderPoint: number;
  reorderQuantity: number;
  outOfStockAlert: boolean;
  expiryDays: number | null;
}

/**
 * One WarehouseMovement audit row — a stock change on a (warehouse, subProduct,
 * size) line. quantity is signed by convention of `type`; balanceAfter is the
 * line's on-hand count immediately after the movement.
 */
export interface WarehouseMovement {
  _id: string;
  type:
    | 'received'
    | 'adjusted'
    | 'shipped'
    | 'transfer_in'
    | 'transfer_out'
    | 'returned';
  quantity: number;
  balanceAfter: number;
  /** Per-unit buy price captured with the movement (receipts), when known. */
  unitCost?: number | null;
  reference?: string | null;
  transferGroupId?: string | null;
  performedBy?: { _id: string; name?: string; email?: string } | null;
  createdAt: string;
}

/** Resolved "last cost price" for a stock line — drives the buy/transfer UIs. */
export interface LastCost {
  unitCost: number | null;
  source: 'movement' | 'batch' | 'standard' | 'none';
  asOf: string | null;
  reference?: string | null;
}

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
        costPrice?: number;
        baseSellingPrice?: number;
        currency?: string;
        product?: {
          _id: string;
          name?: string;
          slug?: string;
          images?: { url?: string }[];
        };
      };
  size:
    | string
    | {
        _id: string;
        size?: string;
        sellingPrice?: number;
        costPrice?: number;
      };
  currentQuantity: number;
  reservedQuantity: number;
  zone?: string;
  aisle?: string;
  shelf?: string;
  bin?: string;
  /** Earliest batch expiry across this line's still-stocked lots (ISO), or null. */
  earliestExpiry?: string | null;
  /** Server-computed reporting flags from warehouseSettings thresholds. */
  flags?: StockFlags;
}

/**
 * Flattened stock line returned by GET /api/warehouses/stock/all and consumed by
 * the warehouse-analysis page. One row = one (warehouse, subProduct, size) line,
 * carrying its own cost basis and earliest batch expiry.
 */
export interface StockRow {
  _id: string;
  warehouseId: string;
  warehouseName: string;
  subProductId: string;
  productName: string;
  /** Central product category (from Product.category), 'Uncategorized' when unset. */
  categoryId?: string | null;
  categoryName?: string;
  sku: string;
  sizeId: string;
  sizeName: string;
  currentQuantity: number;
  reservedQuantity: number;
  costPrice: number;
  /** Retail price for the line (size sellingPrice, else subProduct sellingPrice). */
  sellingPrice?: number;
  /** Valuation method used to derive costPrice (fifo | average | standard). */
  valuationMethod?: string;
  minStockLevel: number;
  earliestExpiry: string | null;
  /** Server-computed reporting flags from warehouseSettings thresholds. */
  flags?: StockFlags;
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
  async getAllStock(
    token: string
  ): Promise<{ success: boolean; data: StockRow[] }> {
    return handle(
      await fetch(`${API_URL}/api/warehouses/stock/all`, {
        headers: auth(token),
      }),
      'Failed to load warehouse stock'
    );
  },
  async getWarehouseStock(warehouseId: string, token: string) {
    return handle(
      await fetch(`${API_URL}/api/warehouses/${warehouseId}/stock`, {
        headers: auth(token),
      }),
      'Failed to load warehouse stock'
    );
  },
  async getLastCost(
    subProduct: string,
    size: string,
    token: string
  ): Promise<{ success: boolean; data: LastCost }> {
    const qs = new URLSearchParams({ subProduct, size });
    return handle(
      await fetch(`${API_URL}/api/warehouses/last-cost?${qs.toString()}`, {
        headers: auth(token),
      }),
      'Failed to load last cost'
    ) as { success: boolean; data: LastCost };
  },
  async getWarehouseMovements(
    warehouseId: string,
    token: string,
    params: { subProduct?: string; size?: string; limit?: number } = {}
  ): Promise<{ success: boolean; data: WarehouseMovement[] }> {
    const qs = new URLSearchParams();
    if (params.subProduct) qs.set('subProduct', params.subProduct);
    if (params.size) qs.set('size', params.size);
    if (params.limit) qs.set('limit', String(params.limit));
    // handle() is untyped upstream; assert the envelope here.
    return handle(
      await fetch(
        `${API_URL}/api/warehouses/${warehouseId}/movements${qs.toString() ? `?${qs}` : ''}`,
        { headers: auth(token) }
      ),
      'Failed to load movement history'
    ) as { success: boolean; data: WarehouseMovement[] };
  },
  async adjustStock(
    warehouseId: string,
    body: {
      subProduct: string;
      size: string;
      quantity: number;
      type: AdjustType;
      notes?: string;
      /** Per-unit buy price for receipts; persisted on the movement. */
      unitCost?: number | null;
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
