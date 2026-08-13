# Multi-role shift templates — design

Written 2026-08-12 on `main` at `f91201bb`. Supersedes the question in
`RESUME-multi-role-shift-templates.md` §2, which asked which of three features
"select more than one role" meant.

**The answer is both readings at once**: a template describes a *crew* (1
bartender + 2 servers), and each position in that crew accepts *several
qualifying roles* (1 bartender-or-barback + 2 servers-or-runners). This is
reading (b) and reading (a) combined — the largest of the options the resume
doc laid out.

---

## 1. What changes, in one paragraph

A shift template stops being one slot and becomes a list of **positions**, each
a set of acceptable roles and a count. Generating a range emits one open shift
row per required position per worked day. Each generated row carries the whole
acceptable-role set, so a cross-trained person is not refused. `Shift.employee`
stays a single nullable ref and one row still means one person — the invariant
in resume §3 and §5 is untouched.

---

## 2. Data model

### 2.1 `ShiftTemplate` — additive

```js
positions: [{
  // Mongoose's default subdocument _id. LOAD-BEARING: it is the idempotency
  // handle (§4). It survives both reordering and edits to `roles`, which a
  // key derived from the role set does not.
  roles: {
    type: [{ type: ObjectId, ref: 'EmployeeRole' }],
    validate: at least one entry,
  },
  count: { type: Number, min: 1, max: 20, default: 1 },
}],
```

`role` **stays and stays `required: true`**. It is now the legacy-and-display
field, mirrored from `positions[0].roles[0]` on every save. Keeping it means:

- `TEMPLATE_POPULATE` (`shift.controller.js:52`) is unchanged,
- the `?role=` template filter (`shift.controller.js:184`) is unchanged,
- the roster colour fallback still resolves,
- no field has to be re-optioned — and **Mongoose never re-options an existing
  field nor drops a de-declared index** (see the stale-global-unique-index note
  in project memory).

### 2.2 `Shift` — additive, no backfill

```js
// The other roles this shift accepts, beyond `role`. Empty = single-role,
// which is what every row written before this change means.
altRoles: { type: [{ type: ObjectId, ref: 'EmployeeRole' }], default: [] },

// Which template position this row fills. Null for a hand-made shift and for
// every row generated before positions existed.
templatePosition: { type: ObjectId, default: null },
```

`role` remains the **primary**: it colours the chip, labels the row, and answers
the `?role=` shift filter. Every shipped row is already correct with the two
defaults — there is no migration script in this project.

### 2.3 Why not `Shift.roles: [ObjectId]`

Considered and rejected. It is conceptually purer — "bartender OR barback" is
genuinely symmetric — but it needs a backfill of every shift row, a `required`
field dropped, and a decision at each read site about which role is the display
one. That last point just reinvents a primary role implicitly, and less
honestly. The additive shape gets identical behaviour for none of the cost.

---

## 3. The one normaliser

```js
// shift.helpers.js
templatePositions(tpl)
//  → tpl.positions when non-empty
//  → [{ _id: null, roles: [tpl.role], count: 1 }] otherwise
```

**Every planner reads positions through this and nowhere else**, the same
one-reader discipline `patternDates` already has for
`recurrence`/`cycleDays`/`anchorDate`. It is what makes a legacy template
generate byte-identically to today, and it is why no migration is needed.

Do not add a second reader.

---

## 4. Generation and idempotency

This is the single most likely way to break shipped behaviour (resume §4).
`planShiftGeneration` currently keys `template@startInstant` and treats the key
as a **boolean** — taken or not. One template emitting N rows a day makes that
key non-unique, and re-generating a range would duplicate.

### 4.1 What a generated row looks like

Each row a position emits is an ordinary open shift:

```js
{
  template:         tpl._id,
  templatePosition: position._id,        // null for a legacy template
  employee:         null,                // open by design
  role:             position.roles[0],   // the primary — colours and labels the row
  altRoles:         position.roles.slice(1),
  department:       tpl.department,      // template-wide, as today
  start, end, breakMinutes,              // template-wide, as today
  status:           'draft',             // creation never publishes
}
```

A position with `count: 2` emits two rows identical but for their `_id`. That is
correct: two servers are two slots, and two slots are two rows.

### 4.2 The key

```
key = `${templateId}@${startInstant}@${positionId ?? ''}`
```

