# Rollback and incident response

Before release, record the previous healthy web deployment and API artifact,
their source commits, environment schema and database compatibility. Rehearse
rollback in staging and record evidence; no rehearsal is implied by this file.

For an incident, assign an owner, record symptoms/time/affected tenants, stop
the faulty rollout or feature, and preserve logs without publishing tokens or
customer data. Check dependencies, recent code/config/migrations, webhook
processing and stock/payment integrity before declaring recovery.

For a web regression, use the hosting provider's rollback/promotion operation on
the recorded healthy deployment, then rerun the smoke checks. For the API,
redeploy the recorded previous artifact using its actual provider controls.
Keep credentials in the secret store, not recovery scripts.

Rolling back code does not reverse database writes, payments or inventory.
Prefer a reviewed forward repair; restore only under an agreed recovery plan.
Never blindly replay paid orders, webhooks, stock transfers or invoices. Check
idempotency and reconcile external payment references before any replay.

Document impact, recovery evidence, data repairs, contributing causes, follow-up
owner and due date. Add a regression test for the actual failure.
