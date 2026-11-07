'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Tenant = require('../models/Tenant');
const { startRouter } = require('./helpers/routeAuthHarness');
const router = require('../routes/venue.routes');
const fixture = (extra = {}) => ({ _id: '000000000000000000000001', name: 'Venue', slug: 'venue', status: 'approved', subscriptionStatus: 'active', plan: 'custom', customCapabilities: ['table_management'], businessCapabilities: ['hospitality'], venueSettings: { identityVersion: 1, publicListed: true }, bankDetails: 'PRIVATE', ...extra });
function stubPages(t, pages) {
  let n = 0;
  t.mock.method(Tenant, 'find', () => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => pages[n++] || [] }));
}
test('custom_plan_not_name_gate_and_public_projection_is_safe', async t => {
  stubPages(t, [[fixture()]]);
  const app = await startRouter(router, '/api/venues');
  try {
    const response = await fetch(app.url('/api/venues'));
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.length, 1);
    assert.equal(data[0].slug, 'venue');
    assert.equal(data[0].bankDetails, undefined);
  } finally { await app.close(); }
});
test('unreviewed_new_venue_hidden_but_reviewed_existing_listing_kept', async t => {
  stubPages(t, [[fixture({ venueSettings: {} }), fixture({ _id: '000000000000000000000002', venueSettings: { identityVersion: 1, legacyPublicGrantedAt: new Date() } })]]);
  const app = await startRouter(router, '/api/venues');
  try { const { data } = await (await fetch(app.url('/api/venues'))).json(); assert.deepEqual(data.map(v => v._id), ['000000000000000000000002']); }
  finally { await app.close(); }
});
test('candidate_after_first_page_is_considered', async t => {
  stubPages(t, [Array.from({ length: 100 }, (_, n) => fixture({ _id: String(n).padStart(24, '0'), venueSettings: {} })), [fixture()]]);
  const app = await startRouter(router, '/api/venues');
  try { const { data } = await (await fetch(app.url('/api/venues'))).json(); assert.equal(data.length, 1); }
  finally { await app.close(); }
});
