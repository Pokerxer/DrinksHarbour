// server/__tests__/appraisalTemplateBackfill.test.js
//
// Tests for the pure planner behind scripts/backfill-appraisal-template-versions.js.
// Deliberately DB-free: the whole point of separating `planTemplateBackfill`
// from the script's I/O is that the migration's decisions can be proved against
// in-memory fixtures without ever opening a connection to a live cluster.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { planTemplateBackfill } = require('../scripts/backfill-appraisal-template-versions');

const oid = () => new mongoose.Types.ObjectId();

/**
 * Apply a plan to its fixture rows the way the script's updateOne loop would,
 * so invariants can be asserted against the POST-migration collection rather
 * than against the plan in isolation.
 */
function applyPlan(templates, plan) {
  const byId = new Map(plan.map((p) => [String(p._id), p.set]));
  return templates.map((t) => ({ ...t, ...(byId.get(String(t._id)) || {}) }));
}

/**
 * Every unique index AppraisalTemplate declares, re-implemented over plain
 * objects. A plan that violates one of these does not "look wrong" — it throws
 * E11000 the moment it is applied to Atlas.
 */
function assertIndexInvariants(rows) {
  const latestPerFamily = new Map();
  const versionKeys = new Set();
  const defaultsPerTenant = new Map();
  const tenantsPerFamily = new Map();

  for (const r of rows) {
    assert.ok(r.family, `template ${r._id} still has no family — required:true would reject any .save()`);
    assert.ok(Number.isInteger(r.version) && r.version >= 1, `template ${r._id} has a bad version`);

    const tenantKey = String(r.tenant);
    const familyKey = `${tenantKey}|${String(r.family)}`;

    // {tenant, family, version} unique
    const vKey = `${familyKey}|${r.version}`;
    assert.ok(!versionKeys.has(vKey), `duplicate {tenant,family,version} for ${r._id}`);
    versionKeys.add(vKey);

    // {tenant, family} unique, partial on isLatest:true
    if (r.isLatest === true) {
      assert.ok(!latestPerFamily.has(familyKey), `family ${familyKey} has two isLatest rows`);
      latestPerFamily.set(familyKey, String(r._id));
    }

    // {tenant, isDefault} unique, partial on {isDefault:true, isLatest:true}
    if (r.isDefault === true && r.isLatest === true) {
      assert.ok(!defaultsPerTenant.has(tenantKey), `tenant ${tenantKey} has two default templates`);
      defaultsPerTenant.set(tenantKey, String(r._id));
    }

    // Families are tenant-owned identities; sharing one across tenants would
    // let one tenant's edit fork into another tenant's history.
    const owners = tenantsPerFamily.get(String(r.family)) || new Set();
    owners.add(tenantKey);
    tenantsPerFamily.set(String(r.family), owners);
  }

  for (const [family, owners] of tenantsPerFamily) {
    assert.strictEqual(owners.size, 1, `family ${family} is shared across ${owners.size} tenants`);
  }

  // Every family must retain exactly one latest, not merely at most one.
  const families = new Set(rows.map((r) => `${String(r.tenant)}|${String(r.family)}`));
  for (const f of families) {
    assert.ok(latestPerFamily.has(f), `family ${f} has no isLatest row — nothing resolves at cycle create`);
  }
}

test('a template with no family becomes v1, latest, family = its own _id', () => {
  const t1 = { _id: oid(), tenant: oid(), isArchived: false, createdAt: new Date('2026-01-01') };
  const plan = planTemplateBackfill([t1]);

  assert.strictEqual(plan.length, 1);
  assert.strictEqual(String(plan[0]._id), String(t1._id));
  assert.strictEqual(String(plan[0].set.family), String(t1._id));
  assert.strictEqual(plan[0].set.version, 1);
  assert.strictEqual(plan[0].set.isLatest, true);
});

test('the oldest non-archived template per tenant becomes the default', () => {
  const tenant = oid();
  const older = { _id: oid(), tenant, isArchived: false, createdAt: new Date('2026-01-01') };
  const newer = { _id: oid(), tenant, isArchived: false, createdAt: new Date('2026-03-01') };

  // Fed newest-first on purpose: the script must not depend on input order.
  const plan = planTemplateBackfill([newer, older]);
  const byId = new Map(plan.map((p) => [String(p._id), p.set]));

  assert.strictEqual(byId.get(String(older._id)).isDefault, true,
    'the oldest is the one the old findOne-based ensureDefaultTemplate would have returned');
  assert.strictEqual(byId.get(String(newer._id)).isDefault, false);
});

test('an archived template is never made the default', () => {
  const tenant = oid();
  const archived = { _id: oid(), tenant, isArchived: true, createdAt: new Date('2026-01-01') };
  const live = { _id: oid(), tenant, isArchived: false, createdAt: new Date('2026-02-01') };

  const plan = planTemplateBackfill([archived, live]);
  const byId = new Map(plan.map((p) => [String(p._id), p.set]));

  assert.strictEqual(byId.get(String(archived._id)).isDefault, false);
  assert.strictEqual(byId.get(String(live._id)).isDefault, true);
});

test('a tenant whose templates are all archived gets no default at all', () => {
  const tenant = oid();
  const rows = [
    { _id: oid(), tenant, isArchived: true, createdAt: new Date('2026-01-01') },
    { _id: oid(), tenant, isArchived: true, createdAt: new Date('2026-02-01') },
  ];
  const plan = planTemplateBackfill(rows);

  assert.strictEqual(plan.length, 2);
  assert.strictEqual(plan.filter((p) => p.set.isDefault).length, 0,
    'ensureDefaultTemplate seeds a fresh default later; promoting an archived form would resurrect it');
  assertIndexInvariants(applyPlan(rows, plan));
});

