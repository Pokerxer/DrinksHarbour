This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.


## Stock visibility

Search (the header modal and `/search-result`) requests `inStock=false` and shows
Out of Stock for unavailable quantities. Its results link to the normal product
detail page, where sold-out offers remain visible and purchasing is disabled.
`/shop`, including its text filters, always requests `inStock=true`. Regular
product cards hide unavailable products; only search cards opt into
`showOutOfStock`. Shared stock checks live in `src/utils/productStock.ts`.
Zero available stock must not fall back to physical stock or a default quantity.

Sold-out product details show "Ask about availability on WhatsApp" using the
existing support number. The message includes the product, selected size/seller
and page link, and asks when stock returns. In-stock products retain the normal
WhatsApp order option. See `docs/memory/product-whatsapp-restock.md` for handoff.

See `docs/superpowers/specs/RESUME-search-out-of-stock.md` at the repository root
for the API changes and verification notes.

## Shop banners and filters

Category/subcategory/brand views use their uploaded artwork when available;
otherwise they show the admin-managed `shop` carousel. An empty carousel uses a
compact heading instead of a blank coloured hero. Category navigation remains
available in either case. A generic `category_top` advert is not appended.

URL parameters are authoritative for filter selections, including price/ABV
ranges, rating, size and volume. Catalog origins come from `countries` in the
filter-options response; flavours are grouped by category. Keep filter controls
and clear actions visible for empty results. See
`docs/superpowers/specs/RESUME-shop-banner-filters.md` for handoff and tests.

## Image delivery

Use `components/UI/OptimizedImage` for Cloudinary product/banner artwork. It
preserves existing transformations and asset versions while sending responsive
CDN URLs directly to browsers. Signed, GIF/SVG, query-authenticated and non-CDN
URLs keep the native Next image loader. Pass `sizes` for the actual grid/gallery
layout; list thumbnails are 96/128px. See docs/performance/navigation-redis-images.md.

Mobile performance: the homepage uses server-seeded `HomeHero`; shopping dialogs
load through `CommerceModals` only when opened. Keep these boundaries so hidden
dialogs do not return to the initial load. Product gallery sizes use the 1024px
layout breakpoint. Report: `docs/performance/mobile-web-vitals-2026-10-12.md`.

Product layout stability: above-product banners are server-seeded, the delivery
strip reserves 40px, and header padding stays constant on scroll. Details:
`docs/memory/desktop-product-cls.md`. Fresh price/stock and eligibility rules stay
authoritative; banner requests never introduce a price cache.

### Public page loading (2026-10-10)

The homepage's immediate shell streams separately from `HomeSections` through Suspense, preserving server product cards and JSON-LD. Category, brand, tenant-directory, blog and banner imagery use `OptimizedImage` for responsive Cloudinary delivery. Blog article/navigation requests run concurrently. Verification and rollout notes: `docs/memory/other-pages-performance.md` at the repository root.

### Flash-sale loading

`HomeFlashSale` streams independently below the homepage hero, rendering up to
20 current sale cards from every promotion type. The complete server seed avoids
a duplicate mount request. Expiry refreshes fetch fresh data. General and typed
sales match before backend pagination; deploy that backend change before or with
the frontend. The pending section displays a labelled skeleton. See
`docs/memory/flash-sale-visibility.md` for current verification and rollout notes.

When no active offers remain, the homepage keeps the Flash Sale section visible
with an inactive-sale message and a browse-drinks link. Expired discounts must
stay excluded; see `docs/memory/flash-sale-visibility.md` at the repository root.

The homepage includes all current sale types, including fixed and percentage
discounts. General sale queries can filter after pagination, so the loader
checks later pages in batches of three until 20 cards or the last page. A blank
first page does not mean no sales. Strict flash-only callers still make one
typed request; completed price/stock responses are never cached by this loader.

## Nearest-seller browsing

The main marketplace starts with the signed-in customer's default delivery
address. Customers can preview a saved/manual delivery address or current
location, then explicitly Apply location; Cancel preserves the active choice.
An applied choice takes priority, including an explicitly applied current
location. No coordinates means normal browsing. Current location does not
supply a complete checkout address.

The responsive picker uses a mobile bottom sheet and desktop dialog, with
separate saved-address and current-location loading/error/retry states. The
header location icon opens the address picker, the shop sort dropdown reports ordering, and
cards/details share distance and closest-available badges. Browse without a
location is also a draft change until Apply.

Current-location lookup allows a recent position for up to 10 seconds. On a
timeout it tries once more with a fresh accurate position for up to 20 seconds.
Permission denial stops immediately. Cancel/close prevents late results from
changing the selection; final failure offers device-settings/manual-address
guidance. Browser/device location availability is still required.

Personalized requests send x-shopping-location as numeric lat/lon JSON in a
header, never in a navigable URL. Shop/search use server pagination and default
to nearest order; explicit customer sorting still wins. Location-aware results
bypass shared caches and stale requests are discarded. Cards, sale sections,
detail defaults and quick-add use the server's shoppingOffer SubProduct/Size IDs
and actual website price. Explicit detail seller choices and existing cart
lines survive location changes. Distances are approximate geographic distances
to the seller's business address; unknown distances remain listed afterward.

See docs/superpowers/specs/RESUME-nearest-seller-marketplace.md at the repository
root for verification, implementation files and rollout notes.

## Storefront search

The header search modal debounces typing, offers suggestion chips and keeps
only the latest query/location results. It displays the representative seller's
price and distance, retains existing results when loading another page fails,
and provides Load more/Retry. Price ranges do not imply sale discounts.

Full search results show the matching catalogue total and current range.
Previous/next advance one page, and service failures have an explicit retry
state instead of appearing as an empty catalogue. Keyboard navigation is scoped
to the search input; Escape closes and focus returns to the opener. Search state
helpers are colocated in src/context. Verification and handoff:
docs/memory/storefront-search-improvements.md at the repository root.

## Product detail purchases

The existing route is /product/[slug]. Seller and size cards show the selected
offer, distance and current price. The purchase panel caps quantities to both
available stock and seller limits; stock below the minimum order is unavailable.
Size/seller changes clamp quantity, and pack selection respects the same limits.
The representative size is the default; explicit seller choices survive refresh.

Changing or clearing shopping location refreshes live availability. Background
updates keep the detail mounted and pause purchase controls until success.
Failures offer Retry without a full page reload; late product/related responses
are ignored. SellerChoices, SizeChoices and PurchaseControls are beside Detail.
Handoff and test evidence: docs/memory/product-detail-improvements.md.

## Compact header navigation

At every screen size, the location pin sits beside search. Laptop/desktop no
longer renders a separate address row. Shop and Sale stay visible; Browse groups
the other existing navigation links and closes on Escape, outside click or
navigation. Logo and laptop cart label use less horizontal space. Mobile keeps
its hamburger menu. Handoff: docs/memory/compact-header-menu.md.
