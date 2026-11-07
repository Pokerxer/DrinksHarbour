---
title: Prompt — finish venue Phase 1 signoff and implement Phase 2
date: 2026-10-23
status: ready-to-use-prompt-not-executed
---

# Copy the prompt below into the implementation chat

Work in `/Users/mac/Documents/drinksharbour`. Resolve the remaining backend verification failures from the venue Phase 1 handoff, complete engineering signoff with fresh evidence, then implement Phase 2 of the existing venue roadmap: reliable bookings and money. This authorises local investigation, implementation, dependency repairs, tests and documentation. Execute the work; do not stop at a plan. Use one agent, preserve unrelated work and do not commit, push, deploy, enable production flags, charge real money, send customer messages or mutate production data without explicit authorisation for that action.

## Read and establish the actual starting state

Read `CLAUDE.md`, `AGENTS.md`, nearby instructions and relevant installed skills. Then read:

- `docs/superpowers/specs/RESUME-venue-phase-1.md`
- `docs/superpowers/plans/venue-phase-1/review-corrections.md`
- `docs/saas/venues/14-phase-1-review.md`
- `docs/superpowers/plans/venue-phase-1/verification.md` and `operations.md`
- `docs/superpowers/specs/RESUME-venue-phase-0.md`
- `docs/superpowers/plans/venue-phase-0/contracts.md`, `live-checkout.md`, `completion-continuity.md`, `provider-readiness.md` and `release-readiness.md`
- `docs/saas/venues/README.md` and chapters 02–08, especially payments and delivery boundaries.
- Chapters 09–12 for reference evidence, Odoo/SevenRooms adaptations and shared contracts.
- `server/services/venue/README.md` and `docs/memory/venue-design.md`.

Inspect current source, actual callers and working-tree changes. Historical test counts are baselines, not proof about today's checkout. Keep existing accepted decisions. Write the folder/file map and executable tasks before changing runtime code. Use small focused plan/contract files, then implement them yourself without subagents.

## A. Finish Phase 1 engineering verification

All three reviewed defects were fixed locally: authenticated customer identity cannot be overridden; unavailable unpublished menu entries remain editable with ownership checks; discovery handles older unrelated/stale locations, stable cursors and canonical `Tenant.address.city`. Preserve their retained tests and the earlier Phase 0 accepted-price, exact batch-revision and checkout-recovery fixes.

The last correction task passed 90 venue backend tests, 53 focused client tests, 2 actual Next application journeys and both type checks. The broader attempt recorded 4,204 tests: 4,177 passed, 3 failed, 6 cancelled and 18 skipped. Four cancelled venue suites subsequently passed in the final isolated venue run. Do not rerun old fixes unnecessarily or describe the full suite as green.

Reproduce and resolve these remaining issues using current source:

1. `server/__tests__/delivery.dispatch.test.js`: tenant-scoped mixed-order dispatch conflicts with `orderAccess.assertSingleTenant`. Trace fulfilment ownership and the current platform/merchant allocation contract. Correct the implementation or stale fixture as evidence warrants; never remove tenant isolation or let one merchant mutate another merchant's slice just to pass.
2. `server/__tests__/dependencyCompatibility.test.js`: installed `@huggingface/transformers` was missing. Inspect declared dependencies, lockfiles, actual installation and model/image consumers. Restore a compatible declared runtime and verify native image processing. Do not replace it with a stub, skip the assertion or silently change the selected AI model. Use official dependency documentation for version-sensitive decisions and normal approval handling if network installation is needed.
3. `server/__tests__/revenueAgreementOrder.test.js`: pricing fixture failed on `req.get is not a function` before its intended database-write sentinel. Trace real route/request contracts and fix the actual defect or deficient fixture. Keep meaningful assertions on the server-derived discounted commission split, total and tenant/size ownership.
4. `server/__tests__/subproductGuardConsistency.test.js` and `tenantNotificationDelivery.test.js`: timed out. Reproduce in isolation without competing Next builds/type generation, identify open handles, unresolved mocks, real network/DB fallthrough or resource contention and repair the cause. Use isolated message sinks; no real mail/SMS/WhatsApp delivery. Do not merely increase global timeouts.

Write failing regressions before business-behaviour changes. Run targeted checks and then the full backend suite in isolation. Explain every remaining skip and any newly configured test-database requirements; do not report a successful suite with hidden failures or unexplained cancellations. Recheck both app types/builds and affected client/browser journeys. Distinguish corrupted generated Next output from source failures: preserve/rebuild disposable caches safely, never exclude application code or suppress TypeScript/build checks. The existing browser config accepts `VENUE_TEST_DIST_DIR` for a fresh output directory.

Finish all independently actionable engineering work. If an external credential, owner decision or sandbox approval genuinely blocks a dependent step, record the exact blocker and continue independent Phase 2 development behind disabled flags. Do not mark Phase 1 engineering verification complete until its required checks pass, and do not infer production approval from local success.

