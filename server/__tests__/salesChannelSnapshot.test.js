'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const SalesChannel = require('../models/SalesChannel');
const tenant = '507f1f77bcf86cd799439011';
const channel = { _id: '507f1f77bcf86cd799439015', tenant, version: 2, code: 'TEST_WEBSITE', kind: 'storefront', market: 'NG', currency: 'NGN', active: true,
 legalOwner: { type: 'tenant', reference: tenant }, paymentOwner: { type: 'tenant', reference: tenant, provider: 'paystack', account: 'TEST_ACCOUNT' }, pricingPolicy: { code: 'TENANT_RETAIL', version: 1, termsReference: 'synthetic-reviewed-terms' },
 storefrontChannel: '507f1f77bcf86cd799439012', apiKey: '507f1f77bcf86cd799439013', location: '507f1f77bcf86cd799439014' };
const direct = { _id: channel.storefrontChannel, tenant, apiKey: channel.apiKey, warehouse: channel.location, code: channel.code, paymentAccount: channel.paymentOwner.account, enabled: true };
const load = () => fs.existsSync(require('node:path').resolve(__dirname, '../services/salesChannels/index.js')) ? require('../services/salesChannels') : {};
test('snapshot resolves saved tenant authority, preserves exact direct identities and freezes copied terms', async t => {
 t.mock.method(require('../models/CountryConfiguration'), 'findOne', () => ({ lean: async () => ({ code: 'NG', currency: 'NGN', version: 3, active: true, capabilities: { storefront: true, marketplace: true, erm: true } }) }));
 const { resolveChannelSnapshot } = load(); assert.equal(typeof resolveChannelSnapshot, 'function');
 const before = SalesChannel.findOne; let query;
 SalesChannel.findOne = filter => { query = filter; return { lean: async () => channel }; };
 try {
  const result = await resolveChannelSnapshot({ tenant, kind: 'storefront', storefrontChannel: direct });
  assert.deepEqual(query, { tenant, kind: 'storefront', market: 'NG' });
  assert.equal(result.code, channel.code); assert.equal(result.configVersion, 2);
  assert.equal(result.apiKey, channel.apiKey); assert.equal(result.location, channel.location);
  assert.equal(Object.isFrozen(result.paymentOwner), true); assert.notEqual(result.pricingPolicy, channel.pricingPolicy);
  assert.equal(result.reviewReason, undefined);
  await assert.rejects(() => resolveChannelSnapshot({ tenant, kind: 'storefront', storefrontChannel: { ...direct, apiKey: '507f1f77bcf86cd799439099' } }), /identity|mapping/i);
  await assert.rejects(() => resolveChannelSnapshot({ tenant, kind: 'storefront', currency: 'USD', storefrontChannel: direct }), /currency/i);
 } finally { SalesChannel.findOne = before; }
});
test('missing and inactive channels fail closed rather than inventing fees or owners', async t => {
 t.mock.method(require('../models/CountryConfiguration'), 'findOne', () => ({ lean: async () => ({ code: 'NG', currency: 'NGN', version: 3, active: true, capabilities: { storefront: true, marketplace: true, erm: true } }) }));
 const { resolveChannelSnapshot } = load(); assert.equal(typeof resolveChannelSnapshot, 'function');
 const before = SalesChannel.findOne;
 try {
  SalesChannel.findOne = () => ({ lean: async () => null });
  await assert.rejects(() => resolveChannelSnapshot({ tenant, kind: 'storefront', storefrontChannel: direct }), /configuration/i);
  SalesChannel.findOne = () => ({ lean: async () => ({ ...channel, active: false }) });
  await assert.rejects(() => resolveChannelSnapshot({ tenant, kind: 'storefront', storefrontChannel: direct }), /inactive/i);
 } finally { SalesChannel.findOne = before; }
});
test('Order optional channel snapshot is immutable and absent on historical rows', () => {
 const Order = require('../models/Order');
 const field = Order.schema.path('channelSnapshot'); assert.ok(field, 'channel snapshot field is present');
 assert.equal(field.options.immutable, true);
 assert.equal(new Order().channelSnapshot, undefined);
 const order = new Order({ channelSnapshot: { version: 1, code: channel.code, kind: channel.kind, market: 'NG', currency: 'NGN', paymentOwner: channel.paymentOwner, legalOwner: channel.legalOwner, pricingPolicy: channel.pricingPolicy, malicious: 'ignored' } });
 assert.equal(order.channelSnapshot.toObject().malicious, undefined);
});
test('server selected existing gateway or stored value must match reviewed owner and is frozen as actual account', async t => {
 const { resolveChannelSnapshot } = load();
 t.mock.method(require('../models/CountryConfiguration'), 'findOne', () => ({ lean: async () => ({ code:'NG',currency:'NGN',active:true,version:1,capabilities:{marketplace:true} }) }));
 const platform = { ...channel, tenant:null, kind:'marketplace', code:'DRINKSHARBOUR_NG', legalOwner:{type:'platform',reference:'synthetic-owner'}, paymentOwner:{type:'platform',reference:'synthetic-owner',provider:'korapay',account:'platform'}, allowedPaymentOwners:[{type:'platform',reference:'synthetic-owner',provider:'wallet',account:'platform'},{type:'platform',reference:'synthetic-owner',provider:'paystack',account:'platform'}] };
 delete platform.storefrontChannel; delete platform.apiKey; delete platform.location;
 t.mock.method(SalesChannel, 'findOne', () => ({ lean:async()=>platform }));
 const snapshot=await resolveChannelSnapshot({kind:'marketplace',provider:'wallet',account:'platform'});
 assert.equal(snapshot.paymentOwner.provider,'wallet'); assert.equal(snapshot.paymentOwner.account,'platform');
 assert.equal(snapshot.allowedPaymentOwners,undefined);
 await assert.rejects(()=>resolveChannelSnapshot({kind:'marketplace',provider:'stripe',account:'platform'}),/reviewed|account/i);
 await assert.rejects(()=>resolveChannelSnapshot({kind:'marketplace',provider:'wallet',account:'another'}),/reviewed|account/i);
});
