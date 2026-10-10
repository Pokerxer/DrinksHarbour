import type { InventoryMovement } from '@/services/inventory.service';
import { refId } from './inventory-dashboard-analysis';
import { movementDelta } from './inventory-stock-history';
import { movementCost } from './inventory-movement-view';
export { movementSourceLabel } from './inventory-movement-source';
/** Issued stock is not evidence of completed customer delivery. */
export function deliveryStats(moves: InventoryMovement[]) {
  let issued = 0,
    sold = 0,
    shipped = 0,
    pending = 0,
    pendingLines = 0,
    postedLines = 0,
    excluded = 0,
    cost = 0,
    unpriced = 0;
  const orders = new Set<string>();
  for (const move of moves) {
    if (!['sold', 'shipped'].includes(move.type)) continue;
    const order = refId(move.relatedOrder);
    if (order) orders.add(order);
    const delta = movementDelta(move) ?? 0;
    if (delta < 0) {
      const quantity = -delta;
      issued += quantity;
      postedLines++;
      if (move.type === 'sold') sold += quantity;
      else shipped += quantity;
      const value = movementCost(move);
      if (value === null) unpriced++;
      else cost += value;
    }
    if (move.status === 'pending') {
      pendingLines++;
      pending += Number.isFinite(move.quantity) ? Math.abs(move.quantity) : 0;
    }
    if (['cancelled', 'rejected'].includes(move.status)) excluded++;
  }
  return {
    issued,
    sold,
    shipped,
    pending,
    pendingLines,
    postedLines,
    excluded,
    cost,
    unpriced,
    orders: orders.size,
  };
}
