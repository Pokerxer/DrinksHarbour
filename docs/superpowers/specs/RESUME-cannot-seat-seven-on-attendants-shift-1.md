# RESUME: can't put 7 people on "Wyn city Attendants shift 1"

Written 2026-08-13, from a session that **already diagnosed this against the
production database**. This is not an exploratory brief — the causes are known
and listed below with the evidence. Confirm them, then decide with the user
which to change. **Do not re-run the investigation from scratch.**

---

## The report

> chibuike, alice, jordan, janice, cynthia, friday, gift work on Wyn city
> Attendants shift 1 but i can't seem to select and put them in the shift.

Two different failures are hiding in one sentence — "can't **select**" (they
never appear in the picker) and "can't **put in**" (they appear and are
refused). Both are real and they have different causes.

---

## The template, as stored right now

`shifttemplates`, name `"Wyn city Attendants shift 1"`, tenant
`699165839f3308b1baeca8fc`:

```
role        : Attendant
department  : 6a774a5bce8af457bda41942  (Retail)
positions   : [ { roles: [Attendant, Cashier, Cleaner, Driver, Manager],
                  count: 1,
                  _id: null } ]
recurrence  : cycle, cycleLength 2, cycleDays [0], anchorDate 2026-08-10
daysOfWeek  : [1,2,3,4,5]   ← NOT READ; daysOfWeek only applies when recurrence='weekly'
startTime   : 08:40   endTime: 09:00
isActive    : true
```

Verified with the real helpers: `patternDates` returns **ok, 6 worked days** over
10–21 Aug (`10, 12, 14, 16, 18, 20`), and `templatePositions` returns **one
position of count 1**. So the template is not broken — it generates fine.

---

## CAUSE 1 — `count: 1`. This is the "can't put them in" failure.

The position declares **one seat**. Seven people cannot go into one seat.

Picking five roles on a position does **not** mean five people. It means *one
person, who may hold any of those five roles*. Capacity is `count`, and it is
still 1. This is very likely the user's mental model mismatch: the feature that
shipped today is "a crew of **positions**, each with a **count**, each accepting
**any of several roles**".

`planPatternFill` refuses every seat after the first with skip code
**`position_full`**, which is **not forceable** — there is deliberately no
override. The server's own message says it: *"That position is already filled 1
time — raise its count to add another."*

**This is new behaviour as of today's merge (`1d8dc2fa`).** Before it, a template
with no declared `positions` was uncapped and several people could cover one
role on the same day. The cap binds only when a template has **declared**
positions — spec §6.1 calls this "a deliberate tightening", and this template is
the first thing to hit it.

**The fix is a decision, not a code change.** Ask the user which they mean:

- **One shift needing 7 people, any of those roles** → set `count: 7` on the
  single position. Simplest, matches "they all work Attendants shift 1".
- **A crew of distinct posts** → e.g. `4× Attendant`, `1× Cashier`, `1× Driver`,
  `1× Manager` as separate positions with their own counts. Use this if the
  posts are genuinely different jobs.

Both are done in the template editor (`/employees/shifts/templates`) — no code.

⚠️ **Editing this template's positions re-keys nothing today** (its position
`_id` is already `null`, the adopted legacy key, so it is stable). But if you
*add* a second position, that new one mints a real `_id` and generates its own
rows. That is correct — just know it before you regenerate.

## CAUSE 2 — the department filter. This is the "can't select" failure.

The template's department is **Retail**. Three of the seven are not in Retail and
so will not appear in a picker scoped to the template's department:

| Person | Department | Planning role | In Retail? | Role accepted? |
|---|---|---|---|---|
| Alice | Retail | Attendant | ✅ | ✅ |
| Cynthia Abarakwe | Retail | Cashier | ✅ | ✅ |
| Friday Zitta | Retail | Attendant | ✅ | ✅ |
| Gift | Retail | Attendant | ✅ | ✅ |
| **Chibuike** | **Logistics** | Driver | ❌ | ✅ |
| **Janice** | **Warehouse** | Attendant | ❌ | ✅ |
| **Jordan Ogene** | **Management** | **NONE** | ❌ | ❌ |

