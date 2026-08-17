# RESUME — POS offline product images

Status: **code complete, gates green, browser-VERIFIED through the harness.**
Only the real `/pos/sell` terminal run is left — it needs a cashier PIN.
Date: 2026-08-17 · merged + pushed, `main` at `85e4ac4d`

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

## Browser verification — DONE, 2026-08-17. All checks passed.

**There IS a browser automation stack on this Mac.** The earlier "no
Playwright/Puppeteer/Chromium" note was wrong: `playwright` **1.60.0** is
installed for Python 3.14 and `~/Library/Caches/ms-playwright` already holds
`chromium-1223/1234` + headless shells. Nothing needed installing. (Node has no
`ws` package, but Node 22 also ships a global `WebSocket`, so raw CDP is a
fallback. Google Chrome 151 is in `/Applications` too.)

Driven through the temporary `/smoke-pos-images` harness against the real
modules. Evidence:

| Check | Result |
|---|---|
| Precache report | `requested 3, alreadyCached 0, fetched 3, failed 0, bytes 33754` |
| Requests to `res.cloudinary.com` | exactly **3**, every one for `/f_auto,q_auto,w_300/` |
| Bytes on the wire | **17,710 / 10,108 / 5,936** — i.e. ~10 KB, not the ~107 KB originals |
| IndexedDB `pos-offline-v1` ▸ `images` | 3 rows, `blob instanceof Blob`, `image/jpeg`, sizes **identical to the wire bytes** |
| Offline, cached tiles | `kind=cached`, `src` scheme `blob:`, `naturalWidth=300` — they paint |
| Offline, network | **zero** `res.cloudinary.com` requests |
| Offline, uncached tile | `kind=remote`, `https:` src, `naturalWidth=0` — breaks |
| Offline, no-image tile | `kind=missing`, **no `<img>` element at all** — placeholder |

**The three outcomes are visibly distinct** (screenshot confirmed: three bottle
photos, one broken tile, one 🍷). That is the whole point of the three-state
resolver, and it now has evidence rather than an argument.

### Two traps this run walked into — read before re-running

1. **Going offline is not enough — clear the HTTP cache too.** First attempt, the
   "NOT precached" tile still showed `naturalWidth=300` while offline, because it
   had already loaded during the online phase and an in-page re-render never
   re-requested it. The tile "surviving offline" proved nothing. Fixed with CDP
   `Network.clearBrowserCache` **plus** forcing a re-request
   (`img.removeAttribute('src'); img.src = s`) — then it correctly reports 0.
   This is the documented "DevTools Offline still serves the HTTP cache" trap,
   and it fakes a PASS, not a FAIL.
2. **A full offline page reload cannot work in `next dev`, and that is not a
   defect of this feature.** `next.config.mjs` sets serwist
   `disable: NODE_ENV === 'development'`, so no service worker serves the app
   **shell** and the document itself fails to load. The image bytes were isolated
   instead by loading the page online with **only `res.cloudinary.com` blocked** —
   the faithful PWA scenario (shell from the SW, images from Dexie). Cached tiles
   still painted from `blob:` after a genuine fresh page load; the uncached one
   still broke.

Re-runnable script + screenshots are in this session's scratchpad
(`verify_pos_images.py`, `offline-tiles.png`, `reload-blocked-tiles.png`), along
with a copy of the deleted harness page.

**Harness deleted** — `client/apps/admin/src/app/smoke-pos-images/` is gone.
Admin tsc re-measured after the deletion: **452**, unchanged from baseline.

### Observation, not a defect: a request flash before the blobs arrive

Neither `pos-product-card.tsx` (`useProductImage(product)`) nor the harness gates
on `useProductImagesReady()`. Between mount and the IndexedDB read completing,
every imaged product resolves `remote`, so its `<img>` fires a network request
that offline fails before the `src` swaps to `blob:`. Observed as 4 × `ERR_FAILED`
on the fresh-reload test. Self-correcting and the final render is right, but on a
real terminal it means a burst of failed image requests at grid mount while
offline. `useProductImagesReady()` already exists if that noise ever matters.

## The real terminal run — DESCOPED by the user, 2026-08-17

Logging a cashier in at `/pos/sell` and repeating this against the live grid was
**deliberately not done**: it needs an admin login for the Wyn City tenant plus
the cashier PIN (`/pos/sell` is inside the `src/middleware.ts` path-list matcher,
line 301, *and* behind `pos-lock-screen.tsx`), and the user judged the
module-level proof above sufficient. This is a decision, not an oversight — do
not re-open it without being asked.

**What that leaves genuinely unproven**, if it ever matters: the wiring between
the real grid and these modules — that `pos-sell.tsx` mounts `ProductImageProvider`
around the actual catalogue, that a real sync calls `cacheCatalogueImages()`, and
that all ~530 keys precache rather than the 3 fixtures. The modules themselves,
and the three-state resolution they exist for, are verified.

If it is ever picked up: the POS is an installed PWA, so hard-reload with
"Update on reload" ticked, or unregister the worker — a client change can
otherwise appear to do nothing because the terminal runs a cached bundle.

## Not done, deliberately

- The **426 sub-products with empty `images: []`** — a data backfill, recorded in
  `subproduct_image_inheritance`.
- **`₦NaN` on cart line totals** — predates this, still not root-caused, but the
  render path is now pinned and the search space narrowed. Moved to its own task
  file: [`RESUME-pos-cart-nan.md`](./RESUME-pos-cart-nan.md).
- The cart line still stores the full-size original in `image` (it is persisted
  to localStorage, so an object URL would be wrong there).
