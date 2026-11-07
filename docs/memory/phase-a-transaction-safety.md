---
name: Phase A payment trust and tenant-private orders
description: Server-owned marketplace settlement, one-use receipts, safe merchant projections and fresh transaction verification; production activation remains gated.
type: project
updated: 2026-10-23
---

Phase A V3-01/02/03 implemented locally with one agent; no commit/push/deploy, production mutation, actual financial transaction or customer messages. Resume from `docs/superpowers/specs/RESUME-phase-a-transaction-safety.md`; exact evidence in `docs/audits/specification-v3/phase-a-verification.md`, execution progress in `docs/superpowers/plans/2026-10-22-phase-a-transaction-safety.md`, storage preparation/rollback in `docs/operations/phase-a-transaction-safety.md`.

Never trust public order status/payment objects or a gateway method lookup. New marketplace claims bind saved platform provider/account/reference/user/purpose/amount/currency; checkout order+receipt+stock commit in a transaction. Wallet/gift debits and funding/card issuance are once-only and purpose-bound. Historical wallet receipts already stored on an Order cannot be reused. Never mark historical generic gift redemptions as checkout receipts without reconciliation.

Use shared orderAccess projections/permissions for every order reader and mutation. Filtering parents by items.tenant is insufficient. Tenant totals include only own merchandise less own discounts; mixed shipping/tax are unallocated. Merchant whole-parent mixed-order commands refuse pending platform review. Customer history requires actual Order.user. Entered email is not proof. Guest COD has a signed24h read-only order proof. Keep separate website key/customer/account isolation and canonical POS/venue workflows.

Actual post-payment frontend callers use durable retry headers; do not retry an uncertain payment with another key/method. Old unbound hosted/funding references need reviewed migration. Unsupported monetary refunds fail explicitly; refunding money never proves goods returned. Existing Stripe refund path is durable and scoped but allocated refund accounting/multiple partial refunds remain review/Phase D concerns.

Dedicated acceptance17/17 and direct website13/13 passed. Full backend/node22 and frontend final evidence is recorded in the resume/evidence files; do not quote old test totals as fresh verification. Automatic review rejected receipt-guard relaxation; strict guard retained. The one-line Uploadthing FORBIDDEN compatibility fix preserves denied access and passes its regression. No subagent or independent review.


Final measured backend:4266 total/4248 passed/0 failed/0 cancelled/18 named skips, exit0,266.0s with4 workers, supported disposable venue fixture and temporary idle-sleep prevention. Earlier monitor/timer failures are retained in evidence; all affected files passed in the final run. Both frontend type checks/builds passed. Phase A17/17 and direct13/13 have no skips;16 other opt-in DB groups remain unexecuted. Local implementation/verification complete, production gated. Own29128/29129 Mongo fixtures stopped; existing venue29127 preserved. Stop after Phase A.

2026-10-23 status recheck requested by user: inspected actual payment/receipt/refund/ownership/projection/guest and checkout-retry callers; Phase A source is implemented locally. Fresh focused backend53 total/52 passed/0 failed/1 opt-in Mongo skip, same on localhost-enabled rerun; platform helper tests6 passed. No runtime edits, full-suite/Mongo/build reruns, production activation or Phase B work in this status-only turn. Earlier comprehensive counts remain historical evidence; see resume for exact distinction and logs.

2026-10-26: user subsequently authorized multi-agent next phases; prior stop-after-A rule is historical. See current global-platform-phases memory/resume/verification. PhaseA17/direct13 freshly pass; full backend4352pass0fail18namedskips,16otherDBgroups unexecuted. B implemented locally, actual separate website C verified, D remains partial; no production/commit/real money actions. All task-owned disposable Mongo fixtures now stopped.
