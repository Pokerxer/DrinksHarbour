import type { InventoryMovement } from '@/services/inventory.service';
import { refId } from './inventory-dashboard-analysis';
import { movementDelta } from './inventory-stock-history';
import { movementCost } from './inventory-movement-view';
export type ReceiptKind = 'received' | 'purchase' | 'return' | 'opening' | 'other';
/** Classify stock entries, not invoices. Purchase writers use type=received. */
export function receiptKind(move: InventoryMovement): ReceiptKind {
  if (move.type === 'return') return 'return';
  if (['received', 'purchase'].includes(move.type)) {
    if (
      /^bulk[-_ ]import$/i.test(move.reference?.trim() || '') ||
      /^bulk import (opening stock|stock update)/i.test(move.notes?.trim() || '')
    )
      return 'opening';
    if (
      move.type === 'purchase' ||
      refId(move.relatedPurchaseOrder) ||
      move.referenceType === 'purchase_order'
    )
      return 'purchase';
    return 'received';
  }
  return 'other';
}
export function receiptStats(moves: InventoryMovement[]) {
  let received = 0,
    pending = 0,
    pendingLines = 0,
    confirmedLines = 0,
    excluded = 0,
    cost = 0,
    unpriced = 0;
  for (const move of moves) {
    const delta = movementDelta(move) ?? 0;
    if (delta > 0) {
      received += delta;
      confirmedLines++;
      const value = movementCost(move);
      if (value === null) unpriced++;
      else cost += value;
    }
    if (move.status === 'pending' && !['reserved', 'released'].includes(move.type)) {
      pendingLines++;
      pending += Number.isFinite(move.quantity) ? Math.abs(move.quantity) : 0;
    }
    if (['cancelled', 'rejected'].includes(move.status)) excluded++;
  }
  return { received, pending, pendingLines, confirmedLines, excluded, cost, unpriced };
}

export function receiptLabel(move: InventoryMovement) {
  return {
    purchase: 'Purchase receipt',
    received: 'Manual receipt',
    return: 'Return receipt',
    opening: 'Imported stock',
    other: 'Other incoming stock',
  }[receiptKind(move)];
}
