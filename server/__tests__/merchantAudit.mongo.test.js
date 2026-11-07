'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  mongoose = require('mongoose');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');
test(
  'platform merchant reads record cross-tenant authority without exposing settlement',
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, 'merchant_audit');
    const Child = require('../models/MerchantOrder'),
      Audit = require('../models/AuditLog'),
      service = require('../services/merchantFulfillment');
    const oid = () => new mongoose.Types.ObjectId(),
      tenant = oid(),
      parent = oid(),
      actor = oid();
    await Child.collection.insertOne({
      _id: 'synthetic-owned-group',
      order: parent,
      tenant,
      location: oid(),
      currency: 'NGN',
      state: 'pending',
      lines: [],
    });
    const platform = { _id: actor, role: 'super_admin' },
      owner = { _id: oid(), role: 'tenant_owner', tenant };
    assert.equal((await service.list(platform)).length, 1);
    await service.get('synthetic-owned-group', platform);
    await service.get('synthetic-owned-group', owner);
    const audits = await Audit.find({ actorUserId: actor })
      .sort({ timestamp: 1 })
      .lean();
    assert.equal(audits.length, 2);
    assert.deepEqual(
      audits.map((row) => row.action),
      ['merchant_orders_list', 'merchant_order_read']
    );
    assert.equal(String(audits[1].targetId), String(parent));
    assert.equal(String(audits[1].targetTenantId), String(tenant));
    assert.equal(
      audits[1].changes.after.merchantOrder,
      'synthetic-owned-group'
    );
    assert.equal(await Audit.countDocuments({ actorUserId: owner._id }), 0);
  }
);
