const test = require('node:test');
const assert = require('node:assert/strict');
const { resultView, participantView } = require('../services/peerAppraisal/queries');
test('result projection exposes only own aggregate and own money', () => {
  const person = { employee: 'a', allocationMinor: 5000000, result: { averageScore: 4, ratingCount: 3, bonusMinor: 4000000 }, ratings: [{ reviewer: 'private' }] };
  assert.deepEqual(resultView(person), { averageScore: 4, ratingCount: 3, bonusMinor: 4000000, allocationMinor: 5000000, currency: 'NGN' });
});
test('HR participant projection excludes results until closure', () => {
  const person = { employee: 'a', displayName: 'Ada', allocationMinor: 5000000, result: { averageScore: 5, ratingCount: 2, bonusMinor: 5000000 } };
  assert.equal(participantView(person, false).result, undefined);
  assert.equal(participantView(person, true).result.bonusMinor, 5000000);
});
const controller = require('../controllers/peerAppraisal.controller');
test('missing or malformed request bodies return validation errors', async () => {
  for (const body of [undefined, null, 'bad', []]) {
    let error;
    await controller.create({ user: { role: 'tenant_owner', tenant: 'tenant-a' }, params: {}, body }, {}, e => { error = e; });
    assert.equal(error.statusCode, 400);
  }
});
