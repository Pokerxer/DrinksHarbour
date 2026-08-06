// server/__tests__/appraisalNudgeInApp.test.js
//
// Phase 3 Task 10: surface a nudge in-app on GET /api/appraisals/my and
// GET /api/appraisals/my/reviews.
//
// This sits directly on the module's privacy boundary. `myAppraisals` is the
// SUBJECT's own view, and REVIEWER_IDENTITY_FIELDS is a DENY-list, so anything
// newly attached to those rows is exposed by default. Task 9 kept nudges in
// their own collection precisely so a peer's id is structurally absent here;
// the rule this file pins down is that the nudge line may tell the caller
// *they* are being chased and nothing whatsoever about anybody else.
//
// The key itself is load-bearing: Task 9's permanent guard asserts the
// subject's payload contains no occurrence of the string 'nudge' at all when
// the nudge was aimed at a peer. So the `nudge` key is present only when there
// IS one for this caller — never as a `nudge: null` placeholder on every row.

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const AppraisalNudge = require('../models/AppraisalNudge');
const appraisals = require('../controllers/appraisal.controller');

const oid = () => new mongoose.Types.ObjectId();

function setup({ state = 'collecting', reviewerIds, peerNominations = [] } = {}) {
  const tenant = oid();
  const emp = { _id: oid(), tenant, role: 'tenant_staff', status: 'active' };
  const mgr = { _id: oid(), tenant, role: 'tenant_staff', status: 'active' };
  const other = { _id: oid(), tenant, role: 'tenant_staff', status: 'active' };
  const cycleId = oid();
  const appraisalId = oid();

  const h = makeHarness({
    users: [emp, mgr, other],
    cycle: { _id: cycleId, tenant, name: 'H2', status: 'collecting' },
  });

  h.db.appraisals.push({
    _id: appraisalId,
    tenant,
    cycle: cycleId,
    employee: emp._id,
    manager: mgr._id,
    state,
    reviewerIds: reviewerIds || [emp._id, mgr._id],
    peerNominations,
  });

  return { tenant, emp, mgr, other, cycleId, appraisalId, h };
}

const pushFeedback = (s, over = {}) => {
  const row = {
    _id: oid(),
    tenant: s.tenant,
    appraisal: s.appraisalId,
    cycle: s.cycleId,
    reviewer: s.emp._id,
    kind: 'self',
    status: 'pending',
    ...over,
  };
  s.h.db.feedback.push(row);
  return row;
};

const pushNudge = (s, over = {}) => {
  const row = {
    _id: oid(),
    tenant: s.tenant,
    appraisal: s.appraisalId,
    cycle: s.cycleId,
    target: s.emp._id,
    reason: 'feedback',
    channel: 'app',
    sentBy: s.mgr._id,
    sentAt: new Date('2026-08-04T09:00:00Z'),
    ...over,
  };
  s.h.db.nudges.push(row);
  return row;
};

const callMy = async (fn, user) => {
  const res = capture();
  await fn(asUser(user), res, (e) => { throw e; });
  return res;
};

// ── the reviewer's own view ─────────────────────────────────────────────────

test('my/reviews carries the nudge for the caller as target', async (t) => {
  const s = setup();
  t.after(s.h.restore);
  const fb = pushFeedback(s);
  pushNudge(s);

  const res = await callMy(appraisals.myReviewRequests, s.emp);

  assert.strictEqual(res.status, 200);
  const row = res.body.data.find((r) => String(r._id) === String(fb._id));
  assert.ok(row.nudge, 'the reminder must reach the person it was sent to');
  assert.strictEqual(row.nudge.reason, 'feedback');
  assert.strictEqual(
    new Date(row.nudge.sentAt).toISOString(), '2026-08-04T09:00:00.000Z',
  );
});

