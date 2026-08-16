# RESUME — POS /sell only ever shows 200 products

**Status:** DONE, 2026-08-16. Uncommitted. Not yet seen in a browser — see
"Left to do" for the one thing a person still has to check.
**Found:** 2026-08-16, while fixing POS images.

---

## Symptom

`/pos/sell` shows 200 products. The tenant has **955** sub-products with
`visibleInPOS: true` and a non-excluded status (measured against Atlas, not
estimated).

## Root cause

`server/controllers/pos.controller.js` — `getPOSProducts` defaulted to
`limit = 200` and applied it as `.limit(Number(limit))`. Nothing above it ever
raised that number: `offline/api.ts` calls `posApi.getProducts(token, {shopId,
warehouseId})` with no `limit`, and `api.ts` only sets the param when one is
passed. **The default was the cap.**

Worse than a short list: the grid fetches once and then filters, searches and
selects categories in memory — it has to, because an installed POS must keep
selling with no network. So the cap silently truncated *search*. A cashier
typing a name that sorts 600th got "No results", indistinguishable from the
product not existing. The sort is `isFeaturedByTenant, totalSold,
availableStock` descending, so what vanished was the slow-moving tail — exactly
the stock nobody can recall and therefore has to look up.

---

## What was done

**Fetch the whole catalogue**, with an explicit ceiling instead of a silent
default. Server-side search/pagination was rejected: it makes every keystroke a
round trip and breaks the offline PWA, which has no server to ask.

### Server — `pos.controller.js`

- `POS_CATALOGUE_CAP = 5000` (the ceiling `/sub-products` already uses),
  replacing the `limit = 200` default. An absent, non-numeric or non-positive
  `limit` now means *the whole catalogue*, never `.limit(NaN)` and never zero.
- The query asks for `effectiveLimit + 1` rows, so **truncation is a fact, not
  a guess** — a result exactly `effectiveLimit` long is otherwise
  indistinguishable from a catalogue that happens to be that size.
- When it does truncate it says so: a `console.warn` on the server and
  `truncated` + `limit` on the response body.

### Client

- `api.ts` — `getProducts` types `limit`/`truncated`; a comment records that
  sending no limit is deliberate.
- `offline/api.ts` — `console.warn` when the server reports truncation.
- `pos-order-analysis.tsx` — dropped its explicit `limit: 500`, which was the
  same silent cap on the purchases-analytics attribution map.
- **`components/pos-product-window.ts` (new)** — `filterPOSProducts` (the
  in-memory search, lifted out of the grid's `useMemo` so it is testable
  without jsdom) and `productRenderWindow`.
- `pos-product-grid.tsx` — mounts `PRODUCT_RENDER_STEP` (60) cards with a
  "Show N more" button, **after** filtering. See "the second cap" below.

### The second cap this created

Fetching everything meant the grid would mount 955 `POSProductCard`s where it
used to mount 200. That card is neither memoised nor virtualised and calls
`usePOSCart()`, so **every card re-renders on every cart change** — 5x the
work, on till hardware, on every tap. Hence the render window.

The window is applied to the *filtered* list, never before it. Windowing first
would recreate the original bug at a cap of 60 instead of 200, and it would
look identical from the cashier's side. `pos-product-window.test.ts` pins that
ordering.

---

## What the four pre-flight checks actually found

Measured on 2026-08-16 against Atlas, tenant Wyn City (955 rows).

1. **Payload size — fine.** 955 rows = **1.33 MB raw, 133 KB gzipped**
   (`compression()` is on in `app.js`), ~1.4 KB/row. The projection was left
   alone: `product.images` is 223 KB of it, but the offline mirror stores the
   resolved gallery and trimming it to a thumbnail would cost the tile its own
   photo. 5000 rows would be ~7 MB raw / ~700 KB gzipped — the reason a cap
   still exists.
2. **The pricing pipeline — O(n) but pure.** `computePOSPricing` does no I/O;
   the whole enrichment is arithmetic over the array. Row count does not add
   queries: the populate paths are 5 fixed round trips regardless of n.
3. **ETag — safe.** There is no hand-rolled ETag despite the docstring saying
   "with ETag caching"; Express derives a weak one from the body, so it changes
   when the row count does. No 304 can hand back a 200-row body. The handler
   *does* override the global `/api` `no-store` with `private, max-age=60`, so
   a terminal can hold a stale catalogue for up to a minute after this deploys.
   That is a minute, not a bug — but it is the reason the fix "seems not to
   work" for the first minute.
4. **Dexie / Cache API — fine.** One `bulkPut` of 955 flat records. The image
   warm-up loop is sequential and `cache.match`-deduped, so it is slower, not a
   stampede; only 530 of the 955 have an image at all, and many share the
   parent product's URL.

Query timing is NOT a useful number from this machine: the same query took
30s, 15s and 9.9s on three consecutive runs over a home link to Atlas (4.5s
without the populates). It is transfer- and latency-bound here; measure it from
the deployed backend if it ever matters.

---

## Verify

```bash
cd server && node --test '__tests__/*.test.js'
cd client/apps/admin && npx vitest run
cd client/apps/admin && ./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep -v "\.next/" | wc -l
```

Results on 2026-08-16 after this change:

- server **2032/2035** — the 3 known pre-existing failures (1 pricelist
  tenant-scope, 2 SO-number), unchanged.
- admin vitest **787/787** (was 780; +7 from `pos-product-window.test.ts`).
- admin tsc **531**, and **531 with these changes stashed** — the error sets are
  identical bar line-number shifts. The "453" baseline in older notes is stale
  on this branch: 51 of the 531 are `TS2786 'X cannot be used as a JSX
  component'`, the duplicate-`@types/react` signature of the mobile app joining
  the workspace.

`npm run build` also passes (exit 0, 3.1 min, 148 static pages) — but it is
**not** a lint or type gate whatever older notes say: it prints "Skipping
validation of types / Skipping linting". `tsc --noEmit` is the real one.

### The regression tests

`server/__tests__/posProductCatalogueLimit.test.js` drives the real handler
against a stubbed `SubProduct.find` and asserts on the response body, because a
cap degrades to a shorter list rather than to an error — every unit behaves
correctly on the rows it was handed, and "returns products" passes with the bug
in place. It covers: 260 rows come back whole; the 251st is findable by search;
an explicit limit is honoured *and* reports `truncated`; the 5000 cap bounds
the query, not just the response; a garbage limit means everything, not
nothing.

---

## Left to do

- **Look at `/pos/sell` in a browser.** Nothing here has been seen rendered.
  The render window is the part to look at: 60 cards, then "Show 60 more".
- The POS is an installed PWA with a service worker — a client-side change can
  appear to do nothing because the terminal is running a cached bundle. Hard
  reload with "Update on reload", or unregister the worker, before concluding
  the fix failed. (The server-side half of this fix deliberately needs no
  client update at all, for exactly that reason.)
- **Restart the backend.** This and two earlier server changes
  (`imagesOverride` in the POS projection, the `warehouseId` ObjectId guard)
  are all waiting on one.

Related: [[subproduct_image_inheritance]], and the `.select()`-narrower-than-
its-consumers pattern — this is the same failure mode in a different field: a
server default that silently shrinks what the client sees.
