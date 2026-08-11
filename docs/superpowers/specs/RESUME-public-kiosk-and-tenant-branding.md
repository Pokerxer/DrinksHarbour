# RESUME: on-demand badge numbers, a login-free kiosk, and the tenant's own name

Written 2026-08-10, after `7f01c94b`. Paste the "Prompt" section into a fresh
session.

---

## Prompt

> In `/Users/mac/Documents/drinksharbour`, three things about the employee
> badge and the attendance kiosk:
>
> 1. Clicking **Generate badge** should assign an RFID / badge number on the
>    spot when the employee has not got one, instead of printing a card with no
>    barcode.
> 2. The kiosk should be reachable **without logging in**, by anybody, the way
>    Odoo's kiosk is.
> 3. The badge card and the kiosk should carry the **tenant's shop name**, not
>    "DrinksHarbour".
>
> Read `docs/superpowers/specs/RESUME-public-kiosk-and-tenant-branding.md`
> first — item 2 removes the only thing currently authenticating the clock, and
> that doc has the reasoning, the invariants and the baselines. TDD. Don't
> commit unless I ask.

---

## 1. Assign a badge number when the badge is generated

**Almost all the machinery already exists.** `server/services/badgeNumber.helpers.js`
has `generateBadgeNumber`, `needsBadgeNumber`, `withBadgeNumber` and
`assignBadgeNumber` (which writes and redraws only on a duplicate-key error
naming our index), all tested. What is missing is a way to *ask* for one after
the employee already exists — today a number is only issued on create, or in
bulk by `scripts/backfill-employee-badge-numbers.js`.

So this is: **an endpoint, a service call, and a button state.**

- A **POST** on the employee, not a PATCH of `rfidBadge` — the client does not
  choose the number, the server draws it. Something like
  `POST /api/employees/:id/badge-number`, tenant-scoped like the rest of
  `employee.routes.js`.
- It must be **idempotent in the way that matters**: if the employee already
  has a badge — ours *or* a hand-entered `STAFF-0042` — return that one
  unchanged. `needsBadgeNumber()` is exactly this predicate. Re-issuing would
  invalidate a card already in somebody's pocket.
- `employee-badge.tsx` already computes `badgeBarcodeLayout(...) === null`,
  which is precisely "this employee has no usable badge number". That is the
  condition to act on — do not re-derive it.

**Where the design decision is.** Assigning silently on open makes viewing a
badge a write, and viewing is a GET that a manager might do while browsing.
Prefer either issuing when the employee is opened *for printing* (Download PDF /
Print), or an explicit "Issue badge number" affordance on the card when it is
missing. Ask the user which they want rather than guessing — it changes whether
a read-only page can mutate an employee.

**The modal takes an `employee` prop and has no refetch path.** After issuing,
the card must re-render with the new number, so the new value has to get back
into whatever holds that state (`employees-list.tsx` / the employee detail
page). A modal that issues a number and still prints the old blank card is the
obvious failure here.

---

## 2. A kiosk anybody can open — the hard one

### What currently stands in the way, and why it was written that way

`server/routes/attendance.routes.js` opens with a comment that is a direct
answer to this request, and it should be read before it is overruled:

> The kiosk is NOT an exception to that. The device is signed in as a manager,
> so the JWT says which tenant; the credential in the body (a badge or a PIN)
> says which employee.

Every route in that file sits behind four gates:

```js
router.use(protect);                 // a valid JWT
router.use(attachTenant);            // resolveTenantContext
router.use(requireOwnTenant);        // and it must be YOUR tenant
router.use(tenantAdminOrSuperAdmin); // and you must be an admin
```

**The manager's JWT is doing two separate jobs**, and removing the login
removes both:

1. **It names the tenant.** `req.tenant._id` scopes every badge and PIN lookup
   in `attendance.controller.js`. With no session there is no tenant, and a
   clock that cannot name a tenant cannot look anybody up.
