# Handoff: two SEO/security follow-ups — direct-500 leaks + brand URL duplicates

**Written:** 2026-07-28
**Repo:** `/Users/mac/Documents/drinksharbour`, branch `main`
**Prior work this session:** `d3b5d746` (crawl-audit fixes), `536b351c` (category
consolidation + global error-handler fix). Both pushed. Read them first —
`git show --stat d3b5d746 536b351c` — because both tasks below build directly on
them.

Two independent tasks. Task A is server-only and cheap. Task B is a ranking
decision and needs a frontend build. **Do them in separate commits.**

---

## Context you need

The crawl audit that started this work is closed except for these two items. The
relevant memory file is
`~/.claude/projects/-Users-mac-Documents-drinksharbour/memory/seo_audit_fixes_2026_07_28.md`.

Two facts from the prior session that matter here:

1. **The Vercel backend runs with `NODE_ENV` unset.** This is why the global
   error handler's old `NODE_ENV === 'production'` guard never fired in
   production. `536b351c` changed it to fail closed on
   `NODE_ENV === 'development'`. Any new guard you write must follow that
   pattern — never `!== 'production'`.
2. **The local backend needs `NODE_ENV=development`** (already in `server/.env`)
   and Atlas is slow/flaky from this machine — a cold start takes 30–60s and
   sometimes fails outright. Poll `curl -s -o /dev/null http://localhost:5001/api/ping`
   in a loop rather than a fixed `sleep`, and retry the whole start if it dies.

---

## Task A — stop direct `res.status(500)` handlers leaking internals

### The problem

`536b351c` fixed the *global* error handler so 5xx bodies collapse to
`"Internal server error"`. But **59 call sites across 12 controllers never reach
that handler** — they catch their own errors and respond directly, echoing the
raw error text to the caller.

Exact inventory (`grep -c 'status(500)'`):

| Count | File |
|---|---|
| 10 | `controllers/purchaseAgreement.controller.js` |
| 9  | `controllers/vendorPricelist.controller.js` |
| 8  | `controllers/vendorReturn.controller.js` |
| 8  | `controllers/gemini.controller.js` |
| 6  | `controllers/uomConversion.controller.js` |
| 6  | `controllers/exchangeRate.controller.js` |
| 3  | `controllers/subcategory.controller.js` |
| 3  | `controllers/category.controller.js` |
| 3  | `controllers/brand.controller.js` |
| 1  | `controllers/scan.controller.js` |
| 1  | `controllers/payment.controller.js` |
| 1  | `controllers/banner-gemini.controller.js` |

Of those, **39 echo the error text** in two shapes:

- `message: error.message` — 31 sites
- `error: error.message` — 8 sites (all in `vendorReturn.controller.js`)

The remaining 20 already return a static string; leave them alone.

### Severity — read before deciding how far to go

These are **admin/vendor endpoints behind auth** (pricelists, purchase
agreements, exchange rates, UoM conversions, vendor returns), not public ones.
They leak error *messages*, never stack traces. This is real but modest — it is
hygiene and defence-in-depth, not an open door. Do not let it balloon into a
controller-wide rewrite.

### The fix

`utils/asyncHandler.js` already exists and is used in **45 files**:

```js
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
```

The established pattern in this codebase is therefore: **let the error reach the
global handler.** Two acceptable approaches — prefer the first:

1. **Preferred — delete the local catch, wrap the route in `asyncHandler`.**
   The global handler in `server.js` already logs the stack to console, collapses
   5xx messages, and preserves 4xx messages verbatim. This deletes code rather
   than adding it.
2. **Where the catch does real work** (cleanup, a transaction abort, a
   domain-specific status code), keep the catch but replace the response with
   `next(error)` so the global handler still formats it.

**Do not** hand-roll a second `NODE_ENV` check in each controller. One guard, in
one place, is the whole point.

Watch for: some catches map specific errors to 4xx (validation, not-found).
Those are correct — `next(error)` preserves them if the error carries
`statusCode`/`status`. Check each catch before collapsing it; a handful will
genuinely need to stay.

### Verifying Task A

No frontend build needed — this touches `server/` only.

- `node -c server.js` and `node -c` on each edited controller (near-free).
- Run the server test suite. **The repo uses `node:test`, NOT jest.** Baseline
  from memory is 295/297 in `server/` with 2 pre-existing SO-number failures —
  confirm the baseline before you change anything so you can tell your
  regressions from the existing ones.
- End-to-end spot check on at least one edited route: start the backend, hit an
  endpoint that throws, confirm the body is `{"success":false,"message":"Internal
  server error"}` with `NODE_ENV` unset and the real message with
  `NODE_ENV=development`. The trick used last time to force an error cheaply was
  posting malformed JSON:
  `curl -s -X POST http://localhost:5001/api/users/login -H 'Content-Type: application/json' --data '{bad json'`
  — that exercises the global handler without needing a broken route.

---

## Task B — brand URL duplicates: `/brands/<slug>` vs `/shop?brand=<slug>`

