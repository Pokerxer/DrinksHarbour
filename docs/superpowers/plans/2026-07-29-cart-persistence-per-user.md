# Per-User Cart Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the storefront cart persist per user in MongoDB so it follows the user across devices and never leaks between users on a shared browser.

**Architecture:** The existing `Cart` collection (keyed by `user`, unique) stays the durable source of truth; `localStorage` becomes a per-identity mirror (`drinksharbour_cart:guest` / `drinksharbour_cart:<userId>`). The server returns UI-ready cart lines repriced through `calculateSizePricing`, so price lives in exactly one place. The client auto-saves on a debounce and merges the guest cart into the account cart on login, taking the higher quantity per line.

**Tech Stack:** Node/Express + Mongoose (`server/`), Next.js App Router + React context (`client/apps/platform/`), `node:test` for server tests.

## Global Constraints

- Server tests run with `node --test '__tests__/*.test.js'` from `server/`. **`npm test` is broken — do not use it.**
- Baseline is **628/631 passing**; 3 pre-existing failures (1 pricelist populate, 2 SO-number). Those are not regressions. Any *new* failure is.
- Tests in this repo are `node:test` + `node:assert`, **not jest**. No `describe`/`expect`.
- New server tests must be **pure-function tests with no DB connection** — that is the established pattern (`pricelistPricing.service.test.js`, `packPricing.test.js`). All merge and line-building logic therefore lives in pure helpers.
- Price on the storefront is **always** `calculateSizePricing(...).finalPrice`, never the raw `size.sellingPrice`. Pack price is `.packUnitPrice` / `.packThreshold`.
- A cart line's identity is `` `${productId}-${size}-${vendor}-${color}` `` where `vendor` is the tenant **name** and missing values coerce to `''`. This must match `generateCartItemId` in `CartContext.tsx` exactly.
- Client auth state comes from `useAuth()` (`isAuthenticated`, `user._id`, `isLoading`). **Never read `localStorage.getItem('dh_token')`** — auth is httpOnly-cookie based and that key does not exist for current sessions.
- Commit after each task. Do not push until the whole plan is green.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `server/helpers/cart.helpers.js` | **New.** Pure functions: `buildCartItemId`, `buildCartLine`, `mergeCartLines`. No Mongoose, no I/O — this is what the tests exercise. |
| `server/__tests__/cart.helpers.test.js` | **New.** Unit tests for the three pure helpers. |
| `server/services/cart.service.js` | Modified. `getCart` returns UI-ready lines; `addToCart` stores the platform price; new `mergeCart` DB wrapper delegating merge maths to the helper. |
| `server/controllers/cart.controller.js` | Modified. Adds `mergeMyCart`, `clearMyCart`. |
| `server/routes/cart.routes.js` | Modified. Adds `POST /merge`, `DELETE /`. |
| `client/apps/platform/src/context/CartContext.tsx` | Modified. Per-identity storage keys, auth-gated hydration, debounced save, login merge, logout clear. |
| `client/apps/platform/src/app/checkout/page.tsx` | Modified. Clears the server cart after a successful order. |

---

### Task 1: Pure cart helpers — id + merge

**Files:**
- Create: `server/helpers/cart.helpers.js`
- Test: `server/__tests__/cart.helpers.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `buildCartItemId(productId, size, vendor, color) -> string`
  - `mergeCartLines(dbLines, localLines) -> Array` — union keyed by `cartItemId`, quantity is `Math.max` of the two sides. DB line data wins for every other field. Order: DB lines first (original order), then local-only lines.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/cart.helpers.test.js`:

