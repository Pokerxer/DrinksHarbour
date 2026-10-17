# Mobile web performance — 2026-10-12

## Visitor report supplied by the user

Production, mobile, last 7 days: RES 67; FCP 3.78s; LCP 4.41s; INP 248ms;
CLS 0.11; TTFB 0.72s. Homepage RES 47, product route 57, blog route 73.
This screenshot is a historical field baseline, not a controlled benchmark.

## Changes

- HomeHero fetches live banners on the server and passes a complete seed to
  HeroBanner. The first image is now discoverable in server HTML, with its
  existing responsive CDN delivery and priority. Successful seeds do not repeat
  the fetch on mount. Failed server requests retain client recovery. Empty
  placements stay empty rather than mounting a spinner and collapsing it.
- CommerceModals gates cart, wishlist, search, quickview and comparison chunks
  behind their open state. A visited dialog stays mounted for close animations
  and local state. Initial pages do not render five closed heavy dialogs.
- AdSense and the footer Preferred Sources publisher script use lazyOnload.
  Consent defaults, analytics, age verification and shopping providers remain.
- Image device widths now include 384/480px. Product gallery sizes reflect the
  single-column layout below 1024px and the actual desktop container. The first
  product image uses Next 16 preload; later images remain lazy.

## Local comparison

HTML captured with curl from the running development server, same routes.
Gzip sizes calculated with Node zlib defaults. Dynamic recommendations and dev
framework output can vary; these measurements are not production FCP/LCP/INP.
Samples were captured after hero/dialog changes, before the final image-width
configuration change.

| Check | Before | After |
| --- | ---: | ---: |
| Homepage hero image present in server HTML | No | Yes |
| Homepage HTML bytes | 1,087,473 | 1,089,999 |
| Homepage gzip HTML bytes | 124,821 | 126,537 |
| Product HTML bytes | 333,718 | 317,412 |
| Product gzip HTML bytes | 55,192 | 53,532 |

Product initial HTML was 4.9% smaller (gzip 3.0% smaller). Homepage HTML grows
slightly because it includes the real hero and its seed, removing the dependency
on hydration followed by a separate browser image-data request.

126 storefront tests passed, zero failed. Scoped ESLint and whitespace checks
passed. Full type check has 19 existing diagnostics in banner route signatures,
checkout/shop/policy components; none in the changed loading components or
layouts. Logs /tmp/mobile-vitals-{tests-final,lint-final,types}.log.

Browser verification at 390x844: homepage and product images complete; current
CDN width was 640px before final small-width config; search opens and dismisses,
cart loads on first use with its empty state, product purchase/WhatsApp controls
remain present. Screenshot /tmp/mobile-home-optimized.png. Browser debugger
timed out during final image-width verification after Next config restarted;
viewport was restored. No final image byte/time comparison claimed.

No production build, Lighthouse audit, deployment, or new field RES measurement
was performed. Deploy reviewed changes, then compare fresh mobile samples for
the same routes. The 7-day score continues to include older visits.

References: https://web.dev/articles/optimize-lcp and
https://nextjs.org/docs/pages/api-reference/components/image.
