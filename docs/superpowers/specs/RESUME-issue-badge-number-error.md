# RESUME: "Issue badge number" fails when clicked

Written 2026-08-11, after `41ec0d49` on branch
`feat/public-kiosk-and-tenant-branding` (pushed, not merged).

The button shipped in that branch and errors when pressed. **The error text was
not captured** — get it first, because the leading hypotheses produce completely
different fixes and three of them are distinguishable by the status code alone.

---

## Prompt

> In `/Users/mac/Documents/drinksharbour`, on branch
> `feat/public-kiosk-and-tenant-branding`: clicking **Issue badge number** on the
> employee badge modal fails. Read
> `docs/superpowers/specs/RESUME-issue-badge-number-error.md` first — it has the
> request path, the ranked hypotheses and the invariants.
>
> Get the actual failure before changing anything: the network response status
> and body, and the backend's stderr. Do not guess between a 404 and a 500 —
> they have different fixes and the doc says which.
>
> Then fix it TDD. Don't commit unless I ask.

---

## What the button does

`employee-badge.tsx` → `handleIssueBadgeNumber` →
`employeeService.issueBadgeNumber(current._id, token)` →

```
POST {NEXT_PUBLIC_API_URL}/api/employees/:id/badge-number
Authorization: Bearer <session token>
(no body)
```

→ `employee.routes.js` → `tenantAdminOrSuperAdmin` → `issueBadgeNumber` in
`employee.controller.js`.

The controller: loads the employee tenant-scoped, returns early with
`issued:false` if `needsBadgeNumber` is false, otherwise calls
`assignBadgeNumber` with a persist that does a `findOneAndUpdate`.

**The admin points at `http://localhost:5001`** (`client/apps/admin/.env`), so
this is the LOCAL backend, not `backend.drinksharbour.com`.

---

## Reproduce it precisely before touching code

The modal swallows the status — `handle()` throws a bare `Error(message)`. Hit
the endpoint directly instead, so the status code is visible:

```bash
# an employee id with no badge number — the dry run listed 36 of them
curl -i -X POST http://localhost:5001/api/employees/<id>/badge-number \
     -H "Authorization: Bearer <token from the admin session>"
```

Get the token from the browser: it is on the NextAuth session
(`session.user.token`), the same value every other employee call sends.

And watch the backend's own stderr at the same time — a 500 here is an
`asyncHandler` rethrow and the stack is the answer.

---

## Ranked hypotheses

### 1. The local backend is not running this branch's code → 404

**Most likely, and cheapest to rule out.** The route is new. If `:5001` was
started before the branch was checked out, or nodemon did not pick up the new
`routes/` and `controllers/` files, Express answers 404 and the modal renders
whatever the 404 body says — which will not mention badge numbers at all.

Check: `curl -i -X POST .../badge-number` with no auth header. A **404** means
the route does not exist on that process (restart it). A **401** means the route
exists and the guard is working, so move to hypothesis 2.

### 2. `$set: { employeeProfile: {...} }` replaces a NESTED PATH → 500 or data loss

**The strongest code-level candidate**, and it is a gotcha already recorded for
this repo: *Mongoose does NOT flatten nested paths — `$set:{sub:{...}}` REPLACES
the subdoc; use `flattenForUpdate`.*

`employeeProfile` is declared as a **nested object literal** in
`models/User.js:369`, not a sub-schema. Two consequences the controller may be
falling foul of:

- `user.employeeProfile` therefore has **no `.toObject()`**, so
  `issueBadgeNumber`'s `base` takes the else branch and spreads a
  Mongoose-tracked nested object. The spread can carry values in the wrong
  shape — dates as strings, ObjectIds as strings — for `work.manager`,
  `employment.startDate` and similar.
- The update runs with **`runValidators: true`** over that full replacement, so
  any nested `enum`, `min` or ref cast that the spread degraded is now a
  `ValidationError` / `CastError` → 500.

This is also why the failure may only reproduce on employees with a *populated*
HR profile. **Try a sparse employee and a rich one** — if the sparse one
succeeds, this is the bug.

The fix is almost certainly to stop replacing the whole profile and set the one
field, which is all this endpoint means to do:

```js
{ $set: { 'employeeProfile.attendance.rfidBadge': code } }
```

That is what `scripts/backfill-employee-badge-numbers.js:120` already does, and
it has been run against 36 real rows in a dry run without complaint. **Prefer
the script's shape over the controller's** — and note the script also carries
the `[BADGE_NUMBER_PATH]: MISSING` guard on the *filter*, which makes the write
a no-op if a number landed in between, rather than overwriting it.

If you take the dotted path, `withBadgeNumber` is no longer needed here and
`base` can go with it.

### 3. The partial unique index does not exist locally → wrong error, or none

`assignBadgeNumber` retries only on a duplicate-key error naming
`employeeProfile.attendance.rfidBadge`. If the compound partial index was never
built on the local database, a collision is silently accepted instead — not the
reported symptom, but check it while you are there:

```js
db.users.getIndexes()   // expect { tenant: 1, 'employeeProfile.attendance.rfidBadge': 1 }, partial
```

`User.createIndexes()` builds it; the backfill script calls that before writing.

### 4. Auth / MFA → 403

Admin sends `x-mfa-token` on some routes and re-prompts on 403. The badge
endpoint sends only `Authorization`, exactly like `setPin`/`resetPin` beside it.
If those two work in the same session and this does not, the difference is not
auth. A **403** with an MFA code in the body would say otherwise.

### 5. `err.statusCode = 404` inside the persist callback

`issueBadgeNumber` throws a plain `Error` with `statusCode` set when the employee
vanishes between read and write. Confirm the app's error middleware honours
`statusCode` — if it does not, this surfaces as a 500 saying "Employee not
found", which would be a confusing but harmless red herring.

---

## Invariants not to break while fixing it

- **Never re-issue over an existing badge.** `needsBadgeNumber` is the
  predicate. A number is printed on a card in somebody's pocket; overwriting it
  stops that card working at the clock. The early return with `issued:false` is
  the contract the client relies on to show "already has a badge number".
- **Any assignment path goes through `assignBadgeNumber`**, so the redraw-on-
  duplicate behaviour is kept and the per-tenant partial index stays the arbiter.
  Do not add a read-then-write uniqueness check — it loses the race between two
  managers.
- **Uniqueness stays a compound PARTIAL index**, never field-level `unique`
  (that would be global across tenants, and Mongoose never re-options an
  existing index).
- **The persist callback may run more than once.** It must rebuild its payload
  from the stored profile each time — a document mutated in place would carry
  the rejected number into the next attempt and clash on it for ever.
- **`badgeIssueState` must keep distinguishing `missing` from `unscannable`.**
  Both render no barcode, but only `missing` gets the button; offering it over a
  business's own long numbering is a button that can only do nothing.
- **`onIssued` must keep firing.** The modal takes `employee` as a prop and has
  no refetch path, so without it the card prints the blank number it was handed.
  Both call sites (`employees-list.tsx`, `employee-detail.tsx`) absorb it.

---

## Baselines (measured 2026-08-11 at `41ec0d49`, tree clean)

- **Server:** `node --test '__tests__/*.test.js'` from `server/` — **1923/1926**.
  The 3 failures are pre-existing (1 pricelist tenant-scope, 2 SO-number).
  `npm test` is broken.
- **Admin:** `./node_modules/.bin/vitest run` from `client/apps/admin` —
  **641/641**. `environment: 'node'`, **no jsdom, components cannot be
  rendered** — so the fix needs a `*-utils.ts` unit, not a component test.
- **Admin typecheck:** `./node_modules/.bin/tsc --noEmit` — **456**, all
  pre-existing. **Never `npx tsc`** — it installs a decoy `tsc@2.0.4` that
  prints "This is not the tsc command you are looking for" and exits 0.

**There is no server test covering this endpoint.** The suite is unit-only with
no database, which is precisely why this shipped broken — every *rule* it uses
is tested and the *wiring* is not. Consider whether the fix can be expressed as
a tested pure helper (e.g. "what update does this endpoint issue", asserted
against the shape the backfill uses) rather than left as untested IO.

---

## Files

- `server/controllers/employee.controller.js` — `issueBadgeNumber`, the suspect
- `server/routes/employee.routes.js` — `POST /:id/badge-number`
- `server/services/badgeNumber.helpers.js` — `assignBadgeNumber`,
  `needsBadgeNumber`, `withBadgeNumber`; all tested, all probably innocent
- `server/scripts/backfill-employee-badge-numbers.js:118-124` — the update shape
  that is known to work against real rows
- `server/models/User.js:369` — `employeeProfile` as a nested path; `:533` — the
  partial index
- `client/apps/admin/src/services/employee.service.ts` — `issueBadgeNumber`
- `client/apps/admin/src/app/shared/employees/employee-badge.tsx` —
  `handleIssueBadgeNumber`, the banner, `onIssued`
- `client/apps/admin/src/app/shared/employees/badge-utils.ts` —
  `badgeIssueState`

---

## Also still outstanding

- **The badge backfill has never been applied.** Dry run on 2026-08-11 found
  **36 employees** with no number, across ALL tenants — the list includes other
  tenants' owner accounts (`Premium Admin`, `Craft Admin`, `UFG Admin`). Scope
  it with `--tenant=<id>` if only Wyn City is wanted. Production Atlas write:
  `node scripts/backfill-employee-badge-numbers.js [--tenant=<id>] --apply`.
  **If hypothesis 2 is right, the backfill is the unaffected path** — it uses
  the dotted update — so it can be run independently of this fix, and would
  clear 36 of the cases the button exists for.
- Nothing in the kiosk work has been exercised in a browser: pairing, the
  logged-out scan, and the PDF header band with a real tenant name are verified
  only by unit tests and typecheck.
