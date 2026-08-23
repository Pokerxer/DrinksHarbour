// app/shared/purchases/transfer-receive-panel-helpers.ts
//
// Pure side-gating logic for the two-party transfer workflow: who may
// dispatch, who may receive, who may close with shortages. The server enforces
// the same rules on every endpoint (see stockTransfer.controller.js
// assertWarehouseSide) — these helpers only decide which actions the UI offers.
//
// Managers arrive either as raw user ids or populated {_id, name} objects
// depending on the payload; both normalise to ids here.

import type { StockTransfer, TransferItem } from '@/services/stockTransfer.service';

const IN_FLIGHT = ['in_transit', 'partially_received'];

/** Units still expected for a line, clamped at zero. */
export function outstandingOf(it: Pick<TransferItem, 'quantity' | 'receivedQty'>): number {
  return Math.max(0, (it.quantity ?? 0) - (it.receivedQty ?? 0));
}

export function isManagerOf(wh: unknown, userId: string): boolean {
  const managers = ((wh as { managers?: unknown[] } | null)?.managers ?? []) as unknown[];
  const ids = managers.map((m) =>
    m && typeof m === 'object' ? String((m as { _id?: unknown })._id ?? m) : String(m)
  );
  return ids.includes(String(userId));
}

/** Which side of the transfer this user manages; null ⇒ tenant-admin override applies upstream. */
export function sideOf(
  t: StockTransfer,
  userId: string
): 'source' | 'destination' | null {
  if (isManagerOf(t.destinationWarehouse, userId)) return 'destination';
  if (isManagerOf(t.sourceWarehouse, userId)) return 'source';
  return null;
}

type Gate = (t: StockTransfer, userId: string, isAdminRole: boolean) => boolean;

export const canReceiveTransfer: Gate = (t, u, admin) =>
  IN_FLIGHT.includes(t.status) &&
  (admin || isManagerOf(t.destinationWarehouse, u));

export const canSendTransfer: Gate = (t, u, admin) =>
  t.status === 'confirmed' && (admin || isManagerOf(t.sourceWarehouse, u));

export const canCloseOperation: Gate = (t, u, admin) =>
  IN_FLIGHT.includes(t.status) &&
  (t.receipts?.some((r) => !r.shortagesClosed) ?? false) &&
  (admin ||
    isManagerOf(t.sourceWarehouse, u) ||
    isManagerOf(t.destinationWarehouse, u));
