// server/__tests__/appraisalDeletedEmployees.test.js
//
// Deleting an employee is a SOFT delete (`User.status = 'deleted'`) — the row
// stays so that history, payroll and audit trails survive. Every other module
// that reads people already filters on it (attendance, time off, shifts, the
// employee list itself); the appraisal module did not, so a person removed
// from the tenant went on appearing in cycle rosters, state counts, cycle
// reports and a manager's team list forever, and HR was still told to chase
// them for feedback they can no longer sign in to give.
//
// The rule asserted here is one line: an appraisal whose SUBJECT has been
// deleted is not part of the tenant's appraisal picture any more, and a
// deleted person is never an outstanding action. Nothing is destroyed —
// restoring the employee restores every row below.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const cycles = require('../controllers/appraisalCycle.controller');
const appraisals = require('../controllers/appraisal.controller');

const oid = () => new mongoose.Types.ObjectId();
const fail = (err) => { throw err; };

/**
 * One cycle, two appraisals: a live employee and one whose account has been
 * deleted. Both are otherwise identical, so any endpoint that returns two rows
 * is not filtering at all.
 */
function scenario({ state = 'collecting' } = {}) {
  const tenant = oid();
  const hr = { _id: oid(), tenant, role: 'tenant_owner' };
  const mgr = { _id: oid(), tenant, role: 'tenant_staff', firstName: 'Kofi', lastName: 'A', email: 'kofi@x.io' };
  const live = { _id: oid(), tenant, role: 'tenant_staff', firstName: 'Grace', lastName: 'H', email: 'grace@x.io' };
  const gone = { _id: oid(), tenant, role: 'tenant_staff', status: 'deleted', firstName: 'Bob', lastName: 'M', email: 'bob@x.io' };
  const cycleId = oid();
  const liveAppraisal = oid();
  const goneAppraisal = oid();

  const h = makeHarness({
    users: [hr, mgr, live, gone],
    cycle: { _id: cycleId, tenant, name: 'H2', status: 'collecting' },
  });

  h.db.appraisals.push(
    {
      _id: liveAppraisal, tenant, cycle: cycleId, employee: live._id,
      manager: mgr._id, state, reviewerIds: [live._id, mgr._id], peerNominations: [],
      finalRating: 4,
    },
    {
      _id: goneAppraisal, tenant, cycle: cycleId, employee: gone._id,
      manager: mgr._id, state, reviewerIds: [gone._id, mgr._id], peerNominations: [],
      finalRating: 4,
    }
  );
  for (const [appraisal, reviewer] of [[liveAppraisal, live._id], [goneAppraisal, gone._id]]) {
    h.db.feedback.push(
      { _id: oid(), tenant, appraisal, cycle: cycleId, reviewer, kind: 'self', status: 'pending' },
      { _id: oid(), tenant, appraisal, cycle: cycleId, reviewer: mgr._id, kind: 'manager', status: 'pending' }
    );
  }

  return { tenant, hr, mgr, live, gone, cycleId, liveAppraisal, goneAppraisal, h };
}

test('the cycle roster drops an appraisal whose employee has been deleted', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const res = capture();
  await cycles.cycleRoster(asUser(s.hr, { params: { id: String(s.cycleId) } }), res, fail);

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(
    res.body.data.rows.map((r) => r.employee.firstName),
    ['Grace']
  );
  // `total` drives the pager. Counting a row the page never shows leaves HR on
  // a second page that renders empty.
  assert.strictEqual(res.body.data.total, 1);
});

test('the cycle state counts drop a deleted employee', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const res = capture();
  await cycles.cycleProgress(asUser(s.hr, { params: { id: String(s.cycleId) } }), res, fail);

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body.data.byState, { collecting: 1 });
  // Feedback is narrowed through the appraisals it belongs to, so the
  // completion bar must not count a deleted person's outstanding rows either.
  assert.strictEqual(res.body.data.feedbackTotal, 2);
});

test('the cycles list counts drop a deleted employee', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const res = capture();
  await cycles.listCycles(asUser(s.hr), res, fail);

  assert.strictEqual(res.status, 200);
  const row = res.body.data.find((c) => String(c._id) === String(s.cycleId));
  assert.deepStrictEqual(row.byState, { collecting: 1 });
});

