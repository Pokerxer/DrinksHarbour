# Venue frontend polish — 27 October 2026

Both `/venues` directory paths remain intentional: `VenuesDirectory` while `VENUE_EXPERIENCE_ENABLED` is disabled, location-led `venue-directory` otherwise. Apply UI fixes to the actual flag path; do not delete either during visual cleanup.

Legacy booking `datetime-local` defaults must use browser wall time, not UTC ISO text. Feature-enabled location requests use the venue's declared timezone through `commerce-core`.

Customer reservation pagination encodes cursor values, disables duplicate loads and ignores stale responses/errors. Signed-out customers get sign-in recovery preserving their reservation reference.

Visual direction preserves existing Kavoon/stone/burgundy/amber branding, responsive venue photos, accessible focus and clear confirmation/payment wording. The admin workspace selected tool is visually distinct and readiness states have explicit text.

Wave 3 — venue routes + backend (uncommitted): `/venue` and `/venue-completion`
have route `loading.tsx` skeletons (admin root `error.tsx` intentionally NOT
duplicated); the workspace tool now deep-links via `?tool=` — keys validated by
`shared/venue/workspace/tool-search.ts` (`resolveVenueTool`), written only from
user actions via guarded `history.replaceState`, "Reload venue status" keeps the
current tab, only a location switch resets; non-managers deep-linking a manage
tool fall back to overview. capacity-settings and payer-controls gained Retry;
venue-completion shows "Visits awaiting action: N" with sr-only announcement and
focus on the first pending button. Client suites: 28/28. Backend hardening
(companion handoff: docs/superpowers/specs/RESUME-venue-backend-hardening-2026-10-27.md):
bounded booking text fields, stable sorted + legacy-capped `GET /api/bookings`
with opt-in `?limit=1..100`+`after` cursor, floor-table/tab payload bounds,
new actor-keyed `middleware/venue-rate-limit.middleware.js` (staffCommands
300/15m, staffConfigurations 60/15m, staffSupport 60/15m, customer cancel
20/1m — generous, documented), menu-candidates N+1 removed, `.lean()` on
listTables, Booking request-queue compound index added, new
`server/__tests__/venueBackendHardening.test.js` (9 pure-logic tests). All
changes additive opt-in; money/version/consent/idempotency rules preserved
(replay-by-hash verified). Final verdicts: 47/47 pure set, 10/10 mongo spot
set, route coverage clean; 28/28 rerun independently post-close.

Second-wave polish (uncommitted): `venues/error.tsx` is now a branded recovery
card; `[slug]` page matches the directory language with encoded cursor; reserve
page has a CLS-free skeleton; request form validates on blur and focuses the
first invalid field; availability/payer/owned-requests states carry icon+text
always; both directory paths retained. Platform venue suite: 9/9 tests, tsc 0.

Full scope and verification: `docs/superpowers/specs/RESUME-ui-venue-polish.md`. All changes remain local and uncommitted.
