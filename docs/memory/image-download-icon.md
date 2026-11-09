# Download saved product images from the edit form (2026-11-08)

## Feature

On `/sub-products/[id]/edit`, every saved product image in the media grids now
has a Download action:

- `create-edit/product-media.tsx` (Image Overrides grid) — a Download button
  in the hover overlay next to Set Primary / Remove.
- `create-edit/basic-info.tsx` saved grid — a Download button in the hover
  action overlay (blue, between Primary and Remove).
- `create-edit/basic-info.tsx` inherited images (parent product's media shown
  while the sub-product has no override) — an always-visible Download chip in
  the tile corner, since that grid has no hover overlay.

## Mechanics

`create-edit/image-download.ts` exports `downloadProductImage(url, filename?)`:

1. Fetches the image's ORIGINAL bytes with `fetch(url, { mode: 'cors',
   cache: 'no-store' })` — Cloudinary serves CORS headers, so cross-origin
   fetching works and the browser saves a true copy of the stored file.
2. Hands the blob object URL to a synthetic anchor with `download` set to the
   file name derived from the stored URL (e.g. `akpeteshie-75cl.webp`); the
   object URL is revoked a second later (immediate revoke can cancel the
   download in some browsers).
3. Fallback when the fetch fails (CORS-blocked host, offline): the same
   anchor mechanism with the direct stored URL, letting the browser do its
   best. Failure after everything is surfaced via a toast.

## Verification

- `image-download.test.ts` — 2 vitest tests: blob fetch triggers an anchor
  with the right href/download name; fetch failure falls back to the direct
  URL anchor. URL.createObjectURL/revoke stubbed; anchor click spied.
- Full sub-product suite: 35 files / 178 tests green; `tsc --noEmit` clean for
  the touched files.

## Notes

- The download icon is decorative-neutral (PiDownload) and reuses each grid's
  existing action styling.
- No server change: the stored URL is public media served with CORS headers;
  no size/auth semantics are altered.
