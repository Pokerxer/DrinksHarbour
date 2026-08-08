// server/__tests__/appraisalPhase5Endpoints.test.js
//
// Phase 5 §9.3 (per-question review) and §9.5 (standing feedback) driven
// through the REAL controllers against the in-memory harness, the same way
// appraisalLifecycleLeaks.test.js drives the 360 loop. The pure rules behind
// them are unit-tested in appraisalDepartmentScoping.test.js; what is asserted
// here is that the handlers actually apply them — a rule nothing calls is not
// a rule.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const appraisals = require('../controllers/appraisal.controller');
const feedbackCtrl = require('../controllers/appraisalFeedback.controller');
const { buildDefaultTemplate } = require('../services/appraisal.helpers');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const oid = () => new mongoose.Types.ObjectId();
const fail = (err) => { throw err; };

/**
 * One department, one manager, one employee, one appraisal in 'collecting'
 * with the self + manager feedback rows a launch would have created.
 */
function scenario({ selfStatus = 'pending', selfAnswers = [] } = {}) {
  const tenantId = oid();
  const dept = oid();
  const ownerId = oid();
  const managerId = oid();
  const employeeId = oid();
  const colleagueId = oid();
  const outsiderId = oid();
  const template = buildDefaultTemplate(tenantId, ownerId);
  const questionId = template.sections[0].questions[0]._id || oid();
  template.sections[0].questions[0]._id = questionId;

  const harness = makeHarness({
    users: [
      { _id: ownerId, tenant: tenantId, role: 'tenant_owner' },
      { _id: managerId, tenant: tenantId, role: 'tenant_staff', firstName: 'Mia', lastName: 'Manager', email: 'mia@wyn.test', employeeProfile: { work: { department: dept } } },
      { _id: employeeId, tenant: tenantId, role: 'tenant_staff', firstName: 'Sam', lastName: 'Staff', email: 'sam@wyn.test', employeeProfile: { work: { department: dept } } },
      { _id: colleagueId, tenant: tenantId, role: 'tenant_staff', firstName: 'Cy', lastName: 'Colleague', email: 'cy@wyn.test', employeeProfile: { work: { department: dept } } },
      // Same tenant, different department — must never be a standing candidate.
      { _id: outsiderId, tenant: tenantId, role: 'tenant_staff', firstName: 'Oke', lastName: 'Outside', email: 'oke@wyn.test', employeeProfile: { work: { department: oid() } } },
    ],
    departments: [{ _id: dept, tenant: tenantId, name: 'Sales', manager: managerId }],
    template,
    cycle: { tenant: tenantId, name: 'H1 2026', peerReviewEnabled: false, status: 'collecting' },
  });

  const cycleId = harness.db.cycles[0]._id;
  const appraisalId = oid();
  harness.db.appraisals.push({
    _id: appraisalId, tenant: tenantId, cycle: cycleId, employee: employeeId,
    manager: managerId, department: dept, state: 'collecting',
    reviewerIds: [employeeId, managerId], peerNominations: [],
  });
  const selfRowId = oid();
  const managerRowId = oid();
  harness.db.feedback.push(
    {
      _id: selfRowId, tenant: tenantId, appraisal: appraisalId, cycle: cycleId,
      reviewer: employeeId, kind: 'self', status: selfStatus, answers: selfAnswers,
      submittedAt: selfStatus === 'submitted' ? new Date() : undefined,
    },
    {
      _id: managerRowId, tenant: tenantId, appraisal: appraisalId, cycle: cycleId,
      reviewer: managerId, kind: 'manager', status: 'pending', answers: [],
    }
  );

  return {
    ...harness,
    tenantId, dept, ownerId, managerId, employeeId, colleagueId, outsiderId,
    cycleId, appraisalId, selfRowId, managerRowId, questionId,
    owner: { _id: ownerId, tenant: tenantId, role: 'tenant_owner' },
    manager: { _id: managerId, tenant: tenantId, role: 'tenant_staff' },
    employee: { _id: employeeId, tenant: tenantId, role: 'tenant_staff' },
    colleague: { _id: colleagueId, tenant: tenantId, role: 'tenant_staff' },
  };
}

// ── §9.3 subject-answers ───────────────────────────────────────────────────

test('subject-answers reports "not yet submitted" rather than an empty form', async () => {
  const s = scenario({ selfStatus: 'pending', selfAnswers: [{ questionId: oid(), rating: 5 }] });
  try {
    const res = capture();
    await appraisals.subjectAnswers(asUser(s.manager, { params: { id: String(s.appraisalId) } }), res, fail);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.selfSubmitted, false);
    assert.deepStrictEqual(res.body.data.answers, [],
      'a draft the employee has not submitted is not the reviewer\'s to read');
  } finally { s.restore(); }
});

