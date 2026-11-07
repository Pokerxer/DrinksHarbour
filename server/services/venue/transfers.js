'use strict';
// services/venue/transfers.js — S6 floor transfers: whole-visit table moves and
// table release (design §2 "Move visit" / "Release table").
//
// MOVE VISIT: the SAME visit moves to free table(s) in the same location. One
// transaction swaps visit.tableIds + any arrived VenueCapacityClaim table binding
// + the held tab's `holdMetadata.tableId`. Availability reuses the capacity
// services' existing guards — the claim-side conflict check is the
// `assertWalkInCapacity` overlap filter, and table occupancy is the same
// `status:'available', currentTabId:null` conditional update the session/capacity
// paths use (no new guard algorithm). Held order/bill/lines/consumption/
// preparation references key on the visit id and are never rewritten.
//
// RELEASE TABLE: ends the visit's floor commitment (tables, capacity claim, held
// tab) with an explicit outcome and never touches Booking documents. The
// UNRESOLVED-COMMITMENT predicate, derived from the visit state machine
// (billing.js/settlement.js) — a visit is releasable only when NONE of these hold:
//   1. any acceptedLine with firedQuantity > 0  → FIRED_LINES_LOCKED (fired work
//      cannot be discarded by a release);
//   2. any acceptedLine remaining on the tab    → BLOCK_RELEASE (§2: "explicitly
//      emptied of lines+parties"; accepted obligations never vanish silently);
//   3. billOrder set / state 'closing'          → BLOCK_RELEASE (a frozen bill has
//      a venueSettlementState — unpaid|payment_pending|receipt_verified|settled|
//      needs_review — and settlement owns canonical completion; release never
//      adjudicates money);
//   4. a pending VenuePaymentAttempt            → BLOCK_RELEASE (collection in
//      flight would race the settlement machine);
//   5. partyGroup set                           → BLOCK_RELEASE (leaving a group
//      is the explicit `leave-party` command — §2 joins contract);
//   6. state !== 'open' (after the closed no-op) → STATE_CHANGED.
// A released visit is state 'closed' with tableIds [] — a further release is an
// idempotent no-op. An arrived capacity claim is ended HERE (releaseClaim()
// refuses 'arrived' by design — the canonical completion IS this command); the
// Booking document itself is never read for writing nor modified (settlement
// alone completes bookings).
//
// MOVE SELECTED LINES (S6 Task 3): N units of an UNFIRED, UNALLOCATED accepted line
// move to another visit (same tenant+location): source row quantity −N (a fully-moved
// row is removed; schema min 1); destination line appended/extended with
// choices/choiceKey/note/courseId/frozenRecipeVersion verbatim + firing-history
// semantics. Retained-row ordering (lines.js): fired units are retained first and
// never reducible, so ANY firedQuantity > 0 on the source row blocks (FIRED_LINES_LOCKED)
// — moved units are always a fully unfired row's unfired tail. LINE_ALLOCATED predicate
// (derived from the payer/allocation structures): VenuePaymentAllocation anchors money
// to {billOrder, receipt} with NO line identity, so the ONLY structure referencing a
// bill LINE is VenuePayerPortion.acceptedLines ({lineId, revision} entries from
// money-rules.itemPortions; payers.js matches them lineId+revision for
// LINE_ALREADY_RESERVED). Blocking predicate = an ACTIVE-OR-APPLIED VenuePayerPortion on
// the source visit whose acceptedLines reference the moved lineId — {pending} ∪
// {applied} ∪ {reserved, expiresAt > now} (payer-balances active states plus applied
// money; 'expired'/'failed' portions promise nothing — releasePortion expires them to
// FREE the reservation); deliberately lineId-only (revision-blind): a re-stamped
// revision must never evade the block. Destination context differs (presetRef
// identity/version, serviceMode, posShopId — the shop drives pricelist pick, i.e. price
// derivation) OR the destination-derived price differs from the source's frozen unit
// price → explicit `repricingConsent` (REPRICING_CONSENT_REQUIRED); with consent (or
// identical context+price) destination units ride the priceVenueLines ADDITIONS path
// with the DESTINATION visit's context. Destination rows merge under the consolidate
// discipline (parties.js): same S1 identity + agreeing derived price + note extends an
// UNFIRED destination row (revision stands; moved courseId applied per the lines.js
// submittedCourse rule); otherwise a distinct appended row — fresh monotonic revision,
// `<lineId>-m<revision>` re-stamp on collision; fired destination rows never absorb
// units (rounds/preparation key on frozen lineId+revision snapshots). ZERO consumption
// events / preparation items / stock effects / receipts are created or changed by any
// move. ZERO-QUANTITY DECISION: zero-quantity is a client bug, not a retryable intent →
// INVALID_INPUT (400), never a silent no-op; a same-source move IS the idempotent no-op
// (such entries are dropped; a batch of only those touches nothing). BOTH visit versions
// are checked: source via expectedVersion, destination via the optional per-entry
// `toExpectedVersion` (absent = fresh read inside the transaction — the parties.js
// target precedent). Both sides mutate in ONE runVenueOperation transaction: a failure
// persists neither.
//
// Realtime: moves/releases create no preparation/consumption surfaces, so there
// is nothing to emit on the venue-prep room; floor views recover through the
// existing open-visits cursor polling (no new event idiom).
const Session = require('../../models/VenueServiceSession'); const Order = require('../../models/Order');
const Table = require('../../models/POSTable'); const Claim = require('../../models/VenueCapacityClaim');
const Attempt = require('../../models/VenuePaymentAttempt'); const Portion = require('../../models/VenuePayerPortion');
const { visitContext, linesDTO } = require('./lines'); const { sessionDTO } = require('./service-sessions');
const { priceVenueLines } = require('./pricing');
const { runVenueOperation } = require('./operations'); const { requireId, fail } = require('./errors');
const { id } = require('./eligibility');

