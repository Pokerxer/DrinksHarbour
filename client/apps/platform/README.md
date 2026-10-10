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

### Public page loading (2026-10-10)

The homepage's immediate shell streams separately from `HomeSections` through Suspense, preserving server product cards and JSON-LD. Category, brand, tenant-directory, blog and banner imagery use `OptimizedImage` for responsive Cloudinary delivery. Blog article/navigation requests run concurrently. Verification and rollout notes: `docs/memory/other-pages-performance.md` at the repository root.

### Flash-sale loading

`HomeFlashSale` streams independently below the homepage hero. It requests at most 20 active flash-sale cards and passes a complete server seed so mounting does not repeat the catalog request. Expiry refreshes fetch fresh data. This relies on the backend's pre-pagination typed-sale match; deploy that backend change first or together. See `docs/memory/flash-sale-speed.md` for verification and legacy generic-sale limitations.