## B. Implement Phase 2 — reliable bookings and money

Use Phase 2 in chapters 08 and 12 as the boundary. Create `docs/superpowers/plans/2026-10-23-venue-phase-2.md`, focused capacity/money/UI/test companions as needed, and `docs/superpowers/specs/RESUME-venue-phase-2.md`. Audit existing schemas, unique indexes, payment attempts, receipts, allocations, recovery workers and legacy callers before fixing exact interfaces. Phase 0's single full-bill collection slot must be deliberately extended for deposits and multiple payers; do not bolt extra sales onto it.

Implement working end-to-end slices in this order:

1. **Authoritative capacity and availability.** Model tenant/location resources, service intervals, seating duration, buffers, combined-table ownership, holds and explicit expiry. Preserve venue timezone/business-date rules. Use transaction-safe allocation with a proven conflict strategy: two transactions cannot both confirm overlapping use of the same physical resource, even with different document IDs. Do not rely on a read-before-insert overlap query or TTL deletion alone. Expired holds stop blocking before cleanup. Versioned configuration changes cannot invalidate live commitments silently. Availability responses reflect current authoritative capacity, not cached guesses.
2. **Request acceptance and booking lifecycle.** Evolve existing request-only Bookings compatibly. Keep request-only mode where configured; offer instant confirmation only where the capacity contract is implemented and enabled. Staff acceptance acquires the required claim before promising a table or inviting payment. Support reviewed changes, cancellation/expiry and arrival through the existing canonical check-in. Repeated or concurrent commands produce one booking/claim/visit and a recoverable conflict when stale. Rescheduling must either secure the new interval atomically or leave the original valid commitment intact.
3. **Deposits as verified advances.** Snapshot an approved amount, currency, deadline, cancellation/no-show/refund terms and credit eligibility. Use existing Paystack adapters and durable server-generated payment attempts. No deposit before request acceptance in request mode. Deposit collection creates a verified receipt/advance, not duplicate merchandise revenue or a second final sale. Link pre-visit booking obligations to the canonical visit/bill exactly once at arrival. Apply available credit once, only up to the bill balance; preserve excess as an explicit unapplied amount for approved resolution. Unknown provider outcomes remain pending and cannot trigger a second charge.
4. **Late payment, cancellation and refunds.** A verified receipt must never be discarded because capacity expired or another payer settled first. Reacquire valid capacity if possible; otherwise record a visible paid-needs-resolution case with safe rebooking/refund handling. Implement durable operator queues, scoped permissions, reasons, evidence, audit and retry/reconciliation. Snapshot policy versions; do not retroactively replace agreed terms. Refunds/reversals cannot exceed the original refundable amount, must reverse original commercial allocations correctly and cannot erase receipts or automatically restock served goods. If provider execution or policy approval is unavailable, finish and test the adapter/review workflow while keeping the affected live operation disabled; do not falsely mark a manual case refunded.
5. **Minimum-spend policy.** Snapshot eligible consumption, exclusions, discounts, shortfall treatment, tax and commercial classification. The deposit is an advance, not eligible consumption. Implement `shortfall=max(0,minimum-eligibleNetSpend)` and subtract only valid credits/payments from the resulting total. A disclosed shortfall needs an explicit supported financial line and approved accounting treatment; do not invent a beverage Product, duplicate minimum line or bypass the beverage-only catalogue guard. Keep pending policy configuration inactive.
6. **Exact splits and mixed tender.** Retain one canonical payable Order with independent payer allocations, not separate sequential sales. Support exact amounts, deterministic equal-value remainders and seat/item allocations where the model can prove ownership, preserving immutable accepted line/revision identity. Atomically reserve each payable portion so concurrent payers cannot claim the same balance. Distinguish reserved, pending, received, applied, failed and refunded amounts; do not close with an unexplained outstanding balance. Extend cash only through existing legitimate direct-visit drawer authority. Platform-sourced service remains Paystack-only under accepted terms; screenshots are not verified bank-transfer receipts. Do not introduce wallet, house-credit or offline collection without their separate approved contracts.
7. **Integrate staff and platform UI.** Extend the existing venue workspace, request/host/floor flows, canonical checkout and support exceptions. On the platform and tenant subdomains, implement truthful availability, quote/policy review, hold countdown, deposit handoff, pending/confirmed/expired recovery and customer-owned booking management. Add scoped payer entry without exposing the organiser's phone, booking account or refund authority. Display currency, amount due now, credit, remaining balance, deadlines and fees before commitment. Preserve chosen context through sign-in, refresh, reconnect and overseas venue-local time entry. Provide accessible mobile/list alternatives and usable loading/error/retry/conflict states; no placeholder buttons claiming unsupported money operations work.

## Policies, approvals and integration boundaries

