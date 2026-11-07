---
title: Phase 1 implementation review
date: 2026-10-22
status: local-engineering-verified-production-disabled
---

> Final25October update: all reviewed defects and later verification blockers are fixed. Full backend4316pass/0fail/0cancel/18explained nonvenue skips, browser3/3, both builds/types and all client checks pass. Local engineering signoff is complete; production approval remains separate. See [current handoff](../../superpowers/specs/RESUME-venue-phase-2.md). The dated independent findings below retain historical evidence.


# Phase 1 implementation review

**22 October correction update:** User authorised fixes. All three findings below are corrected locally with retained failing-then-passing Mongo/HTTP regressions. Focused clients53, strengthened application browser2 and both type checks pass. The full backend run is not green:3 failures,6 timed-out suites,18 skips; final venue-only recheck and exact failure details are in [correction evidence](../../superpowers/plans/venue-phase-1/review-corrections.md). The original findings/results below remain historical. No production activation is approved.

**23 October closeout:** Final source passed all90 venue backend tests, with0 failures/cancellations/skips, including all3 new regressions and the4 venue suites that timed out in the broader run. All three review findings are fixed locally. The3 non-venue failures and2 non-venue timeout suites remain outstanding; the full repository suite is not green. [Final evidence](../../superpowers/plans/venue-phase-1/review-corrections.md).

**[Certain] Phase 1 is substantially implemented, but is not ready for signoff.** Independent review reproduced a customer-data access bypass and two operational defects. The 20 October implementation/verification record remains historical evidence; it does not cover these cases.

[Design index](README.md) · [Phase 1 plan](../../superpowers/plans/2026-10-19-venue-phase-1.md) · [Current handoff](../../superpowers/specs/RESUME-venue-phase-1.md)

Review scope: the current shared working tree, including uncommitted code. One agent; source inspection and isolated tests. No runtime fixes, production-data changes, provider charges, messages, migration apply, deployment, commit or push.

## 1. [P1] Reservation-list query can replace the authenticated customer

**Evidence [Certain]:** [venue-experience.routes.js](../../../server/routes/venue-experience.routes.js), line 18, passes `{customerId:id(req.user),...req.query}` to `ownedRequests`. The later query spread overwrites the trusted identity. [reservations.js](../../../server/services/venue/reservations.js) then uses that supplied ID as `Booking.createdBy` without another authenticated-customer check.

**Reproduction:** create customer A with no requests and customer B with a private request in disposable Mongo. Authenticate as A. `GET /api/venue-experience/me/requests` returns zero items. The same token requesting `GET /api/venue-experience/me/requests?customerId=<B_ID>` receives HTTP 200 and B's request, including guest name/phone, visit time, party size, reference and policy. Knowing the other customer's ID is sufficient; their booking reference is not required. The route is intentionally reachable while the experience flag is disabled, so that flag does not contain this defect.

**Required correction:** explicitly allowlist pagination fields and derive customer identity exclusively from authentication. Pin an HTTP regression proving query/body/header identity attempts cannot read another customer's requests, including while the experience flag is off. Keep legitimate own-request access after delisting/lapse/pause.

## 2. [P2] A hidden beverage prevents saving its unpublished menu entry

**Evidence [Certain]:** [experience.js](../../../server/services/venue/experience.js), lines 46–47, reprices every submitted menu item, including existing entries with `published:false`. Live pricing rejects hidden/discontinued/archived SubProducts.

**Reproduction:** save a menu containing an eligible published beverage; mark that SubProduct hidden; uncheck its menu publication and save at the correct configuration version. `saveConfiguration` throws `NOT_FOUND`. The manager cannot save that unpublication or unrelated edits while retaining the unavailable entry. Removing the entry completely is a workaround; it does not make the publication control work.

**Required correction:** retain safe tenant-owned unpublished references without demanding current sale eligibility. Validate actual tenant/size ownership independently; require live eligibility when publishing/adding a sellable offer. Test hidden/discontinued/archived entries, unrelated menu edits, foreign references and re-publication denial. Preserve Phase 0 accepted-line protections.

## 3. [P2] Discovery filters run after a global 300-location cut-off

**Evidence [Certain]:** [public-experience.js](../../../server/services/venue/public-experience.js), lines 31–40, selects at most 300 location candidates before applying tenant slug/city and current publication eligibility. [Venue overview page](../../../client/apps/platform/src/app/venues/[slug]/page.tsx), line 18, returns `notFound()` for an empty item list even when the API supplies a continuation cursor.

