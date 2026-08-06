// server/__tests__/appraisalCycleRoster.test.js
//
// Phase 3 Task 8: GET /api/appraisal-cycles/:id/roster.
//
// The roster is the ONE appraisal payload that names peer reviewers to a
// caller who is not the manager: outstandingActionsFor returns peer reviewer
// ids in the 'collecting' state, because chasing a peer means naming them.
// The module's deliberate asymmetry is that the manager and HR see peer
// names and only the employee (the subject) does not — so this endpoint must
// be unreachable by a subject. That is enforced by which router it is mounted
// on, and the last two tests here are the regression guard on exactly that.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const oid = () => new mongoose.Types.ObjectId();
const cycles = require('../controllers/appraisalCycle.controller');

function scenario() {
  const tenant = oid();
  const hr = { _id: oid(), tenant, role: 'tenant_admin' };
  const emp = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Grace', lastName: 'H', email: 'grace@x.io' };
  const mgr = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Kofi', lastName: 'A', email: 'kofi@x.io' };
  const peer = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Ada', lastName: 'L', email: 'ada@x.io' };
  const cycleId = oid();
  const appraisalId = oid();
  return { tenant, hr, emp, mgr, peer, cycleId, appraisalId };
}

test('roster reports per-appraisal completion and who is outstanding', async (t) => {
  const s = scenario();
  const h = makeHarness({
    users: [s.hr, s.emp, s.mgr, s.peer],
    cycle: { _id: s.cycleId, tenant: s.tenant, name: 'H2', status: 'collecting' },
  });
  t.after(h.restore);

  h.db.appraisals.push({
    _id: s.appraisalId, tenant: s.tenant, cycle: s.cycleId,
    employee: s.emp._id, manager: s.mgr._id, state: 'collecting',
    reviewerIds: [s.emp._id, s.mgr._id, s.peer._id],
    peerNominations: [{ user: s.peer._id, proposedBy: s.emp._id, status: 'approved' }],
  });
  h.db.feedback.push(
    { _id: oid(), tenant: s.tenant, appraisal: s.appraisalId, cycle: s.cycleId, reviewer: s.emp._id, kind: 'self', status: 'pending' },
    { _id: oid(), tenant: s.tenant, appraisal: s.appraisalId, cycle: s.cycleId, reviewer: s.mgr._id, kind: 'manager', status: 'submitted' },
    { _id: oid(), tenant: s.tenant, appraisal: s.appraisalId, cycle: s.cycleId, reviewer: s.peer._id, kind: 'peer', status: 'pending' }
  );

  const res = capture();
  await cycles.cycleRoster(
    asUser(s.hr, { params: { id: String(s.cycleId) } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.rows.length, 1);
  const [row] = res.body.data.rows;
  assert.strictEqual(row.state, 'collecting');
  assert.strictEqual(row.employee.firstName, 'Grace');
  assert.strictEqual(row.manager.firstName, 'Kofi');
  assert.strictEqual(row.self.status, 'pending');
  assert.strictEqual(row.mgr.status, 'submitted');
  assert.deepStrictEqual(row.peers, { approved: 1, submitted: 0, declined: 0, pending: 1 });
  assert.deepStrictEqual(
    row.outstanding.map((o) => o.reason).sort(),
    ['feedback', 'feedback']
  );
  assert.strictEqual(row.lastNudge, null);

  // HR (and only HR / the manager) may see who the outstanding peer is —
  // an id alone is unchaseable, which is the whole point of the roster.
  const names = row.outstanding.map((o) => o.target.firstName).sort();
  assert.deepStrictEqual(names, ['Ada', 'Grace']);
});

test('roster groups feedback per appraisal — one row never inherits another row\'s reviewers', async (t) => {
  const s = scenario();
  const empB = { _id: oid(), tenant: s.tenant, role: 'tenant_staff', status: 'active', firstName: 'Zed', lastName: 'Z', email: 'zed@x.io' };
  const mgrB = { _id: oid(), tenant: s.tenant, role: 'tenant_staff', status: 'active', firstName: 'Yaw', lastName: 'B', email: 'yaw@x.io' };
  const h = makeHarness({
    users: [s.hr, s.emp, s.mgr, s.peer, empB, mgrB],
    cycle: { _id: s.cycleId, tenant: s.tenant, name: 'H2', status: 'collecting' },
  });
  t.after(h.restore);

  const aId = s.appraisalId;
  const bId = oid();

  h.db.appraisals.push(
    {
      _id: aId, tenant: s.tenant, cycle: s.cycleId,
      employee: s.emp._id, manager: s.mgr._id, state: 'collecting',
      reviewerIds: [s.emp._id, s.mgr._id, s.peer._id],
      peerNominations: [{ user: s.peer._id, proposedBy: s.emp._id, status: 'approved' }],
    },
    {
      // Everything on B is done, so B is waiting on its OWN manager to
      // summarise. If the feedback grouping slipped, A's pending peer row
      // would leak in here and B would read as 'feedback' instead.
      _id: bId, tenant: s.tenant, cycle: s.cycleId,
      employee: empB._id, manager: mgrB._id, state: 'collecting',
      reviewerIds: [empB._id, mgrB._id],
      peerNominations: [],
    }
  );
  h.db.feedback.push(
    { _id: oid(), tenant: s.tenant, appraisal: aId, cycle: s.cycleId, reviewer: s.emp._id, kind: 'self', status: 'submitted' },
    { _id: oid(), tenant: s.tenant, appraisal: aId, cycle: s.cycleId, reviewer: s.mgr._id, kind: 'manager', status: 'submitted' },
    { _id: oid(), tenant: s.tenant, appraisal: aId, cycle: s.cycleId, reviewer: s.peer._id, kind: 'peer', status: 'pending' },
    { _id: oid(), tenant: s.tenant, appraisal: bId, cycle: s.cycleId, reviewer: empB._id, kind: 'self', status: 'submitted' },
    { _id: oid(), tenant: s.tenant, appraisal: bId, cycle: s.cycleId, reviewer: mgrB._id, kind: 'manager', status: 'submitted' }
  );

  const res = capture();
  await cycles.cycleRoster(asUser(s.hr, { params: { id: String(s.cycleId) } }), res, (e) => { throw e; });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.total, 2);
  const rows = res.body.data.rows;
  const rowA = rows.find((r) => String(r._id) === String(aId));
  const rowB = rows.find((r) => String(r._id) === String(bId));

  assert.deepStrictEqual(rowA.outstanding.map((o) => o.reason), ['feedback']);
  assert.strictEqual(String(rowA.outstanding[0].target._id), String(s.peer._id));
  assert.deepStrictEqual(rowA.peers, { approved: 1, submitted: 0, declined: 0, pending: 1 });

  assert.deepStrictEqual(rowB.outstanding.map((o) => o.reason), ['summarise']);
  assert.strictEqual(String(rowB.outstanding[0].target._id), String(mgrB._id));
  assert.deepStrictEqual(rowB.peers, { approved: 0, submitted: 0, declined: 0, pending: 0 });
  assert.strictEqual(rowB.self.status, 'submitted');
  assert.strictEqual(rowB.mgr.status, 'submitted');
});

test('roster does not leak another tenant\'s appraisals or feedback', async (t) => {
  const s = scenario();
  const other = oid();
  const h = makeHarness({
    users: [s.hr, s.emp, s.mgr],
    cycle: { _id: s.cycleId, tenant: s.tenant, name: 'H2', status: 'collecting' },
  });
  t.after(h.restore);

  h.db.appraisals.push(
    {
      _id: s.appraisalId, tenant: s.tenant, cycle: s.cycleId,
      employee: s.emp._id, manager: s.mgr._id, state: 'collecting',
      reviewerIds: [], peerNominations: [],
    },
    {
      // Same cycle id, different tenant. Only a tenant clause keeps it out.
      _id: oid(), tenant: other, cycle: s.cycleId,
      employee: oid(), manager: oid(), state: 'collecting',
      reviewerIds: [], peerNominations: [],
    }
  );
  h.db.feedback.push({
    _id: oid(), tenant: other, appraisal: s.appraisalId, cycle: s.cycleId,
    reviewer: oid(), kind: 'peer', status: 'pending',
  });

  const res = capture();
  await cycles.cycleRoster(asUser(s.hr, { params: { id: String(s.cycleId) } }), res, (e) => { throw e; });

  assert.strictEqual(res.body.data.total, 1);
  assert.strictEqual(res.body.data.rows.length, 1);
  // The foreign-tenant feedback row must not be counted against our appraisal.
  assert.deepStrictEqual(res.body.data.rows[0].peers, { approved: 0, submitted: 0, declined: 0, pending: 0 });
  assert.deepStrictEqual(res.body.data.rows[0].outstanding.map((o) => o.reason), ['summarise']);
});

test('roster 404s for an unknown or foreign-tenant cycle', async (t) => {
  const s = scenario();
  const h = makeHarness({ users: [s.hr] });
  t.after(h.restore);

  const res = capture();
  await cycles.cycleRoster(
    asUser(s.hr, { params: { id: String(oid()) } }), res, (e) => { throw e; }
  );
  assert.strictEqual(res.status, 404);
});

test('roster 400s on a malformed cycle id', async (t) => {
  const s = scenario();
  const h = makeHarness({ users: [s.hr] });
  t.after(h.restore);

  const res = capture();
  await cycles.cycleRoster(asUser(s.hr, { params: { id: 'not-an-id' } }), res, (e) => { throw e; });
  assert.strictEqual(res.status, 400);
});

test('roster counts approved peers via countApprovedPeers, not the raw array', async (t) => {
  const s = scenario();
  const h = makeHarness({
    users: [s.hr, s.emp, s.mgr, s.peer],
    cycle: { _id: s.cycleId, tenant: s.tenant, name: 'H2', status: 'collecting' },
  });
  t.after(h.restore);

  h.db.appraisals.push({
    _id: s.appraisalId, tenant: s.tenant, cycle: s.cycleId,
    employee: s.emp._id, manager: s.mgr._id, state: 'collecting',
    reviewerIds: [s.emp._id, s.mgr._id],
    peerNominations: [
      { user: s.peer._id, proposedBy: s.emp._id, status: 'approved' },
      { user: oid(), proposedBy: s.emp._id, status: 'rejected' },
      { user: oid(), proposedBy: s.emp._id, status: 'proposed' },
    ],
  });

  const res = capture();
  await cycles.cycleRoster(asUser(s.hr, { params: { id: String(s.cycleId) } }), res, (e) => { throw e; });

  // A rejected or still-proposed nominee is not an approved peer.
  assert.strictEqual(res.body.data.rows[0].peers.approved, 1);
});

test('roster paginates', async (t) => {
  const s = scenario();
  const h = makeHarness({
    users: [s.hr, s.emp, s.mgr],
    cycle: { _id: s.cycleId, tenant: s.tenant, name: 'H2', status: 'collecting' },
  });
  t.after(h.restore);

  for (let i = 0; i < 5; i += 1) {
    h.db.appraisals.push({
      _id: oid(), tenant: s.tenant, cycle: s.cycleId,
      employee: s.emp._id, manager: s.mgr._id, state: 'collecting',
      reviewerIds: [], peerNominations: [],
    });
  }

  const req = asUser(s.hr, { params: { id: String(s.cycleId) } });
  req.query = { page: '2', limit: '2' };

  const res = capture();
  await cycles.cycleRoster(req, res, (e) => { throw e; });

  assert.strictEqual(res.body.data.rows.length, 2);
  assert.strictEqual(res.body.data.total, 5);
  assert.strictEqual(res.body.data.page, 2);
  assert.strictEqual(res.body.data.limit, 2);
});

// ---------------------------------------------------------------------------
// The privacy gate. These two tests are the reason the roster is safe: the
// handler itself has no role check (like every sibling on cycleRouter), so
// the mount point IS the boundary.

function routeLayers(router, path) {
  return (router.stack || []).filter((l) => l.route && l.route.path === path);
}

test('roster is mounted on the HR-gated cycleRouter, never on the staff-reachable appraisalRouter', () => {
  const { cycleRouter, appraisalRouter } = require('../routes/appraisal.routes');
  const { tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');

  const onCycle = routeLayers(cycleRouter, '/:id/roster');
  assert.strictEqual(onCycle.length, 1, 'roster must be registered exactly once on cycleRouter');
  assert.ok(onCycle[0].route.methods.get, 'roster must be a GET');

  // appraisalRouter is deliberately NOT admin-gated (staff must reach their
  // own record). A roster route there would hand a subject the peer roster
  // of their own 360.
  assert.strictEqual(routeLayers(appraisalRouter, '/:id/roster').length, 0);

  const gateIndex = cycleRouter.stack.findIndex((l) => l.handle === tenantAdminOrSuperAdmin);
  const rosterIndex = cycleRouter.stack.findIndex((l) => l.route && l.route.path === '/:id/roster');
  assert.ok(gateIndex !== -1, 'cycleRouter must use tenantAdminOrSuperAdmin');
  assert.ok(gateIndex < rosterIndex, 'the admin gate must run before the roster route');
});

test('a non-HR tenant_staff caller is refused before the roster handler runs', () => {
  const { tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');
  const tenant = oid();
  const staff = { _id: oid(), tenant, role: 'tenant_staff' };
  const req = { user: staff, tenant: { _id: tenant }, params: { id: String(oid()) } };

  let nextCalled = false;
  assert.throws(
    () => tenantAdminOrSuperAdmin(req, {}, () => { nextCalled = true; }),
    /Tenant admin or super admin access required/
  );
  assert.strictEqual(nextCalled, false, 'the gate must not fall through to the handler');

  // tenant_owner and tenant_admin are the HR roles that DO get through.
  for (const role of ['tenant_owner', 'tenant_admin']) {
    let ok = false;
    tenantAdminOrSuperAdmin(
      { user: { _id: oid(), tenant, role }, tenant: { _id: tenant } }, {}, () => { ok = true; }
    );
    assert.ok(ok, `${role} must reach the roster`);
  }
});
