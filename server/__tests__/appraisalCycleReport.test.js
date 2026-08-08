// server/__tests__/appraisalCycleReport.test.js — Phase 3 Task 11
//
// GET /api/appraisal-cycles/:id/report. HR-only by mount point (cycleRouter is
// .use(tenantAdminOrSuperAdmin)-gated); the payload deliberately carries no
// reviewer identity at all, only counts and means.
//
// Everything here exercises plain find()s with in-memory reduction — no
// aggregation pipeline — because the harness only models a narrow
// [{$match},{$group}] shape and a richer pipeline would look tested without
// being tested.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const oid = () => new mongoose.Types.ObjectId();
const cycles = require('../controllers/appraisalCycle.controller');

const q1 = oid(); // rating, scaleMax 5
const q2 = oid(); // text — has no mean, must never appear
const q3 = oid(); // rating, scaleMax 10 — a DIFFERENT scale from q1

const boom = (e) => { throw e; };

function reportScenario({ pinTemplate = true } = {}) {
  const tenant = oid();
  const hr = { _id: oid(), tenant, role: 'tenant_owner' };
  const cycleId = oid();
  const templateId = oid();
  const h = makeHarness({
    users: [hr],
    template: {
      _id: templateId, tenant, family: oid(), version: 1, isLatest: true, name: 'T',
      sections: [{
        title: 'Performance',
        questions: [
          { _id: q1, type: 'rating', label: 'Quality of work', scaleMax: 5, askOf: ['self', 'manager', 'peer'] },
          { _id: q2, type: 'text', label: 'What went well?', askOf: ['self', 'manager', 'peer'] },
          { _id: q3, type: 'rating', label: 'Impact', scaleMax: 10, askOf: ['self', 'manager', 'peer'] },
        ],
      }],
    },
    cycle: {
      _id: cycleId, tenant, name: 'H2', status: 'collecting',
      ...(pinTemplate ? { template: templateId } : { template: undefined }),
    },
  });
  return { tenant, hr, cycleId, templateId, h };
}

const run = (s, user = s.hr, params = { id: String(s.cycleId) }) => {
  const res = capture();
  return cycles
    .cycleReport(asUser(user, { params }), res, boom)
    .then(() => res);
};

const mkAppraisal = (s, state, finalRating, tenant = s.tenant) => ({
  _id: oid(), tenant, cycle: s.cycleId, employee: oid(), manager: oid(),
  state, finalRating, reviewerIds: [], peerNominations: [],
});

const mkFeedback = (s, appraisalId, kind, answers, status = 'submitted', tenant = s.tenant) => ({
  _id: oid(), tenant, appraisal: appraisalId, cycle: s.cycleId,
  reviewer: oid(), kind, status, answers,
});

test('report is empty but valid before anything is released', async (t) => {
  const s = reportScenario();
  t.after(s.h.restore);

  const res = await run(s);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.releasedCount, 0);
  assert.deepStrictEqual(res.body.data.finalRatingHistogram, []);
  // Rating questions still listed, so the UI renders a real empty state rather
  // than a blank panel that looks broken. No divide-by-zero, no NaN.
  assert.strictEqual(res.body.data.questionStats.length, 2);
  const first = res.body.data.questionStats[0];
  assert.deepStrictEqual(first.self, { mean: null, n: 0 });
  assert.deepStrictEqual(first.manager, { mean: null, n: 0 });
  assert.deepStrictEqual(first.peer, { mean: null, n: 0 });
});

test('report histograms final ratings across released appraisals', async (t) => {
  const s = reportScenario();
  t.after(s.h.restore);
  s.h.db.appraisals.push(
    mkAppraisal(s, 'released', 5),
    mkAppraisal(s, 'released', 4),
    mkAppraisal(s, 'acknowledged', 4),
    mkAppraisal(s, 'collecting', undefined), // not released — must not count
  );

  const res = await run(s);

  assert.strictEqual(res.body.data.releasedCount, 3,
    'acknowledged is released-and-signed, still released');
  assert.deepStrictEqual(res.body.data.finalRatingHistogram, [
    { rating: 4, count: 2 },
    { rating: 5, count: 1 },
  ]);
});

