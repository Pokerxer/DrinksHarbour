// Turning a recalled held order back into cart lines.
//
// This is pure, and here rather than inline in the recall handler, because the
// bug it exists to prevent is invisible in a rendered cart: the handler carried
// five fields across and dropped the rest under a comment claiming "the grid
// re-prices them", which nothing does. Every recalled line loaded at ₦0.00 with
// its cost, combo grouping and bundles gone. See pos-recall-cart-lines.test.ts.
//
// Admin vitest is `environment: 'node'` and cannot render the cart, so the only
// way to test this is to have it not be inside a component — the same reason
// pos-sales-order-lines.ts was extracted.

import type { POSCartItem, POSRecallCart } from '../types';

/**
 * The cart lines a held order recalls as — the same shape the product grid
 * builds when a cashier taps a card, so a recalled line and a tapped line
 * behave identically from there on.
 *
 * Every money field is coerced through `Number(x) || 0`. A hold parked before
 * the server kept a cart snapshot has no `price`, and an absent price
 * multiplied by a quantity is `NaN` — which `formatCurrency` renders as the
 * literal string `₦NaN` rather than failing, and which `Math.max(0, …)` in the
 * cart's line math does not floor away.
 *
 * `stock` is deliberately not restored from the snapshot: a hold can sit for
 * hours and its stock figure is stale by the time it is recalled. The grid
 * supplies the live number on mount; 999 is the existing placeholder until it
 * does.
 */
export function recallCartToItems(cart: POSRecallCart): POSCartItem[] {
  return (cart?.items ?? []).map((ci) => ({
    subProductId: ci.subProductId,
    productId: ci.productId,
    sizeId: ci.sizeId,
    name: ci.name || 'Product',
    variant: ci.variant ?? '',
    sku: ci.sku ?? '',
    image: ci.image,
    categoryId: ci.categoryId,
    brandId: ci.brandId,
    price: Number(ci.price) || 0,
    quantity: Number(ci.quantity) || 0,
    discount: Number(ci.discount) || 0,
    stock: 999,
    costPrice: Number(ci.costPrice) || 0,
    originalPrice: ci.originalPrice,
    activeBundles: ci.activeBundles,
    comboRef: ci.comboRef,
    bxgyRef: ci.bxgyRef,
  }));
}
