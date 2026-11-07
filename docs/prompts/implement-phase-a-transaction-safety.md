---
title: Implement Phase A payment trust and tenant order isolation
date: 2026-10-22
status: ready-for-implementation-chat
scope: V3-01-V3-02-V3-03
---

# Copy this prompt into the implementation chat

Work in `/Users/mac/Documents/drinksharbour`. Implement **Phase A Transaction safety** from `docs/audits/specification-v3/strategy.md`: V3-01 payment trust, V3-02 tenant-private order access and V3-03 fresh verification evidence. This authorizes local implementation, regression fixes, tests and documentation. Complete the work; do not stop at an audit, proposed plan or list of vulnerabilities.

Use one agent and the existing architecture. Preserve the dirty working tree and unrelated changes. Do not commit, push, deploy, activate production flags, change live accounts, make real charges/refunds, send customer messages or mutate production data. Do not print secrets. Ordinary local implementation choices are delegated; proceed without repeated confirmation. Report genuinely blocking business or external dependencies while completing independent work.

## Read before changing code

Read `CLAUDE.md`, `AGENTS.md`, applicable nearby instructions and these files:

- `docs/audits/specification-v3/strategy.md`
- `docs/audits/specification-v3/implementation.md` — V3-01/02/03.
- `docs/audits/specification-v3/architecture.md` — especially E07–E10.
- `docs/superpowers/specs/RESUME-independent-storefront-api.md`
- `server/services/storefront/README.md`
- `docs/superpowers/specs/RESUME-production-readiness.md`

Wyn City's website is already separate. Its API integration is implemented locally and remains opt-in; do not rebuild it or overwrite its stock/account authority. Retain Product/SubProduct/Size, Tenant, Warehouse/WarehouseStock, existing POS/venue identities and Mongoose. Vendor remains an external supplier. Country/language/currency settings, new payment providers and courier expansion belong to subsequent phases, not this safety fix.

Inspect actual source and callers: audit findings and old test counts are starting evidence, not proof that the current checkout still has each defect. Use relevant debugging, planning, test-first, backend, tenant architecture, security and verification skills. Record a focused file map and implementation plan in `docs/superpowers/plans/` before runtime edits, then execute it inline. Do not introduce an agent framework or dispatch subagents.

## 1 Fix payment trust without breaking valid purchases

Trace public and authenticated order creation, hosted initialization/verification/webhooks, attachment, payment-status reads/updates, wallet/gift-card checkout and refund paths. Start with:

- `server/routes/order.routes.js` and `server/routes/payment.routes.js`
- `server/controllers/order.controller.js` and `server/controllers/payment.controller.js`
- `server/services/payment.service.js`, `paystackWebhook.js` and `accounting.orders.js`
- `server/services/storefrontCheckout.service.js`, `storefrontSettlement.js`, `storefrontDirectWebhook.js` and `storefrontLocationOrders.js`
- The actual checkout callers in `client/apps/platform/src/app/checkout/page.tsx`, plus relevant wallet/gift-card/POS/venue services.

Customers and guests must not make an order paid, fulfilled or refunded through supplied status fields or payment objects. Settlement requires server evidence bound to the correct order/customer, provider/account, reference, exact amount and stored currency. A payment-method lookup is not settlement verification. Payment status reads require authorized ownership and safe projections too.

Preserve legitimate existing hosted-payment, wallet, gift-card, POS cash/split/account and supported COD behavior. Do not merely force every request to pending and strand purchases that the existing frontend creates after payment. Trace debit/receipt identities and prevent one payment, wallet debit or gift-card redemption from funding multiple orders. Prefer a narrow durable receipt/claim or idempotency mechanism where necessary; any schema/index changes need a safe preparation and rollback procedure.

Make attachment/refund/admin-payment commands enforce actor role, tenant/customer ownership, operation permission and eligible payment/order state before side effects. A tenant cannot refund or mark another merchant's portion paid. Unsupported provider refunds must fail explicitly; never fabricate success or restock from a monetary refund alone. Customer refund requests and privileged execution are distinct responsibilities.

