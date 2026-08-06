# Appraisal Module — Design

**Date:** 2026-08-03
**Status:** Approved for Phase 1 implementation
**Location:** `client/apps/admin` (UI) + `server` (API/data)

## Purpose

Give tenants a performance appraisal system in the admin app: HR launches a review
cycle, each employee is appraised through 360 feedback (self, manager, peers), the
manager summarises and rates, and the employee acknowledges the result.

The whole module is specified here. **Phase 1 is the current build scope**; Phases 2
and 3 are documented so Phase 1 does not paint them into a corner.

## Context: what already exists

Employees are not a separate model. They are `User` documents with an Odoo-style
`employeeProfile` subdocument, scoped by `tenant`. Two existing pieces this module
builds on directly:

- `employeeProfile.work.manager` — an `ObjectId` ref to another `User`, the reporting
  line. Self-reference and cycles are already enforced in `employee.controller.js`.
- `employeeProfile.appraisal.nextAppraisalDate` — an existing stub that nothing
  currently writes to. **This module deliberately does not write it in Phase 1.**
  Cycle scheduling is HR-driven, so the field has no unambiguous value to take until
  recurring cycles exist; revisit in Phase 3. It is called out here so its emptiness
  is a recorded decision rather than an oversight.

`tenant_staff` can hold an admin session (asserted in
`app/api/auth/[...nextauth]/authorize.test.ts`), with the sidebar and middleware
restricting what they see. This is what makes a 360 feasible: peers log in and fill
their own forms.

Authorization is a `resource:action` permission map in
`client/apps/admin/src/types/authorization.ts`, with route-prefix gating in
`client/apps/admin/src/middleware.ts`.

## Decisions

| Decision | Choice |
| --- | --- |
| Participants | Full 360 — self + manager + peers |
| Trigger | HR launches a review cycle |
| Peer selection | Employee nominates, manager approves |
| Anonymity | Peer feedback anonymous **to the employee**; named to manager and HR |
| Form | Configurable templates authored by HR |
| Close-out | Manager summarises → release → employee acknowledges |
| Data model | Four collections |
| Delivery | Phased, core loop first |

## Data model

Four collections, all tenant-scoped.

**Index rule:** every unique index is compound on `tenant` and declared at schema
level. No field-level `unique: true` — that is what caused `poNumber_1` to enforce
global uniqueness across tenants, and Mongoose never drops or re-options an index it
already created.

### `AppraisalTemplate`

HR-authored form definition. Phase 3 builds the editor; Phase 1 seeds one default
template per tenant.

```
tenant, name, description, isArchived, createdBy
sections: [{
  title,
  questions: [{
    _id, type: 'rating' | 'text', label, helpText, required,
    scaleMax,                          // ratings only
    askOf: ['self', 'manager', 'peer'] // which reviewer kinds are asked this
  }]
}]
```

`askOf` lets one template serve all three reviewer kinds, so self, manager and peer
answers land on the **same** `questionId`. This is what makes cross-reviewer
comparison ("self rated 5, peers averaged 2.8") a direct lookup rather than a mapping
exercise, and it is why the reviewer form is one component rather than three.

### `AppraisalCycle`

```
tenant, name, template,
status: 'draft' | 'collecting' | 'closed' | 'cancelled',
nominationDeadline, feedbackDeadline,
peerCountMin, peerCountMax,
createdBy, launchedAt, closedAt
```

### `Appraisal`

One row per employee per cycle. `unique(tenant, cycle, employee)`.

```
tenant, cycle, employee, manager,
state, nominatedPeers[], approvedPeers[],
summary, finalRating,
releasedAt, releasedBy, acknowledgedAt, employeeResponse
```

`manager` is a **snapshot** taken at launch, not read live from
`employeeProfile.work.manager`. A reorg mid-cycle must not silently rewrite who was
responsible for an appraisal already in flight, or retroactively change the history of
a closed one.

**State machine:**

```
draft → nominating → pending_peer_approval → collecting
      → summarising → released → acknowledged
```

`cancelled` is reachable from any state.

Phase 1 skips the two peer states: `draft → collecting → summarising → released →
acknowledged`.

### `AppraisalFeedback`

One row per reviewer per appraisal. `unique(appraisal, reviewer)`.

```
tenant, appraisal, cycle,
reviewer, kind: 'self' | 'manager' | 'peer',
answers: [{ questionId, rating, text }],
status: 'pending' | 'submitted', submittedAt
```

