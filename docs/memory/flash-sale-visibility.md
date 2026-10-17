# Flash sale visibility — 2026-10-12

## Latest: blank loading region resolved

Browser reproduction showed a white Suspense fallback while the sale query
scanned eight catalogue pages (49-second homepage render). General onSale API
matching now happens before pagination for active tenant sales and active
platform discounts. Exact totals are available for sale-only searches. Price
filters still use upper-bound totals. The frontend retains pagination fallback
for older backend releases; deploy backend changes before or with frontend.

The homepage shows a labelled sale skeleton while pending. Verified local API:
both active fixed-price products on page one, exact total 2. Verified browser:
both cards appear immediately below the hero, each showing Save ₦40,000.
Screenshot /tmp/drinks-sale-restored.png; local preview localhost:3002 left open.
No production deployment or full build.

Isolated Mongo fixture passed: 24 general sales and 21 flash sales, with expiry
and future dates excluded. Backend 3,711 passed, 5 skipped, zero failed. Focused
sale/homepage checks 8 passed; scoped lint and whitespace checks passed. Full
storefront: 95 passed, 2 unrelated shopping-location failures (draft address
application and confirmed current-location priority), documented in the resume
file. Preserve those separately modified files.

## Correction: active sales were excluded

The initial flash-only check was incomplete. Production has active fixed-price
sales: Caperdonich Peated 25 Years Old and Glen Deveron 28 Years, each discounted
by ₦40,000, on pages 4 and 5 of the limit=100 general-sale query. Flash-only
results and the first general-sale page are empty despite these valid offers.

HomeFlashSale now requests all on-sale products and renders FlashSale with
flashOnly=false and showEmptyState=true. The fresh loader scans pages in batches
of at most three, stopping at 20 cards or the last page. It preserves geographic
headers, only deduplicates concurrent requests and does not cache finished prices.
True flash-only callers retain the one-request, 20-card typed query. No campaign
dates were changed. Generic On Sale Now label identifies non-flash promotions.

Verification: 96 storefront tests passed, zero failed, including the later-page
promotion and homepage fixed-price card regressions. Scoped lint: zero errors,
three existing location-hook warnings. The corrected loader was run against the
live public API and returned both active fixed-price products listed above.
No deployment or full build performed.

## Previous investigation (superseded for all-sale visibility)

Production's public flash-sale query returned exact total zero. The general
catalogue contains flash offers expired September 30, with isOnSale=false and
normal prices. Do not revive these discounts by ignoring expiry or altering
campaign dates without a requested schedule.

The homepage now retains its Flash Sale section with a clear inactive-sale
message and /shop link when the active list is empty. FlashSaleEmpty.tsx holds
the small empty-state view; FlashSale.tsx uses it only for flashOnly mode.
Normal active cards and complete server seeds are preserved.

Full storefront suite: 93 passed, zero failed. Scoped lint has zero errors and
three existing warnings in location-refresh hooks. No build, visual browser
verification or deployment. See ../superpowers/specs/RESUME-flash-sale-visibility.md.
