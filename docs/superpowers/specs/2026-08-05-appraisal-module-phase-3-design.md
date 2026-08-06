# Appraisal Module — Phase 3: templates and reporting

**Date:** 2026-08-05
**Status:** design, approved for planning
**Depends on:** Phase 1 (Tasks 1–11), Phase 2 (Tasks P2 1–16) and the Phase 2
cleanup pass (2026-08-05), all complete and verified end-to-end over live HTTP.
**Parent spec:** `docs/superpowers/specs/2026-08-03-appraisal-module-design.md`
**Phase 2 spec:** `docs/superpowers/specs/2026-08-04-appraisal-module-phase-2-design.md`
**Ledger:** `.superpowers/sdd/progress.md`

Phase 1 shipped the core loop against a single seeded template. Phase 2 made the
360 real. Phase 3 hands the form itself to HR, turns the cycle progress payload
into something HR can act on, and delivers the comparison view that `askOf` has
existed for since Phase 1.

## Corrections to the continuation brief

Both are load-bearing enough to state before anything else.

**1. `employeeProfile.appraisal.nextAppraisalDate` is not an unwritten stub.**
The parent spec (line 24) describes it as "an existing stub that nothing
currently writes to", and the Phase 3 brief asks whether recurring cycles make
it meaningful or whether it should be removed. Neither applies: it is an
HR-editable input on the employee profile form
(`client/apps/admin/src/app/shared/employees/employee-profile-form.tsx:1439`),
round-tripping through `client/apps/admin/src/services/employee.service.ts:80`
and `server/services/employee.helpers.js:330`. Nothing on the *server* writes
it because HR types it. See "Carried-over decisions" below for the resolution.

**2. `/appraisals/templates` has no route.** The brief says "the route exists;
the builder does not". `middleware.ts` gates the path (line 202, via `isUnder`),
and `tenant-menu-items.tsx` may link to it, but there is no
`client/apps/admin/src/app/(hydrogen)/appraisals/templates/` directory. Route
creation is build work in this phase. Likewise `server.js` mounts three
appraisal routers (lines 245–247) and **does not** mount
`/api/appraisal-templates`.

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Template editing | Copy-on-write versioning; free in-place edits until a cycle launches |
| 2 | Version pinning | Cycle stores the family; the concrete version is resolved once, at launch |
| 3 | Small-n peer display | Suppress the mean below `PEER_RELEASE_MIN` (2), **per question** |
| 4 | Peer breakdown | Manager/HR only, gated on `canSeeReviewerNames` and structurally absent for the subject |
| 5 | Nudges | Both channels — in-app, or in-app plus email — HR picks per nudge |
| 6 | Nudge storage | Its own collection, never a subdocument on `Appraisal` |
| 7 | Reporting depth | Completion plus final-rating distribution and per-question means |
| 8 | `ensureDefaultTemplate` race | Partial unique index on the tenant's default + atomic upsert |
| 9 | `nextAppraisalDate` | Kept, and deliberately never written by this module |

## The anonymity policy is unchanged

**The manager and HR see peer reviewer names; only the employee does not.** The
user's explicit choice in Phase 1, made against a recommendation of full
anonymity, reaffirmed in Phase 2, reaffirmed here. It is encoded in
`resolveAppraisalAccess` (`canSeeReviewerNames` true for `hr` and `manager`,
false for `subject`) and disclosed to peers *before they write* by the banner in
`reviewer-form.tsx`.

Phase 3 does not change it, so the banner's wording does not move. If a future
phase changes the policy, the banner must change in the same edit — a reviewer
told one thing and subjected to another has been misled, which is worse than
either policy stated honestly.

---

# 1. Template versioning and the builder

## Why versioning rather than freezing

A template with submitted feedback against it cannot be freely edited: deleting
or re-scoping a question orphans answers employees have already signed off on.
The read side is handled — detail views fall back to "Question no longer on this
form" for a `questionId` absent from the template. The write side is settled
here.

Copy-on-write was chosen over freeze-and-clone and over draft/publish because it
is the only option where HR never has to think about the problem. The rule is
one sentence — *a template that has never been launched against is editable; the
first edit after that forks* — and correctness does not depend on HR
understanding it.

