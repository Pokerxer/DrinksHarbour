'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
test('configuration requires a platform super admin and never falls back to environment database settings', async t => {
  const User = require('../models/User');
  t.mock.method(User, 'findOne', () => ({ session() { return this; }, lean: async () => null }));
  await assert.rejects(require('../services/storefrontConfiguration').configure({
    tenant: 'a'.repeat(24), apiKey: 'b'.repeat(24), warehouse: 'c'.repeat(24), code: 'WYN_WEBSITE',
    paymentAccount: 'DIRECT_TEST', returnOrigins: ['https://website.example.test'], enabled: true,
  }, { actorId: 'd'.repeat(24), apply: false }), e => e.statusCode === 403);
});
