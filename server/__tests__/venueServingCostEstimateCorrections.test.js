'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { priceAcceptedLine } = require('../services/venue/pricing');
const { lineRows } = require('../services/venue/profitability-rows');
const oid = '507f1f77bcf86cd799439011';
function accepted(costPrice, servingSchemaVersion = 2) {
  return priceAcceptedLine({ sp: { _id: oid, product: oid, costPrice: 800 },
    size: { _id: oid, servingSchemaVersion, costPrice, sellingPrice: 1000 },
    tenant: {}, input: { quantity: 1 }, actor: {} });
}
test('unknown v2 portion cost remains unknown through accepted snapshot and margin estimate', () => {
  const line = accepted(null);
  assert.equal(line.costMinor, null);
  const [row] = lineRows({ tenantId: oid, locationId: oid, basis: 'estimated' },
    { _id: oid, currency: 'NGN', venueBillSnapshot: { acceptedLines: [line], rateBps: 0 } },
    { _id: oid, date: new Date('2026-10-30T12:00:00Z') }, { receipts: [] },
    { asOf: new Date('2026-10-30T13:00:00Z'), services: { timezone: 'Africa/Lagos' } });
  assert.equal(row.estimatedCostMinor, null);
  assert.equal(row.grossProfitMinor, null);
  assert.equal(row.costStatus, 'unknown');
  assert.ok(row.missingReasons.includes('unknown_cost'));
});
test('explicit zero v2 portion cost does not inherit a parent stock-unit cost', () => {
  assert.equal(accepted(0).costMinor, 0);
});
test('known portion estimates and legacy fallback retain their established basis', () => {
  assert.equal(accepted(25.5).costMinor, 2550);
  assert.equal(accepted(null, 1).costMinor, 80000);
});