A useful consequence: because each cycle pins its version, deleting a question
in a later version no longer orphans anything. `"Question no longer on this
form"` stops being the routine case and becomes what it was meant to be, a
genuine anomaly.

## `AppraisalTemplate` — new fields

```js
family:    { type: ObjectId, required: true, index: true }, // stable across versions
version:   { type: Number, required: true, default: 1 },
isLatest:  { type: Boolean, default: true },
isDefault: { type: Boolean, default: false },               // the tenant's seeded family
```

Indexes:

```js
schema.index({ tenant: 1, family: 1, version: 1 }, { unique: true });
schema.index(
  { tenant: 1, family: 1 },
  { unique: true, partialFilterExpression: { isLatest: true } }
);
schema.index(
  { tenant: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true, isLatest: true } }
);
```

> **Amended 2026-08-05 during implementation.** The third index was originally
> keyed on the bare `{tenant: 1}`. That collides with the `tenant` field's own
> `index: true`, and Mongoose compares key patterns while ignoring options — so
> it printed `Duplicate schema index on {"tenant":1}` on every boot and every
> test run. `isDefault` was added to the key: at most one row per tenant
> satisfies the partial filter either way, so the guarantee is unchanged, but
> the key pattern is no longer a duplicate. Both indexes are genuinely needed —
> a partial index cannot serve general tenant queries.

**Index rule compliance.** Every unique index is compound on `tenant` or keyed
on `tenant` alone, declared at schema level. No field-level `unique: true` — that
is what made `poNumber_1` enforce global uniqueness across tenants, and Mongoose
never drops or re-options an index it already created.

The second index enforces **at most one latest version per family**, for every
family. Without it that invariant would be enforced only for the default family,
as a side effect of the third index — and a family with two `isLatest` rows
resolves non-deterministically at cycle create.

The third index is the `ensureDefaultTemplate` fix. Exactly one row per tenant
can satisfy `{isDefault: true, isLatest: true}`, because only one family is the
default and only one version of it is latest. `isDefault` appears in the key as
well as the filter purely to avoid duplicating the `{tenant: 1}` key pattern —
see the amendment note above.

## `AppraisalCycle` — new field

```js
templateFamily: { type: ObjectId, ref: 'AppraisalTemplate', index: true },
```

`template` is unchanged in shape, meaning and requiredness: the concrete pinned
version. Both are set at create. **`template` is re-resolved to the family's
current latest exactly once, in `launchCycle`, and never again.**

That gives three properties at once: an edit made while a cycle sits in `draft`
is picked up; a launched cycle is frozen against every later edit; and nothing
that reads `cycle.template` today — `getAppraisal`, `loadAskedSections` — needs
to change at all.

## `ensureDefaultTemplate`

Replace check-then-act with an atomic upsert:

```js
async function ensureDefaultTemplate(tenant, userId) {
  const filter = { tenant, isDefault: true, isLatest: true };
  try {
    const { tenant: _t, isDefault: _d, isLatest: _l, ...seed } =
      buildDefaultTemplate(tenant, userId);
    return await AppraisalTemplate.findOneAndUpdate(
      filter,
      { $setOnInsert: seed },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    if (err?.code === 11000) return AppraisalTemplate.findOne(filter);
    throw err;
  }
}
```

`buildDefaultTemplate` gains `family: new mongoose.Types.ObjectId()`,
`version: 1`, `isLatest: true`, `isDefault: true`.

**The three fields in the filter must be destructured out of `$setOnInsert`.**
An upsert seeds the inserted document from its query's equality predicates, so
naming `tenant`/`isDefault`/`isLatest` in both raises a path conflict rather than
inserting. This is the kind of detail that fails only on the very first call for
a tenant — the one path that is hardest to notice in manual testing.

The duplicate-key catch is not belt-and-braces: two concurrent upserts against a
unique index genuinely produce one winner and one E11000, and re-reading is the
documented recovery.

## Migration