test('a nudge aimed at someone else is never shown', async (t) => {
  const s = setup();
  t.after(s.h.restore);
  pushFeedback(s);
  pushNudge(s, { target: s.other._id });

  const res = await callMy(appraisals.myReviewRequests, s.emp);

  assert.ok(!res.body.data[0].nudge,
    "a nudge is scoped to its target — showing another person's reminder tells you they were chased");
  assert.ok(!JSON.stringify(res.body).includes(String(s.other._id)),
    "the other reviewer's id must not leak through the nudge join");
});

test('the newest nudge wins when the same person was chased twice', async (t) => {
  const s = setup();
  t.after(s.h.restore);
  pushFeedback(s);
  pushNudge(s, { sentAt: new Date('2026-08-01T09:00:00Z') });
  pushNudge(s, { sentAt: new Date('2026-08-04T09:00:00Z') });

  const res = await callMy(appraisals.myReviewRequests, s.emp);

  assert.strictEqual(
    new Date(res.body.data[0].nudge.sentAt).toISOString(), '2026-08-04T09:00:00.000Z',
  );
});

test('a nudge for work the caller has already done is not still shown', async (t) => {
  // The spec surfaces a nudge "only while that action is still outstanding".
  // A submitted feedback row is done; nagging about it is noise.
  const s = setup();
  t.after(s.h.restore);
  pushFeedback(s, { status: 'submitted', submittedAt: new Date() });
  pushNudge(s);

  const res = await callMy(appraisals.myReviewRequests, s.emp);

  assert.strictEqual(res.body.data.length, 1);
  assert.ok(!res.body.data[0].nudge, 'a chased-and-done row must not keep the reminder');
});

test('my/reviews is tenant-scoped: a same-id nudge in another tenant is invisible', async (t) => {
  const s = setup();
  t.after(s.h.restore);
  pushFeedback(s);
  pushNudge(s, { tenant: oid() });

  const res = await callMy(appraisals.myReviewRequests, s.emp);

  assert.ok(!res.body.data[0].nudge, 'the nudge join must carry the tenant clause');
});

// ── the subject's own view ──────────────────────────────────────────────────

test('my appraisals carries the nudge for the subject', async (t) => {
  const s = setup({ state: 'released' });
  t.after(s.h.restore);
  pushNudge(s, { reason: 'acknowledge' });

  const res = await callMy(appraisals.myAppraisals, s.emp);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data[0].nudge.reason, 'acknowledge');
});

test('my appraisals is tenant-scoped', async (t) => {
  const s = setup({ state: 'released' });
  t.after(s.h.restore);
  pushNudge(s, { reason: 'acknowledge', tenant: oid() });

  const res = await callMy(appraisals.myAppraisals, s.emp);

  assert.ok(!res.body.data[0].nudge);
});

test('an acknowledged appraisal no longer shows its acknowledge reminder', async (t) => {
  const s = setup({ state: 'acknowledged' });
  t.after(s.h.restore);
  pushNudge(s, { reason: 'acknowledge' });

  const res = await callMy(appraisals.myAppraisals, s.emp);

  assert.ok(!res.body.data[0].nudge);
});

test('the nudge line adds no reviewer identity to a subject payload', async (t) => {
  const peer = oid();
  const s = setup({ state: 'released' });
  t.after(s.h.restore);
  s.h.db.appraisals[0].reviewerIds = [s.emp._id, s.mgr._id, peer];
  s.h.db.appraisals[0].peerNominations = [
    { user: peer, proposedBy: s.emp._id, status: 'approved' },
  ];
  pushNudge(s, { reason: 'acknowledge' });

  const res = await callMy(appraisals.myAppraisals, s.emp);

  const json = JSON.stringify(res.body);
  assert.ok(!json.includes('peerNominations'), 'sanitizeOwnAppraisalRow still strips it');
  assert.ok(!json.includes('reviewerIds'));
  assert.ok(!json.includes(String(peer)), "the peer's id must never reach the subject");
  // The nudge carries only sentAt + reason — never sentBy, never target.
  assert.strictEqual(res.body.data[0].nudge.sentBy, undefined);
  assert.strictEqual(res.body.data[0].nudge.target, undefined);
  assert.deepStrictEqual(
    Object.keys(res.body.data[0].nudge).sort(), ['reason', 'sentAt'],
  );
});

