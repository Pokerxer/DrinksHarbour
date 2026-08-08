// server/__tests__/appraisalLifecycleLeaks.test.js
//
// Phase 2 Task 10: the central coverage gain of the phase. Every anonymity
// guarantee up to this point rested on unit-tested pure helpers plus code
// reading; nothing had ever driven a REAL controller end to end. This file
// drives the actual exported controller functions (appraisal.controller.js,
// appraisalCycle.controller.js, appraisalFeedback.controller.js) through the
// whole 360 lifecycle against the in-memory harness in
// __tests__/helpers/appraisalHarness.js, and asserts at every point a
// subject-facing payload is produced that no reviewer identity is in it.
//
// The harness is backed by real arrays (harness.db), not per-call fixtures:
// launchCycle's Appraisal.create(...) is the SAME record nominatePeers later
// finds via Appraisal.findOne(...), which is the SAME record approvePeers'
// save() mutates, which is the SAME record getAppraisal later reads — so
// this test actually exercises the controllers composing, not five isolated
// mocks that happen to return plausible-looking data.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

// Phase 5 note: the HR fixtures in this file are `tenant_owner`, not
// `tenant_admin`. Since §9.4 an admin's HR powers are bounded by the
// departments they manage, and every test below is about ANONYMITY rather than
// about who qualifies as HR. The department boundary itself gets its own
// scenario at the bottom of this file, where a non-owning admin is asserted
// filtered or 403'd on the roster, the report and appraisal detail.
const appraisals = require('../controllers/appraisal.controller');
const cyclesCtrl = require('../controllers/appraisalCycle.controller');
const feedbackCtrl = require('../controllers/appraisalFeedback.controller');
const { buildDefaultTemplate } = require('../services/appraisal.helpers');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const oid = () => new mongoose.Types.ObjectId();

// A handler calling next(err) must surface as a test failure, not a silent
// pass — never swallow it.
const fail = (err) => { throw err; };

const SUBJECT_FORBIDDEN = ['reviewerIds', 'peerNominations'];

/**
 * Assert a subject-facing payload leaks no reviewer identity — via two
 * independent checks:
 *
 * 1. Field-level (SUBJECT_FORBIDDEN, a copy of REVIEWER_IDENTITY_FIELDS in
 *    appraisal.controller.js): asserts the known deny-listed keys are
 *    literally absent at the top level of `payload` / `payload.appraisal`.
 *    Good failure messages, but blind to two things: (a) `omit()` calling
 *    `.toObject()` on a hydrated Mongoose document is what actually strips
 *    these keys — spread a hydrated doc instead (`{ ...obj }`) and you get
 *    `{$__, _doc}` with the real fields sitting untouched *inside* `_doc`,
 *    which `payload[key] === undefined` never notices; (b) a future
 *    identity field added to the schema but forgotten in
 *    REVIEWER_IDENTITY_FIELDS (and, in the same distracted edit, forgotten
 *    in this copy) would never be caught by a field scan built from the
 *    same forgotten list.
 * 2. Value-level (`forbiddenReviewerIds`): asserts none of the given
 *    reviewer ids appear ANYWHERE in `JSON.stringify(payload)`, regardless
 *    of what key they sit under or how deeply nested. This is what actually
 *    catches both blind spots above — it doesn't care that the leaked value
 *    is sitting inside `_doc`, or under a key nobody thought to deny-list.
 *
 * `forbiddenReviewerIds` must be reviewer ids the subject is NOT entitled to
 * see the identity of — approved peers, rejected/declined peer nominees,
 * any other reviewer. Do NOT pass the subject's own id or the manager's id:
 * both legitimately appear in subject-facing payloads (`employee`,
 * `manager` fields) and asserting them absent would make every call here
 * fail on correct code.
 */
function assertNoIdentityLeak(payload, where, forbiddenReviewerIds = []) {
  // Every object in a subject-facing payload that could carry a deny-listed
  // key, not just the top level and `.appraisal`. `.access` is the resolved
  // capability object, `.sections` the template form, and — the one that
  // actually matters — `feedback[].appraisal`, a nested appraisal document
  // that `myReviewRequests` already populates elsewhere in this module, so
  // the shape is one a future subject-facing handler could easily produce.
  // `.comparison` (Phase 3 Task 13) and each row's `peerBreakdown` entries are
  // included for the same reason: they are objects derived from appraisal and
  // feedback documents, so a projection slip upstream lands here first.
  const docs = [
    payload?.appraisal,
    payload,
    payload?.access,
    ...(payload?.sections || []),
    ...(payload?.feedback || []).map((fb) => fb?.appraisal),
    ...(payload?.comparison || []),
    ...(payload?.comparison || []).flatMap((row) => row?.peerBreakdown || []),
  ].filter((d) => d && typeof d === 'object');
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

  // `peerBreakdown` is the one Phase 3 field that carries a reviewer identity
  // by design, so it needs its own explicit check: the SUBJECT_FORBIDDEN scan
  // above looks only for `reviewerIds`/`peerNominations`, and a populated
  // breakdown — `[{ reviewer, rating }]` — contains neither key. It must be
  // null for a subject-facing payload, never `[]`: an empty array is the
  // distinct claim "no peers responded", which is a different fact and would
  // let a genuinely-empty breakdown pass for a correctly-withheld one.
  for (const row of payload?.comparison || []) {
    assert.strictEqual(
      row.peerBreakdown,
      null,
      `${where}: a comparison row carried a peer breakdown to the subject`
    );
  }

  const serialized = JSON.stringify(payload);
  for (const id of forbiddenReviewerIds) {
    assert.ok(
      !serialized.includes(String(id)),
      `${where}: reviewer id ${id} is present somewhere in the serialised payload — a value-level identity leak`
    );
  }
}