test('a released appraisal with no final rating counts as released but not in the histogram', async (t) => {
  const s = reportScenario();
  t.after(s.h.restore);
  s.h.db.appraisals.push(
    mkAppraisal(s, 'released', 3),
    mkAppraisal(s, 'released', undefined),
  );

  const res = await run(s);

  // Deliberate: releasedCount answers "how many are out", the histogram answers
  // "how did the scores land". The histogram counts therefore need not sum to
  // releasedCount, and inventing a 0 bucket would fabricate a bad review.
  assert.strictEqual(res.body.data.releasedCount, 2);
  assert.deepStrictEqual(res.body.data.finalRatingHistogram, [{ rating: 3, count: 1 }]);
});

test('report means are split per reviewer kind, text questions excluded', async (t) => {
  const s = reportScenario();
  t.after(s.h.restore);
  const appraisalId = oid();
  s.h.db.appraisals.push({ ...mkAppraisal(s, 'released', 4), _id: appraisalId });
  const ans = (rating) => [{ questionId: q1, rating }, { questionId: q2, text: 'prose' }];
  s.h.db.feedback.push(
    mkFeedback(s, appraisalId, 'self', ans(5)),
    mkFeedback(s, appraisalId, 'manager', ans(3)),
    mkFeedback(s, appraisalId, 'peer', ans(4)),
    mkFeedback(s, appraisalId, 'peer', ans(2)),
    mkFeedback(s, appraisalId, 'peer', ans(1), 'pending'), // not submitted
  );

  const res = await run(s);

  const stat = res.body.data.questionStats.find((x) => String(x.questionId) === String(q1));
  assert.strictEqual(stat.label, 'Quality of work');
  assert.strictEqual(stat.scaleMax, 5);
  assert.deepStrictEqual(stat.self, { mean: 5, n: 1 });
  assert.deepStrictEqual(stat.manager, { mean: 3, n: 1 });
  assert.deepStrictEqual(stat.peer, { mean: 3, n: 2 });

  // A single blended mean over self, manager and peer has no interpretation —
  // it moves when the peer count changes. Text questions carry no rating.
  assert.strictEqual(
    res.body.data.questionStats.find((x) => String(x.questionId) === String(q2)),
    undefined,
  );
});

test('questions on different scales are never pooled or rescaled', async (t) => {
  const s = reportScenario();
  t.after(s.h.restore);
  const appraisalId = oid();
  s.h.db.appraisals.push({ ...mkAppraisal(s, 'released', 4), _id: appraisalId });
  s.h.db.feedback.push(
    mkFeedback(s, appraisalId, 'self', [
      { questionId: q1, rating: 4 },   // out of 5
      { questionId: q3, rating: 9 },   // out of 10
    ]),
    mkFeedback(s, appraisalId, 'manager', [
      { questionId: q1, rating: 3 },
      { questionId: q3, rating: 6 },
    ]),
  );

  const res = await run(s);
  const byId = new Map(res.body.data.questionStats.map((x) => [String(x.questionId), x]));

  // Raw, per question, on that question's own scale — no normalisation to a
  // common 0..1 and above all no mean across q1 and q3, which would be
  // arithmetic on two different units.
  assert.deepStrictEqual(byId.get(String(q1)).self, { mean: 4, n: 1 });
  assert.deepStrictEqual(byId.get(String(q3)).self, { mean: 9, n: 1 });
  assert.strictEqual(byId.get(String(q1)).scaleMax, 5);
  assert.strictEqual(byId.get(String(q3)).scaleMax, 10);
  assert.deepStrictEqual(byId.get(String(q3)).manager, { mean: 6, n: 1 });
});

test('an answer for a question the pinned template does not contain is dropped, not fabricated', async (t) => {
  const s = reportScenario();
  t.after(s.h.restore);
  const appraisalId = oid();
  const ghost = oid();
  s.h.db.appraisals.push({ ...mkAppraisal(s, 'released', 4), _id: appraisalId });
  s.h.db.feedback.push(
    mkFeedback(s, appraisalId, 'self', [{ questionId: ghost, rating: 5 }, { questionId: q1, rating: 2 }]),
  );

  const res = await run(s);

  assert.strictEqual(res.body.data.questionStats.length, 2, 'only the template rating questions');
  assert.strictEqual(
    res.body.data.questionStats.find((x) => String(x.questionId) === String(ghost)),
    undefined,
  );
  const stat = res.body.data.questionStats.find((x) => String(x.questionId) === String(q1));
  assert.deepStrictEqual(stat.self, { mean: 2, n: 1 });
});

