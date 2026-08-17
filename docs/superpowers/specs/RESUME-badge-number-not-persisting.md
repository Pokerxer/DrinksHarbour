# DONE — "Badge numbers aren't saved, I regenerate every time"

**Reported:** 2026-08-16
**Fixed:** 2026-08-16, uncommitted
**Verdict:** the badge number *was* being saved correctly the whole time. The
screen that asked for it never received it.

## What was wrong

`server/controllers/employee.controller.js`, the **list** endpoint, selected

```js
`${PUBLIC_FIELDS} posPinHash employeeProfile.work`
```

The badge number lives at `employeeProfile.attendance.rfidBadge`, which was
therefore projected away on every list response. `present()` faithfully passed
along the truncated profile. Downstream, `badgePayload()` fell through to the
employee's `_id`, `badgeIssueState()` read that as `'missing'`, the UI offered
"Issue badge number", and `badgeBarcodeLayout` refused to draw bars for a
24-character ObjectId — so the card printed with no barcode either.

Nothing threw. Every helper on both sides behaved correctly on the data it was
handed. This is the third instance of the class in this repo (the POS
`.select([...])` that omitted `imagesOverride`; the planner projection that
dropped `templatePosition`).

## The fix

`employee.controller.js` — the list's employeeProfile allowlist is now a named
constant carrying its own reasoning:

```js
const LIST_PROFILE_FIELDS =
  'employeeProfile.work ' +      // manager + titles: org chart, manager picker
  'employeeProfile.attendance';  // rfidBadge: is a badge already issued
```

**Deliberately an allowlist, not the whole profile.** `employeeProfile`'s other
subtrees hold bank accounts (`privateContact.bankAccounts`), passport and SSN
numbers (`citizenship`), home addresses (`location`), ID-card URLs
(`documents`) and hourly pay (`appSettings.hourlyCost`). Selecting
`employeeProfile` whole would fix the badge and start shipping all of that to
every client that opens the employees screen. HR reads those on the **detail**
endpoint, which returns the full document (verified: it is a bare
`.select('+posPinHash')`, so it was never affected by this bug).

## The regression guard

`server/__tests__/employeeListProjection.test.js` — three tests, at the
projection level, driving the real `listEmployees` and asserting on `res.body`:

1. the response carries `employeeProfile.attendance.rfidBadge` for an employee
   who has one, and it is not the `_id` fallback;
2. `work` and the hash-derived `hasPin` still come through the same select;
3. `Object.keys(employeeProfile)` is exactly `['attendance', 'work']` — so a
   profile subtree added to the model later stays out of the list until
   somebody puts it on the allowlist on purpose, and a future "fix" that
   selects `employeeProfile` wholesale turns this red.

It uses `__tests__/helpers/appraisalHarness.js`, whose `FakeQuery` applies
`.select()` inclusion semantics faithfully — build your own `req`, because
`asUser()` provides no `req.query`.

**The guard was proved to have teeth**: reverting the projection to
`employeeProfile.work` alone turns tests 1 and 3 red, and test 2 stays green.

Server suite after the change: **2027/2030**, the same 3 pre-existing failures
(1 pricelist tenant-scope, 2 SO-number). Note the total has grown from the
1917/1920 baseline in older notes — sanity-check the COUNT, not just failures.

## Verified with real data

Driving the real handlers against the production database:

- **23 of 30** Wyn City employees already held badge numbers the list was
  hiding. The write was never broken.
- Issued one through `issueBadgeNumber` for Janice (`6222 8083`), reloaded the
  list: the number is present, `badgePayload` no longer falls back to the
  `_id`, `badgeIssueState` → `'ready'` (Issue button gone), `formatBadgeNumber`
  → `"6222 8083"`. Pressing Issue again returned the same number with
  `issued: false`.
- Bars, through the real `badgeBarcodeLayout` at CR80 width: 8-digit number =
  79 modules, **0.444mm** per module; the `_id` fallback = `null` (no bars, as
  designed). `Chibuike`'s business-supplied 12-digit `234257890245` prints at
  101 modules / **0.363mm** and is left unreformatted — both comfortably above
  the ~0.19mm a cheap scanner needs.

## Backfill — done, scoped

`server/scripts/backfill-employee-badge-numbers.js`, dry run first, then
`--apply` **per tenant**: Wyn City **7/7**, UFG Legacy **1/1**. Every employee
on both tenants' lists now carries a number.

**A bare `--apply` would have written 14, not 8.** The extra six are
`tenant_owner` accounts of demo tenants that have since been deleted — orphan
`tenant` refs, so they appear on no tenant's employee list at all
(`testbar@admin.com`, `admin@the-wine-cellar…`, `…premium-spirits-wine`,
`…beverages-plus`, `…craft-beer-haven`, `…quick-drinks-express`). They were
left alone. Use `--tenant=<id>` unless you mean to touch them.

## Still open

Print one card and scan it with the actual shop scanner — the encoder has been
verified against a software decoder, never against the hardware on the counter.
`Chibuike`'s 12-digit number is the tightest real case to test alongside an
8-digit one.

## Traps (unchanged)

- Server tests: `cd server` first, then `node --test '__tests__/*.test.js'`.
  From the repo root it matches nothing and reports `# fail 0`.
- The Atlas link from this Mac is flaky — retry the connection, don't conclude
  the network blocks it.
- `rfidBadge` is **free text on purpose**. Never regroup, reformat or overwrite
  a value `isBadgeNumber()` rejects; never re-issue over an existing number.
  That card is in somebody's pocket.