test('the full 360 loop never leaks a reviewer identity to the subject', async () => {
  const tenantId = oid();
  const subjectId = oid();
  const managerId = oid();
  const peerA = oid();
  const peerB = oid();
  const peerC = oid();
  const peerD = oid();
  const hrId = oid();

  const template = buildDefaultTemplate(tenantId, hrId);
  const cycle = {
    tenant: tenantId,
    name: 'H1 2026 Review',
    peerReviewEnabled: true,
    peerCountMin: 2,
    peerCountMax: 5,
    nominationDeadline: new Date('2099-01-01'),
    feedbackDeadline: new Date('2099-02-01'),
    createdBy: hrId,
  };

  const { db, restore } = makeHarness({
    users: [
      { _id: subjectId, tenant: tenantId, role: 'tenant_staff', firstName: 'Sam', lastName: 'Subject', email: 'sam@wyn.test', employeeProfile: { work: { manager: managerId } } },
      { _id: managerId, tenant: tenantId, role: 'tenant_staff', firstName: 'Mia', lastName: 'Manager', email: 'mia@wyn.test' },
      { _id: peerA, tenant: tenantId, role: 'tenant_staff', firstName: 'Ada', lastName: 'PeerA', email: 'peera@wyn.test' },
      { _id: peerB, tenant: tenantId, role: 'tenant_staff', firstName: 'Bo', lastName: 'PeerB', email: 'peerb@wyn.test' },
      { _id: peerC, tenant: tenantId, role: 'tenant_staff', firstName: 'Cy', lastName: 'PeerC', email: 'peerc@wyn.test' },
      { _id: peerD, tenant: tenantId, role: 'tenant_staff', firstName: 'Di', lastName: 'PeerD', email: 'peerd@wyn.test' },
      { _id: hrId, tenant: tenantId, role: 'tenant_owner', firstName: 'Helen', lastName: 'HR', email: 'hr@wyn.test' },
    ],
    template,
    cycle,
  });

  const subjectUser = { _id: subjectId, tenant: tenantId, role: 'tenant_staff' };
  const managerUser = { _id: managerId, tenant: tenantId, role: 'tenant_staff' };
  const peerAUser = { _id: peerA, tenant: tenantId, role: 'tenant_staff' };
  const peerBUser = { _id: peerB, tenant: tenantId, role: 'tenant_staff' };
  const peerDUser = { _id: peerD, tenant: tenantId, role: 'tenant_staff' };
  const hrUser = { _id: hrId, tenant: tenantId, role: 'tenant_owner' };

  // Every peer candidate in this scenario — approved (A, B, D) or rejected
  // (C) — is a reviewer identity the subject is never entitled to learn.
  // Passed to every assertNoIdentityLeak call below so the value-based scan
  // has something to look for; harmless before nomination even happens
  // (line ~113) since none of these ids are in the record yet.
  const reviewerIdentityIds = [peerA, peerB, peerC, peerD];

  try {
    const cycleId = db.cycles[0]._id;

    // 1. launch (peerReviewEnabled) → nominating
    let res = capture();
    await cyclesCtrl.launchCycle(
      asUser(hrUser, { params: { id: String(cycleId) }, body: { employeeIds: [String(subjectId)] } }),
      res, fail
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.created, 1, 'exactly one appraisal launched for the scoped employee');
    assert.strictEqual(db.appraisals.length, 1);
    const appraisal = db.appraisals[0];
    const appraisalId = appraisal._id;
    assert.strictEqual(appraisal.state, 'nominating', 'peerReviewEnabled routes through nomination, not straight to collecting');

    // 2. subject GET /:id/nomination → assertNoIdentityLeak
    res = capture();
    await appraisals.getNomination(asUser(subjectUser, { params: { id: String(appraisalId) } }), res, fail);
    assert.strictEqual(res.status, 200);
    assertNoIdentityLeak(res.body.data, 'subject GET /:id/nomination (nominating)', reviewerIdentityIds);
    assert.deepStrictEqual(
      Object.keys(res.body.data).sort(),
      ['deadline', 'max', 'min', 'myProposals', 'state'],
      'nominationViewForSubject is an allow-list — nothing else may pass through it'
    );

    // 3. subject POST /:id/nominate [A,B,C] → pending_peer_approval
    res = capture();
    await appraisals.nominatePeers(
      asUser(subjectUser, { params: { id: String(appraisalId) }, body: { userIds: [String(peerA), String(peerB), String(peerC)] } }),
      res, fail
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.state, 'pending_peer_approval');
    assert.strictEqual(res.body.data.nominated, 3);
    assert.strictEqual(appraisal.state, 'pending_peer_approval', 'the SAME in-memory record advanced — the harness composes');

    // 4. subject GET /:id → 403, still not readable
    res = capture();
    await appraisals.getAppraisal(asUser(subjectUser, { params: { id: String(appraisalId) } }), res, fail);
    assert.strictEqual(res.status, 403, 'a subject cannot read their own appraisal before release');

    // 5. manager POST /:id/approve-peers {approve:[A,B], reject:[C]} → collecting
    res = capture();
    await appraisals.approvePeers(
      asUser(managerUser, { params: { id: String(appraisalId) }, body: { approve: [String(peerA), String(peerB)], reject: [String(peerC)] } }),
      res, fail
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.state, 'collecting');
    assert.strictEqual(res.body.data.peersAdded, 2);
    assert.ok(
      appraisal.reviewerIds.map(String).includes(String(peerA)) && appraisal.reviewerIds.map(String).includes(String(peerB)),
      'approved peers join reviewerIds on the real backing record'
    );
    assert.ok(!appraisal.reviewerIds.map(String).includes(String(peerC)), 'a rejected nominee never becomes a reviewer');

    // 6. subject GET /:id/nomination → { state, approvedCount: 2 } exactly
    res = capture();
    await appraisals.getNomination(asUser(subjectUser, { params: { id: String(appraisalId) } }), res, fail);
    assert.strictEqual(res.status, 200);
    assertNoIdentityLeak(res.body.data, 'subject GET /:id/nomination (collecting)', reviewerIdentityIds);
    assert.deepStrictEqual(
      res.body.data, { state: 'collecting', approvedCount: 2 },
      'past nominating the subject gets only a count — never who was approved or rejected'
    );

    // 7. peer A submits; peer B declines
    const rowFor = (reviewer) => db.feedback.find(
      (f) => String(f.appraisal) === String(appraisalId) && String(f.reviewer) === String(reviewer) && f.kind === 'peer'
    );
    const peerARow = rowFor(peerA);
    const peerBRow = rowFor(peerB);
    assert.ok(peerARow && peerBRow, 'approvePeers must have created a pending feedback row per approved peer');

    res = capture();
    await feedbackCtrl.submitFeedback(
      asUser(peerAUser, { params: { id: String(peerARow._id) }, body: { answers: [] } }),
      res, fail
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.status, 'submitted');

    res = capture();
    await feedbackCtrl.declineFeedback(
      asUser(peerBUser, { params: { id: String(peerBRow._id) }, body: {} }),
      res, fail
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.status, 'declined');

    // 8. manager POST /:id/peers {add:[D]} → D gets a pending row
    res = capture();
    await appraisals.backfillPeers(
      asUser(managerUser, { params: { id: String(appraisalId) }, body: { add: [String(peerD)] } }),
      res, fail
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.peersAdded, 1);
    const peerDRow = rowFor(peerD);
    assert.ok(peerDRow && peerDRow.status === 'pending', 'the backfilled peer gets a fresh pending row');

    // 9. peer D submits
    res = capture();
    await feedbackCtrl.submitFeedback(
      asUser(peerDUser, { params: { id: String(peerDRow._id) }, body: { answers: [] } }),
      res, fail
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.status, 'submitted');

    // 10. manager POST /:id/summary, then /:id/release
    res = capture();
    await appraisals.saveSummary(
      asUser(managerUser, { params: { id: String(appraisalId) }, body: { summary: 'A solid, well-rounded quarter.', finalRating: 4 } }),
      res, fail
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(appraisal.state, 'summarising');

    res = capture();
    // Releasing requires at least one agreed action for the next period.
    await appraisals.releaseAppraisal(
      asUser(managerUser, {
        params: { id: String(appraisalId) },
        body: { commitments: [{ text: 'Lead two tastings next quarter' }] },
      }),
      res, fail
    );
    assert.strictEqual(res.status, 200, `release must succeed on 2 submitted peer responses without confirmation: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.data.state, 'released');
    assert.strictEqual(appraisal.state, 'released');

    // 11. subject GET /:id → 200, assertNoIdentityLeak
    res = capture();
    await appraisals.getAppraisal(asUser(subjectUser, { params: { id: String(appraisalId) } }), res, fail);
    assert.strictEqual(res.status, 200, 'the subject can now read their released appraisal');
    assertNoIdentityLeak(res.body.data, 'subject GET /:id (released)', reviewerIdentityIds);
    // Peer rows no longer reach the subject at all — anonymising the card was
    // never enough, because the prose on it identifies its author. Peer input
    // reaches the employee only through the manager's summary.
    const peerRowsSeenBySubject = res.body.data.feedback.filter((fb) => fb.kind === 'peer');
    assert.strictEqual(peerRowsSeenBySubject.length, 0, 'the subject must receive NO peer feedback rows');
    // The subject's comparison must lose its peer column by the same route,
    // rather than reporting a peer mean derived from rows they cannot read.
    for (const row of res.body.data.comparison || []) {
      assert.strictEqual(row.peer.n, 0, `${row.label}: no peer answer may reach the subject's comparison`);
      assert.strictEqual(row.peer.mean, null, `${row.label}: no peer mean for the subject`);
    }
    // Still told what the summary rests on, which is the part they need.
    assert.strictEqual(res.body.data.approvedPeerCount, 3, 'A, B, D approved; C rejected');
    assert.strictEqual(res.body.data.peerResponseCount, 2, 'A and D submitted; B declined');

    // The rows do exist and DO reach the manager — otherwise the assertions
    // above would hold vacuously against an appraisal with no peer input.
    res = capture();
    await appraisals.getAppraisal(asUser(managerUser, { params: { id: String(appraisalId) } }), res, fail);
    assert.strictEqual(res.status, 200);
    const peerRowsSeenByManager = res.body.data.feedback.filter((fb) => fb.kind === 'peer');
    assert.strictEqual(peerRowsSeenByManager.length, 2, 'the manager reads both submitted peer rows in full');
    for (const fb of peerRowsSeenByManager) {
      assert.ok(fb.reviewer, 'the manager sees peer reviewers by name — they write the summary');
    }

    // 12. subject GET /my → assertNoIdentityLeak on every row
    res = capture();
    await appraisals.myAppraisals(asUser(subjectUser, { params: {}, body: {} }), res, fail);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 1);
    for (const row of res.body.data) assertNoIdentityLeak(row, 'subject GET /my row', reviewerIdentityIds);

    // 13. subject POST /:id/acknowledge → assertNoIdentityLeak on the response
    res = capture();
    await appraisals.acknowledgeAppraisal(
      asUser(subjectUser, { params: { id: String(appraisalId) }, body: { employeeResponse: 'Thanks for the feedback.' } }),
      res, fail
    );
    assert.strictEqual(res.status, 200);
    // assertNoIdentityLeak is deliberately checked BEFORE the state
    // assertion below: a regressed omit() (spreading a hydrated Mongoose
    // doc instead of calling .toObject()) yields `{$__, _doc}`, under which
    // `res.body.data.state` also reads undefined — so the state assertion
    // would fail too and, sitting first, would mask the leak assertion
    // from ever running. Leak detection must be the thing that actually
    // fires, not an accident of assertion order.
    assertNoIdentityLeak(res.body.data, 'subject POST /:id/acknowledge', reviewerIdentityIds);
    assert.strictEqual(res.body.data.state, 'acknowledged');
  } finally {
    restore();
  }
});