`cycle` is denormalised so completion statistics are a `countDocuments` rather than a
join.

Separating feedback into its own collection (rather than embedding it in `Appraisal`)
buys three things:

1. **Anonymity is enforced by query projection.** The employee-facing read projects
   `reviewer` out whenever `kind === 'peer'`. Identity is never loaded, so it cannot
   leak through a code path that forgot to sanitise.
2. **No write contention.** A reviewer submitting touches only their own row.
3. **Cheap progress stats.** "Who hasn't responded" is a count, not a scan.

Submitted feedback is immutable. Re-opening is an explicit HR action and is
audit-logged.

## Access control

The permission map is role-based, but appraisal access is **relationship**-based:
whether you may read an appraisal depends on whether you are its subject, its
manager, an invited reviewer, or HR — not on your role alone.

All four are resolved by one service, `server/services/appraisalAccess.service.js`:

```js
resolveAppraisalAccess(user, appraisal) → {
  relation: 'hr' | 'subject' | 'manager' | 'reviewer' | 'none',
  canRead, canSeeReviewerNames, canSummarise, canRelease, canAcknowledge, ...
}
```

No route hand-rolls this check. Centralising it is what keeps the anonymity guarantee
true across every endpoint rather than per-route.

`hr` means a caller holding `appraisals:manage` — `tenant_owner`, `tenant_admin`, or a
platform admin — resolved against the caller's own tenant. `manager` and `subject` are
matched on the appraisal's snapshotted `manager` and `employee` fields respectively.
Relations are checked in the explicit order **`subject` → `hr` → `manager` →
`reviewer`**, and the first match wins. `subject` is deliberately first so that an HR
user who is themselves being appraised resolves as `subject` on their own record and
cannot unmask peer feedback written about them. HR precedes `manager` so an HR user
retains full cycle powers over anyone else, including their own direct reports.

| Relation | Sees peer identities | Key capabilities |
| --- | --- | --- |
| `hr` | Yes | Cycles, templates, launch/close, release, reassign manager, re-open |
| `manager` | Yes | Read reports' feedback, approve peers, summarise, release |
| `subject` | **No** | Nominate peers, submit self-assessment, read after release, acknowledge |
| `reviewer` | n/a | Read and submit only their own feedback row |

The subject reads the full appraisal only once `state ∈ {released, acknowledged}`.
Before that they see their own self-assessment and nomination step only.

### Disclosure

The peer feedback form states plainly, before the reviewer writes anything, who will
see their name (their manager, HR) and who will not (the person being reviewed).
Reviewers calibrating candour against a wrong assumption is worse than either policy
stated honestly.

## API

All routes sit behind `protect` + `attachTenant` + `requireOwnTenant`, matching the
isolation rule used by the other tenant-owned modules (JWT claim only; no `?tenant=`
pivot, no client-supplied `tenantId`).

```
GET  /api/appraisals/my                    my appraisals (as subject)
GET  /api/appraisals/my/reviews            feedback requests assigned to me
GET  /api/appraisals/team                  appraisals where I am the manager
GET  /api/appraisals/:id                   access-resolved read
POST /api/appraisals/:id/nominate          subject nominates peers          [P2]
POST /api/appraisals/:id/approve-peers     manager approves → creates rows  [P2]
POST /api/appraisals/:id/summary           manager summary + final rating
POST /api/appraisals/:id/release           → released
POST /api/appraisals/:id/acknowledge       subject sign-off + response

GET   /api/appraisal-feedback/:id          reviewer loads own form
PATCH /api/appraisal-feedback/:id          save draft
POST  /api/appraisal-feedback/:id/submit   submit — locks

GET/POST /api/appraisal-cycles             HR
POST /api/appraisal-cycles/:id/launch      fan out one Appraisal per employee
POST /api/appraisal-cycles/:id/close
GET  /api/appraisal-cycles/:id/progress    completion stats
```

### Server file layout

Controllers are split by audience rather than collected into one file, because the
four audiences share almost no logic:

```
server/models/AppraisalTemplate.js
server/models/AppraisalCycle.js
server/models/Appraisal.js
server/models/AppraisalFeedback.js
server/routes/appraisal.routes.js
server/controllers/appraisalCycle.controller.js       HR
server/controllers/appraisal.controller.js            subject + manager
server/controllers/appraisalFeedback.controller.js    reviewers
server/controllers/appraisalTemplate.controller.js    HR                     [P3]
server/services/appraisalAccess.service.js            access resolver
```

