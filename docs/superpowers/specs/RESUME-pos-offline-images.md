# RESUME — POS offline product images

Status: **code complete, gates green, browser verification OUTSTANDING**
Date: 2026-08-17 · Branch `feat/mobile-phase-1-foundation` · **UNCOMMITTED**

Design + full evidence: [`2026-08-17-pos-offline-product-images-design.md`](./2026-08-17-pos-offline-product-images-design.md)

---

## What was wrong

The offline layer cached the catalogue but only ever stored image **URLs**. A
cached URL is still a URL — offline it resolves to nothing.

Shape (a), a service-worker runtime cache, **was already implemented** and broken
four ways: `maxEntries: 500` under a 530-image catalogue (a silent cap, same
family as `pos_catalogue_silent_cap`); `mode: 'no-cors'` producing opaque
responses that Chrome pads in quota accounting; 56 MB fetched serially in an
unawaited loop on every catalogue load; and every failure swallowed by `catch {}`.

## What was chosen, and why

**Shape (b): image blobs in Dexie.** It survives a service-worker unregister, and
decisively it is **verifiable in `next dev`** — `next.config.mjs` sets
`disable: NODE_ENV === 'development'`, and the dev server prints
`○ (serwist) Serwist is disabled`. A shape-(a) fix could only ever be verified
against a production build, which has OOM history here.

**`f_auto,q_auto,w_300` derivatives.** 0 of 530 sub-products store a
`.thumbnail`, so the grid has always rendered full-size originals as tiles.
Measured per-URL: original 101,729 B → w_300 **10,595 B**. The catalogue goes
from **56 MB to 5.6 MB**, which is what makes eager precaching viable.

**Eager at sync time.** Cache-on-first-view leaves the slow-moving tail
uncached — precisely the products a cashier cannot recall and must look up.

## Files

**New**
- `offline/image-cache.ts` — pure. `posThumbUrl`, `resolveImageSource`,
  `catalogueImageKeys`, `POS_IMAGES_UPDATED`.
- `offline/image-store.ts` — `precacheImages`, `pruneImages`, `loadObjectUrls`.
- `offline/use-product-images.tsx` — object-URL lifecycle provider.
- `offline/image-cache.test.ts` (18), `offline/image-store.test.ts` (12),
  `offline/api-images.test.ts` (8).

**Changed**
- `offline/db.ts` — `images` table at `.version(2)` (v1 stores carried forward,
  so an existing terminal keeps its queued sales).
- `offline/api.ts` — the `caches.open('pos-product-images')` block is **gone**;
  `cacheCatalogueImages()` precaches + prunes and **announces** any shortfall.
- `pos-sell.tsx` — mounts `ProductImageProvider`.
- `components/pos-product-card.tsx` — tile + size-picker read the cache;
  the unused `next/image` import removed. Info-modal hero keeps the original.
- `components/pos-product-grid.tsx` — combo collage reads the cache.
- `src/sw.ts` — **untouched**; it is no longer the mechanism.

## The load-bearing idea

`resolveImageSource` returns **three** states — `cached` / `remote` / `missing` —
not `string | undefined`. A cache miss and one of the 426 sub-products with
`images: []` paint the identical blank tile, so a two-state helper makes a
uniformly broken cache indistinguishable from an unphotographed catalogue, and
no test can tell them apart. `image-cache.test.ts` asserts that a product **with**
an image and one **without** reach different outcomes with an empty map.

## Gates (re-measured on this tree, 2026-08-17)

| Gate | Baseline | After |
|---|---|---|
| server `cd server && node --test '__tests__/*.test.js'` | 2064 / 2061 (3 known fails) | unchanged — client-only change |
| admin vitest | **863 / 863 (47 files)** — *not* the 857/46 in older notes | **901 / 901 (50 files)** |
| admin tsc (source-only, `.next/` filtered) | **452** | **452** |

tsc was proved by diff, not count. After stripping line/col, six message-text
diffs remained — all union-member **ordering** churn in files I never touched
(`form-utils.ts`, `pos-order-picker-modal.tsx`, `purchases-*.tsx`). Collapsing
each error to `file + TSxxxx` and diffing the counts gives an **identical**
signature. Use that collapse when diffing here; raw message text is noisy.

Eight genuine new errors appeared first time round, all `TS2802`: **this project
has `downlevelIteration` off**, so `[...someSet]` / `[...someMap]` is a compile
error. Use `Array.from(...)` and `.forEach(...)`. All eight fixed.

## STILL TO DO — browser verification

Not done: no Playwright/Puppeteer/Chromium on this machine, so no browser could
be driven. Everything is running and waiting.

- backend restarted on **:5001** (it was stale — that fixes the
  `Cast to ObjectId failed for value "[object Object]" … WarehouseStock` error)
- admin dev on **:3005**

`/pos/sell` is behind a cashier PIN (`307` → lock screen). So there is a
temporary harness at **`http://localhost:3005/smoke-pos-images`** — outside the
`src/middleware.ts` matcher, so no login — driving the same modules. Steps:

1. Press **Precache**. Network shows three `res.cloudinary.com` requests of
   **~10 KB each, not ~107 KB**. Application ▸ IndexedDB ▸ `pos-offline-v1` ▸
   `images` holds three rows.
2. Network ▸ **Offline**, hard-refresh.
3. The three cached tiles still paint from `blob:` URLs — **no network entry at
   all**, because there is no request to make. The "NOT precached" tile breaks.
   The "no image at all" tile shows the placeholder.

**Those last three must look different from each other.** If they all go blank
together, the cache is dead and the three-state resolver is what tells you.

Then, for the real thing: log a cashier in at `/pos/sell`, let the catalogue
sync, go offline, reload. **Delete `src/app/smoke-pos-images/page.tsx` when done.**

Traps: the POS is an installed PWA, so hard-reload with "Update on reload"
ticked. DevTools "Offline" still serves the HTTP cache in some cases — confirm
in the Network panel, not by eye.

## Not done, deliberately

- The **426 sub-products with empty `images: []`** — a data backfill, recorded in
  `subproduct_image_inheritance`.
- **`₦NaN` on cart line totals** — predates this, not root-caused. Retest now the
  backend has been restarted.
- The cart line still stores the full-size original in `image` (it is persisted
  to localStorage, so an object URL would be wrong there).