test('an unrelated staff member is refused at every state', async () => {
  const tenantId = oid();
  const subjectId = oid();
  const managerId = oid();
  const unrelatedId = oid();

  const { db, restore } = makeHarness({
    users: [
      { _id: subjectId, tenant: tenantId, role: 'tenant_staff', firstName: 'Sam', lastName: 'Subject', email: 'sam2@wyn.test' },
      { _id: managerId, tenant: tenantId, role: 'tenant_staff', firstName: 'Mia', lastName: 'Manager', email: 'mia2@wyn.test' },
      { _id: unrelatedId, tenant: tenantId, role: 'tenant_staff', firstName: 'Uma', lastName: 'Unrelated', email: 'uma2@wyn.test' },
    ],
  });
  const unrelatedUser = { _id: unrelatedId, tenant: tenantId, role: 'tenant_staff' };

  try {
    for (const state of ['nominating', 'pending_peer_approval', 'collecting', 'summarising', 'released']) {
      const appraisalId = oid();
      db.appraisals.push({
        _id: appraisalId,
        tenant: tenantId,
        cycle: oid(),
        employee: subjectId,
        manager: managerId,
        state,
        reviewerIds: [subjectId, managerId],
        peerNominations: [],
        summary: state === 'summarising' || state === 'released' ? 'placeholder' : undefined,
      });

      let res = capture();
      await appraisals.getAppraisal(asUser(unrelatedUser, { params: { id: String(appraisalId) } }), res, fail);
      assert.strictEqual(res.status, 403, `GET /:id at ${state}`);

      res = capture();
      await appraisals.getNomination(asUser(unrelatedUser, { params: { id: String(appraisalId) } }), res, fail);
      assert.strictEqual(res.status, 403, `GET /:id/nomination at ${state}`);

      res = capture();
      await appraisals.nominatePeers(
        asUser(unrelatedUser, { params: { id: String(appraisalId) }, body: { userIds: [] } }),
        res, fail
      );
      assert.strictEqual(res.status, 403, `POST /:id/nominate at ${state}`);
    }
  } finally {
    restore();
  }
});