## Admin UI

```
client/apps/admin/src/app/(hydrogen)/appraisals/
  page.tsx                        "My appraisals" — landing for every tenant role
  [id]/page.tsx                   appraisal detail
  reviews/[feedbackId]/page.tsx   reviewer form
  team/page.tsx                   manager: my reports
  cycles/page.tsx                 HR: cycle list
  cycles/[id]/page.tsx            HR: scope, progress, launch/close
  templates/                      HR: template builder                       [P3]

client/apps/admin/src/app/shared/appraisals/    components
client/apps/admin/src/services/appraisal.service.ts
```

`/appraisals` is the spine: every tenant role lands there and sees their own appraisal
with its current state and next action, plus their outstanding feedback requests. For
most staff most of the time that is the entire module.

The detail page selects a component by `relation` rather than branching inside one
component:

- `appraisal-subject-view.tsx`
- `appraisal-manager-view.tsx`
- `appraisal-hr-view.tsx`

Four audiences see genuinely different pages, and the subject's component then has no
code path that could render a peer's name.

The reviewer form is a single shared component driven by the template's `askOf`, so
self, manager and peer forms differ by data rather than by code.

### Permissions and routing

Add to `client/apps/admin/src/types/authorization.ts`:

- `appraisals:read`, `appraisals:review` → all tenant roles, **including
  `tenant_staff`**
- `appraisals:manage` → `tenant_owner`, `tenant_admin`, platform admins

These shape the UI only; the server-side resolver is the real gate.

In `client/apps/admin/src/middleware.ts`, `/appraisals` is a new prefix that
`tenant_staff` **can** reach — deliberately unlike `/employees` — because staff must
fill self-assessments and peer feedback. Only `/appraisals/cycles` and
`/appraisals/templates` get HR-only gating.

Sidebar (`tenant-menu-items.tsx`): "Appraisals" for all tenant roles, with "Cycles"
and "Templates" as children shown only under `appraisals:manage`.

## Edge cases

| Case | Behaviour |
| --- | --- |
| Employee leaves mid-cycle | Appraisal `cancelled`, retained not deleted |
| Manager changes mid-cycle | Snapshot holds; HR can explicitly reassign |
| Nominated peer leaves | Manager approves a replacement |
| Deadline passes, peers unsubmitted | Manager summarises on what arrived; pending rows marked `expired` |
| Employee has no manager | Launch skips them and reports it; no orphan appraisal |
| Re-launching a cycle | Idempotent — `unique(tenant, cycle, employee)` prevents duplicates |
| Feedback edited after submit | Rejected; re-open is an HR action, audit-logged |

## Testing

Server tests run with `node --test '__tests__/*.test.js'` (not `npm test`). Current
baseline is 939/942 — 3 pre-existing failures (1 pricelist populate, 2 SO-number).
Admin uses Vitest (99 passing); admin `tsc` baseline is ~461 errors, checked with
`node_modules/.bin/tsc`, since `npx tsc` reports 0 incorrectly.

Priority coverage:

1. **Access resolver** — every relation × every state.
2. **Anonymity projection** — assert `reviewer` never appears in any subject-facing
   payload for `kind === 'peer'`.
3. **Cycle launch** — fan-out correctness, idempotency, skipping managerless
   employees.
4. **Tenant isolation** — all four collections, including that a compound index is
   present and not globally unique.
5. **State machine** — illegal transitions rejected.

## Phasing

**Phase 1 — core loop (current scope).**
Cycle create/launch/close; self and manager assessment against one seeded default
template; manager summary and final rating; release; employee acknowledgement.
States: `draft → collecting → summarising → released → acknowledged`. No peers, no
template editor. Useful and shippable on its own.

**Phase 2 — the 360.**
Peer nomination, manager approval, the `nominating` and `pending_peer_approval`
states, anonymous-to-employee peer feedback, disclosure banner.

**Phase 3 — templates and reporting.**
HR template builder, cycle progress dashboards, self-vs-manager-vs-peer comparison.

Phase 1 ships the full four-collection schema including `askOf` and the `peer` kind,
so Phases 2 and 3 add behaviour without migrating data.