`server/scripts/backfill-appraisal-template-versions.js`, idempotent, in the
style of `server/scripts/migrate-purchase-doc-indexes.js`:

1. For every `AppraisalTemplate` lacking `family`, set `family = _id`,
   `version = 1`, `isLatest = true`.
2. For each tenant, mark the oldest non-archived family `isDefault: true` (the
   one `ensureDefaultTemplate`'s old `findOne` would have returned).
3. Create the three new indexes explicitly.

Step 3 is not optional. Mongoose does not add indexes to an existing collection
on its own, and the partial unique index is what closes the race.

The Wyn City tenant holds seeded Phase 1/2 test data that Phase 3's E2E reuses,
so the script must run there before E2E verification.

## API

New `server/controllers/appraisalTemplate.controller.js` (named `[P3]` in the
parent spec's file layout) and a `templateRouter` in
`server/routes/appraisal.routes.js`, behind the same
`protect + attachTenant + requireOwnTenant` stack as its siblings, plus
`tenantAdminOrSuperAdmin`.

```
GET    /api/appraisal-templates             latest version per family
POST   /api/appraisal-templates             new family at v1
GET    /api/appraisal-templates/:id         one version
GET    /api/appraisal-templates/:id/versions
PUT    /api/appraisal-templates/:id         edit — in place or fork
POST   /api/appraisal-templates/:id/archive archive the whole family
```

**`server.js` must mount `/api/appraisal-templates`.** It does not today.

### The fork decision

`PUT` branches on one question: does any cycle pinned to this version have
`launchedAt` set?

```js
const launched = await AppraisalCycle.exists({
  tenant, template: id, launchedAt: { $ne: null },
});
```

Not launched → save in place, `version` unchanged. Launched → fork.

"Launched" rather than "has submitted feedback" is deliberate and is the
stricter line: once a cycle is launched, appraisals exist and reviewers may have
a form open, so an edit is already capable of changing a question under someone
mid-answer even before anything is submitted.

### The fork write

Creating v(n+1) and clearing the old row's `isLatest` is a two-document write and
must be atomic. The `{tenant, family}` partial unique index makes a family with
two `isLatest` rows impossible to write — so a non-atomic fork does not corrupt
the data, it fails halfway: either the insert is rejected and the family keeps
v(n), or the clear succeeds and a crash before the insert leaves the family with
**no** latest version, which is what `createCycle` resolves against.

```js
await session.withTransaction(async () => {
  const current = await AppraisalTemplate.findOne({ _id: id, tenant }).session(session);
  // …re-read INSIDE the callback…
  await AppraisalTemplate.updateOne({ _id: current._id }, { $set: { isLatest: false } }, { session });
  const [next] = await AppraisalTemplate.create([{ …, version: current.version + 1, isLatest: true }], { session });
  forkedId = next._id;
});
```

`withTransaction` re-runs its **whole** callback on a transient error. Every
document must be re-read inside the callback and nothing loaded outside it may
be mutated. This exact hazard has cost this module two bugs — Phase 1's
`created.push` double-count and Phase 2's silent feedback-row loss — so the fork
gets a `failNextTransaction()` replay test, per the pattern in
`__tests__/appraisalCleanup.test.js`.

Order matters within the callback: clear the old `isLatest` **before** inserting
the new row, or the unique index rejects the insert.

### Validation

Lean on schema-level validation. The cleanup pass added a global
`ValidationError → 400` handler in `server.js` (matched by
`err instanceof mongoose.Error.ValidationError`, deliberately not by
`err.name`), returning `{success: false, message: 'Some of the values submitted
are invalid.', fields: [...paths]}`. Schema rules therefore produce a clean,
form-usable 400 for free — prefer them over hand-rolled checks.

Schema-expressible:

- `askOf` non-empty. A question nobody is asked is invisible, not optional.
- `scaleMax` required when `type === 'rating'`, absent otherwise.
- `label`, section `title` required (already true).

Hand-rolled, because a schema cannot express them: at least one section, and
each section carrying at least one question.

### Archive

`POST /:id/archive` sets `isArchived: true` on **every version of the family** in
one `updateMany`. Archiving means "do not offer for new cycles"; it does not
affect reads, so historical cycles still resolve their pinned version by `_id`
and render exactly as before.

## `createCycle`

Accepts `templateFamily`, falling back to the tenant default via
`ensureDefaultTemplate`. Sets `templateFamily` and `template` (the family's
current latest). A `templateFamily` belonging to another tenant, archived, or
non-existent is a 400 — resolved through a tenant-scoped query, never trusted
from the body.

## Admin UI

```
appraisals/templates/page.tsx        list — one row per family, showing its version
appraisals/templates/[id]/page.tsx   the editor
shared/appraisals/template-list.tsx
shared/appraisals/template-editor.tsx
shared/appraisals/template-question-row.tsx
```

The editor: add/remove/reorder sections and questions (up/down controls, not
drag — no new dependency for a form HR edits a handful of times a year), and per
question label, help text, type, `scaleMax`, `required`, and `askOf` as three
checkboxes. A template with a launched cycle shows a plain banner saying the
next save creates a new version, so the fork is never a surprise.

**`middleware.ts` needs no change.** `isUnder(path, '/appraisals/templates')`
already matches `/appraisals/templates/:id` on whole segments. Any *other* new
route gate added in this phase must use `isUnder`, never bare `startsWith`.

The cycle-create form gains a template picker sourced from
`GET /api/appraisal-templates`.

---

# 2. Cycle progress dashboard

## Roster

`GET /api/appraisal-cycles/:id/progress` is unchanged — it stays the cheap
counts payload (`{byState, feedbackTotal, feedbackSubmitted, stalled}`) that
404s correctly for an unknown or foreign-tenant id.

The roster is a second endpoint, `GET /api/appraisal-cycles/:id/roster`,
paginated (`?page=&limit=`, default 50), sorted by state then employee name:

```
{ _id, state,
  employee: { _id, firstName, lastName, email, jobTitle },
  manager:  { _id, firstName, lastName, email },
  self:  { status, submittedAt } | null,
  mgr:   { status, submittedAt } | null,
  peers: { approved, submitted, declined, pending },
  outstanding: [{ target: { _id, firstName, lastName, email }, reason }],
  lastNudge:   { sentAt, channel, reason } | null }
```

Two queries: the appraisals, and one aggregate over `AppraisalFeedback` grouped
by appraisal — exactly what the cleanup pass's `{tenant, cycle, status}` index
was added for — joined in memory at cycle size.

`peers.approved` must call `countApprovedPeers(appraisal)` from
`appraisal.helpers.js`, not re-filter the array. That helper is the single
definition of "an approved peer"; three separate longhand copies is the bug it
was extracted to prevent.

## `outstandingActionsFor`

A pure helper — "who is holding this up" gets one definition and an exhaustive
per-state unit test:

| State | Outstanding |
|---|---|
| `nominating` | the employee, reason `nominate` |
| `pending_peer_approval` | the manager, reason `approve_peers` |
| `collecting` | every pending feedback row's reviewer, reason `feedback`; when none are pending, the manager, reason `summarise` |
| `summarising` | the manager, reason `summarise` |
| `released` | the employee, reason `acknowledge` |
| `acknowledged`, `cancelled` | nothing |

## `AppraisalNudge`

A new collection, **not** a subdocument array on `Appraisal`.

```js
{ tenant, appraisal, cycle,
  target:  { type: ObjectId, ref: 'User', required: true },
  reason:  { enum: ['nominate','approve_peers','feedback','summarise','acknowledge'] },
  channel: { enum: ['app','email'] },
  sentBy, sentAt,
  emailError: { type: String } }
```

Indexes `{tenant, cycle, target}` and `{tenant, appraisal, target, reason, sentAt: -1}`.

A nudge aimed at an outstanding peer carries that peer's id in `target`. As a
subdocument on `Appraisal` it would be an identity-bearing field on the very
document projected to the subject — it would have to be added to
`REVIEWER_IDENTITY_FIELDS`, which is a **deny-list**, so it would be exposed by
default until someone remembered. As a separate collection the subject's payload
structurally never carries it. This is the same argument the parent spec used to
split `AppraisalFeedback` out of `Appraisal`, and it is why no new entry on
`REVIEWER_IDENTITY_FIELDS` is needed in this phase.

Repeat nudges are kept as history, not overwritten — the roster's
`nudged 2d ago` reads the most recent row.

## The nudge endpoint

`POST /api/appraisals/:id/nudge` with `{target, reason, channel}`, on the
appraisal router, gated on `access.canManageCycle`.

**HR-only in Phase 3.** The manager is arguably the more natural chaser and the
gate is one condition away from admitting them, but that needs its own UI on the
team page and is deliberately out of scope. `target` must be genuinely
outstanding per `outstandingActionsFor` — a nudge naming an arbitrary user is a
400, so the endpoint cannot be used to probe who is on an appraisal.

### Throttle

A repeat nudge for the same `(appraisal, target, reason)` within
`NUDGE_MIN_INTERVAL_HOURS = 12` returns 429 with code `NUDGE_TOO_SOON` and
`retryAfter`. `{force: true}` overrides.

This is mostly about a double-click sending two emails, and about a stalled
appraisal not becoming a week of daily mail for one person who is on leave.

### Honest send reporting

When `channel: 'email'` and the send fails, the `AppraisalNudge` row is written
with `channel: 'app'` and the error in `emailError`, and the response reports
that the in-app reminder landed and the email did not.

This is a direct response to this repo's history: prod SMTP rejected every send
with a 535, the mailer silently fell back to dev mode, and the logs still said
`✅`. A nudge that reports success for an email nobody received is worse than no
nudge, because HR stops chasing.

Email content: cycle name, what is outstanding, the deadline, and a deep link.
A peer's reminder names the appraisal's subject — which that peer already knows,
having been asked to review them — and no email ever names another reviewer.

### In-app delivery

No new surface. `GET /api/appraisals/my` and `GET /api/appraisals/my/reviews`
gain `nudge: { sentAt, reason }` for the caller as `target`, only while that
action is still outstanding. The existing landing and review cards render it.

## Report

`GET /api/appraisal-cycles/:id/report`, HR-only:

```
{ releasedCount,
  finalRatingHistogram: [{ rating, count }],
  questionStats: [{ questionId, label,
                    self:    { mean, n },
                    manager: { mean, n },
                    peer:    { mean, n } }] }
```

Means are broken out **per reviewer kind** rather than pooled. A single blended
mean over self, manager and peer answers has no interpretation — it moves when
the peer count changes — and splitting costs nothing inside the same aggregate.

Aggregated over `AppraisalFeedback` with `{tenant, cycle, status: 'submitted'}`
and `$unwind: '$answers'`, hitting the new compound index. Labels resolve
against the cycle's **pinned** template version, which is only unambiguous
because of decision 2.

Stated rather than gated: in a cycle with one released appraisal, the cycle mean
*is* that person's score. HR can already read every appraisal in its own tenant,
so this discloses nothing new — but it matters before anyone reads a two-person
histogram as a trend.

## UI

`cycle-detail.tsx` is already 545 lines and would roughly double. It stays as
the shell and gains two siblings:

- `shared/appraisals/cycle-roster.tsx` — the table, the nudge control with its
  two channels, and the `nudged 2d ago` state
- `shared/appraisals/cycle-report.tsx` — histogram and per-question means,
  rendered only once `releasedCount > 0`

---

# 3. Self vs manager vs peer comparison

## `buildComparison`

A pure helper in `appraisal.helpers.js`, one row per **rating** question. Text
answers stay in the existing feedback cards, where prose reads better than a bar.

```
buildComparison(sections, feedback, access) -> [{
  sectionTitle, questionId, label, scaleMax,
  self:    number | null,
  manager: number | null,
  peer:    { mean: number | null, n: number, suppressed: boolean },
  peerBreakdown: [{ reviewer, rating }] | null,
}]
```

Rules:

- `n` counts submitted peer rows carrying a numeric rating **for that question**.
- `suppressed` is `n < PEER_RELEASE_MIN` (2); `mean` is then `null`. The UI shows
  "Based on 1 response" and points at the peer card below.
- **Suppression is per question, not per appraisal.** A peer may answer three of
  four questions, so `n` genuinely differs by row.
- `peerBreakdown` is `null` unless `access.canSeeReviewerNames`.
- A `questionId` on a feedback row with no matching question in `sections` is
  dropped, not rendered under a fabricated label. With version pinning this
  should now be unreachable; the guard stays because "unreachable" is a claim
  about today's code.

`PEER_RELEASE_MIN` is reused rather than a second threshold introduced. The
number means the same thing in both places — below this, the peer signal is too
thin to stand on — and two constants that must agree eventually disagree.

## Why it cannot leak

Computed in `getAppraisal` **from the already-projected `feedback` array**, after
`projectFeedbackForViewer` has run. For a subject viewer that means
`peerBreakdown` is not merely gated off by `canSeeReviewerNames`: the `reviewer`
field is not in the input data at all, and non-`submitted` rows have already had
`answers` stripped. Two independent reasons it cannot populate, one of them
structural.

`assertNoIdentityLeak` in `appraisalLifecycleLeaks.test.js` gains
`payload.comparison` in its traversal, alongside the top level, `.appraisal`,
`.access`, `.sections` and `feedback[].appraisal` it already covers.

## UI

The same split as the detail page, for the same reason:

- `shared/appraisals/appraisal-comparison.tsx` — aggregate only. **No reference
  to `reviewer` anywhere in the file.** Imported by both the subject and manager
  views.
- `shared/appraisals/appraisal-peer-breakdown.tsx` — per-peer named rows.
  Imported by the **manager view only**.

The grep guarantee extends accordingly: `grep -n reviewer` must return comments
only in `appraisal-subject-view.tsx` **and** `appraisal-comparison.tsx`. That
structural absence, not a conditional, is the guarantee.

---

# Carried-over decisions

| Item | Resolution |
|---|---|
| `ensureDefaultTemplate` check-then-act race | **Closed** — partial unique index + atomic upsert |
| `nextAppraisalDate` | **Kept, never written by this module** (below) |
| Concurrent `launchCycle` | Still open, deliberately — retry recovers; not worth a lock for an HR button |
| `CastError → 400` | Still as-is — a malformed ObjectId is a routing or client bug |
| Seeded Wyn City test data | Reused by this phase's E2E; **delete before production use of that tenant** |

**On `nextAppraisalDate`.** It is a manual HR planning field, not an orphan (see
Corrections). Auto-populating it at cycle launch would silently overwrite what
HR typed into the employee profile form, and HR's plan for the *next* review is
information this module does not have. So: this module never writes it. The
parent spec's "revisit in Phase 3" note becomes a settled decision. No code
change.

---

# Security audit — mandatory, per task

1. **`REVIEWER_IDENTITY_FIELDS` stays `['reviewerIds', 'peerNominations']`** —
   because nudges live in their own collection and `peerBreakdown` is absent
   from the subject's input, not because Phase 3 added nothing identity-bearing.
   Any *new* field denormalising per-reviewer data onto `Appraisal` goes on the
   list; it is a deny-list, so a new field is exposed by default.
2. **`omit()` and every new projection must call `.toObject()` before
   spreading.** Spreading a hydrated Mongoose document yields `{$__, _doc}`, not
   schema paths, so a projection that skips it silently strips nothing. This has
   been a real bug in this module twice.
3. **`appraisal-subject-view.tsx` and `appraisal-comparison.tsx` contain no
   executable reference to `feedback.reviewer`** — verified by grep returning
   comments only.
4. **The subject's `canRead` stays `released|acknowledged` only.** Nothing in
   this phase relaxes it. The template and roster endpoints are HR-gated; the
   comparison rides on the existing `getAppraisal` gate.
5. **Every new endpoint is tenant-scoped via `req.tenant._id`** —
   `req.tenantId` does not exist in this codebase. A foreign-tenant id 404s
   rather than 403s or 200s-with-zeroes.
6. **The nudge endpoint cannot be used to probe.** `target` must be genuinely
   outstanding per `outstandingActionsFor`, or 400.

# Testing

**Pure helpers** — `buildComparison` (per-question suppression, the
`canSeeReviewerNames` gate, text-question exclusion, zero peers, unknown
`questionId`, `scaleMax` passthrough); `outstandingActionsFor` across every
state including `cancelled`; the fork/in-place decision; the nudge throttle.

**Controller harness** (`__tests__/helpers/appraisalHarness.js`) — note it
**stages writes**: a hydrated fake buffers assignments and merges only on
`.save()`, so a controller that forgets to save now fails its tests.

- template authored → edited in place → cycle launched → edited again and
  **forks**, with the running cycle still resolving v1
- **`failNextTransaction()` replay test on the fork** — this phase's new
  multi-document write. Assert exactly one v2 row and exactly one `isLatest`.
- two concurrent `ensureDefaultTemplate` calls yield one template
- roster shape, including `peers.approved` via `countApprovedPeers`
- nudge writes a row; throttles at 12h; `{force: true}` overrides; a failed
  email is reported as a failure and stored as `channel: 'app'` + `emailError`
- report aggregation, including the zero-released case
- foreign-tenant template id → 404

**Leak tests** — `assertNoIdentityLeak` traverses `payload.comparison`; the
subject's payload asserts `peerBreakdown === null` on every row; the manager's
asserts it is populated.

**Model tests** — the three new template indexes present and tenant-keyed; the
partial unique index's filter expression asserted, not just its existence.

**E2E over live HTTP**, reusing the `*@wyncity.test` accounts under Wyn City
(password `Appraisal#Test2026`), after running the backfill script: author a
template, launch a cycle scoped with `employeeIds` so no real staff are
appraised, fork the template and confirm the running cycle is unmoved, nudge
both channels, see the in-app reminder appear for the target, then read the
comparison as the employee and as the manager and diff what each received.

**Baselines — do not regress.** Server `cd server && node --test
'__tests__/*.test.js'` → **1078/1081** (`npm test` is broken); the 3 failures are
pre-existing and confirmed by name: `get-one pricelist is tenant-scoped:
cross-tenant _id returns 404`, `generateSalesOrderNumber produces an SO-prefixed
daily-sequenced string…`, `createSalesOrderDoc persists a tenant-scoped order
with snapshot totals`. Admin `node_modules/.bin/tsc --noEmit` → **461** (`npx
tsc` reports 0 and is lying). Admin `npx vitest run` → **99**.

# Process constraints

- **Nothing is committed and nothing is `git add`ed** unless the user asks in
  that turn. All appraisal work across all three phases is deliberately
  uncommitted; this overrides any skill that says to commit.
- The working tree holds ~190 uncommitted files across three unshipped projects
  and is the only copy. **Never** `git checkout .`, `git stash`,
  `git reset --hard`, or `git clean`.
- Per-task diffs come from scratchpad snapshots plus `diff -ruN`, not git.
- Every subagent dispatch names its in-scope directories explicitly, and states
  that anything outside them must be reported rather than edited. A Phase 2
  UI-scoped task silently widened a projection on the anonymity boundary.
- Backend on **:5001** — `lsof -ti:5001` before trusting a `npm run dev` banner;
  a stale listener makes it print "✅ running" after `listen()` hit EADDRINUSE.
- Never open or print `server/_insp.js`; never echo `.env` values.
- Append each task's outcome to `.superpowers/sdd/progress.md` as you go.

# Out of scope

Deliberately not started here, and not blocking anything:

- **Manager-initiated nudges.** HR-only this phase; the gate is one condition
  away.
- **Recurring cycles.** Nothing auto-advances and nothing is scheduled; a
  deadline-triggered transition needs machinery this module does not have, and a
  silent state change on a performance record is hard to explain to its subject.
- **Per-manager calibration reporting.** Comparing one manager's rating pattern
  against another's raises an access question — who may see it — that has not
  been asked.
- **Drag-and-drop question reordering.** Up/down controls, no new dependency.
- **Cross-cycle trend reporting.** Needs at least two comparable released cycles
  in one tenant, which does not exist yet.
