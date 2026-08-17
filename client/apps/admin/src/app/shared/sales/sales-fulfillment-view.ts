// What a fulfilment row says.
//
// One module so the Delivery Orders panel and the Sale Details panel cannot
// disagree about the same fulfilment. Vitest runs `environment: 'node'` here —
// there is no jsdom, so nothing renderable may live in this file, and this is
// where the logic goes that the components would otherwise hide.

import type {
  SalesOrderFulfillment,
  PopulatedWarehouse,
  PopulatedUser,
} from '@/services/salesOrder.service';

/**
 * A Mongoose ref arrives as an id string or as the populated document. An id on
 * screen is worse than nothing — it is noise a user cannot act on — so an
 * unpopulated ref reads as absent and the caller omits the field.
 */
export function warehouseName(
  ref?: string | PopulatedWarehouse | null
): string | null {
  if (!ref || typeof ref === 'string') return null;
  return ref.name || null;
}

export function personName(ref?: string | PopulatedUser | null): string | null {
  if (!ref || typeof ref === 'string') return null;
  const full = [ref.firstName, ref.lastName].filter(Boolean).join(' ').trim();
  return full || null;
}

/**
 * The receipt number of the POS sale that produced this fulfilment — a real
 * reference someone can look up. `WH/OUT/…` is the fallback for a manual admin
 * fulfilment, which genuinely has no receipt; it is built from the row's
 * position and refers to nothing else in the system, so it must never displace
 * a receipt number.
 */
export function fulfillmentLabel(
  f: SalesOrderFulfillment,
  index: number
): string {
  if (f.ref) return f.ref;
  return `WH/OUT/${String(index + 1).padStart(5, '0')}`;
}

export function fulfillmentUnits(f: SalesOrderFulfillment): number {
  return (f.items || []).reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
}
