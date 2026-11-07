---
title: Prompt — finish venue Phase 0 and implement Phase 1
date: 2026-10-19
status: executed-and-verified-locally-production-release-gated
---

# Copy the prompt below into the implementation chat

Work in `/Users/mac/Documents/drinksharbour`. Finish the remaining venue Phase 0 engineering and release-readiness work, then implement Phase 1 of the existing venue roadmap. This authorises local implementation, fixes, tests and documentation. Work through completion; do not stop at an audit or plan. Use one agent. Do not commit, push, deploy, enable production rollout, charge real money, send customer messages or mutate production data without explicit authorisation for that action.

## Read the existing decisions first

Read `CLAUDE.md`, `AGENTS.md`, applicable nearby instructions, and:

- `docs/superpowers/specs/RESUME-venue-phase-0.md`
- `docs/superpowers/plans/venue-phase-0/implementation-and-verification.md`
- `docs/superpowers/plans/venue-phase-0/review-corrections.md`
- `docs/superpowers/plans/venue-phase-0/tests-and-rollout.md`
- `docs/saas/venues/README.md` and chapters 02–08 for workflows, architecture and release boundaries.
- Chapters 09–12 for evidence, Odoo restaurant/SevenRooms nightlife requirements and phase placement.
- `docs/saas/venues/13-phase-0-review.md` and `docs/memory/venue-design.md`.

Inspect the current working tree and actual callers. Preserve unrelated work. Use applicable installed skills and local patterns. Write the folder/file map and exact implementation plan before changing runtime code; execute it yourself without subagents. Do not reopen decisions already accepted in the handoff.

## A. Close Phase 0 engineering gaps

The three reported defects were independently rechecked on 19 October: 2 real Mongo regression tests, 30 client tests and 7 Chrome journeys passed. Preserve these corrections: accepted served items remain collectible after menu removal; stock evidence matches the exact bill-line revision; failed checkout leaves booking quantities editable and reloadable. These results establish a baseline, not proof about subsequent edits.

1. Reproduce the current admin type-check failures and production build failures. The previous correction run recorded 362 diagnostics outside changed files and Google Fonts build-resolution failures. Recheck the actual state, group failures by cause, and fix them coherently. Do not suppress TypeScript, weaken validation, exclude failing application code, remove features or disable build checks to get a pass. Preserve the design when resolving font availability. Verify both admin and platform applications; correct any integration failures your work introduces.
2. Resolve the AuditLog timestamp/index-definition conflict in source. Inspect current indexes read-only where access is authorised. Provide an idempotent, reviewed index-preparation procedure with dry-run output and recovery steps; do not automatically drop or rebuild production indexes.
3. Complete and test local provider ingress/verification/recovery wiring. Preserve signed webhook verification, server-side provider verification, NGN/minor-unit precision, durable references, idempotency and no duplicate settlement. Unknown outcomes stay pending/reviewable. Use official Paystack documentation for current provider behaviour. Never substitute mocked success for provider certification.
4. If authorised test-mode credentials and a safe callback environment are available, run provider test-mode journeys and retain sanitised evidence. Otherwise finish the adapter/tests/runbook, name the exact missing configuration, and keep that gate pending. Do not expose secrets or attempt a live charge.
5. Produce a release-readiness checklist covering account mappings, tax ownership, fee funding/payout/refund responsibility, legacy obligations, location/staff/table mappings, publication grants, offline queue drain, worker readiness, compatible readers/indexes/writers, pilot switch and rollback. Clearly separate verified technical facts from decisions requiring the finance/operator owner. Do not invent approvals or use blanket default mappings.
6. Review the resulting source and run meaningful regression checks. Fix failures within the authorised scope. Keep canonical production rollout off until every applicable activation gate is actually satisfied.

Phase 0 engineering completion requires fresh passing checks for the affected applications and backend, retained correction tests, safe index tooling and documented provider/release evidence. Report external approvals separately. If an external gate remains, continue independent Phase 1 development behind disabled flags; do not call Phase 0 production-approved or enable functionality that depends on the unresolved gate.

## B. Implement Phase 1 — venue experience

Use chapter 08's Phase 1 and chapter 12's delivery placement as the scope. Create `docs/superpowers/plans/2026-10-19-venue-phase-1.md` and focused companion files if needed. Map each requirement to existing code, exact changes and acceptance tests, then implement it. Reconcile the broader reference chapters with these phase boundaries; do not attempt all Odoo/SevenRooms features at once.

Deliver integrated working features in the current system:

1. **Venue workspace:** role-aware overview, arrivals/request queue, current visits, floor access and operational exceptions. Reuse current navigation, tables, kitchen rounds and canonical checkout. Restaurant, bar, lounge and club configuration should affect relevant wording/actions without duplicating the tenant system.
2. **Location profiles and onboarding:** explicit location identity, venue types/services, address, timezone, hours/exceptions, public content, policies and publication readiness. Separate business identity, paid capabilities and public publication. Include configuration checklist and isolated staff practice journeys from the onboarding/reference design.
3. **Beverage menus:** location/service sections, ordering, serving sizes, eligible prices, publication and current availability using central Product → tenant SubProduct/Size. Public payloads exclude cost prices, supplier details and internal stock data. Keep prepared-food/recipe/modifier sales for their later phase.
4. **Request reservations:** customer request submission, reference/status view and authorised staff review, decline, amendment and check-in workflows. Clearly say “Awaiting venue confirmation” on submission. Do not imply instant capacity or collect deposits. Audit whether existing acceptance is safe: reuse authoritative allocation where proven; otherwise keep this slice request-only and defer capacity-confirming actions to Phase 2. Repeated submissions/actions are idempotent and stale edits return a recoverable conflict.
5. **Floor and host workflows:** versioned floor layout, zones/tables, list alternative, arrivals and visit actions through existing server authority. Editing layout cannot alter occupancy, silently move live guests, erase a visit or create another payable bill. Validate tenant/location ownership and recover from concurrent edits.
6. **Platform website:** evolve `/venues`, venue detail and explicit location/menu/request pages; add customer-owned reservation views through existing account/auth flows. Use server pagination/filtering and authoritative publication policy. Support venue subdomains through existing tenant resolution. Preserve sign-in return context and venue-local time. Provide accessible mobile layouts and loading/empty/error/retry states using the existing design system.
7. **E-commerce integration:** preserve the ordinary retail catalogue/cart/checkout. Venue service offers must not appear as deliverable retail stock. Hybrid businesses can link to their eligible retail offers through an explicit shopping journey. Reuse canonical beverage identity and truthful channel availability; never merge a reservation/service obligation silently into the merchandise cart.

Keep Phase 2 capacity/deposits/minimum spend/splits, Phase 3 food/recipes/production devices, Phase 4 events/guest lists/admissions, and later self-order/messaging/partner adapters outside this implementation. Record their dependencies without enabling placeholder buttons that imply they work.

## Non-negotiable integration rules

- Venue businesses remain Tenants; Vendors remain external suppliers. No duplicate product master, parallel billing engine or separate authentication system.
- Tenant authority comes from the authenticated context; scope every operation to its tenant and permitted location. Public slugs and client IDs do not grant staff authority.
- Preserve eligible paid-plan enforcement, narrow lapse completion, explicit publication grants and normal retail behaviour.
- Preserve one visit, one canonical payable Order and one set of payment/stock/accounting effects. Direct/walk-in visits have no new venue fee; future platform-sourced service follows the accepted 9%/Paystack-only rules. Preserve historical commercial terms.
- Reuse existing notification and permission services. Test messaging with isolated sinks; do not broadcast historical imports or test activity to customers.
- Keep sensitive guest data minimal and scoped. Public caches must never expose account, payment or staff data. Use NGN, explicit minor units and venue-local time; keep the existing alcohol age gate without claiming full compliance.
- Use small composable files, typed frontend contracts and the current backend conventions. Prefer additive, reversible schema evolution. Any migration needs preview, explicit ownership mapping, idempotency and a rollback/recovery plan.

## Verification and completion

Write failing behavioural tests before changes to business behaviour, observe the intended failure and make them pass. Prove cross-tenant/location denial, paid-capability enforcement, publication/privacy, retail regression, request idempotency, customer ownership, timezone handling, concurrent layout edits and check-in/bill uniqueness. Use real disposable Mongo replica-set tests for transactional/concurrency claims; never fall back to the application database.

Run fresh admin/platform type checks and production builds. Run the backend suite from `server` using `node --test '__tests__/*.test.js'`; use documented bounded concurrency/timeouts and the dedicated venue test URI when required. Retain the Phase 0 corrections and run relevant client tests plus browser journeys covering both staff and customer flows. Test actual Next.js routing/auth/subdomains in an appropriate local/test environment; intercepted component tests alone do not establish application integration. Use project scripts as inspected, not invented commands. Record exact commands, counts, skips, failures and environment limitations.

Before finishing, update the Phase 0 resume, create `docs/superpowers/specs/RESUME-venue-phase-1.md`, update the venue roadmap/status and `docs/memory/venue-design.md`. Record what is implemented versus gated, outstanding owner decisions, safe activation steps and how another session can resume. Do not mark a phase complete when requirements or checks remain unresolved.

Final response: state what is working, what was verified, what still blocks activation and links to the handoff files. Tag key claims [Certain], [Likely] or [Guessing]. Ask only for missing facts or external authority that genuinely block dependent work; continue all independent authorised work.
