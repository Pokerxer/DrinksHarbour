/**
 * The cart's rules. No React, no storage, no network.
 *
 * The web's `CartContext.tsx` is 742 lines with all four concerns in one file.
 * This is its pure half, transcribed; the provider, AsyncStorage and the API
 * calls live in `cart-context.tsx`, `cart-storage.ts` and `cart-api.ts`.
 *
 * One deliberate divergence: the web's `CartItem extends ProductType` — it
 * spreads the ENTIRE product into every line, because its cart page renders
 * from that copy. Mobile stores a lean line instead. AsyncStorage is a device
 * database with real size limits, a stored product doc goes stale the moment
 * the catalogue changes, and `toServerItems` only ever needed the ids. The
 * fields kept below are exactly the ones the cart screen draws.
 */

import { resolveCartLine } from 'commerce-core';

export const CART_EXPIRY_DAYS = 7;

const STORAGE_PREFIX = 'drinksharbour_cart';

/** Per-identity key. A shared device must never show user A's cart to user B. */
export function storageKeyFor(userId: string | null): string {
  return `${STORAGE_PREFIX}:${userId || 'guest'}`;
}

export interface CartLine {
  cartItemId: string;
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  /** The `availableAt` entry — the server calls it a SubProduct. */
  subProductId: string;
  sizeId: string;
  tenantId: string;
  vendorName: string;
  size: string;
  quantity: number;
  price: number;
  packUnitPrice: number | null;
  packThreshold: number | null;
  addedAt: number;
}

/**
 * The web's four-part key. Colour is always empty here — drinks have no colour
 * variants — but the shape is kept so both apps identify a line the same way.
 */
export function cartItemId(
  productId: string,
  size: string,
  vendor: string,
  color: string
): string {
  return `${productId}-${size || 'default'}-${vendor || 'default'}-${color || 'default'}`;
}

/** An image field is sometimes `{ url }`, sometimes a bare string, often absent. */
function imageUrlOf(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  const url = (value as { url?: unknown } | null)?.url;
  return typeof url === 'string' && url ? url : null;
}

/**
 * Turn a product into a cart line.
 *
 * Vendor/size/id selection is delegated to `commerce-core.resolveCartLine`,
 * which both apps already share — including the rule that a line carries BOTH
 * the subProductId and the sizeId from the SAME `availableAt` entry, or
 * neither. A subProductId without its sizeId reads as "Out of Stock" at
 * validation, which is worse than no line at all; hence the null return.
 */
export function toCartLine(
  product: Record<string, any>,
  options: { size?: string; vendorId?: string; quantity?: number; now: number }
): CartLine | null {
  const resolved = resolveCartLine(product, {
    size: options.size,
    vendorId: options.vendorId,
  });
  if (!resolved) return null;

  // resolveCartLine reports which vendor and size it settled on; re-read that
  // entry for the pack fields, which it does not carry.
  const vendors: any[] = Array.isArray(product?.availableAt) ? product.availableAt : [];
  const vendor = vendors.find((v) => String(v?._id) === resolved.subProductId);
  const size = (vendor?.sizes ?? []).find((s: any) => String(s?._id) === resolved.sizeId);
  const packUnitPrice = size?.pricing?.packUnitPrice;
  const packThreshold = size?.pricing?.packThreshold;

  const productId = String(product._id ?? product.id ?? '');

  return {
    cartItemId: cartItemId(productId, resolved.size, resolved.vendorName, ''),
    productId,
    slug: typeof product.slug === 'string' ? product.slug : '',
    name: typeof product.name === 'string' ? product.name : '',
    imageUrl:
      imageUrlOf(product.primaryImage) ??
      imageUrlOf(Array.isArray(product.images) ? product.images[0] : null) ??
      imageUrlOf(Array.isArray(product.thumbImage) ? product.thumbImage[0] : null),
    subProductId: resolved.subProductId,
    sizeId: resolved.sizeId,
    tenantId: resolved.tenantId,
    vendorName: resolved.vendorName,
    size: resolved.size,
    quantity: options.quantity ?? 1,
    price: typeof resolved.price === 'number' ? resolved.price : 0,
    packUnitPrice:
      packUnitPrice && packThreshold ? packUnitPrice : null,
    packThreshold: packUnitPrice && packThreshold ? packThreshold : null,
    addedAt: options.now,
  };
}

/** Per-unit price a line actually pays: the pack price once quantity reaches the threshold. */
export function effectiveUnitPrice(line: {
  price?: number;
  quantity?: number;
  packUnitPrice?: number | null;
  packThreshold?: number | null;
}): number {
  return line.packUnitPrice && line.packThreshold && (line.quantity || 1) >= line.packThreshold
    ? line.packUnitPrice
    : line.price || 0;
}

