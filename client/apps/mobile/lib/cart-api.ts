/**
 * The server-stored cart. Five routes, verified in `server/routes/cart.routes.js`:
 * `/validate` is public (guest carts validate too), the rest sit behind `protect`.
 *
 * The server does NOT hand back its Mongo documents. `server/helpers/cart.helpers.js`
 * reshapes every line through `buildCartLine` into the client's own shape, and
 * its `buildCartItemId` is required by its own comment to stay byte-identical
 * to the web's `generateCartItemId` — which `cart-core.ts:cartItemId`
 * reproduces. That is why a merged line collapses instead of duplicating.
 *
 * Prices come back re-computed through the platform pipeline, not snapshotted:
 * a cart loaded a week later shows today's price.
 */

import { apiFetch } from './api-client.ts';
import { toServerItems, type CartLine } from './cart-core.ts';

export type CartApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

const GENERIC_ERROR = 'Could not reach your cart right now.';

interface Fetched {
  status: number | null;
  payload: unknown;
}

async function call(path: string, init?: RequestInit): Promise<Fetched> {
  try {
    const response = await apiFetch(path, init);
    try {
      return { status: response.status, payload: await response.json() };
    } catch {
      return { status: null, payload: null };
    }
  } catch {
    return { status: null, payload: null };
  }
}

function failed({ status }: Fetched): boolean {
  return status === null || status < 200 || status >= 300;
}

function messageOf(payload: unknown): string {
  const message = (payload as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message ? message : GENERIC_ERROR;
}

function imageUrlOf(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  const url = (value as { url?: unknown } | null)?.url;
  return typeof url === 'string' && url ? url : null;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A `buildCartLine` line → the lean line this app stores. */
function fromServerLine(raw: unknown): CartLine | null {
  const l = raw as Record<string, any> | null;
  if (!l || typeof l !== 'object') return null;

  const subProductId = l.selectedSubProductId ? String(l.selectedSubProductId) : '';
  const sizeId = l.selectedSizeId ? String(l.selectedSizeId) : '';
  // Both ids or the line is unusable — it can be neither saved nor validated.
  if (!subProductId || !sizeId || !l.cartItemId) return null;

  const images = Array.isArray(l.images) ? l.images : [];

  return {
    cartItemId: String(l.cartItemId),
    productId: String(l.selectedProductId ?? l._id ?? l.id ?? ''),
    slug: typeof l.slug === 'string' ? l.slug : '',
    name: typeof l.name === 'string' ? l.name : '',
    imageUrl: imageUrlOf(images[0]) ?? imageUrlOf(l.primaryImage),
    subProductId,
    sizeId,
    tenantId: l.selectedVendorId ? String(l.selectedVendorId) : '',
    vendorName: typeof l.selectedVendor === 'string' ? l.selectedVendor : '',
    size: typeof l.selectedSize === 'string' ? l.selectedSize : '',
    quantity: num(l.quantity, 1),
    price: num(l.price, 0),
    packUnitPrice: typeof l.packUnitPrice === 'number' ? l.packUnitPrice : null,
    packThreshold: typeof l.packThreshold === 'number' ? l.packThreshold : null,
    addedAt: num(l.addedAt, 0),
  };
}

function readCartLines(payload: unknown): CartLine[] {
  const items = (payload as Record<string, any> | null)?.data?.cart?.items;
  return (Array.isArray(items) ? items : [])
    .map(fromServerLine)
    .filter((l): l is CartLine => l !== null);
}

export async function fetchServerCart(): Promise<CartApiResult<CartLine[]>> {
  const result = await call('/api/cart');
  if (failed(result)) return { ok: false, error: messageOf(result.payload) };
  return { ok: true, data: readCartLines(result.payload) };
}

export async function saveServerCart(lines: CartLine[]): Promise<CartApiResult<CartLine[]>> {
  const result = await call('/api/cart/save', {
    method: 'POST',
    body: JSON.stringify({ items: toServerItems(lines) }),
  });
  if (failed(result)) return { ok: false, error: messageOf(result.payload) };
  return { ok: true, data: readCartLines(result.payload) };
}

/**
 * Fold the guest cart into the signed-in one. The server keeps the HIGHER
 * quantity per line rather than the sum, so signing in repeatedly cannot
 * inflate a line (`cart.helpers.js:mergeCartLines`).
 */
export async function mergeServerCart(lines: CartLine[]): Promise<CartApiResult<CartLine[]>> {
  const result = await call('/api/cart/merge', {
    method: 'POST',
    body: JSON.stringify({ items: toServerItems(lines) }),
  });
  if (failed(result)) return { ok: false, error: messageOf(result.payload) };
  return { ok: true, data: readCartLines(result.payload) };
}

export type CartValidationStatus =
  | 'ok'
  | 'price_changed'
  | 'out_of_stock'
  | 'quantity_reduced'
  | 'unavailable';

export interface CartItemValidation {
  subProductId: string;
  sizeId: string | null;
  status: CartValidationStatus;
  available: boolean;
  currentPrice: number;
  maxQuantity: number | null;
  packUnitPrice?: number | null;
  packThreshold?: number | null;
}

/** Keyed `${subProductId}-${sizeId ?? ''}`, the same key the web builds. */
export async function validateServerCart(
  lines: CartLine[]
): Promise<CartApiResult<Record<string, CartItemValidation>>> {
  const items = lines
    .filter((line) => line.subProductId)
    .map((line) => ({
      subProductId: line.subProductId,
      sizeId: line.sizeId || null,
      tenantId: line.tenantId || null,
      quantity: line.quantity || 1,
      price: line.price,
    }));

  // The endpoint 400s on an empty array — don't spend a request to be told so.
  if (!items.length) return { ok: true, data: {} };

  const result = await call('/api/cart/validate', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
  if (failed(result)) return { ok: false, error: messageOf(result.payload) };

  const verdicts = (result.payload as Record<string, any> | null)?.data?.items;
  const map: Record<string, CartItemValidation> = {};
  for (const v of Array.isArray(verdicts) ? verdicts : []) {
    if (!v?.subProductId) continue;
    map[`${v.subProductId}-${v.sizeId ?? ''}`] = v as CartItemValidation;
  }
  return { ok: true, data: map };
}

export async function clearServerCart(): Promise<CartApiResult<null>> {
  const result = await call('/api/cart', { method: 'DELETE' });
  if (failed(result)) return { ok: false, error: messageOf(result.payload) };
  return { ok: true, data: null };
}