```js
// server/__tests__/cart.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const { buildCartItemId, mergeCartLines } = require('../helpers/cart.helpers');

test('buildCartItemId matches the client generateCartItemId scheme', () => {
  assert.strictEqual(buildCartItemId('p1', '70cl', 'Wyn City', ''), 'p1-70cl-Wyn City-default');
  assert.strictEqual(buildCartItemId('p1', '', '', ''), 'p1-default-default-default');
});

test('buildCartItemId coerces null and undefined the same way as empty string', () => {
  assert.strictEqual(buildCartItemId('p1', null, undefined, null), 'p1-default-default-default');
});

test('mergeCartLines keeps the higher quantity when a line exists on both sides', () => {
  const db =    [{ cartItemId: 'a', quantity: 5, name: 'Hennessy' }];
  const local = [{ cartItemId: 'a', quantity: 2, name: 'Hennessy' }];
  const merged = mergeCartLines(db, local);
  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0].quantity, 5);
});

test('mergeCartLines takes the local quantity when it is higher', () => {
  const db =    [{ cartItemId: 'a', quantity: 1 }];
  const local = [{ cartItemId: 'a', quantity: 4 }];
  assert.strictEqual(mergeCartLines(db, local)[0].quantity, 4);
});

test('mergeCartLines never sums quantities', () => {
  const db =    [{ cartItemId: 'a', quantity: 5 }];
  const local = [{ cartItemId: 'a', quantity: 2 }];
  assert.notStrictEqual(mergeCartLines(db, local)[0].quantity, 7);
});

test('mergeCartLines unions disjoint lines, DB lines first', () => {
  const db =    [{ cartItemId: 'a', quantity: 1 }];
  const local = [{ cartItemId: 'b', quantity: 3 }];
  const merged = mergeCartLines(db, local);
  assert.deepStrictEqual(merged.map((l) => l.cartItemId), ['a', 'b']);
  assert.deepStrictEqual(merged.map((l) => l.quantity), [1, 3]);
});

test('mergeCartLines prefers DB field values over local ones for overlapping lines', () => {
  const db =    [{ cartItemId: 'a', quantity: 1, price: 128500 }];
  const local = [{ cartItemId: 'a', quantity: 1, price: 99 }];
  assert.strictEqual(mergeCartLines(db, local)[0].price, 128500);
});

test('mergeCartLines returns the DB cart unchanged when local is empty', () => {
  const db = [{ cartItemId: 'a', quantity: 2 }];
  assert.deepStrictEqual(mergeCartLines(db, []), db);
});

test('mergeCartLines returns the local cart when the DB cart is empty', () => {
  const local = [{ cartItemId: 'b', quantity: 3 }];
  assert.deepStrictEqual(mergeCartLines([], local), local);
});

test('mergeCartLines tolerates null and undefined inputs', () => {
  assert.deepStrictEqual(mergeCartLines(null, undefined), []);
});

test('mergeCartLines treats a missing quantity as 1', () => {
  const merged = mergeCartLines([{ cartItemId: 'a' }], [{ cartItemId: 'a', quantity: 1 }]);
  assert.strictEqual(merged[0].quantity, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/cart.helpers.test.js`
Expected: FAIL — `Cannot find module '../helpers/cart.helpers'`

- [ ] **Step 3: Write minimal implementation**

Create `server/helpers/cart.helpers.js`:

```js
// server/helpers/cart.helpers.js
'use strict';

/**
 * Cart line identity. MUST stay byte-identical to generateCartItemId in
 * client/apps/platform/src/context/CartContext.tsx — if these drift, merged
 * lines duplicate instead of collapsing.
 *
 * `vendor` is the tenant NAME, not its id.
 */
const buildCartItemId = (productId, size, vendor, color) =>
  `${productId}-${size || 'default'}-${vendor || 'default'}-${color || 'default'}`;

/**
 * Union of the stored cart and the browser's cart, keyed by cartItemId.
 * A line present on both sides keeps the HIGHER quantity — never the sum, so
 * logging in repeatedly cannot inflate a line. Every other field comes from the
 * DB line, which carries freshly-computed pricing.
 */
const mergeCartLines = (dbLines, localLines) => {
  const merged = (dbLines || []).map((line) => ({ ...line }));
  const indexById = new Map(merged.map((line, i) => [line.cartItemId, i]));

  for (const local of localLines || []) {
    const existingIndex = indexById.get(local.cartItemId);

    if (existingIndex === undefined) {
      merged.push({ ...local });
      indexById.set(local.cartItemId, merged.length - 1);
      continue;
    }

    const existing = merged[existingIndex];
    existing.quantity = Math.max(existing.quantity || 1, local.quantity || 1);
  }

  return merged;
};

module.exports = { buildCartItemId, mergeCartLines };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && node --test __tests__/cart.helpers.test.js`
Expected: PASS — `# pass 10`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add server/helpers/cart.helpers.js server/__tests__/cart.helpers.test.js
git commit -m "feat(cart): pure helpers for cart line identity and max-quantity merge"
```

---

### Task 2: Pure cart-line builder

**Files:**
- Modify: `server/helpers/cart.helpers.js`
- Test: `server/__tests__/cart.helpers.test.js`

**Interfaces:**
- Consumes: `buildCartItemId` from Task 1.
- Produces: `buildCartLine(item, pricing) -> object | null`. `item` is a populated `Cart.items[n]` (`product`, `subproduct` with nested `tenant`, `size` all populated). `pricing` is the output of `calculateSizePricing`. Returns `null` when the line can no longer be rendered (missing product, subproduct, size or tenant) so callers can drop it.

- [ ] **Step 1: Write the failing test**

Append to `server/__tests__/cart.helpers.test.js`:

```js
const { buildCartLine } = require('../helpers/cart.helpers');

const populatedItem = () => ({
  product: {
    _id: 'p1', name: 'Hennessy VSOP', slug: 'hennessy-vsop-cognac',
    images: [{ url: 'https://cdn/h.jpg' }], type: 'spirit', isAlcoholic: true, abv: 40,
  },
  subproduct: { _id: 'sp1', sku: 'HEN-VSOP-70', tenant: { _id: 't1', name: 'Wyn City' } },
  size: { _id: 'sz1', size: '70cl', displayName: '70cl Bottle' },
  quantity: 2,
  addedAt: new Date('2026-07-29T10:00:00Z'),
});

