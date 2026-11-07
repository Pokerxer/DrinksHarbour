'use strict';
// services/venue/waste.js — waste ledger read + re-export of the approved drain (S2, spec §2).
//
// The drain coordination (VenueWasteEvent creation + OpenedBottle remainingMl drain in
// ONE transaction, reason enum, required approval, remainder-loss policy) lives in
// pour-stock.js and is deliberately NOT duplicated here: waste.js re-exports
// pour-stock.recordWaste unchanged, so there is exactly one implementation of the drain
// to keep drift-free and identical input yields one identical event shape through either
// module surface. Waste is recorded through the pour-stock ops — S2 has no POST waste
// route (spec §7 non-goal; corrections UI is S3).
//
// listWaste is a newest-first read of the tenant's VenueWasteEvent ledger, scoped by
// {tenant} and by the location that anchors the call (venue-ops eligibility requires the
// location anchor, so in practice every read is tenant+location scoped; the query keeps
// the location term composable). Eligibility rides loadVenueContext('stock.open'): the
// same staff surface that may open/pour/waste may read the waste ledger — no new
// eligibility ACTIONS invented. Pagination follows the venue cursor idiom
// (money-cases/menu-candidates): `after` cursor, limit+1 probe, `next` only when a full
// page came back.

const WasteEvent = require('../../models/VenueWasteEvent');
const { loadVenueContext } = require('./context');
const { requireId, fail } = require('./errors');
const { id } = require('./eligibility');

// The approved drain is pour-stock's coordination — re-exported, never reimplemented.
module.exports.recordWaste = require('./pour-stock').recordWaste;

function wasteDTO(row) {
  return {
    id: id(row),
    locationId: id(row.location),
    consumptionEventId: row.consumptionEvent == null ? null : id(row.consumptionEvent),
    lineId: row.lineId == null ? null : row.lineId,
    reason: row.reason,
    quantity: row.quantity,
    unit: row.unit,
    approvedBy: id(row.approvedBy),
    policyConsentRef: row.policyConsentRef == null ? null : row.policyConsentRef,
    actorId: id(row.actor),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

// Newest-first waste ledger. { tenantId, locationId, actor, pagination?: {after?, limit?} }.
async function listWaste(args) {
  const context = await loadVenueContext({ ...args, action: 'stock.open' });
  void context; // eligibility enforced at context load; the anchor scopes the query below
  requireId(args.locationId);
  if (args.pagination && args.pagination.after) requireId(args.pagination.after);
  const size = args.pagination && args.pagination.limit != null ? Number(args.pagination.limit) : 50;
  if (!Number.isInteger(size) || size < 1 || size > 100) fail('INVALID_INPUT', 'Invalid page size', 400);
  const rows = await WasteEvent.find({ tenant: args.tenantId, location: args.locationId,
    ...(args.pagination && args.pagination.after ? { _id: { $lt: args.pagination.after } } : {}) })
    .sort({ createdAt: -1, _id: -1 }).limit(size + 1).lean();
  return { items: rows.slice(0, size).map(wasteDTO), next: rows.length > size ? id(rows[size - 1]) : null };
}
module.exports.listWaste = listWaste;
