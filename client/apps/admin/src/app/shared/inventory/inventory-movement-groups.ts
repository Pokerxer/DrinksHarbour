import type { InventoryMovement } from '@/services/inventory.service';
import {
  byLabel,
  fmtDate,
  productLabel,
  referenceLabel,
  whCell,
  warehouseLabel,
  weekLabel,
  quarterLabel,
  type GroupKey,
  type SortCol,
  type SortDir,
} from './inventory-receipts-support';
import { movementCost } from './inventory-movement-view';
import { movementSourceLabel } from './inventory-movement-source';
import { movementDelta, movementLabel } from './inventory-stock-history';
import { receiptLabel } from './inventory-receipt-view';
import { refId } from './inventory-dashboard-analysis';
const moveDate = (move: InventoryMovement) => move.createdAt;
export function sortMovements(
  list: InventoryMovement[],
  sortCol: SortCol,
  sortDir: SortDir,
  receipt = false,
) {
  const text = (value: string | undefined) => (value && value !== '—' ? value : null);
  const value = (move: InventoryMovement): string | number | null => {
    switch (sortCol) {
      case 'date': {
        const time = new Date(moveDate(move)).getTime();
        return Number.isFinite(time) ? time : null;
      }
      case 'product':
        return text(productLabel(move));
      case 'type':
        return text(receipt ? receiptLabel(move) : movementLabel(move));
      case 'warehouse':
        return text(refId(move.warehouse) ? warehouseLabel(move.warehouse) : whCell(move));
      case 'reference':
        return text(referenceLabel(move));
      case 'qty':
        return movementDelta(move);
      case 'cost':
        return movementCost(move);
      case 'source':
        return move.source ? movementSourceLabel(move.source) : null;
      case 'supplier':
        return text(move.supplierName);
      case 'reason':
        return text(move.reason?.trim());
      case 'by':
        return text(byLabel(move));
    }
  };
  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  list.sort((a, b) => {
    const av = value(a),
      bv = value(b);
    // Missing values stay last for either direction; zero is a known value.
    if (av === null && bv !== null) return 1;
    if (bv === null && av !== null) return -1;
    const cmp =
      av === null || bv === null
        ? 0
        : typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : collator.compare(String(av), String(bv));
    return (sortDir === 'asc' ? cmp : -cmp) || a._id.localeCompare(b._id);
  });
  return list;
}
export function groupMovements(filtered: InventoryMovement[], groupBy: GroupKey, receipt = false) {
  const map = new Map<string, InventoryMovement[]>();
  filtered.forEach((m) => {
    const d = new Date(moveDate(m));
    let key: string;
    switch (groupBy) {
      case 'warehouse':
        key = refId(m.warehouse) || whCell(m);
        break;
      case 'type':
        key = receipt ? receiptLabel(m) : movementLabel(m);
        break;
      case 'product':
        key = `${productLabel(m)} · ${refId(m.subProduct) || 'No product ID'}`;
        break;
      case 'supplier':
        key = m.supplierName || 'No supplier';
        break;
      case 'source':
        key = movementSourceLabel(m.source || '');
        break;
      case 'reason':
        key = m.reason?.trim() || m.notes?.trim() || 'No reason recorded';
        break;
      case 'day':
        key = fmtDate(moveDate(m));
        break;
      case 'week':
        key = weekLabel(d);
        break;
      case 'month':
        key = d.toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
        });
        break;
      case 'quarter':
        key = quarterLabel(d);
        break;
      case 'year':
        key = String(d.getFullYear());
        break;
      default:
        key = '\u2014';
    }
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  });
  return Array.from(map.entries());
}

export const MOVEMENT_HEADERS: { col: SortCol; label: string; right?: boolean }[] = [
  { col: 'date', label: 'Recorded date' },
  { col: 'product', label: 'Product' },
  { col: 'type', label: 'Type' },
  { col: 'warehouse', label: 'Warehouse' },
  { col: 'reference', label: 'Reference' },
  { col: 'qty', label: 'Posted change', right: true },
  { col: 'cost', label: 'Cost', right: true },
  { col: 'by', label: 'By' },
];

export function movementGroupLabel(
  groupBy: GroupKey | null,
  key: string,
  moves: InventoryMovement[],
) {
  const move = moves[0];
  if (!move) return key;
  if (groupBy === 'warehouse')
    return refId(move.warehouse) ? warehouseLabel(move.warehouse) : whCell(move);
  if (groupBy === 'product') {
    const sku = typeof move.subProduct === 'object' ? move.subProduct?.sku : '';
    return [productLabel(move), sku].filter(Boolean).join(' · ');
  }
  return key;
}
