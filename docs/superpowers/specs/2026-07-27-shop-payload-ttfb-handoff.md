# Handoff prompt — /shop TTFB & payload (items A, B, C)

Paste everything below the line into a fresh session. It is written to be
self-contained; it assumes no memory of the investigation.

---

## Task

Fix the `/shop` page on the DrinksHarbour platform app. It currently serves
**2.31 MB of HTML** with a **~11.6s warm / ~42.6s cold TTFB** in production
(`https://www.drinksharbour.com/shop`). Deliver three changes, as three separate
commits, in this order:

- **A — SSR only the first page.** Stop server-rendering the entire catalogue.
- **B — real `?page=` server-side pagination.** Crawlable paginated URLs.
- **C — slim the API payload.** Add a `fields`/projection option to
  `/api/products/search` so grid cards stop shipping full product descriptions.

**A is a strict subset of B.** Land A first as its own commit so there is a safe
fallback point, then evolve it into B. Do not try to do them as one change.

Use the `superpowers:systematic-debugging` skill's discipline: measure before and
after each commit, don't guess.

## Measurements (taken 2026-07-27, against the live backend)

`https://backend.drinksharbour.com/api/products/search?limit=N`, 3 runs each:

| limit | API TTFB (query) | total | payload | products returned |
|---|---|---|---|---|
| 24 | ~3.1s | ~3.4s | 164 KB | 24 |
| 100 | ~3.5s | ~4.4s | 590 KB | 100 |
| 1000 | ~3.5s | 5.0–9.6s | **2.48 MB** | **425** (the entire approved catalogue) |

Read these carefully, they shape the whole plan:

1. **~3.3s is fixed backend query cost.** It does not scale with `limit`. Neither
   A nor B removes it. Only a backend query fix would, and that is out of scope
   here — but flag it if you find something obvious.
2. **~5.8 KB per product** is the real problem, and it is why C matters.
   A grid card needs a name, slug, image, price, ABV, origin and stock — not the
   full `description`. 425 × 5.8 KB is where the 2.48 MB comes from.
3. **The 2.31 MB of HTML is mostly the RSC flight payload**, not markup. All 425
   products are serialised into the page as `initialProducts` props on top of
   being rendered. So A pays off twice: smaller API leg *and* far smaller HTML.

## Current architecture — read these before changing anything

All paths relative to `client/apps/platform/`.

**`src/app/shop/searchQuery.ts`** — the shared query builder.
- `buildShopSearchParams(sp)` sets **`limit=1000`** (see its comment: it is a
  deliberate "fetch everything once" choice, with a note to revisit at ~1–2k
  products; we are at 425 and it is already too slow).
- Shared by **both** the server component and the client on purpose, so both hit
  an identical URL and the client can skip its initial fetch. Any change here
  must keep that invariant or hydration breaks.
- `parseProductsResponse(data)` reads `data.data.pagination?.total`.
  **That key does not exist** — see the API-shape warning below.

**`src/app/shop/page.tsx`** (~1723 lines) — the server component.
- `fetchInitialProducts(params)` near the top: calls the search API through
  `buildShopSearchParams`, so it inherits `limit=1000`.
- `ShopPage` at the bottom does
  `Promise.all([buildJsonLd(...), fetchInitialProducts(params), fetchInitialRecommendations(12, params.category)])`
  then renders JSON-LD `<script>` tags plus `<ShopClient initialProducts initialTotal initialRecommended heroSeed />`.
- `resolveSeoContext(params)` (in `./taxonomy`) issues its own category /
  subcategory / brand lookups. **Unmeasured**: how much of the remaining TTFB is
  this vs. `fetchInitialProducts` vs. React rendering 425 cards. Instrument it
  before assuming.

**`src/app/shop/ShopClient.tsx`** (752 lines) — `ShopPageContent` at line 151.
- State seeded from props at lines ~214–217 (`products`, `loading`,
  `totalProducts`).
