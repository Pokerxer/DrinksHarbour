# Appraisal Module Phase 2 — the 360 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the two declared-but-unreachable peer states real — the employee nominates peers, the manager approves, approved peers write feedback the employee can read but cannot attribute.

**Architecture:** Peer selection lives in a new auditable `peerNominations[]` subdocument on `Appraisal`, replacing the two bare ObjectId arrays Phase 1 shipped. A peer joins `reviewerIds` only on approval, so the array the access resolver trusts never contains an unapproved nominee. The subject's nomination screen is fed by a purpose-built allow-list endpoint rather than by relaxing `canRead`, keeping "the subject cannot read their appraisal before release" a single unconditional rule. All decision logic stays in pure helpers in `appraisal.helpers.js` so it can be unit-tested exhaustively.

**Tech Stack:** Node/Express, Mongoose, `node:test` (server), Next.js App Router + TypeScript + rizzui (admin), Vitest (admin).

**Spec:** `docs/superpowers/specs/2026-08-04-appraisal-module-phase-2-design.md` — read it before Task 1.

## Global Constraints

- **DO NOT COMMIT and do not `git add`.** The user's standing rule (2026-07-30) is to leave finished work uncommitted unless they ask in that turn. Every task ends with a verification checkpoint, **not** a commit. This overrides the writing-plans skill's default commit step.
- **The working tree holds ~190 uncommitted files across three unshipped projects and is the only copy.** NEVER run `git checkout .`, `git stash`, `git reset --hard`, or `git clean`.
- Never open or print `server/_insp.js` (plaintext production Atlas credential). Never echo `.env` values.
- Server tests: `cd server && node --test '__tests__/*.test.js'`. **`npm test` is broken.** Baseline **1003 passing / 1006** — 3 known pre-existing failures (1 pricelist populate, 2 SO-number). Do not fix those.
- Admin typecheck: `cd client/apps/admin && node_modules/.bin/tsc --noEmit`. **`npx tsc` lies and reports 0.** Baseline **~461** errors. Goal is to add none, not to reach zero.
- Admin tests: `cd client/apps/admin && npx vitest run`. Baseline **99 passing**.
- Tenant scoping in controllers is **`req.tenant._id`**. `req.tenantId` does not exist in this codebase.
- The anonymity policy is unchanged from Phase 1: **manager and HR see peer reviewer names; only the employee does not.** Do not "fix" it. The reviewer disclosure banner already states this and its wording must not move.
- Plan text is a proposal to verify against real code, never ground truth. Phase 1 found a real bug in the plan's own sample code in almost every task. Keep the per-task review gate.

---

### Task 1: Data model and state machine

**Files:**
- Modify: `server/models/Appraisal.js:17-18`
- Modify: `server/models/AppraisalFeedback.js:22-28`
- Modify: `server/models/AppraisalCycle.js:17-18`
- Modify: `server/services/appraisal.helpers.js:20-29`
- Modify: `server/controllers/appraisal.controller.js:32`
- Test: `server/__tests__/appraisal.model.test.js`

**Interfaces:**
- Produces: `Appraisal.peerNominations[]` with fields `{user, proposedBy, status, decidedBy, decidedAt}`; `AppraisalFeedback.status` accepting `'declined'` plus `declinedAt`/`declineReason`; `AppraisalCycle.peerReviewEnabled`; `TRANSITIONS.nominating` including `'collecting'`; `REVIEWER_IDENTITY_FIELDS === ['reviewerIds', 'peerNominations']`.

- [ ] **Step 1: Write the failing tests**

Append to `server/__tests__/appraisal.model.test.js`:

```js
const { TRANSITIONS } = require('../services/appraisal.helpers');
const AppraisalCycle = require('../models/AppraisalCycle');

test('peerNominations records who proposed and who decided', () => {
  const path = Appraisal.schema.path('peerNominations');
  assert.ok(path, 'peerNominations exists');
  const sub = path.schema;
  for (const f of ['user', 'proposedBy', 'status', 'decidedBy', 'decidedAt']) {
    assert.ok(sub.path(f), `peerNominations.${f} exists`);
  }
  assert.deepStrictEqual(
    sub.path('status').enumValues,
    ['proposed', 'approved', 'rejected']
  );
});

test('the Phase 1 bare peer arrays are gone', () => {
  assert.strictEqual(Appraisal.schema.path('nominatedPeers'), undefined);
  assert.strictEqual(Appraisal.schema.path('approvedPeers'), undefined);
});

test('a peer can decline, distinctly from expiring', () => {
  assert.deepStrictEqual(
    AppraisalFeedback.schema.path('status').enumValues,
    ['pending', 'submitted', 'expired', 'declined']
  );
  assert.ok(AppraisalFeedback.schema.path('declinedAt'));
  assert.ok(AppraisalFeedback.schema.path('declineReason'));
});

test('peer review is a per-cycle setting, on by default', () => {
  const path = AppraisalCycle.schema.path('peerReviewEnabled');
  assert.ok(path);
  assert.strictEqual(path.defaultValue, true);
});

test('HR can skip nomination straight to collecting', () => {
  // skip-peers must be legal from BOTH nomination states.
  assert.ok(TRANSITIONS.nominating.includes('collecting'));
  assert.ok(TRANSITIONS.pending_peer_approval.includes('collecting'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && node --test __tests__/appraisal.model.test.js`
Expected: FAIL — `peerNominations exists` is falsy, status enum mismatch, `peerReviewEnabled` undefined, `TRANSITIONS.nominating` missing `'collecting'`.

- [ ] **Step 3: Add the nomination subdocument**

In `server/models/Appraisal.js`, above `appraisalSchema`:

```js
// A nomination, not a reviewer. `user` only becomes a reviewer — and only then
// joins reviewerIds — once status flips to 'approved'. proposedBy/decidedBy are
// recorded because HR may nominate or approve on someone else's behalf, and a
// record the employee signs off on must be able to show whose choice it was.
const peerNominationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    proposedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['proposed', 'approved', 'rejected'],
      default: 'proposed',
    },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
  },
  { _id: false }
);
```

Replace lines 17-18 (`nominatedPeers` / `approvedPeers`) with:

```js
    // Uniqueness of `user` within this array is enforced by validateNominations
    // — Mongoose cannot express uniqueness inside a subdocument array.
    peerNominations: [peerNominationSchema],
```

- [ ] **Step 4: Add decline to the feedback model**

In `server/models/AppraisalFeedback.js`, replace the `status` field and add two fields after `submittedAt`:

```js
    status: {
      type: String,
      // 'declined' is deliberately distinct from 'expired': a manager who can
      // tell "refused" from "went quiet" can backfill a replacement in time.
      enum: ['pending', 'submitted', 'expired', 'declined'],
      default: 'pending',
      index: true,
    },
    submittedAt: { type: Date },
    declinedAt: { type: Date },
    declineReason: { type: String, trim: true, maxlength: 500 },
```

- [ ] **Step 5: Add the cycle flag**

In `server/models/AppraisalCycle.js`, after `peerCountMax`:

```js
    // Off → launch lands appraisals straight in 'collecting', exactly as
    // Phase 1 did, so that verified path stays a live branch rather than
    // becoming dead code.
    peerReviewEnabled: { type: Boolean, default: true },
```

- [ ] **Step 6: Add the skip-peers transition edge**

In `server/services/appraisal.helpers.js`, change the `nominating` line of `TRANSITIONS`:

```js
  // 'collecting' is HR's skip-peers escape hatch: an employee who never
  // nominates must not be able to hold their own appraisal hostage.
  nominating: ['pending_peer_approval', 'collecting', 'cancelled'],
```

- [ ] **Step 7: Update the reviewer-identity strip list**

In `server/controllers/appraisal.controller.js`, replace line 32:

```js
const REVIEWER_IDENTITY_FIELDS = ['reviewerIds', 'peerNominations'];
```

Update the comment above it so it names `peerNominations` rather than "the Phase 2 peer-nomination lists".

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd server && node --test __tests__/appraisal.model.test.js`
Expected: PASS, all tests in the file.

- [ ] **Step 9: Checkpoint — no commit**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -5`
Expected: **1008 pass / 1011** (baseline 1003/1006 plus the 5 new tests), same 3 known failures.
Do **not** `git add` or `git commit`.

---

### Task 2: Access resolver — the three new capabilities

**Files:**
- Modify: `server/services/appraisal.helpers.js:48-140`
- Test: `server/__tests__/appraisal.helpers.test.js`

**Interfaces:**
- Consumes: nothing from Task 1 beyond the model shape.
- Produces: `resolveAppraisalAccess` returning `canNominate`, `canApprovePeers`, `canBackfillPeers` on every branch including `NO_ACCESS`.

- [ ] **Step 1: Write the failing tests**