export interface CartState {
  lines: CartLine[];
}

export type CartAction =
  | { type: 'ADD'; line: CartLine }
  | { type: 'REMOVE'; cartItemId: string }
  | { type: 'SET_QUANTITY'; cartItemId: string; quantity: number }
  | { type: 'LOAD'; lines: CartLine[] }
  | { type: 'CLEAR' };

function sameCart(a: CartLine[], b: CartLine[]): boolean {
  return (
    a.length === b.length &&
    a.every((line, i) => line.cartItemId === b[i].cartItemId && line.quantity === b[i].quantity)
  );
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD': {
      const existing = state.lines.find((l) => l.cartItemId === action.line.cartItemId);
      if (!existing) return { lines: [...state.lines, action.line] };
      return {
        lines: state.lines.map((l) =>
          l.cartItemId === action.line.cartItemId
            ? { ...l, quantity: l.quantity + action.line.quantity, addedAt: action.line.addedAt }
            : l
        ),
      };
    }

    case 'REMOVE':
      return { lines: state.lines.filter((l) => l.cartItemId !== action.cartItemId) };

    case 'SET_QUANTITY':
      // Zero means gone. Keeping a 0-quantity line would send the server an
      // item it has to price at nothing.
      if (action.quantity <= 0) {
        return { lines: state.lines.filter((l) => l.cartItemId !== action.cartItemId) };
      }
      return {
        lines: state.lines.map((l) =>
          l.cartItemId === action.cartItemId ? { ...l, quantity: action.quantity } : l
        ),
      };

    case 'LOAD':
      // Returning the SAME object when nothing changed matters: the mirror
      // effect keys off `lines`, and a fresh array on every hydrate would write
      // to storage in a loop.
      return sameCart(state.lines, action.lines) ? state : { lines: action.lines };

    case 'CLEAR':
      return { lines: [] };

    default:
      return state;
  }
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + effectiveUnitPrice(line) * (line.quantity || 1), 0);
}

/** Units, not lines — this is what the bottom-nav badge shows. */
export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + (line.quantity || 1), 0);
}

/** A client line → the payload `/api/cart/save` and `/merge` expect. */
export function toServerItems(lines: CartLine[]) {
  return lines
    .filter((line) => line.subProductId && line.sizeId)
    .map((line) => ({
      productId: line.productId,
      subProductId: line.subProductId,
      sizeId: line.sizeId,
      tenantId: line.tenantId,
      size: line.size,
      vendor: line.vendorName,
      color: '',
      quantity: line.quantity || 1,
      price: line.price,
    }));
}

/** The subset of a `/api/cart/validate` verdict this module acts on. */
export interface LineVerdict {
  available?: boolean;
  /** Unit price BEFORE any pack rate. Prefer this over `currentPrice`. */
  baseUnitPrice?: number;
  currentPrice?: number;
  maxQuantity?: number | null;
  packUnitPrice?: number | null;
  packThreshold?: number | null;
}

/**
 * Fold the server's verdicts back into the cart: drop what is gone, cap what is
 * short, take today's prices.
 *
 * `baseUnitPrice` is preferred over `currentPrice` deliberately, and this is
 * the whole reason the rule lives here with a test around it. A live
 * `/api/cart/validate` call returns BOTH, and `currentPrice` can already have
 * the pack rate applied — storing that as the line's base `price` would let
 * `effectiveUnitPrice` apply the pack discount a SECOND time, quoting the
 * shopper less than the server will actually charge.
 */
export function applyValidationTo(
  lines: CartLine[],
  validation: Record<string, LineVerdict>
): CartLine[] {
  const keyOf = (line: CartLine) => `${line.subProductId}-${line.sizeId ?? ''}`;

  return lines
    .filter((line) => {
      const verdict = validation[keyOf(line)];
      return !verdict || verdict.available !== false;
    })
    .map((line) => {
      const verdict = validation[keyOf(line)];
      if (!verdict) return line;

      const base = verdict.baseUnitPrice ?? 0;
      const current = verdict.currentPrice ?? 0;

      return {
        ...line,
        price: base > 0 ? base : current > 0 ? current : line.price,
        quantity:
          verdict.maxQuantity != null
            ? Math.min(line.quantity || 1, verdict.maxQuantity)
            : line.quantity || 1,
        packUnitPrice: verdict.packUnitPrice ?? null,
        packThreshold: verdict.packThreshold ?? null,
      };
    });
}

export function isCartExpired(savedAt: number, now: number): boolean {
  return now - savedAt > CART_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
}