test('the manager and HR DO see peer reviewer names', async () => {
  // The policy is named-to-manager-and-HR, not full anonymity — peers were
  // shown a disclosure banner ({namedTo:['manager','hr']}) before writing.
  // Assert it positively so a future change to full anonymity cannot land
  // without also moving that banner.
  const tenantId = oid();
  const subjectId = oid();
  const managerId = oid();
  const hrId = oid();
  const peerId = oid();

  const template = buildDefaultTemplate(tenantId, hrId);
  const cycle = { tenant: tenantId, name: 'H1 2026 Review', peerReviewEnabled: true, peerCountMin: 1, peerCountMax: 5 };

  const { db, restore } = makeHarness({
    users: [
      { _id: subjectId, tenant: tenantId, role: 'tenant_staff', firstName: 'Sam', lastName: 'Subject', email: 'sam3@wyn.test' },
      { _id: managerId, tenant: tenantId, role: 'tenant_staff', firstName: 'Mia', lastName: 'Manager', email: 'mia3@wyn.test' },
      { _id: hrId, tenant: tenantId, role: 'tenant_owner', firstName: 'Helen', lastName: 'HR', email: 'hr3@wyn.test' },
      { _id: peerId, tenant: tenantId, role: 'tenant_staff', firstName: 'Percy', lastName: 'Peer', email: 'percy@wyn.test' },
    ],
    template,
    cycle,
  });

  try {
    const cycleId = db.cycles[0]._id;
    const appraisalId = oid();
    db.appraisals.push({
      _id: appraisalId,
      tenant: tenantId,
      cycle: cycleId,
      employee: subjectId,
      manager: managerId,
      state: 'released',
      reviewerIds: [subjectId, managerId, peerId],
      peerNominations: [{ user: peerId, proposedBy: subjectId, status: 'approved' }],
      summary: 'A fair, considered summary.',
    });
    db.feedback.push({
      tenant: tenantId, appraisal: appraisalId, cycle: cycleId, reviewer: peerId, kind: 'peer', status: 'submitted', answers: [],
    });

    const managerUser = { _id: managerId, tenant: tenantId, role: 'tenant_staff' };
    const hrUser = { _id: hrId, tenant: tenantId, role: 'tenant_owner' };

    for (const viewer of [managerUser, hrUser]) {
      const res = capture();
      await appraisals.getAppraisal(asUser(viewer, { params: { id: String(appraisalId) } }), res, fail);
      assert.strictEqual(res.status, 200, `getAppraisal as ${viewer.role}`);

      assert.ok(
        Array.isArray(res.body.data.appraisal.reviewerIds),
        `${viewer.role} is entitled to see reviewerIds on the appraisal document`
      );
      assert.ok(
        res.body.data.appraisal.reviewerIds.map(String).includes(String(peerId)),
        `${viewer.role} must see the peer in reviewerIds`
      );

      const peerRow = res.body.data.feedback.find((fb) => fb.kind === 'peer');
      assert.ok(peerRow, 'the peer feedback row must be present');
      assert.ok(peerRow.reviewer, `${viewer.role} must see the peer reviewer's identity, per the disclosure banner shown to peers`);
      assert.strictEqual(String(peerRow.reviewer._id), String(peerId));
    }
  } finally {
    restore();
  }
});