test("a peer's nudge leaves no 'nudge' key at all on the subject's rows", async (t) => {
  // Task 9's permanent guard asserts the subject payload contains no
  // occurrence of the string 'nudge'. A `nudge: null` placeholder on every row
  // would break it, so absence is expressed by an absent key.
  const s = setup({ state: 'collecting' });
  t.after(s.h.restore);
  pushNudge(s, { target: s.other._id });

  const res = await callMy(appraisals.myAppraisals, s.emp);

  const json = JSON.stringify(res.body);
  assert.ok(!json.includes('nudge'), 'no nudge-borne field on an unnudged subject payload');
  assert.ok(!json.includes(String(s.other._id)));
});

// ── shape of the join ───────────────────────────────────────────────────────

test('the nudge join is one batched query, not one per row', async (t) => {
  const s = setup({ state: 'released' });
  t.after(s.h.restore);

  // Three more appraisals for the same subject, each with its own nudge.
  const extras = [oid(), oid(), oid()];
  for (const id of extras) {
    s.h.db.appraisals.push({
      _id: id,
      tenant: s.tenant,
      cycle: s.cycleId,
      employee: s.emp._id,
      manager: s.mgr._id,
      state: 'released',
      reviewerIds: [s.emp._id],
      peerNominations: [],
    });
    pushNudge(s, { appraisal: id, reason: 'acknowledge' });
  }
  pushNudge(s, { reason: 'acknowledge' });

  const stubbed = AppraisalNudge.find;
  let calls = 0;
  AppraisalNudge.find = function countedFind(...args) {
    calls += 1;
    return stubbed.apply(this, args);
  };

  const res = await callMy(appraisals.myAppraisals, s.emp);

  assert.strictEqual(res.body.data.length, 4);
  assert.ok(res.body.data.every((r) => r.nudge && r.nudge.reason === 'acknowledge'));
  assert.strictEqual(calls, 1, '4 rows must cost 1 nudge query, not 4');
});

test('no appraisals means no nudge query at all', async (t) => {
  const s = setup();
  t.after(s.h.restore);
  s.h.db.appraisals.length = 0;

  const stubbed = AppraisalNudge.find;
  let calls = 0;
  AppraisalNudge.find = function countedFind(...args) {
    calls += 1;
    return stubbed.apply(this, args);
  };

  const res = await callMy(appraisals.myAppraisals, s.emp);

  assert.deepStrictEqual(res.body.data, []);
  assert.strictEqual(calls, 0);
});

test('the nudge lookup filters on target and tenant, never on undefined', async (t) => {
  // Mongoose strips `undefined` out of a filter, so `{tenant, target: undefined}`
  // silently becomes "every nudge in the tenant". Two real bugs already.
  const s = setup({ state: 'released' });
  t.after(s.h.restore);
  pushNudge(s, { reason: 'acknowledge' });

  const stubbed = AppraisalNudge.find;
  const seen = [];
  AppraisalNudge.find = function spyFind(filter, ...rest) {
    seen.push(filter);
    return stubbed.call(this, filter, ...rest);
  };

  await callMy(appraisals.myAppraisals, s.emp);

  assert.strictEqual(seen.length, 1);
  const filter = seen[0];
  for (const key of ['tenant', 'target', 'appraisal']) {
    assert.ok(filter[key] !== undefined, `${key} must be a real value, not undefined`);
  }
  assert.strictEqual(String(filter.tenant), String(s.tenant));
  assert.strictEqual(String(filter.target), String(s.emp._id));
  assert.ok(Array.isArray(filter.appraisal.$in), 'batched with $in');
});
