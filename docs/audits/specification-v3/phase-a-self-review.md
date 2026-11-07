---
title: Phase A same-agent source review
updated: 2026-10-23
status: complete-author-review
---

# Review scope and findings

Reviewed implementation against `docs/prompts/implement-phase-a-transaction-safety.md`, the focused plan, actual frontend callers, public/protected order and payment routes, shared payment service and callbacks, wallet/gift funding/debits, canonical venue/integration guards, stock lifecycle, delivery, contact/dashboard consumers, exports and tenant notifications. One agent as explicitly requested; CodeRabbit CLI unavailable. This is author self-review, not independent security certification.

## Material findings fixed and pinned

| Finding | Correction and evidence |
|---|---|
| Public paid/lifecycle claims and foreign attachment/payment reads/refunds | Receipt evidence/authorization before effects; unit RED→GREEN and real HTTP/Mongo acceptance. |
| One receipt funding two new orders or an old wallet receipt being reused | Unique claims in order/stock transaction; changed fingerprints conflict; explicit historical Order reference guard; concurrency/legacy reuse RED→GREEN. |
| Wallet/gift funding accepted an existing marketplace payment | Saved purpose/customer/account/provider/reference/amount/currency/target; transactional credit/issuance; substitution RED→GREEN and once-only parallel verification. |
| Mixed merchant parent serialization and mutation | Allowlisted projections and scoped totals; receipt/list/export/contact/dashboard/notification consumers; deny merchant whole-parent commands. Both merchant JWTs and foreign reads/mutations checked. |
| Tenant product filter matched another merchant's line | Same-line tenant+subproduct predicate; real Mongo RED→GREEN. |
| New detail route intercepted customer history | Literal history route precedes dynamic ID; actual HTTP RED→GREEN. |
| Refund restock and misleading tenant payout notice | Monetary refunds never restock; notification shows own net merchandise without private terms/payout claims; offline rendering RED→GREEN. |
| Stricter guard blocked COD payment collection after delivery | Permit authorized cash/COD collection in shipped/delivered states; keep electronic receipt guard; actual stock shipment/delivery/collection RED→GREEN. |
| Unsupported Uploadthing error broke admin types | Valid FORBIDDEN rejection preserves access denial; offline auth RED→GREEN, types/build checks. |

## Boundaries retained

- Platform versus merchant-account callbacks and direct website customer/key isolation are separate. No fallback merchant secret, gateway change or ERM billing rewrite.
- No browser amount/status is monetary proof; authorization URL/method lookup alone does not settle. Provider receipts require saved identity and exact amount/currency. Uncertain/late/expired outcomes persist review evidence; no second charge or stock reacquisition.
- POS cash/split/account and venue canonical collection keep dedicated identities. Legacy stock authority is not overwritten. New marketplace receipts/order stock use existing transactional location/aggregate adapters.
- Platform operators have explicit role/permission checks and audit entries. Customer reads are allowlisted; tenant reads cannot expose competing lines, costs, provider payloads or whole-parent amounts as their own.

## Explicit limitations

Production preparation, hosted/provider certification, external website hookup, clean-lock CI and backup restore remain external. Old unbound receipts require operator migration/reconciliation. Unsupported Paystack/Korapay/stored-value monetary refund adapters fail; existing Stripe monetary refund can remain accounting needs_review until tenant reversal allocation is reconciled. Multiple partial refunds and independent merchant fulfillment are Phase D. No production feature was activated.

Automatic review rejected a proposed receipt-guard relaxation. It was not executed, and no alternate route was used to achieve it. The strict guard remains. Manual unintegrated card fields cannot declare payment complete.

The shared checkout gained an unrelated mandatory venue capacity test during verification. Its supported disposable fixture was supplied and its code/tests preserved. Timeout-affected venue files passed independently without changing assertions or limits. Exact final counts/skips/build evidence are in [verification](phase-a-verification.md). No material known in-scope bypass is intentionally deferred; absence of a finding is not proof of exhaustive security.


Final validation: complete backend4266 total/4248 passed/0 failed/0 cancelled/18 named skips; dedicated Phase A17/17 and direct website13/13; both frontend types and production builds passed. Prior fixture/timer failures remain recorded in the evidence rather than hidden. No additional runtime edits followed these final checks. Phase A stops here; production/Phase B remains separately authorized work.