test('a declined peer row reaches manager/HR at collecting with no answers, does not inflate peerResponseCount, and never reaches the subject', async () => {
  // Task 13, Important 1/2: a peer's withheld draft must not disclose its
  // content to manager/HR, even though the ROW ITSELF (status/declinedAt) is
  // deliberately surfaced to them while collecting so backfill can be
  // offered. Exercises the real saveDraft → declineFeedback → getAppraisal
  // sequence end to end, not just the pure helper in isolation.
  const tenantId = oid();
  const subjectId = oid();
  const managerId = oid();
  const peerId = oid();
  const hrId = oid();

  const template = buildDefaultTemplate(tenantId, hrId);
  // The harness stores templates as plain objects with no real mongoose
  // subdocument creation, so questions need a manually assigned _id to be
  // addressable by saveDraft's askedQuestionIds check.
  for (const section of template.sections) {
    for (const q of section.questions) q._id = oid();
  }
  // Derived from askOf rather than indexed positionally: the peer prompts live
  // in their own section now, and a hardcoded [1].questions[0] silently became
  // a self/manager-only question — which saveDraft correctly refuses, failing
  // this test for a reason that has nothing to do with the leak it guards.
  const draftedQuestionId = template.sections
    .flatMap((s) => s.questions)
    .find((q) => (q.askOf || []).includes('peer'))._id;
  const cycle = {
    tenant: tenantId,
    name: 'Declined Draft Cycle',
    peerReviewEnabled: true,
    peerCountMin: 1,
    peerCountMax: 5,
  };

  const { db, restore } = makeHarness({
    users: [
      { _id: subjectId, tenant: tenantId, role: 'tenant_staff', firstName: 'Sam', lastName: 'Subject', email: 'sam6@wyn.test' },
      { _id: managerId, tenant: tenantId, role: 'tenant_staff', firstName: 'Mia', lastName: 'Manager', email: 'mia6@wyn.test' },
      { _id: peerId, tenant: tenantId, role: 'tenant_staff', firstName: 'Percy', lastName: 'Peer', email: 'percy6@wyn.test' },
      { _id: hrId, tenant: tenantId, role: 'tenant_owner', firstName: 'Helen', lastName: 'HR', email: 'hr6@wyn.test' },
    ],
    template,
    cycle,
  });

  const peerUser = { _id: peerId, tenant: tenantId, role: 'tenant_staff' };
  const managerUser = { _id: managerId, tenant: tenantId, role: 'tenant_staff' };
  const hrUser = { _id: hrId, tenant: tenantId, role: 'tenant_owner' };
  const subjectUser = { _id: subjectId, tenant: tenantId, role: 'tenant_staff' };
  const SENSITIVE_TEXT = 'I have real concerns about how they handled the Q3 escalation';

  try {
    const cycleId = db.cycles[0]._id;
    const appraisalId = oid();
    db.appraisals.push({
      _id: appraisalId,
      tenant: tenantId,
      cycle: cycleId,
      employee: subjectId,
      manager: managerId,
      state: 'collecting',
      reviewerIds: [subjectId, managerId, peerId],
      peerNominations: [{ user: peerId, proposedBy: subjectId, status: 'approved' }],
    });
    const feedbackId = oid();
    db.feedback.push({
      _id: feedbackId,
      tenant: tenantId,
      appraisal: appraisalId,
      cycle: cycleId,
      reviewer: peerId,
      kind: 'peer',
      status: 'pending',
      answers: [],
    });

    // 1. Peer saves a draft carrying the sensitive text.
    let res = capture();
    await feedbackCtrl.saveDraft(
      asUser(peerUser, {
        params: { id: String(feedbackId) },
        body: { answers: [{ questionId: String(draftedQuestionId), text: SENSITIVE_TEXT }] },
      }),
      res, fail
    );
    assert.strictEqual(res.status, 200);

    // 2. Peer reconsiders and declines.
    res = capture();
    await feedbackCtrl.declineFeedback(asUser(peerUser, { params: { id: String(feedbackId) }, body: {} }), res, fail);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.status, 'declined');

    // 3. Manager reading at 'collecting' DOES receive the declined row (so
    //    backfill can be offered) — but it carries no answers.
    res = capture();
    await appraisals.getAppraisal(asUser(managerUser, { params: { id: String(appraisalId) } }), res, fail);
    assert.strictEqual(res.status, 200);
    let declinedRow = res.body.data.feedback.find((fb) => fb.status === 'declined');
    assert.ok(declinedRow, 'the manager must receive the declined row while collecting, to offer backfill');
    assert.strictEqual(declinedRow.answers, undefined, 'the declined row must carry no answers to the manager');
    assert.ok(
      !JSON.stringify(res.body.data).includes(SENSITIVE_TEXT),
      'the withheld draft text must not appear anywhere in the manager payload'
    );
    // participation must not be overstated by counting a decline as a response
    assert.strictEqual(res.body.data.peerResponseCount, 0, 'peerResponseCount must exclude declined rows');

    // 4. Same for HR.
    res = capture();
    await appraisals.getAppraisal(asUser(hrUser, { params: { id: String(appraisalId) } }), res, fail);
    assert.strictEqual(res.status, 200);
    declinedRow = res.body.data.feedback.find((fb) => fb.status === 'declined');
    assert.ok(declinedRow, 'HR must also receive the declined row while collecting');
    assert.strictEqual(declinedRow.answers, undefined, 'the declined row must carry no answers to HR either');
    assert.ok(
      !JSON.stringify(res.body.data).includes(SENSITIVE_TEXT),
      'the withheld draft text must not appear anywhere in the HR payload'
    );
    assert.strictEqual(res.body.data.peerResponseCount, 0, 'peerResponseCount must exclude declined rows for HR too');

    // 5. The subject never receives a declined row at all (canBackfillPeers
    //    is always false for the subject, at any state) — while collecting
    //    the subject is refused outright, so assert the deny rather than an
    //    empty feedback array.
    res = capture();
    await appraisals.getAppraisal(asUser(subjectUser, { params: { id: String(appraisalId) } }), res, fail);
    assert.strictEqual(res.status, 403, 'the subject cannot read the appraisal at all before release, declined row or not');

    // 6. Even once released, the subject's own query has no `canBackfillPeers`
    //    branch at all (it is always false for relation 'subject') — the
    //    declined row must still never surface, not even as a bare row with
    //    its answers stripped.
    const storedAppraisal = db.appraisals.find((a) => String(a._id) === String(appraisalId));
    storedAppraisal.summary = 'placeholder summary';
    storedAppraisal.state = 'released';
    res = capture();
    await appraisals.getAppraisal(asUser(subjectUser, { params: { id: String(appraisalId) } }), res, fail);
    assert.strictEqual(res.status, 200, 'the subject can read once released');
    assert.strictEqual(
      res.body.data.feedback.some((fb) => fb.status === 'declined'),
      false,
      'the subject must never receive a declined row, even after release'
    );
  } finally {
    restore();
  }
});

