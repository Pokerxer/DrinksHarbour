// server/__tests__/appraisalNudge.test.js
//
// Phase 3 Task 9: POST /api/appraisals/:id/nudge.
//
// The endpoint's whole security story is that `target` must be genuinely
// outstanding per outstandingActionsFor — that is what stops it being used to
// probe who is on an appraisal, and it is what these tests exist to hold down.
// The other half of the story is structural and is asserted at the bottom: a
// nudge lives in its OWN collection, so a peer's id is never written onto the
// Appraisal document the subject reads.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const oid = () => new mongoose.Types.ObjectId();
const appraisals = require('../controllers/appraisal.controller');
const emailService = require('../services/email.service');
// Lives on the controller, not appraisal.helpers.js: that file was frozen at
// the end of Task 7, so the constant sits beside its only consumer.
const { NUDGE_MIN_INTERVAL_HOURS } = appraisals;

function scenario({ state = 'collecting', withPeer = false } = {}) {
  const tenant = oid();
  const hr = { _id: oid(), tenant, role: 'tenant_admin', firstName: 'Ada' };
  const emp = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Grace', email: 'grace@wyncity.test' };
  const mgr = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Kofi', email: 'kofi@wyncity.test' };
  const peer = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Zara', email: 'zara@wyncity.test' };
  const cycleId = oid();
  const appraisalId = oid();

  const users = withPeer ? [hr, emp, mgr, peer] : [hr, emp, mgr];
  const h = makeHarness({
    users,
    cycle: {
      _id: cycleId, tenant, name: 'H2', status: 'collecting',
      feedbackDeadline: new Date('2026-09-30T00:00:00Z'),
    },
  });
  h.db.appraisals.push({
    _id: appraisalId,
    tenant,
    cycle: cycleId,
    employee: emp._id,
    manager: mgr._id,
    state,
    reviewerIds: withPeer ? [emp._id, mgr._id, peer._id] : [emp._id, mgr._id],
    peerNominations: withPeer
      ? [{ _id: oid(), user: peer._id, status: 'approved' }]
      : [],
  });
  h.db.feedback.push(
    { _id: oid(), tenant, appraisal: appraisalId, cycle: cycleId, reviewer: emp._id, kind: 'self', status: 'pending' },
    { _id: oid(), tenant, appraisal: appraisalId, cycle: cycleId, reviewer: mgr._id, kind: 'manager', status: 'submitted' }
  );
  if (withPeer) {
    h.db.feedback.push({
      _id: oid(), tenant, appraisal: appraisalId, cycle: cycleId,
      reviewer: peer._id, kind: 'peer', status: 'pending',
    });
  }
  return { tenant, hr, emp, mgr, peer, cycleId, appraisalId, h };
}

const nudgeReq = (s, user, body) =>
  asUser(user, { params: { id: String(s.appraisalId) }, body });

async function run(s, user, body) {
  const res = capture();
  await appraisals.nudge(nudgeReq(s, user, body), res, (e) => { throw e; });
  return res;
}

// ── the happy path ──────────────────────────────────────────────────────────
test('an HR nudge writes a nudge row for an outstanding target', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const res = await run(s, s.hr, { target: String(s.emp._id), reason: 'feedback', channel: 'app' });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(s.h.db.nudges.length, 1);
  const n = s.h.db.nudges[0];
  assert.strictEqual(String(n.target), String(s.emp._id));
  assert.strictEqual(String(n.appraisal), String(s.appraisalId));
  assert.strictEqual(String(n.cycle), String(s.cycleId));
  assert.strictEqual(String(n.tenant), String(s.tenant));
  assert.strictEqual(n.reason, 'feedback');
  assert.strictEqual(n.channel, 'app');
  assert.strictEqual(String(n.sentBy), String(s.hr._id));
  assert.ok(n.sentAt instanceof Date);
});

