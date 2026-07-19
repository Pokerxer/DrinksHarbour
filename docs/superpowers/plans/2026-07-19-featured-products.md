# Featured Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin "Featured Product" toggle actually persist and surface admin-curated featured products in a homepage section, falling back to bestsellers when nothing is flagged.

**Architecture:** One-line schema fix declares the missing `isFeatured` field (the admin form, request handler, and service already write to it). The dedicated `/api/products/featured` service is reworked to prefer flagged products and fill the remainder with its existing bestseller logic, using a pure, unit-tested merge helper. The already-built `FeaturedProducts` client section is given a server-seed prop (mirroring `FeaturedDeals`) and mounted on the homepage after Hot Deals.

**Tech Stack:** Node.js + Mongoose (server), Next.js App Router + React + framer-motion (platform client). Server tests: `node:test` via `npm test` (`node --test __tests__/`), no live DB — models tested via `new Model()`, logic tested via pure helpers/DI fakes. Client: no test runner; gate is `npx tsc --noEmit`.

## Global Constraints

- Server tests must run WITHOUT a live database connection (Atlas blocks the local IP). Test Mongoose models with `new Model()` + default/`validateSync()` checks; test logic by extracting pure helpers. Never write a server test that opens a DB connection.
- New server helper files follow the `*.helpers.js` naming convention in `server/services/`.
- Only super-admins may set `isFeatured` — the existing service guard at `product.service.js` (`if (isFeatured !== undefined && isSuperAdmin)`) MUST remain unchanged.
- Homepage below-the-fold sections are `dynamic()`-imported and, when SEO-critical, server-seeded via `initialProducts`. Follow that existing pattern.
- Currency and copy: the section renders Naira (`₦`) — do not alter existing component visuals.

---

### Task 1: Declare `isFeatured` on the Product schema

**Files:**
- Modify: `server/models/Product.js` (PLATFORM / APPROVAL WORKFLOW block, immediately after the `isPublished` field ~line 670-674)
- Test: `server/__tests__/product.isFeatured.model.test.js`

**Interfaces:**
- Produces: `Product` documents now have a persisted boolean `isFeatured` (default `false`). Task 2 relies on `isFeatured` being a real, queryable field.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/product.isFeatured.model.test.js`:

```js
// server/__tests__/product.isFeatured.model.test.js
const test = require('node:test');
const assert = require('node:assert');
const Product = require('../models/Product');

test('Product defaults isFeatured to false', () => {
  const doc = new Product({ name: 'Test', slug: 'test', type: 'wine' });
  assert.strictEqual(doc.isFeatured, false);
});

