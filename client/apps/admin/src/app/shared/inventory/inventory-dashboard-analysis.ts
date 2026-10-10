import type { StockRow } from '@/services/warehouseStock.service';
import type { InventoryMovement } from '@/services/inventory.service';
export interface InventoryFilters {
  products: string[];
  warehouse: string;
  health: string;
  from: string;
  to: string;
  reference: string;
}
export const emptyInventoryFilters = (): InventoryFilters => ({
  products: [],
  warehouse: '',
  health: '',
  from: '',
  to: '',
  reference: '',
});
export const finite = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;
export const refId = (value: unknown): string =>
  value && typeof value === 'object'
    ? String((value as { _id?: unknown })._id || '')
    : String(value || '');
export const confirmed = (m: InventoryMovement) => m.status === 'confirmed';
export const isTransferReturn = (m: InventoryMovement) =>
  Boolean(
    (m.sourceWarehouse && m.destinationWarehouse && /^return of /i.test(m.reference || '')) ||
      (m.referenceType === 'transfer' && ['return', 'return_out'].includes(m.type)),
  );
export function stockHealth(row: StockRow) {
  if (finite(row.currentQuantity) <= 0 || row.flags?.outOfStock) return 'out';
  if (
    row.flags?.lowStock ||
    (!row.flags && finite(row.currentQuantity) <= finite(row.minStockLevel))
  )
    return 'low';
  if (row.flags?.nearExpiry) return 'expiry';
  if (row.flags?.overstocked) return 'over';
  return 'ok';
}
export function filterStock(rows: StockRow[], filters: InventoryFilters) {
  return rows.filter(
    (r) =>
      (!filters.products.length || filters.products.includes(r.subProductId)) &&
      (!filters.warehouse || filters.warehouse === r.warehouseId) &&
      (!filters.health || stockHealth(r) === filters.health),
  );
}
export function filterHistory(
  moves: InventoryMovement[],
  filters: InventoryFilters,
  rows: StockRow[] = [],
) {
  const healthProducts = new Set(
    rows
      .filter((r) => !filters.health || stockHealth(r) === filters.health)
      .map((r) => `${r.warehouseId}:${r.subProductId}:${r.sizeId || ''}`),
  );
  return moves.filter((m) => {
    const product = refId(m.subProduct);
    // A transfer has two audit legs: filter its actual stock warehouse, never
    // include both legs merely because a selected location is an endpoint.
    const warehouse =
      refId(m.warehouse) ||
      refId(m.type === 'transfer_out' ? m.sourceWarehouse : m.destinationWarehouse);
    const date = Date.parse(m.createdAt);
    return (
      (!filters.products.length || filters.products.includes(product)) &&
      (!filters.warehouse || filters.warehouse === warehouse) &&
      (!filters.health || healthProducts.has(`${warehouse}:${product}:${refId(m.size)}`)) &&
      (!filters.from || date >= Date.parse(`${filters.from}T00:00:00Z`)) &&
      (!filters.to || date < Date.parse(`${filters.to}T00:00:00Z`) + 86400000) &&
      (!filters.reference ||
        (m.reference || '').toLowerCase().includes(filters.reference.toLowerCase().trim()))
    );
  });
}
export function stockTotals(rows: StockRow[]) {
  const result = { units: 0, cost: 0, retail: 0, profit: 0, low: 0, out: 0, lines: rows.length };
  for (const row of rows) {
    const quantity = finite(row.currentQuantity);
    result.units += quantity;
    result.cost += quantity * finite(row.costPrice);
    result.retail += quantity * finite(row.sellingPrice);
    if (stockHealth(row) === 'low') result.low++;
    if (stockHealth(row) === 'out') result.out++;
  }
  result.profit = result.retail - result.cost;
  return result;
}
export function movementTotals(moves: InventoryMovement[]) {
  const totals = {
    received: 0,
    issued: 0,
    returnedIn: 0,
    returnedOut: 0,
    transferIn: 0,
    transferOut: 0,
    transferReturnedIn: 0,
    transferReturnedOut: 0,
    netTransferIn: 0,
    netTransferOut: 0,
  };
  for (const m of moves.filter(confirmed)) {
    const qty = Math.abs(finite(m.quantity));
    if (isTransferReturn(m)) {
      if (m.type === 'transfer_out') totals.transferReturnedOut += qty;
      else if (m.type === 'return' && m.category === 'in') totals.transferReturnedIn += qty;
    } else if (m.type === 'transfer_in') totals.transferIn += qty;
    else if (m.type === 'transfer_out') totals.transferOut += qty;
    else if (m.type === 'return') {
      if (m.category === 'in') totals.returnedIn += qty;
      else if (m.category === 'out') totals.returnedOut += qty;
    } else if (m.category === 'in') totals.received += qty;
    else if (
      m.category === 'out' &&
      !['damaged', 'expired', 'theft', 'written_off'].includes(m.type)
    )
      totals.issued += qty;
  }
  // Returned into the original source reverses transfer out; returned out of
  // the destination reverses transfer in. Never add reversals to gross totals.
  totals.netTransferIn = totals.transferIn - totals.transferReturnedOut;
  totals.netTransferOut = totals.transferOut - totals.transferReturnedIn;
  return totals;
}
export function buildHistoryFlow(moves: InventoryMovement[]) {
  const days = new Map<string, { day: string; in: number; out: number; net: number }>();
  for (const m of moves.filter(confirmed)) {
    if (isTransferReturn(m) || m.category === 'transfer' || !['in', 'out'].includes(m.category))
      continue;
    const date = new Date(m.createdAt);
    if (!Number.isFinite(date.getTime())) continue;
    const day = date.toISOString().slice(0, 10);
    const point = days.get(day) || { day, in: 0, out: 0, net: 0 };
    if (m.category === 'in') point.in += Math.abs(finite(m.quantity));
    else point.out += Math.abs(finite(m.quantity));
    point.net = point.in - point.out;
    days.set(day, point);
  }
  return Array.from(days.values()).sort((a, b) => a.day.localeCompare(b.day));
}