test('the cycle report drops a deleted employee', async (t) => {
  const s = scenario({ state: 'released' });
  t.after(s.h.restore);

  const res = capture();
  await cycles.cycleReport(asUser(s.hr, { params: { id: String(s.cycleId) } }), res, fail);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.releasedCount, 1);
  assert.deepStrictEqual(res.body.data.finalRatingHistogram, [{ rating: 4, count: 1 }]);
});

test('the stalled list drops a deleted employee', async (t) => {
  const s = scenario({ state: 'nominating' });
  t.after(s.h.restore);
  s.h.db.cycles[0].nominationDeadline = new Date(Date.now() - 86400000);

  const res = capture();
  await cycles.cycleProgress(asUser(s.hr, { params: { id: String(s.cycleId) } }), res, fail);

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(
    res.body.data.stalled.map((r) => r.employee.firstName),
    ['Grace']
  );
});

test("a manager's team list drops a deleted report", async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const res = capture();
  await appraisals.teamAppraisals(asUser(s.mgr), res, fail);

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(
    res.body.data.map((r) => r.employee.firstName),
    ['Grace']
  );
});

test("a reviewer's review requests drop work for a deleted subject", async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const res = capture();
  await appraisals.myReviewRequests(asUser(s.mgr), res, fail);

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(
    res.body.data.map((r) => r.appraisal.employee.firstName),
    ['Grace']
  );
});

test('a deleted reviewer is never an outstanding action on a live appraisal', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  // The live employee's own 360 carries an approved peer who has since left.
  // Their feedback row can never be submitted, so naming them sends HR after
  // somebody who cannot act — and leaves the row looking permanently stalled.
  s.h.db.appraisals[0].reviewerIds.push(s.gone._id);
  s.h.db.appraisals[0].peerNominations.push({
    user: s.gone._id, proposedBy: s.live._id, status: 'approved',
  });
  s.h.db.feedback.push({
    _id: oid(), tenant: s.tenant, appraisal: s.liveAppraisal, cycle: s.cycleId,
    reviewer: s.gone._id, kind: 'peer', status: 'pending',
  });

  const res = capture();
  await cycles.cycleRoster(asUser(s.hr, { params: { id: String(s.cycleId) } }), res, fail);

  assert.strictEqual(res.status, 200);
  const [row] = res.body.data.rows;
  assert.deepStrictEqual(
    row.outstanding.map((o) => o.target.firstName).sort(),
    ['Grace', 'Kofi']
  );
});

test('nothing is filtered when the tenant has deleted nobody', async (t) => {
  const s = scenario();
  t.after(s.h.restore);
  s.h.db.users.find((u) => String(u._id) === String(s.gone._id)).status = 'active';

  const res = capture();
  await cycles.cycleRoster(asUser(s.hr, { params: { id: String(s.cycleId) } }), res, fail);

  assert.strictEqual(res.body.data.total, 2);
});

test('HR cannot nudge a reviewer who has been removed from the tenant', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  s.h.db.appraisals[0].reviewerIds.push(s.gone._id);
  s.h.db.appraisals[0].peerNominations.push({
    user: s.gone._id, proposedBy: s.live._id, status: 'approved',
  });
  s.h.db.feedback.push({
    _id: oid(), tenant: s.tenant, appraisal: s.liveAppraisal, cycle: s.cycleId,
    reviewer: s.gone._id, kind: 'peer', status: 'pending',
  });

  const res = capture();
  await appraisals.nudge(
    asUser(s.hr, {
      params: { id: String(s.liveAppraisal) },
      body: { target: String(s.gone._id), reason: 'feedback', channel: 'app' },
    }),
    res,
    fail
  );

  assert.strictEqual(res.status, 400);
  assert.match(res.body.message, /no longer works here/);

  // The same nudge at a live reviewer still goes through — the guard is about
  // who the target is, not about the endpoint.
  const ok = capture();
  await appraisals.nudge(
    asUser(s.hr, {
      params: { id: String(s.liveAppraisal) },
      body: { target: String(s.live._id), reason: 'feedback', channel: 'app' },
    }),
    ok,
    fail
  );
  assert.strictEqual(ok.status, 201);
});