A legacy template has no positions, so `templatePositions` hands back
`_id: null` and the key is `template@start@` — the same suppression behaviour
as today.

#### The `_id` must survive an edit — by identity, not by position in the array

Because the key is the position's `_id`, an edit that changes it re-keys every
day already generated and the next run duplicates the lot. Mongoose mints new
subdocument `_id`s on a `$set` of a whole array, so the update path has to carry
them across deliberately.

It carries them **by identity**: the client round-trips each surviving
position's `_id` in the update body, and the server keeps an `_id` it recognises
on the stored template and mints a fresh one otherwise. An unrecognised `_id` is
dropped rather than trusted, so a caller cannot graft another template's
position id onto this one.

Recovering the ids by array *index* instead — which this design originally
specified — is not equivalent, and was replaced on 2026-08-13. Index recovery
holds for a plain edit and for appending, but silently corrupts the roster when
an admin removes a non-trailing position: given `[A: Bartender ×1, B: Server
×2]`, removing Bartender re-stamps the surviving Server position with A's `_id`,
so the one stale Bartender row counts toward the Server quota while both real
Server rows are orphaned, and the next generate leaves four rows on a day whose
crew declares two. Minting a fresh `_id` on shrink is worse, not a repair: the
count then reads zero and generation adds two more.

Deleting a position still orphans its already-generated rows. That is correct
and unchanged — it is what already happens when a template's role changes.

#### The first widening of a legacy template keeps the legacy key

A template with no stored `positions` generates under `template@start@`, because
§3's normaliser synthesizes `{_id: null}` for it and every row it wrote carries
`templatePosition: null`.

The moment an admin declares a crew on it — *"my Server template should also
accept Runners"*, which is the most natural first edit anyone makes to this
feature, and **every template in the system is legacy today** — minting a fresh
`_id` would re-key the template. Every day already generated would be stranded
under the old key and the next run would write a second full crew over it. That
is precisely what the `_id` handle exists to prevent: widening a position's
roles must not re-key days already generated.

So **position 0 adopts the legacy null key** rather than minting one. It stays
adopted across later edits, because a template still on the legacy key has a
falsy `_id` at position 0 — the editor cannot send `null` back, so the stored
value is what marks it. The key is given up only when the body sends a real,
recognised `_id` at position 0, which is what removing the legacy position looks
like once the survivor shifts into index 0. Those legacy rows then orphan, which
is right: that position is gone.

Only position 0 adopts. A second position minted in the same save gets a real
`_id` as usual.

The whole reconciliation lives in `reconcilePositionIds` in
`shift.helpers.js` — not in the controller. It decides whether an edit keeps a
roster or duplicates it, and the server suite is unit-only with no database, so
a rule in a controller is a rule no test can reach.

### 4.3 Count reconciliation, not a boolean

```
want   = position.count
have   = non-cancelled existing rows matching the key
create = max(0, want - have)
```

- wants 2, none exist → create 2
- wants 2, two exist → create 0, and push **one `skipped` row naming the
  position**. `skipped` is reported in full, never swallowed.
- count raised 2 → 3 → create exactly 1
- position reordered in the editor → key unchanged → create 0
- position's `roles` edited → key unchanged → create 0

The last two are why the key is the position `_id` and not a signature derived
from the role set. A role-set signature is stable under reordering but **not**
under editing a position's roles: changing "Server" to "Server OR Runner" would
change the key of every already-generated day, and the next re-generate would
create a second row for each. That is the duplication bug the resume doc warned
about, reached by a more likely route than reordering.

Storing `templatePosition` on the shift is what makes the key derivable at read
time.

---

## 5. Eligibility — `checkAssignment` stays the one judge

The only rule change in the codebase, at `shift.helpers.js:677`:

```js
const held     = new Set((employee.employeeProfile?.planning?.roles || []).map(idOf));
const accepted = [idOf(shift.role), ...(shift.altRoles || []).map(idOf)].filter(Boolean);
if (accepted.length && !accepted.some((r) => held.has(r))) { … role_mismatch … }
```

Set intersection replaces `held.includes(required)`. Notes:

- The code stays `role_mismatch` and stays the **only** member of
  `FORCEABLE_CODES`. Widening eligibility must not delete the override path
  (resume §4): a barback on a bartender-only shift is still a judgement a human
  makes.
