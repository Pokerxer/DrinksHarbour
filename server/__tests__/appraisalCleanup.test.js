// server/__tests__/appraisalCleanup.test.js
//
// Phase 2 cleanup: the findings the per-task reviews raised but did not block
// on. Grouped in one file because they share nothing but their origin — each
// test names the finding it closes.
//
// Idiom follows appraisalLifecycleLeaks.test.js: drive the REAL exported
// controllers against the in-memory harness in __tests__/helpers/
// appraisalHarness.js, so the controller-level tests here exercise the same
// composition the lifecycle test does rather than isolated mocks.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const appraisals = require('../controllers/appraisal.controller');
const cyclesCtrl = require('../controllers/appraisalCycle.controller');
const {
  resolveAppraisalAccess,
  projectFeedbackForViewer,
  validateNominations,
  applyNominationDecisions,
  planPeerRowCreation,
  countApprovedPeers,
  buildDefaultTemplate,
} = require('../services/appraisal.helpers');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const oid = () => new mongoose.Types.ObjectId();
const fail = (err) => { throw err; };

// ---------------------------------------------------------------------------
// Finding 1 — a manager could never backfill someone they had rejected.
// ---------------------------------------------------------------------------

test('re-adding a REJECTED nominee reinstates them instead of silently doing nothing', () => {
  const decider = 'u-mgr';
  const earlier = new Date('2026-01-01T00:00:00Z');
  const nominations = [
    { user: 'u-a', proposedBy: 'u-emp', status: 'approved', decidedBy: decider, decidedAt: earlier },
    { user: 'u-b', proposedBy: 'u-emp', status: 'rejected', decidedBy: decider, decidedAt: earlier },
  ];

  const out = applyNominationDecisions(nominations, { add: ['u-b'] }, decider);

  assert.strictEqual(out.length, 2, 'reinstating must not append a second row for the same person');
  const b = out.find((n) => n.user === 'u-b');
  assert.strictEqual(b.status, 'approved', 'the rejected nominee is now approved — the request is no longer a no-op');
  assert.notStrictEqual(
    b.decidedAt.getTime(), earlier.getTime(),
    'the second decision is stamped with its own time, not the rejection it overturned'
  );
  assert.strictEqual(b.decidedBy, decider);
  assert.strictEqual(b.proposedBy, 'u-emp', 'reinstating preserves who originally proposed them');
});

test('re-adding an ALREADY-APPROVED nominee leaves their original decision stamps alone', () => {
  const earlier = new Date('2026-01-01T00:00:00Z');
  const nominations = [
    { user: 'u-a', proposedBy: 'u-emp', status: 'approved', decidedBy: 'u-hr', decidedAt: earlier },
  ];

  const out = applyNominationDecisions(nominations, { add: ['u-a'] }, 'u-mgr');

  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].status, 'approved');
  assert.strictEqual(
    out[0].decidedAt.getTime(), earlier.getTime(),
    'nothing was decided, so restamping would falsify when the approval actually happened'
  );
  assert.strictEqual(out[0].decidedBy, 'u-hr');
});

test('add wins over a simultaneous reject of the same person', () => {
  const out = applyNominationDecisions(
    [{ user: 'u-a', proposedBy: 'u-emp', status: 'proposed' }],
    { reject: ['u-a'], add: ['u-a'] },
    'u-mgr'
  );
  assert.strictEqual(
    out[0].status, 'approved',
    'rejecting someone the caller explicitly asked to add is the surprising outcome'
  );
});

test('reinstating a rejected peer produces the feedback row that was previously never created', () => {
  const reinstated = applyNominationDecisions(
    [{ user: 'u-b', proposedBy: 'u-emp', status: 'rejected', decidedBy: 'u-mgr', decidedAt: new Date() }],
    { add: ['u-b'] },
    'u-mgr'
  );
  assert.deepStrictEqual(
    planPeerRowCreation(reinstated, []), ['u-b'],
    'the whole point of the fix: an approved peer with no existing row gets one'
  );
});