const pricing = () => ({ finalPrice: 128500, packUnitPrice: 122000, packThreshold: 6 });

test('buildCartLine produces a client-shaped line with the platform price', () => {
  const line = buildCartLine(populatedItem(), pricing());
  assert.strictEqual(line.cartItemId, 'p1-70cl-Wyn City-default');
  assert.strictEqual(line.name, 'Hennessy VSOP');
  assert.strictEqual(line.slug, 'hennessy-vsop-cognac');
  assert.strictEqual(line.price, 128500);
  assert.strictEqual(line.quantity, 2);
});

test('buildCartLine carries the selection ids the client sends back on save', () => {
  const line = buildCartLine(populatedItem(), pricing());
  assert.strictEqual(line.selectedProductId, 'p1');
  assert.strictEqual(line.selectedSubProductId, 'sp1');
  assert.strictEqual(line.selectedSizeId, 'sz1');
  assert.strictEqual(line.selectedVendorId, 't1');
  assert.strictEqual(line.selectedVendor, 'Wyn City');
  assert.strictEqual(line.selectedSize, '70cl');
});

test('buildCartLine sets selectedColor to empty string — the schema stores no colour', () => {
  assert.strictEqual(buildCartLine(populatedItem(), pricing()).selectedColor, '');
});

test('buildCartLine passes pack pricing through', () => {
  const line = buildCartLine(populatedItem(), pricing());
  assert.strictEqual(line.packUnitPrice, 122000);
  assert.strictEqual(line.packThreshold, 6);
});

test('buildCartLine emits null pack fields when the size has no pack rate', () => {
  const line = buildCartLine(populatedItem(), { finalPrice: 128500, packUnitPrice: null, packThreshold: null });
  assert.strictEqual(line.packUnitPrice, null);
  assert.strictEqual(line.packThreshold, null);
});

test('buildCartLine never reads size.sellingPrice for the display price', () => {
  const item = populatedItem();
  item.size.sellingPrice = 999;                       // raw tenant-facing price
  assert.strictEqual(buildCartLine(item, pricing()).price, 128500);
});

test('buildCartLine returns null when the product is gone', () => {
  const item = populatedItem();
  item.product = null;
  assert.strictEqual(buildCartLine(item, pricing()), null);
});

test('buildCartLine returns null when the tenant no longer populates', () => {
  const item = populatedItem();
  item.subproduct.tenant = null;
  assert.strictEqual(buildCartLine(item, pricing()), null);
});

test('buildCartLine returns null when the size is gone', () => {
  const item = populatedItem();
  item.size = null;
  assert.strictEqual(buildCartLine(item, pricing()), null);
});

