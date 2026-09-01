// client/apps/admin/src/app/shared/ecommerce/cart-list/cart-meta.ts
//
// Pure presentation logic for the "Live Carts" tab. Admin vitest runs with
// `environment: 'node'` — components cannot be rendered — so anything worth
// testing lives here rather than inside the JSX.
import { shortDate } from '../order/order-view/format';
import type { CartBucket } from '@/services/adminCart.service';

export const BUCKET_META: Record<
  CartBucket,
  { label: string; hint: string; badge: string; dot: string }
> = {
  active: {
    label: 'Active',
    hint: 'Updated in the last 24 hours',
    badge: 'bg-green-50 text-green-700 ring-green-600/20',
    dot: 'bg-green-500',
  },
  at_risk: {
    label: 'At risk',
    hint: 'Untouched for 1–7 days',
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    dot: 'bg-amber-500',
  },
  abandoned: {
    label: 'Abandoned',
    hint: 'Untouched for over 7 days',
    badge: 'bg-red-50 text-red-700 ring-red-600/20',
    dot: 'bg-red-500',
  },
};

/**
 * "3h", "2d", "5w" — a compact age for the row. Ages arrive from the server
 * already rounded to whole hours off `updatedAt`.
 *
 * A cart saved seconds ago arrives as 0 hours; "0h" reads like a bug, so the
 * bottom of the range is "just now".
 */
export function formatAge(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return '—';
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

/**
 * The one-line summary under a shopper's name: "3 items · 7 units", plus the
 * other-tenant count when there is one.
 *
 * `skippedCount` is deliberately a bare number — naming another tenant's
 * products to this tenant is the leak the server exists to prevent, so the
 * copy must never imply the names are available on request.
 */
export function lineSummary(
  itemCount: number,
  totalQuantity: number,
  skippedCount: number
): string {
  const parts = [
    `${itemCount} item${itemCount === 1 ? '' : 's'}`,
    `${totalQuantity} unit${totalQuantity === 1 ? '' : 's'}`,
  ];
  if (skippedCount > 0) {
    parts.push(
      `${skippedCount} from other store${skippedCount === 1 ? '' : 's'}`
    );
  }
  return parts.join(' · ');
}

/**
 * React key for one cart line.
 *
 * The cart's OWN identity for a line is (product, subproduct, size) — see
 * `addToCart` in `server/services/cart.service.js`, which merges on all three.
 * A key of (subproduct, size) alone therefore collides whenever two lines share
 * a subproduct and size but differ in `product`, which real carts contain; that
 * was a "two children with the same key" crash on the Live Carts page.
 *
 * The index is appended as a backstop: `replaceCart` writes items without going
 * through `addToCart`'s merge, so the triple is not guaranteed unique either.
 * Safe here because cart lines render as one stable block — they are never
 * independently reordered or filtered.
 */
export function cartLineKey(
  line: { productId?: string; subProductId?: string; sizeId?: string },
  index: number
): string {
  return [
    line.productId ?? '',
    line.subProductId ?? '',
    line.sizeId ?? '',
    index,
  ].join('|');
}

/**
 * Whether a cart is worth chasing: it has value and has gone quiet. Drives the
 * row's "Create quotation" nudge.
 */
export function isFollowUpWorthy(bucket: CartBucket, value: number): boolean {
  return value > 0 && (bucket === 'at_risk' || bucket === 'abandoned');
}

/**
 * The one-label state for a signup row. Kept pure so the copy is test-bound:
 * "No cart yet" is deliberately generic — it must never imply another store is
 * involved, same rule as `lineSummary`'s skipped-count opacity.
 */
export function signupSummary(): string {
  return 'No cart yet';
}

/**
 * Short registration date for a signup row ("14 Aug · 6:25 PM"), with the same
 * empty-field guard as the orders formatter.
 */
export function formatJoined(iso?: string): string {
  return shortDate(iso) ?? '—';
}