- Only the *message* widens when more than one role is accepted, so it names
  the set rather than "that role".
- `judgeAssignments` and `planPatternFill` keep delegating and add no rules.
  **Do not grow a second role test anywhere.**
- With `altRoles` empty the branch is behaviourally identical to today.

---

## 6. Pattern fill with explicit seats

`POST /api/shifts/fill` (shipped in `f91201bb`) takes seats:

```js
employees: [{ employee: "<id>", position: "<positionId>" }]
```

Bare `"<id>"` entries stay accepted and map to the template's sole position, or
to `null` for a legacy template, so the shipped contract does not break.

A filled row is built exactly as §4.1 describes — same `role`/`altRoles`
derivation from the seat's position, same `templatePosition` — with `employee`
set instead of null.

Its three-part key `template@startInstant@employee` is **unchanged and still
unique** — one person cannot hold two positions on one night regardless, since
`checkAssignment` refuses that as an `overlap`.

`planPatternFill` keeps its deliberate skip-rather-than-refuse divergence from
the all-or-nothing multi-select create. Do not "fix" that back.

### 6.1 One cap, one place — a deliberate tightening

The count is enforced in exactly one place:

```
want = position.count
have = every non-cancelled row on that (template, instant, position)
```

Generation creates `want - have` (§4). Fill refuses a seat once `have >= want`,
with skip code **`position_full`**, **not forceable** — to seat a third server,
raise the count.

**This changes shipped behaviour and that is intended.** Today `/generate` and
`/fill` deliberately never collide: `shift.helpers.js:475-478` documents that an
open row keys as `template@start@` and a person's row as
`template@start@employee`, so generating a Friday and then filling it produces
two rows for one slot. Under a shared cap the second action now reports
`position_full` instead. The old coexistence is a latent double-staffing bug.

If this proves wrong in use, the fallback is to count only filled rows toward
the fill cap, leaving the two lanes independent as they are today.

#### The one exemption: a template with no declared `positions`

The cap binds **declared crew positions only**. A legacy template — no
`positions` array, only the bare `role` — normalises (§3) to a single
synthesized position `{_id: null, roles: [role], count: 1}`. That `count: 1` is
correct for generation, where it means "one open slot to create", but it is
**not** a seat cap: `f91201bb`'s shipped fill contract lets several named people
cover one legacy role on the same day, and eight existing `planPatternFill`
tests depend on it. Capping there would seat one person and refuse the rest on
every pre-existing pattern.

So `planPatternFill` skips the cap entirely when the template declares no
positions. The discriminator is read off the template itself —

```js
const hasDeclaredPositions =
  Array.isArray(template.positions) && template.positions.length > 0;
```

— and deliberately **not** off the synthesized position's null `_id`. Nothing in
`templatePositions`'s contract promises that a null `_id` means "no cap"; a
hand-built template object supplying a declared position without an `_id` would
silently lose its cap. Same rule, sounder discriminator.

---

## 7. UI

Admin tests run `environment: 'node'` with **no jsdom — components cannot be
rendered**. All arithmetic therefore lives in a new
`client/apps/admin/src/app/shared/employees/shift-position-utils.ts`:

- `templatePositions(tpl)` — the client mirror of §3
- `seatOptions(template, existingRows)` — the drawer's dropdown contents
- `remainingForPosition(position, existingRows)` — the "1 left" count
- position labelling ("Server ×2", "Bartender or Barback")

Components stay dumb:

- **`templates/page.tsx`** — a positions list. Each row is a multi-select of
  roles plus a count; the first role is marked primary. The old single role
  picker becomes derived from `positions[0].roles[0]`.
- **`shift-roster-page.tsx` fill drawer** — a per-person position dropdown
  showing remaining capacity.

`shift.service.ts` gains `ShiftPosition`, `positions` on `ShiftTemplate` and
`ShiftTemplateInput`, and `altRoles`/`templatePosition` on `Shift`.

The roster colour fallback and `roleLabel` (`shift-roster-page.tsx:1297,1309`)
are **unchanged** — they read `shift.role`, which is still the primary. Roster
lanes group by employee and never touch role, so `buildRosterLanes` is untouched
too.

---

## 8. Tests, written first

TDD throughout — test before implementation, per `superpowers:test-driven-development`.

