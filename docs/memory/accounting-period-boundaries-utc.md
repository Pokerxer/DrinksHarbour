---
name: accounting-period-boundaries-utc
description: Month and window boundaries across the accounting module are UTC and derived by periodRange/periodOf — never new Date(y, m-1, 1) or local getters.
type: convention
---

# Accounting period boundaries are UTC

Two reports about the same entry must agree on which month it belongs to. They
previously did not, and which answer you got depended on the server's timezone.

## The rule

Use `periodRange(period)` (server) and `asLocalDate(iso)` (client) rather than
hand-building dates.

**Server** — `server/services/accounting.helpers.js`:

- `periodOf(date)` → `'YYYY-MM'`, via `getUTC*`.
- `periodRange('YYYY-MM')` → `{ $gte, $lt }` bounding the month in UTC via
  `Date.UTC`. Also the single place `YYYY-MM` is validated.

**Client** — `client/apps/admin/src/app/shared/accounting/report-status.ts`:

- `asLocalDate('2026-08-01')` → local-time `Date` for that calendar day.
  `new Date('2026-08-01')` is *midnight UTC*, which renders as 31 Jul west of
  Greenwich. A value carrying a time is a real instant and is passed through.

## Why it is written this way

A document stamped `2026-07-31T23:30:00Z` is genuinely ambiguous in wall-clock
terms — 23:30 UTC is 00:30 the next day in Lagos. Rather than pick a tenant
timezone and carry it everywhere, the ledger treats every boundary as a fixed
instant:

- `periodOf` assigned it to **July** (UTC).
- The trial balance's month range was built with `new Date(y, m-1, 1)` — local —
  so on a UTC+1 host it fell inside the **August** trial balance.

Same document, two answers, and the disagreement moved with the host timezone.
`fetchEntries` now calls `periodRange`.

**Verified deterministic** under `TZ=UTC`, `Africa/Lagos`, `America/New_York`,
`Pacific/Kiritimati` (`server/__tests__/accounting.helpers.test.js`). This
machine resolves to `Africa/Lagos`, which is what exposed it.

## Related: an empty period is not an imbalance

`buildTrialBalance` sets `balanced` on arithmetic agreement and reports emptiness
separately as `isEmpty`. It used to require `totalDebits > 0`, so a month with
no postings was flagged "Out of balance — ₦0.00 vs ₦0.00" and told the user to
run the journal backfill against a healthy ledger.

**Consequence:** any UI branching on `!balanced` to raise an alarm must check
`isEmpty` (or, on the client, use `trialBalanceStatus()` /
`balanceSheetStatus()` from `report-status.ts`). The balance sheet's `balanced`
is likewise also false when assets are a net credit, so *the computed gap*, not
the flag, decides the tone.