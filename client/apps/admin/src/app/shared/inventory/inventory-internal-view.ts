import type { InventoryMovement } from '@/services/inventory.service';
import { isTransferReturn, refId } from './inventory-dashboard-analysis';
import { movementDelta } from './inventory-stock-history';
import { movementCost } from './inventory-movement-view';
export const internalMovement = (m: InventoryMovement) =>
  m.category === 'transfer' || isTransferReturn(m);
export const internalDirection = (m: InventoryMovement) => (m.type.endsWith('_out') ? 'out' : 'in');
export function internalStats(moves: InventoryMovement[]) {
  let transferIn = 0,
    transferOut = 0,
    returnIn = 0,
    returnOut = 0,
    pending = 0,
    pendingLines = 0,
    cost = 0,
    unpriced = 0;
  for (const m of moves) {
    if (!internalMovement(m)) continue;
    const delta = movementDelta(m) ?? 0;
    if (delta !== 0) {
      if (isTransferReturn(m)) {
        if (delta > 0) returnIn += delta;
        else returnOut -= delta;
      } else {
        if (delta > 0) transferIn += delta;
        else transferOut -= delta;
      }
      const value = movementCost(m);
      if (value === null) unpriced++;
      else cost += value;
    }
    if (m.status === 'pending') {
      pendingLines++;
      pending += Number.isFinite(m.quantity) ? Math.abs(m.quantity) : 0;
    }
  }
  return {
    transferIn,
    transferOut,
    returnIn,
    returnOut,
    net: transferIn + returnIn - transferOut - returnOut,
    pending,
    pendingLines,
    cost,
    unpriced,
  };
}
export function matchesInternalRoute(m: InventoryMovement, from: string, to: string) {
  return (
    (!from || refId(m.sourceWarehouse) === from) && (!to || refId(m.destinationWarehouse) === to)
  );
}
