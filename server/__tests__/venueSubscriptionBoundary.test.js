'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { boundaryUpdate, authorizeVenueRecovery } = require('../services/venue/subscription');
const now = new Date('2026-10-18T00:00:00Z');
const tenant = { _id: 'own', status: 'approved', subscriptionStatus: 'past_due', plan: 'venue', venueSubscriptionReadOnlySince: now };
const actor = { userId: 'staff', tenantId: 'own', role: 'tenant_owner', venueDeniedActions: [] };
const session = { tenant: 'own', openedAt: '2026-10-17T20:00:00Z', entitlementAtOpen: { capabilities: ['table_management'], writesAllowed: true } };
test('first_lapse_boundary_is_preserved_and_active_restore_clears_it', () => {
  assert.equal(boundaryUpdate(tenant, { subscriptionStatus: 'past_due', plan: 'venue' }, new Date('2026-10-19')).venueSubscriptionReadOnlySince, now);
  assert.equal(boundaryUpdate(tenant, { subscriptionStatus: 'active', plan: 'venue' }, now).venueSubscriptionReadOnlySince, null);
});
test('existing_visit_can_finish_but_not_order_after_lapse', () => {
  assert.equal(authorizeVenueRecovery({ tenant, actor, session, command: 'collection.write', now }).allowed, true);
  assert.equal(authorizeVenueRecovery({ tenant, actor, session, command: 'lines.write', now }).allowed, false);
  assert.equal(authorizeVenueRecovery({tenant:{...tenant,isActive:false},actor,session,command:'collection.write',now}).allowed,false);
  assert.equal(authorizeVenueRecovery({ tenant: { ...tenant, status: 'suspended' }, actor, session, command: 'collection.write', now }).allowed, false);
  assert.equal(authorizeVenueRecovery({ tenant, actor, session: { ...session, openedAt: '2026-10-19' }, command: 'bill.freeze', now }).allowed, false);
  assert.equal(authorizeVenueRecovery({ tenant, actor: { ...actor, tenantId: 'other' }, session, command: 'bill.read', now }).allowed, false);
});
test('restoration_reads_mongoose_tenant_fields_instead_of_document_internals', () => {
  const Tenant = require('../models/Tenant');
  const document = Tenant.hydrate({ _id: '000000000000000000000001', plan: 'venue', subscriptionStatus: 'past_due', venueSubscriptionReadOnlySince: now });
  assert.equal(boundaryUpdate(document, { subscriptionStatus: 'active' }, now).venueSubscriptionReadOnlySince, null);
});
