# Mobile web loading — 2026-10-12

User's production mobile RES was 67, homepage 47/product 57. HomeHero now seeds
the database hero on the server, so HTML includes the priority responsive image.
HeroBanner accepts initialBanners + initialBannersComplete and skips the duplicate
mount fetch for successful seeds. Keep banner expiry/prices/stock fresh.

CommerceModals mounts heavy shopping dialogs on first opening and retains
visited ones for closing/state. Root layout must not directly mount those five
dialogs again. AgeGate and consent overlays remain immediate. Advertising and
footer publisher scripts use lazyOnload. Mobile CDN widths include 384/480;
product image sizing follows the single-column layout below 1024px.

126 tests pass; scoped lint and whitespace checks pass. Existing 19 type errors
remain in other files. Local product initial HTML sample shrank 4.9%; homepage
hero is server-discoverable. Mobile images and search/cart verified in browser
before the final width config restart; final image-byte comparison unverified.
No production build/deploy or new visitor score. Detailed report and limits:
../performance/mobile-web-vitals-2026-10-12.md. Resume:
../superpowers/specs/RESUME-mobile-web-vitals.md.