Signed provider callbacks and server verification must be replay-safe and account-bound. Persist uncertain outcomes for reconciliation; do not issue another charge, overwrite a verified receipt, regress a settled state or reacquire released stock on late success. Preserve separate Wyn merchant credentials, marketplace account ownership and ERM billing. Do not migrate gateways or make a commercial provider decision in this phase.

## 2 Enforce tenant-private order access

Trace order lists/details/number/receipt lookups, exports, notifications, invoices, payment/status actions, cancellation and dispatch. A parent query filtered by `items.tenant` is not sufficient: serialize only the caller's permitted data.

Use reusable authorization and allowlisted order projections for platform operators, tenant staff and owning customers. Tenant identity comes from verified JWT authority. Tenant staff see only their own lines, relevant fulfillment/payment totals and permitted customer information; never competing merchant lines, costs, private revenue terms, other shipment details or whole-parent totals presented as their own. Customers see their own purchase information without internal cost/settlement metadata. Keep privileged platform access explicitly permissioned and audited.

Protect tenant mutations as well as reads. A merchant status/cancellation/payment action must not change the whole mixed-tenant parent or another merchant's money/stock. Implement scoped changes where already supported; otherwise refuse unsafe whole-parent commands with a clear review path. Full merchant child-order/shipment architecture remains Phase D; do not rebuild it here just to fix disclosure.

Unauthorized access must not reveal whether a foreign record exists. If guest access is supported, use an authenticated or signed, scoped access proof; an order number plus an entered email is not proof of identity. Preserve the separate website's existing tenant customer token and issuing-key isolation.

## 3 Verify behavior with meaningful tests

Write failing behavioral regressions first and confirm they fail for the intended missing guard or side effect. Implement the smallest coherent fix; keep focused modules around200–300 lines and avoid unrelated refactors.

Required acceptance journeys:

1. Guest/customer forged paid/confirmed/fulfilled/refunded payloads cannot settle money or issue stock; legitimate verified purchases still complete through their actual callers.
2. Wrong customer, tenant, account, reference, currency, amount, expired proof or provider status cannot attach a payment, read private payment data or execute a refund.
3. Parallel/replayed checkout, receipt attachment and webhook events cannot duplicate an order, wallet/gift-card debit, accounting entry, stock effect or refund. Test a verified receipt reused for a different order.
4. For a two-tenant basket, each merchant's list/detail/export/notification view contains only its own permitted records and correct scoped totals. Foreign reads/mutations are denied; owning customer and permitted platform views remain usable.
5. Mixed-tenant status/cancellation/payment requests cannot alter another tenant's lines, money, inventory or delivery state.
6. Existing direct website checkout, merchant callback, customer-owned history, stock holds, late-payment recovery and channel reporting still pass. POS, venue, purchasing, stock and delivery regressions remain green.
7. Tests exercise real HTTP auth and disposable-Mongo transactions/concurrency where needed. Mock external provider transport, not the core authorization, ownership or financial behavior being tested. No live provider charge or application DB fallback.

Run focused tests and then the full backend command from `server`: `node --test '__tests__/*.test.js'`, using the supported Node version. Localhost fixtures may require sandbox approval; request the needed tool escalation rather than weakening tests. Run the opt-in direct-storefront integration suite against its strictly validated disposable database when available. If frontend contracts change, update their real callers and run the affected frontend tests, type checks and production build.

Do not disable gates, skip failing application tests or claim historical counts as current verification. The prior API session recorded4,162 backend passes/37 skips and13 dedicated DB/HTTP passes; collect a new baseline and final result. Name any failures/skips and distinguish environment restrictions from product defects. Review the final code for bypasses and secondary callers; fix material issues before declaring completion.

## 4 Completion and durable handoff

Update `docs/superpowers/specs/RESUME-phase-a-transaction-safety.md`, a focused entry under `docs/memory/`, the exact plan/progress and the strategy/backlog status. Record changes, preserved contracts, tests/counts/commands, migrations/index needs, rollback, remaining external gates and any unresolved findings. Do not mark V3-01/02 done while a known in-scope bypass remains.

Report the outcome plainly: fixes delivered, verification evidence, material limitations and the next phase. Local Phase A completion does not approve production release or activate the later currency/language/country/payment/delivery expansion. Stop after Phase A is implemented and verified; do not start Phase B silently.
