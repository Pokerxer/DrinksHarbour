import type { InventoryMovement } from '@/services/inventory.service';
import { movementCost } from './inventory-movement-view';
import { movementDelta } from './inventory-stock-history';
export function isAdjustment(move: InventoryMovement) {
  return ['adjustment_in', 'adjustment_out'].includes(move.type) || move.category === 'adjustment';
}
export function adjustmentDirection(move: InventoryMovement) {
  if (!isAdjustment(move)) return 'unknown';
  if (move.status === 'confirmed') {
    const delta = movementDelta(move);
    return delta === null ? 'unknown' : delta > 0 ? 'in' : delta < 0 ? 'out' : 'unchanged';
  }
  return move.type === 'adjustment_in' ? 'in' : move.type === 'adjustment_out' ? 'out' : 'unknown';
}
export function adjustmentStats(moves: InventoryMovement[]) {
  let increase = 0,
    decrease = 0,
    pending = 0,
    pendingLines = 0,
    excluded = 0,
    unchanged = 0,
    unknown = 0,
    cost = 0,
    unpriced = 0;
  for (const move of moves) {
    if (!isAdjustment(move)) continue;
    if (move.status === 'pending') {
      pendingLines++;
      pending += Number.isFinite(move.quantity) ? Math.abs(move.quantity) : 0;
      continue;
    }
    if (move.status !== 'confirmed') {
      excluded++;
      continue;
    }
    const delta = movementDelta(move);
    if (delta === null) {
      unknown++;
      continue;
    }
    if (delta === 0) {
      unchanged++;
      continue;
    }
    if (delta > 0) increase += delta;
    else decrease -= delta;
    const value = movementCost(move);
    if (value === null) unpriced++;
    else cost += value;
  }
  return {
    increase,
    decrease,
    net: increase - decrease,
    pending,
    pendingLines,
    excluded,
    unchanged,
    unknown,
    cost,
    unpriced,
  };
}