const OUTCOMES = ['cleared', 'transferred_away'];
const sameSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
const validTables = tableIds => Array.isArray(tableIds) && tableIds.length >= 1 && tableIds.length <= 20 && new Set(tableIds).size === tableIds.length;
// Free/claim helpers reuse the capacity services' exact conditional-update style.
async function freeTable(visit, tableId, mongoSession) {
  const row = await Table.findOne({ _id: tableId, tenant: id(visit.tenant), location: visit.location }).session(mongoSession);
  if (!row) return;
  if (row.currentTabId && id(row.currentTabId) === id(visit.heldOrder)) {
    const freed = await Table.updateOne({ _id: row._id, tenant: id(visit.tenant), location: visit.location, currentTabId: visit.heldOrder }, { $set: { currentTabId: null, status: 'available' }, $inc: { venueVersion: 1 } }, { session: mongoSession });
    if (!freed.modifiedCount) fail('TABLE_REVIEW_REQUIRED', 'Table ownership changed; do not free another visit');
  } else if (!(row.status === 'available' && !row.currentTabId)) {
    fail('TABLE_REVIEW_REQUIRED', 'Table ownership changed; do not free another visit');
  }
}
async function claimTable(visit, tableId, mongoSession) {
  const claimed = await Table.updateOne({ _id: tableId, tenant: id(visit.tenant), location: visit.location, status: 'available', currentTabId: null }, { $set: { status: 'occupied', currentTabId: visit.heldOrder }, $inc: { venueVersion: 1 } }, { session: mongoSession });
  if (!claimed.modifiedCount) fail('STATE_CHANGED', 'Table is occupied or changed; refresh');
}
async function holdOf(visit, tenantId, mongoSession) {
  const hold = await Order.findOne({ _id: visit.heldOrder, tenant: tenantId, venueServiceSession: visit._id, status: 'hold' }).session(mongoSession);
  if (!hold) fail('STATE_CHANGED', 'Held tab changed');
  return hold;
}
// The visit's capacity claim, if any (unique {tenant, booking}; walk-ins have none).
const claimOf = (visit, tenantId, mongoSession) => visit.booking
  ? Claim.findOne({ tenant: tenantId, booking: visit.booking, location: visit.location }).session(mongoSession)
  : null;

