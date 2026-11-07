'use strict';
const mongoose = require('mongoose'); const { requireId, fail } = require('./errors'); const { fingerprint } = require('./operations');
const allowed = ['tenantId', 'locationId', 'expectedTenantVersion', 'expectedLocationVersion', 'timezone', 'businessDayStartMinutes', 'termsVersion', 'reviewedBy', 'publicListed', 'reviewedExistingListing', 'canonicalCheckoutEnabled', 'staffIds', 'tableIds'];
function parseVenueMapping(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) fail('INVALID_MAPPING', 'Markdown frontmatter required', 400);
  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const part = /^([A-Za-z]+): ([^\r\n]+)$/.exec(line);
    if (!part || !allowed.includes(part[1]) || Object.hasOwn(result, part[1]) || /[{}\[\]"'`]/.test(part[2])) fail('INVALID_MAPPING', 'Unknown, duplicate or nested mapping field', 400);
    result[part[1]] = part[2];
  }
  for (const key of ['tenantId', 'locationId', 'reviewedBy']) requireId(result[key]);
  for (const key of ['expectedTenantVersion', 'expectedLocationVersion', 'businessDayStartMinutes', 'termsVersion']) {
    if (!/^\d+$/.test(result[key] || '')) fail('INVALID_MAPPING', `Integer ${key} required`, 400); result[key] = Number(result[key]);
  }
  if (result.businessDayStartMinutes > 1439 || result.termsVersion !== 1) fail('INVALID_MAPPING', 'Invalid service cutoff or commercial version', 400);
  try { new Intl.DateTimeFormat('en', { timeZone: result.timezone }); } catch { fail('INVALID_MAPPING', 'Invalid timezone', 400); }
  if (!result.timezone) fail('INVALID_MAPPING', 'Timezone required', 400);
  for (const key of ['publicListed', 'reviewedExistingListing', 'canonicalCheckoutEnabled']) {
    if (result[key] !== undefined && !['true', 'false'].includes(result[key])) fail('INVALID_MAPPING', 'Boolean required', 400);
    result[key] = result[key] === 'true';
  }
  for (const key of ['staffIds', 'tableIds']) { result[key] = result[key] ? result[key].split(',').map(value => requireId(value.trim())) : []; if (new Set(result[key]).size !== result[key].length) fail('INVALID_MAPPING', 'Duplicate mapping ID', 400); }
  return result;
}
function requiredIndexesPresent(Model, indexes) {
  return Model.schema.indexes().filter(([, options]) => options.unique).every(([keys, options]) => indexes.some(index => index.unique === true && fingerprint(index.key) === fingerprint(keys) && fingerprint(index.partialFilterExpression || null) === fingerprint(options.partialFilterExpression || null) && !!index.sparse === !!options.sparse));
}
async function mappingActor({ tenantId, mapping, actor, mongoSession = null }) {
  if (tenantId !== mapping.tenantId || actor.userId !== mapping.reviewedBy) fail('INVALID_MAPPING', 'Reviewed mapping identity does not match', 403);
  const user = await require('../../models/User').findOne({ _id: actor.userId, status: 'active' }).session(mongoSession).lean();
  if (!user || (!['super_admin', 'admin'].includes(user.role) && (String(user.tenant) !== tenantId || !['tenant_owner', 'tenant_admin'].includes(user.role)))) fail('NOT_FOUND', 'Reviewer not found', 404);
  return { ...actor, role: user.role };
}
async function previewVenueMapping({ tenantId, mapping, actor, mongoSession = null }) {
  if (tenantId !== mapping.tenantId || actor.userId !== mapping.reviewedBy) fail('INVALID_MAPPING', 'Reviewed mapping identity does not match', 403);
  const tenant = await require('../../models/Tenant').findOne({ _id: tenantId }).session(mongoSession).lean();
  const location = await require('../../models/Warehouse').findOne({ _id: mapping.locationId, tenant: tenantId, isActive: true }).session(mongoSession).lean();
  const user = await require('../../models/User').findOne({ _id: actor.userId, status: 'active' }).session(mongoSession).lean();
  if (!tenant || !location || !user || (!['super_admin', 'admin'].includes(user.role) && (String(user.tenant) !== tenantId || !['tenant_owner', 'tenant_admin'].includes(user.role)))) fail('NOT_FOUND', 'Reviewed tenant/location/actor not found', 404);
  const blockers = [];
  const entitlements = require('../entitlements.service').resolveEntitlements(tenant);
  if (tenant.status !== 'approved' || tenant.subscriptionStatus !== 'active' || !entitlements.writesAllowed || !entitlements.capabilities.includes('table_management')) blockers.push('PAID_VENUE_PLAN_REQUIRED');
  if ((tenant.__v || 0) !== mapping.expectedTenantVersion || (location.venueVersion || 0) !== mapping.expectedLocationVersion) blockers.push('STATE_CHANGED');
  const legacy = await require('../../models/Order').find({ tenant: tenantId, venueIdentityVersion: { $ne: 1 }, $or: [{ status: 'hold' }, { tableServiceBooking: { $exists: true }, paymentStatus: 'pending' }] }).select('_id updatedAt').session(mongoSession).lean();
  if (legacy.length) blockers.push('LEGACY_OBLIGATIONS_REQUIRE_REVIEW');
  const tables = await require('../../models/POSTable').find({ tenant: tenantId, _id: { $in: mapping.tableIds } }).session(mongoSession).lean();
  if (tables.length !== mapping.tableIds.length || tables.some(t => t.status !== 'available' || t.currentTabId || (t.location && String(t.location) !== mapping.locationId))) blockers.push('TABLE_MAPPING_REVIEW_REQUIRED');
  const staff = await require('../../models/User').countDocuments({ _id: { $in: mapping.staffIds }, tenant: tenantId, status: 'active' }).session(mongoSession);
  if (staff !== mapping.staffIds.length) blockers.push('STAFF_MAPPING_REVIEW_REQUIRED');
  const codes = ['1000', '1300', '1200', '4000', '5000', '6000', '2100'];
  if (await require('../../models/Account').countDocuments({ tenant: tenantId, code: { $in: codes }, isActive: true }).session(mongoSession) !== codes.length) blockers.push('ACCOUNTING_REVIEW_REQUIRED');
  for (const name of ['VenueServiceSession', 'VenueOperation', 'VenueStockEffect', 'VenuePaymentAttempt', 'VenuePaymentReceipt', 'VenuePaymentAllocation', 'VenueWorkItem', 'Order']) {
    try { const Model = require(`../../models/${name}`); const indexes = await Model.collection.indexes(); if (!requiredIndexesPresent(Model, indexes)) blockers.push(`INDEX_REQUIRED:${name}`); }
    catch { blockers.push(`INDEX_REQUIRED:${name}`); }
  }
  return { safe: !blockers.length, blockers, changes: { mapping, tenantVersion: tenant.__v || 0, locationVersion: location.venueVersion || 0 },
    fingerprint: fingerprint({ mapping, tenantVersion: tenant.__v || 0, locationVersion: location.venueVersion || 0, legacy: legacy.map(o => [String(o._id), o.updatedAt]) }) };
}
async function applyVenueMapping({ tenantId, mapping, actor, expectedFingerprint }) {
  actor = await mappingActor({ tenantId, mapping, actor });
  if (typeof expectedFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(expectedFingerprint)) fail('MAPPING_REVIEW_REQUIRED', 'Reviewed preview fingerprint required');
  const Warehouse = require('../../models/Warehouse'); const Tenant = require('../../models/Tenant');
  const applied = await Warehouse.findOne({ _id: mapping.locationId, tenant: tenantId, venueMappingFingerprint: expectedFingerprint, venueMappingHash: fingerprint(mapping) }).lean();
  if (applied) return { applied: true, replay: true, fingerprint: expectedFingerprint };
  const mongoSession = await mongoose.startSession();
  try { return await mongoSession.withTransaction(async () => {
    const preview = await previewVenueMapping({ tenantId, mapping, actor, mongoSession });
    if (!preview.safe || preview.fingerprint !== expectedFingerprint) fail('MAPPING_REVIEW_REQUIRED', `Mapping changed or blocked: ${preview.blockers.join(', ')}`);
    const tenant = await Tenant.findOne({ _id: tenantId }).session(mongoSession);
    const updated = await Warehouse.updateOne({ _id: mapping.locationId, tenant: tenantId, venueVersion: mapping.expectedLocationVersion }, { $set: {
      venueServices: { enabled: true, capabilities: ['tables', 'tabs', 'preparation', 'request_bookings'], timezone: mapping.timezone, businessDayStartMinutes: mapping.businessDayStartMinutes, reviewedAt: new Date(), canonicalCheckoutEnabled: mapping.canonicalCheckoutEnabled },
      venueStaff: mapping.staffIds, venueMappingFingerprint: expectedFingerprint, venueMappingHash: fingerprint(mapping) }, $inc: { venueVersion: 1 } }, { session: mongoSession });
    if (!updated.modifiedCount) fail('STATE_CHANGED');
    tenant.businessCapabilities = [...new Set([...(tenant.businessCapabilities || []), 'hospitality'])];
    tenant.venueSettings.identityVersion = 1; tenant.venueSettings.publicListed = mapping.publicListed; tenant.venueSettings.requestBookingsEnabled = mapping.publicListed || mapping.reviewedExistingListing;
    if (mapping.reviewedExistingListing) tenant.venueSettings.legacyPublicGrantedAt = new Date();
    tenant.venueSettings.commercialTerms = { version: 1, platformRateBps: 900, directRateBps: 0, effectiveAt: new Date() };
    tenant.increment(); await tenant.save({ session: mongoSession });
    await require('../../models/POSTable').updateMany({ _id: { $in: mapping.tableIds }, tenant: tenantId, status: 'available', currentTabId: null }, { $set: { location: mapping.locationId }, $inc: { venueVersion: 1 } }, { session: mongoSession });
    await require('../../models/AuditLog').create([{ actorUserId: actor.userId, actorRole: actor.role, action: 'VENUE_MAPPING_APPLY', actionCategory: 'update', targetType: 'Tenant', targetId: tenantId, targetTenantId: tenantId, changes: { after: { locationId: mapping.locationId, fingerprint: expectedFingerprint, canonicalCheckoutEnabled: mapping.canonicalCheckoutEnabled } } }], { session: mongoSession });
    return { applied: true, replay: false, fingerprint: expectedFingerprint };
  }); } finally { await mongoSession.endSession(); }
}
module.exports = { parseVenueMapping, previewVenueMapping, applyVenueMapping, requiredIndexesPresent };
