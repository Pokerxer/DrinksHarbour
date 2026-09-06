---
name: erm_goals4_execution
description: 2026-09-06 execution of erm-next-goals.md — staff-seat fix (E), commission audit + wyncity comped (F), booking server slice (C2 partial), cron prod-checklist (B).
type: memory
---

# ERM goals-4 execution — what was done, what is still open

Ran `docs/erm-next-goals.md` on 2026-09-06. `feat/plan-entitlements-billing` was
already committed and pushed (goals-3). This session added code but **did not
commit or push**.

## Completed

### Staff-seat trap closed (§E)
`checkStaffLimit` (plan.middleware.js) and `countUsage` (ermUsage.service.js)
now both filter `status: { $ne: 'deleted' }`. A Starter tenant who removes
their only soft-deleted staff member can immediately add a replacement. The
change is symmetrical (gate + usage bar agree, avoiding the drift the old
counting test explicitly pinned). A dedicated gate test proves the starter-seat
reuse path; README §5 updated.

### Commission audit + wyncity decision (§F)
`scripts/auditCommissionRates.js` (read-only) was corrected to flag only
`revenueModel: 'commission'` tenants. Live data: both tenants are markup-model;
commission field unused; the meaningful finding is **`wyncity` = enterprise +
active + NO currentPeriodEnd → free comped tenant**. Decision: leave as-is,
comped/demo for now; do not run `POST /admin/sync-commission` (it would change
nothing about the subscription leak). Recorded in README §4a.

### Cron gate verified + prod-checklist (§B)
Billing notices cron: `cron.schedule('0 9 * * *')` inside the same
`ENABLE_CRON || NODE_ENV === 'production'` gate at `server.js:460` that runs
the other five crons. `TRIAL_WARNING_DAYS = 3` → the warning can only fire
2026-09-17 for `ufg-legacy-limited` (trial ends 2026-09-20T10:20:52Z).
Four-step prod-verification checklist written into the goals doc §B.

### Booking server module landed (§C2 — server slice)
`server/models/Booking.js` + `server/services/booking.service.js` +
`server/controllers/booking.controller.js` + `server/routes/booking.routes.js`,
wired at `app.use('/api/bookings', bookingRoutes)` in server.js.

- Model: `tenant`, `guest { name, phone, email }`, `partySize`, `bookingAt`,
  `durationMin`, `tableLabel`, `notes`, `status` (6-state enum),
  `source` (pos|discovery|admin), `timestamps`; indexes on `{tenant, bookingAt}`
  and `{tenant, status}`.
- State machine: `pending→confirmed/cancelled`,
  `confirmed→checked_in/cancelled/no_show`, `checked_in→completed`; terminal
  states immutable; invalid transitions throw `ConflictError`.
- Routes: all behind `protect → attachTenant → requireOwnTenant →
  tenantAdminOrSuperAdmin → requireCapability('table_management')`. Controller
  always scopes by `req.tenant._id`.
- 11 booking tests: 2 pure state-machine tests, 4 service tests (mocked
  model), 5 route guard tests (real HTTP via routeAuthHarness).

Full server suite: **2697 pass / 0 fail**.

## Still open

- **§A / deploy:** Paystack plans + webhook + live key + branch-to-production
  deploy remain blocked on external dashboard access (Paystack + Vercel/GitHub).
- **§C2 remaining subsystems:** admin POS booking dashboard, platform venue
  discover section, and the checkout 9% table-service commission loop (depends
  on the order-path integration with a commission-model venue tenant — no
  commission-model tenants exist yet).
- **§D (API keys):** unblocked, large build: `ApiKey` model (hashed),
  server keys routes, scoped middleware, per-key rate limits, `/settings/api`
  screen.
- **Commit/push:** everything in this session is uncommitted.