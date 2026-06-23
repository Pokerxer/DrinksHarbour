// client/apps/isomorphic/src/app/shared/sales/sales-helpers.ts
import type {
  SalesLineItem,
  QuoteStatus,
  OrderStatus,
} from '@/services/salesOrder.service';

/** Units still owed on a line: ordered minus shipped minus returned, floored at 0. Mirrors server/services/salesFulfill.helpers.js:outstanding. */
export function outstanding(line: SalesLineItem): number {
  return Math.max(
    0,
    (line.quantity || 0) - (line.fulfilledQty || 0) - (line.returnedQty || 0)
  );
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  converted: 'Converted',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  partially_fulfilled: 'Partially Fulfilled',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

export function quoteStatusLabel(status?: string): string {
  return (
    (status && QUOTE_STATUS_LABELS[status as QuoteStatus]) || status || '—'
  );
}

export function orderStatusLabel(status?: string): string {
  return (
    (status && ORDER_STATUS_LABELS[status as OrderStatus]) || status || '—'
  );
}

export const QUOTE_STATUS_BADGE: Record<QuoteStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
  converted: 'bg-violet-100 text-violet-700',
};

export const ORDER_STATUS_BADGE: Record<OrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  confirmed: 'bg-blue-100 text-blue-700',
  partially_fulfilled: 'bg-amber-100 text-amber-700',
  fulfilled: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};
