'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const scope = require('../services/marketContext');
const target = () => { try { return require('../services/marketCommitment'); } catch (e) { if (e.code === 'MODULE_NOT_FOUND') return {}; throw e; } };
test('channel evidence refuses a changed market or provider/account before receipt allocation', () => {
  const { assertBinding } = target();
  assert.equal(typeof assertBinding, 'function');
  const snapshot = { code:'PLATFORM_NG', market:'NG', currency:'NGN', paymentOwner:{provider:'paystack',account:'platform'} };
  assert.doesNotThrow(() => assertBinding(snapshot, snapshot));
  for (const changed of [{...snapshot,market:'GB'}, {...snapshot,paymentOwner:{provider:'korapay',account:'platform'}}, {...snapshot,paymentOwner:{provider:'paystack',account:'merchant'}}]) {
    assert.throws(() => assertBinding(snapshot, changed), /receipt.*channel|channel.*receipt/i);
  }
});
test('disabled foundations preserve existing direct store and new-collection contracts without reading config', async () => {
  const before=process.env.MARKET_FOUNDATIONS_ENABLED;delete process.env.MARKET_FOUNDATIONS_ENABLED;
  try {
    const { directSnapshot, collectionSnapshot } = target();
    assert.equal(typeof directSnapshot,'function');assert.equal(typeof collectionSnapshot,'function');
    assert.equal(await directSnapshot({_id:'legacy'}),undefined);
    assert.equal(await scope.runMarket('NG',()=>collectionSnapshot('paystack','NGN')),undefined);
  } finally { if(before===undefined)delete process.env.MARKET_FOUNDATIONS_ENABLED;else process.env.MARKET_FOUNDATIONS_ENABLED=before; }
});
