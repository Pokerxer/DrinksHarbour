import type { KitchenOrder, KitchenRound } from '../types';

/**
 * One kitchen card = one fired round still on the board, plus the order it
 * belongs to (table name / guests live at order level).
 */
export interface BoardCard {
  order: KitchenOrder;
  round: KitchenRound;
}

export interface KitchenColumns {
  pending: BoardCard[];
  preparing: BoardCard[];
  ready: BoardCard[];
}

function isColumnStatus(status: unknown): status is keyof KitchenColumns {
  return (
    status === 'pending' || status === 'preparing' || status === 'ready'
  );
}

/**
 * Flatten held orders × active rounds into the three KDS columns. Server
 * already strips served rounds and sorts oldest-fired first; this stays
 * defensive (served dropped, unknown statuses ignored) without re-sorting,
 * so the server's oldest-first ordering survives into every column.
 */
export function groupRoundsByColumn(orders?: KitchenOrder[]): KitchenColumns {
  const columns: KitchenColumns = { pending: [], preparing: [], ready: [] };
  for (const order of orders ?? []) {
    for (const round of order?.rounds ?? []) {
      if (!isColumnStatus(round?.status)) continue;
      columns[round.status].push({ order, round });
    }
  }
  return columns;
}

/**
 * "4m" under an hour; "1h 03m" once hours show (minutes padded). Future
 * timestamps clamp to "0m"; unusable ones render as nothing rather than NaN.
 * Mirrors tabElapsedLabel's conventions so both boards read the same.
 */
export function roundElapsedLabel(firedAt: string, nowMs: number): string {
  const firedMs = new Date(firedAt).getTime();
  if (!Number.isFinite(firedMs)) return '';
  const elapsedMins = Math.floor(Math.max(0, nowMs - firedMs) / 60_000);
  if (elapsedMins < 60) return `${elapsedMins}m`;
  const hours = Math.floor(elapsedMins / 60);
  const mins = String(elapsedMins % 60).padStart(2, '0');
  return `${hours}h ${mins}m`;
}

/**
 * A round is late once the full alert window has elapsed since it was fired —
 * boundary inclusive, so a 10-minute alert turns red at exactly 10 minutes.
 */
export function isRoundLate(
  firedAt: string,
  alertMins: number,
  nowMs: number
): boolean {
  const firedMs = new Date(firedAt).getTime();
  if (!Number.isFinite(firedMs)) return false;
  const window = Math.max(1, alertMins || 0) * 60_000;
  return nowMs - firedMs >= window;
}
