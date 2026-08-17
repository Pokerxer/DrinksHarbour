# POS offline product images — design

Date: 2026-08-17
Branch: `feat/mobile-phase-1-foundation`
Surface: `client/apps/admin/src/app/shared/point-of-sale/` (route `/pos/sell`)

---

## The problem

The POS terminal survives a network drop for the catalogue, the cart and
checkout — `offline/` caches products in Dexie and queues sales. Images do not
survive it. A cashier who loses the network keeps a working till but loses the
grid, because every tile's `<img>` points at a remote Cloudinary URL.

## What was measured, not assumed

Everything below was verified on 2026-08-17 against Atlas and against
`res.cloudinary.com` directly.

**1. Dexie holds URL strings, not bytes.** `offline/db.ts` `ProductRecord.images`
is `{ url, thumbnail?, isPrimary? }[]`; `offline/api.ts` fills it from
`resolveSubProductGallery(p)`. Nothing in the offline catalogue can make a
remote URL resolve without a network.

**2. Every image is remote Cloudinary, and CORS-enabled.** 530/530 distinct URLs
for Wyn City are on `res.cloudinary.com`. All 25 sampled return
`Access-Control-Allow-Origin`, so they can be fetched cross-origin and stored as
real (non-opaque) responses.

**3. A service worker exists and already has an image rule.** `src/sw.ts`
(Serwist; built to the untracked `public/sw.js`; registered by `useRegisterSW()`
at `pos-sell.tsx:35`) runtime-caches `request.destination === 'image'` with
`CacheFirst` into `pos-product-images`, `maxEntries: 500`. And `offline/api.ts`
already eagerly `cache.put`s raw URLs into that same cache.

**So fix shape (a) — a service-worker runtime cache — was already implemented.
It is broken in four ways:**

- **`maxEntries: 500` against 530 images is a silent cap.** Serwist's expiration
  plugin adds each served URL to its index as it is used, so once the index
  fills the cache churns permanently at the cap and the tail evicts. Same
  failure family as `pos_catalogue_silent_cap`.
- **`fetch(raw, { mode: 'no-cors' })` makes opaque responses** although CORS is
  available. Chrome pads opaque cache entries in quota accounting, so 530 of
  them account for far more storage than their real size.
- **56 MB fetched serially** in an unawaited `for` loop on every catalogue load.
  On a till's connection that prefetch realistically never finishes.
- **Every failure is swallowed by `catch {}`.** There is no coverage signal, so
  a half-populated cache is indistinguishable from a working one.

**4. `next/image` is not in the path.** Every POS render site is a plain `<img>`
(`pos-product-card.tsx:659,697,1448,1784`; `pos-product-grid.tsx:161,170`).
`Image` is imported at `pos-product-card.tsx:21` and never used, so the
`/_next/image` → `pos-images` rule in `sw.ts:25` is dead weight for the terminal.
The browser requests the raw Cloudinary URL directly.

**5. Size — the finding that reframed the task.**

| | |
|---|---|
| Wyn City active sub-products | 956 |
| …with a resolvable image | **530** |
| …blank | 426 — the known data gap (`subproduct_image_inheritance`), out of scope |
| …using a stored `.thumbnail` | **0** |
| Mean bytes per image | **107 KB** — the grid downloads full-size originals as thumbnails |
| Total as served today | **56 MB** |
| Same images at `f_auto,q_auto,w_300` | **10.6 KB** each → **5.6 MB total** |

Cloudinary honours the transformation, verified per-URL:
`original 101,729 B` → `w_400 19,959 B` → `w_300 10,595 B` → `w_200 6,310 B`,
all HTTP 200.

`0 use a stored .thumbnail` is why: `resolveSubProductThumb` falls back to
`.url`, so the "thumbnail" the grid renders has always been the full original.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Fix shape | **(b) image blobs in Dexie** | Survives a service-worker unregister; is a real guarantee rather than a cache that might be there. Decisively: it is **verifiable in `next dev`**, where `next.config.mjs` sets `disable: NODE_ENV === 'development'` and there is *no service worker at all* — so any shape-(a) fix could only ever be verified against a production build, and this app has an OOM history there. |
| Derivative width | **`f_auto,q_auto,w_300`** | Tiles are ~150–200 CSS px, so w_300 covers 2× DPI. Turns 56 MB into 5.6 MB, which is what makes eager precaching viable at all. Also speeds the terminal up online. |
| Precache timing | **Eager, at catalogue sync** | Cache-on-first-view leaves the slow-moving tail uncached — exactly the products a cashier cannot recall and therefore has to look up, which is the failure `pos_catalogue_silent_cap` recorded. At 5.6 MB the upfront cost is negligible. |
| Render source | **Blob when online too**, not only during an outage | One code path instead of two, and the offline path is then exercised on every sale rather than only during the emergency it exists for. A path taken only in an emergency is a path nobody knows works. |

## Architecture

### New — `offline/image-cache.ts` (pure; no Dexie, no DOM)

The testable core. Vitest runs `environment: 'node'` with no jsdom, so anything
that must be tested cannot touch a component.

```ts
posThumbUrl(url: string, width = 300): string
```
Injects `f_auto,q_auto,w_{width}` after `/image/upload/` in a Cloudinary URL.
Returns the input unchanged for a non-Cloudinary or unparseable URL. Idempotent —
it does not stack a second transformation onto a URL that already has one.