// ── the probe guard ─────────────────────────────────────────────────────────
test('a nudge naming a target who is NOT outstanding is rejected', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  // The manager already submitted; nothing is owed by them at this state.
  const res = await run(s, s.hr, { target: String(s.mgr._id), reason: 'feedback', channel: 'app' });

  // 400, not 404: this is also what stops the endpoint being used to probe
  // who is on an appraisal — an arbitrary user id gets the same answer as a
  // real reviewer who simply owes nothing.
  assert.strictEqual(res.status, 400);
  assert.strictEqual(s.h.db.nudges.length, 0);
});

test('a stranger who is on no appraisal gets the same 400, not a 404', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const nobody = oid();
  const res = await run(s, s.hr, { target: String(nobody), reason: 'feedback', channel: 'app' });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(s.h.db.nudges.length, 0);
});

test('the reason must match the outstanding action, not merely the person', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  // The employee owes 'feedback' here, not 'acknowledge'.
  const res = await run(s, s.hr, { target: String(s.emp._id), reason: 'acknowledge', channel: 'app' });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(s.h.db.nudges.length, 0);
});

// A cancelled appraisal can still carry `pending` feedback rows that closeCycle
// never expired (see appraisal.helpers.js). outstandingActionsFor returns [] for
// it, so every target is refused — deliberately. Chasing someone for work on a
// cancelled appraisal is exactly the reminder nobody should receive.
test('nobody can be nudged on a cancelled appraisal, pending rows notwithstanding', async (t) => {
  const s = scenario({ state: 'cancelled' });
  t.after(s.h.restore);

  const res = await run(s, s.hr, { target: String(s.emp._id), reason: 'feedback', channel: 'app' });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(s.h.db.nudges.length, 0);
});

// ── the gate ────────────────────────────────────────────────────────────────
test('a stranger cannot nudge — only canManageCycle', async (t) => {
  const s = scenario();
  t.after(s.h.restore);
  const outsider = { _id: oid(), tenant: s.tenant, role: 'tenant_staff' };
  s.h.db.users.push(outsider);

  const res = await run(s, outsider, { target: String(s.emp._id), reason: 'feedback', channel: 'app' });

  assert.strictEqual(res.status, 403);
  assert.strictEqual(s.h.db.nudges.length, 0);
});

test('the manager cannot nudge in Phase 3 — HR only', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const res = await run(s, s.mgr, { target: String(s.emp._id), reason: 'feedback', channel: 'app' });

  // Deliberate scope decision, not an oversight: the gate is canManageCycle.
  assert.strictEqual(res.status, 403);
  assert.strictEqual(s.h.db.nudges.length, 0);
});

test('the subject cannot nudge their own reviewers', async (t) => {
  const s = scenario({ withPeer: true });
  t.after(s.h.restore);

  // The interesting one: were this permitted, the 400/201 split would tell the
  // subject whether a given colleague is a reviewer on their own 360.
  const res = await run(s, s.emp, { target: String(s.peer._id), reason: 'feedback', channel: 'app' });

  assert.strictEqual(res.status, 403);
  assert.strictEqual(s.h.db.nudges.length, 0);
});

test('a nudge for an appraisal in another tenant 404s', async (t) => {
  const s = scenario();
  t.after(s.h.restore);
  const stranger = { _id: oid(), tenant: oid(), role: 'tenant_admin' };

  const res = await run(s, stranger, { target: String(s.emp._id), reason: 'feedback', channel: 'app' });

  assert.strictEqual(res.status, 404);
  assert.strictEqual(s.h.db.nudges.length, 0);
});

// ── malformed input ─────────────────────────────────────────────────────────
test('a malformed appraisal id is a 400, not the 500 a CastError becomes', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const res = capture();
  await appraisals.nudge(
    asUser(s.hr, { params: { id: 'not-an-id' }, body: { target: String(s.emp._id), reason: 'feedback' } }),
    res, (e) => { throw e; }
  );
  assert.strictEqual(res.status, 400);
});