**Confirm this one before acting** — find where the fill drawer / assignment
picker builds its employee list (`buildEmployeeFilter` in
`server/services/employee.helpers.js`, and the roster page's employee fetch) and
verify it actually filters by the template's department. If it does, that is why
three people are invisible. Options: move them into Retail, clear the template's
department, or widen the picker. **Ask the user — do not pick for them.**

## CAUSE 3 — Jordan Ogene: no roles, and a duplicate record

- `employeeProfile.planning.roles` is **empty**, so `checkAssignment` returns
  **`role_mismatch`**. That one **is** forceable, so it can be overridden — but
  the right fix is to give Jordan the role they actually hold.
- There are **two** Jordan Ogene records. One has **`tenant: undefined`** — it
  belongs to no tenant, so every tenant-scoped query skips it. That is a data
  defect worth reporting separately; do not delete anything without asking.

## CAUSE 4 — Cynthia has a deleted duplicate

Two Cynthias: one `status: 'deleted'` with no roles, and the active **Cynthia
Abarakwe** (Retail, Cashier). Make sure the user is picking the active one.
`appraisalRoster.service.js`-style deleted-employee filtering exists elsewhere in
this codebase; check the shift picker excludes `status: 'deleted'`.

## CAUSE 5 — the roster is currently EMPTY

Earlier in that same session, at the user's explicit request, **all 521 shifts
were deleted** from the production database. Templates were deliberately kept.

So if they are trying to drag people onto existing roster rows, **there are no
rows**. They must generate first, or use the pattern-fill drawer (which creates
rows itself). Backup of the deleted shifts:
`.backups/shifts-2026-08-13T20-42-14-246Z.json` (521 docs, `_id`s preserved, a
plain `insertMany` restores it). **That directory is git-ignored and local-only.**

---

## Also worth telling the user (not the reported bug)

`recurrence` is **`cycle`** — 2-day cycle, day 0, anchored 2026-08-10 — so this
template works **every other day** (10, 12, 14, 16…), *not* Monday–Friday. Its
`daysOfWeek: [1,2,3,4,5]` is leftover and is **not read** while recurrence is
`cycle`. If they expect Mon–Fri, recurrence should be `weekly`. This may well be
a second surprise waiting for them.

Also: the shift is **08:40–09:00 — twenty minutes.** Probably a placeholder, but
worth confirming.

---

## Do this first

1. **Reproduce.** Start backend (`:5001`) and admin (`:3000`), open the roster,
   open the fill drawer for this template, tick the seven. Record the *exact*
   symptom for each: absent from the list, or present and refused with which
   skip code. That single observation separates CAUSE 1 from CAUSE 2 and tells
   you which to fix.
2. **⚠️ This UI has never been opened in a browser.** The fill drawer was
   restructured by the branch merged today (`employees: string[]` → `seats:
   Seat[]`, a new position dropdown per person) and **no browser baseline was
   ever captured** — the user accepted skipping it, on the record. So if you
   find a UI defect here, you **cannot** attribute it to that branch versus
   pre-existing. Treat anything you find as needing its own investigation, and
   say plainly in your report that attribution is impossible.
3. **Then fix the smallest thing.** CAUSE 1 is almost certainly the whole
   report, and it is a `count` field in a form — not a code change. Do not start
   editing `planPatternFill`.

## Context you will want

- Spec: `docs/superpowers/specs/2026-08-12-multi-role-shift-templates-design.md`
  — §6.1 is the capacity cap and why it is not forceable.
- `server/services/shift.helpers.js` — `planPatternFill`, `checkAssignment`
  (**the one judge** — do not add a second role test), `templatePositions`,
  `reconcilePositionIds`.
- Tests: `cd server && node --test '__tests__/*.test.js'` → **2024/2027,
  `# fail 3`** (3 pre-existing: 1 pricelist tenant-scope, 2 SO-number).
  **`npm test` is broken.**
- Admin: `cd client/apps/admin && ./node_modules/.bin/vitest run` → **713/713**.
  Typecheck: `./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep -vc "\.next/"`
  → **453**. **Never `npx tsc`** (decoy that exits 0), and always filter
  `.next/` or the count reads 3 high.

---

## The prompt

> In `/Users/mac/Documents/drinksharbour`, seven people — Chibuike, Alice,
> Jordan, Janice, Cynthia, Friday and Gift — are supposed to work "Wyn city
> Attendants shift 1", but I can't select them and put them in the shift.
>
> Read `docs/superpowers/specs/RESUME-cannot-seat-seven-on-attendants-shift-1.md`
> first, all of it. A previous session already diagnosed this against the
> production database — the causes and evidence are in there. Don't redo the
> investigation.
>
> Reproduce it in a browser first and tell me, for each of the seven, whether
> they are missing from the picker or present and refused. Then fix the smallest
> thing that makes it work, and check with me before changing any template
> configuration or employee record — several of the fixes are decisions about
> how we want the roster to work, not bugs.
>
> Note the roster is currently empty: all 521 shifts were deleted at my request
> earlier today. Templates were kept.