```ts
type ImageSource =
  | { kind: 'cached';  src: string; key: string }  // blob: object URL
  | { kind: 'remote';  src: string; key: string }  // key known, bytes absent
  | { kind: 'missing'; src: null;   key: null }    // product has no image at all

resolveImageSource(product, objectUrls: Map<string, string>, width?): ImageSource
```

**The three-way return is the heart of the design.** This module degrades to a
plausible wrong result: a broken image, an uncached URL and a product that
genuinely has no image all render as the same blank tile. A two-state helper
makes `cached`, `remote` and `missing` indistinguishable, and no test could then
tell a working cache from a uniformly broken one. Three states can be asserted
on differentially.

### New — `offline/image-store.ts` (thin Dexie + network side)

- `precacheImages(keys, opts)` — fetches only missing keys, `mode: 'cors'`,
  bounded concurrency; `bulkPut`s blobs; returns
  `{ requested, alreadyCached, fetched, failed, bytes }`.
- `pruneImages(liveKeys)` — deletes rows whose key is absent from the current
  catalogue. Storage stays bounded by catalogue size, not by time.
- `loadObjectUrls()` — every cached key → an object URL.

### New — `offline/use-product-images.ts`

One provider owning the object-URL lifecycle: creates each URL once,
`URL.revokeObjectURL`s every entry on unmount and every key dropped on a
refresh. Exposes `ready`, so the grid shows the placeholder rather than a URL it
already knows will fail while the map is still loading from IndexedDB.

### Changed

- `offline/db.ts` — add an `images` table (`key` primary, `blob`, `bytes`,
  `fetchedAt`) at `.version(2)`.
- `offline/api.ts` — **delete** the `caches.open('pos-product-images')` block
  (lines 91–103). After `bulkPut`, derive the key set and call `precacheImages` +
  `pruneImages`, **reporting** coverage with the same `console.warn` convention
  as the truncation warning at `api.ts:59` instead of swallowing it. A silent
  cap is what caused the last one.
- `components/pos-product-grid.tsx` — mount the provider, pass the map down.
- `components/pos-product-card.tsx` — the tile `<img>` (~line 1784) reads
  `resolveImageSource` instead of `getImageUrl`. The info-modal hero keeps the
  full-size original.
- `src/sw.ts` — left alone. It stops being the mechanism, so re-tuning its
  `maxEntries` is no longer load-bearing.

## Error handling

A failed fetch leaves the key uncached, so `resolveImageSource` returns
`remote`: online that still renders, offline it shows the placeholder. Because
that is visually identical to one of the 426 genuinely image-less products,
coverage is **reported at sync time** rather than inferred from the grid.

## Tests

Assertions are on the payload that reaches the wire — the record handed to
Dexie, the URL handed to `fetch`, the `src` string handed to `<img>` — never on
a helper's return value alone.

`image-cache.test.ts` (pure):
- `posThumbUrl` inserts the transformation for a real Cloudinary URL; leaves a
  non-Cloudinary URL alone; is idempotent; handles both the `.jpg` and `.webp`
  shapes present in the data.
- **The differential test:** with an empty map, a product *with* an image →
  `remote` and one *without* → `missing`; with a populated map the first →
  `cached` with a `blob:` src while the second is *still* `missing`. A uniformly
  broken cache fails this.

`image-store.test.ts` (mocked Dexie in the style of `offline/sync.test.ts`,
stubbed `fetch`):
- the record handed to Dexie is `{ key, blob, bytes }`;
- the request goes out `mode: 'cors'` to the **w_300 URL, not the original**;
- already-cached keys are not re-fetched;
- a failed fetch is **counted**, not swallowed;
- `pruneImages` deletes exactly the keys absent from the catalogue.

## Cost

**~5.6 MB per terminal** — 530 keys × ~10.6 KB — plus IndexedDB overhead.
Bounded by the catalogue through `pruneImages`.

## Baselines (re-measured 2026-08-17, this working tree)

```
server        2064 tests / 2061 pass — the same 3 pre-existing failures
              (1 pricelist tenant-scope, 2 SO-number)
admin vitest  863 / 863  (47 files)   <- NOT the 857/46 in older notes
admin tsc     452  (source-only, .next/ filtered)
```

## Out of scope

- The **426 sub-products with genuinely empty `images: []`** — a data backfill,
  already recorded in `subproduct_image_inheritance`.
- Two open POS bugs that predate this work: the `WarehouseStock.warehouse`
  `Cast to ObjectId failed for value "[object Object]"` on `/pos/sell` (fixed in
  source; **the running backend is stale, restart it**), and `₦NaN` on cart line
  totals (not root-caused; retest after the restart).

## Traps for whoever picks this up

- **There is no service worker in `next dev`** (`disable: NODE_ENV ===
  'development'`). Shape (b) does not need one; do not conclude a SW-based
  theory is disproved from a dev-mode observation.
- **The POS is an installed PWA**, so a client change can appear to do nothing
  because the terminal is running a cached bundle. Hard-reload with "Update on
  reload" ticked, or unregister the worker.
- **DevTools "Offline" is not a real network loss.** Verify in the Network panel
  that the image was served from the blob / ServiceWorker, not merely that the
  page "looked fine".
