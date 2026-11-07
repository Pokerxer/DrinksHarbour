'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { uri } = require('./helpers/venueMongo');
const { quarantinedReturn } = require('./helpers/merchantReturnDispositionFixture');

const validPolicy = (tenant, version = 1) => ({
  tenant: String(tenant),
  version,
  treatmentByCondition: {
    sealed: 'restock',
    damaged: 'write_off',
    expired: 'write_off',
    unverifiable: 'retain_quarantine',
  },
  restockLocationRule: 'original_location',
  cogsTreatment: 'reverse_original_goods_cost',
  reviewReference: 'synthetic-reviewed-disposition-policy',
});

test(
  'return disposition policy is an immutable versioned super-admin authority record',
  { skip: !uri },
  async (t) => {
    const { f, child, actor, call } = await quarantinedReturn(t);
    const base = '/return-disposition-policies';
    const Policy = require('../models/MerchantDispositionPolicy');

    // --- authority: only super_admin may record ---
    assert.equal((await call(base, validPolicy(child.tenant), actor)).status, 403);
    const adminUser = await require('../models/User').collection.insertOne({
      role: 'admin',
      status: 'active',
    });
    adminUser._id = adminUser.insertedId;
    assert.equal(
      (await call(base, validPolicy(child.tenant), adminUser)).status,
      403,
      'plain platform admin cannot record disposition policy'
    );

    // --- recording requires complete explicit content ---
    const broken = (patch) => ({ ...validPolicy(child.tenant), ...patch });
    for (const payload of [
      broken({ treatmentByCondition: { sealed: 'restock' } }),
      broken({ treatmentByCondition: { ...validPolicy().treatmentByCondition, sealed: 'write_off' } }),
      broken({ treatmentByCondition: { ...validPolicy().treatmentByCondition, damaged: 'restock' } }),
      broken({ restockLocationRule: '' }),
      broken({ reviewReference: 'x' }),
      broken({ version: 0 }),
      broken({ extra: true }),
    ]) {
      assert.equal(
        (await call(base, payload, f.admin)).status,
        400,
        `incomplete content rejected: ${JSON.stringify(payload).slice(0, 60)}`
      );
    }

    // --- recorded content is operator input, immutable, versioned ---
    const first = await call(base, validPolicy(child.tenant), f.admin);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const recorded = first.body.data.policy;
    assert.equal(recorded.version, 1);
    assert.equal(recorded.status, 'recorded');
    assert.equal(recorded.tenant, String(child.tenant));
    assert.deepEqual(recorded.treatmentByCondition, validPolicy().treatmentByCondition);
    assert.equal(recorded.recordedBy, String(f.admin._id));
    assert.ok(recorded._id);

    assert.equal(
      (await call(base, validPolicy(child.tenant), f.admin)).status,
      409,
      'same immutable version cannot be recorded twice'
    );
    const second = await call(base, validPolicy(child.tenant, 2), f.admin);
    assert.equal(second.status, 201, JSON.stringify(second.body));
    assert.equal(
      (await call(base, validPolicy(child.tenant, 1), f.admin)).status,
      409,
      'recording requires a newer immutable version'
    );

    // --- exact-ID revocation, idempotent replay ---
    const revoke = await call(`${base}/${second.body.data.policy._id}/revoke`, {}, f.admin);
    assert.equal(revoke.status, 200, JSON.stringify(revoke.body));
    assert.equal(revoke.body.data.policy.status, 'revoked');
    assert.equal(revoke.body.data.policy.revokedBy, String(f.admin._id));
    const replay = await call(`${base}/${second.body.data.policy._id}/revoke`, {}, f.admin);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.data.policy.status, 'revoked');
    assert.equal(
      (
        await call(
          `${base}/${new (require('mongoose').Types.ObjectId)().toString()}/revoke`,
          {},
          f.admin
        )
      ).status,
      409
    );
    assert.equal(
      (await call(`${base}/${second.body.data.policy._id}/revoke`, {}, actor)).status,
      403
    );

    // --- listing is super-admin-only and reflects recorded rows ---
    assert.equal((await call(base, null, actor, 'GET')).status, 403);
    const list = await call(base, null, f.admin, 'GET');
    assert.equal(list.status, 200, JSON.stringify(list.body));
    const versions = list.body.data.policies
      .filter((row) => String(row.tenant) === String(child.tenant))
      .map((row) => row.version);
    assert.deepEqual(versions.sort(), [1, 2]);
    assert.equal(
      versions.length,
      2,
      'no silent updates: exactly one stored row per recorded version'
    );
    const stored = await Policy.find({ tenant: child.tenant }).lean();
    assert.equal(
      stored.filter((row) => row.status === 'recorded').length,
      1,
      'revoked version stays stored but inactive'
    );

    // --- privileged recording is audited ---
    const AuditLog = require('../models/AuditLog');
    assert.ok(
      (await AuditLog.countDocuments({ action: 'RETURN_DISPOSITION_POLICY_RECORDED' })) >= 2
    );
    assert.ok(
      (await AuditLog.countDocuments({ action: 'RETURN_DISPOSITION_POLICY_REVOKED' })) >= 1
    );
  }
);
