# ERM subscriptions and admin access — current execution plan

Updated 2026-09-06. Scope: `client/apps/admin` and the API boundaries it uses.
Starting commit: `3323ba469a36dd97aa7013b5d92a827c019bf49e` on
`feat/plan-entitlements-billing`; working tree was clean when inspected.

This replaces contradictory snapshots in the earlier goals-3 document. A branch
push is not a deployment, SMTP acceptance is not inbox delivery, and local
configuration is not evidence about production configuration.

## Policy and ownership

- Tenant owner and tenant administrator manage their own subscriptions/add-ons.
  Tenant staff can read status and usage but cannot purchase or cancel.
- Platform operations retain platform role checks. Tenant data stays scoped to
  authenticated tenant identity; request body/query values cannot widen it.
- Billing recovery is available for expired trials, past-due, cancelled and
  incomplete subscriptions. Suspended/unapproved businesses remain blocked.
- Paid access is derived from authenticated live entitlements on navigation.
  Cached JWT plans and public storefront records are not authority.
- Paystack bills ERM subscriptions; storefront payments remain on Korapay.
- Cancellation must be accepted by Paystack before being recorded locally.
  Paid access/slots remain until the provider's period-end disable event.
- No live charges, tenant edits, outbound notices, commit, push or deployment
  are part of this code-hardening pass.

## A. Admin and API hardening (in progress)

1. Fix missing billing fields in tenant context and missing billing-management
   role checks. Exercise real router chains with mocked storage/provider calls.
2. Restore billing recovery for cancelled/incomplete tenants without relaxing
   normal tenant-owned data routes or suspended-tenant checks.
3. Move navigation plan checks out of cached middleware/shared layouts. Use
   `/api/erm/status` effective capabilities, including custom contracts and
   degraded access. Keep the billing page reachable on load failures.
4. Repair cancellation error handling, provider email-token use, delayed access
   removal, repeated add-on cancellation and obsolete disable-event handling.
5. Restore the add-on interface, staff read-only billing view, explicit error
   state, truthful plan selection and subscription-end labels.
6. Check all admin business page routes, session helpers, tenant ownership
   helpers, menu role ordering, and direct nested POS URLs.

Done when: targeted regressions pass, full server/admin tests are run, type
checking is compared with its baseline, and the remaining limitations are recorded
in `docs/superpowers/specs/RESUME-erm-admin-access.md`.

## B. Payment configuration and production proof (external verification pending)

Historical local observation on 2026-09-06: seven plan codes were unset and a
Paystack test key was configured. This is not a current production assertion.

1. In a separate test environment, configure the five base plans and two add-on
   plans at the canonical prices in `server/config/erm-plans.js`.
2. Run `checkErmBillingConfig.js --verify-remote` from the backend environment.
3. Register that environment's webhook and verify genuine signed events.
4. Exercise subscribe → webhook → live access; failed payment → read-only →
   billing recovery; cancel → non-renewing → period-end disable; and independent
   add-on cancellation. Record event IDs and before/after state, never secrets.
5. Repeat production configuration verification with production plan codes and
   keys. A real-money transaction requires explicit authorization.

Provider references: [Subscription API](https://paystack.com/docs/api/subscription/)
and [subscription lifecycle](https://paystack.com/docs/payments/subscriptions/).
Disable requires `email_token`; `subscription.not_renew` precedes period-end
`subscription.disable`. Test and live resources must not be mixed.

## C. Notices and dated trial observation (partially evidenced)

Earlier work recorded SMTP message IDs for trial-ending and payment-failed
notices sent to a test recipient. Mailbox receipt, production cron execution,
and repeat-sweep idempotence still need environment-specific proof. No further
messages should be sent merely to update this document.

Historical decision: let `ufg-legacy-limited` expire on 2026-09-20 and observe,
without extending it. Verify current tenant state before acting. Confirm the
warning around 2026-09-17 and the expiry outcome on 2026-09-20, recording whether
payment was possible. These dates are pending milestones, not completed tests.
Wyncity's comped/demo decision is recorded in README-plan-entitlements §4a.

## D. Release (not verified)

A prior session recorded pushing the branch. This session does not infer the
remote or deployed state from that note. Release requires explicit authorization,
server/admin/platform compatibility checks, environment validation from B, and
post-release confirmation of healthy, read-only, recovery and role-denied paths.
Measure whole-request latency separately from the in-memory usage-cache lookup.

## E. Remaining ERM product scope

Venue booking backend exists; admin booking/POS screens, venue discovery and the
9% paid-order loop remain separate product work (see `erm-next-goals.md`). API
key issuance and runtime custom-role permission enforcement remain explicit
follow-ups; a capability name or permission editor alone is not implementation.
Do not invent new pricing gates for routes documented as deliberately ungated.
The staff-seat issue was fixed in the starting commit: deleted staff release a
seat; inactive/suspended staff still count. Preserve that rule in gate and usage.