test('a malformed target id is a 400, not the 500 a CastError becomes', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const res = await run(s, s.hr, { target: 'not-an-id', reason: 'feedback', channel: 'app' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(s.h.db.nudges.length, 0);
});

test('an unknown channel is refused rather than silently downgraded', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const res = await run(s, s.hr, { target: String(s.emp._id), reason: 'feedback', channel: 'sms' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(s.h.db.nudges.length, 0);
});

test('a missing tenant context is refused before any query runs', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  // Mongoose strips `undefined` out of a filter, so {tenant: undefined} would
  // become {} and match every appraisal in the database.
  const req = nudgeReq(s, s.hr, { target: String(s.emp._id), reason: 'feedback' });
  req.tenant = {};
  const res = capture();
  await appraisals.nudge(req, res, (e) => { throw e; });
  assert.strictEqual(res.status, 403);
});

// ── the throttle ────────────────────────────────────────────────────────────
test('a repeat nudge inside the throttle window is refused with 429', async (t) => {
  const s = scenario();
  t.after(s.h.restore);
  const body = { target: String(s.emp._id), reason: 'feedback', channel: 'app' };

  const first = await run(s, s.hr, body);
  assert.strictEqual(first.status, 201);

  const second = await run(s, s.hr, body);
  assert.strictEqual(second.status, 429);
  assert.strictEqual(second.body.code, 'NUDGE_TOO_SOON');
  assert.ok(second.body.retryAfter, 'must tell the caller when they can retry');
  assert.strictEqual(s.h.db.nudges.length, 1, 'a double-click must not send twice');
});

test('the throttle is per (target, reason), not per appraisal', async (t) => {
  const s = scenario({ withPeer: true });
  t.after(s.h.restore);

  const first = await run(s, s.hr, { target: String(s.emp._id), reason: 'feedback', channel: 'app' });
  assert.strictEqual(first.status, 201);

  // A different person on the same appraisal is a different reminder.
  const second = await run(s, s.hr, { target: String(s.peer._id), reason: 'feedback', channel: 'app' });
  assert.strictEqual(second.status, 201);
  assert.strictEqual(s.h.db.nudges.length, 2);
});

test('a nudge older than the window no longer throttles', async (t) => {
  const s = scenario();
  t.after(s.h.restore);
  const body = { target: String(s.emp._id), reason: 'feedback', channel: 'app' };

  const first = await run(s, s.hr, body);
  assert.strictEqual(first.status, 201);
  // Age the stored row past the window rather than waiting 12 hours.
  s.h.db.nudges[0].sentAt = new Date(Date.now() - (NUDGE_MIN_INTERVAL_HOURS + 1) * 3600 * 1000);

  const second = await run(s, s.hr, body);
  assert.strictEqual(second.status, 201);
  assert.strictEqual(s.h.db.nudges.length, 2);
});

test('force overrides the throttle', async (t) => {
  const s = scenario();
  t.after(s.h.restore);
  const body = { target: String(s.emp._id), reason: 'feedback', channel: 'app' };

  await run(s, s.hr, body);
  const second = await run(s, s.hr, { ...body, force: true });

  assert.strictEqual(second.status, 201);
  assert.strictEqual(s.h.db.nudges.length, 2, 'repeat nudges are kept as history');
});

// ── email ───────────────────────────────────────────────────────────────────
test('a THROWN email failure is reported as a failure and stored as channel app', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const real = emailService.sendAppraisalNudgeEmail;
  emailService.sendAppraisalNudgeEmail = async () => { throw new Error('535 Authentication failed'); };
  t.after(() => { emailService.sendAppraisalNudgeEmail = real; });

  const res = await run(s, s.hr, { target: String(s.emp._id), reason: 'feedback', channel: 'email' });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.emailSent, false);
  assert.ok(res.body.data.emailError, 'the failure must reach the caller');
  assert.strictEqual(s.h.db.nudges[0].channel, 'app');
  assert.ok(s.h.db.nudges[0].emailError);
});

