# Appraisal Module — Phase 2: the 360

**Date:** 2026-08-04
**Status:** design, approved for planning
**Depends on:** Phase 1, complete and verified end-to-end (Task 11, 2026-08-04).
**Parent spec:** `docs/superpowers/specs/2026-08-03-appraisal-module-design.md`
**Ledger:** `.superpowers/sdd/progress.md`

Phase 1 shipped cycles, self- and manager assessment, summary, release and
acknowledge, with the two peer states declared but unreachable. Phase 2 makes
them reachable: the employee nominates peers, the manager approves, approved
peers write feedback the employee can read but cannot attribute.

## Correction to the Phase 2 handoff prompt

The handoff states that `server/routes/appraisal.routes.js` "already declares
the two routes, marked `[P2]`". **It does not.** `POST /:id/nominate` and
`POST /:id/approve-peers` appear only in the parent spec's API listing (lines
202–203). The router declares seven appraisal routes, none of them peer-related.
Route declaration is build work in this phase, not wire-up.

Everything else the handoff claims as pre-built was verified present:
`nominating` and `pending_peer_approval` in `APPRAISAL_STATES` with their
`TRANSITIONS` edges, `nominatedPeers`/`approvedPeers` on `Appraisal`, `'peer'`
in `AppraisalFeedback.kind`, `askOf` on template questions, `peerCountMin`/
`peerCountMax` on `AppraisalCycle`, the `reviewer` relation in
`resolveAppraisalAccess`, and `projectFeedbackForViewer`'s `kind === 'peer'`
strip.

## Decisions

Eight decisions were deferred out of the parent spec. All are settled here.

| # | Decision | Choice |
|---|---|---|
| 1 | Nomination authority | Employee proposes; manager approves, rejects, **and may add** |
| 2 | Peer refusal | Explicit decline with optional reason; manager backfills |
| 3 | Minimum peer responses | Soft gate at 2, plus disclosure of *n* to the employee |
| 4 | What the subject sees | A count only — no names, no rejections |
| 5 | Cycle scope | Per-cycle `peerReviewEnabled`, default **on** |
| 6 | Stalls | HR may act on behalf, or skip peers entirely; nothing auto-advances |
| 7 | Eligibility | Any active tenant user except the subject and their manager |
| 8 | Nomination state shape | Replace the two arrays with an auditable `peerNominations[]` |

Two of these need their reasoning recorded, because the obvious reading of the
parent spec points the other way.

**On decision 1.** The parent spec says "Employee nominates, manager approves"
(line 45), which reads as approve-only. But its own edge-case table says
"Nominated peer leaves → Manager approves a replacement" (line 293). A manager
cannot approve a replacement nobody nominated, so the manager must be able to
introduce a name. Approve-only cannot satisfy the spec's own edge case.

**On decision 8.** The handoff's premise is that Phase 1 shipped the full Phase 2
data shape so no migration is needed. Replacing `nominatedPeers[]` and
`approvedPeers[]` contradicts that. It is still the right call *now*: the module
is entirely uncommitted, the only data in existence is the disposable Task 11
test cycle, and decision 6 makes HR a third party who can nominate on someone
else's behalf. With bare ObjectId arrays, nothing distinguishes a name the
employee chose from one HR substituted for them — on a document the employee
formally signs off on and may later contest. The cost of this change is
approximately zero today and rises permanently once the module ships.

## The anonymity policy is unchanged

**The manager and HR see peer reviewer names; only the employee does not.** This
was the user's explicit choice in Phase 1, made against the recommendation of
full anonymity. It is encoded in `resolveAppraisalAccess`: `canSeeReviewerNames`
is true for `hr` and `manager`, false for `subject`.

Phase 2 does not change it, so the reviewer-facing disclosure banner already
shipped in Phase 1 stays accurate and its wording does not move. If a future
phase changes the policy, the banner must change in the same commit — a reviewer
told one thing and subjected to another has been misled, and that is worse than
either policy stated honestly.

## Data model

### `Appraisal.js`

Remove `nominatedPeers[]` and `approvedPeers[]`. Add:

```js
peerNominations: [
  {
    user:       { type: ObjectId, ref: 'User', required: true },
    proposedBy: { type: ObjectId, ref: 'User', required: true },
    status:     { type: String, enum: ['proposed','approved','rejected'], default: 'proposed' },
    decidedBy:  { type: ObjectId, ref: 'User' },
    decidedAt:  { type: Date },
  },
]  // { _id: false }
```

`user` is unique within the array, enforced by `validateNominations` rather than
an index — Mongoose cannot express uniqueness within a subdocument array.

`reviewerIds` is unchanged in shape and meaning, and a peer is appended to it
**only on approval**. An unapproved or rejected nominee therefore never enters
the array that `resolveAppraisalAccess` trusts to grant the `reviewer` relation.

### `AppraisalFeedback.js`

- `status` enum gains `'declined'` → `['pending','submitted','expired','declined']`
- add `declinedAt: Date`
- add `declineReason: { type: String, trim: true, maxlength: 500 }` (optional)

The existing `unique(appraisal, reviewer)` index means a peer who declines
cannot be quietly re-added; re-nominating the same person is rejected as a
duplicate, which is the correct behaviour.

### `AppraisalCycle.js`

- add `peerReviewEnabled: { type: Boolean, default: true }`

Enabled → `launchCycle` creates appraisals in state `nominating`. Disabled →
`collecting`, exactly as Phase 1 does today. Phase 1's verified path stays live
as a real branch rather than becoming dead code.

**No `peerMinForRelease` field.** The soft-gate threshold is an exported
constant `PEER_RELEASE_MIN = 2` in the helpers. Phase 3 can promote it to a
cycle field if HR asks; adding a knob nobody has requested is not this phase's
job.

## State machine

```
draft → nominating → pending_peer_approval → collecting → summarising → released → acknowledged
          │                                      ↑
          └──────── skip-peers (HR) ─────────────┘
```

`TRANSITIONS` in `appraisal.helpers.js` already wires every edge shown **except
one**: `nominating` currently allows only `['pending_peer_approval','cancelled']`.
HR's skip-peers action needs `nominating → collecting`, so `'collecting'` must be
added to that list. `pending_peer_approval → collecting` already exists and
covers skip-peers from the later state.

A manager who rejects every nomination also lands in `collecting` with zero
approved peers. That is legitimate, not an error.

## Access model

`resolveAppraisalAccess` gains three capabilities. Defaults are `false`, and
`NO_ACCESS` gains all three as `false`.

| Capability | subject | manager | hr | reviewer |
|---|---|---|---|---|
| `canNominate` | `state === 'nominating'` | no | `state === 'nominating'` | no |
| `canApprovePeers` | no | `state === 'pending_peer_approval'` | `state === 'pending_peer_approval'` | no |
| `canBackfillPeers` | no | `state === 'collecting'` | `state === 'collecting'` | no |

HR holding all three is what implements decision 6 — acting on behalf is the
same capability exercised by a different relation, not a bypass path.

**`canRead` for the subject is unchanged**: `released` or `acknowledged` only.
Phase 2 does not relax pre-release privacy by one state. This matters more than
it looks; see the next section.

## The subject never reads the appraisal in order to nominate

The employee needs a screen at state `nominating`, but `GET /appraisals/:id`
403s for the subject pre-release and must keep doing so. Nomination is therefore
served by a **purpose-built endpoint that never returns the appraisal
document**.

`GET /appraisals/:id/nomination` returns, for the subject:

- while `state === 'nominating'` —
  `{ state, min, max, deadline, myProposals: [{ user: { _id, name, jobTitle } }] }`
  Those are names the employee typed themselves, so returning them leaks nothing.
- once `state !== 'nominating'` — `{ state, approvedCount }` and nothing else.

The rejected alternative was relaxing `canRead` for the subject at `nominating`
and letting `projectAppraisalForViewer` strip the sensitive fields. Three
reasons it was rejected:

1. **The invariant stops being unconditional.** "The subject cannot read their
   appraisal before release" is currently one flat rule, verified by a single
   403 check. Making it state-conditional produces exactly the kind of invariant
   that survives until someone adds a state or reorders a branch — and Phase 2
   is already the change that turns `reviewerIds` from harmless into a genuine
   identity leak.