- `skipNextFetchRef` guard in the debounced effect (~line 283) is what makes the
  client skip its first fetch when the server already seeded matching products.
- `fetchProducts` (line 236) has an in-memory `_shopCache` keyed by URL.

**`src/components/Shop/index.tsx`** — the actual grid, and the reason the full
catalogue is currently loaded client-side:
- `filteredProducts` (line ~392) and `sortedProducts` (line ~491) filter/sort the
  **whole** `products` array in `useMemo`.
- `pageCount` (line ~529) and
  `currentProducts = sortedProducts.slice(offset, offset + productPerPage)`
  (line ~530) paginate **client-side**.
- `filterCounts` (line ~538) derives per-facet counts from the loaded list —
  **this is the hard part of B**, see below.
- Good news for B: the filter sidebar's *options* already come from a dedicated
  facet endpoint, `fetch(\`${base}/api/products/filter-options\`)` at line ~359.
  So the sidebar itself does not depend on having every product in memory.

**`src/components/Shop/InfiniteProductGrid.tsx`** — already does `offset` +
`loadMoreLimit` paging against the API (lines ~47–51). **Model B on this**; the
pattern exists and works.

**Server side**, from the repo root:
- `server/routes/product.routes.js:114` → `productController.searchProductsPublic`
- `server/controllers/product.controller.js:587` `searchProducts`, which calls
  `productService.searchProducts(searchParams)` at line 624.
- **Warning: there are three `searchProducts` implementations** —
  `server/services/product.service.js:3757`,
  `server/services/product.service.improved.js:192`,
  `server/services/search.service.js:596`. The live one for this route is
  **`product.service.js`**. A previous debugging session lost time editing
  `search.service.js`, which is dead for this path. Confirm by adding a log
  before you edit.

## API response-shape warning (blocks B)

`/api/products/search` returns:

```json
{"success":true,"data":{"products":[...],"pagination":{
  "currentPage":1,"totalPages":1,"totalResults":24,
  "resultsPerPage":24,"hasNextPage":false,"hasPreviousPage":false}}}
```

With `limit=24` it reports `totalResults: 24` and `totalPages: 1` — i.e.
**`totalResults` is the size of the returned page, not the grand total**, and
`hasNextPage` is wrong. There is no true match count in the response, which is
why `parseProductsResponse` falls back to `products.length`.

This is almost certainly why the live page's hero says **"244 products
available"** while the grid header says **"47 products"** — two different bogus
counts. **B cannot ship without a real total**, so fixing the backend's
`pagination` block (a `countDocuments` on the same filter) is part of B, not
optional.

## Work items

### A — SSR the first page only

- Give `buildShopSearchParams` an explicit limit/offset rather than a hardcoded
  `limit=1000`, keeping one shared builder for server and client.
- Server fetches ~24 (one grid page) for the SSR'd HTML.
- Client, after mount, fetches the full working set in the background
  (non-blocking) and swaps it in so filtering/sorting/pagination keep working
  exactly as today. Initial render must still use `initialProducts` so hydration
  matches and `skipNextFetchRef` still holds.
- SEO is safe: crawlers still get a real product grid, and the full catalogue is
  already reachable via `sitemap.xml` and the `/categories/*` pages.
- **Target:** HTML 2.31 MB → under ~250 KB, with a large TTFB drop.

### B — real `?page=` pagination

- Fix the backend `pagination` block first (real `totalResults` / `totalPages` /
  `hasNextPage`).
- Move `currentPage` into the URL as `?page=N`; server renders page N.
- Replace the client-side `slice()` pagination in `src/components/Shop/index.tsx`
  with API-driven paging (model on `InfiniteProductGrid.tsx`).
- Emit `rel="prev"` / `rel="next"` and a self-referencing canonical per page, and
  make sure page ≥ 2 does not compete with page 1 in search results.
- **`filterCounts` (index.tsx ~538) is the blocker.** It counts facets across the
  loaded product array, which no longer exists once paging is server-side. Either
  source those counts from `/api/products/filter-options` (extend it if needed)
  or drop the per-facet counts. Decide this explicitly — do not let it silently
  start rendering zeros.
