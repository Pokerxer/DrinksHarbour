'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const protocol = require('../services/deliveryProviders/external/protocol');
test('carrier money preserves exact decimal minor units and rejects unsupported values', () => {
  assert.equal(protocol.minor(12451.04), 1245104);
  assert.equal(protocol.minor('0.29'), 29);
  for (const value of [-1, '1.001', '1e3', Infinity, {}, '90071992547409.92'])
    assert.throws(() => protocol.minor(value));
});
test('rates retain only reviewed pickup services within the accepted shipping budget', () => {
  const data = { request_token: 'original-token', couriers: [
    { courier_id: 1, service_code: 'parcel', service_type: 'pickup', currency: 'NGN', total: 12.34, rate_card_amount: 12.34, courier_name: 'Parcel', private: 'SECRET' },
    { courier_id: 2, service_code: 'other', service_type: 'pickup', currency: 'NGN', total: 1, rate_card_amount: 1 },
    { courier_id: 1, service_code: 'parcel', service_type: 'dropoff', currency: 'NGN', total: 1, rate_card_amount: 1 },
    { courier_id: 1, service_code: 'parcel', service_type: 'pickup', currency: 'NGN', total: 13, rate_card_amount: 13 },
  ] };
  const view = protocol.rates(data, [{ courierId: '1', serviceCode: 'parcel' }], 1250);
  assert.deepEqual(view.rates, [{ courierId: '1', serviceCode: 'parcel', name: 'Parcel', amountMinor: 1234, displayMinor: 1234 }]);
  assert.equal(view.requestToken, 'original-token');
  assert.doesNotMatch(JSON.stringify(view), /SECRET|other/);
});
test('provider observations bind exact shipment identity and ignore raw rider and URL evidence', () => {
  assert.throws(() => protocol.observation({ order_id: 'SB-FOREIGN', status: 'completed' }, 'SB-OWN'));
  assert.deepEqual(protocol.observation({ order_id: 'SB-OWN', status: 'picked_up', courier: { rider_info: 'SECRET' }, tracking_url: 'javascript:bad' }, 'SB-OWN'), { status: 'picked_up' });
  assert.throws(() => protocol.observation({ order_id: 'SB-OWN', status: 'invented' }, 'SB-OWN'));
});
test('webhook verification uses exact raw bytes and rejects malformed or foreign signatures', () => {
  const raw = Buffer.from('{"order_id":"SB-OWN"}');
  const signature = crypto.createHmac('sha512', 'synthetic-key').update(raw).digest('hex');
  assert.equal(protocol.verifySignature(raw, signature, 'synthetic-key'), true);
  assert.equal(protocol.verifySignature(Buffer.from('{ "order_id":"SB-OWN"}'), signature, 'synthetic-key'), false);
  assert.equal(protocol.verifySignature(raw, 'abc', 'synthetic-key'), false);
});