2. **It is the only authentication on the endpoint.** `POST /api/attendance/clock`
   accepts `{ pin }` or `{ badge }`. Behind a login, a wrong guess costs an
   attacker an admin account. Public, the endpoint is an internet-facing
   oracle: PINs are 4–6 digits, and badge numbers are now 8. `clockLimiter`
   (60 presses per IP per 15 minutes) was written as a brake on a screen in a
   shop, **not** as the sole defence against a distributed script, and it is
   per-IP.

**So "make it public" is not a middleware deletion.** Something else has to
carry the tenant identity and the authorisation. Do not just drop `protect`.

### The shape to aim for: a kiosk device credential

Odoo's kiosk is not "an open URL" — it is a URL carrying a long random token
that identifies the device, and it can be revoked. That is the model to copy,
because it keeps the two jobs above filled without a person logging in:

- A **long random, per-tenant, revocable kiosk token**, stored on the tenant
  (near `tenant.warehouseSettings` — see the settings module) and rotatable
  from `/settings` by an admin.
- The kiosk URL carries it (`/kiosk/<token>`), so the device is paired once by
  a manager and left on the counter. **The token resolves the tenant**, which
  is what job (1) needed.
- `/api/attendance/clock` accepts *either* an admin JWT (today's path, keep it —
  the in-app kiosk should not break) *or* a valid kiosk token. New middleware,
  not a hole in the existing chain.
- **Rate limit per token as well as per IP**, and consider dropping the PIN
  branch on the token path: physical possession of a badge is a much weaker
  thing to leak than a typed secret, and it is the badge the laser scanner
  exists for. Worth asking the user.

### The client side

`src/middleware.ts` gates by an **explicit path list**, and `/employees/:path*`
is on it — which covers today's kiosk at `/employees/attendance/kiosk`
(`routes.ts:54`). A page that must render logged-out has to live **outside that
matcher**, so this most likely means a **new top-level route** (`/kiosk/...`)
rather than an exclusion, since the matcher is a list of what IS gated.

Do not simply un-gate `/employees` — that reserves the whole employee namespace
as public. The comment above `isUnder()` in that file is about exactly this
class of mistake.

The kiosk page also currently assumes a session for its API calls; check what
`attendance.service.ts` sends and how the token gets attached when there is no
NextAuth session.

---

## 3. The tenant's shop name, not ours

The card is printed by a tenant, for that tenant's staff, and says
**DRINKSHARBOUR**. It should say Wyn City. There are **six hardcoded strings**
in the two screens:

```
attendance-kiosk-page.tsx:272   DrinksHarbour
employee-badge.tsx:161          DRINKSHARBOUR              (PDF header band)
employee-badge.tsx:280          DRINKSHARBOUR · PROPERTY OF THE COMPANY  (PDF footer)
employee-badge.tsx:343          DrinksHarbour              (on-screen header)
employee-badge.tsx:394          DrinksHarbour · Property of the company  (on-screen footer)
```

(`employees-list.tsx` and `employees-nav-header.tsx` also hardcode it, but those
are app chrome, not a printed artefact — decide separately.)

**The unresolved bit is where the name comes from.** A grep of
`src/services/*.ts` and the NextAuth options found no `tenantName`; the session
token carries `tenantId` and `tenantSlug` (see `middleware.ts`), and a slug is
not a shop name. So: find or add the tenant's display name (and ideally its
logo and brand colour — `BRAND = '#b20202'` is hardcoded too) on whatever the
admin already loads for the current tenant.

**This is where items 2 and 3 meet, and it is the neat part.** On a logged-out
kiosk there is no session to read a tenant name from — so the kiosk token from
item 2 is the *only* thing that knows which shop the screen belongs to. Design
its resolution endpoint to return the tenant's display name (and logo) along
with whatever the clock needs, and the branding falls out of the same call
rather than needing a second mechanism.

**Keep a fallback.** A tenant with no display name set must not print a card
with an empty header band.

---

## Invariants not to break

- **`rfidBadge` stays free text and is never re-issued over an existing value** —
  ours or a business's own. `needsBadgeNumber()` is the predicate; a card
  already in somebody's pocket stops working otherwise.
