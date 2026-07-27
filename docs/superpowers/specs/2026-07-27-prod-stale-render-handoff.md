# Handoff prompt — production /shop, /brands and some product pages render empty

Paste everything below the line into a fresh session. It is written to be
self-contained; it assumes no memory of the investigation.

---

## Task

On production (`https://www.drinksharbour.com`), the server-rendered content fix
is live on **some** pages and not others. Find out why, and fix it.

Working correctly — full server-rendered body, no JavaScript needed:

- the homepage
- `/product/olmeca-blanco` — full breadcrumb, price, specs table (origin,
  region, producer, ABV, stock status) and a real description paragraph

Still broken:

- `/product/hennessy-vsop` — renders only `Loading product details...` and
  nothing else
- `/shop` — `0 products` / `No products match your filters`
- `/brands` — `0 Brands` / `0 Products`

**The strongest lead so far:** the image URLs on the working pages carry a
*different Vercel deployment ID* than the ones on the broken pages. That points
at caching/propagation — older pages still served from a pre-fix build, most
likely Next.js ISR — rather than an incomplete code fix. Confirm or kill that
hypothesis before changing any code.

## Read this first — it may be the cause, and it will confound you if you don't

Four commits landed on `main` on 2026-07-27, shortly before this report:

```
3e3ed94c build(vercel): stop installing twice, stop rebuilding unchanged apps
14acfbbf perf(shop): grid-card projection for /api/products/search
bb59b9c0 feat(shop): real ?page= pagination, crawlable and server-driven
e71fb315 perf(shop): SSR one grid page instead of the whole catalogue
```

**Roughly half of that work is in `server/services/product.service.js`, and the
backend has NOT been deployed.** The three `perf/feat` commits were written and
verified as a frontend + backend pair that ship together. If the platform app
deployed and the backend did not, production is running a combination that was
never tested. Establish which build is live on each side before anything else.

What the frontend now sends to `/api/products/search` that it did not before:
`limit=24`, `page=N` (page 2+ only), and `fields=card`.

What the deployed backend does with those, if it is still on the old code:
honours `limit` and `page`, ignores `fields` (harmless), and reports
`pagination.totalResults` as the size of the page it returned rather than the
grand total. That degrades the product count and hides pagination — but on its
own it should still return 24 products, **not zero**. So an undeployed backend
does not obviously explain `0 products`. Treat that as a fact to verify, not an
assumption to lean on.

`3e3ed94c` added an `ignoreCommand` to both `vercel.json` files so each project
only builds when its own app changed. It was dry-run against `14acfbbf` and
behaved correctly, but it is new, and "a build that should have run was
skipped" is exactly the shape of the reported symptom. Rule it in or out early:
check whether the deployment currently serving `/shop` actually contains
`e71fb315..14acfbbf`.

## Deployment topology

Vercel team `team_EriKXCidLyEICDFXVyRmisf2` (`pokerxers-projects`). Three
DrinksHarbour projects:

| project | id |
|---|---|
| `drinks-harbour` | `prj_KDS3OoPbZGe005RRJoTDq9NVAu8c` |
| `drinks-harbour-h1qm` | `prj_uxVSjdhOHITugftBLQjSBBgqwf5o` |
| `drinks-harbour-u6md` | `prj_fGlngMb1603gOB6QPSLjPHQnX4oe` — the **backend** |

Which config builds which app (the project Root Directory settings were never
confirmed — do that):

- `client/apps/platform/vercel.json` → the **platform** app (`www.drinksharbour.com`)
- `client/vercel.json` → the **admin** app (`buildCommand: cd apps/admin && npm run build`)

Backend API origin: `https://backend.drinksharbour.com`.

## Establish ground truth before theorising

```bash
# 1. Is the backend serving the new code? The new pagination block adds
#    `pageResults` and `isExactCount`. Absent = backend NOT deployed.
curl -s "https://backend.drinksharbour.com/api/products/search?limit=24" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['pagination'])"

# 2. Does the API return products at all, and does the shop's exact URL work?
curl -s "https://backend.drinksharbour.com/api/products/search?limit=24&fields=card" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('success'), len(d.get('data',{}).get('products',[])))"

# 3. What do the broken pages actually serve? Strip <script> first — the RSC
#    flight payload makes an empty page look full.
for p in /shop /brands /product/hennessy-vsop /product/olmeca-blanco; do
  curl -s "https://www.drinksharbour.com$p" -o /tmp/p.html
  echo "=== $p  $(wc -c < /tmp/p.html) bytes"
  python3 -c "
import re
h=open('/tmp/p.html',encoding='utf-8',errors='ignore').read()
b=re.sub(r'<script[\s\S]*?</script>','',h.split('<body',1)[1])
t=re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',b))
print('  visible:',len(t),'| product links:',len(set(re.findall(r'href=\"/product/[a-z0-9-]+\"',h))))
print(' ',t[:200])"
done

# 4. Cache/age headers — this is how you test the ISR hypothesis directly.
for p in /shop /product/hennessy-vsop /product/olmeca-blanco; do
  echo "=== $p"
  curl -sI "https://www.drinksharbour.com$p" \
    | grep -iE "x-vercel-cache|age|cache-control|x-vercel-id|x-nextjs"
done
```

If `x-vercel-cache: HIT` with a large `age` on the broken pages and `MISS`/low
age on the working ones, the user's ISR hypothesis is confirmed and the fix is a
purge/revalidate, not a code change.

## Hypotheses, most likely first