async function moveVisit(args) {
  const { tenantId, sessionId, actor, targetTableIds, expectedVersion, idempotencyKey } = args;
  requireId(sessionId);
  if (!validTables(targetTableIds)) fail('INVALID_TABLES', 'Choose 1–20 distinct tables', 400);
  targetTableIds.forEach(requireId);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) fail('STATE_CHANGED', 'Visit changed; refresh');
  const before = await visitContext({ tenantId, sessionId, actor, action: 'transfers.write' });
  return runVenueOperation({ tenantId, locationId: id(before.location), actor: before.actor, operation: 'visit.move', key: idempotencyKey,
    payload: { sessionId, targetTableIds, expectedVersion }, execute: async ({ mongoSession }) => {
      const { visit } = await visitContext({ tenantId, sessionId, actor, action: 'transfers.write', mongoSession });
      if (visit.state === 'closed') fail('STATE_CHANGED', 'Closed visits cannot move');
      if (visit.version !== expectedVersion) fail('STATE_CHANGED', 'Visit changed; refresh');
      if (sameSet(visit.tableIds.map(String), targetTableIds)) return linesDTO(visit); // same-source no-op
      const tables = await Table.find({ _id: { $in: targetTableIds }, tenant: tenantId, location: visit.location }).session(mongoSession).lean();
      if (tables.length !== targetTableIds.length) fail('NOT_FOUND', 'Table not found at this location', 404);
      // Same capacity-guard style as walk-in arrival: another active claim may
      // not hold the target tables during this visit's seating window.
      await require('./capacity-bookings').assertWalkInCapacity({ tenantId, locationId: id(visit.location), tableIds: targetTableIds, bookingId: id(visit.booking) || undefined, now: new Date() }, mongoSession);
      const claim = await claimOf(visit, tenantId, mongoSession);
      const hold = await holdOf(visit, tenantId, mongoSession);
      for (const oldId of visit.tableIds) await freeTable(visit, oldId, mongoSession);
      for (const newId of targetTableIds) await claimTable(visit, newId, mongoSession);
      if (claim && claim.state === 'arrived') { claim.resources = [...targetTableIds].sort(); claim.version++; await claim.save({ session: mongoSession }); }
      visit.tableIds = targetTableIds; visit.version++;
      await visit.save({ session: mongoSession });
      hold.holdMetadata = { ...hold.holdMetadata, tableId: targetTableIds[0] }; hold.markModified('holdMetadata');
      hold.$locals.deferAccounting = true; await hold.save({ session: mongoSession });
      return linesDTO(visit);
    } });
}

async function releaseTable(args) {
  const { tenantId, sessionId, actor, outcome, expectedVersion, idempotencyKey } = args;
  requireId(sessionId);
  if (!OUTCOMES.includes(outcome)) fail('INVALID_INPUT', 'Release outcome must be cleared or transferred_away', 400);
  const before = await visitContext({ tenantId, sessionId, actor, action: 'transfers.write' });
  return runVenueOperation({ tenantId, locationId: id(before.location), actor: before.actor, operation: 'table.release', key: idempotencyKey,
    payload: { sessionId, outcome, expectedVersion }, execute: async ({ mongoSession }) => {
      const { visit } = await visitContext({ tenantId, sessionId, actor, action: 'transfers.write', mongoSession });
      if (visit.state === 'closed' && !(visit.tableIds || []).length) return sessionDTO(visit); // already released — idempotent no-op
      if (visit.billOrder || visit.state === 'closing') fail('BLOCK_RELEASE', 'Bill is frozen; settlement owns completion');
      if (visit.state !== 'open') fail('STATE_CHANGED', `Visit is ${visit.state}; only open visits release their table`);
      if (visit.version !== expectedVersion) fail('STATE_CHANGED', 'Visit changed; refresh');
      if ((visit.acceptedLines || []).some(l => (l.firedQuantity || 0) > 0)) fail('FIRED_LINES_LOCKED', 'Fired lines cannot be released away');
      if ((visit.acceptedLines || []).length) fail('BLOCK_RELEASE', 'Tab still has accepted lines; move or remove them first');
      if (await Attempt.exists({ tenant: tenantId, session: visit._id, state: 'pending' }).session(mongoSession)) fail('BLOCK_RELEASE', 'A payment attempt is in flight');
      if (visit.partyGroup) fail('BLOCK_RELEASE', 'Leave the party group before releasing the table');
      const claim = await claimOf(visit, tenantId, mongoSession);
      if (claim && claim.state !== 'released') { claim.state = 'released'; claim.version++; await claim.save({ session: mongoSession }); }
      const hold = await holdOf(visit, tenantId, mongoSession);
      for (const tableId of visit.tableIds) await freeTable(visit, tableId, mongoSession);
      hold.status = 'cancelled'; hold.paymentStatus = 'failed'; hold.cancelReason = `Venue table released (${outcome})`;
      hold.$locals.deferAccounting = true; await hold.save({ session: mongoSession });
      visit.tableIds = []; visit.state = 'closed'; visit.closedAt = visit.closedAt || new Date(); visit.version++;
      await visit.save({ session: mongoSession });
      return sessionDTO(visit);
    } });
}

// S6 Task 3 — move selected lines lives in ./move-lines.js (the plan's 300-line
// file limit; split with a pointer, AGENTS.md rule) and is re-exported below, so
// `require('./transfers').moveLines` and the route surface are unchanged.

module.exports = { moveVisit, releaseTable, moveLines: require('./move-lines').moveLines, freeTable };