test('a cycle with no pinned template reports no question stats rather than borrowing another template', async (t) => {
  const s = reportScenario({ pinTemplate: false });
  t.after(s.h.restore);
  s.h.db.appraisals.push(mkAppraisal(s, 'released', 5));

  const res = await run(s);

  // {_id: undefined} is stripped out of a mongoose filter, so a naive
  // findOne({_id: cycle.template, tenant}) would return an ARBITRARY template
  // in the tenant and label historical answers with a form this cycle never
  // used. The counts that do not depend on the template still report.
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.releasedCount, 1);
  assert.deepStrictEqual(res.body.data.questionStats, []);
});

test('small n is reported, not suppressed — this endpoint is HR-only', async (t) => {
  const s = reportScenario();
  t.after(s.h.restore);
  const appraisalId = oid();
  s.h.db.appraisals.push({ ...mkAppraisal(s, 'released', 4), _id: appraisalId });
  s.h.db.feedback.push(mkFeedback(s, appraisalId, 'peer', [{ questionId: q1, rating: 2 }]));

  const res = await run(s);
  const stat = res.body.data.questionStats.find((x) => String(x.questionId) === String(q1));

  // Deliberate, and the opposite of buildComparison's PEER_RELEASE_MIN gate:
  // that one protects the SUBJECT, who must not be able to back out a single
  // peer's score. This report is mounted on the admin-gated cycleRouter, and
  // HR can already open every appraisal in its own tenant, so suppressing here
  // would hide nothing it cannot read one click away — while making the report
  // silently wrong. `n` is always returned so the UI can caveat it.
  assert.deepStrictEqual(stat.peer, { mean: 2, n: 1 });
  // No reviewer identity anywhere in the payload, at any n.
  assert.strictEqual(JSON.stringify(res.body.data).includes('reviewer'), false);
});

test('report 404s for a foreign-tenant cycle', async (t) => {
  const s = reportScenario();
  t.after(s.h.restore);
  const stranger = { _id: oid(), tenant: oid(), role: 'tenant_admin' };

  const res = await run(s, stranger);
  assert.strictEqual(res.status, 404);
});

test('another tenant\'s rows on the same cycle id never reach the numbers', async (t) => {
  const s = reportScenario();
  t.after(s.h.restore);
  const other = oid();
  const mine = oid();
  const theirs = oid();
  s.h.db.appraisals.push(
    { ...mkAppraisal(s, 'released', 5), _id: mine },
    { ...mkAppraisal(s, 'released', 1, other), _id: theirs },
  );
  s.h.db.feedback.push(
    mkFeedback(s, mine, 'self', [{ questionId: q1, rating: 5 }]),
    mkFeedback(s, theirs, 'self', [{ questionId: q1, rating: 1 }], 'submitted', other),
  );

  const res = await run(s);

  assert.strictEqual(res.body.data.releasedCount, 1);
  assert.deepStrictEqual(res.body.data.finalRatingHistogram, [{ rating: 5, count: 1 }]);
  const stat = res.body.data.questionStats.find((x) => String(x.questionId) === String(q1));
  assert.deepStrictEqual(stat.self, { mean: 5, n: 1 });
});

test('a malformed cycle id is a 400, not the 500 a CastError becomes', async (t) => {
  const s = reportScenario();
  t.after(s.h.restore);

  const res = await run(s, s.hr, { id: 'not-an-objectid' });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.message, /Invalid cycle id/);
});

test('a request with no tenant context is a 403, never an unscoped query', async (t) => {
  const s = reportScenario();
  t.after(s.h.restore);
  s.h.db.appraisals.push(mkAppraisal(s, 'released', 5));

  const res = capture();
  await cycles.cycleReport(
    { user: s.hr, tenant: undefined, params: { id: String(s.cycleId) }, body: {} },
    res, boom,
  );

  // {tenant: undefined} is stripped out of a mongoose filter, which would make
  // this read every row in the DATABASE, not merely every row in a tenant.
  assert.strictEqual(res.status, 403);
});