test('buildCartLine falls back to size.displayName when size.size is missing', () => {
  const item = populatedItem();
  item.size = { _id: 'sz1', displayName: '70cl Bottle' };
  assert.strictEqual(buildCartLine(item, pricing()).selectedSize, '70cl Bottle');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/cart.helpers.test.js`
Expected: FAIL — `TypeError: buildCartLine is not a function`

- [ ] **Step 3: Write minimal implementation**

In `server/helpers/cart.helpers.js`, add above `module.exports`:

```js
/**
 * Turn a populated Cart.items[n] into the shape client/CartContext stores.
 * `pricing` is the calculateSizePricing output — the SAME pipeline the product
 * page and /api/cart/validate use. Returns null for lines that can no longer be
 * rendered (deleted product, delisted tenant, removed size) so callers drop them.
 */
const buildCartLine = (item, pricing) => {
  const product = item?.product;
  const subproduct = item?.subproduct;
  const size = item?.size;
  const tenant = subproduct?.tenant;

  if (!product || !subproduct || !size || !tenant) return null;

  const productId = String(product._id);
  const sizeLabel = size.size || size.displayName || '';
  const vendorName = tenant.name || '';

  return {
    cartItemId: buildCartItemId(productId, sizeLabel, vendorName, ''),

    // Product identity — the cart page reads _id/id, name, slug, images
    _id: productId,
    id: productId,
    name: product.name,
    slug: product.slug,
    sku: subproduct.sku,
    images: product.images || [],
    type: product.type,
    isAlcoholic: product.isAlcoholic,
    abv: product.abv,

    // Selection — echoed back verbatim on the next save
    selectedProductId: productId,
    selectedSubProductId: String(subproduct._id),
    selectedSizeId: String(size._id),
    selectedVendorId: String(tenant._id),
    selectedVendor: vendorName,
    selectedSize: sizeLabel,
    selectedColor: '',

    // Pricing — platform price, never size.sellingPrice
    price: pricing?.finalPrice ?? 0,
    packUnitPrice: pricing?.packUnitPrice ?? null,
    packThreshold: pricing?.packThreshold ?? null,

    quantity: item.quantity || 1,
    addedAt: item.addedAt ? new Date(item.addedAt).getTime() : Date.now(),
  };
};
```

Update the export line:

```js
module.exports = { buildCartItemId, buildCartLine, mergeCartLines };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && node --test __tests__/cart.helpers.test.js`
Expected: PASS — `# pass 20`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add server/helpers/cart.helpers.js server/__tests__/cart.helpers.test.js
git commit -m "feat(cart): pure builder for UI-ready cart lines"
```

---

### Task 3: `getCart` returns repriced UI lines; `addToCart` stores the platform price

**Files:**
- Modify: `server/services/cart.service.js` (`getCart` ~line 380-430, `addToCart` ~line 130-140, populate blocks ~line 155-175)

**Interfaces:**
- Consumes: `buildCartLine` (Task 2), `calculateSizePricing` (already imported at `cart.service.js:9`).
- Produces: `getCart(userId)` resolves to `{ items: CartLine[], subtotal, discountTotal, estimatedTotal, isEmpty }` where `CartLine` is the Task 2 shape.

**Why the populate selects must widen:** `calculateSizePricing(size, product, tenant, subProduct.costPrice, subProduct.baseSellingPrice)` reads fields the current `getCart` does not select. Without widening, every line prices at 0.

- [ ] **Step 1: Widen the populate selects in `getCart`**

Replace the `.populate(...)` chain in `getCart` with:

```js
  const cart = await Cart.findOne({ user: userId })
    .populate({
      path: 'items.product',
      select: 'name slug images type isAlcoholic abv status platformMarkup platformDiscount',
    })
    .populate({
      path: 'items.subproduct',
      select: 'sku costPrice baseSellingPrice status',
      populate: {
        path: 'tenant',
        select: 'name slug logo status subscriptionStatus revenueModel markupPercentage commissionPercentage packMarkupPercentage packCommissionPercentage packRateMinUnits',
      },
    })
    .populate({
      path: 'items.size',
      select: 'size displayName sellingPrice costPrice stock availability currency unitsPerPack maxOrderQuantity minOrderQuantity discountValue discountType discountStart discountEnd platformMarkupOverridePct packPlatformMarkupOverridePct',
    })
    .lean();
```

- [ ] **Step 2: Reprice and build lines in `getCart`**

Replace the tail of `getCart` (the `if (!cart) { ... }` block and the `return { ...cart, isEmpty }`) with:

```js
  if (!cart) {
    return { items: [], subtotal: 0, discountTotal: 0, estimatedTotal: 0, isEmpty: true };
  }

  // Reprice every line through the platform pipeline. A cart loaded a week
  // later must show today's price, not the price snapshotted at add time.
  const items = (cart.items || [])
    .map((item) => {
      if (!item.product || !item.subproduct || !item.subproduct.tenant || !item.size) return null;
      const pricing = calculateSizePricing(
        item.size,
        item.product,
        item.subproduct.tenant,
        item.subproduct.costPrice,
        item.subproduct.baseSellingPrice,
      );
      return buildCartLine(item, pricing);
    })
    .filter(Boolean);

  const subtotal = items.reduce((sum, line) => {
    const unit = line.packUnitPrice && line.packThreshold && line.quantity >= line.packThreshold
      ? line.packUnitPrice
      : line.price;
    return sum + unit * line.quantity;
  }, 0);

  return {
    items,
    subtotal,
    discountTotal: cart.discountTotal || 0,
    estimatedTotal: subtotal - (cart.discountTotal || 0),
    isEmpty: items.length === 0,
  };
```

Add the helper import at the top of the file, under the existing requires:

```js
const { buildCartLine, mergeCartLines } = require('../helpers/cart.helpers');
```

- [ ] **Step 3: Fix the stored price in `addToCart`**

In `addToCart`, the new-item branch currently reads `priceAtAddition: size.sellingPrice`. Replace that branch's price computation. Immediately before `const newItem = {`, insert:

```js
    // Store the PLATFORM price, not the raw tenant-facing size.sellingPrice.
    // getCart reprices on read anyway, but a correct value here keeps
    // Cart.subtotal and any consumer reading the raw document honest.
    const addPricing = calculateSizePricing(
      size, product, subProduct.tenant, subProduct.costPrice, subProduct.baseSellingPrice,
    );
```

and change the two fields in `newItem`:

```js
      priceAtAddition: addPricing.finalPrice,
      discountApplied: 0,
```

**Note:** `product.controller.js:1460` also calls `addToCart` and inherits this fix — that is intended.

- [ ] **Step 4: Verify nothing regressed**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -20`
Expected: `# fail 3` — the known baseline (1 pricelist populate, 2 SO-number). Any other failure must be fixed before continuing.

- [ ] **Step 5: Commit**

```bash
git add server/services/cart.service.js
git commit -m "fix(cart): reprice cart lines via calculateSizePricing instead of raw tenant price"
```

---

### Task 4: `mergeCart` service + merge and clear endpoints

**Files:**
- Modify: `server/services/cart.service.js`
- Modify: `server/controllers/cart.controller.js`
- Modify: `server/routes/cart.routes.js`

**Interfaces:**
- Consumes: `mergeCartLines` (Task 1), `getCart` (Task 3), existing `syncCart`, existing `clearCart`.
- Produces:
  - `mergeCart(userId, localItems) -> { cart, results }`
  - `POST /api/cart/merge` (protected), body `{ items }`, response `{ cart, results }`
  - `DELETE /api/cart` (protected), response `{ cart }`

- [ ] **Step 1: Add `mergeCart` to `server/services/cart.service.js`**

Insert above `module.exports`:

```js
/**
 * Merge the browser's cart into the stored cart on login.
 * Union keyed by cartItemId, HIGHER quantity wins (never the sum). Stock and
 * maxOrderQuantity clamping is inherited from syncCart, which re-validates
 * every line it writes.
 */
const mergeCart = async (userId, localItems) => {
  const stored = await getCart(userId);

  // Normalise the client payload to the same identity scheme getCart emits.
  const localLines = (localItems || [])
    .filter((item) => item.subProductId && item.sizeId && item.productId)
    .map((item) => ({
      cartItemId: buildCartItemId(
        String(item.productId), item.size || '', item.vendor || '', item.color || '',
      ),
      selectedProductId: String(item.productId),
      selectedSubProductId: String(item.subProductId),
      selectedSizeId: String(item.sizeId),
      selectedVendorId: item.tenantId ? String(item.tenantId) : null,
      quantity: item.quantity || 1,
    }));

  const merged = mergeCartLines(stored.items, localLines);

  // syncCart replaces the stored cart and re-validates stock per line.
  return syncCart(userId, merged.map((line) => ({
    productId:    line.selectedProductId,
    subProductId: line.selectedSubProductId,
    sizeId:       line.selectedSizeId,
    tenantId:     line.selectedVendorId,
    quantity:     line.quantity,
    price:        line.price,
  })));
};
```

Add `buildCartItemId` to the helper import from Task 3:

```js
const { buildCartItemId, buildCartLine, mergeCartLines } = require('../helpers/cart.helpers');
```

Add `mergeCart` to the `module.exports` object.

**Coverage note:** the spec asks for a "merged quantity is clamped to stock and `maxOrderQuantity`" test. That clamping lives in `syncCart`, which needs live Mongoose models, and this repo's cart tests are deliberately DB-free pure-function tests. It is therefore covered by **manual smoke step 9**, not a unit test. Do not add a DB-connecting test to `__tests__/` — it would break the suite's no-I/O convention.

- [ ] **Step 2: Add the controllers**

Append to `server/controllers/cart.controller.js`:

```js
/**
 * POST /api/cart/merge
 * Authenticated — merges the browser's guest cart into the stored cart on login.
 * Higher quantity wins per line; nothing is discarded.
 */
exports.mergeMyCart = async (req, res) => {
  try {
    const { items } = req.body;
    const { cart, results } = await cartService.mergeCart(req.user._id, items);
    return successResponse(res, { cart, results }, 'Cart merged');
  } catch (err) {
    return errorResponse(res, 'Failed to merge cart', 500, err);
  }
};

/**
 * DELETE /api/cart
 * Authenticated — empties the stored cart after a completed order.
 */
exports.clearMyCart = async (req, res) => {
  try {
    await cartService.clearCart(req.user._id);
    return successResponse(res, { cart: await cartService.getCart(req.user._id) }, 'Cart cleared');
  } catch (err) {
    return errorResponse(res, 'Failed to clear cart', 500, err);
  }
};
```

**Note:** the existing `clearCart` service throws `NotFoundError` when the user has no cart document. Guard it so clearing an already-empty cart is not an error — in `cart.service.js`, change the opening of `clearCart` from `if (!cart) { throw new NotFoundError('Cart not found'); }` to:

```js
  if (!cart) return { items: [], subtotal: 0, estimatedTotal: 0 };
```

- [ ] **Step 3: Wire the routes**

Replace the body of `server/routes/cart.routes.js`:

```js
'use strict';

const express = require('express');
const router  = express.Router();
const {
  getMyCart, saveCart, validateCart, mergeMyCart, clearMyCart,
} = require('../controllers/cart.controller');
const { protect } = require('../middleware/auth.middleware');

// Public — anonymous/guest carts validate too, no auth required.
router.post('/validate', validateCart);

router.get('/', protect, getMyCart);
router.post('/save', protect, saveCart);
router.post('/merge', protect, mergeMyCart);
router.delete('/', protect, clearMyCart);

module.exports = router;
```

- [ ] **Step 4: Verify the server boots and nothing regressed**

Run: `cd server && node -e "require('./routes/cart.routes'); console.log('routes ok')"`
Expected: `routes ok`

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -20`
Expected: `# fail 3` (baseline only)

- [ ] **Step 5: Commit**

```bash
git add server/services/cart.service.js server/controllers/cart.controller.js server/routes/cart.routes.js
git commit -m "feat(cart): add merge-on-login and clear endpoints"
```

---

### Task 5: Per-identity storage keys and auth-gated hydration

**Files:**
- Modify: `client/apps/platform/src/context/CartContext.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `@/context/AuthContext` — `{ user, isAuthenticated, isLoading }`. `CartProvider` already sits inside `AuthProvider` in `GlobalProvider.tsx`, so the hook resolves.
- Produces: `loadServerCart(): Promise<void>` that actually dispatches `LOAD_CART`.

- [ ] **Step 1: Replace the global storage key with per-identity keys**

Replace `const STORAGE_KEY = 'drinksharbour_cart';` with:

```ts
const STORAGE_PREFIX = 'drinksharbour_cart';
const LEGACY_STORAGE_KEY = 'drinksharbour_cart';

/** Per-identity storage key. A shared browser must never show user A's cart to user B. */
const storageKeyFor = (userId: string | null): string =>
  `${STORAGE_PREFIX}:${userId || 'guest'}`;

const readStoredCart = (key: string): CartItem[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.cartArray)) return [];
    if (isCartExpired(parsed.savedAt || 0)) {
      localStorage.removeItem(key);
      return [];
    }
    return parsed.cartArray;
  } catch {
    return [];
  }
};

