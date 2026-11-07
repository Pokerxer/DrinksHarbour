'use strict';
// services/venue/host-alerts.js — Phase-4 E2 Task 3: VIP host alerts.
//
// afterRedeem runs POST-COMMIT (admissions.redeem calls it after its
// runVenueOperation resolves): the redemption row already exists, so the alert is
// derived from COMMITTED state and its persistence can be IDEMPOTENT — the unique
// {tenant, redemptionRef} index turns a replayed redemption into a no-op. A vip-kind
// entitlement redemption persists a VenueHostAlert and emits it to the
// venue-host room for the location (services/pos.realtime venueHostRoom). The alert
// and its emitted payload carry PERMITTED INFO ONLY (name/partySize/action +
// provenance) — never spend, restrictedNote, phone or guest history. Alert failures
// NEVER fail the admission (the guest is already through the door): afterRedeem
// swallows persistence errors into a returned null; the redemption row is the truth.
//
// listHostAlerts rides 'guestlists.read' (host-floor staff surface, scoped to the
// occurrence, permitted info only) — the realtime room is a convenience channel,
// never the system of record.

const Alert = require('../../models/VenueHostAlert');
const Redemption = require('../../models/VenueAdmissionRedemption');
const Entitlement = require('../../models/VenueAdmissionEntitlement');
const GuestList = require('../../models/VenueEventGuestList');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');

function alertDTO(input) {
  const row = input && typeof input.toObject === 'function' ? input.toObject({ minimize: false }) : input;
  return {
    id: id(row), occurrenceId: id(row.occurrence), kind: row.kind,
    name: row.permittedInfo?.name || null, partySize: row.permittedInfo?.partySize || null, action: row.permittedInfo?.action || null,
    provenance: row.provenance ? { flaggedBy: id(row.provenance.flaggedBy), reason: row.provenance.reason, at: new Date(row.provenance.at).toISOString() } : null,
    acknowledged: !!row.acknowledgedAt,
    acknowledgedBy: row.acknowledgedBy ? id(row.acknowledgedBy) : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

async function afterRedeem({ tenantId, locationId, occurrenceId, token, req }) {
  try {
    requireId(tenantId); requireId(locationId); requireId(occurrenceId);
    if (typeof token !== 'string' || !token) return null;
    const redemption = await Redemption.findOne({ tenant: tenantId, token, kind: 'entry' }).lean();
    if (!redemption) return null;
    const existing = await Alert.findOne({ tenant: tenantId, redemptionRef: redemption._id }).lean();
    if (existing) return alertDTO(existing); // idempotent replay
    const entitlement = await Entitlement.findOne({ tenant: tenantId, 'tokens.token': token }).lean();
    if (!entitlement || entitlement.kind !== 'vip') return null;
    const guestList = entitlement.sourceRef ? await GuestList.findOne({ _id: entitlement.sourceRef, tenant: tenantId }).lean() : null;
    if (!guestList?.vip?.flagged) return null;
    const [alert] = await Alert.create([{
      tenant: tenantId, location: locationId, occurrence: occurrenceId,
      guestListRef: guestList._id, redemptionRef: redemption._id, kind: 'vip_arrival',
      permittedInfo: { name: entitlement.label || guestList.name, partySize: redemption.guests, action: 'admitted' },
      provenance: { flaggedBy: guestList.vip.by, reason: guestList.vip.reason, at: guestList.vip.at },
    }]);
    require('../pos.realtime').emitToVenueHost(req, tenantId, locationId, 'venue.vip.arrived', {
      alertId: id(alert), occurrenceId, name: alert.permittedInfo.name, partySize: alert.permittedInfo.partySize,
      action: alert.permittedInfo.action, provenance: {
        flaggedBy: id(guestList.vip.by), reason: guestList.vip.reason, at: new Date(guestList.vip.at).toISOString(),
      },
    });
    return alertDTO(alert);
  } catch (error) {
    // best-effort by design (see header) — the admission is already committed
    if (error && error.code === 11000) return null; // concurrent duplicate persistence
    if (error && ['INVALID_ID', 'NOT_FOUND'].includes(error.code)) return null;
    return null;
  }
}

async function listHostAlerts(args) {
  await loadContext(args);
  if (args.after) requireId(args.after);
  const rows = await Alert.find({ tenant: args.tenantId, location: args.locationId, occurrence: requireId(args.occurrenceId), ...(args.after ? { _id: { $lt: requireId(args.after) } } : {}) }).sort({ createdAt: -1, _id: -1 }).limit(51).lean();
  return { items: rows.slice(0, 50).map(alertDTO), next: rows.length > 50 ? id(rows[49]) : null };
}

async function loadContext(args) {
  const context = await require('./context').loadVenueContext({ ...args, action: 'guestlists.read' });
  return context;
}

module.exports = { alertDTO, afterRedeem, listHostAlerts };
