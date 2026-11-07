'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { assertLegacySaleAllowed, rejectCanonicalOrder } = require('../services/venue/legacy-guards');
test('omitted_visit_references_cannot_downgrade_a_canonical_terminal', async t => {
  t.mock.method(require('../models/Warehouse'), 'findOne', filter => ({ select() { return this; }, lean: async () => { assert.equal(filter.tenant, 'own'); return { venueServices: { canonicalCheckoutEnabled: true } }; } }));
  await assert.rejects(assertLegacySaleAllowed({ tenant: { _id: 'own', venueSettings: { identityVersion: 1 } }, locationId: 'bound' }), /canonical/i);
});
test('generic_mutations_reject_canonical_orders_but_preserve_legacy', () => {
  for (const order of [{ venueIdentityVersion: 1 }, { venueServiceSession: 'visit' }, { venueBillForSession: 'visit' }]) assert.throws(() => rejectCanonicalOrder(order), /canonical/i);
  assert.doesNotThrow(() => rejectCanonicalOrder({ status: 'paid' }));
});