test('subject-answers returns the self answers to the assigned reviewer once submitted', async () => {
  const qid = oid();
  const s = scenario({ selfStatus: 'submitted', selfAnswers: [{ questionId: qid, rating: 5, text: 'A good half.' }] });
  try {
    const res = capture();
    await appraisals.subjectAnswers(asUser(s.manager, { params: { id: String(s.appraisalId) } }), res, fail);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.selfSubmitted, true);
    assert.strictEqual(res.body.data.answers.length, 1);
    assert.strictEqual(res.body.data.answers[0].rating, 5);
    assert.ok(res.body.data.sections.length > 0, 'the reviewer needs the labels to read the answers');
  } finally { s.restore(); }
});

test('subject-answers reaches the owner but not the subject and not a bystander', async () => {
  const s = scenario({ selfStatus: 'submitted', selfAnswers: [{ questionId: oid(), rating: 5 }] });
  try {
    let res = capture();
    await appraisals.subjectAnswers(asUser(s.owner, { params: { id: String(s.appraisalId) } }), res, fail);
    assert.strictEqual(res.status, 200, 'the owner holds hr access everywhere');

    // The subject wrote these; they read them on their own form, not here.
    res = capture();
    await appraisals.subjectAnswers(asUser(s.employee, { params: { id: String(s.appraisalId) } }), res, fail);
    assert.strictEqual(res.status, 403);

    res = capture();
    await appraisals.subjectAnswers(asUser(s.colleague, { params: { id: String(s.appraisalId) } }), res, fail);
    assert.strictEqual(res.status, 403);
  } finally { s.restore(); }
});

// ── §9.3 comments, through the write path ──────────────────────────────────

test('a manager comment survives submit; the same comment on a self row does not', async () => {
  const s = scenario();
  try {
    const qid = s.questionId;
    // The employee tries to annotate their own answer.
    let res = capture();
    await feedbackCtrl.saveDraft(
      asUser(s.employee, {
        params: { id: String(s.selfRowId) },
        body: { answers: [{ questionId: String(qid), rating: 4, comment: 'I deserve a 5.' }] },
      }),
      res, fail
    );
    assert.strictEqual(res.status, 200);
    const selfRow = s.db.feedback.find((f) => String(f._id) === String(s.selfRowId));
    assert.strictEqual('comment' in selfRow.answers[0], false,
      'a self answer may never carry reviewer commentary');

    // The manager annotates the same question.
    res = capture();
    await feedbackCtrl.saveDraft(
      asUser(s.manager, {
        params: { id: String(s.managerRowId) },
        body: { answers: [{ questionId: String(qid), rating: 3, comment: '  Over-rated here.  ' }] },
      }),
      res, fail
    );
    assert.strictEqual(res.status, 200);
    const managerRow = s.db.feedback.find((f) => String(f._id) === String(s.managerRowId));
    assert.strictEqual(managerRow.answers[0].comment, 'Over-rated here.');
  } finally { s.restore(); }
});

test('the subject reads a manager comment only after release', async () => {
  const s = scenario();
  try {
    const qid = s.questionId;
    const managerRow = s.db.feedback.find((f) => String(f._id) === String(s.managerRowId));
    managerRow.status = 'submitted';
    managerRow.answers = [{ questionId: qid, rating: 3, comment: 'Needs to close out follow-ups.' }];
    const appraisal = s.db.appraisals[0];

    // Before release the subject cannot read the record at all.
    appraisal.state = 'collecting';
    let res = capture();
    await appraisals.getAppraisal(asUser(s.employee, { params: { id: String(s.appraisalId) } }), res, fail);
    assert.strictEqual(res.status, 403);

    appraisal.state = 'released';
    appraisal.summary = 'A fair summary.';
    res = capture();
    await appraisals.getAppraisal(asUser(s.employee, { params: { id: String(s.appraisalId) } }), res, fail);
    assert.strictEqual(res.status, 200);
    const row = res.body.data.feedback.find((f) => f.kind === 'manager');
    assert.strictEqual(row.answers[0].comment, 'Needs to close out follow-ups.');
    const comparisonRow = res.body.data.comparison.find((r) => String(r.questionId) === String(qid));
    assert.strictEqual(comparisonRow.managerComment, 'Needs to close out follow-ups.',
      'the comparison carries the comment on the manager side');
  } finally { s.restore(); }
});

// ── §9.5 standing feedback ─────────────────────────────────────────────────

test('the standing form offers the author their own department, minus themselves', async () => {
  const s = scenario();
  try {
    const res = capture();
    await feedbackCtrl.getStandingForm(asUser(s.employee, { params: { id: String(s.selfRowId) } }), res, fail);
    assert.strictEqual(res.status, 200);
    const ids = res.body.data.candidates.map((c) => String(c._id));
    assert.ok(ids.includes(String(s.colleagueId)));
    assert.ok(ids.includes(String(s.managerId)), 'the department manager is a colleague too');
    assert.ok(!ids.includes(String(s.employeeId)), 'never yourself');
    assert.ok(!ids.includes(String(s.outsiderId)), 'never another department');
  } finally { s.restore(); }
});