- Keep client-side sort working, or move sort server-side via the existing
  `SORT_MAP` in `searchQuery.ts`. Server-side is preferable; sorting one page of
  24 client-side gives wrong results across pages.

### C — slim the payload

- Add a projection/`fields` option to `/api/products/search`
  (`server/services/product.service.js:3757`) and use a grid-card projection from
  the shop.
- A card needs roughly: `_id, name, slug, primaryImage, images[0], priceRange,
  discount, brand.name, abv, originCountry, region, type, availability, sizes`
  (stock/label). It does **not** need `description`, full `sizes[]` metadata, or
  vendor detail.
- Keep the default response shape unchanged so nothing else that calls this
  endpoint breaks — opt in via the param only.
- **Target:** ~5.8 KB → under ~1 KB per product.

## Verification — use this exact procedure

The platform app has **no test framework**. Do not add one. For pure helpers,
follow the existing pattern at `src/lib/seoTitle.test.mjs`: a `.mjs` node:test
file importing the `.ts` module by explicit extension, run with

```bash
node --experimental-strip-types --test src/lib/<name>.test.mjs
```

(`.mjs` keeps it out of `tsconfig.json`'s `**/*.ts` include, which would
otherwise reject the `.ts` import extension.)

For the page itself, build against the **production API** and inspect real HTML —
local `.env` points at `localhost:5001`, which is not running, and Atlas blocks
this machine's IP:

```bash
cd client/apps/platform
NEXT_PUBLIC_API_URL=https://backend.drinksharbour.com \
NEXT_PUBLIC_BASE_URL=https://www.drinksharbour.com \
NODE_OPTIONS=--max-old-space-size=6144 npx next build

NEXT_PUBLIC_API_URL=https://backend.drinksharbour.com \
NEXT_PUBLIC_BASE_URL=https://www.drinksharbour.com \
npx next start -p 3102 &

curl -s -o /tmp/shop.html -w "time=%{time_total}s size=%{size_download}\n" \
  http://localhost:3102/shop
```

Then check what a JS-less crawler actually sees (strip `<script>` first — the RSC
flight payload otherwise makes an empty page look full):

```bash
python3 -c "
import re
h=open('/tmp/shop.html',encoding='utf-8',errors='ignore').read()
b=re.sub(r'<script[\s\S]*?</script>','',h.split('<body')[1])
t=re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',b))
print('visible chars:', len(t))
print('product links:', len(set(re.findall(r'href=\"/product/[a-z0-9-]*\"', h))))
print(t[:800])
"
```

**Baselines to beat** (live prod, 2026-07-27): 2.31 MB HTML, 11.6s warm /
42.6s cold. Record local before/after numbers in the commit message.

Also run, and report, `./node_modules/.bin/tsc --noEmit` — there is a pre-existing
baseline of ~28–31 errors including `.next/dev/types` noise. Compare counts and
confirm **none** of them are in files you touched. `npx tsc` resolves to a broken
npm package; always use the local binary.

## Do not regress

Commit `d4bd8651` just landed the SSR fixes for `/product/[slug]`, `/brands`,
page titles and a root `not-found.tsx`. Re-verify those pages still
server-render after your changes. In particular: **`next/dynamic()` renders only
its `loading` skeleton on the server** — if you reach for it to shrink a bundle,
you will silently delete that content from the HTML. That was the root cause of
the product page having no indexable body.

## Out of scope

- The ~3.3s fixed backend query time (flag findings, don't fix).
- `notFound()` from `/categories/[slug]` and `/product/[slug]` still returning
  Next's blank `__next_error__` shell. Pre-existing; already isolation-tested as
  *not* caused by `force-dynamic`, async page + fetch, `next/font/google`, or a
  co-located `error.tsx`. Next 16.1.6's `experimental.globalNotFound` may be the
  intended fix. Separate task.
