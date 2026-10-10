---
name: subscription-retention-ledger
description: Tenant.plan cannot answer retention questions; a SubscriptionEvent ledger records effective plan changes, idempotently, and only holds history from 2026-09-30 onward.
type: decision
---

# Subscription retention comes from an event ledger, not Tenant.plan

`Tenant.plan` holds a tenant's **current** plan. There is no record that a tenant
was ever on `starter`, so "how many tenants expanded or churned last month?"
cannot be answered from it. Retention therefore reads `SubscriptionEvent`
(`models/SubscriptionEvent.js`) via `services/subscriptionEvents.service.js`.

The dashboard's Account Retention card previously derived this from repeat
customer **orders**, which was wrong: cancellations came from a
`lastOrder < now - 60d` aggregate re-run for every day of the window, so the line
was near-constant and the summary reported every lapsed customer in the database
rather than churn in the period.

**Rules, so the numbers stay honest:**

- Events are recorded when they take **effect**, not when requested. Plan changes
  are written on `reconcilePlanChange` completion, so an aborted or superseded
  transition is never counted as an expansion.
- `dedupeKey` is uniquely indexed. Providers redeliver webhooks and the nightly
  sweep re-reads every subscription; without it the same cancellation is counted
  every day and churn is badly inflated.
- `contraction` (a downgrade) is **not** churn. `payment_failure` is **not**
  churn — it is recoverable and belongs to dunning. Both are stored, neither is
  counted.
- `custom` is in the `Tenant.plan` enum but deliberately absent from
  `PLAN_ORDER`, so it has no rank. An unranked plan is not treated as the bottom
  rung, which would report every `custom → pro` move as a fake expansion.

**History starts at the deploy date (2026-09-30).** Earlier transitions were never
recorded and cannot be reconstructed. An empty result must render as "no data",
never as a row of zeros.

When a new provider webhook changes subscription state, it must write an event
here too, or the ledger silently develops holes. See
`docs/superpowers/specs/RESUME-analytics-dashboard-crash.md`.