test('an approved peer reviewer cannot read the appraisal they are reviewing', async () => {
  // The unrelated-staff test above covers relation 'none'. This covers the
  // more interesting negative case: relation 'reviewer' — someone genuinely
  // in reviewerIds, who holds a legitimate feedback row of their own on this
  // appraisal, and is refused anyway. canRead:false is the ONLY thing
  // stopping them from reading every OTHER peer's feedback on the same
  // appraisal (resolveAppraisalAccess in appraisal.helpers.js, relation
  // 'reviewer' branch) — this is the case that would actually matter if it
  // ever regressed, unlike the unrelated-staff case which has no legitimate
  // row to abuse in the first place.
  const tenantId = oid();
  const subjectId = oid();
  const managerId = oid();
  const peerId = oid();

  const { db, restore } = makeHarness({
    users: [
      { _id: subjectId, tenant: tenantId, role: 'tenant_staff', firstName: 'Sam', lastName: 'Subject', email: 'sam5@wyn.test' },
      { _id: managerId, tenant: tenantId, role: 'tenant_staff', firstName: 'Mia', lastName: 'Manager', email: 'mia5@wyn.test' },
      { _id: peerId, tenant: tenantId, role: 'tenant_staff', firstName: 'Percy', lastName: 'Peer', email: 'percy5@wyn.test' },
    ],
  });
  const peerUser = { _id: peerId, tenant: tenantId, role: 'tenant_staff' };

  try {
    for (const state of ['collecting', 'released']) {
      const appraisalId = oid();
      db.appraisals.push({
        _id: appraisalId,
        tenant: tenantId,
        cycle: oid(),
        employee: subjectId,
        manager: managerId,
        state,
        reviewerIds: [subjectId, managerId, peerId],
        peerNominations: [{ user: peerId, proposedBy: subjectId, status: 'approved' }],
        summary: state === 'released' ? 'placeholder' : undefined,
      });
      db.feedback.push({
        tenant: tenantId, appraisal: appraisalId, cycle: oid(), reviewer: peerId, kind: 'peer', status: 'pending', answers: [],
      });

      const res = capture();
      await appraisals.getAppraisal(asUser(peerUser, { params: { id: String(appraisalId) } }), res, fail);
      assert.strictEqual(
        res.status, 403,
        `an approved peer reviewer holding their own feedback row must still be refused GET /:id at ${state}`
      );
    }
  } finally {
    restore();
  }
});

