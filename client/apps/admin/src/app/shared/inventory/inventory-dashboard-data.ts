import { finite, stockHealth, confirmed, isTransferReturn } from './inventory-dashboard-analysis';
import type { InventoryMovement } from '@/services/inventory.service';
import type { StockRow } from '@/services/warehouseStock.service';
import {
  CHART_COLORS,
  PIE_PALETTE,
  type FlowPoint,
  type SlicePoint,
  type TopProductPoint,
} from './inventory-dashboard-charts';

export const SCRAP_TYPES = ['damaged', 'expired', 'theft', 'written_off'];
export const FLOW_DAYS = 14;

/**
 * Movement counts matching each Operations page's own filter semantics:
 * receipts = category 'in'; deliveries = category 'out' minus scrap;
 * internalLegs = each confirmed transfer leg, including return legs;
 * transfers = distinct original outgoing transfer references, so multi-line
 * warehouse transfers count as one operation rather than one per product;
 * adjustments = category 'adjustment'; scrap = loss types.
 */
export interface OperationCounts {
  receipts: number;
  deliveries: number;
  internalLegs: number;
  transfers: number;
  adjustments: number;
  scrap: number;
}

/** Local-calendar YYYY-MM-DD key — UTC slicing mis-buckets moves near midnight. */
function localDayKey(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function computeCounts(movements: InventoryMovement[]): OperationCounts {
  const c: OperationCounts = {
    receipts: 0,
    deliveries: 0,
    internalLegs: 0,
    transfers: 0,
    adjustments: 0,
    scrap: 0,
  };
  const transfers = new Set<string>();
  for (const m of movements.filter(confirmed)) {
    if (m.category === 'transfer' || isTransferReturn(m)) {
      c.internalLegs++;
      if (m.type === 'transfer_out' && !isTransferReturn(m)) transfers.add(m.reference || m._id);
    } else if (SCRAP_TYPES.includes(m.type)) c.scrap++;
    else if (m.category === 'in') c.receipts++;
    else if (m.category === 'out') c.deliveries++;
    else if (m.category === 'adjustment') c.adjustments++;
  }
  c.transfers = transfers.size;
  return c;
}

export function buildFlowData(movements: InventoryMovement[]): FlowPoint[] {
  const days: FlowPoint[] = [];
  const index = new Map<string, FlowPoint>();
  for (let i = FLOW_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(12, 0, 0, 0);
    const point = {
      day: d.toLocaleDateString('en-NG', { day: '2-digit', month: 'short' }),
      in: 0,
      out: 0,
      net: 0,
    };
    days.push(point);
    index.set(localDayKey(d.toISOString()), point);
  }
  for (const m of movements) {
    // Scrap is recorded as an out-category movement but is a write-off, not a
    // delivery — excluding it keeps "units issued" aligned with Deliveries.
    if (SCRAP_TYPES.includes(m.type)) continue;
    const point = index.get(localDayKey(m.performedAt ?? m.createdAt));
    if (!point) continue;
    const qty = Math.abs(m.quantity);
    if (m.category === 'in') point.in += qty;
    else if (m.category === 'out') point.out += qty;
  }
  for (const p of days) p.net = p.in - p.out;
  return days;
}

export function buildHealthSlices(stockRows: StockRow[]): SlicePoint[] {
  const c = { ok: 0, low: 0, out: 0, expiry: 0, over: 0 };
  for (const r of stockRows) {
    c[stockHealth(r)] += 1;
  }
  return [
    { name: 'Healthy', value: c.ok, color: CHART_COLORS.in },
    { name: 'Low stock', value: c.low, color: CHART_COLORS.amber },
    { name: 'Out of stock', value: c.out, color: CHART_COLORS.out },
    { name: 'Near expiry', value: c.expiry, color: CHART_COLORS.terracotta },
    { name: 'Overstocked', value: c.over, color: CHART_COLORS.slate },
  ];
}

export function buildWarehouseSlices(stockRows: StockRow[]): SlicePoint[] {
  const map = new Map<string, { name: string; value: number }>();
  for (const row of stockRows) {
    const key = row.warehouseId || row.warehouseName;
    const group = map.get(key) || { name: row.warehouseName || 'Unassigned', value: 0 };
    group.value += finite(row.currentQuantity) * finite(row.costPrice);
    map.set(key, group);
  }
  return Array.from(map.values(), (row, i) => ({
    ...row,
    color: PIE_PALETTE[i % PIE_PALETTE.length],
  })).sort((a, b) => b.value - a.value);
}

export function buildTopProducts(stockRows: StockRow[]): TopProductPoint[] {
  const map = new Map<string, TopProductPoint>();
  for (const row of stockRows) {
    const key = row.subProductId || row.productName;
    const product = map.get(key) || { id: key, name: row.productName, value: 0 };
    product.value += finite(row.currentQuantity) * finite(row.costPrice);
    map.set(key, product);
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

export function sumUnits(stockRows: StockRow[]): number {
  return stockRows.reduce((s, r) => s + finite(r.currentQuantity), 0);
}

export function countOutOfStock(stockRows: StockRow[]): number {
  return stockRows.reduce((n, r) => n + (stockHealth(r) === 'out' ? 1 : 0), 0);
}
