# Per-User Cart Persistence

**Date:** 2026-07-29
**Status:** Approved, ready for implementation plan
**Scope:** `server/` cart service + routes, `client/apps/platform` `CartContext`

## Problem

The storefront cart lives entirely in `localStorage`. A user who logs in on a
second device sees an empty cart; a user who logs out on a shared browser leaves
their cart behind for the next person.

The server-side pieces to fix this already exist but are not wired up:

| Piece | State today |
| --- | --- |
| `server/models/Cart.js` | Works. Per-user schema (`user` unique), items, totals, 30-day TTL. |
| `GET /api/cart`, `POST /api/cart/save`, `POST /api/cart/validate` | Exist and function. |
| `CartContext.loadServerCart()` | **Broken.** Fetches the cart, then the `if (serverCart && ...)` body is empty. The result is discarded, so the DB cart never reaches the UI. |
| `CartContext.syncCartToServer()` | **Dead for current sessions.** Gates on `localStorage.getItem('dh_token')`, but auth moved to httpOnly cookies — `AuthContext` stores the sentinel string `'cookie'` and no `dh_token` exists. The function returns `false` before doing any work. Also only called once, at `checkout/page.tsx:550`. |
| localStorage key `drinksharbour_cart` | Global, not per-identity. User A's cart is visible to user B on the same browser. |
| `cartService.addToCart` | Stores `priceAtAddition = size.sellingPrice`, the raw tenant-facing price. `validateCartItems` deliberately uses `calculateSizePricing` instead ("NOT the raw tenant-facing Size.sellingPrice"). Stored prices are therefore wrong for display. |

## Decisions

Settled during brainstorming:

1. **Login merge:** union of local and DB carts; a line present in both keeps the
   **higher** quantity, not the sum. Repeated logins cannot inflate a line, and
   nothing is silently discarded.
2. **Write cadence:** debounced auto-save, 800 ms after the last change, plus an
   immediate flush when the tab is hidden.
3. **Hydration:** the server returns UI-ready cart lines, repriced through
   `calculateSizePricing`. The server is the single source of truth for price.
4. **Storage:** keep the `Cart` collection keyed by `user`, rather than embedding
   an array in the `User` document. Carts are unbounded and churn on every click.
   `User.activeCartItemCount` stays as the cheap badge counter.
5. **Logout clears the local cart.** Leaving it reintroduces cross-user bleed on
   shared devices, which is the bug being fixed.

## Architecture

### Storage layout

The DB is durable truth. `localStorage` is an offline mirror and the guest cart,
keyed per identity:

```
drinksharbour_cart:guest      ← logged out
drinksharbour_cart:<userId>   ← logged in
```

A cart line's identity is `product + subproduct + size`, matching the existing
client `cartItemId` scheme (`${productId}-${size}-${vendor}-${color}`).

### Server

**`server/services/cart.service.js`**

- `getCart(userId)` returns UI-ready lines instead of raw populated documents.
  Each line runs through `calculateSizePricing(size, product, tenant, costPrice,
  baseSellingPrice)` — the same pipeline `validateCartItems` and the product page
  use — yielding `price`, `packUnitPrice`, `packThreshold`. A cart loaded a week
  later shows today's real price.

  Line shape returned to the client:

  ```js
  {
    cartItemId, _id, id, name, slug, sku, images,
    selectedProductId, selectedSubProductId, selectedSizeId,
    selectedSize, selectedVendor, selectedVendorId, selectedColor,
    price, packUnitPrice, packThreshold,
    quantity, addedAt,
  }
  ```

  Two details the implementer must not get wrong:

  - `cartItemId` is `${productId}-${size}-${vendor}-${color}` where `vendor` is the
    tenant **name** (already populated on `items.subproduct.tenant`), not the tenant
    id. Using the id produces ids that never match the client's, and merged lines
    duplicate instead of collapsing.
  - The `Cart` schema stores no colour. Server-rebuilt lines set `selectedColor: ''`,
    which is what `generateCartItemId` already coerces a missing colour to, so ids
    stay consistent across both paths.

- `addToCart(...)` stores the platform price in `priceAtAddition` via
  `calculateSizePricing`, not `size.sellingPrice`. Note `product.controller.js:1460`
  is a second consumer of this function and inherits the fix.