const writeStoredCart = (key: string, cartArray: CartItem[]): void => {
  try {
    localStorage.setItem(key, JSON.stringify({
      cartArray, savedAt: Date.now(), expiryDays: CART_EXPIRY_DAYS,
    }));
  } catch { /* quota — the DB copy is the durable one */ }
};
```

- [ ] **Step 2: Track the active identity inside the provider**

At the top of `CartProvider`, under the `useReducer` call:

```ts
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const userId = isAuthenticated ? (user?._id ?? null) : null;

  const storageKey = storageKeyFor(userId);
  // Blocks the auto-save effect until this identity's cart has been loaded.
  // Without it the reducer's initial [] is saved over the stored cart on first paint.
  const hydratedForRef = React.useRef<string | null>(null);
```

Add `useAuth` to the imports:

```ts
import { useAuth } from "@/context/AuthContext";
```

- [ ] **Step 3: Replace the mount-time load effect**

Replace the first `useEffect` (the one reading `localStorage.getItem(STORAGE_KEY)`) with:

```ts
  // One-time migration off the old global key into the guest key. Without this
  // an existing shopper's cart appears to vanish on deploy.
  useEffect(() => {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return;
    if (!localStorage.getItem(storageKeyFor(null))) {
      localStorage.setItem(storageKeyFor(null), legacy);
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, []);

  // Hydrate whenever the identity resolves or changes. Nothing reads or writes
  // while auth is still resolving — a save fired then would clobber the DB cart.
  useEffect(() => {
    if (authLoading) return;
    if (hydratedForRef.current === storageKey) return;

    let cancelled = false;

    const hydrate = async () => {
      if (!userId) {
        dispatch({ type: "LOAD_CART", payload: readStoredCart(storageKey) });
        hydratedForRef.current = storageKey;
        return;
      }

      const guestItems = readStoredCart(storageKeyFor(null));

      try {
        const res = guestItems.length > 0
          ? await fetchWithAuth(`${API_URL}/api/cart/merge`, {
              method: 'POST',
              body: JSON.stringify({ items: toServerItems(guestItems) }),
            })
          : await fetchWithAuth(`${API_URL}/api/cart`);

        const data = await res.json();
        if (cancelled) return;

        if (res.ok && data.success) {
          const lines: CartItem[] = data.data?.cart?.items ?? [];
          dispatch({ type: "LOAD_CART", payload: lines });
          writeStoredCart(storageKey, lines);
          // Guest cart is now folded in — drop it so it can't merge twice.
          localStorage.removeItem(storageKeyFor(null));
        } else {
          dispatch({ type: "LOAD_CART", payload: readStoredCart(storageKey) });
        }
      } catch {
        // Offline — fall back to this user's mirror. The guest cart is KEPT so
        // nothing is lost; the next successful hydrate merges it.
        if (!cancelled) dispatch({ type: "LOAD_CART", payload: readStoredCart(storageKey) });
      } finally {
        if (!cancelled) hydratedForRef.current = storageKey;
      }
    };

    hydrate();
    return () => { cancelled = true; };
  }, [authLoading, storageKey, userId]);
```

- [ ] **Step 4: Add the client→server item mapper**

Above `CartProvider`, add:

```ts
/** Client cart line → the payload shape /api/cart/save and /merge expect. */
const toServerItems = (items: CartItem[]) =>
  items
    .filter((item) => item.selectedSubProductId && item.selectedSizeId)
    .map((item) => ({
      productId:    item.selectedProductId || item._id || item.id,
      subProductId: item.selectedSubProductId,
      sizeId:       item.selectedSizeId,
      tenantId:     item.selectedVendorId,
      size:         item.selectedSize,
      vendor:       item.selectedVendor,
      color:        item.selectedColor,
      quantity:     item.quantity || 1,
      price:        item.price,
    }));
```

- [ ] **Step 5: Fix `loadServerCart` to actually apply the response**

Replace the whole `loadServerCart` function with:

```ts
  const loadServerCart = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/cart`);
      const data = await res.json();
      if (!res.ok || !data.success) return;
      const lines: CartItem[] = data.data?.cart?.items ?? [];
      dispatch({ type: "LOAD_CART", payload: lines });
      writeStoredCart(storageKeyFor(userId), lines);
    } catch { /* keep whatever is on screen */ }
  }, [userId]);
```

- [ ] **Step 6: Point the remaining `STORAGE_KEY` references at the active key**

Four sites still reference the removed `STORAGE_KEY`:

1. **`addToCart`** — delete the entire "Also directly save to localStorage" block (the `const currentCart = JSON.parse(...)` through the `localStorage.setItem(...)` call). The mirror effect in Task 6 covers it, and this duplicated write is what made the reducer and localStorage drift out of sync.
2. **`clearCart`** — handled in Task 7.
3. **`refreshCart`** — replace its body with `dispatch({ type: "LOAD_CART", payload: readStoredCart(storageKey) });`
4. **The storage/`cart-updated` listener effect** — it must react to the active key and re-run when the identity changes:

```ts
  useEffect(() => {
    const applyStored = () => {
      if (hydratedForRef.current !== storageKey) return;
      dispatch({ type: "LOAD_CART", payload: readStoredCart(storageKey) });
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) applyStored();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('cart-updated', applyStored);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('cart-updated', applyStored);
    };
  }, [storageKey]);
```

The old `isProcessing` re-entrancy flag is no longer needed — `LOAD_CART` already no-ops when the incoming array matches current state.

- [ ] **Step 7: Verify it compiles**

Run: `cd client/apps/platform && npx tsc --noEmit 2>&1 | grep -v '.next/' | tail -20`
Expected: no new errors in `src/context/CartContext.tsx`. Platform baseline is 22 pre-existing `src` errors — compare against that count, ignore `.next/**`.

- [ ] **Step 8: Commit**

```bash
git add client/apps/platform/src/context/CartContext.tsx
git commit -m "fix(cart): per-user storage keys and working server cart hydration"
```

---

### Task 6: Debounced auto-save

**Files:**
- Modify: `client/apps/platform/src/context/CartContext.tsx`

**Interfaces:**
- Consumes: `toServerItems`, `storageKey`, `hydratedForRef`, `userId` (Task 5).
- Produces: `syncCartToServer(): Promise<boolean>` gated on `isAuthenticated`, not on `localStorage.dh_token`.

- [ ] **Step 1: Replace `syncCartToServer`**

The current implementation returns `false` immediately for every cookie-session user because it gates on a `dh_token` that no longer exists. Replace it entirely:

```ts
  const syncCartToServer = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/cart/save`, {
        method: 'POST',
        body: JSON.stringify({ items: toServerItems(cartState.cartArray) }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [userId, cartState.cartArray]);
```

- [ ] **Step 2: Add the mirror + debounced save effect**

Add after the hydration effect:

```ts
  // Mirror to localStorage immediately (cheap, synchronous, survives reload),
  // then push to the DB on a debounce so a burst of +/- clicks is one request.
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Never write for an identity that hasn't finished hydrating — the reducer
    // starts at [] and would otherwise erase the stored cart on first paint.
    if (authLoading || hydratedForRef.current !== storageKey) return;

    writeStoredCart(storageKey, cartState.cartArray);
    if (!userId) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { syncCartToServer(); }, 800);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [cartState.cartArray, storageKey, userId, authLoading, syncCartToServer]);

  // Flush a pending save when the tab goes away — closing a laptop must not
  // lose the last 800ms of edits.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== 'hidden') return;
      if (!userId || hydratedForRef.current !== storageKey) return;
      if (!saveTimerRef.current) return;
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      syncCartToServer();
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, [userId, storageKey, syncCartToServer]);
```

- [ ] **Step 3: Delete the now-duplicate mirror effect**

The original `useEffect` that wrote `JSON.stringify({ cartArray, savedAt, expiryDays })` to `STORAGE_KEY` on every change is superseded by the effect above. Remove it — leaving it writes the unhydrated `[]` and reintroduces the clobber bug.

- [ ] **Step 4: Verify it compiles**

Run: `cd client/apps/platform && npx tsc --noEmit 2>&1 | grep -v '.next/' | tail -20`
Expected: no new errors versus the 22-error baseline.

- [ ] **Step 5: Commit**

```bash
git add client/apps/platform/src/context/CartContext.tsx
git commit -m "feat(cart): debounced auto-save to the server cart with tab-hide flush"
```

---

### Task 7: Logout clears the local cart

**Files:**
- Modify: `client/apps/platform/src/context/CartContext.tsx`

**Interfaces:**
- Consumes: `userId`, `storageKey`, `hydratedForRef` (Task 5).
- Produces: no new exports. `clearCart()` gains a server-side counterpart used by Task 8.

- [ ] **Step 1: Drop the previous user's cart on identity change**

Add after the hydration effect:

```ts
  // Wipe in-memory state the instant the identity changes, so the previous
  // user's lines never flash on screen for the next person on a shared browser.
  const previousUserIdRef = React.useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (authLoading) return;
    const previous = previousUserIdRef.current;
    previousUserIdRef.current = userId;
    if (previous === undefined || previous === userId) return;

    // Logging out: forget the account cart locally. It stays safe in the DB.
    if (previous && !userId) {
      localStorage.removeItem(storageKeyFor(previous));
    }
    dispatch({ type: "CLEAR_CART" });
    hydratedForRef.current = null;   // force a re-hydrate for the new identity
  }, [userId, authLoading]);
