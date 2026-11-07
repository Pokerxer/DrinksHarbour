'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const AuditLog = require('../models/AuditLog');

test('audit retention has one unambiguous timestamp index', () => {
  const indexes = AuditLog.schema.indexes().filter(([key]) => JSON.stringify(key) === '{"timestamp":1}');
  assert.equal(indexes.length, 1);
  assert.equal(indexes[0][1].expireAfterSeconds, 220752000);
});

test('audit index preview converts an existing plain index without dropping it', () => {
  const { planAuditIndexes } = require('../services/venue/audit-indexes');
  assert.deepEqual(planAuditIndexes([{ name: 'timestamp_1', key: { timestamp: 1 } }]), {
    status: 'review_required', actions: [{ type: 'collMod', index: 'timestamp_1', expireAfterSeconds: 220752000 }],
    blockers: ['TTL conversion can delete expired audit records; review retention and take a verified backup before apply'],
  });
  assert.equal(planAuditIndexes([{ name: 'timestamp_1', key: { timestamp: 1 }, expireAfterSeconds: 220752000 }]).status, 'ready');
  assert.equal(planAuditIndexes([{ name: 'unexpected', key: { timestamp: 1 }, unique: true }]).status, 'blocked');
});