// ───────────────────────────────────────────────────────────────────────────
// Phase 5 §9.4 — the DEPARTMENT boundary.
//
// This is a REMOVAL of access that every `tenant_admin` in every tenant has
// today, so it is asserted from both sides on all three surfaces the scope is
// meant to cover: the roster (which names peer reviewers), the cycle report
// (which aggregates everyone's answers) and appraisal detail (which is
// everything). The module has already shipped one fix for an HR-only tab leak;
// a boundary with no test is a boundary that comes back.
// ───────────────────────────────────────────────────────────────────────────
test('a tenant_admin sees only the departments they manage, on every surface', async () => {
  const tenantId = oid();
  const salesDept = oid();
  const opsDept = oid();
  // Adaeze manages Sales. Everything in Ops is none of her business.
  const salesAdminId = oid();
  const opsAdminId = oid();
  const ownerId = oid();
  const salesStaffId = oid();
  const opsStaffId = oid();

  const template = buildDefaultTemplate(tenantId, ownerId);
  const cycle = { tenant: tenantId, name: 'H1 2026 Review', peerReviewEnabled: false };

  const { db, restore } = makeHarness({
    users: [
      { _id: ownerId, tenant: tenantId, role: 'tenant_owner', firstName: 'Okey', lastName: 'Owner', email: 'owner@wyn.test' },
      { _id: salesAdminId, tenant: tenantId, role: 'tenant_admin', firstName: 'Ada', lastName: 'Sales', email: 'ada@wyn.test' },
      { _id: opsAdminId, tenant: tenantId, role: 'tenant_admin', firstName: 'Obi', lastName: 'Ops', email: 'obi@wyn.test' },
      { _id: salesStaffId, tenant: tenantId, role: 'tenant_staff', firstName: 'Sam', lastName: 'Seller', email: 'sam@wyn.test', employeeProfile: { work: { department: salesDept } } },
      { _id: opsStaffId, tenant: tenantId, role: 'tenant_staff', firstName: 'Ola', lastName: 'Opsman', email: 'ola@wyn.test', employeeProfile: { work: { department: opsDept } } },
    ],
    departments: [
      { _id: salesDept, tenant: tenantId, name: 'Sales', manager: salesAdminId },
      { _id: opsDept, tenant: tenantId, name: 'Operations', manager: opsAdminId },
    ],
    template,
    cycle,
  });

  const owner = { _id: ownerId, tenant: tenantId, role: 'tenant_owner' };
  const salesAdmin = { _id: salesAdminId, tenant: tenantId, role: 'tenant_admin' };

  try {
    const cycleId = db.cycles[0]._id;

    // Launch as the owner, so both departments' appraisals exist.
    let res = capture();
    await cyclesCtrl.launchCycle(
      asUser(owner, { params: { id: String(cycleId) }, body: { employeeIds: [String(salesStaffId), String(opsStaffId)] } }),
      res, fail
    );
    assert.strictEqual(res.status, 200);

    // §9.2 reviewer routing, end to end: each staffer is reviewed by their own
    // department's manager, and the OWNER is not given an appraisal at all.
    const salesAppraisal = db.appraisals.find((a) => String(a.employee) === String(salesStaffId));
    const opsAppraisal = db.appraisals.find((a) => String(a.employee) === String(opsStaffId));
    assert.strictEqual(String(salesAppraisal.manager), String(salesAdminId));
    assert.strictEqual(String(salesAppraisal.department), String(salesDept));
    assert.strictEqual(String(opsAppraisal.manager), String(opsAdminId));

    // ── roster ───────────────────────────────────────────────────────────
    res = capture();
    await cyclesCtrl.cycleRoster(asUser(salesAdmin, { params: { id: String(cycleId) } }), res, fail);
    assert.strictEqual(res.status, 200);
    const rosterEmployees = res.body.data.rows.map((r) => String(r.employee?._id ?? r.employee));
    assert.deepStrictEqual(rosterEmployees, [String(salesStaffId)],
      'the Sales admin must not see the Ops roster row');
    // And the value-level check: the Ops employee's id must appear NOWHERE in
    // the payload, whatever key it might have hidden under.
    assert.ok(
      !JSON.stringify(res.body).includes(String(opsStaffId)),
      'no trace of another department may survive anywhere in the roster payload'
    );

    // The owner, by contrast, sees both.
    res = capture();
    await cyclesCtrl.cycleRoster(asUser(owner, { params: { id: String(cycleId) } }), res, fail);
    assert.strictEqual(res.body.data.rows.length, 2, 'the owner sees the whole tenant');

    // ── cycle report ─────────────────────────────────────────────────────
    // Release both so each contributes a finalRating to the histogram, then
    // assert the admin's report counts one appraisal and the owner's counts two.
    for (const a of db.appraisals) {
      a.state = 'released';
      a.finalRating = 4;
    }
    res = capture();
    await cyclesCtrl.cycleReport(asUser(salesAdmin, { params: { id: String(cycleId) } }), res, fail);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.releasedCount, 1, 'the report is scoped too, not just the roster');

    res = capture();
    await cyclesCtrl.cycleReport(asUser(owner, { params: { id: String(cycleId) } }), res, fail);
    assert.strictEqual(res.body.data.releasedCount, 2);

    // ── appraisal detail ─────────────────────────────────────────────────
    res = capture();
    await appraisals.getAppraisal(asUser(salesAdmin, { params: { id: String(opsAppraisal._id) } }), res, fail);
    assert.strictEqual(res.status, 403, 'an out-of-department appraisal is a 403, not a redacted 200');

    res = capture();
    await appraisals.getAppraisal(asUser(salesAdmin, { params: { id: String(salesAppraisal._id) } }), res, fail);
    assert.strictEqual(res.status, 200, 'their own department still resolves as hr');
    assert.strictEqual(res.body.data.access.relation, 'hr');

    res = capture();
    await appraisals.getAppraisal(asUser(owner, { params: { id: String(opsAppraisal._id) } }), res, fail);
    assert.strictEqual(res.status, 200, 'the owner reaches everything in the tenant');
  } finally {
    restore();
  }
});