2. **`projectAppraisalForViewer` is a blacklist.** It strips named fields and
   passes everything else, so any field added to `Appraisal` later is exposed by
   default. A hand-built payload is an allow-list: it can only return what it
   was written to return. For the one payload deliberately opened to the subject
   pre-release, allow-list is the right default.
3. **The count-only rule falls out naturally.** "Own proposals during
   `nominating`, a bare count afterwards" is one branch in a purpose-built
   serialiser. Expressing it by stripping fields from a document is awkward and
   easy to get subtly wrong — and getting it wrong reveals which nominations the
   manager rejected, which decision 4 forbids.

**Accepted consequence:** `/appraisals/[id]` genuinely 403s for the subject at
`nominating`, so the nomination form cannot live on the detail page. It gets its
own route, `/appraisals/[id]/nominate`, which calls only the nomination
endpoints and never `GET /:id`. The `/appraisals` landing card links straight
there. Linking a subject to a detail page they cannot open would be broken
anyway.

## API

New routes, all behind the existing `protect` + `attachTenant` +
`requireOwnTenant` stack on `appraisalRouter`:

```
GET  /api/appraisals/:id/nomination       subject's screen payload (count-only after nominating)
GET  /api/appraisals/:id/eligible-peers   picker source; active tenant users minus subject + manager
POST /api/appraisals/:id/nominate         subject or HR-on-behalf          [nominating]
POST /api/appraisals/:id/approve-peers    approve + reject + add → collecting  [pending_peer_approval]
POST /api/appraisals/:id/peers            backfill after a decline         [collecting]
POST /api/appraisals/:id/skip-peers       HR forces → collecting, no peers [nominating | pending_peer_approval]
POST /api/appraisal-feedback/:id/decline  peer declines, optional reason
```

`GET /:id/eligible-peers` returns `{ _id, name, jobTitle }` only. It is a user
directory query scoped to `req.tenant._id`, not an appraisal read, and it must
not disclose who is already nominated on anyone else's appraisal. It is gated on
the caller holding any one of `canNominate`, `canApprovePeers` or
`canBackfillPeers` on *this* appraisal — it is not an open directory endpoint.

`POST /:id/nominate` replaces **every `status: 'proposed'` entry on the
appraisal**, not merely the caller's own, so an employee revising their list
before submitting does not accumulate stale entries and HR nominating on behalf
of a silent employee produces one coherent list rather than two interleaved
ones. At state `nominating` no entry can yet be `approved` or `rejected`, so
nothing decided is ever discarded. `proposedBy` records the actual caller, which
is what makes an HR substitution distinguishable from the employee's own choice.
The request validates via `validateNominations` and is rejected whole on any
failure rather than partially applied.

`POST /:id/approve-peers` takes `{ approve: [userId], reject: [userId], add:
[userId] }`, writes `status`/`decidedBy`/`decidedAt` on each nomination, appends
approved users to `reviewerIds`, creates one `AppraisalFeedback` row per newly
approved peer (`kind: 'peer'`, `status: 'pending'`), and transitions to
`collecting`. Added names are inserted with `proposedBy` set to the caller and
`status: 'approved'` in one step.

## Peer decline and backfill

A peer opens their form, reads the disclosure banner, and may decline instead of
submitting. `POST /api/appraisal-feedback/:id/decline` sets `status: 'declined'`,
`declinedAt`, and an optional `declineReason`, and is permitted only on a row
with `status === 'pending'` and `kind === 'peer'` — self and manager assessments
are not optional and have no decline path.

The manager sees declined rows on their view and may backfill via
`POST /:id/peers` while the appraisal is still `collecting`. Backfill appends to
`peerNominations` with `status: 'approved'`, extends `reviewerIds`, and creates
the feedback row — the same code path as approval, reached from a later state.

Peers who simply never respond are handled by the Phase 1 mechanism already
verified in Task 11: `closeCycle` marks outstanding rows `expired`. The manager
can distinguish "refused" from "went quiet" and act in time only because decline
is explicit, which is the whole point of decision 2.

