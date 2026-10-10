import type { InventoryMovement } from '@/services/inventory.service';
import { refId } from './inventory-dashboard-analysis';
import {
  byLabel,
  productLabel,
  referenceLabel,
  sizeLabel,
  warehouseLabel,
} from './inventory-receipts-support';
import { movementDelta, movementLabel, transferRoute } from './inventory-stock-history';
import { receiptLabel } from './inventory-receipt-view';
import { movementSourceLabel } from './inventory-movement-source';
function calendarTime(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
  const value = new Date(`${date}T${time}`);
  const [year, month, day] = date.split('-').map(Number);
  return value.getFullYear() === year && value.getMonth() + 1 === month && value.getDate() === day
    ? value.getTime()
    : NaN;
}
export function movementBounds(from: string, to: string, startTime: string, endTime: string) {
  const start = from ? calendarTime(from, startTime) : undefined;
  const end = to ? calendarTime(to, endTime) + 59999 : undefined;
  const invalid =
    (start !== undefined && !Number.isFinite(start)) ||
    (end !== undefined && !Number.isFinite(end)) ||
    (start !== undefined && end !== undefined && start > end);
  return {
    start,
    end,
    error: invalid ? 'Choose a valid date range with the start before the end.' : '',
  };
}
export function movementCost(move: InventoryMovement): number | null {
  const known = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  return known(move.totalCost)
    ? move.totalCost
    : known(move.unitCost) && known(move.quantity)
      ? move.unitCost * Math.abs(move.quantity)
      : null;
}
export function movementWarehouses(moves: InventoryMovement[]) {
  const options = new Map<string, string>();
  for (const move of moves)
    for (const warehouse of [move.warehouse, move.sourceWarehouse, move.destinationWarehouse]) {
      const id = refId(warehouse);
      if (id) options.set(id, warehouseLabel(warehouse));
    }
  return Array.from(options)
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
export function movementProducts(moves: InventoryMovement[]) {
  const options = new Map<string, string>();
  for (const move of moves) {
    const id = refId(move.subProduct);
    const sku = typeof move.subProduct === 'object' ? move.subProduct?.sku : '';
    if (id) options.set(id, [productLabel(move), sku].filter(Boolean).join(' · '));
  }
  return Array.from(options)
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
const normal = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function matchesMovement(
  move: InventoryMovement,
  filters: {
    search?: string;
    products?: string;
    warehouse?: string;
    start?: number;
    end?: number;
    receipt?: boolean;
  },
) {
  const products = (filters.products || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (products.length && !products.includes(refId(move.subProduct))) return false;
  if (filters.warehouse) {
    const leg = refId(move.warehouse);
    if (
      leg
        ? leg !== filters.warehouse
        : ![refId(move.sourceWarehouse), refId(move.destinationWarehouse)].includes(
            filters.warehouse,
          )
    )
      return false;
  }
  const time = new Date(move.createdAt).getTime();
  if (filters.start !== undefined && !(time >= filters.start)) return false;
  if (filters.end !== undefined && !(time <= filters.end)) return false;
  const terms = normal(filters.search || '')
    .split(/[,;\n]+/)
    .map((t) => t.trim().split(/\s+/).filter(Boolean))
    .filter((t) => t.length);
  const sku = typeof move.subProduct === 'object' ? move.subProduct?.sku : '';
  const text = normal(
    [
      productLabel(move),
      sku,
      sizeLabel(move),
      referenceLabel(move),
      move.reference,
      typeof move.relatedOrder === 'object' ? move.relatedOrder?.orderNumber : '',
      typeof move.relatedOrder === 'object' ? move.relatedOrder?.receiptNumber : '',
      move.source,
      move.source ? movementSourceLabel(move.source) : '',
      move.batchNumber,
      move.lotNumber,
      move.supplierName,
      move.reason,
      move.notes,
      warehouseLabel(move.warehouse),
      transferRoute(move),
      movementLabel(move),
      filters.receipt ? receiptLabel(move) : '',
      move.status,
      byLabel(move),
      move.createdAt,
    ]
      .filter(Boolean)
      .join(' '),
  );
  return !terms.length || terms.some((words) => words.every((word) => text.includes(word)));
}
export function movementStats(moves: InventoryMovement[]) {
  let units = 0,
    incoming = 0,
    outgoing = 0,
    net = 0,
    cost = 0,
    unpriced = 0;
  for (const move of moves) {
    const delta = movementDelta(move) ?? 0;
    units += Math.abs(delta);
    net += delta;
    if (delta > 0) incoming += delta;
    if (delta < 0) outgoing -= delta;
    if (delta !== 0) {
      const amount = movementCost(move);
      if (amount === null) unpriced++;
      else cost += amount;
    }
  }
  return {
    count: moves.length,
    units,
    incoming,
    outgoing,
    net,
    cost,
    unpriced,
    warehouses: movementWarehouses(moves).length,
    products: new Set(moves.map((m) => refId(m.subProduct)).filter(Boolean)).size,
    suppliers: new Set(moves.map((m) => m.supplierName).filter(Boolean)).size,
    pos: new Set(moves.map((m) => refId(m.relatedPurchaseOrder)).filter(Boolean)).size,
  };
}
export function toggleMovementPage(
  selected: Set<string>,
  rows: InventoryMovement[],
  remove: boolean,
) {
  const next = new Set(selected);
  rows.forEach((row) => (remove ? next.delete(row._id) : next.add(row._id)));
  return next;
}
