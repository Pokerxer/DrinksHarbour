// server/__tests__/appraisalComparisonPayload.test.js
//
// Phase 3 Task 13: `getAppraisal` returns the self/manager/peer comparison.
//
// The interesting property here is not that the arithmetic is right —
// appraisal.helpers.test.js already pins buildComparison's maths in isolation
// — but that the SAME endpoint hands a subject and a manager genuinely
// different objects, and that the subject's copy cannot be walked back to a
// peer's name by any route: not a breakdown, not a stray populated ref, not an
// id sitting under some other key.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const oid = () => new mongoose.Types.ObjectId();
const appraisals = require('../controllers/appraisal.controller');

const q1 = oid();

function released() {
  const tenant = oid();
  const emp = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Grace' };
  const mgr = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Kofi' };
  const peerA = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Ada' };
  const peerB = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Sam' };
  const templateId = oid();
  const cycleId = oid();
  const appraisalId = oid();

  const h = makeHarness({
    users: [emp, mgr, peerA, peerB],
    template: {
      _id: templateId, tenant, family: oid(), version: 1, isLatest: true, name: 'T',
      sections: [{
        title: 'Performance',
        questions: [{
          _id: q1, type: 'rating', label: 'Quality of work', scaleMax: 5,
          askOf: ['self', 'manager', 'peer'],
        }],
      }],
    },
    cycle: { _id: cycleId, tenant, name: 'H2', status: 'collecting', template: templateId },
  });
  h.db.appraisals.push({
    _id: appraisalId, tenant, cycle: cycleId, employee: emp._id, manager: mgr._id,
    state: 'released', summary: 'Good year', finalRating: 4,
    reviewerIds: [emp._id, mgr._id, peerA._id, peerB._id],
    peerNominations: [
      { user: peerA._id, proposedBy: emp._id, status: 'approved' },
      { user: peerB._id, proposedBy: emp._id, status: 'approved' },
    ],
  });
  const fb = (reviewer, kind, rating) => ({
    _id: oid(), tenant, appraisal: appraisalId, cycle: cycleId, reviewer, kind,
    status: 'submitted', answers: [{ questionId: q1, rating }],
  });
  h.db.feedback.push(
    fb(emp._id, 'self', 5), fb(mgr._id, 'manager', 3),
    fb(peerA._id, 'peer', 4), fb(peerB._id, 'peer', 2)
  );
  return { tenant, emp, mgr, peerA, peerB, appraisalId, h };
}

test('the SUBJECT gets an aggregate comparison and NO peer breakdown', async (t) => {
  const s = released();
  t.after(s.h.restore);

  const res = capture();
  await appraisals.getAppraisal(
    asUser(s.emp, { params: { id: String(s.appraisalId) } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 200);
  const [row] = res.body.data.comparison;
  assert.strictEqual(row.self, 5);
  assert.strictEqual(row.manager, 3);
  assert.deepStrictEqual(row.peer, { mean: 3, n: 2, suppressed: false });
  // null, never [] — an empty array is the distinct claim "no peers responded".
  assert.strictEqual(row.peerBreakdown, null);

  // And no peer name reaches the subject through the comparison by any route.
  const json = JSON.stringify(res.body.data.comparison);
  assert.ok(!json.includes('Ada'));
  assert.ok(!json.includes('Sam'));
  assert.ok(!json.includes(String(s.peerA._id)));
  assert.ok(!json.includes(String(s.peerB._id)));
});

test('the MANAGER gets the per-peer breakdown with names', async (t) => {
  const s = released();
  t.after(s.h.restore);

  const res = capture();
  await appraisals.getAppraisal(
    asUser(s.mgr, { params: { id: String(s.appraisalId) } }), res, (e) => { throw e; }
  );

  const [row] = res.body.data.comparison;
  assert.strictEqual(row.peerBreakdown.length, 2);
  const names = row.peerBreakdown.map((b) => b.reviewer.firstName).sort();
  assert.deepStrictEqual(names, ['Ada', 'Sam']);
});

test('a single peer response suppresses the mean for the subject', async (t) => {
  const s = released();
  t.after(s.h.restore);
  // Drop one peer's submission back to pending.
  const peerRow = s.h.db.feedback.find((f) => String(f.reviewer) === String(s.peerB._id));
  peerRow.status = 'pending';

  const res = capture();
  await appraisals.getAppraisal(
    asUser(s.emp, { params: { id: String(s.appraisalId) } }), res, (e) => { throw e; }
  );

  const [row] = res.body.data.comparison;
  assert.deepStrictEqual(row.peer, { mean: null, n: 1, suppressed: true });
});

test('the comparison is absent from every pre-release 403', async (t) => {
  const s = released();
  t.after(s.h.restore);
  const a = s.h.db.appraisals[0];
  a.state = 'collecting';

  const res = capture();
  await appraisals.getAppraisal(
    asUser(s.emp, { params: { id: String(s.appraisalId) } }), res, (e) => { throw e; }
  );

  // canRead for the subject is released|acknowledged ONLY. Nothing in Phase 3
  // relaxes it.
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.body.data, undefined);
});

// Task 12 put `askOf` on every row BEYOND the design's original shape, so the
// UI can render "not asked" rather than an empty bar that reads as "nobody
// responded". Nothing else pins that key, so a refactor of buildComparison
// could quietly drop it and only the UI would notice — in production.
test('each row carries askOf, and text questions are excluded', async (t) => {
  const s = released();
  t.after(s.h.restore);
  // A text question alongside the rating one: it has no mean and must not
  // produce a row.
  s.h.db.templates[0].sections[0].questions.push({
    _id: oid(), type: 'text', label: 'Anything else?', askOf: ['manager'],
  });

  const res = capture();
  await appraisals.getAppraisal(
    asUser(s.mgr, { params: { id: String(s.appraisalId) } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.body.data.comparison.length, 1);
  assert.deepStrictEqual(res.body.data.comparison[0].askOf, ['self', 'manager', 'peer']);
});
