# Wyn City standalone website

2026-10-05: created independent Next.js project at
`/Users/mac/Documents/wyn-city-storefront`, as the user requested outside
DrinksHarbour. Its README.md and docs/RESUME.md are the source of truth.
Preview: http://localhost:3002. Separate pinned package/lockfile, no shared
source or dependency links and no direct database access.

Design-ready demo catalogue is explicitly illustrative; payments disabled.
Private `.env.local` needs the Wyn City tenant API key and live mode to connect.
Keys require storefront:read and checkout:write. Server-only REST adapter,
signed HttpOnly checkout cookie, origin/input validation and attempt retention.
Never invent a tenant key or expose it in browser variables. Provisional branding;
real logo/product media/contact/location/legal copy still need confirmation.

Verified 5 unit tests, 4 browser journeys, typecheck and production build.
Browser tests isolate port3003/.next-e2e from the active preview. No live payment
or production deployment verified. Live catalogue initially loads max100 offers;
see standalone resume for further launch steps.

2026-10-05: user requested platform-style cards. Standalone app now uses focused
product-cards.css: square 16px image panels, compact metadata/name/price,
four desktop/two mobile columns and burgundy pill cart controls. Existing
stock/size/cart behavior preserved. Unit 10/10, typecheck/build and browser 9/9
passed; desktop/mobile screenshots inspected. See sibling docs/RESUME.md.

## Shop and product pages, cart icon — 2026-10-05

User requested no size selectors on cards and a cart icon opposite stock.
Sibling Wyn City cards now link to /product/[id] through image/name and put a
44px cart icon top-right. Variant offers open details for explicit selection;
single-unit offers add directly, capped by stock. /shop has catalogue filters.
Details call tenant REST GET /products/:id server-side and validate data.
No live payment or tenant mutations. Unit 10/10, typecheck/build passed.
Browser verification and screenshots are recorded in sibling docs/RESUME.md.

2026-10-05 dedicated shop: catalogue removed from homepage and rendered only
at /shop. Homepage fetches banners only. Shopping/navigation links updated;
legacy banner collection anchors map to /shop locally. Unit 10/10, typecheck,
production build and all 11 browser tests passed. Sibling docs/RESUME.md updated.

2026-10-05: Main Wyn City body background is now white (#ffffff). Accent
surfaces retained. Unit 10/10, typecheck and production build passed.

## Platform shop filters — 2026-10-05

Adapted platform FilterHeader/FilterSidebar/ActiveFilters into sibling app small
toolbar, drawer and pure filter modules. Pending apply/cancel, multi-select
type/origin/flavour/size, ABV, price presets/ranges, stock, chips, clear/reset,
sorting and grid controls. Actual REST facet counts; no fabricated brand/rating
facets. OR within facets, AND across facets; price unknowns excluded by bounds.
Unit 12/12, typecheck/build passed; browser status in sibling docs/RESUME.md.
No live records or monorepo shop components changed.

Final platform-filter checks: unit 12/12, strict typecheck, production build
and browser 12/12 passed; mobile toolbar/drawer screenshots inspected.