test('a standing report is saved, replaced on re-submit, and attributed to its author', async () => {
  const s = scenario();
  try {
    let res = capture();
    await feedbackCtrl.saveStandingFeedback(
      asUser(s.employee, {
        params: { id: String(s.selfRowId) },
        body: { entries: [{ subject: String(s.colleagueId), standing: 'doing_well', note: '  Carried the Q1 push.  ' }] },
      }),
      res, fail
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(s.db.standing.length, 1);
    assert.strictEqual(String(s.db.standing[0].author), String(s.employeeId));
    assert.strictEqual(s.db.standing[0].entries[0].note, 'Carried the Q1 push.');

    // Re-submitting REPLACES: removing a name in the UI must actually remove it.
    res = capture();
    await feedbackCtrl.saveStandingFeedback(
      asUser(s.employee, {
        params: { id: String(s.selfRowId) },
        body: { entries: [{ subject: String(s.managerId), standing: 'needs_support' }] },
      }),
      res, fail
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(s.db.standing.length, 1, 'one report per author per cycle, not one per save');
    assert.strictEqual(s.db.standing[0].entries.length, 1);
    assert.strictEqual(String(s.db.standing[0].entries[0].subject), String(s.managerId));
  } finally { s.restore(); }
});

test('a standing entry naming someone outside the author\'s department is refused', async () => {
  const s = scenario();
  try {
    const res = capture();
    await feedbackCtrl.saveStandingFeedback(
      asUser(s.employee, {
        params: { id: String(s.selfRowId) },
        body: { entries: [{ subject: String(s.outsiderId), standing: 'needs_support' }] },
      }),
      res, fail
    );
    assert.strictEqual(res.status, 400);
    assert.strictEqual(s.db.standing.length, 0, 'nothing partially applied');
  } finally { s.restore(); }
});

test('standing feedback is readable by the owner and by nobody else', async () => {
  const s = scenario();
  try {
    let res = capture();
    await feedbackCtrl.saveStandingFeedback(
      asUser(s.employee, {
        params: { id: String(s.selfRowId) },
        body: { entries: [{ subject: String(s.colleagueId), standing: 'needs_support', note: 'Struggling since the move.' }] },
      }),
      res, fail
    );
    assert.strictEqual(res.status, 200);

    // The owner reads it, attributed.
    res = capture();
    await feedbackCtrl.listStandingFeedback(
      { ...asUser(s.owner), query: { cycle: String(s.cycleId) } }, res, fail
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(String(res.body.data[0].author._id), String(s.employeeId));

    // The controller re-checks the role even though the route already gates it.
    for (const role of ['tenant_admin', 'tenant_staff']) {
      res = capture();
      await feedbackCtrl.listStandingFeedback(
        { ...asUser({ _id: oid(), tenant: s.tenantId, role }), query: { cycle: String(s.cycleId) } },
        res, fail
      );
      assert.strictEqual(res.status, 403, `${role} must not read standing feedback`);
    }
  } finally { s.restore(); }
});

test('standing feedback never appears in an appraisal, roster or comparison payload', async () => {
  const s = scenario();
  try {
    let res = capture();
    await feedbackCtrl.saveStandingFeedback(
      asUser(s.employee, {
        params: { id: String(s.selfRowId) },
        body: { entries: [{ subject: String(s.colleagueId), standing: 'needs_support', note: 'UNIQUE-STANDING-MARKER' }] },
      }),
      res, fail
    );
    assert.strictEqual(res.status, 200);

    const appraisal = s.db.appraisals[0];
    appraisal.state = 'released';
    appraisal.summary = 'A fair summary.';

    for (const viewer of [s.owner, s.manager, s.employee]) {
      res = capture();
      await appraisals.getAppraisal(asUser(viewer, { params: { id: String(s.appraisalId) } }), res, fail);
      assert.strictEqual(res.status, 200);
      assert.ok(
        !JSON.stringify(res.body).includes('UNIQUE-STANDING-MARKER'),
        'standing feedback must not ride along on any appraisal payload'
      );
    }
  } finally { s.restore(); }
});

test('a peer or manager cannot open the standing step on somebody else\'s form', async () => {
  const s = scenario();
  try {
    // The manager's own row is a manager row, so the step is refused by kind.
    let res = capture();
    await feedbackCtrl.getStandingForm(asUser(s.manager, { params: { id: String(s.managerRowId) } }), res, fail);
    assert.strictEqual(res.status, 400);

    // And the employee's self row simply is not theirs to load.
    res = capture();
    await feedbackCtrl.getStandingForm(asUser(s.manager, { params: { id: String(s.selfRowId) } }), res, fail);
    assert.strictEqual(res.status, 404);
  } finally { s.restore(); }
});

test('the standing step closes when the self-assessment is submitted', async () => {
  const s = scenario({ selfStatus: 'submitted' });
  try {
    const res = capture();
    await feedbackCtrl.saveStandingFeedback(
      asUser(s.employee, {
        params: { id: String(s.selfRowId) },
        body: { entries: [{ subject: String(s.colleagueId), standing: 'doing_well' }] },
      }),
      res, fail
    );
    assert.strictEqual(res.status, 400);
  } finally { s.restore(); }
});