```

- [ ] **Step 2: Make `clearCart` clear the right key**

Replace `clearCart` with:

```ts
  const clearCart = useCallback(() => {
    dispatch({ type: "CLEAR_CART" });
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  /** Empties the stored cart too — call after an order is placed. */
  const clearCartEverywhere = useCallback(async () => {
    clearCart();
    if (!userId) return;
    try {
      await fetchWithAuth(`${API_URL}/api/cart`, { method: 'DELETE' });
    } catch { /* the next save overwrites it anyway */ }
  }, [clearCart, userId]);
```

Add `clearCartEverywhere: () => Promise<void>;` to `CartContextProps` and to the provider's `value` object.

- [ ] **Step 3: Verify it compiles**

Run: `cd client/apps/platform && npx tsc --noEmit 2>&1 | grep -v '.next/' | tail -20`
Expected: no new errors versus the 22-error baseline.

- [ ] **Step 4: Commit**

```bash
git add client/apps/platform/src/context/CartContext.tsx
git commit -m "feat(cart): clear the local cart on logout so it cannot leak between users"
```

---

### Task 8: Clear the server cart after a completed order

**Files:**
- Modify: `client/apps/platform/src/app/checkout/page.tsx` (destructure at line 104; `clearCart()` calls at lines 499, 567, 610, 639)
- Modify: `client/apps/platform/src/app/payment/verify/page.tsx` (`clearCart()` at line 195)

**Interfaces:**
- Consumes: `clearCartEverywhere` (Task 7).
- Produces: nothing.

- [ ] **Step 1: Swap the post-order clears**

In `checkout/page.tsx` line 104, add `clearCartEverywhere` to the destructure:

```ts
  const { cartState, clearCart, clearCartEverywhere, syncCartToServer, loadServerCart, validateCartItems, applyValidationUpdates, validationMap } = useCart();
```

Replace each **post-order-success** `clearCart();` (lines 499, 567, 610, 639) with `clearCartEverywhere();`. Leave any `clearCart()` used on an error/abort path as-is — a failed payment must not empty the stored cart.

In `payment/verify/page.tsx` line 195, apply the same swap; that path only runs after a verified payment.

- [ ] **Step 2: Remove the now-redundant pre-payment sync**

`checkout/page.tsx:550` calls `await syncCartToServer()` immediately before payment init. The debounced save from Task 6 already keeps the DB current, but this explicit flush is a useful guarantee at the moment of payment — **keep it**. It now actually works, since Task 6 removed the dead `dh_token` gate.

- [ ] **Step 3: Verify it compiles**

Run: `cd client/apps/platform && npx tsc --noEmit 2>&1 | grep -v '.next/' | tail -20`
Expected: no new errors versus the 22-error baseline.

- [ ] **Step 4: Full server test sweep**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -20`
Expected: `# fail 3` — baseline only.

- [ ] **Step 5: Commit**

```bash
git add client/apps/platform/src/app/checkout/page.tsx client/apps/platform/src/app/payment/verify/page.tsx
git commit -m "feat(cart): clear the stored cart after a completed order"
```

---

## Manual Smoke Test

Automated tests cover the pure logic; the identity transitions need a browser. Backend runs locally on `:5001`, platform dev on `:3002`.

1. Logged out, add 2 bottles. Reload — cart survives (guest key).
2. Log in. Cart merges, still 2 bottles. Check MongoDB: `db.carts.findOne({user: ObjectId('<id>')})` has the line.
3. Change quantity to 5. Wait ~1s. Reload — 5 persists.
4. Log out. **Cart is empty.** `localStorage` has no `drinksharbour_cart:<userId>` key.
5. Log in as a different user. That user's own cart appears, not the first user's.
6. Log back in as user 1 — 5 bottles are back.
7. Add 3 of a product in a private window while logged in as user 1, having 5 of the same product in the normal window. Log in. Line shows **5**, not 8.
8. Place an order. Cart empties in the UI and `db.carts` shows `items: []`.
9. **Stock clamp (covers the merge case unit tests can't reach):** find a size with low stock — `db.sizes.findOne({stock: {$gt: 0, $lt: 5}})`. Put more than that stock in the guest cart, then log in. The merged line is capped at available stock, and `results.errors` in the `/api/cart/merge` response names the line.
