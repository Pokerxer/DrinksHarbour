// client/apps/isomorphic/src/app/shared/sales/sales-helpers.ts
import type {
  SalesLineItem,
  QuoteStatus,
  OrderStatus,
  SalesOrderAddress,
} from '@/services/salesOrder.service';

const ADDRESS_KEYS: (keyof SalesOrderAddress)[] = [
  'name',
  'phone',
  'street',
  'city',
  'state',
  'country',
];

const addrVal = (a: SalesOrderAddress | undefined, k: keyof SalesOrderAddress) =>
  (a?.[k] ?? '').toString().trim();

/** True when the address carries no displayable content. */
export function addressIsEmpty(a?: SalesOrderAddress): boolean {
  return ADDRESS_KEYS.every((k) => !addrVal(a, k));
}

/** True when two addresses differ on any of the six fields. */
export function addressesDiffer(
  a?: SalesOrderAddress,
  b?: SalesOrderAddress
): boolean {
  return ADDRESS_KEYS.some((k) => addrVal(a, k) !== addrVal(b, k));
}

/** Non-empty location lines (street + "City, State, Country"), for compact display. */
export function addressLines(a?: SalesOrderAddress): string[] {
  const street = addrVal(a, 'street');
  const locality = [addrVal(a, 'city'), addrVal(a, 'state'), addrVal(a, 'country')]
    .filter(Boolean)
    .join(', ');
  return [street, locality].filter(Boolean);
}

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

/** Odoo-style payment-term presets — keys mirror the server enum on SalesOrder. */
export const PAYMENT_TERMS: { key: string; label: string }[] = [
  { key: 'immediate', label: 'Immediate Payment' },
  { key: 'net_7', label: '7 Days' },
  { key: 'net_15', label: '15 Days' },
  { key: 'net_30', label: '30 Days' },
  { key: 'net_45', label: '45 Days' },
  { key: 'net_60', label: '60 Days' },
  { key: 'end_of_month', label: 'End of this Month' },
];

export function paymentTermsLabel(key?: string): string {
  return PAYMENT_TERMS.find((t) => t.key === key)?.label ?? 'Immediate Payment';
}