Append to `server/__tests__/appraisal.helpers.test.js` (reuse the file's existing `oid()`/fixture helpers — read the top of the file first and match them):

```js
test('the subject nominates only while nominating', () => {
  const employee = oid(), manager = oid(), tenant = oid();
  const mk = (state) => ({ tenant, employee, manager, state, reviewerIds: [] });
  const user = { _id: employee, tenant, role: 'tenant_staff' };
  assert.strictEqual(resolveAppraisalAccess(user, mk('nominating')).canNominate, true);
  for (const s of ['draft', 'pending_peer_approval', 'collecting', 'released']) {
    assert.strictEqual(resolveAppraisalAccess(user, mk(s)).canNominate, false, s);
  }
});

test('nomination never widens what the subject can READ', () => {
  const employee = oid(), tenant = oid();
  const a = { tenant, employee, manager: oid(), state: 'nominating', reviewerIds: [] };
  const access = resolveAppraisalAccess({ _id: employee, tenant, role: 'tenant_staff' }, a);
  assert.strictEqual(access.canRead, false, 'pre-release privacy is not relaxed by one state');
  assert.strictEqual(access.canSeeReviewerNames, false);
});

test('the manager approves peers only at pending_peer_approval, backfills only at collecting', () => {
  const manager = oid(), tenant = oid();
  const mk = (state) => ({ tenant, employee: oid(), manager, state, reviewerIds: [] });
  const user = { _id: manager, tenant, role: 'tenant_staff' };
  assert.strictEqual(resolveAppraisalAccess(user, mk('pending_peer_approval')).canApprovePeers, true);
  assert.strictEqual(resolveAppraisalAccess(user, mk('collecting')).canApprovePeers, false);
  assert.strictEqual(resolveAppraisalAccess(user, mk('collecting')).canBackfillPeers, true);
  assert.strictEqual(resolveAppraisalAccess(user, mk('pending_peer_approval')).canBackfillPeers, false);
  assert.strictEqual(resolveAppraisalAccess(user, mk('nominating')).canNominate, false);
});

test('HR holds all three so acting on behalf is a capability, not a bypass', () => {
  const tenant = oid();
  const mk = (state) => ({ tenant, employee: oid(), manager: oid(), state, reviewerIds: [] });
  const hr = { _id: oid(), tenant, role: 'tenant_admin' };
  assert.strictEqual(resolveAppraisalAccess(hr, mk('nominating')).canNominate, true);
  assert.strictEqual(resolveAppraisalAccess(hr, mk('pending_peer_approval')).canApprovePeers, true);
  assert.strictEqual(resolveAppraisalAccess(hr, mk('collecting')).canBackfillPeers, true);
});

test('an approved peer gets none of the three', () => {
  const peer = oid(), tenant = oid();
  const a = { tenant, employee: oid(), manager: oid(), state: 'collecting', reviewerIds: [peer] };
  const access = resolveAppraisalAccess({ _id: peer, tenant, role: 'tenant_staff' }, a);
  assert.strictEqual(access.relation, 'reviewer');
  assert.strictEqual(access.canNominate, false);
  assert.strictEqual(access.canApprovePeers, false);
  assert.strictEqual(access.canBackfillPeers, false);
});

test('NO_ACCESS denies the new capabilities too', () => {
  const access = resolveAppraisalAccess(null, null);
  assert.strictEqual(access.canNominate, false);
  assert.strictEqual(access.canApprovePeers, false);
  assert.strictEqual(access.canBackfillPeers, false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && node --test __tests__/appraisal.helpers.test.js`
Expected: FAIL — `canNominate` etc. are `undefined`, not `false`/`true`.

- [ ] **Step 3: Extend NO_ACCESS and every relation branch**

In `server/services/appraisal.helpers.js`, add to `NO_ACCESS`:

```js
  canNominate: false,
  canApprovePeers: false,
  canBackfillPeers: false,
```

In the **subject** branch add:

```js
      canNominate: state === 'nominating',
      canApprovePeers: false,
      canBackfillPeers: false,
```

In the **hr** branch add:

```js
      // HR holds all three so a stalled appraisal can be unblocked by acting
      // on the employee's or manager's behalf — see the spec's stall surface.
      canNominate: state === 'nominating',
      canApprovePeers: state === 'pending_peer_approval',
      canBackfillPeers: state === 'collecting',
```

In the **manager** branch add:

```js
      canNominate: false,
      canApprovePeers: state === 'pending_peer_approval',
      canBackfillPeers: state === 'collecting',
```

In the **reviewer** branch add all three as `false`.

Leave `canRead` for the subject exactly as it is: `state === 'released' || state === 'acknowledged'`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && node --test __tests__/appraisal.helpers.test.js`
Expected: PASS.

- [ ] **Step 5: Checkpoint — no commit**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -5`
Expected: 3 known failures only. Do not `git add` or `git commit`.

---

### Task 3: Pure nomination helpers

**Files:**
- Modify: `server/services/appraisal.helpers.js` (add functions + exports)
- Test: `server/__tests__/appraisal.helpers.test.js`

**Interfaces:**
- Produces, all exported from `appraisal.helpers.js`:
  - `PEER_RELEASE_MIN` — number, `2`
  - `effectiveNominationMin(peerCountMin, eligibleCount)` → number
  - `validateNominations(candidateIds, {subjectId, managerId, eligibleIds, min, max})` → `{valid, errors: string[], userIds: string[]}`
  - `applyNominationDecisions(nominations, {approve, reject, add}, deciderId)` → new array
  - `planPeerRowCreation(nominations, existingReviewerIds)` → `string[]` of user ids needing a feedback row
  - `nominationViewForSubject(appraisal, cycle, eligibleCount)` → `{state, min?, max?, deadline?, myProposals?, approvedCount?}`
  - `peerReleaseGate({approvedPeerCount, submittedPeerCount, confirmed})` → `{blocked, code?, approvedPeerCount?, submittedPeerCount?, threshold?}`

- [ ] **Step 1: Write the failing tests**

Append to `server/__tests__/appraisal.helpers.test.js`:

```js
const {
  PEER_RELEASE_MIN, effectiveNominationMin, validateNominations,
  applyNominationDecisions, planPeerRowCreation, nominationViewForSubject,
  peerReleaseGate,
} = require('../services/appraisal.helpers');

test('a small tenant cannot be made unable to nominate', () => {
  assert.strictEqual(effectiveNominationMin(3, 10), 3);
  assert.strictEqual(effectiveNominationMin(3, 1), 1, 'min never exceeds who exists');
  assert.strictEqual(effectiveNominationMin(3, 0), 0);
});

test('validateNominations rejects self, the manager, duplicates and outsiders', () => {
  const subjectId = oid(), managerId = oid(), a = oid(), b = oid(), outsider = oid();
  const base = { subjectId, managerId, eligibleIds: [a, b], min: 1, max: 3 };

  assert.strictEqual(validateNominations([a, b], base).valid, true);
  assert.strictEqual(validateNominations([subjectId], base).valid, false);
  assert.strictEqual(validateNominations([managerId], base).valid, false);
  assert.strictEqual(validateNominations([a, a], base).valid, false);
  assert.strictEqual(validateNominations([outsider], base).valid, false);
  assert.strictEqual(validateNominations([], base).valid, false, 'below min');
  assert.strictEqual(
    validateNominations([a, b, oid(), oid()], { ...base, eligibleIds: [a, b] }).valid,
    false, 'above max'
  );
  // Errors are human-readable, not codes — they surface straight to the user.
  const res = validateNominations([subjectId], base);
  assert.ok(res.errors.length > 0 && typeof res.errors[0] === 'string');
});

test('applyNominationDecisions stamps who decided, and adds arrive pre-approved', () => {
  const decider = oid(), keep = oid(), drop = oid(), extra = oid();
  const before = [
    { user: keep, proposedBy: oid(), status: 'proposed' },
    { user: drop, proposedBy: oid(), status: 'proposed' },
  ];
  const after = applyNominationDecisions(
    before, { approve: [keep], reject: [drop], add: [extra] }, decider
  );
  const byUser = (u) => after.find((n) => String(n.user) === String(u));
  assert.strictEqual(byUser(keep).status, 'approved');
  assert.strictEqual(byUser(drop).status, 'rejected');
  assert.strictEqual(String(byUser(keep).decidedBy), String(decider));
  assert.ok(byUser(keep).decidedAt instanceof Date);
  assert.strictEqual(byUser(extra).status, 'approved', 'a manager-added name needs no second approval');
  assert.strictEqual(String(byUser(extra).proposedBy), String(decider));
  assert.strictEqual(after.length, 3);
});

test('only approved nominations become feedback rows, and never twice', () => {
  const approved = oid(), rejected = oid(), already = oid();
  const noms = [
    { user: approved, status: 'approved' },
    { user: rejected, status: 'rejected' },
    { user: already, status: 'approved' },
  ];
  const plan = planPeerRowCreation(noms, [oid(), already]);
  assert.deepStrictEqual(plan.map(String), [String(approved)]);
});

test('the subject sees their own proposals while nominating, a bare count after', () => {
  const mine = oid();
  const cycle = { peerCountMin: 3, peerCountMax: 5, nominationDeadline: new Date('2026-09-01') };
  const nominating = nominationViewForSubject(
    { state: 'nominating', peerNominations: [{ user: mine, status: 'proposed' }] },
    cycle, 10
  );
  assert.strictEqual(nominating.min, 3);
  assert.strictEqual(nominating.max, 5);
  assert.strictEqual(nominating.myProposals.length, 1);
  assert.strictEqual(nominating.approvedCount, undefined);

  // Past nominating: a count and nothing else, so rejections stay invisible.
  const after = nominationViewForSubject(
    {
      state: 'collecting',
      peerNominations: [
        { user: oid(), status: 'approved' },
        { user: oid(), status: 'rejected' },
      ],
    },
    cycle, 10
  );
  assert.deepStrictEqual(Object.keys(after).sort(), ['approvedCount', 'state']);
  assert.strictEqual(after.approvedCount, 1);
});

test('the release gate warns on thin peer input but not on a deliberate no-peer run', () => {
  assert.strictEqual(PEER_RELEASE_MIN, 2);
  assert.strictEqual(peerReleaseGate({ approvedPeerCount: 0, submittedPeerCount: 0 }).blocked, false,
    'HR ran this cycle without peers on purpose — do not train managers to click through');
  assert.strictEqual(peerReleaseGate({ approvedPeerCount: 3, submittedPeerCount: 2 }).blocked, false);
  const thin = peerReleaseGate({ approvedPeerCount: 3, submittedPeerCount: 1 });
  assert.strictEqual(thin.blocked, true);
  assert.strictEqual(thin.code, 'LOW_PEER_RESPONSE_COUNT');
  assert.strictEqual(thin.threshold, 2);
  assert.strictEqual(
    peerReleaseGate({ approvedPeerCount: 3, submittedPeerCount: 1, confirmed: true }).blocked,
    false
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && node --test __tests__/appraisal.helpers.test.js`
Expected: FAIL — `effectiveNominationMin is not a function`.

- [ ] **Step 3: Implement the helpers**

Append to `server/services/appraisal.helpers.js`, before `module.exports`:

```js
// Below this many SUBMITTED peer responses, releasing prompts the manager to
// confirm. A constant, not a cycle field: nobody has asked to tune it, and an
// unused knob is a maintenance cost. Phase 3 can promote it if HR asks.
const PEER_RELEASE_MIN = 2;

/**
 * A tenant with fewer eligible people than the cycle's peerCountMin must still
 * be able to run a nomination. The configured minimum is an aspiration, not a
 * reason to make the step impossible.
 */
function effectiveNominationMin(peerCountMin, eligibleCount) {
  return Math.min(Number(peerCountMin) || 0, Number(eligibleCount) || 0);
}

/**
 * Validate a proposed peer list. Returns human-readable errors because they
 * surface directly to whoever is nominating; callers reject the whole request
 * rather than partially applying, so a half-valid list never lands.
 */
function validateNominations(candidateIds, opts = {}) {
  const { subjectId, managerId, eligibleIds = [], min = 0, max = Infinity } = opts;
  const errors = [];
  const raw = (candidateIds || []).map(idOf).filter(Boolean);
  const userIds = [...new Set(raw)];

  if (userIds.length !== raw.length) errors.push('The same person was nominated more than once.');
  if (userIds.includes(idOf(subjectId))) errors.push('You cannot nominate yourself.');
  if (userIds.includes(idOf(managerId))) {
    errors.push('Your manager already writes a manager assessment and cannot also be a peer.');
  }

  const eligible = new Set(eligibleIds.map(idOf));
  if (userIds.some((u) => !eligible.has(u))) {
    errors.push('One or more of the people nominated are not eligible to review this appraisal.');
  }
  if (userIds.length < min) errors.push(`Nominate at least ${min} ${min === 1 ? 'person' : 'people'}.`);
  if (userIds.length > max) errors.push(`Nominate at most ${max} ${max === 1 ? 'person' : 'people'}.`);

  return { valid: errors.length === 0, errors, userIds };
}

/**
 * Apply a manager's approve/reject/add decisions to the nomination array.
 * A name the decider adds themselves is stored already 'approved' — routing it
 * back through 'proposed' would mean asking them to approve their own choice.
 */
function applyNominationDecisions(nominations, decisions = {}, deciderId) {
  const approve = new Set((decisions.approve || []).map(idOf));
  const reject = new Set((decisions.reject || []).map(idOf));
  const add = (decisions.add || []).map(idOf).filter(Boolean);
  const decidedAt = new Date();

  const out = (nominations || []).map((n) => {
    const uid = idOf(n.user);
    if (!approve.has(uid) && !reject.has(uid)) return n;
    return {
      ...(typeof n.toObject === 'function' ? n.toObject() : n),
      status: approve.has(uid) ? 'approved' : 'rejected',
      decidedBy: deciderId,
      decidedAt,
    };
  });

  const known = new Set(out.map((n) => idOf(n.user)));
  for (const uid of add) {
    if (known.has(uid)) continue;
    known.add(uid);
    out.push({
      user: uid,
      proposedBy: deciderId,
      status: 'approved',
      decidedBy: deciderId,
      decidedAt,
    });
  }
  return out;
}

/**
 * Which approved peers still need an AppraisalFeedback row. Skipping anyone
 * already in reviewerIds makes approve-peers and backfill idempotent — a
 * double-submitted approval must not collide on unique(appraisal, reviewer).
 */
function planPeerRowCreation(nominations, existingReviewerIds = []) {
  const seen = new Set(existingReviewerIds.map(idOf));
  const out = [];
  for (const n of nominations || []) {
    if (n.status !== 'approved') continue;
    const uid = idOf(n.user);
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    out.push(uid);
  }
  return out;
}

/**
 * The ONLY appraisal-derived payload the subject may read before release.
 *
 * This is an allow-list, deliberately: it can return nothing but the keys
 * written here, so a field added to Appraisal later cannot leak through it the
 * way it could through a strip-list projection. Past 'nominating' it collapses
 * to a bare count, which is what keeps the manager's rejections invisible.
 */
function nominationViewForSubject(appraisal, cycle, eligibleCount) {
  const state = appraisal?.state;
  const nominations = appraisal?.peerNominations || [];

  if (state !== 'nominating') {
    return {
      state,
      approvedCount: nominations.filter((n) => n.status === 'approved').length,
    };
  }

  return {
    state,
    min: effectiveNominationMin(cycle?.peerCountMin, eligibleCount),
    max: Number(cycle?.peerCountMax) || 0,
    deadline: cycle?.nominationDeadline || null,
    // Names the employee typed themselves — returning them leaks nothing.
    myProposals: nominations
      .filter((n) => n.status === 'proposed')
      .map((n) => ({ user: n.user })),
  };
}

/**
 * Soft gate on releasing an appraisal built on thin peer input.
 *
 * Silent when no peer was ever approved: an appraisal HR deliberately ran
 * without peers is not a degraded 360, and warning every time would train
 * managers to click through the warning that does matter.
 */
function peerReleaseGate({ approvedPeerCount = 0, submittedPeerCount = 0, confirmed = false } = {}) {
  if (approvedPeerCount === 0) return { blocked: false };
  if (submittedPeerCount >= PEER_RELEASE_MIN) return { blocked: false };
  if (confirmed) return { blocked: false };
  return {
    blocked: true,
    code: 'LOW_PEER_RESPONSE_COUNT',
    approvedPeerCount,
    submittedPeerCount,
    threshold: PEER_RELEASE_MIN,
  };
}
```

Add all seven names to `module.exports`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && node --test __tests__/appraisal.helpers.test.js`
Expected: PASS.

- [ ] **Step 5: Checkpoint — no commit**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -5`
Expected: 3 known failures only. Do not `git add` or `git commit`.

---

### Task 4: Launch honours peerReviewEnabled, and skipped[] carries names

**Files:**
- Modify: `server/controllers/appraisalCycle.controller.js:80-131`
- Test: `server/__tests__/appraisalCycle.launch.test.js` (create)

**Interfaces:**
- Consumes: `AppraisalCycle.peerReviewEnabled` (Task 1).
- Produces: appraisals created in state `'nominating'` when the cycle has peer review on, `'collecting'` when off; `launchCycle`'s response `skipped[]` entries shaped `{employee: {_id, firstName, lastName, email}, reason}`.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/appraisalCycle.launch.test.js`. Stub the models in the idiom of `server/__tests__/adminReviewCrossTenantListing.test.js` (read it first). The test must assert two things:

```js
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const oid = () => new mongoose.Types.ObjectId();

// Assert on the documents handed to Appraisal.create, not on the DB.
test('a peer-review cycle launches into nominating, a plain one into collecting', async () => {
  for (const [peerReviewEnabled, expected] of [[true, 'nominating'], [false, 'collecting']]) {
    const docs = await captureLaunch({ peerReviewEnabled });
    assert.strictEqual(docs[0].state, expected);
    assert.deepStrictEqual(
      docs[0].reviewerIds.map(String).length, 2,
      'reviewerIds still starts as [employee, manager] — a peer joins only on approval'
    );
  }
});

test('skipped employees come back with names an HR user can act on', async () => {
  const { skipped } = await captureLaunchSkips();
  assert.strictEqual(skipped.length, 1);
  assert.strictEqual(skipped[0].reason, 'no_manager');
  assert.ok(skipped[0].employee.firstName, 'a bare ObjectId is unactionable in the HR UI');
});
```

Write `captureLaunch`/`captureLaunchSkips` as local helpers in the file that stub `User.find`, `Appraisal.find`, `Appraisal.create`, `AppraisalFeedback.insertMany`, `AppraisalCycle.findOne` and `mongoose.startSession`, then invoke `cycles.launchCycle(req, res, next)` with a fake `req` carrying `{ tenant: { _id }, user: { _id }, params: { id }, body: {} }` and a fake `res` capturing `res.json`. Restore every stub in a `finally`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && node --test __tests__/appraisalCycle.launch.test.js`
Expected: FAIL — state is `'collecting'` in both cases, and `skipped[0].employee` is a bare ObjectId.

- [ ] **Step 3: Set launch state from the cycle flag**

In `launchCycle`, replace the hardcoded `state: 'collecting'`:

```js
    // Peer review on → the employee nominates first. Off → Phase 1's path,
    // straight to collecting, kept live rather than left as dead code.
    const launchState = cycle.peerReviewEnabled === false ? 'collecting' : 'nominating';
```

and use `state: launchState` inside `Appraisal.create`.

- [ ] **Step 4: Resolve skipped employee names**

After `const plan = planCycleLaunch(...)`, add:

```js
    // planCycleLaunch returns bare ids; HR cannot chase an ObjectId. Resolve
    // them here rather than in the helper, which stays DB-free by design.
    const skippedIds = plan.skipped.map((s) => s.employee);
    const skippedUsers = skippedIds.length
      ? await User.find({ _id: { $in: skippedIds }, tenant: req.tenant._id })
          .select('firstName lastName email').lean()
      : [];
    const byId = new Map(skippedUsers.map((u) => [String(u._id), u]));
    const skipped = plan.skipped.map((s) => ({
      reason: s.reason,
      employee: byId.get(String(s.employee)) || { _id: s.employee },
    }));
```

and return `skipped` in place of `plan.skipped` in the response.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd server && node --test __tests__/appraisalCycle.launch.test.js`
Expected: PASS.

- [ ] **Step 6: Checkpoint — no commit**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -5`
Expected: 3 known failures only. Do not `git add` or `git commit`.

---

### Task 5: Nomination endpoints

**Files:**
- Modify: `server/controllers/appraisal.controller.js` (add three handlers)
- Modify: `server/routes/appraisal.routes.js:34-40`
- Test: `server/__tests__/appraisalNominate.test.js` (create)

**Interfaces:**
- Consumes: `nominationViewForSubject`, `validateNominations`, `effectiveNominationMin` (Task 3); `resolveAppraisalAccess().canNominate` (Task 2).
- Produces: `GET /api/appraisals/:id/nomination`, `GET /api/appraisals/:id/eligible-peers`, `POST /api/appraisals/:id/nominate`; and an exported `loadEligiblePeers(req, appraisal)` helper on `exports._internal`.

**Route order matters:** these must be declared **before** `appraisalRouter.get('/:id', ...)`? No — they are `/:id/...` sub-paths, which Express matches distinctly from `/:id`. Declare them alongside the other `/:id/...` routes.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/appraisalNominate.test.js`, stubbing models as in Task 4. Assert:

```js
test('the subject reading their nomination screen never receives the appraisal document', async () => {
  const body = await getNomination({ state: 'nominating', asSubject: true });
  assert.deepStrictEqual(
    Object.keys(body.data).sort(),
    ['deadline', 'max', 'min', 'myProposals', 'state']
  );
  assert.strictEqual(body.data.summary, undefined);
  assert.strictEqual(body.data.reviewerIds, undefined);
  assert.strictEqual(body.data.peerNominations, undefined);
});

test('past nominating the subject gets a count and cannot infer rejections', async () => {
  const body = await getNomination({
    state: 'collecting', asSubject: true,
    peerNominations: [{ user: oid(), status: 'approved' }, { user: oid(), status: 'rejected' }],
  });
  assert.deepStrictEqual(Object.keys(body.data).sort(), ['approvedCount', 'state']);
  assert.strictEqual(body.data.approvedCount, 1);
});

test('a stranger gets 403 on the nomination screen', async () => {
  const { status } = await getNomination({ state: 'nominating', asStranger: true });
  assert.strictEqual(status, 403);
});

test('nominating replaces every proposed entry rather than appending', async () => {
  const first = oid(), second = oid();
  const saved = await postNominate({ existingProposed: [first], body: { userIds: [second] } });
  assert.strictEqual(saved.peerNominations.length, 1);
  assert.strictEqual(String(saved.peerNominations[0].user), String(second));
});

test('an invalid nomination is rejected whole, not partially applied', async () => {
  const { status, saved } = await postNominate({ body: { userIds: ['not-eligible'] }, expectFail: true });
  assert.strictEqual(status, 400);
  assert.strictEqual(saved, null, 'nothing was written');
});

test('submitting a valid nomination advances to pending_peer_approval', async () => {
  // eligibleA/eligibleB are the two ids the stubbed User.find returns.
  const saved = await postNominate({ body: { userIds: [eligibleA, eligibleB] } });
  assert.strictEqual(saved.state, 'pending_peer_approval');
  assert.strictEqual(saved.peerNominations.length, 2);
  for (const n of saved.peerNominations) {
    assert.strictEqual(n.status, 'proposed');
    assert.ok(n.proposedBy, 'proposedBy records who actually chose — subject or HR on their behalf');
  }
});

test('eligible peers exclude the subject and the manager', async () => {
  const { filter } = await getEligiblePeers();
  assert.deepStrictEqual(Object.keys(filter).sort(), ['_id', 'role', 'status', 'tenant']);
  assert.ok(filter._id.$nin, 'subject and manager are excluded by $nin');
  assert.strictEqual(filter.status, 'active');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && node --test __tests__/appraisalNominate.test.js`
Expected: FAIL — the handlers do not exist.

- [ ] **Step 3: Implement the eligible-peer loader**

In `server/controllers/appraisal.controller.js`, add near the top (after the requires):

```js
const User = require('../models/User');
const AppraisalCycle = require('../models/AppraisalCycle');
const {
  // ...existing imports...
  nominationViewForSubject,
  validateNominations,
  effectiveNominationMin,
} = require('../services/appraisal.helpers');

// Tenant roles that can be nominated. Mirrors appraisalCycle.controller.js's
// TENANT_ROLES — read that constant and keep the two lists identical rather
// than inventing a second definition of "a person in this tenant".
const NOMINABLE_ROLES = require('./appraisalCycle.controller').TENANT_ROLES;
```

If `TENANT_ROLES` is not currently exported from `appraisalCycle.controller.js`, export it there rather than duplicating the array.

```js
/**
 * Everyone in the tenant who may review this appraisal: active tenant users
 * other than the subject (who writes the self-assessment) and the manager
 * (who writes the manager assessment — a second row would double-count them).
 */
async function loadEligiblePeers(req, appraisal) {
  return User.find({
    tenant: req.tenant._id,
    role: { $in: NOMINABLE_ROLES },
    status: 'active',
    _id: { $nin: [appraisal.employee, appraisal.manager] },
  })
    .select('firstName lastName email employeeProfile.work.jobTitle')
    .sort({ firstName: 1, lastName: 1 })
    .lean();
}
```

- [ ] **Step 4: Implement the three handlers**

```js
exports.getNomination = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id })
      .populate('peerNominations.user', 'firstName lastName email employeeProfile.work.jobTitle')
      .lean();
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = resolveAppraisalAccess(req.user, appraisal);
    // Anyone with a stake in nomination may read this screen. Note this is NOT
    // access.canRead — that stays false for the subject until release, and this
    // payload is an allow-list built by nominationViewForSubject, never the
    // appraisal document.
    if (!access.canNominate && !access.canApprovePeers && !access.canBackfillPeers) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    const cycle = await AppraisalCycle.findOne({ _id: appraisal.cycle, tenant: req.tenant._id }).lean();
    if (!cycle) {
      const err = new Error('The appraisal cycle for this appraisal could not be found.');
      err.status = 500; err.expose = true; throw err;
    }
    const eligible = await loadEligiblePeers(req, appraisal);
    res.json({ success: true, data: nominationViewForSubject(appraisal, cycle, eligible.length) });
  } catch (err) { next(err); }
};

exports.eligiblePeers = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id }).lean();
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = resolveAppraisalAccess(req.user, appraisal);
    if (!access.canNominate && !access.canApprovePeers && !access.canBackfillPeers) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }
    res.json({ success: true, data: await loadEligiblePeers(req, appraisal) });
  } catch (err) { next(err); }
};

exports.nominatePeers = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id });
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = resolveAppraisalAccess(req.user, appraisal);
    if (!access.canNominate) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    const cycle = await AppraisalCycle.findOne({ _id: appraisal.cycle, tenant: req.tenant._id }).lean();
    if (!cycle) {
      const err = new Error('The appraisal cycle for this appraisal could not be found.');
      err.status = 500; err.expose = true; throw err;
    }
    const eligible = await loadEligiblePeers(req, appraisal);

    const result = validateNominations(req.body.userIds, {
      subjectId: appraisal.employee,
      managerId: appraisal.manager,
      eligibleIds: eligible.map((u) => u._id),
      min: effectiveNominationMin(cycle.peerCountMin, eligible.length),
      max: cycle.peerCountMax,
    });
    // Rejected whole: a half-applied nomination list is worse than none.
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.errors.join(' ') });
    }

    // Replace every 'proposed' entry, not just the caller's own: at this state
    // nothing can yet be approved or rejected, so nothing decided is lost, and
    // HR nominating for a silent employee produces one coherent list.
    appraisal.peerNominations = result.userIds.map((user) => ({
      user,
      proposedBy: req.user._id,
      status: 'proposed',
    }));
    assertTransition(appraisal.state, 'pending_peer_approval');
    appraisal.state = 'pending_peer_approval';
    await appraisal.save();

    res.json({ success: true, data: { state: appraisal.state, nominated: result.userIds.length } });
  } catch (err) { next(err); }
};
```

Add `loadEligiblePeers` to the `exports._internal` object.

- [ ] **Step 5: Declare the routes**

In `server/routes/appraisal.routes.js`, after the `/:id` GET:

```js
appraisalRouter.get('/:id/nomination', appraisals.getNomination);
appraisalRouter.get('/:id/eligible-peers', appraisals.eligiblePeers);
appraisalRouter.post('/:id/nominate', appraisals.nominatePeers);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd server && node --test __tests__/appraisalNominate.test.js`
Expected: PASS.

- [ ] **Step 7: Checkpoint — no commit**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -5`
Expected: 3 known failures only. Do not `git add` or `git commit`.

---

### Task 6: Approve, skip and backfill

**Files:**
- Modify: `server/controllers/appraisal.controller.js`
- Modify: `server/routes/appraisal.routes.js`
- Test: `server/__tests__/appraisalApprovePeers.test.js` (create)

**Interfaces:**
- Consumes: `applyNominationDecisions`, `planPeerRowCreation` (Task 3); `canApprovePeers`/`canBackfillPeers` (Task 2).
- Produces: `POST /api/appraisals/:id/approve-peers`, `POST /api/appraisals/:id/skip-peers`, `POST /api/appraisals/:id/peers`.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/appraisalApprovePeers.test.js` asserting:

```js
test('approving creates one pending peer row per newly approved peer and advances to collecting', async () => {
  const { saved, insertedRows } = await approve({ approve: [peerA, peerB], reject: [peerC] });
  assert.strictEqual(saved.state, 'collecting');
  assert.strictEqual(insertedRows.length, 2);
  for (const row of insertedRows) {
    assert.strictEqual(row.kind, 'peer');
    assert.strictEqual(row.status, undefined, 'status defaults to pending in the schema');
    assert.ok(row.tenant && row.appraisal && row.cycle, 'every row is tenant- and cycle-scoped');
  }
  assert.strictEqual(saved.reviewerIds.length, 4, 'employee + manager + 2 approved peers');
});

test('a rejected nominee never enters reviewerIds', async () => {
  const { saved } = await approve({ approve: [peerA], reject: [peerC] });
  assert.ok(!saved.reviewerIds.map(String).includes(String(peerC)));
});

test('approving twice does not duplicate feedback rows', async () => {
  const { insertedRows } = await approveTwice({ approve: [peerA] });
  assert.strictEqual(insertedRows.length, 1, 'planPeerRowCreation skips anyone already in reviewerIds');
});

test('rejecting everyone is legal and lands in collecting with no peers', async () => {
  const { saved, insertedRows } = await approve({ approve: [], reject: [peerA, peerB] });
  assert.strictEqual(saved.state, 'collecting');
  assert.strictEqual(insertedRows.length, 0);
});

test('HR can skip peers from either nomination state', async () => {
  for (const from of ['nominating', 'pending_peer_approval']) {
    const saved = await skipPeers({ state: from });
    assert.strictEqual(saved.state, 'collecting', from);
  }
});

test('the subject cannot approve their own peers', async () => {
  const { status } = await approve({ asSubject: true });
  assert.strictEqual(status, 403);
});

test('re-adding a peer who declined creates no second row', async () => {
  // A declined peer is still in reviewerIds, so planPeerRowCreation skips them
  // and unique(appraisal, reviewer) is never challenged.
  const { insertedRows } = await backfill({ add: [peerWhoDeclined], alreadyReviewer: true });
  assert.strictEqual(insertedRows.length, 0);
});

test('backfill works at collecting and adds exactly one reviewer', async () => {
  const { saved, insertedRows } = await backfill({ add: [peerD] });
  assert.strictEqual(insertedRows.length, 1);
  assert.ok(saved.reviewerIds.map(String).includes(String(peerD)));
  assert.strictEqual(saved.state, 'collecting', 'backfill does not change state');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && node --test __tests__/appraisalApprovePeers.test.js`
Expected: FAIL — handlers do not exist.

- [ ] **Step 3: Implement a shared apply-and-create routine**

In `server/controllers/appraisal.controller.js`:

```js
/**
 * Apply nomination decisions and materialise feedback rows for anyone newly
 * approved. Shared by approve-peers and backfill because they are the same
 * operation reached from two states — duplicating it would let the two drift,
 * and the anonymity-relevant part (who joins reviewerIds) must have one home.
 */
async function applyPeerDecisions(req, appraisal, decisions) {
  appraisal.peerNominations = applyNominationDecisions(
    appraisal.peerNominations, decisions, req.user._id
  );
  const newPeers = planPeerRowCreation(appraisal.peerNominations, appraisal.reviewerIds);

  if (newPeers.length) {
    await AppraisalFeedback.insertMany(
      newPeers.map((reviewer) => ({
        tenant: req.tenant._id,
        appraisal: appraisal._id,
        cycle: appraisal.cycle,
        reviewer,
        kind: 'peer',
      }))
    );
    // A peer joins the array the access resolver trusts ONLY here, after
    // approval — never at nomination time.
    appraisal.reviewerIds.push(...newPeers);
  }
  return newPeers.length;
}
```

- [ ] **Step 4: Implement the three handlers**

```js
exports.approvePeers = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id });
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = resolveAppraisalAccess(req.user, appraisal);
    if (!access.canApprovePeers) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    // Names the approver adds themselves must still be eligible — the picker
    // is client-side and the server does not trust it.
    const added = (req.body.add || []).map(String);
    if (added.length) {
      const eligible = await loadEligiblePeers(req, appraisal);
      const ok = new Set(eligible.map((u) => String(u._id)));
      if (added.some((u) => !ok.has(u))) {
        return res.status(400).json({
          success: false,
          message: 'One or more of the people added are not eligible to review this appraisal.',
        });
      }
    }

    const createdCount = await applyPeerDecisions(req, appraisal, {
      approve: req.body.approve, reject: req.body.reject, add: req.body.add,
    });
    assertTransition(appraisal.state, 'collecting');
    appraisal.state = 'collecting';
    await appraisal.save();

    res.json({ success: true, data: { state: appraisal.state, peersAdded: createdCount } });
  } catch (err) { next(err); }
};

exports.backfillPeers = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id });
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = resolveAppraisalAccess(req.user, appraisal);
    if (!access.canBackfillPeers) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    const added = (req.body.add || []).map(String);
    if (!added.length) {
      return res.status(400).json({ success: false, message: 'Choose at least one replacement peer.' });
    }
    const eligible = await loadEligiblePeers(req, appraisal);
    const ok = new Set(eligible.map((u) => String(u._id)));
    if (added.some((u) => !ok.has(u))) {
      return res.status(400).json({
        success: false,
        message: 'One or more of the people added are not eligible to review this appraisal.',
      });
    }

    const createdCount = await applyPeerDecisions(req, appraisal, { add: added });
    await appraisal.save(); // state unchanged: backfill happens during collecting
    res.json({ success: true, data: { state: appraisal.state, peersAdded: createdCount } });
  } catch (err) { next(err); }
};

exports.skipPeers = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id });
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = resolveAppraisalAccess(req.user, appraisal);
    // Deliberately HR-only: skipping peers is the unblock-a-stall power, not a
    // way for a manager to opt out of the 360 they were asked to run.
    if (access.relation !== 'hr' || !(access.canNominate || access.canApprovePeers)) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    assertTransition(appraisal.state, 'collecting');
    appraisal.state = 'collecting';
    await appraisal.save();
    res.json({ success: true, data: { state: appraisal.state } });
  } catch (err) { next(err); }
};
```

Import `applyNominationDecisions` and `planPeerRowCreation` at the top of the file.

- [ ] **Step 5: Declare the routes**

```js
appraisalRouter.post('/:id/approve-peers', appraisals.approvePeers);
appraisalRouter.post('/:id/peers', appraisals.backfillPeers);
appraisalRouter.post('/:id/skip-peers', appraisals.skipPeers);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd server && node --test __tests__/appraisalApprovePeers.test.js`
Expected: PASS.

- [ ] **Step 7: Checkpoint — no commit**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -5`
Expected: 3 known failures only. Do not `git add` or `git commit`.

---

### Task 7: Peer decline

**Files:**
- Modify: `server/controllers/appraisalFeedback.controller.js`
- Modify: `server/routes/appraisal.routes.js:43-45`
- Test: `server/__tests__/appraisalDecline.test.js` (create)

**Interfaces:**
- Produces: `POST /api/appraisal-feedback/:id/decline`.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/appraisalDecline.test.js`:

```js
test('a peer can decline, and the row is distinguishable from an expired one', async () => {
  const saved = await decline({ kind: 'peer', status: 'pending', body: { reason: 'Barely worked with them' } });
  assert.strictEqual(saved.status, 'declined');
  assert.ok(saved.declinedAt instanceof Date);
  assert.strictEqual(saved.declineReason, 'Barely worked with them');
});

test('declining without a reason is allowed', async () => {
  const saved = await decline({ kind: 'peer', status: 'pending', body: {} });
  assert.strictEqual(saved.status, 'declined');
  assert.strictEqual(saved.declineReason, undefined);
});

test('self and manager assessments cannot be declined', async () => {
  for (const kind of ['self', 'manager']) {
    const { status } = await decline({ kind, status: 'pending', expectFail: true });
    assert.strictEqual(status, 400, kind);
  }
});

test('an already-submitted row cannot be declined', async () => {
  const { status } = await decline({ kind: 'peer', status: 'submitted', expectFail: true });
  assert.strictEqual(status, 400);
});

test('a row belonging to someone else is not found', async () => {
  const { status } = await decline({ notOwner: true, expectFail: true });
  assert.strictEqual(status, 404);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && node --test __tests__/appraisalDecline.test.js`
Expected: FAIL — `decline` handler does not exist.

- [ ] **Step 3: Implement the handler**

Append to `server/controllers/appraisalFeedback.controller.js`:

```js
exports.declineFeedback = async (req, res, next) => {
  try {
    // loadOwnFeedback is an ownership check, not a role check — a reviewer may
    // only ever touch their own row, HR included.
    const fb = await loadOwnFeedback(req);
    if (!fb) return res.status(404).json({ success: false, message: 'Feedback not found' });

    // Self and manager assessments are not optional. Only peer participation is.
    if (fb.kind !== 'peer') {
      return res.status(400).json({
        success: false,
        message: 'Only peer feedback can be declined.',
      });
    }
    if (fb.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message:
          fb.status === 'submitted'
            ? 'This feedback has already been submitted and can no longer be declined.'
            : `This feedback is ${fb.status} and can no longer be declined.`,
      });
    }

    fb.status = 'declined';
    fb.declinedAt = new Date();
    if (typeof req.body.reason === 'string' && req.body.reason.trim()) {
      fb.declineReason = req.body.reason.trim();
    }
    await fb.save();

    res.json({ success: true, data: { status: fb.status, declinedAt: fb.declinedAt } });
  } catch (err) { next(err); }
};
```

- [ ] **Step 4: Declare the route and check the review-request filter**

In `server/routes/appraisal.routes.js`:

```js
feedbackRouter.post('/:id/decline', feedback.declineFeedback);
```

Then check `appraisal.controller.js#myReviewRequests` (line 89): it filters `status: { $in: ['pending', 'submitted'] }`. A declined row correctly drops off the reviewer's own list — verify that is still the behaviour after this change and leave the filter alone.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd server && node --test __tests__/appraisalDecline.test.js`
Expected: PASS.

- [ ] **Step 6: Checkpoint — no commit**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -5`
Expected: 3 known failures only. Do not `git add` or `git commit`.

---

### Task 8: Release gate and disclosure of n

**Files:**
- Modify: `server/controllers/appraisal.controller.js:117-180` (`getAppraisal`) and `:209-232` (`releaseAppraisal`)
- Test: `server/__tests__/appraisalReleaseGate.test.js` (create)

**Interfaces:**
- Consumes: `peerReleaseGate`, `PEER_RELEASE_MIN` (Task 3).
- Produces: `releaseAppraisal` 400 with `{code: 'LOW_PEER_RESPONSE_COUNT', approvedPeerCount, submittedPeerCount, threshold}`; `getAppraisal` response gains `peerResponseCount` and `approvedPeerCount` at the top level of `data`.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/appraisalReleaseGate.test.js`:

```js
test('releasing on one peer response is refused with a machine-readable code', async () => {
  const { status, body } = await release({ approvedPeers: 3, submittedPeers: 1 });
  assert.strictEqual(status, 400);
  assert.strictEqual(body.code, 'LOW_PEER_RESPONSE_COUNT');
  assert.strictEqual(body.submittedPeerCount, 1);
  assert.strictEqual(body.threshold, 2);
});

test('confirming releases it', async () => {
  const { status, saved } = await release({ approvedPeers: 3, submittedPeers: 1, confirm: true });
  assert.strictEqual(status, 200);
  assert.strictEqual(saved.state, 'released');
});

test('a deliberate no-peer appraisal releases without a warning', async () => {
  const { status } = await release({ approvedPeers: 0, submittedPeers: 0 });
  assert.strictEqual(status, 200);
});

test('the released payload states how many peer responses it rests on', async () => {
  const body = await getAppraisalAs('subject', { approvedPeers: 3, submittedPeers: 2 });
  assert.strictEqual(body.data.peerResponseCount, 2);
  assert.strictEqual(body.data.approvedPeerCount, 3);
  // ...and still leaks nothing.
  assert.strictEqual(body.data.appraisal.reviewerIds, undefined);
  assert.strictEqual(body.data.appraisal.peerNominations, undefined);
  for (const fb of body.data.feedback) {
    if (fb.kind === 'peer') assert.strictEqual(fb.reviewer, undefined);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && node --test __tests__/appraisalReleaseGate.test.js`
Expected: FAIL — release returns 200 on one peer response; `peerResponseCount` is undefined.

- [ ] **Step 3: Gate the release**

In `releaseAppraisal`, after the existing summary check and before `assertTransition`:

```js
    // A summary built on one peer response looks identical to one built on
    // four. The manager confirms explicitly; the employee is told the count
    // separately in getAppraisal, because a warning the manager clicks through
    // protects nobody but the manager.
    const approvedPeerCount = (appraisal.peerNominations || [])
      .filter((n) => n.status === 'approved').length;
    const submittedPeerCount = await AppraisalFeedback.countDocuments({
      tenant: req.tenant._id,
      appraisal: appraisal._id,
      kind: 'peer',
      status: 'submitted',
    });
    const gate = peerReleaseGate({
      approvedPeerCount,
      submittedPeerCount,
      confirmed: req.body.confirmLowPeerCount === true,
    });
    if (gate.blocked) {
      return res.status(400).json({
        success: false,
        code: gate.code,
        approvedPeerCount: gate.approvedPeerCount,
        submittedPeerCount: gate.submittedPeerCount,
        threshold: gate.threshold,
        message: `This summary rests on ${submittedPeerCount} peer ${
          submittedPeerCount === 1 ? 'response' : 'responses'
        }. Confirm to release anyway.`,
      });
    }
```

Import `peerReleaseGate` at the top of the file.

- [ ] **Step 4: Disclose the count on read**

In `getAppraisal`, after `const feedback = rawFeedback.map(...)`:

```js
    // Told to every viewer including the subject: the employee is the one
    // person who otherwise cannot tell a 360 built on one response from one
    // built on four, and they are the one being judged by it.
    const approvedPeerCount = (appraisal.peerNominations || [])
      .filter((n) => n.status === 'approved').length;
    const peerResponseCount = feedback.filter((fb) => fb.kind === 'peer').length;
```

and add both to the response object:

```js
    res.json({
      success: true,
      data: { appraisal: safeAppraisal, feedback, sections, access, approvedPeerCount, peerResponseCount },
    });
```

Note `approvedPeerCount` is a derived integer, not an identity — it is safe for the subject in a way `peerNominations` is not.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd server && node --test __tests__/appraisalReleaseGate.test.js`
Expected: PASS.

- [ ] **Step 6: Checkpoint — no commit**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -5`
Expected: 3 known failures only. Do not `git add` or `git commit`.

---

### Task 9: HR stall surface

**Files:**
- Modify: `server/controllers/appraisalCycle.controller.js` (`cycleProgress`)
- Test: `server/__tests__/appraisalCycleProgress.test.js` (create)

**Interfaces:**
- Produces: `GET /api/appraisal-cycles/:id/progress` response gains `stalled: [{_id, state, since, employee: {_id, firstName, lastName}, manager: {_id, firstName, lastName}}]`.

- [ ] **Step 1: Write the failing test**

```js
test('stalled nominations come back with names, not ObjectIds', async () => {
  const body = await progress({
    nominationDeadline: new Date('2026-01-01'),
    appraisals: [
      { state: 'nominating', updatedAt: new Date('2025-12-01') },
      { state: 'pending_peer_approval', updatedAt: new Date('2025-12-01') },
      { state: 'collecting', updatedAt: new Date('2025-12-01') },
    ],
  });
  assert.strictEqual(body.data.stalled.length, 2, 'only the two nomination states stall');
  for (const row of body.data.stalled) {
    assert.ok(row.employee.firstName, 'HR cannot chase an ObjectId');
    assert.ok(row.manager.firstName);
    assert.ok(row.since);
  }
});

test('nothing is stalled before the nomination deadline', async () => {
  const body = await progress({
    nominationDeadline: new Date('2099-01-01'),
    appraisals: [{ state: 'nominating', updatedAt: new Date() }],
  });
  assert.deepStrictEqual(body.data.stalled, []);
});

test('a cycle with no nomination deadline reports nothing stalled', async () => {
  const body = await progress({ nominationDeadline: null, appraisals: [{ state: 'nominating' }] });
  assert.deepStrictEqual(body.data.stalled, []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && node --test __tests__/appraisalCycleProgress.test.js`
Expected: FAIL — `body.data.stalled` is undefined.

- [ ] **Step 3: Implement**

In `cycleProgress`, after the existing `byState`/`feedbackTotal`/`feedbackSubmitted` work:

```js
    // Nomination adds two new ways to stall: nobody nominated, or the manager
    // never approved. Surfaced with names because the whole point is that HR
    // can then act on behalf or skip peers. Nothing auto-advances — a silent
    // state change on a performance record is hard to explain to its subject.
    const stalled = cycle.nominationDeadline && cycle.nominationDeadline < new Date()
      ? (await Appraisal.find({
          tenant: req.tenant._id,
          cycle: cycle._id,
          state: { $in: ['nominating', 'pending_peer_approval'] },
        })
          .populate('employee', 'firstName lastName email')
          .populate('manager', 'firstName lastName email')
          .select('state updatedAt employee manager')
          .lean()
        ).map((a) => ({
          _id: a._id, state: a.state, since: a.updatedAt,
          employee: a.employee, manager: a.manager,
        }))
      : [];
```

and add `stalled` to the response `data`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd server && node --test __tests__/appraisalCycleProgress.test.js`
Expected: PASS.

- [ ] **Step 5: Checkpoint — no commit**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -5`
Expected: 3 known failures only. Do not `git add` or `git commit`.

---

### Task 10: Lifecycle leak harness

This is the main coverage gain of the phase. Until now every anonymity guarantee has rested on unit-tested pure helpers plus code reading; nothing exercised a controller end to end.

**Files:**
- Create: `server/__tests__/helpers/appraisalHarness.js`
- Create: `server/__tests__/appraisalLifecycleLeaks.test.js`

**Interfaces:**
- Produces: `makeHarness()` → `{req, res, stub, restore, db}` used by this task only. Do not refactor earlier tasks' tests onto it — they pass and rewriting them risks losing coverage for no gain.

- [ ] **Step 1: Write the harness**

`server/__tests__/helpers/appraisalHarness.js` — an in-memory stand-in for the four models, in the repo's stub idiom. It must support `findOne`, `find`, `create`, `insertMany`, `countDocuments`, and chained `.populate().lean()`/`.select().lean()`, backed by plain arrays. Export:

- `makeHarness({ users, cycle, template })` → `{ db, restore }` — installs the stubs and returns a restore function
- `asUser(user, { params, body })` → a fake `req` carrying `{ user, tenant: {_id}, params, body }`
- `capture()` → a fake `res` recording `{ status, body }`, defaulting status to 200

- [ ] **Step 2: Write the failing lifecycle test**

`server/__tests__/appraisalLifecycleLeaks.test.js` drives the **real** controllers through the whole loop and asserts at every subject-facing step:

```js
const SUBJECT_FORBIDDEN = ['reviewerIds', 'peerNominations'];

function assertNoIdentityLeak(payload, where) {
  const docs = [payload?.appraisal, payload].filter(Boolean);
  for (const doc of docs) {
    for (const key of SUBJECT_FORBIDDEN) {
      assert.strictEqual(doc[key], undefined, `${where}: ${key} leaked to the subject`);
    }
  }
  for (const fb of payload?.feedback || []) {
    if (fb.kind === 'peer') {
      assert.strictEqual(fb.reviewer, undefined, `${where}: a peer reviewer name leaked`);
    }
  }
}

// Each numbered comment below is one call in this shape — write them out in
// full; the comments are the checklist, not the deliverable:
//
//   const res = capture();
//   await appraisals.getNomination(asUser(subject, { params: { id } }), res, fail);
//   assert.strictEqual(res.status, 200);
//   assertNoIdentityLeak(res.body.data, 'subject GET /:id/nomination');
//
// where `fail` is `(err) => { throw err; }` so a handler calling next(err)
// surfaces as a test failure rather than a silent pass.

test('the full 360 loop never leaks a reviewer identity to the subject', async () => {
  // 1. launch (peerReviewEnabled) → nominating
  // 2. subject GET /:id/nomination        → assertNoIdentityLeak
  // 3. subject POST /:id/nominate [A,B,C] → pending_peer_approval
  // 4. subject GET /:id                   → assert 403, still not readable
  // 5. manager POST /:id/approve-peers {approve:[A,B], reject:[C]} → collecting
  // 6. subject GET /:id/nomination        → { state, approvedCount: 2 } exactly
  // 7. peer A submits; peer B declines
  // 8. manager POST /:id/peers {add:[D]}  → D gets a pending row
  // 9. peer D submits
  // 10. manager POST /:id/summary, then /:id/release
  // 11. subject GET /:id                  → 200, assertNoIdentityLeak
  // 12. subject GET /my                   → assertNoIdentityLeak on every row
  // 13. subject POST /:id/acknowledge     → assertNoIdentityLeak on the response
});

test('an unrelated staff member is refused at every state', async () => {
  for (const state of ['nominating', 'pending_peer_approval', 'collecting', 'summarising', 'released']) {
    // unrelated GET /:id            → 403
    // unrelated GET /:id/nomination → 403
    // unrelated POST /:id/nominate  → 403
  }
});

test('the manager and HR DO see peer reviewer names', () => {
  // The policy is named-to-manager-and-HR. Assert it positively so a future
  // change to full anonymity cannot land without also moving the disclosure
  // banner the peers were shown.
});
```

Replace each comment with the real call and assertion — the comments are the checklist, not the deliverable.

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd server && node --test __tests__/appraisalLifecycleLeaks.test.js`
Expected: FAIL initially while the harness is incomplete. Iterate until it passes **against unmodified controllers** — if a leak assertion fails, that is a real bug: stop and report it rather than weakening the assertion.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd server && node --test __tests__/appraisalLifecycleLeaks.test.js`
Expected: PASS.

- [ ] **Step 5: Checkpoint — no commit**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -5`
Expected: 3 known failures only. Do not `git add` or `git commit`.

---

### Task 11: Admin service layer

**Files:**
- Modify: `client/apps/admin/src/services/appraisal.service.ts`

**Interfaces:**
- Produces, exported from `appraisal.service.ts`:
  - `FeedbackStatus` widened to include `'declined'`
  - `AppraisalAccess` gains `canNominate`, `canApprovePeers`, `canBackfillPeers`
  - `PeerNominationStatus = 'proposed' | 'approved' | 'rejected'`
  - `NominationView = { state: AppraisalState; min?: number; max?: number; deadline?: string | null; myProposals?: { user: PersonRef }[]; approvedCount?: number }`
  - `getNomination(id)`, `getEligiblePeers(id)`, `nominatePeers(id, userIds)`, `approvePeers(id, {approve, reject, add})`, `backfillPeers(id, add)`, `skipPeers(id)`, `declineFeedback(feedbackId, reason?)`
  - `releaseAppraisal` gains an optional `confirmLowPeerCount` argument and its rejection surfaces `{code, submittedPeerCount, approvedPeerCount, threshold}`

- [ ] **Step 1: Read the existing file end to end**

Read `client/apps/admin/src/services/appraisal.service.ts` in full. Match its existing fetch wrapper, credential handling, and error shape exactly — do not introduce a second HTTP idiom.

- [ ] **Step 2: Add the types**

Widen `FeedbackStatus` to `'pending' | 'submitted' | 'expired' | 'declined'`. Add the three booleans to `AppraisalAccess`. Add `PeerNominationStatus` and `NominationView` as specified above. Add `approvedPeerCount: number` and `peerResponseCount: number` to whatever interface types the `GET /api/appraisals/:id` response.

- [ ] **Step 3: Add the seven calls**

Follow the file's existing pattern for each. The release change needs the error body preserved rather than flattened to a message string, because the UI must distinguish `LOW_PEER_RESPONSE_COUNT` from any other 400.

- [ ] **Step 4: Typecheck**

Run: `cd client/apps/admin && node_modules/.bin/tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: **≤ 461** (the baseline). If higher, the new code added errors — fix them before continuing. Remember `npx tsc` reports 0 and is lying.

- [ ] **Step 5: Checkpoint — no commit**

Do not `git add` or `git commit`.

---

### Task 12: Subject nomination screen

**Files:**
- Create: `client/apps/admin/src/app/(hydrogen)/appraisals/[id]/nominate/page.tsx`
- Create: `client/apps/admin/src/app/shared/appraisals/appraisal-nominate-form.tsx`
- Modify: `client/apps/admin/src/app/shared/appraisals/my-appraisals.tsx`

**Interfaces:**
- Consumes: `getNomination`, `getEligiblePeers`, `nominatePeers`, `NominationView` (Task 11).

- [ ] **Step 1: Read the sibling components first**

Read `client/apps/admin/src/app/shared/appraisals/reviewer-form.tsx` and `.../my-appraisals.tsx` in full before writing anything. Match their imports, rizzui component choices, loading/error states, and toast usage. Do not introduce a new form library or styling approach.

- [ ] **Step 2: Build the nomination form**

`appraisal-nominate-form.tsx` takes `{ appraisalId: string }` and:
- loads `getNomination(appraisalId)` and `getEligiblePeers(appraisalId)` on mount
- if `view.state !== 'nominating'`, renders a read-only "Your nominations have been submitted" panel using `approvedCount` and nothing else — **it must not render any per-name status**, because that would reveal which nominations the manager rejected
- otherwise renders a searchable multi-select over eligible peers, pre-selected from `view.myProposals`, showing `min`/`max` and the deadline
- disables submit outside `min..max` and shows the server's error message verbatim on a 400 — the server's messages are written for end users

- [ ] **Step 3: Build the route**

`[id]/nominate/page.tsx` renders `<AppraisalNominateForm appraisalId={params.id} />` inside the page shell used by the sibling routes. **It must not call `getAppraisal`** — the subject is 403 on that endpoint at this state by design, and calling it would render an error page.

- [ ] **Step 4: Link from the landing card**

In `my-appraisals.tsx`, when a row's `state === 'nominating'`, the action links to `/appraisals/${row._id}/nominate` — never to `/appraisals/${row._id}`, which the subject cannot open at that state.

- [ ] **Step 5: Verify**

Run: `cd client/apps/admin && node_modules/.bin/tsc --noEmit 2>&1 | grep -c "error TS"` → ≤ 461
Run: `cd client/apps/admin && npx vitest run 2>&1 | tail -5` → 99 passing

- [ ] **Step 6: Checkpoint — no commit**

---

### Task 13: Manager peer approval, backfill and release confirmation

**Files:**
- Create: `client/apps/admin/src/app/shared/appraisals/appraisal-peer-approval.tsx`
- Modify: `client/apps/admin/src/app/shared/appraisals/appraisal-manager-view.tsx`
- Modify: `client/apps/admin/src/app/shared/appraisals/appraisal-detail.tsx`

**Interfaces:**
- Consumes: `approvePeers`, `backfillPeers`, `getEligiblePeers`, `releaseAppraisal` with `confirmLowPeerCount` (Task 11).

- [ ] **Step 1: Read `appraisal-manager-view.tsx` and `appraisal-detail.tsx` in full**

`appraisal-detail.tsx` selects a view component by `access.relation`. The approval panel is reached the same way — do not branch inside a shared component.

- [ ] **Step 2: Build the approval panel**

`appraisal-peer-approval.tsx` takes `{ appraisalId, nominations, onDone }` and renders, for `state === 'pending_peer_approval'`, each proposed nominee with an approve/reject toggle plus an "add someone else" picker over `getEligiblePeers`. Submit calls `approvePeers(id, {approve, reject, add})` and refreshes on success. Approving nobody is legal — do not disable submit on an empty approve list.

- [ ] **Step 3: Add backfill to the manager view**

When `access.canBackfillPeers` and any peer feedback row has `status === 'declined'`, show those rows (the manager may see peer names — that is the policy) with an "add a replacement" control calling `backfillPeers`.

- [ ] **Step 4: Add the release confirmation**

When `releaseAppraisal` rejects with `code === 'LOW_PEER_RESPONSE_COUNT'`, open a confirmation dialog quoting `submittedPeerCount` and `approvedPeerCount`, and on confirm re-call with `confirmLowPeerCount: true`. Any other 400 shows its message as a plain error — do not treat every 400 as the gate.

- [ ] **Step 5: Verify**

Run: `cd client/apps/admin && node_modules/.bin/tsc --noEmit 2>&1 | grep -c "error TS"` → ≤ 461
Run: `cd client/apps/admin && npx vitest run 2>&1 | tail -5` → 99 passing

- [ ] **Step 6: Checkpoint — no commit**

---

### Task 14: Reviewer decline control and the subject's disclosure line

**Files:**
- Modify: `client/apps/admin/src/app/shared/appraisals/reviewer-form.tsx`
- Modify: `client/apps/admin/src/app/shared/appraisals/appraisal-subject-view.tsx`

- [ ] **Step 1: Add decline to the reviewer form**

Render a "Decline this request" control **only when `kind === 'peer'` and `status === 'pending'`**, opening a small dialog with an optional reason, calling `declineFeedback`. Self and manager assessments get no such control.

**Do not touch the disclosure banner.** It already tells peers that their manager and HR see their name and the person being reviewed does not. That statement is still true after Phase 2, and changing its wording without changing the policy would misinform reviewers.

- [ ] **Step 2: Add the disclosure line to the subject view**

In `appraisal-subject-view.tsx`, render one line from the values the API now returns:

> This summary draws on {peerResponseCount} peer {peerResponseCount === 1 ? 'response' : 'responses'}.

Show it only when `approvedPeerCount > 0`. Add **nothing else** to this component.

- [ ] **Step 3: Prove the subject's render path still cannot leak a name**

Run: `cd client/apps/admin && grep -n reviewer src/app/shared/appraisals/appraisal-subject-view.tsx`
Expected: **matches inside comments only**. Any executable reference to `feedback.reviewer` — even a defensive one — fails this step. The structural absence, not a conditional, is what makes the guarantee hold.

- [ ] **Step 4: Verify**

Run: `cd client/apps/admin && node_modules/.bin/tsc --noEmit 2>&1 | grep -c "error TS"` → ≤ 461
Run: `cd client/apps/admin && npx vitest run 2>&1 | tail -5` → 99 passing

- [ ] **Step 5: Checkpoint — no commit**

---

### Task 15: HR cycle page — peer toggle and stalled list

**Files:**
- Modify: `client/apps/admin/src/app/shared/appraisals/cycle-detail.tsx`
- Modify: `client/apps/admin/src/app/shared/appraisals/cycles-list.tsx`

- [ ] **Step 1: Add the create-time toggle**

The cycle create form gains a `peerReviewEnabled` switch, default on, with helper text: "Employees nominate peers for review. Turn off to run a self and manager assessment only."

- [ ] **Step 2: Render the stalled list**

On the cycle detail page, render `progress.stalled` as a table of employee name, manager name, state and `since`. Each row offers, for HR: "Nominate on their behalf" (links to `/appraisals/${row._id}/nominate`), "Approve peers" (links to the detail page), and "Skip peers" calling `skipPeers`.

- [ ] **Step 3: Fix the skipped-employee display**

`launchCycle`'s `skipped[]` now returns `{employee: {firstName, lastName, email}, reason}` rather than a bare id. Update wherever the launch result is rendered to show the name. If the current code renders `skipped[i].employee` directly it will now render `[object Object]` — find it and fix it.

- [ ] **Step 4: Verify**

Run: `cd client/apps/admin && node_modules/.bin/tsc --noEmit 2>&1 | grep -c "error TS"` → ≤ 461
Run: `cd client/apps/admin && npx vitest run 2>&1 | tail -5` → 99 passing

- [ ] **Step 5: Checkpoint — no commit**

---

### Task 16: Whole-phase security audit and end-to-end verification

**Files:**
- Modify: `.superpowers/sdd/progress.md` (append Phase 2 results)
- Possibly modify: `server/scripts/seed-appraisal-test-users.js`

- [ ] **Step 1: Audit every appraisal-returning endpoint**

Run: `cd server && grep -n "res.json" controllers/appraisal.controller.js controllers/appraisalCycle.controller.js`

For each hit, confirm the payload either goes through `projectAppraisalForViewer`/`sanitizeOwnAppraisalRow`, or is a purpose-built allow-list that provably contains no `reviewerIds`/`peerNominations`/peer `reviewer`. List every endpoint and its verdict in the ledger. A new endpoint that is neither is a bug.

- [ ] **Step 2: Confirm the strip list and the toObject behaviour**

Run: `cd server && grep -n "REVIEWER_IDENTITY_FIELDS\|toObject" controllers/appraisal.controller.js services/appraisal.helpers.js`

Confirm `REVIEWER_IDENTITY_FIELDS === ['reviewerIds', 'peerNominations']` — the stale `nominatedPeers`/`approvedPeers` names must be gone, not merely joined by the new one — and that `omit` and `projectFeedbackForViewer` still call `.toObject()` before spreading. Spreading a hydrated Mongoose doc yields `{$__, _doc}`, not schema paths, so a projection that skips it silently no-ops.

- [ ] **Step 3: Re-run every suite**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -5`
Expected: 3 known pre-existing failures, nothing new.

Run: `cd client/apps/admin && node_modules/.bin/tsc --noEmit 2>&1 | grep -c "error TS"` → ≤ 461
Run: `cd client/apps/admin && npx vitest run 2>&1 | tail -5` → 99 passing

- [ ] **Step 4: Extend the seed script**

The four Task 11 accounts (`*@wyncity.test`, password `Appraisal#Test2026`) give one employee and one unrelated staff member — not enough to approve three peers. Extend `seed-appraisal-test-users.js` with three more `tenant_staff` peer accounts, keeping it idempotent. `User` has **no `pre('save')` hook** — hash `passwordHash` with bcryptjs yourself. Write nested fields via dotted paths (`employeeProfile.work.manager`); a nested object replaces the whole subdocument.

- [ ] **Step 5: Drive the loop over HTTP**

Start the backend on :5001. **`lsof -ti:5001` first** — a stale process makes a fresh `npm run dev` print "✅ running" while `listen()` silently hit EADDRINUSE.

With curl, scoping the launch with `employeeIds` so no real Wyn City staff receive an appraisal:

1. HR creates a `peerReviewEnabled` cycle and launches → appraisals in `nominating`, `skipped[]` carries names
2. Employee `GET /:id/nomination` → the five-key payload; `GET /:id` → **403**
3. Employee nominates 3 → `pending_peer_approval`
4. Manager approves 2, rejects 1, adds 1 → `collecting`; three peer rows exist
5. Employee `GET /:id/nomination` → `{state, approvedCount: 3}` **and nothing else**
6. One peer submits, one declines → manager backfills the decliner
7. Manager summarises, then releases with one peer response → **400 `LOW_PEER_RESPONSE_COUNT`**; re-release with `confirmLowPeerCount: true` → 200
8. Employee reads → 200 with `peerResponseCount`, **no `reviewerIds`, no `peerNominations`, no peer `reviewer`**; acknowledges

**The three checks that matter. If any returns data, stop and report it as Critical rather than patching around it:**
- Employee `GET /api/appraisals/<id>` at `nominating`, `pending_peer_approval` and `collecting` → **403** at all three
- Unrelated `tenant_staff` on `GET /:id`, `GET /:id/nomination`, `POST /:id/nominate` → **403**
- Employee's released read and `/my` rows → **no peer reviewer name anywhere**

- [ ] **Step 6: Record the results**

Append a Phase 2 section to `.superpowers/sdd/progress.md` in the style of the Phase 1 entries: what was built, every bug found and whether it was fixed, the actual HTTP responses for the three checks, final baselines, and any Minor findings left open for Phase 3 to triage. Report a partial run as partial — never describe it as a pass.

- [ ] **Step 7: Checkpoint — no commit**

All Phase 2 work stays uncommitted alongside Phase 1. Do not `git add` or `git commit`.