test('an admin who manages no department gets HR access to nothing', async () => {
  const tenantId = oid();
  const dept = oid();
  const ownerId = oid();
  const strayAdminId = oid();
  const staffId = oid();
  const deptManagerId = oid();

  const template = buildDefaultTemplate(tenantId, ownerId);
  const { db, restore } = makeHarness({
    users: [
      { _id: ownerId, tenant: tenantId, role: 'tenant_owner' },
      { _id: strayAdminId, tenant: tenantId, role: 'tenant_admin' },
      { _id: deptManagerId, tenant: tenantId, role: 'tenant_staff' },
      { _id: staffId, tenant: tenantId, role: 'tenant_staff', firstName: 'Sam', lastName: 'Staff', email: 's@wyn.test' },
    ],
    departments: [{ _id: dept, tenant: tenantId, name: 'Sales', manager: deptManagerId }],
    template,
    cycle: { tenant: tenantId, name: 'H1', peerReviewEnabled: false },
  });

  try {
    const cycleId = db.cycles[0]._id;
    const appraisalId = oid();
    db.appraisals.push({
      _id: appraisalId, tenant: tenantId, cycle: cycleId, employee: staffId,
      manager: deptManagerId, department: dept, state: 'released',
      reviewerIds: [staffId, deptManagerId], peerNominations: [], summary: 'ok',
    });

    const stray = { _id: strayAdminId, tenant: tenantId, role: 'tenant_admin' };

    let res = capture();
    await appraisals.getAppraisal(asUser(stray, { params: { id: String(appraisalId) } }), res, fail);
    assert.strictEqual(res.status, 403);

    res = capture();
    await cyclesCtrl.cycleRoster(asUser(stray, { params: { id: String(cycleId) } }), res, fail);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.data.rows, [], 'an empty scope matches nothing, it does not fall back to everything');

    res = capture();
    await cyclesCtrl.cycleReport(asUser(stray, { params: { id: String(cycleId) } }), res, fail);
    assert.strictEqual(res.body.data.releasedCount, 0);
  } finally {
    restore();
  }
});
