---
name: Separate website API and shared location stock
description: Opt-in merchant-owned direct channel with existing catalogue/customer APIs, location reservations, separate Paystack and order reporting.
type: project
---

2026-10-22 user clarified Wyn website already separate, then said work on API integration. Implementation lives in server only. Handoff `server/services/storefront/README.md`; resume `docs/superpowers/specs/RESUME-independent-storefront-api.md`; plan `docs/superpowers/plans/2026-10-22-independent-storefront-api.md`.

StorefrontChannel binds Tenant+website key+Warehouse+channel+merchant account ref+HTTPS return origins; operator flag off by default. Namespaced env `STOREFRONT_PAYSTACK_<ACCOUNT>_SECRET_KEY`, never platform fallback. Explicit database and super-admin reviewed preview/apply script, no live config applied. Shared WarehouseStock/OnlineStockReservation batches and movement transactions for website/mapped marketplace; actual POS issue guard shares balances. Old orders retain legacy authority. Direct retail price/zero marketplace fee; bank journal with storefront source. Customer token saved at checkout, key/customer-owned order history, verified-paid channel report. Signed merchant callback verifies same account/reference and handles late payments as review. Generic payment/cancel cannot bypass website settlement.

Final dedicated disposable Mongo/HTTP tests13/13 passed; final full suite4199 total/4162 passed/0 failed/cancelled/37 skipped after all code changes. Syntax/whitespace checks pass. No deployment/commit/push/production mutation. Existing broad marketplace payment trust and mixed-tenant parent-order disclosure remain separate launch prerequisites; API task does not certify/fix those. No automatic refunds, global countries, food or UK work added. Keep keys on external website server. Disable website via channel enabled=false, not deleting authority flag/mapping.