Each one has a cheap way to kill it. Do not skip to a fix.

1. **Stale ISR / CDN entries.** Fits the differing deployment IDs in image URLs
   and the page-by-page split. Test with step 4 above. If confirmed: purge, or
   redeploy the platform project, or add on-demand revalidation. Note that
   `/shop` is a dynamic route (it reads `searchParams`), so plain ISR should not
   apply to it — if `/shop` is also serving a cached body, work out *what* is
   caching it, because that is a separate finding.

2. **The platform deployed but the backend did not.** Step 1 tells you in one
   call. If so, deploy `drinks-harbour-u6md` from current `main` and re-check
   everything before drawing further conclusions.

3. **The `ignoreCommand` from `3e3ed94c` skipped a build that mattered.** Check
   the platform project's latest deployment and whether its commit range
   includes `e71fb315..14acfbbf`. If a build was wrongly skipped, hit Redeploy;
   then reconsider whether the ignore paths are right.

4. **`/shop` is genuinely returning zero products.** Reachable if the SSR fetch
   in `fetchInitialProducts` throws (it swallows errors and returns an empty
   result) *and* the client fetch also fails. Note the shapes carefully:
   an empty SSR seed makes the page start in its **loading** state
   (`Finding the best drinks…`), not `0 products`. `0 products` /
   `No products match your filters` means `loading` is false and the product
   array is empty — a *completed* fetch that returned nothing. That distinction
   should narrow this quickly.

5. **`/brands` is a separate code path** and was not touched by any of the four
   commits. It rendered 5903 visible characters in local verification against
   the production API on 2026-07-27. If it is empty in production now, it is
   either cached from before `d4bd8651` or its own API call is failing. Do not
   assume one root cause covers both it and `/shop`.

## Reference points from the 2026-07-27 session

Measured locally with `next build` + `next start` against
`https://backend.drinksharbour.com`, HTML read with `<script>` stripped. Use
these to tell "broken" apart from "different":

| page | HTML | visible chars | product links |
|---|---|---|---|
| `/shop` | 845–891 KB | ~9 400–10 000 | 34–36 |
| `/product/ardbeg-10-years` | 136.8 KB | 2 710 | 0 |
| `/brands` | 385.3 KB | 5 903 | 0 |

A production page far below those visible-character counts is genuinely empty,
not merely different.

## Things that will waste your time if you do not know them

- **`next/dynamic()` renders only its `loading` skeleton on the server.** That
  was the original root cause of the product page having no indexable body,
  fixed in `d4bd8651`. `Loading product details...` on `/product/hennessy-vsop`
  is exactly that signature — so check whether that page's component tree
  reaches a `next/dynamic` import that the Olmeca page's does not, or whether it
  is simply serving a pre-`d4bd8651` cached body. Both produce identical text.
- **There are three `searchProducts` implementations.** The live one for
  `/api/products/search` is `server/services/product.service.js`
  (route `server/routes/product.routes.js:114` →
  `productController.searchProductsPublic`, `product.controller.js:1193`).
  `search.service.js` and `product.service.improved.js` are dead for this path;
  a previous session lost time editing the wrong one. Add a log before editing.
- **Atlas is reachable from this machine.** Older memory notes claiming it
  blocks this IP are stale (re-verified 2026-07-27). `cd server && node
  server.js` gives a real backend on `:5001` against live data, so the platform
  can be built against it for end-to-end verification:
  `NEXT_PUBLIC_API_URL=http://localhost:5001 npx next build`. The link is slow
  and flaky and `server.js` uses a 5s Mongo timeout and exits on failure, so
  loop the start until `/api/ping` answers. Use it for **correctness**; use the
  production API for **timings**. Fastest of all is in-process: connect with a
  30s timeout and `require('./services/product.service')` directly.
- **The platform app has no test framework and must not gain one.** For pure
  helpers follow `src/lib/seoTitle.test.mjs` /
  `src/app/shop/searchQuery.test.mjs`: a `.mjs` `node:test` file importing the
  `.ts` module by explicit extension, run with
  `node --experimental-strip-types --test <file>`.
- **`npx tsc` resolves to a broken npm package.** Always
  `./node_modules/.bin/tsc --noEmit`. Baseline is **25** errors; none are in
  `src/app/shop/*` or `src/components/Shop/index.tsx`.

## Do not regress

`/product/[slug]`, `/brands` and the homepage must still server-render real
bodies afterwards, and `/shop` must keep the pagination that landed in
`bb59b9c0`: 24 distinct cards per page, `?page=2` showing different products
than page 1, a self-referencing canonical per page, `rel=prev/next`, and a
`— Page N` title suffix.

## Out of scope

- Vercel build cost. Partly addressed in `3e3ed94c`; the remaining lever is the
  admin app's build (it OOM'd at a 6 GB heap, and a ~231-file prune of unused
  Isomorphic demo routes was prepared in an earlier session but never landed).
- `notFound()` from `/categories/[slug]` and `/product/[slug]` still returning
  Next's blank `__next_error__` shell. Pre-existing, already isolation-tested as
  *not* caused by `force-dynamic`, async page + fetch, `next/font/google`, or a
  co-located `error.tsx`. Next 16.1.6's `experimental.globalNotFound` may be the
  intended fix.
- `/api/products/trending` still ships `costPrice` and `platformMargin` to the
  public (used by "Recommended For You",
  `client/apps/platform/src/components/Shop/recommendations.ts:131`).
  `projectProducts()` in `product.service.js` is reusable for it.