### Server (`cd server && node --test '__tests__/*.test.js'`, unit-only, no DB)

Rules live in `services/*.helpers.js`, never a controller — controller code is
untested by construction.

`templatePositions`:
- legacy template with only `role` → one position, count 1, `_id: null`
- template with positions → passed through unchanged

`planShiftGeneration`:
- 1× Bartender + 2× Server → **3 rows on one worked day**, each with its own
  single primary `role` and its own `altRoles`
- re-run the same range → 0 created, 3 skipped, every skip reported
- **position's `roles` edited → re-generate creates 0 rows** ← the regression
  `templatePosition` exists for; this fails on a role-signature key
- positions reordered → re-generate creates 0 rows
- count raised 2 → 3 → exactly 1 new row
- legacy single-role template → output identical to today

`checkAssignment`:
- holder of the alt role → `ok`
- holder of neither → `role_mismatch`, `forceable: true` preserved
- `force: true` → passes with a `role_mismatch` warning
- empty `altRoles` → behaves exactly as today
- `overlap` and `time_off` still take priority over the role check

`planPatternFill`:
- seats honoured — each person lands on the position they were given
- seat on a full position → `position_full`, `forceable: false`
- a person holding only the alt role is now accepted where they were refused
- the existing cross-midnight / batch-conflict / skipped-day behaviours from
  `f91201bb` still hold

`buildShiftTemplatePayload` / `buildShiftPayload`:
- positions validated; a position with no roles is rejected
- `role` mirrored from `positions[0].roles[0]`
- *"A template must require a role"* still returned for a role-less template —
  the message is user-visible and tested

### Admin (`cd client/apps/admin && ./node_modules/.bin/vitest run`)

`shift-position-utils.test.ts` — seat options, remaining counts, position
labels, legacy fallback.

### Baselines to hold

| | Command | Baseline |
|---|---|---|
| Server | `node --test '__tests__/*.test.js'` | **1973 / 1976** (3 pre-existing: 1 pricelist tenant-scope, 2 SO-number). `npm test` is broken. |
| Admin tests | `./node_modules/.bin/vitest run` | **684 / 684** |
| Admin types | `./node_modules/.bin/tsc --noEmit` | **456**, all pre-existing |

**Never `npx tsc`** in `client/apps/admin` — it installs a decoy `tsc@2.0.4`
that prints "This is not the tsc command you are looking for" and exits 0, so a
typecheck that verified nothing looks like a pass.

---

## 9. Sequencing

**Run `f91201bb`'s seven manual browser checks before touching the fill
drawer.** They are at the end of
`docs/superpowers/plans/2026-08-12-shift-pattern-fill.md`. That UI has never
been opened in a browser, and this design edits the same screens — without a
before-state, a bug introduced here and a bug already sitting there are
indistinguishable.

Then, in order:

1. `templatePositions` + model fields (no behaviour change; legacy path proven identical)
2. `planShiftGeneration` count reconciliation + `templatePosition` key
3. `checkAssignment` intersection
4. `planPatternFill` seats + `position_full`
5. payload builders and controller wiring
6. `shift-position-utils.ts`
7. template editor UI
8. fill drawer UI

Steps 1–3 are independently shippable and carry the whole regression risk.

---

## 10. Invariants this design does not touch

- **`Shift.employee === null` = OPEN SHIFT**, single nullable ref, one row per
  person per day. A crew of 3 is 3 ordinary rows.
- **`checkAssignment` is the ONE judge**; `FORCEABLE_CODES` lives on the server
  and the browser reads `forceable` off the response. No client-side copy.
- **Generation is idempotent.** Re-running a range must not duplicate.
  `skipped` is reported in full.
- **Creation never publishes.** Generated and filled rows are `draft`.
- **`patternDates` is the ONE reader** of `recurrence`/`cycleDays`/`anchorDate`.
- **Rules live in `services/*.helpers.js`, never a controller.**
- **Admin tests cannot render components.**

---

## 11. Out of scope

- Dead `fromTemplate` in `shift-roster-page.tsx` — zero callers, left in place
  deliberately, the human has not ruled. Ask before removing.
- The badge backfill (`scripts/backfill-employee-badge-numbers.js`), still never
  run — unrelated to this work.
- Per-position colours, notes, break minutes or times. Positions differ only in
  roles and count; everything else stays template-wide. YAGNI until asked.
