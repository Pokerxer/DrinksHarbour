const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness } = require('./helpers/appraisalHarness');

const oid = () => new mongoose.Types.ObjectId();

const cycles = require('../controllers/appraisalCycle.controller');
const AppraisalTemplate = require('../models/AppraisalTemplate');

test('ensureDefaultTemplate seeds exactly one default template', async (t) => {
  const tenant = oid();
  const user = { _id: oid(), tenant, role: 'tenant_admin' };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);

  const first = await cycles.ensureDefaultTemplate(tenant, user._id);
  assert.ok(first, 'must return a template');
  assert.strictEqual(first.isDefault, true);
  assert.strictEqual(first.isLatest, true);
  assert.strictEqual(first.version, 1);
  assert.ok(first.family, 'must carry a family id');
  assert.strictEqual(h.db.templates.length, 1);
});

test('ensureDefaultTemplate is idempotent — a second call reuses the first', async (t) => {
  const tenant = oid();
  const user = { _id: oid(), tenant, role: 'tenant_admin' };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);

  const first = await cycles.ensureDefaultTemplate(tenant, user._id);
  const second = await cycles.ensureDefaultTemplate(tenant, user._id);

  assert.strictEqual(String(first._id), String(second._id));
  assert.strictEqual(h.db.templates.length, 1);
});

test('concurrent first-ever calls still yield one default template', async (t) => {
  const tenant = oid();
  const user = { _id: oid(), tenant, role: 'tenant_admin' };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);

  // The exact race the Phase 1 ledger left open: two createCycle calls for a
  // tenant that has never had a template. findOne-then-create produced two.
  const [a, b] = await Promise.all([
    cycles.ensureDefaultTemplate(tenant, user._id),
    cycles.ensureDefaultTemplate(tenant, user._id),
  ]);

  assert.strictEqual(h.db.templates.length, 1, 'must not seed two defaults');
  assert.strictEqual(String(a._id), String(b._id));
});

test('a duplicate-key race re-reads the winner rather than throwing', async (t) => {
  const tenant = oid();
  const user = { _id: oid(), tenant, role: 'tenant_admin' };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);

  const winner = await cycles.ensureDefaultTemplate(tenant, user._id);

  // Force the upsert path to lose exactly once, as the loser of a real race
  // does, and assert the controller recovers by reading instead of 500ing.
  const realUpdate = AppraisalTemplate.findOneAndUpdate;
  let thrown = false;
  AppraisalTemplate.findOneAndUpdate = async (...args) => {
    if (!thrown) {
      thrown = true;
      const err = new Error('E11000 duplicate key error');
      err.code = 11000;
      throw err;
    }
    return realUpdate.apply(AppraisalTemplate, args);
  };
  t.after(() => { AppraisalTemplate.findOneAndUpdate = realUpdate; });

  const loser = await cycles.ensureDefaultTemplate(tenant, user._id);
  assert.strictEqual(String(loser._id), String(winner._id));
});

test('buildDefaultTemplate stamps the version fields', () => {
  const { buildDefaultTemplate } = require('../services/appraisal.helpers');
  const tenant = oid();
  const doc = buildDefaultTemplate(tenant, oid());

  assert.ok(doc.family, 'must generate a family id');
  assert.strictEqual(doc.version, 1);
  assert.strictEqual(doc.isLatest, true);
  assert.strictEqual(doc.isDefault, true);
});

test('two buildDefaultTemplate calls generate DIFFERENT family ids', () => {
  const { buildDefaultTemplate } = require('../services/appraisal.helpers');
  const a = buildDefaultTemplate(oid(), oid());
  const b = buildDefaultTemplate(oid(), oid());
  // A shared family id would make two unrelated tenants' defaults look like
  // versions of one another.
  assert.notStrictEqual(String(a.family), String(b.family));
});
