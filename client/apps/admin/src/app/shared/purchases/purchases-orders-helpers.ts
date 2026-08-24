// app/shared/purchases/purchases-orders-helpers.ts
//
// Pure search/filter/summary logic for the purchase orders list page. Kept
// out of the component so the matching rules are unit-testable and the page
// stays layout-only.

import type { PurchaseOrder } from './types';

/** Warehouse label for a possibly-populated ref, or '' when unset. */
function warehouseLabel(
  warehouse: PurchaseOrder['warehouse']
): string {
  if (!warehouse || typeof warehouse === 'string') return '';
  const code = warehouse.code ? ` (${warehouse.code})` : '';
  return `${warehouse.name ?? ''}${code}`.trim();
}

/**
 * Free-text match across PO number, vendor, destination warehouse and line
 * product names. Empty query always matches.
 */
export function matchesSearch(o: PurchaseOrder, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const haystacks: string[] = [
    o.poNumber ?? '',
    o.vendorName ?? '',
    warehouseLabel(o.warehouse),
    ...(o.items ?? []).map(
      (i) =>
        (i as { subProductName?: string }).subProductName ??
        i.productName ??
        ''
    ),
  ];
  return haystacks.some((h) => h.toLowerCase().includes(q));
}

/** Sorted unique vendor names for the filter dropdown; blanks dropped. */
export function distinctVendors(orders: PurchaseOrder[]): string[] {
  const set = new Set<string>();
  for (const o of orders) {
    const v = o.vendorName?.trim();
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export interface WarehouseOption {
  id: string;
  label: string;
}

/** Warehouse filter options (populated refs only) sorted by label. */
export function distinctWarehouses(
  orders: PurchaseOrder[]
): WarehouseOption[] {
  const map = new Map<string, string>();
  for (const o of orders) {
    const id =
      typeof o.warehouse === 'object' && o.warehouse ? o.warehouse._id : null;
    const label = warehouseLabel(o.warehouse);
    if (id && label) map.set(id, label);
  }
  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export type DatePreset = 'all' | '7d' | '30d' | '90d' | 'year';

export const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'year', label: 'This year' },
];

const PRESET_DAYS: Record<Exclude<DatePreset, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  year: 365,
};

/** Created-within-preset test. Orders without a date only pass 'all'. */
export function withinDatePreset(
  o: PurchaseOrder,
  preset: DatePreset
): boolean {
  if (preset === 'all') return true;
  if (!o.createdAt) return false;
  const ageDays =
    (Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return ageDays >= 0 && ageDays <= PRESET_DAYS[preset];
}

/** "2 items · 30 units" line summary for cards and rows. */
export function orderItemsSummary(o: PurchaseOrder): string {
  const lines = (o.items ?? []).length;
  const units = (o.items ?? []).reduce((s, i) => s + (i.quantity || 0), 0);
  const line = `${lines} item${lines === 1 ? '' : 's'}`;
  const unit = `${units.toLocaleString('en-NG')} unit${units === 1 ? '' : 's'}`;
  return `${line} · ${unit}`;
}