### The problem

`sitemap.ts` lists **both** forms for every brand (`brandPages` uses `flatMap` to
emit two entries per brand). They render largely the same product set and each
self-canonicalizes — the identical near-duplicate split that `536b351c` just
resolved for categories.

### Why this was NOT folded into the category fix

Categories were open-and-shut: purely navigational, and `/shop?category=` had
36 internal links against 9. Brands are genuinely arguable, because
`/brands/<slug>` targets **brand-name entity queries** ("Hennessy", "Jack
Daniel's") and carries entity content a filter view does not — `Brand` JSON-LD,
`brandColors` hero, tagline, logo. A brand page is closer to a real page type
than a category page is. That is a content-strategy call, not a bug.

### Evidence already gathered (2026-07-28) — verify it still holds

```
/shop?brand=   13 references: sitemap.ts, brands/BrandsBrowser.tsx,
               brands/[slug]/page.tsx, shop/page.tsx, shop/searchQuery.test.mjs,
               components/Home1/Brand.tsx
/brands/        2 references: brands/[slug]/page.tsx,
               components/Product/Detail/index.tsx
```

`src/app/brands/[slug]/page.tsx` is 968 lines and sets its own canonical at
line ~192.

**The surprising bit worth re-checking:** `BrandsBrowser.tsx` — the `/brands`
directory listing — appears to link to `/shop?brand=`, not to `/brands/<slug>`.
An older memory (`brand_detail_page.md`) claims "list cards + sitemap now use
it [the detail page]". **One of those is wrong.** Resolve this first; it changes
the whole picture. If the brand directory really does route users past the brand
detail pages, those pages are close to orphaned and the decision gets much
easier.

### How to decide

Do the same evidence pass used for categories, then commit to one:

- **If `/shop?brand=` keeps the link equity and `/brands/` is near-orphaned:**
  mirror `536b351c` exactly — canonical + `og:url` + JSON-LD `@id`/`url` on
  `/brands/[slug]` point at `/shop?brand=<slug>`, and drop the `/brands/<slug>`
  half of the `flatMap` in `sitemap.ts`. Keep the `/brands` hub.
- **If brand pages are the better entity target (a defensible outcome):** invert
  it — repoint internal links to `/brands/<slug>`, canonicalize
  `/shop?brand=` onto it, and drop the `/shop?brand=` half from the sitemap.
  This is more work and moves rankings onto a less-linked URL, so only choose it
  if the evidence actually supports it.
- **Check Search Console before flipping**, if access is available — if
  `/brands/<slug>` URLs already earn impressions for brand-name queries, that
  outweighs the raw internal-link count. This is the single highest-value input
  and neither prior session had it.

Whichever way it goes: **the sitemap must list only the winner**, and the
decision plus its reversal steps go in the commit message, exactly as
`536b351c` did.

### Verifying Task B

Frontend build required.

1. Start the backend first (see the Atlas note above) — with it down, the
   sitemap silently builds with **zero** API-driven URLs and you will "verify"
   nothing. This bit the prior session.
2. `cd client/apps/platform && NODE_OPTIONS="--max-old-space-size=6144" npx next build`
3. `npx next start -p 3210`, then:
   - `curl -s http://localhost:3210/brands/<real-slug> | grep -oE '<link rel="canonical"[^>]*>|<meta property="og:url"[^>]*>'`
   - Confirm the JSON-LD `@id`/`url` moved with the canonical — a mixed signal is
     worse than no change.
   - `curl -s http://localhost:3210/sitemap.xml` and count both forms; only the
     winner should appear.
4. **Use a real slug.** A non-existent slug renders the 404 page, which inherits
   `canonical: "./"` from the root layout and looks like a self-canonical —
   the prior session lost time to exactly this. Pull a live slug from
   `curl -s http://localhost:5001/api/brands?limit=5`.
5. `./node_modules/.bin/tsc --noEmit -p tsconfig.json`, ignoring `.next/types`.
   **Baseline is 22 source errors** — match it, don't try to reach zero.

---

## Cost note

The session that produced this handoff ran to ~$75, largely on repeated
`next build` runs and waiting on slow Atlas connections. Budget accordingly:
do Task A first (server-only, no build), and batch the Task B verification into
a single build-and-start cycle rather than rebuilding per change.

## Definition of done

- [ ] Task A: no controller returns raw `error.message` on a 5xx; server suite at
      or above its measured baseline; one route verified end-to-end in both
      `NODE_ENV` states.
- [ ] Task B: one brand URL pattern canonical, sitemap lists only that one,
      canonical + `og:url` + JSON-LD all agree, verified against a real slug on a
      running build; decision and reversal steps recorded in the commit message.
- [ ] Both committed separately and pushed to `main`.
- [ ] Memory file `seo_audit_fixes_2026_07_28.md` updated with outcomes; delete
      its "Known remaining leak surface" and "Same duplicate pattern still
      exists for BRANDS" paragraphs once they are no longer true.