test('Product accepts isFeatured = true and keeps it', () => {
  const doc = new Product({ name: 'Test', slug: 'test', type: 'wine', isFeatured: true });
  assert.strictEqual(doc.isFeatured, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/product.isFeatured.model.test.js`
Expected: FAIL — second test's `doc.isFeatured` is `undefined` (schema strips the unknown field), so `assert.strictEqual(undefined, true)` throws. (First test may also show `undefined` rather than `false`.)

- [ ] **Step 3: Add the schema field**

In `server/models/Product.js`, in the PLATFORM / APPROVAL WORKFLOW section, directly after the `isPublished` block, add:

```js
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test __tests__/product.isFeatured.model.test.js`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add server/models/Product.js server/__tests__/product.isFeatured.model.test.js
git commit -m "fix(products): declare isFeatured on Product schema so admin toggle persists

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Featured-first selection with bestseller fallback

**Files:**
- Create: `server/services/featured.helpers.js`
- Test: `server/__tests__/featured.helpers.test.js`
- Modify: `server/services/product.service.js` (`getFeaturedProducts`)

**Interfaces:**
- Produces: `mergeFeaturedWithFallback(featured, fallback, limit)` → `Array` — returns `featured` docs first, then `fallback` docs, de-duplicated by `_id` (string-compared), capped at `limit`. Consumed only inside `getFeaturedProducts`.
- Consumes: `Product.isFeatured` (Task 1).

- [ ] **Step 1: Write the failing test for the merge helper**

Create `server/__tests__/featured.helpers.test.js`:

```js
// server/__tests__/featured.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const { mergeFeaturedWithFallback } = require('../services/featured.helpers');

const p = (id) => ({ _id: id, name: `p${id}` });

test('featured products come first, then fallback fills the rest', () => {
  const out = mergeFeaturedWithFallback([p('a'), p('b')], [p('c'), p('d')], 4);
  assert.deepStrictEqual(out.map((x) => x._id), ['a', 'b', 'c', 'd']);
});

test('caps the result at limit', () => {
  const out = mergeFeaturedWithFallback([p('a'), p('b')], [p('c'), p('d')], 3);
  assert.deepStrictEqual(out.map((x) => x._id), ['a', 'b', 'c']);
});

test('de-duplicates by _id, keeping the featured copy', () => {
  const out = mergeFeaturedWithFallback([p('a')], [p('a'), p('b')], 5);
  assert.deepStrictEqual(out.map((x) => x._id), ['a', 'b']);
});

test('handles ObjectId-like _id via toString', () => {
  const oid = (v) => ({ _id: { toString: () => v }, name: v });
  const out = mergeFeaturedWithFallback([oid('a')], [oid('a'), oid('b')], 5);
  assert.deepStrictEqual(out.map((x) => x._id.toString()), ['a', 'b']);
});

test('empty featured returns fallback up to limit', () => {
  const out = mergeFeaturedWithFallback([], [p('c'), p('d'), p('e')], 2);
  assert.deepStrictEqual(out.map((x) => x._id), ['c', 'd']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test __tests__/featured.helpers.test.js`
Expected: FAIL — `Cannot find module '../services/featured.helpers'`.

- [ ] **Step 3: Implement the helper**

Create `server/services/featured.helpers.js`:

```js
// server/services/featured.helpers.js

/**
 * Merge admin-flagged featured products with a bestseller fallback list.
 * Featured docs come first, fallback fills the remainder, de-duplicated by
 * _id (string-compared), capped at `limit`.
 *
 * @param {Array<{_id: any}>} featured
 * @param {Array<{_id: any}>} fallback
 * @param {number} limit
 * @returns {Array}
 */
function mergeFeaturedWithFallback(featured = [], fallback = [], limit = 12) {
  const out = [];
  const seen = new Set();
  for (const doc of [...featured, ...fallback]) {
    if (out.length >= limit) break;
    const key = doc && doc._id != null ? String(doc._id) : null;
    if (key === null || seen.has(key)) continue;
    seen.add(key);
    out.push(doc);
  }
  return out;
}

module.exports = { mergeFeaturedWithFallback };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test __tests__/featured.helpers.test.js`
Expected: PASS (all five tests).

- [ ] **Step 5: Wire the helper into `getFeaturedProducts`**

In `server/services/product.service.js`, add the require near the other service/helper requires at the top of the file:

```js
const { mergeFeaturedWithFallback } = require('./featured.helpers');
```

Then refactor `getFeaturedProducts` so the aggregation pipeline is built by a local
helper and run first for featured products, then (only if short) for the bestseller
fallback. Replace the existing `const products = await Product.aggregate([ ... ]);` block —
keep every existing stage — by moving the pipeline into a builder that takes the `$match`
filter and an `excludeIds` list:

```js
  // Build the availability pipeline for a given top-level match filter.
  // `extraMatch` lets the fallback pass exclude already-selected featured ids.
  const buildPipeline = (matchFilter, take) => [
    { $match: matchFilter },

    // Lookup active SubProducts
    {
      $lookup: {
        from: 'subproducts',
        let: { productId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$product', '$$productId'] },
                  { $in: ['$status', ['active', 'low_stock', 'out_of_stock']] },
                ],
              },
            },
          },
          {
            $lookup: {
              from: 'tenants',
              localField: 'tenant',
              foreignField: '_id',
              as: 'tenant',
            },
          },
          { $unwind: '$tenant' },
          {
            $match: {
              'tenant.status': 'approved',
              'tenant.subscriptionStatus': { $in: ['active', 'trialing'] },
            },
          },
          {
            $lookup: {
              from: 'sizes',
              localField: '_id',
              foreignField: 'subproduct',
              as: 'sizes',
              pipeline: [
                {
                  $match: {
                    availability: { $in: ['available', 'low_stock'] },
                    stock: { $gt: 0 },
                  },
                },
              ],
            },
          },
        ],
        as: 'subProducts',
      },
    },

    // Only products with availability
    { $match: { $expr: { $gt: [{ $size: '$subProducts' }, 0] } } },

    // Populate relations
    {
      $lookup: {
        from: 'brands',
        localField: 'brand',
        foreignField: '_id',
        as: 'brand',
      },
    },
    { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },

    // Sort by tenantCount (most available) and recent
    { $sort: { tenantCount: -1, createdAt: -1 } },

    { $limit: take },
  ];

  // Pass 1: admin-flagged featured products.
  const featuredRaw = await Product.aggregate(
    buildPipeline(
      { status: 'approved', isPublished: true, isFeatured: true },
      limitNum
    )
  );

  // Pass 2: bestseller fallback for any remaining slots, excluding pass-1 ids.
  let fallbackRaw = [];
  if (featuredRaw.length < limitNum) {
    const excludeIds = featuredRaw.map((p) => p._id);
    fallbackRaw = await Product.aggregate(
      buildPipeline(
        { status: 'approved', isPublished: true, _id: { $nin: excludeIds } },
        limitNum - featuredRaw.length
      )
    );
  }

  const products = mergeFeaturedWithFallback(featuredRaw, fallbackRaw, limitNum);
```

Leave everything after this (the `total`, `tenantIds`, `tenantMap`, `ratings`, `sales`,
`processedProducts`, and the final `return`) exactly as it is — it already operates on the
`products` array. Note: pagination `skip` is no longer applied to the pipeline; featured is
a single top-of-list section, so drop the `{ $skip: skip }` stage (it was previously the
only consumer of `skip`; leaving `skip` computed but unused is harmless, but you may remove
the `const skip = ...` line to avoid a lint warning).

- [ ] **Step 6: Verify the full server test suite still passes**

Run: `cd server && npm test`
Expected: PASS — the two new test files pass; no previously-passing tests regress. (Pre-existing unrelated failures noted in project memory, if any, remain unchanged.)

- [ ] **Step 7: Commit**

```bash
git add server/services/featured.helpers.js server/__tests__/featured.helpers.test.js server/services/product.service.js
git commit -m "feat(products): featured-first selection with bestseller fallback for /featured

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Server-seed prop on the `FeaturedProducts` section

**Files:**
- Modify: `client/apps/platform/src/components/Home1/FeaturedProducts.tsx`

**Interfaces:**
- Produces: `FeaturedProductsProps` gains `initialProducts?: ApiProduct[]`. When provided and non-empty, the component seeds `products` from it and skips the initial client fetch. Task 4 passes server-fetched products into this prop.
- Consumes: existing `ApiProduct` interface and `mapApiProductToProduct` (already in the file).

- [ ] **Step 1: Add `initialProducts` to the props interface**

In `client/apps/platform/src/components/Home1/FeaturedProducts.tsx`, extend the props
interface (currently ~line 91):

```tsx
interface FeaturedProductsProps {
  limit?: number;
  title?: string;
  subtitle?: string;
  // Products fetched on the server so the cards + /product links are present in
  // the raw HTML (crawlable). Seeds state and skips the initial client fetch.
  initialProducts?: ApiProduct[];
}
```

- [ ] **Step 2: Seed state from `initialProducts` and skip the seeded fetch**

Change the component signature to accept `initialProducts`, and update the state init +
effect. Replace the destructured params and the `products`/`loading` state + the
`useEffect` that calls `fetchFeaturedProducts` with:

```tsx
const FeaturedProducts: React.FC<FeaturedProductsProps> = ({
  limit = 8,
  title = "Featured Products",
  subtitle = "Handpicked selections from our premium collection",
  initialProducts,
}) => {
  const seeded = (initialProducts?.length ?? 0) > 0;
```

Then update the two state declarations:

```tsx
  const [products, setProducts] = useState<Product[]>(
    seeded ? initialProducts!.map(mapApiProductToProduct) : []
  );
  const [loading, setLoading] = useState(!seeded);
```

And update the effect so it does not refetch when seeded:

```tsx
  useEffect(() => {
    if (seeded) return;
    fetchFeaturedProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);
```

(Leave `fetchFeaturedProducts` and the rest of the component unchanged — it remains the
fallback path when the component is used without a server seed.)

- [ ] **Step 3: Type-check the platform app**

Run: `cd client/apps/platform && npx tsc --noEmit`
Expected: PASS — no new type errors introduced by this file. (If the project has a large
pre-existing error baseline, confirm no NEW errors reference `FeaturedProducts.tsx`.)

- [ ] **Step 4: Commit**

```bash
git add client/apps/platform/src/components/Home1/FeaturedProducts.tsx
git commit -m "feat(home): allow FeaturedProducts to be server-seeded via initialProducts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Mount Featured Products on the homepage after Hot Deals

**Files:**
- Modify: `client/apps/platform/src/app/page.tsx`

**Interfaces:**
- Consumes: `FeaturedProducts` (Task 3, `initialProducts` prop); `GET /api/products?isFeatured=true` (Task 1) and `GET /api/products/featured` (Task 2).

- [ ] **Step 1: Add the dynamic import**

In `client/apps/platform/src/app/page.tsx`, alongside the other below-fold dynamic
imports (near the `FeaturedDeals` import ~line 14), add:

```tsx
const FeaturedProducts = dynamic(
  () => import("@/components/Home1/FeaturedProducts")
);
```

- [ ] **Step 2: Add the server fetch helper**

After the existing `fetchFeaturedDeals` function (~line 57), add:

```tsx
// Server-side fetch of admin-curated featured products so the cards + /product
// links ship in the raw HTML. Prefers ?isFeatured=true; falls back to the
// /featured endpoint (bestsellers) so the section is never empty.
async function fetchFeaturedProducts(limit = 8): Promise<any[]> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
  if (!API_URL) return [];
  const parse = (data: any): any[] => {
    if (data?.success && data?.data?.products) return data.data.products;
    if (Array.isArray(data?.products)) return data.products;
    if (Array.isArray(data)) return data;
    return [];
  };
  try {
    const res = await fetch(
      `${API_URL}/api/products?isFeatured=true&limit=${limit}`,
      { next: { revalidate: 300 } }
    );
    const flagged = res.ok ? parse(await res.json()) : [];
    if (flagged.length > 0) return flagged;
    const fb = await fetch(`${API_URL}/api/products/featured?limit=${limit}`, {
      next: { revalidate: 300 },
    });
    return fb.ok ? parse(await fb.json()) : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 3: Add the fetch to the parallel `Promise.all`**

Change the existing `Promise.all` in `Home()` (~line 61) to include featured:

```tsx
  const [featuredDeals, recommended, featured] = await Promise.all([
    fetchFeaturedDeals(12),
    fetchInitialRecommendations(12),
    fetchFeaturedProducts(8),
  ]);
```

- [ ] **Step 4: Mount the section after Hot Deals**

Immediately after the Hot Deals `</section>` (the block containing `<FeaturedDeals ... />`,
~line 100) and before the `home_secondary` `PlacementBanner` `LazySection`, insert:

```tsx
        {/* Featured Products — admin-curated, server-seeded (bestseller fallback) */}
        <section className="py-4 bg-white">
          <div className="container mx-auto px-3">
            <FeaturedProducts limit={8} initialProducts={featured} />
          </div>
        </section>
```

- [ ] **Step 5: Type-check the platform app**

Run: `cd client/apps/platform && npx tsc --noEmit`
Expected: PASS — no new type errors referencing `page.tsx` or `FeaturedProducts`.

- [ ] **Step 6: Commit**

```bash
git add client/apps/platform/src/app/page.tsx
git commit -m "feat(home): mount Featured Products section after Hot Deals

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Manual verification

**Files:** none (verification only).

- [ ] **Step 1: Confirm the admin toggle persists**

Start the server and admin app. Edit a product, tick "Featured Product" (SEO/Settings tab,
`product-seo.tsx`), save as a super-admin. Reload the edit page and confirm the checkbox is
still ticked. (Root-cause check: before Task 1 this silently reset to unchecked.)

- [ ] **Step 2: Confirm featured products surface on the homepage**

Load the homepage. Confirm a "Featured Products" section renders **after Hot Deals** and
before the promotional strip. With at least one flagged product, confirm it appears; with
none flagged, confirm the section still shows bestsellers (fallback) rather than being
empty.

- [ ] **Step 3: Confirm SEO seeding**

View page source (server HTML) and confirm featured product `/product/<slug>` links are
present in the raw HTML (not only after client hydration).

- [ ] **Step 4: Note results**

Record pass/fail for each step. If the server cannot reach Atlas from the local IP (known
constraint), note that the manual DB-backed checks were deferred to an environment with DB
access, and that Tasks 1–4 code changes and unit tests passed.

---

## Self-Review

**Spec coverage:**
- Schema fix (root cause) → Task 1. ✓
- `getFeaturedProducts` featured-first + bestseller fallback → Task 2. ✓
- `FeaturedProducts` `initialProducts` seed prop → Task 3. ✓
- `page.tsx` server fetch (isFeatured → /featured fallback) + mount after Hot Deals → Task 4. ✓
- Testing: server unit tests (model default + merge helper: featured-first, fallback-fill, dedup, cap) → Tasks 1–2; manual admin-persist + homepage checks → Task 5. ✓
- Non-goals respected: no new admin UI, no new endpoints, super-admin guard untouched (Global Constraints). ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. ✓

**Type consistency:** `mergeFeaturedWithFallback(featured, fallback, limit)` defined in Task 2 and called with the same signature in the service; `initialProducts?: ApiProduct[]` defined in Task 3 and passed a server array in Task 4; `FeaturedProducts` dynamic import name matches usage. ✓
