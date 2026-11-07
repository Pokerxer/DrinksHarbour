'use strict';
const crypto = require('node:crypto');
const Session = require('../../models/VenueServiceSession'); const Order = require('../../models/Order');
const Table = require('../../models/POSTable'); const Booking = require('../../models/Booking');
const { loadVenueContext } = require('./context'); const { runVenueOperation } = require('./operations');
const { businessDate } = require('./clock'); const { requireId, fail } = require('./errors'); const { id } = require('./eligibility');
function sessionDTO(row) {
  return { id: id(row), tenantId: id(row.tenant), locationId: id(row.location), bookingId: id(row.booking) || undefined,
    heldOrderId: id(row.heldOrder), billOrderId: id(row.billOrder) || undefined, businessDate: row.businessDate,
    state: row.state, version: row.version, lineVersion: row.lineVersion, identityVersion: 1,
    // S3 additive: preset snapshot echo — present only on visits opened with a preset,
    // so legacy sessions keep the exact previous DTO shape.
    ...(row.serviceMode || row.presetRef ? {
      serviceMode: row.serviceMode || undefined,
      presetId: row.presetRef ? id(row.presetRef.presetId) : undefined,
      presetVersion: row.presetRef ? row.presetRef.version : undefined,
    } : {}),
    // S3 additive: ordered course registry echo — present only once courses exist.
    ...(row.courses?.length ? { courses: row.courses.map(c => ({ courseId: c.courseId, name: c.name, order: c.order, state: c.state })) } : {}),
    // S6 additive: party-group echo — present only while the visit is grouped.
    ...(row.partyGroup ? { partyGroup: { groupId: row.partyGroup.groupId, joinedAt: row.partyGroup.joinedAt } } : {}),
    // S6 additive: table ids echo — floor commands (move/join/consolidate/release)
    // and the workspace panel need the visit's current tables alongside its state;
    // an empty list is meaningful (released visit), so the key is always present.
    tableIds: (row.tableIds || []).map(t => id(t)) };
}
async function ensureServiceSession(args) {
  const { tenantId, locationId, actor, bookingId, tableIds, expectedTableVersions, posSessionId, presetId, serviceMode, guest, idempotencyKey, now = new Date() } = args;
  if (!Array.isArray(tableIds) || tableIds.length < 1 || tableIds.length > 20 || new Set(tableIds).size !== tableIds.length) fail('INVALID_TABLES', 'Choose 1–20 distinct tables', 400);
  tableIds.forEach(requireId);
  if (!Array.isArray(expectedTableVersions) || expectedTableVersions.length !== tableIds.length || expectedTableVersions.some(v => !Number.isInteger(v) || v < 0)) fail('STATE_CHANGED', 'Table versions are required');
  if (bookingId) requireId(bookingId);
  const context = await loadVenueContext({ tenantId, locationId, actor, action: 'session.create' });
  return runVenueOperation({ tenantId, locationId, actor: context.actor, operation: 'session.ensure', key: idempotencyKey,
    payload: { bookingId, tableIds, expectedTableVersions, posSessionId, expectedBookingVersion: args.expectedBookingVersion, presetId, serviceMode, guest }, execute: async ({ mongoSession }) => {
      await loadVenueContext({ tenantId, locationId, actor, action: 'session.create', mongoSession });
      // S3 preset snapshot: location match + mode ∈ allowedModes + hours window + required
      // guest fields; any failure rejects creation. Returns null without a preset.
      const presetRef = await require('./presets').resolveForSession({ tenantId, locationId, presetId, serviceMode, guest, now, timezone: context.location.venueServices.timezone }, mongoSession);
      let booking;
      if (bookingId) {
        booking = await Booking.findOne({ _id: bookingId, tenant: tenantId }).session(mongoSession);
        if (!booking || (booking.location && id(booking.location) !== locationId)) fail('NOT_FOUND', 'Booking not found at this location', 404);
        if (booking.requestMode === 'request_only' && !Number.isInteger(args.expectedBookingVersion)) fail('STATE_CHANGED','Reviewed request version is required');
        if (booking.requestMode === 'request_only' && args.expectedBookingVersion !== undefined && booking.requestVersion !== args.expectedBookingVersion) fail('STATE_CHANGED', 'Request changed; reload before seating');
        booking.location = locationId;
        if (booking.serviceSession) {
          const existing = await Session.findOne({ _id: booking.serviceSession, tenant: tenantId, location: locationId }).session(mongoSession);
          if (!existing) fail('VISIT_LINK_CONFLICT', 'Booking visit needs review');
          return sessionDTO(existing);
        }
        if ((!['confirmed', 'checked_in'].includes(booking.status) && !(booking.status === 'pending' && booking.requestMode === 'request_only' && booking.requestState === 'reviewed')) || booking.checkoutStartedAt || booking.acquisitionAuthority !== 'server') fail('VISIT_LINK_CONFLICT', 'Review booking status, origin and prior checkout before seating');
      }
      if(booking?.financialPolicy?.minimumMinor>0&&booking.financialTermsVersion!==booking.financialPolicy.version)fail('FINANCIAL_TERMS_NOT_ACCEPTED','Guest must accept the disclosed minimum-spend policy before arrival');
      await require('./capacity-bookings').arriveClaim({ booking, tableIds, tenantId, locationId, now, mongoSession });
      await require('./capacity-bookings').assertWalkInCapacity({ tenantId, locationId, tableIds, bookingId, now }, mongoSession);
      if (booking?.requestMode === 'request_only') {
        const physical = await Table.find({ _id: { $in: tableIds }, tenant: tenantId, location: locationId }).select('seats').session(mongoSession).lean();
        if (physical.length !== tableIds.length) fail('NOT_FOUND', 'Table not found at this location', 404);
        if (physical.reduce((sum, table) => sum + (table.seats || 0), 0) < booking.partySize) fail('INSUFFICIENT_SEATS', 'Selected tables do not have enough seats; choose other available tables', 409);
      }
      let drawer;
      if (posSessionId) {
        requireId(posSessionId);
        drawer = await require('../../models/POSSession').findOne({ _id: posSessionId, tenant: tenantId, warehouse: locationId, status: 'open' }).session(mongoSession).lean();
        if (!drawer) fail('NOT_FOUND', 'Open POS session not found at this location', 404);
        const claimedDrawer = await require('../../models/POSSession').updateOne({ _id: drawer._id, tenant: tenantId, status: 'open', warehouse: locationId }, { $inc: { __v: 1 } }, { session: mongoSession });
        if (!claimedDrawer.modifiedCount) fail('DRAWER_NOT_OPEN', 'Drawer changed while opening visit');
      }
      const sid = new (require('mongoose').Types.ObjectId)();
      const hold = new Order({ orderNumber: `DHV-H-${crypto.randomUUID()}`, tenant: tenantId, source: drawer ? 'pos' : 'manual', status: 'hold',
        paymentStatus: 'pending', paymentMethod: 'cash', items: [], subtotal: 0, totalAmount: 0, shippingFee: 0,
        venueServiceSession: sid, venueIdentityVersion: 1, posWarehouse: locationId, ...(drawer ? { posSessionId: drawer._id, shopId: drawer.shopId, posStaff: actor.userId } : {}),
        holdMetadata: { tableId: tableIds[0], cartItems: [], firedRounds: [], openedAt: now.toISOString() } });
      hold.$locals.deferAccounting = true; await hold.save({ session: mongoSession });
      for (const pair of tableIds.map((value, i) => ({ value, version: expectedTableVersions[i] })).sort((a, b) => a.value.localeCompare(b.value))) {
        const claimed = await Table.updateOne({ _id: pair.value, tenant: tenantId, location: locationId, venueVersion: pair.version, status: 'available', currentTabId: null }, { $set: { status: 'occupied', currentTabId: hold._id }, $inc: { venueVersion: 1 } }, { session: mongoSession });
        if (!claimed.modifiedCount) fail('STATE_CHANGED', 'Table is occupied or changed; refresh');
      }
      const [visit] = await Session.create([{ _id: sid, tenant: tenantId, location: locationId, createdBy: actor.userId, heldOrder: hold._id,
        ...(booking ? { booking: booking._id } : {}), ...(drawer ? { posSessionId: drawer._id, posShopId: drawer.shopId, posShopName: drawer.shopName, terminalType: drawer.terminalType } : {}), tableIds,
        ...(presetRef ? { presetRef, serviceMode } : {}),
        timezone: context.location.venueServices.timezone, businessDayStartMinutes: context.location.venueServices.businessDayStartMinutes,
        businessDate: businessDate(now, context.location.venueServices.timezone, context.location.venueServices.businessDayStartMinutes),
        openedAt: now, entitlementAtOpen: { plan: context.tenant.plan, capabilities: ['table_management'], subscriptionStatus: context.tenant.subscriptionStatus, writesAllowed: true, verifiedAt: now },
        termsAtOpen: context.tenant.venueSettings.commercialTerms,
        acquisition: { kind: booking?.source === 'discovery' ? 'platform' : 'direct', authority: booking ? 'booking' : 'walk_in_review', bookingId: booking?._id, reviewedBy: actor.userId },
      }], { session: mongoSession });
      await require('./advance-credit').linkAtArrival({ booking, visit, mongoSession });
      if (booking) { booking.serviceSession = visit._id; booking.venueIdentityVersion = 1; booking.status = 'checked_in'; await booking.save({ session: mongoSession }); }
      return sessionDTO(visit);
    } });
}
async function ensureIndexes() {
  await require('../../models/AuditLog').createCollection();
  for (const Model of [Session, require('../../models/VenueOperation'), Order, Table, Booking]) await Model.createIndexes();
}
module.exports = { ensureServiceSession, sessionDTO, ensureIndexes };