**Reproduction:** insert 300 earlier reviewed locations for another active published tenant and one later valid reviewed location for the requested tenant. `listLocations({slug:target})` returns `items:[]` and a next cursor. The target's direct detail endpoint and a second list call using that cursor both succeed. The tenant overview consequently returns 404 instead of allowing discovery of its valid location; city filtering can likewise report a false empty page. The branded-home lookup uses the same bounded filtered listing.

**Required correction:** apply tenant/city/current-publication selection before page boundaries, or scan until an eligible page/exhaustion without treating an intermediate empty chunk as not found. Preserve bounded queries and stable cursor semantics. Test more than 300 preceding unrelated/stale candidates through both list API and actual tenant overview/home pages.

## Phase 1 scope assessment

| Requirement | Inspected implementation / qualification |
|---|---|
| Staff workspace | Present: assigned-location overview, request queue, visits/exceptions, canonical bill/POS/preparation entry points |
| Profiles/onboarding | Present: versioned content, hours/exceptions, policies, publication review and device-local practice; practice is not operator certification |
| Beverage menus | Present: sections/order/size/pricing/public projection; finding 2 blocks part of maintenance |
| Request reservations | Present: request-only submission, owner status/cancel, review/amend/decline and canonical arrival; finding 1 breaks owner privacy |
| Floor/host | Present: versioned configuration, physical table checks/list view and canonical transactional check-in |
| Customer platform | Directory, tenant/location/menu/request and owned-account source present; finding 3 breaks filtered discovery at scale |
| Retail integration | Existing Product/SubProduct identities and retail/venue channel guards retained; focused backend boundary tests pass |
| Later reference features | Capacity/deposits/splits, food/recipes/devices and event/admission workflows remain later phases, not missing Phase 1 deliverables |

## Fresh verification — 22 October

- Venue backend: **87 passed, 0 failed, 0 skipped** in 139.8 seconds, including real disposable Mongo tests.
- Focused admin clients: **53 passed across 11 files**, zero failures.
- Admin and platform standalone type checks: **both exit 0**.
- Independent disposable probes: **all three defects reproduced**; a passing probe means the defect was observed, not corrected.
- Actual Next application browser: **2/2 passed in 3.3 minutes with fresh isolated generated output**, covering customer request/owned status, staff canonical arrival, lapse completion, signed-out return and Host isolation. The initial reused-output run failed both cases on missing location/request pages (404); fresh output restored the missing generated route entries. Both the initial failure and successful rerun are retained. These fixture journeys do not exercise the three review defects or hosted Paystack/password login.
- Full backend/client suites and production builds were not rerun in this review. Their 20 October results remain historical. Hosted Paystack, finance/operator and deployment gates remain unapproved.

Commands: backend from `server`, with the strict dedicated test URI, `node --test --test-concurrency=2 --test-timeout=60000 '__tests__/venue*.test.js'`; admin focused `npm test -- src/app/shared/venue src/services/venue src/config/route-roles.test.ts src/config/plan-capabilities.test.ts --maxWorkers=1`; each app `npm run type:check`; application browser `playwright test --config playwright.venue-application.config.ts` and an isolated-output review configuration.

For the successful browser rerun, a temporary copy of the existing Playwright configuration preserved every test/server/fixture and overrode each web-server environment with `VENUE_NEXT_DIST_DIR=.next-venue-review22-clean`; browser output went to `/private/tmp/venue-phase1-review22-browser-clean`. The temporary config was removed afterwards. Test servers and the review-owned Mongo process were stopped; helper-owned test databases were dropped. Temporary Next-generated include paths were removed from application configuration.

Logs: `/private/tmp/venue-phase1-review-{backend,client,admin-types,platform-types,browser,browser-clean,probes}-22.log`. Probe script: `/private/tmp/venue-phase1-review-probes-22.cjs`, using `drinks_venue_test_phase1_review22` with helper-owned per-process databases. Temporary files may be cleared; the reproductions and root causes above are the durable record.

## Disposition

Correct the three findings, retain failing-then-passing regression tests and rerun affected checks before declaring Phase 1 complete. The customer identity override is the first priority. Engineering signoff and external production activation approval remain separate. This review did not apply application fixes.