- **Uniqueness stays a compound partial index** on
  `{tenant, employeeProfile.attendance.rfidBadge}`, never field-level `unique`
  (that would be global across tenants, and Mongoose never re-options an
  existing index). Any new assignment path must go through `assignBadgeNumber`
  so the retry-on-duplicate behaviour is kept.
- **`badgeBarcodeLayout` returning null is a feature.** No badge number means no
  bars, because a 0.15mm barcode looks like it works and fails at the kiosk.
  Item 1 removes the *cause*; do not remove the guard.
- **The badge card has zero vertical slack.** `badgePdfLayout` owns the budget
  and is tested; a longer tenant name must wrap or truncate rather than push
  anything into the footer band. Watch the header band — the avatar disc is
  drawn after the header text and will paint over it.
- **Do not regress the double-punch guard**: server `MIN_PUNCH_INTERVAL_SECONDS=60`
  plus the client `SCAN_COOLDOWN_MS`, deduped **by code**. A public kiosk makes
  this more load-bearing, not less.
- **`pushScanKey` must keep ignoring modifier keys** — Shift was truncating
  every uppercase badge.
- **The kiosk's existing in-app path must keep working.** A manager with the
  kiosk open on a signed-in tablet should not be broken by the public route.

---

## Baselines (measured 2026-08-10 at `7f01c94b`, tree clean)

- **Server:** `node --test '__tests__/*.test.js'` from `server/` — **1883/1886**.
  The 3 failures are pre-existing (1 pricelist tenant-scope, 2 SO-number).
  `npm test` is broken.
- **Admin:** `./node_modules/.bin/vitest run` from `client/apps/admin` —
  **603/603**. `environment: 'node'`, **no jsdom, components cannot be
  rendered** — which is why every screen has a `*-utils.ts`.
- **Admin typecheck:** `./node_modules/.bin/tsc --noEmit` — **464** errors, all
  pre-existing. **Never `npx tsc`** — it installs a decoy `tsc@2.0.4` that
  prints "This is not the tsc command you are looking for" and exits 0.
- ESLint 9 cannot run in this repo at all (no flat config). Pre-existing.

## Files

- `server/services/badgeNumber.helpers.js` — assignment machinery, already done
- `server/controllers/employee.controller.js` — how create issues a number; copy
  that shape for the on-demand endpoint
- `server/routes/employee.routes.js` — where the new route goes
- `server/routes/attendance.routes.js` — the four gates, and the comment
  explaining why the kiosk was not an exception
- `server/middleware/auth.middleware.js` — `protect`, `attachTenant`
  (= `resolveTenantContext`), `requireOwnTenant`
- `client/apps/admin/src/middleware.ts` — the explicit gated-path list
  (`config.matcher`) and `isUnder()`
- `client/apps/admin/src/config/routes.ts:54` — `attendanceKiosk`
- `client/apps/admin/src/app/shared/employees/attendance-kiosk-page.tsx`
- `client/apps/admin/src/app/shared/employees/employee-badge.tsx` — the five
  hardcoded brand strings and `BRAND`
- `client/apps/admin/src/app/shared/employees/badge-utils.ts` — `badgePdfLayout`,
  the tested vertical budget

## Open questions for the user

1. **When should a number be issued** — on opening the badge, or only on
   print/download, or behind an explicit button? It decides whether viewing an
   employee can write to them.
2. **Should the public kiosk accept a PIN, or badges only?** A typed secret on a
   public endpoint is a different risk from a scanned card.
3. **Is one kiosk token per tenant enough**, or does each device need its own
   (so one can be revoked without re-pairing the rest)?
4. Still outstanding from the previous spec: **`publishShifts` has no
   future-only constraint**, so publishing a range covering past days publishes
   past drafts, which immediately count as absences for whoever was on them
   though staff were never told.

## Still to run from the last session

`node scripts/backfill-employee-badge-numbers.js` (dry run, then `--apply`) for
the existing Wyn City employees. Item 1 above covers new stragglers one at a
time, but it is not a substitute for the bulk pass.
