'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { uri } = require('./helpers/venueMongo');
const { quarantinedReturn } = require('./helpers/merchantReturnDispositionFixture');
const { validPolicy } = require('./helpers/merchantReturnEffectsFixture');

const VERBATIM =
  'Return stock/cost treatment policy is not recorded; restock, write-off and COGS effects are unsupported';
const ADAPTER =
  'Recorded return disposition policy declares a treatment adapter this mechanism does not support';

test(
  'return effects fail closed byte-identically without a recorded policy or with the execution flag off',
  { skip: !uri },
  async (t) => {
    const { f, child, actor, booking, call } = await quarantinedReturn(t);
    const Return = require('../models/MerchantDeliveryReturn'),
      Stock = require('../models/WarehouseStock'),
      Budget = require('../models/MerchantDispatchBudget');
    const base = `/bookings/${booking._id}/return`;
    const stockBefore = (await Stock.findOne({ tenant: child.tenant })).toObject();
    const budgetBefore = await Budget.findById(child._id).lean();
    const before = await Return.findOne({ booking: String(booking._id) }).lean();
    const command = { expectedVersion: before.version, idempotencyKey: 'effects-attempt' };

    // --- no policy anywhere: pure read AND versioned command both unsupported ---
    const read = await call(`${base}/effects`, {});
    assert.equal(read.status, 200, JSON.stringify(read.body));
    assert.deepEqual(read.body.data, {
      effects: { supported: false, reasons: [VERBATIM], returnVersion: before.version },
    });
    const attempted = await call(`${base}/effects`, command);
    assert.equal(attempted.status, 200, JSON.stringify(attempted.body));
    assert.deepEqual(attempted.body.data, {
      effects: { supported: false, reasons: [VERBATIM], returnVersion: before.version },
    });

    // --- policy recorded but the default-off execution flag is off ---
    const policy = await call('/return-disposition-policies', validPolicy(child.tenant), f.admin);
    assert.equal(policy.status, 201, JSON.stringify(policy.body));
    const gated = await call(`${base}/effects`, command);
    assert.equal(gated.status, 200, JSON.stringify(gated.body));
    assert.deepEqual(gated.body.data, {
      effects: { supported: false, reasons: [VERBATIM], returnVersion: before.version },
    });

    // --- zero writes in every fail-closed path: no key consumed, nothing moves ---
    const after = await Return.findOne({ booking: String(booking._id) }).lean();
    assert.equal(after.version, before.version);
    assert.equal((after.operations || []).length, (before.operations || []).length);
    assert.equal(
      (await Stock.findOne({ tenant: child.tenant })).toObject().currentQuantity,
      stockBefore.currentQuantity
    );
    assert.deepEqual(await Budget.findById(child._id).lean(), budgetBefore);

    // --- foreign tenant gets no enumeration on the execute path ---
    assert.equal(
      (await call(`${base}/effects`, command, f.actors[1])).status,
      404,
      'foreign tenant cannot execute another tenant effects'
    );
    void actor;
  }
);

test(
  'a recorded policy whose treatment adapter is unsupported stays fail-closed with zero writes',
  { skip: !uri },
  async (t) => {
    const { base, commandVersion, child, actor, booking, call } =
      await require('./helpers/merchantReturnEffectsFixture').decidedReturn(
        t,
        'sealed',
        'restock'
      );
    process.env.MERCHANT_RETURN_EFFECTS_ENABLED = 'true';
    t.after(() => delete process.env.MERCHANT_RETURN_EFFECTS_ENABLED);
    const Return = require('../models/MerchantDeliveryReturn'),
      Stock = require('../models/WarehouseStock');
    // Operator records an adapter this mechanism does not implement.
    const policy = await call(
      '/return-disposition-policies',
      { ...validPolicy(child.tenant, 2), restockLocationRule: 'central_warehouse' },
      {
        _id: (await require('../models/User').findOne({ role: 'super_admin' }))._id,
        role: 'super_admin',
      }
    );
    assert.equal(policy.status, 201, JSON.stringify(policy.body));
    const before = await Return.findOne({ booking: String(booking._id) }).lean();
    const stockBefore = (await Stock.findOne({ tenant: child.tenant })).toObject();

    const executed = await call(
      `${base}/effects`,
      { expectedVersion: commandVersion, idempotencyKey: 'effects-adapter' },
      actor
    );
    assert.equal(executed.status, 200, JSON.stringify(executed.body));
    assert.equal(executed.body.data.effects.supported, false);
    assert.deepEqual(executed.body.data.effects.reasons, [VERBATIM, ADAPTER]);

    const after = await Return.findOne({ booking: String(booking._id) }).lean();
    assert.equal(after.version, before.version, 'unsupported adapter consumes nothing');
    assert.equal((after.operations || []).length, (before.operations || []).length);
    assert.equal(
      (await Stock.findOne({ tenant: child.tenant })).toObject().currentQuantity,
      stockBefore.currentQuantity
    );
  }
);
