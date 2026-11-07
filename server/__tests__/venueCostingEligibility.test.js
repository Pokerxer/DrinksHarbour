'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { resolveVenueEligibility } = require('../services/venue/eligibility');
const tenant = { _id: 't', status: 'approved', isActive: true, plan: 'venue', subscriptionStatus: 'active', businessCapabilities: ['hospitality'], venueSettings: { identityVersion: 1 } };
const location = { _id: 'l', tenant: 't', venueStaff: ['u'], venueServices: { enabled: true, reviewedAt: new Date(), canonicalCheckoutEnabled: true, capabilities: ['tables','tabs','preparation'] } };
test('cost and serving actions require explicit grants and fresh denies win', () => {
  const actor = { userId: 'u', tenantId: 't', role: 'tenant_admin', permissions: ['pos:sell'] };
  for (const [action,grant] of [['servings.write','venue:servings_write'],['production.write','venue:production_write'],['inventory.count','venue:inventory_count'],['profitability.read','venue:profitability_read'],['costs.review','venue:costs_review']]) {
    assert.equal(resolveVenueEligibility({ tenant, location, actor, action }).allowed, false);
    assert.equal(resolveVenueEligibility({ tenant, location, actor: { ...actor, permissions: [...actor.permissions,grant] }, action }).allowed, true);
    assert.equal(resolveVenueEligibility({ tenant, location, actor: { ...actor, permissions: [...actor.permissions,grant], venueDeniedActions: [action] }, action }).allowed, false);
  }
});
test('new venue grants can be persisted without granting them by default', async()=>{
 const User=require('../models/User');
 const record=new User({posPermissions:['pos:sell','venue:servings_write','venue:production_write','venue:inventory_count','venue:profitability_read','venue:costs_review']});
 await record.validate(['posPermissions']);
 assert.equal(new User().posPermissions.includes('venue:profitability_read'),false);
});
