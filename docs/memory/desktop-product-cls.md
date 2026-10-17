# Desktop product layout shifts — 2026-10-12

User production desktop screenshot: RES 58, product route 49, CLS 0.78,
FCP 3.1s, LCP 3.15s, INP 240ms, TTFB 0.24s. No fresh field result claimed.

Product page fetches optional banner placements concurrently with fresh product
data. product-page-banner-data.ts returns a complete seed, with 1.5-second fetch
timeouts; failures settle empty for that visit. ProductClient passes the seed
to AnnouncementBanner and PlacementBanner so ads do not arrive after hydration
and push the product down. These components retain client fetching elsewhere.

First-order header strip has a constant 40px height. Its non-offer states show
Delivery information instead of removing the strip. Cart eligibility card still
stays hidden until eligibility is known. Static announcements keep 40px, even
when dismissed. Header no longer changes padding on scroll; shadow/colour remain.

130 storefront tests passed, zero failed. Scoped lint: two existing ProductClient
hook warnings, no errors. Existing full-project type errors remain. Desktop
browser verified header height 146px before/after scroll and a loaded product
image. Proof /tmp/desktop-product-layout-stable.png; viewport restored. No build
or deployment; CLS reduction requires fresh production visitor measurements.
Full handoff ../superpowers/specs/RESUME-desktop-product-cls.md.
# Header fallback correction — 2026-10-16

User screenshot explicitly rejects the Delivery information strip under the
header. Remove the FirstOrderPerkBanner neutral fallback and its reserved space;
pending/dismissed/ineligible states return null. Keep actual eligible offers and
cart cards. This supersedes the earlier constant-height fallback decision above.
Conditional eligible offers can still affect layout height; no production CLS
improvement is claimed. Regression coverage should verify empty SSR/pending and
dismissed/ineligible DOM, plus eligible offer/dismissal behavior. All five focused
banner tests passed, including the empty-SSR regression observed failing before
the code change. Whitespace check passed. Full suite log:
/tmp/drinksharbour-delivery-strip-tests.log. No deployment or new browser check.
Full storefront verification: 132 passed, 0 failed.