test('a RETURNED {success:false} is a failure too — sendEmail never throws', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  // email.service.js's sendEmail catches everything and returns
  // {success:false, error}. A nudge that reports success for an email nobody
  // received is worse than no nudge, because HR stops chasing — this repo has
  // already shipped a mailer that fell back to dev mode on a 535 and logged a
  // tick, and every order confirmation for that period went silently unsent.
  const real = emailService.sendAppraisalNudgeEmail;
  emailService.sendAppraisalNudgeEmail = async () => ({ success: false, error: 'Mail transport unavailable' });
  t.after(() => { emailService.sendAppraisalNudgeEmail = real; });

  const res = await run(s, s.hr, { target: String(s.emp._id), reason: 'feedback', channel: 'email' });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.emailSent, false);
  assert.strictEqual(res.body.data.emailError, 'Mail transport unavailable');
  assert.strictEqual(s.h.db.nudges[0].channel, 'app');
});

test('a successful email is recorded as channel email', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const real = emailService.sendAppraisalNudgeEmail;
  let called = null;
  emailService.sendAppraisalNudgeEmail = async (args) => { called = args; return { success: true }; };
  t.after(() => { emailService.sendAppraisalNudgeEmail = real; });

  const res = await run(s, s.hr, { target: String(s.emp._id), reason: 'feedback', channel: 'email' });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.emailSent, true);
  assert.strictEqual(s.h.db.nudges[0].channel, 'email');
  assert.strictEqual(s.h.db.nudges[0].emailError, undefined);
  assert.strictEqual(called.to, 'grace@wyncity.test');
  assert.strictEqual(called.cycleName, 'H2');
  assert.strictEqual(called.reason, 'feedback');
});

test('a peer nudge email never names another reviewer', async (t) => {
  const s = scenario({ withPeer: true });
  t.after(s.h.restore);

  const real = emailService.sendAppraisalNudgeEmail;
  let called = null;
  emailService.sendAppraisalNudgeEmail = async (args) => { called = args; return { success: true }; };
  t.after(() => { emailService.sendAppraisalNudgeEmail = real; });

  await run(s, s.hr, { target: String(s.peer._id), reason: 'feedback', channel: 'email' });

  assert.strictEqual(called.to, 'zara@wyncity.test');
  // The peer already knows whose 360 they were asked to review, so naming the
  // subject is safe. Naming a FELLOW reviewer never is.
  const payload = JSON.stringify(called);
  assert.ok(!payload.includes(String(s.emp._id)), 'no subject id on the wire');
  assert.ok(!payload.includes('Kofi'), 'must not name the manager');
  assert.ok(!payload.includes(String(s.mgr._id)), 'must not carry the manager id');
});

test('a target with no email address is a recorded failure, not a silent success', async (t) => {
  const s = scenario();
  t.after(s.h.restore);
  delete s.h.db.users.find((u) => String(u._id) === String(s.emp._id)).email;

  const res = await run(s, s.hr, { target: String(s.emp._id), reason: 'feedback', channel: 'email' });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.emailSent, false);
  assert.ok(res.body.data.emailError);
  assert.strictEqual(s.h.db.nudges[0].channel, 'app');
});

// ── the privacy boundary ────────────────────────────────────────────────────
test("a nudge leaves no reviewer identity on the subject's own payload", async (t) => {
  const s = scenario({ withPeer: true });
  t.after(s.h.restore);

  const nudged = await run(s, s.hr, { target: String(s.peer._id), reason: 'feedback', channel: 'app' });
  assert.strictEqual(nudged.status, 201);

  // Nudges live in their own collection precisely so the peer's id is
  // STRUCTURALLY absent from the document the subject reads — not merely
  // deny-listed out of it after the fact.
  const stored = s.h.db.appraisals.find((a) => String(a._id) === String(s.appraisalId));
  assert.ok(!('nudges' in stored), 'a nudge must never be written onto the Appraisal document');
  assert.ok(!('lastNudge' in stored));

  const res = capture();
  await appraisals.myAppraisals(asUser(s.emp), res, (e) => { throw e; });
  assert.strictEqual(res.status, 200);

  const payload = JSON.stringify(res.body);
  assert.ok(!payload.includes(String(s.peer._id)), "the peer's id must not reach the subject");
  assert.ok(!payload.includes('nudge'), 'no nudge-borne field on the subject payload');
  assert.ok(!payload.includes('reviewerIds'));
  assert.ok(!payload.includes('peerNominations'));
});