test('each tenant gets its own default', () => {
  const a = oid();
  const b = oid();
  const ta = { _id: oid(), tenant: a, isArchived: false, createdAt: new Date('2026-01-01') };
  const tb = { _id: oid(), tenant: b, isArchived: false, createdAt: new Date('2026-01-02') };

  const plan = planTemplateBackfill([ta, tb]);
  assert.strictEqual(plan.filter((p) => p.set.isDefault).length, 2);
  assertIndexInvariants(applyPlan([ta, tb], plan));
});

test('family ids are never shared across tenants', () => {
  const a = oid();
  const b = oid();
  const rows = [
    { _id: oid(), tenant: a, isArchived: false, createdAt: new Date('2026-01-01') },
    { _id: oid(), tenant: a, isArchived: false, createdAt: new Date('2026-01-05') },
    { _id: oid(), tenant: b, isArchived: false, createdAt: new Date('2026-01-01') },
  ];
  const plan = planTemplateBackfill(rows);
  const families = plan.map((p) => String(p.set.family));

  assert.strictEqual(new Set(families).size, families.length, 'each legacy row is its own family');
  assertIndexInvariants(applyPlan(rows, plan));
});

test('a template that already has a family is left alone — the script is idempotent', () => {
  const done = {
    _id: oid(), tenant: oid(), family: oid(), version: 2, isLatest: true,
    isDefault: false, isArchived: false, createdAt: new Date(),
  };
  assert.deepStrictEqual(planTemplateBackfill([done]), []);
});

test('re-planning the already-migrated collection produces no second set of changes', () => {
  const tenantA = oid();
  const tenantB = oid();
  const rows = [
    { _id: oid(), tenant: tenantA, isArchived: false, createdAt: new Date('2026-01-01') },
    { _id: oid(), tenant: tenantA, isArchived: false, createdAt: new Date('2026-02-01') },
    { _id: oid(), tenant: tenantA, isArchived: true, createdAt: new Date('2025-12-01') },
    { _id: oid(), tenant: tenantB, isArchived: false, createdAt: new Date('2026-03-01') },
  ];

  const firstPlan = planTemplateBackfill(rows);
  assert.strictEqual(firstPlan.length, 4);

  const migrated = applyPlan(rows, firstPlan);
  assertIndexInvariants(migrated);

  const secondPlan = planTemplateBackfill(migrated);
  assert.deepStrictEqual(secondPlan, [], 'a second run must be a no-op');
});

test('the planner is deterministic when createdAt is missing or tied', () => {
  const tenant = oid();
  const rows = [
    { _id: oid(), tenant, isArchived: false },
    { _id: oid(), tenant, isArchived: false },
    { _id: oid(), tenant, isArchived: false, createdAt: new Date('2026-01-01') },
  ];

  const forwards = planTemplateBackfill(rows);
  const backwards = planTemplateBackfill([...rows].reverse());
  const defaultOf = (plan) => String(plan.find((p) => p.set.isDefault)._id);

  assert.strictEqual(defaultOf(forwards), defaultOf(backwards),
    'input order must not decide which form every future cycle falls back to');
  assertIndexInvariants(applyPlan(rows, forwards));
});

test('no legacy row is promoted to default when the tenant already has a Phase-3 default', () => {
  const tenant = oid();
  const phase3Default = {
    _id: oid(), tenant, family: oid(), version: 1, isLatest: true, isDefault: true,
    isArchived: false, createdAt: new Date('2026-06-01'),
  };
  const legacy = { _id: oid(), tenant, isArchived: false, createdAt: new Date('2026-01-01') };

  const plan = planTemplateBackfill([phase3Default, legacy]);

  assert.strictEqual(plan.length, 1, 'only the legacy row needs writing');
  assert.strictEqual(plan[0].set.isDefault, false,
    'a second {isDefault:true, isLatest:true} row in one tenant is an E11000 on the partial unique index');
  assertIndexInvariants(applyPlan([phase3Default, legacy], plan));
});

test('an already-migrated tenant does not suppress a different tenant\'s default', () => {
  const withDefault = oid();
  const withoutDefault = oid();
  const rows = [
    {
      _id: oid(), tenant: withDefault, family: oid(), version: 1, isLatest: true,
      isDefault: true, isArchived: false, createdAt: new Date('2026-06-01'),
    },
    { _id: oid(), tenant: withDefault, isArchived: false, createdAt: new Date('2026-01-01') },
    { _id: oid(), tenant: withoutDefault, isArchived: false, createdAt: new Date('2026-01-01') },
  ];

  const plan = planTemplateBackfill(rows);
  const defaults = plan.filter((p) => p.set.isDefault);

  assert.strictEqual(defaults.length, 1);
  assert.strictEqual(String(defaults[0].set.family), String(rows[2]._id));
  assertIndexInvariants(applyPlan(rows, plan));
});

test('version is preserved when a legacy row somehow carries one, matching updateTemplate\'s fork', () => {
  // updateTemplate normalises a pre-Phase-3 row as `family = fresh._id`,
  // `version = fresh.version || 1`. The two paths must agree or a forked family
  // ends up with a v1 the backfill later renumbers.
  const t = { _id: oid(), tenant: oid(), version: 3, isArchived: false, createdAt: new Date('2026-01-01') };
  const [entry] = planTemplateBackfill([t]);

  assert.strictEqual(String(entry.set.family), String(t._id));
  assert.strictEqual(entry.set.version, 3);
});

test('handles an empty or absent collection', () => {
  assert.deepStrictEqual(planTemplateBackfill([]), []);
  assert.deepStrictEqual(planTemplateBackfill(undefined), []);
});
