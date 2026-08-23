// app/shared/warehouses/warehouse-detail/row-utils.ts
//
// Shared derivations for a WarehouseStockRow: availability, status, location
// label. One source of truth for the grid, table, stats cards, toolbar filter
// chip and the exports.

import type { WarehouseStockRow } from '@/services/warehouseStock.service';
import {
  productNameOf as nameOf,
  sizeLabelOf as sizeOf,
  skuOf,
} from '../warehouse-ref-helpers';

// Fallback low-stock threshold; overridden by the tenant's warehouse settings.
export const LOW_STOCK = 10;

export const availOf = (r: WarehouseStockRow) =>
  Math.max(0, r.currentQuantity - r.reservedQuantity);

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

// Prefer the server-computed status (honours the tenant's warehouseSettings
// thresholds); fall back to a local low-stock check for older API responses.
export const statusOf = (
  r: WarehouseStockRow,
  lowStock: number = LOW_STOCK
): StockStatus => {
  if (r.flags?.status) return r.flags.status;
  if (r.currentQuantity <= 0) return 'out_of_stock';
  if (availOf(r) <= lowStock) return 'low_stock';
  return 'in_stock';
};

/** Server says this line is at/below its reorder point (when flagging is on). */
export const belowReorderOf = (r: WarehouseStockRow): boolean =>
  r.flags?.belowReorder === true;

export const STATUS_LABEL: Record<StockStatus, string> = {
  out_of_stock: 'Out',
  low_stock: 'Low',
  in_stock: 'In stock',
};

const SEVERITY: Record<StockStatus, number> = {
  out_of_stock: 0,
  low_stock: 1,
  in_stock: 2,
};

export const statusSeverityOf = (
  r: WarehouseStockRow,
  lowStock?: number
): number => SEVERITY[statusOf(r, lowStock)];

export const locationOf = (r: WarehouseStockRow) =>
  [r.zone, r.aisle, r.shelf, r.bin].filter(Boolean).join(' · ');

/** Sort comparator over every sortable key used by the table view. */
export type SortKey =
  | 'name'
  | 'size'
  | 'onHand'
  | 'reserved'
  | 'available'
  | 'status';

export const sortValueOf = (
  r: WarehouseStockRow,
  key: SortKey,
  lowStock?: number
): string | number => {
  switch (key) {
    case 'name':
      return String(nameOf(r) || skuOf(r)).toLowerCase();
    case 'size':
      return String(sizeOf(r)).toLowerCase();
    case 'onHand':
      return r.currentQuantity;
    case 'reserved':
      return r.reservedQuantity;
    case 'available':
      return availOf(r);
    case 'status':
      return statusSeverityOf(r, lowStock);
  }
};