## Release gate and disclosure of *n*

`POST /:id/release` gains a soft gate. When the appraisal has **at least one
approved peer** and **fewer than `PEER_RELEASE_MIN` (2) submitted peer
responses**, release returns `400` with a machine-readable code
(`LOW_PEER_RESPONSE_COUNT`) and the counts. Re-issuing with
`{ confirmLowPeerCount: true }` succeeds.

The gate does not fire when zero peers were approved — an appraisal HR
deliberately ran without peers is not a degraded 360, and warning about it every
time would train managers to click through the warning that matters.

Separately and unconditionally, when the cycle has `peerReviewEnabled`, the
released view states **"this summary draws on N peer responses."** `N` is
derived by counting submitted peer feedback at read time; no new field stores
it. This is the part that actually addresses the problem decision 3 was raised
to solve — the manager's warning protects the manager's judgement, but only the
disclosure lets the employee tell an appraisal built on one response from one
built on four.

## HR stall surface

Nomination adds two new ways for an appraisal to stall: the employee never
nominates, or the manager never approves.

`GET /api/appraisal-cycles/:id/progress` gains `stalled[]` — appraisals in
`nominating` or `pending_peer_approval` past the cycle's `nominationDeadline`,
each carrying **populated employee and manager names**, not bare ObjectIds.

The same fix applies to `launchCycle`'s existing `skipped[]`, which today
returns raw employee ids with a reason code. An HR user cannot act on an
ObjectId. This is logged as an open follow-up in the Phase 1 ledger and is
closed here.

From that list HR can act on behalf (nominate, or approve) or skip peers
entirely. **Nothing auto-advances.** A deadline-triggered transition would need
scheduling machinery this module does not have, and a silent state change on a
performance record is hard to explain to the people it affects.

## Admin UI

New:

- `appraisals/[id]/nominate/page.tsx` — subject's nomination route, isolated
  from the detail page as described above
- `shared/appraisals/appraisal-nominate-form.tsx` — searchable picker over
  `GET /:id/eligible-peers`, enforcing min/max client-side for feedback while
  the server stays authoritative
- `shared/appraisals/appraisal-peer-approval.tsx` — manager: proposed list with
  approve/reject per row plus an add-your-own picker

Changed:

- reviewer form — a Decline control with an optional reason, rendered only for
  `kind === 'peer'`. The disclosure banner is untouched; the policy has not moved.
- `appraisal-manager-view.tsx` — declined rows surfaced with a backfill control
  during `collecting`; release confirmation dialog when the low-response gate
  fires
- `appraisal-subject-view.tsx` — gains **only** the "N peer responses" line
- `appraisals/page.tsx` — the landing card for an appraisal at `nominating`
  gains a "Nominate your peers" action linking to `/appraisals/[id]/nominate`,
  never to `/appraisals/[id]`, which the subject cannot open at that state
- `appraisals/cycles/[id]/page.tsx` — stalled list with act-on-behalf and
  skip-peers; `peerReviewEnabled` toggle on cycle create
- `appraisal.service.ts` — typed wrappers for the seven new endpoints

## Security audit — mandatory, per task

Phase 1's `reviewerIds` only ever held `[employee, manager]`, both already known
to the subject. **The moment approved peers land in that array, anything leaking
it becomes a real identity leak.** Phase 1's review already caught one such leak
in `acknowledgeAppraisal`. Before peers are added:

1. **Update the strip list.** `REVIEWER_IDENTITY_FIELDS` in
   `appraisal.controller.js:32` becomes `['reviewerIds', 'peerNominations']`.
   It is a single constant feeding both `sanitizeOwnAppraisalRow` and
   `projectAppraisalForViewer`, so this is one line — but leaving the stale
   `nominatedPeers`/`approvedPeers` names in place while adding the new field
   would silently pass the new one through.
2. **Re-audit every endpoint** returning an appraisal document for a
   `projectAppraisalForViewer` call. Any new list endpoint returning appraisals
   to a subject needs `sanitizeOwnAppraisalRow`.