- Venue businesses remain Tenants; external suppliers remain Vendors. Preserve Product → SubProduct → Size, existing auth/permissions, Warehouse location identity and the accounting/stock foundations. No duplicate catalogue, parallel cart, replacement payment provider or second billing engine.
- Tenant/customer/location identity comes from authentication and authorised ownership checks. Query/body/header/slug/token guesses never grant broader access. Preserve private no-store boundaries and explicit public publication approval.
- Keep active paid entitlement and narrow existing-obligation completion after lapse; suspension/disabled-tenant denial remains authoritative. New bookings/service follow capability policy. Financial recovery must not become a general new-service bypass.
- Preserve existing retail agreements and historical money. Platform-sourced venue merchandise follows accepted versioned9% terms, Paystack-only; direct/walk-in has no new venue fee. Deposits do not earn a second merchandise commission. Minimum-spend shortfall/refund/provider-fee treatment needs approved distinct policy; do not invent a9% fee on every new financial line.
- Separate engineering choices from business/tax/legal decisions. Before enabling a charge, require named/versioned decisions for cancellation windows, no-show/forfeiture, deposit amounts, minimum eligibility, shortfall classification, excess credit, refund authority/funding, tax and account mappings. Prepare concrete configuration and examples for review. Unapproved drafts are not active defaults. Ask only where a missing decision actually blocks dependent work, while continuing independent implementation.
- Check current payment/refund/channel behaviour against official Paystack documentation. Use provider test mode only with authorised credentials and a safe callback/webhook environment. Synthetic signatures and fake-provider success prove local contracts, not hosted certification. No secrets in logs or browser bundles; no live charges or customer broadcasts.
- Evolve schemas/indexes compatibly; preview duplicates and legacy mapping before unique indexes or backfills. Provide idempotent dry-run/apply/recovery tooling with explicit target databases. Never guess a legacy booking/hold/payment association. Rollback disables new commitments while preserving receipts, allocations and fulfilment history.
- Keep Phase 3 prepared food/recipes/modifiers/station hardware and Phase 4 events/guest lists/tickets/admissions deferred. Odoo/SevenRooms reference features inform workflows; this phase does not claim full parity or direct proprietary integrations.

## Acceptance and verification

Use fail-first behavioural tests, real HTTP/auth tests, real concurrent disposable Mongo replica-set tests and actual Next browser journeys. At minimum prove:

- Overlapping table/combined-table claims and amendments cannot oversell under concurrency; buffers, hold expiry before TTL cleanup and venue-local/DST boundaries behave correctly.
- Repeated staff acceptance, arrival, deposit callback, webhook, verification, allocation, payer collection and recovery do not duplicate obligations, receipts, stock effects or revenue.
- Wrong tenant/customer/location/payer, stale versions, revoked access and invalid provider reference/amount/currency/purpose are denied; invalid signatures do not mutate money.
- Late paid/expired holds and concurrent overpayments remain traceable and recoverable; provider failures, worker crashes and browser reconnect never invite duplicate payment or silently lose funds.
- Minimum ₦200,000/deposit ₦50,000/eligible spend ₦230,000 leaves ₦180,000 due; spend ₦160,000 produces ₦40,000 shortfall and ₦150,000 due, before separately configured tax/fees. No minimum, spend ₦40,000/deposit ₦50,000 allocates ₦40,000 and leaves ₦10,000 unapplied, never a negative collection or automatic tip.
- ₦10,000 split three ways is333,334+333,333+333,333 kobo. Simultaneous payer claims cannot exceed the available balance. Failed/expired claims release appropriately; verified late receipts remain explicit. Partial refund retries cannot exceed original credit or duplicate reversals.
- Retail-only tenants, hybrid shopping, existing full-bill cash/Paystack, Phase0/1 corrections and safe completion after lapse remain intact. No food/event/offline promises leak into this phase.

Run targeted tests, then the full backend command from `server`: `node --test '__tests__/*.test.js'`, using the inspected dedicated venue test URI and documented bounded concurrency/timeouts. Use helper-owned databases only; never fall back to application data. Run the full affected client suites, both standalone types and production builds, and real staff/customer/booking/deposit/split/recovery browser journeys. Avoid overlapping heavy builds, type generation and the full backend suite. Explain any separately configured integration suites; no silent skips, blanket timeout increases, source exclusions or validation bypasses.

Record exact commands, counts, failures, cancellations, skips and provider/environment limitations. Update Phase1 closeout, Phase2 plan/contracts/resume, venue roadmap and `docs/memory/venue-design.md` so another session can resume without chat history. Review source after changes and retain genuine failing-then-passing regressions. Mark completion only for implemented, verified requirements; keep external activation approvals separate.

Final response: state what works, what was tested, what still blocks activation and link the handoff files. Tag key claims [Certain], [Likely] or [Guessing]. Do all authorised independent work before requesting any genuinely necessary external approval.
