// server/__tests__/appraisalTemplatePinning.test.js — Phase 3 Task 3.
//
// A cycle stores the template FAMILY HR picked; `cycle.template` is the
// concrete version, re-resolved from that family exactly once at launch. The
// three properties under test are: an edit made while the cycle is still
// draft is picked up, a launched cycle is frozen against every later edit,
// and a family from another tenant never resolves at all.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const oid = () => new mongoose.Types.ObjectId();
const cycles = require('../controllers/appraisalCycle.controller');

function hrUser(tenant) {
  return { _id: oid(), tenant, role: 'tenant_admin' };
}

test('createCycle stores both the family and the current latest version', async (t) => {
  const tenant = oid();
  const hr = hrUser(tenant);
  const family = oid();
  const v1 = { _id: oid(), tenant, family, version: 1, isLatest: true, name: 'Eng 360' };
  const h = makeHarness({ users: [hr], template: v1 });
  t.after(h.restore);

  const res = capture();
  await cycles.createCycle(
    asUser(hr, { body: { name: '2026 H2', templateFamily: String(family) } }),
    res,
    (e) => { throw e; }
  );

  assert.strictEqual(res.status, 201);
  assert.strictEqual(String(res.body.data.templateFamily), String(family));
  assert.strictEqual(String(res.body.data.template), String(v1._id));
});

test('createCycle rejects a template family from another tenant', async (t) => {
  const tenant = oid();
  const hr = hrUser(tenant);
  const foreign = { _id: oid(), tenant: oid(), family: oid(), version: 1, isLatest: true };
  const h = makeHarness({ users: [hr], template: foreign });
  t.after(h.restore);

  const res = capture();
  await cycles.createCycle(
    asUser(hr, { body: { name: 'X', templateFamily: String(foreign.family) } }),
    res,
    (e) => { throw e; }
  );

  // 400, not 404: the family id is caller-supplied input to a create, not a
  // resource being addressed. It must never resolve across the tenant line.
  assert.strictEqual(res.status, 400);
  assert.strictEqual(h.db.cycles.length, 0);
});

test('createCycle rejects an archived template family', async (t) => {
  const tenant = oid();
  const hr = hrUser(tenant);
  const family = oid();
  const archived = { _id: oid(), tenant, family, version: 1, isLatest: true, isArchived: true };
  const h = makeHarness({ users: [hr], template: archived });
  t.after(h.restore);

  const res = capture();
  await cycles.createCycle(
    asUser(hr, { body: { name: 'X', templateFamily: String(family) } }),
    res,
    (e) => { throw e; }
  );

  // Archived means "do not offer for new cycles". Falling back to the default
  // here would silently launch HR onto a form they did not pick.
  assert.strictEqual(res.status, 400);
  assert.strictEqual(h.db.cycles.length, 0);
});

test('createCycle with no templateFamily falls back to the tenant default', async (t) => {
  const tenant = oid();
  const hr = hrUser(tenant);
  const h = makeHarness({ users: [hr] });
  t.after(h.restore);

  const res = capture();
  await cycles.createCycle(asUser(hr, { body: { name: 'Fallback' } }), res, (e) => { throw e; });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(h.db.templates.length, 1);
  assert.strictEqual(h.db.templates[0].isDefault, true);
  assert.strictEqual(String(res.body.data.template), String(h.db.templates[0]._id));
  // The fallback must record its family too, or launch has nothing to re-resolve.
  assert.strictEqual(
    String(res.body.data.templateFamily),
    String(h.db.templates[0].family)
  );
});

test('launchCycle re-resolves the template to the family latest', async (t) => {
  const tenant = oid();
  const hr = hrUser(tenant);
  const family = oid();
  const v1 = { _id: oid(), tenant, family, version: 1, isLatest: false, name: 'T' };
  const employee = { _id: oid(), tenant, role: 'tenant_staff', status: 'active' };
  const manager = { _id: oid(), tenant, role: 'tenant_staff', status: 'active' };
  employee.employeeProfile = { work: { manager: manager._id } };

  const cycleId = oid();
  const h = makeHarness({
    users: [hr, employee, manager],
    template: v1,
    cycle: { _id: cycleId, tenant, name: 'C', templateFamily: family, template: v1._id, status: 'draft' },
  });
  t.after(h.restore);

  // A v2 was forked after the cycle was created but before it launched.
  const v2 = { _id: oid(), tenant, family, version: 2, isLatest: true, name: 'T', sections: [] };
  h.db.templates.push(v2);

  const res = capture();
  await cycles.launchCycle(
    asUser(hr, { params: { id: String(cycleId) }, body: { employeeIds: [String(employee._id)] } }),
    res,
    (e) => { throw e; }
  );

  assert.strictEqual(res.status, 200);
  const stored = h.db.cycles.find((c) => String(c._id) === String(cycleId));
  assert.strictEqual(String(stored.template), String(v2._id),
    'an edit made while the cycle was still draft must be picked up at launch');
});

test('launchCycle does NOT re-pin a cycle that has already launched', async (t) => {
  const tenant = oid();
  const hr = hrUser(tenant);
  const family = oid();
  const v1 = { _id: oid(), tenant, family, version: 1, isLatest: false };
  const cycleId = oid();
  const h = makeHarness({
    users: [hr],
    template: v1,
    cycle: {
      _id: cycleId, tenant, name: 'C', templateFamily: family, template: v1._id,
      status: 'collecting', launchedAt: new Date('2026-01-01'),
    },
  });
  t.after(h.restore);

  const v2 = { _id: oid(), tenant, family, version: 2, isLatest: true };
  h.db.templates.push(v2);

  const res = capture();
  await cycles.launchCycle(
    asUser(hr, { params: { id: String(cycleId) }, body: { employeeIds: [] } }),
    res,
    (e) => { throw e; }
  );

  const stored = h.db.cycles.find((c) => String(c._id) === String(cycleId));
  assert.strictEqual(String(stored.template), String(v1._id),
    're-launching an already-launched cycle must not move it onto a newer form');
});

test('launchCycle will not re-pin across the tenant line', async (t) => {
  const tenant = oid();
  const hr = hrUser(tenant);
  const family = oid();
  const v1 = { _id: oid(), tenant, family, version: 1, isLatest: false };
  const cycleId = oid();
  const h = makeHarness({
    users: [hr],
    template: v1,
    cycle: { _id: cycleId, tenant, name: 'C', templateFamily: family, template: v1._id, status: 'draft' },
  });
  t.after(h.restore);

  // Same family id, another tenant's document. Family ids are ObjectIds, so
  // this is not a realistic collision — but the re-resolve query is the one
  // place a cycle's template is chosen by something other than its own _id,
  // and it must still be tenant-scoped.
  const foreignLatest = { _id: oid(), tenant: oid(), family, version: 9, isLatest: true };
  h.db.templates.push(foreignLatest);

  const res = capture();
  await cycles.launchCycle(
    asUser(hr, { params: { id: String(cycleId) }, body: { employeeIds: [] } }),
    res,
    (e) => { throw e; }
  );

  const stored = h.db.cycles.find((c) => String(c._id) === String(cycleId));
  assert.notStrictEqual(String(stored.template), String(foreignLatest._id),
    'the launch re-resolve must never cross the tenant line');
  assert.strictEqual(String(stored.template), String(v1._id));
});
