// subproduct-deletion.js — reference-path integrity, mirroring
// sizeDeletion.test.js: every path the guard queries MUST exist on its model's
// schema, otherwise strictQuery silently narrows the check and a history-bearing
// SubProduct could slip through as "deletable". Also: models scoped by tenant
// must really carry a tenant path.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { REFERENCES, assessSubProductDeletionHistory } = require('../services/subproduct-deletion');

test('every subproduct-deletion reference path exists on its model schema', () => {
  assert.ok(REFERENCES.length >= 25);
  for (const [name, paths] of REFERENCES) {
    const Model = require(`../models/${name}`);
    assert.ok(Model, `model ${name} must exist`);
    for (const path of paths) {
      assert.ok(Model.schema.path(path), `${name}.${path} must exist on the schema`);
    }
  }
});

test('tenant scoping only applies to models that carry a tenant path', async () => {
  for (const [name] of REFERENCES) {
    const Model = require(`../models/${name}`);
    const tenantPath = Model.schema.path('tenant');
    if (tenantPath) assert.equal(tenantPath.instance, 'ObjectId', `${name}.tenant must be an ObjectId`);
  }
});

test('a hit in any reference collection blocks deletion', async t => {
  const subProduct = { _id: new mongoose.Types.ObjectId() };
  for (const [name] of REFERENCES) {
    const Model = require(`../models/${name}`);
    t.mock.method(Model, 'countDocuments', async query => {
      // every clause must target the subproduct id
      for (const clause of query.$or || []) {
        for (const path of Object.keys(clause)) assert.equal(clause[path], subProduct._id, `${name} clause path ${path}`);
      }
      return name === 'Order' ? 2 : 0;
    });
  }
  const status = await assessSubProductDeletionHistory(subProduct, 'tenant');
  assert.equal(status.allowed, false);
  assert.deepEqual(status.blockers, [{ collection: 'Order', count: 2 }]);
  assert.match(status.reason, /archive/i);
});

test('a listing with no references anywhere is deletable', async t => {
  const subProduct = { _id: new mongoose.Types.ObjectId() };
  for (const [name] of REFERENCES) {
    const Model = require(`../models/${name}`);
    t.mock.method(Model, 'countDocuments', async () => 0);
  }
  const status = await assessSubProductDeletionHistory(subProduct, 'tenant');
  assert.equal(status.allowed, true);
  assert.deepEqual(status.blockers, []);
  assert.equal(status.reason, null);
});
