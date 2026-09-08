# Six-area release validation

## Billing policy

All upgrades and downgrades are scheduled for the current paid period end in
UTC. No proration, mid-cycle charge or unused-time credit is applied. The next
cycle costs the full target-plan monthly price. Existing access lasts through
the paid period; replacement access requires a verified paid provider invoice.
Downgrades incompatible with outstanding add-ons are rejected until those
add-ons have ended. Shared provider plans are never edited for an individual
tenant.

The provider contract is documented at
https://paystack.com/docs/api/subscription/ and
https://paystack.com/docs/payments/subscriptions/ . New subscriptions can carry
a future `start_date`. Plan updates can affect other subscribers and are not
used to implement tenant transitions.

Each tenant has at most one pending BillingTransition and one initial checkout.
Creation is recorded before sending a provider request. A timeout is ambiguous:
do not clear a transition and retry creation. Reconciliation searches the
customer's provider subscriptions for the exact target plan and start date.
Zero or multiple matches require operator investigation. Existing subscription
identities remain authoritative; old webhooks cannot replace them. Renewal
uses provider enable/disable and refreshes current state. Mutation locks left
after a crash must only be cleared after verifying the provider outcome.

## Install and migration

Run `node scripts/migrate-six-area-hardening.js --apply` from `server` with the
target environment's `MONGODB_URI` before enabling these routes. This creates
unique hash, tenant-transition and booking-bill indexes without dropping other
indexes, and ensures the existing journal idempotency index. Index creation must succeed before deployment. No API-key plaintext is
migrated or retained. Existing tenants without billingRevision are supported.
MongoDB must run as a replica set (or sharded cluster): completing a paid table
booking uses a transaction to clear reservations and mark the bill delivered
alongside booking completion. Verify transaction rollback and concurrent retries.

Existing runtime configuration: PAYSTACK_SECRET_KEY, PAYSTACK_PLAN_* for each
sold tier, PAYMENT_GATEWAY / KORAPAY_SECRET_KEY for customer checkout,
NEXT_PUBLIC_ADMIN_URL, NEXT_PUBLIC_API_URL, mail credentials and ENABLE_CRON.
The billing/accounting reconciliation sweep runs every ten minutes when cron
is enabled, alongside the existing jobs. Test all workers with the production
number of application instances to exercise duplicate-job behavior.

## Offline and staging commands

From server, `node scripts/validate-staging.js` performs offline preflight.
Use `npm test` for the configured offline backend suite. Legacy purchase-order
database scripts require explicit STAGING_VALIDATION and STAGING_MONGODB_URI;
do not run them against a shared or production database. The old
test-purchase-order.js fixture currently fails Size validation (missing tenant)
and is not a passing staging check.
Exit 2 means staging configuration is missing; it does not mean tests ran.
External flags require STAGING_VALIDATION=true, STAGING_MONGODB_URI,
STAGING_SUBSCRIPTION_CODE, STAGING_MAIL_TO, configured test plans and a Paystack
test key. `--provider` fetches provider state; `--mail` sends a test message;
`--jobs` runs billing reconciliation and notices on the staging database.
Mail accepted by SMTP is not proof of delivery: verify the recipient inbox,
spam placement, SPF/DKIM/DMARC headers and bounce reporting separately.

## Required staging scenarios (record evidence before deployment)

- Two tenants: attempt cross-tenant role assignments, inactive roles, deletion
  and revocation while sessions remain signed in. Platform-only endpoints must
  stay denied even with forged grants. Check inventory routes and action buttons.
- API keys: copy secret once, list again and inspect storage; confirm only hash
  and prefix remain. Exercise both scopes, expiry, revocation, suspended tenant,
  downgraded plan and concurrent requests across workers exceeding 60/minute.
- Venue: discover only active approved venues; request/confirm/check in a
  booking; choose menu quantities and pay. Verify server-authoritative prices,
  no delivery fee, 9% commission, matching stock reservation, paid status and
  balanced tenant revenue/commission/platform receivable journal. Replay payment
  notifications and retry accounting after a simulated outage. Investigate
  abandoned/ambiguous checkout before issuing another bill.
- Plan change: schedule an upgrade and downgrade, verify old renewal disabled
  and exactly one replacement with the correct future start date. Crash after
  provider creation but before saving its code; run reconciliation and verify
  no second subscription. Confirm no early entitlement change and no new-tier
  access when the first replacement invoice fails.
- Renewal: cancel, enable again, replay old non-renewal/disable notifications,
  deliver paid/failed notifications in reverse order, and send a stale code.
  Assert database state matches the current provider subscription.
- Initial checkout: double-click subscribe, retry after timeout and replay
  subscription.create. Check one checkout reference and one current identity.
- Exercise actual cron invocation and restart behavior, notice delivery and
  reconciliation errors. Confirm alerts on stuck locks/transitions, failed
  accounting and missing index permissions.

No real staging provider workflow, mail delivery or scheduled job execution has
been claimed by implementing this checklist. Store timestamps, provider test
references, sanitized before/after records and test results with release evidence.

## API and admin surfaces

- Admin `/settings/api-keys`: list, create, revoke; API capability and own-tenant
  settings permissions are required. Secret appears in the creation response
  only; lists contain metadata. Keys expire within 1–365 days.
- `Authorization: Bearer <secret>` is accepted only at the explicit integration
  endpoints: `GET /api/integrations/inventory` (`inventory:read`) and
  `GET /api/integrations/bookings` (`bookings:read`, Venue capability required).
  API keys do not become JWT sessions and cannot reach platform endpoints.
- `/api/users/me/permissions` exposes base-plus-custom effective permissions.
  Active custom roles are loaded from the current user's own tenant on each
  authenticated request. Inventory mutations and settings actions opt into
  delegation; central catalog and platform-only role guards remain fixed.
  Admin custom grants refresh on focus and every 30 seconds; endpoint checks
  always use current database state.
- Admin `/bookings` manages the existing booking state transitions and table
  checkout. Public `/venues` lists active venues and accepts signed-in booking
  requests. Guest completion requires settlement if a bill exists.
- `/api/erm/change-plan` schedules a transition and reports pending state;
  `/api/erm/renew` enables renewal. Existing billing manager restrictions apply.