test('backfilling a rejected peer over HTTP creates their reviewer row', async () => {
  const tenantId = oid();
  const subjectId = oid();
  const managerId = oid();
  const peerA = oid();
  const peerRejected = oid();
  const hrId = oid();

  const { db, restore } = makeHarness({
    users: [
      { _id: subjectId, tenant: tenantId, role: 'tenant_staff', employeeProfile: { work: { manager: managerId } } },
      { _id: managerId, tenant: tenantId, role: 'tenant_staff' },
      { _id: peerA, tenant: tenantId, role: 'tenant_staff' },
      { _id: peerRejected, tenant: tenantId, role: 'tenant_staff' },
      { _id: hrId, tenant: tenantId, role: 'tenant_admin' },
    ],
    template: buildDefaultTemplate(tenantId, hrId),
    cycle: { tenant: tenantId, name: 'Cleanup', peerReviewEnabled: true, peerCountMin: 1, peerCountMax: 5, createdBy: hrId },
  });
  const subjectUser = { _id: subjectId, tenant: tenantId, role: 'tenant_staff' };
  const managerUser = { _id: managerId, tenant: tenantId, role: 'tenant_staff' };
  const hrUser = { _id: hrId, tenant: tenantId, role: 'tenant_admin' };

  try {
    let res = capture();
    await cyclesCtrl.launchCycle(
      asUser(hrUser, { params: { id: String(db.cycles[0]._id) }, body: { employeeIds: [String(subjectId)] } }),
      res, fail
    );
    const appraisalId = db.appraisals[0]._id;

    res = capture();
    await appraisals.nominatePeers(
      asUser(subjectUser, {
        params: { id: String(appraisalId) },
        body: { userIds: [String(peerA), String(peerRejected)] },
      }), res, fail
    );
    assert.strictEqual(res.status, 200);

    // The manager rejects one of the two, then changes their mind.
    res = capture();
    await appraisals.approvePeers(
      asUser(managerUser, {
        params: { id: String(appraisalId) },
        body: { approve: [String(peerA)], reject: [String(peerRejected)] },
      }), res, fail
    );
    assert.strictEqual(res.body.data.peersAdded, 1);

    res = capture();
    await appraisals.backfillPeers(
      asUser(managerUser, { params: { id: String(appraisalId) }, body: { add: [String(peerRejected)] } }),
      res, fail
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(
      res.body.data.peersAdded, 1,
      'this answered 200 {"peersAdded": 0} before the fix — a silent workflow dead end'
    );

    const row = db.feedback.find(
      (f) => String(f.reviewer) === String(peerRejected) && f.kind === 'peer'
    );
    assert.ok(row, 'the reinstated peer now has a feedback row to answer');
    assert.ok(
      db.appraisals[0].reviewerIds.map(String).includes(String(peerRejected)),
      'and joins reviewerIds, so resolveAppraisalAccess grants them the reviewer relation'
    );
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// Finding 2 — destructuring defaults fire on undefined, never on null.
// ---------------------------------------------------------------------------

test('validateNominations tolerates a null eligibleIds instead of throwing', () => {
  const result = validateNominations(['u-a'], { eligibleIds: null });
  assert.strictEqual(result.valid, false, 'nobody is eligible, so the nomination is refused');
  assert.ok(result.errors.some((e) => e.includes('not eligible')), 'and refused for the right reason, not a TypeError');
});

test('a null max does not reject an otherwise valid nomination list', () => {
  const result = validateNominations(['u-a'], { eligibleIds: ['u-a'], min: null, max: null });
  assert.deepStrictEqual(result.errors, [], 'null max used to coerce to 0 and reject every non-empty list');
  assert.strictEqual(result.valid, true);
});

test('validateNominations survives a null opts entirely', () => {
  assert.doesNotThrow(() => validateNominations(['u-a'], null));
});

test('planPeerRowCreation tolerates a null existingReviewerIds', () => {
  const noms = [{ user: 'u-a', status: 'approved' }];
  assert.deepStrictEqual(planPeerRowCreation(noms, null), ['u-a']);
});

// ---------------------------------------------------------------------------
// Finding 3 — the triplicated approved-peer count.
// ---------------------------------------------------------------------------

test('countApprovedPeers counts only approved nominations, and handles a missing array', () => {
  assert.strictEqual(countApprovedPeers({ peerNominations: [
    { user: 'a', status: 'approved' },
    { user: 'b', status: 'rejected' },
    { user: 'c', status: 'proposed' },
    { user: 'd', status: 'approved' },
  ] }), 2);
  assert.strictEqual(countApprovedPeers({}), 0);
  assert.strictEqual(countApprovedPeers(null), 0);
});

// ---------------------------------------------------------------------------
// Finding 4 — cycleProgress answered 200 for an id that does not exist.
// ---------------------------------------------------------------------------

test('cycleProgress 404s for an unknown cycle instead of reporting an empty one', async () => {
  const tenantId = oid();
  const hrId = oid();
  const { restore } = makeHarness({
    users: [{ _id: hrId, tenant: tenantId, role: 'tenant_admin' }],
  });
  try {
    const res = capture();
    await cyclesCtrl.cycleProgress(
      asUser({ _id: hrId, tenant: tenantId, role: 'tenant_admin' }, { params: { id: String(oid()) } }),
      res, fail
    );
    assert.strictEqual(res.status, 404, 'a bad link must be distinguishable from a cycle with no data yet');
  } finally {
    restore();
  }
});

test('cycleProgress 404s for a cycle belonging to another tenant', async () => {
  const tenantId = oid();
  const otherTenant = oid();
  const hrId = oid();
  const { db, restore } = makeHarness({
    users: [{ _id: hrId, tenant: tenantId, role: 'tenant_admin' }],
    cycle: { tenant: otherTenant, name: 'Not yours', createdBy: oid() },
  });
  try {
    const res = capture();
    await cyclesCtrl.cycleProgress(
      asUser({ _id: hrId, tenant: tenantId, role: 'tenant_admin' }, { params: { id: String(db.cycles[0]._id) } }),
      res, fail
    );
    assert.strictEqual(res.status, 404);
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// Finding 5 — harness blind spots.
// ---------------------------------------------------------------------------

test('projectFeedbackForViewer strips a peer reviewer from a HYDRATED document, not just a lean one', () => {
  // The .toObject() branch had no coverage: the only caller feeds it .lean()
  // results. Spreading a hydrated document yields {$__, _doc} with the real
  // fields untouched inside _doc, so a projection that skipped .toObject()
  // would silently strip nothing at all — a bug this module has had twice.
  const stored = { kind: 'peer', status: 'submitted', reviewer: 'u-peer', answers: [{ questionId: 'q1', rating: 4 }] };
  const hydrated = {};
  Object.defineProperty(hydrated, '$__', { value: {}, enumerable: true });
  Object.defineProperty(hydrated, '_doc', { value: stored, enumerable: true });
  Object.defineProperty(hydrated, 'toObject', { value: () => ({ ...stored }), enumerable: false });
  for (const k of Object.keys(stored)) {
    Object.defineProperty(hydrated, k, { enumerable: false, get: () => stored[k] });
  }

  const out = projectFeedbackForViewer(hydrated, { canSeeReviewerNames: false });

  assert.strictEqual(out.reviewer, undefined, 'the peer reviewer is gone');
  assert.strictEqual(out._doc, undefined, 'and the projection returned schema paths, not Mongoose internals');
  assert.strictEqual(out.kind, 'peer', 'the rest of the row survived');
  assert.deepStrictEqual(out.answers, [{ questionId: 'q1', rating: 4 }]);
});

test('a retried transaction still creates exactly one feedback row per approved peer', async () => {
  // P2 Task 6's atomicity invariant, and the one place this module has
  // already shipped a silent data-loss bug. withTransaction re-runs its WHOLE
  // callback on a transient error; a handler that mutated a document loaded
  // OUTSIDE the callback would see its own first-attempt mutations, conclude
  // there was nothing left to do, and commit an appraisal listing peers with
  // no feedback row to answer. transientFailures:1 aborts and replays the
  // first attempt, so the outcome below is the SECOND attempt's.
  const tenantId = oid();
  const subjectId = oid();
  const managerId = oid();
  const peerA = oid();
  const peerB = oid();
  const hrId = oid();

  const { db, restore, failNextTransaction } = makeHarness({
    users: [
      { _id: subjectId, tenant: tenantId, role: 'tenant_staff', employeeProfile: { work: { manager: managerId } } },
      { _id: managerId, tenant: tenantId, role: 'tenant_staff' },
      { _id: peerA, tenant: tenantId, role: 'tenant_staff' },
      { _id: peerB, tenant: tenantId, role: 'tenant_staff' },
      { _id: hrId, tenant: tenantId, role: 'tenant_admin' },
    ],
    template: buildDefaultTemplate(tenantId, hrId),
    cycle: { tenant: tenantId, name: 'Retry', peerReviewEnabled: true, peerCountMin: 1, peerCountMax: 5, createdBy: hrId },
    // Consumed by launchCycle's per-employee transaction, which is the first
    // one this scenario opens — so the launch below is itself a replay.
    transientFailures: 1,
  });
  const hrUser = { _id: hrId, tenant: tenantId, role: 'tenant_admin' };

  try {
    let res = capture();
    await cyclesCtrl.launchCycle(
      asUser(hrUser, { params: { id: String(db.cycles[0]._id) }, body: { employeeIds: [String(subjectId)] } }),
      res, fail
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(
      res.body.data.created, 1,
      'created is counted per COMMIT, not per attempt — pushing inside the callback double-counted'
    );
    assert.strictEqual(db.appraisals.length, 1, 'the aborted attempt was rolled back, so no duplicate appraisal');
    assert.strictEqual(
      db.feedback.filter((f) => f.kind === 'self' || f.kind === 'manager').length, 2,
      'exactly one self and one manager row survived the replay'
    );

    const appraisalId = db.appraisals[0]._id;
    res = capture();
    await appraisals.nominatePeers(
      asUser({ _id: subjectId, tenant: tenantId, role: 'tenant_staff' }, {
        params: { id: String(appraisalId) },
        body: { userIds: [String(peerA), String(peerB)] },
      }), res, fail
    );
    assert.strictEqual(res.status, 200);

    // The launch above already spent the seeded failure, so arm another one
    // explicitly — this is the transaction the P2 Task 6 bug actually lived in.
    failNextTransaction();
    res = capture();
    await appraisals.approvePeers(
      asUser({ _id: managerId, tenant: tenantId, role: 'tenant_staff' }, {
        params: { id: String(appraisalId) },
        body: { approve: [String(peerA), String(peerB)] },
      }), res, fail
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.peersAdded, 2, 'the committed attempt reports what it actually created');

    for (const peer of [peerA, peerB]) {
      const rows = db.feedback.filter(
        (f) => String(f.reviewer) === String(peer) && f.kind === 'peer'
      );
      assert.strictEqual(
        rows.length, 1,
        `exactly one peer row for ${peer} — zero is the data-loss bug, two collides on unique(appraisal, reviewer)`
      );
    }
    assert.strictEqual(
      db.appraisals[0].reviewerIds.filter((r) => String(r) === String(peerA)).length, 1,
      'and reviewerIds was not double-appended by the replay'
    );
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// Finding 6 — idOf's object branch, and canSummarise at 'collecting'.
// ---------------------------------------------------------------------------

test('resolveAppraisalAccess grants the Phase 2 capabilities against POPULATED ref objects', () => {
  // Every other test in the suite uses plain string ids, so idOf's
  // `v && v._id` branch was never exercised for canNominate/canApprovePeers/
  // canBackfillPeers — the three capabilities Phase 2 added. A populated
  // appraisal (employee/manager resolved to documents) is what getNomination
  // and getAppraisal actually hand this function in production.
  const tenantId = oid();
  const subjectId = oid();
  const managerId = oid();
  const populated = (state) => ({
    tenant: { _id: tenantId },
    employee: { _id: subjectId, firstName: 'Sam' },
    manager: { _id: managerId, firstName: 'Mia' },
    state,
  });

  const subject = { _id: subjectId, tenant: tenantId, role: 'tenant_staff' };
  const manager = { _id: managerId, tenant: tenantId, role: 'tenant_staff' };

  const asSubject = resolveAppraisalAccess(subject, populated('nominating'));
  assert.strictEqual(asSubject.relation, 'subject', 'a populated employee still resolves to the subject');
  assert.strictEqual(asSubject.canNominate, true);
  assert.strictEqual(asSubject.canApprovePeers, false);
  assert.strictEqual(asSubject.canBackfillPeers, false);

  const asManager = resolveAppraisalAccess(manager, populated('pending_peer_approval'));
  assert.strictEqual(asManager.relation, 'manager', 'a populated manager still resolves to the manager');
  assert.strictEqual(asManager.canApprovePeers, true);

  const backfilling = resolveAppraisalAccess(manager, populated('collecting'));
  assert.strictEqual(backfilling.canBackfillPeers, true);
  assert.strictEqual(backfilling.canApprovePeers, false, 'backfill and approve are different states');
});

test('the manager and HR can summarise from collecting, not only from summarising', () => {
  // saveSummary transitions collecting → summarising itself, so canSummarise
  // must already be true at 'collecting' or that path is unreachable. No test
  // asserted the true case directly; it was only ever exercised indirectly
  // after a fixture had already moved to 'summarising'.
  const tenantId = oid();
  const managerId = oid();
  const appraisal = { tenant: tenantId, employee: oid(), manager: managerId, state: 'collecting' };

  assert.strictEqual(
    resolveAppraisalAccess({ _id: managerId, tenant: tenantId, role: 'tenant_staff' }, appraisal).canSummarise,
    true
  );
  assert.strictEqual(
    resolveAppraisalAccess({ _id: oid(), tenant: tenantId, role: 'tenant_admin' }, appraisal).canSummarise,
    true
  );
  assert.strictEqual(
    resolveAppraisalAccess({ _id: appraisal.employee, tenant: tenantId, role: 'tenant_staff' }, appraisal).canSummarise,
    false,
    'the subject never summarises their own appraisal'
  );
});

// ---------------------------------------------------------------------------
// Finding 6 (last) — nomination was one-shot.
// ---------------------------------------------------------------------------

test('a nomination can be saved as a draft, re-saved, and only then submitted', async () => {
  const tenantId = oid();
  const subjectId = oid();
  const managerId = oid();
  const peerA = oid();
  const peerB = oid();
  const peerC = oid();
  const hrId = oid();

  const { db, restore } = makeHarness({
    users: [
      { _id: subjectId, tenant: tenantId, role: 'tenant_staff', employeeProfile: { work: { manager: managerId } } },
      { _id: managerId, tenant: tenantId, role: 'tenant_staff' },
      { _id: peerA, tenant: tenantId, role: 'tenant_staff' },
      { _id: peerB, tenant: tenantId, role: 'tenant_staff' },
      { _id: peerC, tenant: tenantId, role: 'tenant_staff' },
      { _id: hrId, tenant: tenantId, role: 'tenant_admin' },
    ],
    template: buildDefaultTemplate(tenantId, hrId),
    // peerCountMin 2 is what makes the draft meaningful: a one-name draft is
    // below the floor and would be refused if drafts enforced it.
    cycle: { tenant: tenantId, name: 'Draft', peerReviewEnabled: true, peerCountMin: 2, peerCountMax: 5, createdBy: hrId },
  });
  const subjectUser = { _id: subjectId, tenant: tenantId, role: 'tenant_staff' };
  const hrUser = { _id: hrId, tenant: tenantId, role: 'tenant_admin' };
  const nominate = (body) =>
    asUser(subjectUser, { params: { id: String(db.appraisals[0]._id) }, body });

  try {
    let res = capture();
    await cyclesCtrl.launchCycle(
      asUser(hrUser, { params: { id: String(db.cycles[0]._id) }, body: { employeeIds: [String(subjectId)] } }),
      res, fail
    );

    // Draft one name — below peerCountMin, which a draft is allowed to be.
    res = capture();
    await appraisals.nominatePeers(nominate({ userIds: [String(peerA)], submit: false }), res, fail);
    assert.strictEqual(res.status, 200, 'a draft is not held to the minimum — being incomplete is what makes it a draft');
    assert.strictEqual(res.body.data.draft, true);
    assert.strictEqual(res.body.data.state, 'nominating', 'a draft does not advance the appraisal');
    assert.strictEqual(db.appraisals[0].peerNominations.length, 1);

    // The employee comes back and re-saves a different list. Before drafts
    // existed this second call was impossible: the first had already left
    // 'nominating', and canNominate is gated to that state.
    res = capture();
    await appraisals.nominatePeers(nominate({ userIds: [String(peerB), String(peerC)], submit: 'false' }), res, fail);
    assert.strictEqual(res.status, 200, 'the string "false" a non-JSON client posts also means draft');
    assert.deepStrictEqual(
      db.appraisals[0].peerNominations.map((n) => String(n.user)).sort(),
      [String(peerB), String(peerC)].sort(),
      're-saving REPLACES the proposed list rather than appending to it'
    );

    // The subject can still read their own draft back.
    res = capture();
    await appraisals.getNomination(asUser(subjectUser, { params: { id: String(db.appraisals[0]._id) } }), res, fail);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.myProposals.length, 2, 'the saved draft pre-seeds the form on return');

    // Now submit for real.
    res = capture();
    await appraisals.nominatePeers(nominate({ userIds: [String(peerB), String(peerC)] }), res, fail);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.draft, false);
    assert.strictEqual(res.body.data.state, 'pending_peer_approval', 'omitting submit keeps the original behaviour');
  } finally {
    restore();
  }
});

test('a draft is still held to the maximum, and still refuses the manager', async () => {
  const tenantId = oid();
  const subjectId = oid();
  const managerId = oid();
  const peers = [oid(), oid(), oid()];
  const hrId = oid();

  const { db, restore } = makeHarness({
    users: [
      { _id: subjectId, tenant: tenantId, role: 'tenant_staff', employeeProfile: { work: { manager: managerId } } },
      { _id: managerId, tenant: tenantId, role: 'tenant_staff' },
      ...peers.map((p) => ({ _id: p, tenant: tenantId, role: 'tenant_staff' })),
      { _id: hrId, tenant: tenantId, role: 'tenant_admin' },
    ],
    template: buildDefaultTemplate(tenantId, hrId),
    cycle: { tenant: tenantId, name: 'Cap', peerReviewEnabled: true, peerCountMin: 1, peerCountMax: 2, createdBy: hrId },
  });
  const subjectUser = { _id: subjectId, tenant: tenantId, role: 'tenant_staff' };

  try {
    let res = capture();
    await cyclesCtrl.launchCycle(
      asUser({ _id: hrId, tenant: tenantId, role: 'tenant_admin' }, {
        params: { id: String(db.cycles[0]._id) }, body: { employeeIds: [String(subjectId)] },
      }), res, fail
    );
    const params = { id: String(db.appraisals[0]._id) };

    res = capture();
    await appraisals.nominatePeers(
      asUser(subjectUser, { params, body: { userIds: peers.map(String), submit: false } }), res, fail
    );
    assert.strictEqual(res.status, 400, 'the cap is a limit on the form, not a completeness requirement');
    assert.match(res.body.message, /at most 2/);

    res = capture();
    await appraisals.nominatePeers(
      asUser(subjectUser, { params, body: { userIds: [String(managerId)], submit: false } }), res, fail
    );
    assert.strictEqual(res.status, 400, 'a draft does not relax who may be nominated');
    assert.match(res.body.message, /manager/);
    assert.strictEqual(db.appraisals[0].peerNominations.length, 0, 'a rejected draft writes nothing');
  } finally {
    restore();
  }
});