3. **Verify the `.toObject()` behaviour still holds.** `omit` no-ops silently on
   a hydrated Mongoose document unless it calls `.toObject()` first — spreading
   a hydrated doc yields `{$__, _doc}`, not schema paths. This was fixed once
   already; any new projection written in this phase must follow the same
   pattern.
4. **`appraisal-subject-view.tsx` must continue to contain no executable
   reference to `feedback.reviewer`** — not even a defensive one. Verified by
   `grep -n reviewer` returning comments only. That structural absence, not a
   conditional, is what guarantees the subject's render path cannot leak a name.
5. **The new endpoints get the same scrutiny.** `GET /:id/nomination` must
   return the count-only shape at every state past `nominating`.
   `GET /:id/eligible-peers` must be tenant-scoped via `req.tenant._id`.

## Testing

**Unit** — every new helper: `validateNominations` (self, manager, duplicate,
ineligible, count bounds), `resolveAppraisalAccess` at both new states for all
four relations, `nominationViewForSubject` at `nominating` and past it,
`peerReleaseGate` including the zero-approved-peers case, and
`projectAppraisalForViewer` with a `peerNominations` array present.

**Controller-level harness — new, and the main coverage gain of this phase.**
There is currently no integration harness for the appraisal HTTP layer at all;
every anonymity guarantee rests on unit-tested pure helpers plus code reading.
The repo has neither supertest nor an in-memory Mongo, and its established idiom
(see `server/__tests__/adminReviewCrossTenantListing.test.js`) is to drive the
real controller with hand-stubbed models and a fake `req`/`res`.

Add `server/__tests__/helpers/appraisalHarness.js` in that idiom and drive the
real controllers through the full lifecycle: nominate → approve → peer submits →
peer declines → manager backfills → release → acknowledge. At every step where a
subject-facing payload is produced, assert that it carries no `peerNominations`,
no `reviewerIds`, and no peer `reviewer` field. This catches leaks in controller
code that pure-helper tests structurally cannot.

**Baselines.** Server `cd server && node --test '__tests__/*.test.js'` — 1003
passing of 1006, with 3 known pre-existing failures (1 pricelist populate, 2
SO-number) that are not to be fixed. Admin `node_modules/.bin/tsc --noEmit` —
~461 errors; `npx tsc` reports 0 and is lying. Admin vitest — 99 passing. The
goal is to add nothing to any of these numbers.

## Edge cases

| Case | Behaviour |
|---|---|
| Fewer eligible users than `peerCountMin` | Effective minimum is `min(peerCountMin, eligibleCount)`; nomination is never made impossible by tenant size |
| Manager rejects every nomination | Legitimate; transitions to `collecting` with zero peers, and the release gate does not fire |
| Employee nominates their own manager | Rejected by `validateNominations` — the manager already writes a manager assessment and a second row would double-count |
| Employee nominates themselves | Rejected |
| Declined peer re-nominated | Rejected as a duplicate by `unique(appraisal, reviewer)` |
| Peer leaves the company mid-cycle | Manager backfills during `collecting` (decision 1 is what makes this possible) |
| Nomination stalls past the deadline | Surfaced to HR with names; HR nominates on behalf, approves on behalf, or skips peers |
| Cycle closes with peers outstanding | Phase 1 behaviour unchanged — rows marked `expired`, manager summarises on what arrived |
| `peerReviewEnabled: false` | Launch goes straight to `collecting`; no nomination UI, no gate, no disclosure line |

## Out of scope

Deferred to Phase 3, and deliberately not started here: the HR template builder,
cycle progress dashboards, and the self-vs-manager-vs-peer comparison view. The
comparison is the payoff of `askOf` — all three reviewer kinds answer the same
`questionId` — but it needs the template builder's versioning decision settled
first, because a template edited in place would rewrite history employees have
already signed off on.

Also unchanged in this phase: `employeeProfile.appraisal.nextAppraisalDate` is
still never written, and `ensureDefaultTemplate`'s check-then-act race is still
open. Both are Phase 3 items recorded in the Phase 1 ledger.