- New `mergeCart(userId, items)`: union of the DB cart and the supplied local
  items, `Math.max` on quantity for lines present in both, then clamped to
  available stock and `maxOrderQuantity` using the same validation `syncCart`
  already performs. Returns the merged cart in `getCart` shape.

**`server/controllers/cart.controller.js` and `server/routes/cart.routes.js`**

- `POST /api/cart/merge` (protected) → `mergeCart`. Used once, on login.
- `DELETE /api/cart` (protected) → existing `clearCart`. Used after a successful order.
- `POST /api/cart/save` keeps replace semantics — once logged in, client state is
  authoritative and the debounced save writes it wholesale.
- `POST /api/cart/validate` unchanged.

### Client — `client/apps/platform/src/context/CartContext.tsx`

Every auth decision reads `isAuthenticated` and `user._id` from `useAuth()`.
Nothing reads `localStorage.dh_token`. `CartProvider` already sits inside
`AuthProvider` in `GlobalProvider.tsx`, so the hook is available.

```
mount ──▶ auth.isLoading? ──yes──▶ wait (no reads, no writes)
                │no
                ▼
   logged in ──▶ GET /api/cart ──▶ LOAD_CART ──▶ mirror to :<userId>
   guest     ──▶ read :guest    ──▶ LOAD_CART

login  (null → userId) ──▶ guest cart empty?
                            yes ──▶ GET /api/cart (skip merge)
                            no  ──▶ POST /api/cart/merge { guest items }
                          ──▶ LOAD_CART(result) ──▶ wipe :guest

logout (userId → null) ──▶ CLEAR_CART, drop :<userId>, empty :guest

any change ──▶ debounce 800ms ──▶ POST /api/cart/save
tab hidden ──▶ flush pending save immediately
```

**The race that must not happen.** The reducer initialises to
`{ cartArray: [] }`. A naive save-on-change effect fires with that empty array on
first paint and wipes the DB cart before hydration completes. Guard with a
`hydratedRef` keyed by user id: no save is issued for a user until that user's
cart has finished loading. The same guard suppresses saves while
`auth.isLoading` is true.

`loadServerCart()` gets its empty `if` body filled in — dispatching `LOAD_CART`
with the server lines is what makes the existing DB cart visible at all.

The existing `storage` and `cart-updated` event listeners keep working, but read
the active per-identity key rather than the global one.

**`client/apps/platform/src/app/checkout/page.tsx`**

Existing validate-then-pay flow is unchanged. After a successful order, call
`DELETE /api/cart` alongside the existing `clearCart()` so the DB copy does not
resurrect on the next page load.

## Error handling

Network failure never blocks the UI.

- A failed save is dropped, not queued. The next mutation re-sends full cart
  state, and the `visibilitychange` flush covers the closed-tab case.
- If merge-on-login fails, the guest cart is **kept**, not wiped. Nothing is lost;
  the next debounced save pushes it to the DB.
- If `GET /api/cart` fails, fall back to the localStorage mirror for that user.
- Server-side per-item validation errors during merge follow the existing
  `syncCart` pattern: the offending line is skipped and reported in `results.errors`,
  the rest of the cart survives.

## Testing

Server tests are `node:test`, run with `node --test '__tests__/*.test.js'`
(`npm test` is broken). Baseline is 628/631 — three pre-existing failures
(one pricelist populate, two SO-number). Do not count those as regressions.

New `server/__tests__/cart.merge.test.js`:

- Merge keeps the higher quantity when a line exists in both carts.
- Merge unions disjoint lines from both sides.
- Empty local cart leaves the DB cart untouched.
- Empty DB cart accepts the local cart wholesale.
- Merged quantity is clamped to available stock and `maxOrderQuantity`.
- `getCart` prices lines via `calculateSizePricing`, not `size.sellingPrice`.

Client: the hydration guard (no save fires before a user's cart has loaded) and
the login/logout key switch.

## Out of scope

- Guest carts remain localStorage-only. There is no server-side anonymous cart
  keyed by a guest id.
- Cart-level coupons. The `Cart.coupon` field exists but is not wired into the
  storefront and this work does not change that.
- The admin app's separate `quick-cart` store.
