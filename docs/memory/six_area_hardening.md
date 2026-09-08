# Six-area implementation — 2026-09-07

Custom-role auth reads active tenant roles and exposes effective permissions.
Only explicit inventory/settings actions accept additive grants; platform guards
remain fixed. API keys are hashed, scoped, capability/status checked on every
request and limited in MongoDB; creation is their only plaintext response.

Venue admin booking/menu/checkout and public discovery are implemented. Bills
snapshot server prices and 9% commission, verify provider payment, and post an
idempotent balanced journal. Completing a paid booking atomically consumes stock
reservations and delivers its bill. Generic order status changes reject table
bills. Transactions require a replica set.

Plan policy: UTC paid-period end, no proration. BillingTransition operation IDs,
tenant mutation locks and revision checks protect future replacement creation,
provider retries, adoption and renewal. Ambiguous creation stays needs_review;
never blindly repeat a provider create. Scheduled reconciliation reads current
provider state, including add-ons, and retries table accounting.

Read docs/saas/six-area-validation.md before deployment. Required index migration
is dry-run only; external provider/mail/cron workflows remain outstanding.
Configured tests pass: backend 2738, admin 1755, platform 29. Type checks fail
with 455 admin and 23 platform diagnostics; targeted lint passes. CodeRabbit
was unavailable; direct security/state-transition review was performed.

Broad automatic test discovery unexpectedly ran legacy database scripts. Their
21 newly-created fixture records were removed by exact ID/time filters. Both
scripts are now gated behind explicit staging variables; use the configured
backend test command. The legacy purchase-order script itself still needs its
missing Size.tenant fixture corrected before it can validate purchase orders.
