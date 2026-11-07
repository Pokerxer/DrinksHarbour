# New admin operations workspaces

The uncommitted merchant, delivery, market enrollment, channels and countries
workspaces share foundation control styles at
`client/apps/admin/src/app/shared/market-foundation/workspace.tsx`. Preserve
44px control height, visible focus, disabled styling and theme-aware notices.

Occasion queue state belongs to one authenticated session. Keep its token/role
workspace key, asynchronous request generation guard, and old page clearing.
These protect against displaying customer records from a previous session/filter.
Delivery location-read errors must remain recoverable through Retry locations.

Second-wave polish (uncommitted): the venue workspace gained a mirrored control
kit at `shared/venue/workspace/controls.tsx` (44px targets, ring focus, disabled
styling, both-theme variants) — extend THIS kit, do not fork another. Venue
completion is a scannable progress surface with explicit text states; capacity,
money-cases, payer-controls and practice files were rewritten for readability
with their pinned test strings kept verbatim. Merchant/ops workspaces consume
refined foundation tokens (additive API) with interpolated-amount confirms and
skeleton/empty/error parity. Admin scoped suites pass (23/23 venue, 44/44 ops;
full run 3273/3274 after waiting for the remount checkbox in the
venue-review-corrections test).

Wave 4 — POS-style module chrome on all pages (uncommitted): surveyed 36
(hydrogen) groups; groups with no chrome gained canonical `ModuleNavHeader`
layouts copying the settings/layout.tsx idiom — bookings, delivery-settings,
merchant-orders, occasion-requests, venue (kept its in-workspace tool nav;
module chrome sits above it), venue-completion, retail-tools, products,
notifications (section nav rewritten to delegate to ModuleNavHeader; fixed a
prod crash from the nonexistent PiCalendarClockDuotone export → PiCalendar),
sub-products (+from-pos gate to avoid double POS header), ecommerce
(role/plan-aware EcommerceNavHeader kept, deep-path highlighting fixed,
NOT swapped to static tabs); /banner is a redirect never rendered. 21 new
layout tests live in src/app/shared/test/ + per-group layout.test.tsx.
Shared fix owned outside agents: mobile Menu button in
shared/module-nav-header.tsx now min-h-[44px] (a11y button height); no
aria-label added because layout tests pin accessible name 'Menu' by visible
text. Applications breaking that pin must update all 8 layout.test.tsx files.
Final: 449 files / 3303 tests full admin suite green, tsc exit 0, lint net 0.
Known follow-ups (DONE 2026-10-27, uncommitted): BannerNavHeader migrated onto
ModuleNavHeader (banners now also get the sub-md Menu button; Banners
detail-route/create/analytics active matching preserved via activeModuleHref);
PriceCheckerHeader reduced to title block + Create-kiosk CTA (Kiosks/Analytics
tab duplicates removed; pc-heading nav CSS + responsive rules intentionally
kept for the CTA); routes.ts gained ops module keys
(bookings/deliverySettings/merchantOrders/occasionRequests/venue/
venueCompletion/retailTools) and the seven ops layouts resolve hrefs through
them. Remaining nicety: tenant-menu-items.tsx still uses literal hrefs (kept
to avoid churn in its pinned tests).

Handoff and verification: `docs/superpowers/specs/RESUME-ui-admin-polish.md`.

RSC regression fixed (2026-10-29): best-sellers.tsx lost its 'use client'
directive during the deep-link edit and Webpack shipped the hook call into
the RSC graph → "Attempted to call useDashboard() from the server". Directive
restored; the new structural guard src/app/shared/ecommerce/dashboard/
client-boundary.test.ts now enforces both dashboard RSC rules in the suite:
(a) any file calling client hooks must declare 'use client' before its first
import (dashboard-skeleton.tsx is the deliberate presentational exception);
(b) rizzui barrel imports are banned — sales-report/stock-report were caught
by the guard and converted to subpath imports (Badge→rizzui/badge,
Button→rizzui/button, Text→rizzui/typography). Guard proven by seeding a
probe file without the directive. Scoped state: 31 files / 130 tests.
Lesson: jsdom vitest + tsc cannot see RSC boundaries; changing directives or
imports in RSC-adjacent folders requires this structural check.

Wave 5+6 — /ecommerce dashboard cards + extras (this session, uncommitted):
services/dashboard.service.ts exports resolveDashboardParams (period white-
list, strict dates, inverted-range rejection) and normalizeDashboardData
(partial payloads degrade per widget; full ones byte-identical); skeleton
matches real plant heights; period switcher 44px + aria-pressed + aria-live;
retry has a response guard. Widget design: colocated widget-parts.tsx
(DeltaBadge never colour-only, MetricBox twins, LegendRow, EmptyState,
usePrefersReducedMotion) + profit-trend-chart.tsx; rizzui subpath imports
ONLY inside RSC (barrel pulls @headlessui/react and crashes);
order-status-breakdown is a horizontal bar chart (axis-is-legend) after the
radial-rings redesign; curve bump→monotone. Extras (additive): server
analytics passes topProducts.productSlug (analytics suites 18/18); service
type + normalize passthrough default ''; best-sellers rows deep-link to
routes.eCommerce.productDetails when slug present; stat-cards Orders card
links the orders listing (Revenue/AOV stay value-only — no target route);
new widgets today-momentum.tsx (today-vs-yesterday tiles) and
needs-attention.tsx (pendingOrders/lowStockCount + latest pending previews,
real routes only) placed in a 5/7 grid band with a matched skeleton band.
Verified: dashboard+services scoped 30 files/128 tests, layout tests 22/22,
tsc exit 0, lint 0 errors.
CONCURRENT-SESSION NOTE (2026-10-28): another session is actively landing a
platform-ops module, venue workspace tools (door/stations/waitlist/floor-
ops/print-jobs/device-bridge) and merchant panels (carrier/settlement) —
3 deterministic test failures exist in THEIR trees (delivery-settings-view,
merchant-orders-view duplicate role=alert, venue workspace.test.tsx stuck on
loading skeleton); dashboard-scoped suites are clean. Re-run the full admin
suite after that work settles before treating its failures as regressions;
do not patch those files from this workstream.
