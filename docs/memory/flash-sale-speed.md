# Flash-sale loading — 2026-10-10

## Root cause and changes
The homepage FlashSale used `limit=100`, then fetched every remaining catalog page before rendering <=20 cards. `saleType` filtering happened after pagination, which prevented simply reducing the window. Its server seed also shared the blog/featured/recommendation barrier and the section only mounted after scroll observation.

- `server/services/productSaleFilter.js` matches one active sale-type offer with valid start/end dates after approved tenant/available-size resolution and before pagination/count. The existing pricing transformation uses the same request timestamp. Typed-sale counts are exact unless price filters are also present.
- `flash-sale-data.ts` makes one fresh `saleType=flash_sale&limit=20&fields=card` request. Only concurrent identical requests share a promise; completed price/stock responses are not cached.
- `HomeFlashSale.tsx` streams independently, directly below the hero. Successful seeds, including empty ones, skip the mount fetch. A failed server request falls back to a client request. Countdown expiry fetches fresh data.
- FlashSale no longer waits for scroll detection. Cards use the responsive Cloudinary wrapper. Types, helpers, countdown and cards are split into files below 200 lines.
- Generic, currently unused `flashOnly=false` behavior retains its existing catalog-walk/cache in `flash-sale-legacy.ts`. The homepage uses only the bounded flash path. No general on-sale pagination fix is claimed.

## Evidence
- Local MongoDB fixture: 45 products, 21 eligible active sales. With limit=20, page 1 returns 20 sales starting at Fixture 20; page 2 returns Fixture 43. Expired, future, inactive and other sale types are excluded. Count is 21 and exact. The temporary local DB is removed. Run `cd server && node scripts/performance-load/flash-sale-check.js`.
- Platform: 86 tests passed, including one-request bound, concurrent request sharing/fresh subsequent request, retry, server card links/CDN images, successful-empty seed and existing homepage streaming.
- Scoped ESLint and whitespace check passed.
- Full platform type check remains blocked by 19 existing diagnostics, none in changed files; log `/tmp/flash-sale-types-final.log`.
- Final backend full suite: 3,654 passed, 0 failed, 5 skipped (3,659 total). Log `/tmp/flash-sale-server-final.log`. Local diff review completed; CodeRabbit unavailable.
- No browser timing or production performance percentage claimed. Browser tooling was unavailable in earlier session.

## Rollout
Uncommitted and undeployed. Release backend sale-filter change before or together with the frontend bounded request; the old backend post-pagination filter can miss eligible products. Do not deploy this extensive dirty checkout wholesale. Preserve unrelated changes. No new Redis response cache was added for sale prices/stock.

- Countdown now starts after hydration with stable placeholder markup, avoiding a seconds mismatch and section redraw; regression test passed.
