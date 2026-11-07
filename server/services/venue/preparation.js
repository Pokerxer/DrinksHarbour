'use strict';
// services/venue/preparation.js — station routing at fire + the item advancement
// ledger (S3 Task 4, spec §2/§3).
//
// Routing (routeFiredItems, called from fireSessionRound AFTER consumption
// succeeded, inside the same transaction): each fired round item's menu-item
// `category` maps to the one station at the location owning that category
// (first by name for determinism when a category is double-owned); unmapped
// categories fall back to the location's default station; with neither, the
// item is still created UNROUTED (stationId absent — surfaced downstream, never
// silently lost). The resolved stationId is snapshotted additively on the round
// item too. A failed consumption (STOCK_UNAVAILABLE) aborts the whole operation
// before any item exists.
//
// Advancement (advance): a strict append-only ledger — pending → preparing →
// ready → served, ONE step per call, served terminal, stateHistory entries are
// only ever appended (never rewritten). It NEVER touches stock or consumption:
// remakes are new S2 waste/consumption actions linked via history `ref`.
// Authorization is two-layered:
// 1. base venue eligibility for the NEW 'preparation.advance' action
//    (loadVenueContext — manager or venue staff with pos:sell), then
// 2. station ownership: non-managers must be in the owning station's staffIds
//    (one station cannot complete another's work); tenant_owner/tenant_admin
//    are the location-manager fallback and may advance any item, including
//    unrouted ones (documented choice: the strongest existing manager
//    semantics in eligibility.js, matching how experience.* resolves managers).
// Idempotency rides runVenueOperation like every other venue command — a
// replayed advance is a no-op that appends nothing.
//
// Kitchen READ surface (S3 Task 5, spec §3 timers): listSessionPreparation is the
// venue-scoped variant of the POS kitchen-active board — it EXTENDS, never forks,
// the POS kitchen endpoints (pos.controller.js keeps its own board for legacy
// rounds; canonical visits read here). Each item is joined with its station's
// alertThresholdMins and carries the derived staleness: `stale` is STRICTLY
// `now - firedAt > threshold` (threshold boundary is not stale), `waitingMs` the
// exact elapsed time; unrouted items are included and flagged (`unrouted: true`,
// `thresholdMins: null`, never guessed stale). Read eligibility is the
// 'preparation.read' action (staff viewing) enforced through visitContext —
// like every staff read (bill/recipes/presets) it carries NO rate limiter.
//
// Realtime: `venue.preparation.changed` rides the EXISTING pos.realtime socket
// idiom — a location-scoped room (`venue-prep:<tenant>:<location>`), emitted
// POST-COMMIT from the controllers that own the express req (course fire via
// service-sessions.controller + pos-adapters dispatch, advance via
// preparation.controller). Payloads are itemDTO-shaped identity only (names,
// quantities, stationId, state) — consistent with what linesDTO already carries;
// no guest PII is added.
//
// Persisted events (12 §4): the codebase has NO persisted event outbox for venue
// operations today, so S3 deliberately does NOT build one — the socket broadcast
// above is ephemeral and clients recover by refetching (a deployment without
// websockets simply finds out on its next poll, exactly like kds:update).
// Persisting venue.preparation.changed post-commit remains future work per 12 §4.
const mongoose = require('mongoose');
const PreparationItem = require('../../models/VenuePreparationItem');
const Station = require('../../models/PreparationStation');
const { runVenueOperation } = require('./operations');
const { loadVenueContext } = require('./context');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');

const CHAIN = ['pending', 'preparing', 'ready', 'served'];
const lower = value => `${String(value)}`.toLowerCase();

function itemDTO(item) {
  return { id: id(item), sessionId: id(item.session), roundId: id(item.roundId), lineId: item.lineId, revision: item.revision,
    locationId: id(item.location), name: item.name, quantity: item.quantity, stationId: item.stationId ? id(item.stationId) : undefined,
    state: item.state, firedAt: item.firedAt,
    stateHistory: (item.stateHistory || []).map(h => ({ from: h.from, to: h.to, actor: id(h.actor), ...(h.reason !== undefined ? { reason: h.reason } : {}), ...(h.ref !== undefined ? { ref: h.ref } : {}), at: h.at })) };
}

// The one station owning `category`, else the location's default, else null.
function resolveStation(stations, category, categoryId) {
  if(categoryId !== undefined)return stations.find(station=>(station.categoryIds||[]).includes(categoryId))||stations.find(station=>station.isDefault)||null;
  if (category !== undefined) {
    const owner = stations.find(station => (station.categories || []).includes(category));
    if (owner) return owner;
  }
  return stations.find(station => station.isDefault) || null;
}

// One preparation item per fired line ({tenant, lineId, revision} unique — a
// line revision fires exactly once). The pre-check + duplicate-key catch mirror
// consumptions.createEvent: the unique index is the in-transaction race belt.
async function createPrepItem(doc, mongoSession) {
  const existing = await PreparationItem.findOne({ tenant: doc.tenant, lineId: doc.lineId, revision: doc.revision }).select('_id').session(mongoSession).lean();
  if (existing) return;
  try { await PreparationItem.create([doc], { session: mongoSession }); }
  catch (error) { if (error && error.code === 11000) return; throw error; }
}

async function routeFiredItems({ tenantId, locationId, visit, round, lines, menuIndex = null, actor, mongoSession }) {
  void actor; // routing is fire-authoritative; the caller's eligibility action ('round.fire') already gates it
  const roundId = round.roundId || (round.roundId = new mongoose.Types.ObjectId());
  const byLine = new Map(round.items.map(item => [`${item.lineId}:${item.revision}`, item]));
  const index = menuIndex || await require('./lines').menuIndexOf({ tenantId, locationId, mongoSession });
  const stations = await Station.find({ tenant: tenantId, location: locationId }).sort({ name: 1 }).session(mongoSession).lean();
  for (const line of lines) {
    const roundItem = byLine.get(`${line.lineId}:${line.revision}`);
    const menuItem = index ? index.get(`${lower(line.subproduct)}:${lower(line.size)}`) : null;
    const station = resolveStation(stations, menuItem?.category, line.categoryId || menuItem?.categoryId);
    if (station && roundItem) roundItem.stationId = station._id; // additive round snapshot
    await createPrepItem({ tenant: tenantId, location: locationId, session: id(visit), roundId, lineId: line.lineId, revision: line.revision,
      name: roundItem?.name, quantity: roundItem?.quantity, ...(station ? { stationId: station._id } : {}), firedAt: round.firedAt }, mongoSession);
  }
}

async function authorizeAdvance({ tenantId, item, actor, mongoSession }) {
  if (['tenant_owner', 'tenant_admin'].includes(actor.role)) return; // location-manager fallback
  if (!item.stationId) fail('VENUE_PERMISSION_DENIED', 'Unrouted items are advanced by a location manager');
  const station = await Station.findOne({ _id: item.stationId, tenant: tenantId }).session(mongoSession).lean();
  if (!station) fail('NOT_FOUND', 'Preparation station not found', 404);
  if (!(station.staffIds || []).some(staffId => String(staffId) === String(actor.userId))) fail('VENUE_PERMISSION_DENIED', 'Only the owning station can advance its items');
}

async function advance({ tenantId, locationId, itemId, to, reason, ref, actor, idempotencyKey, now = new Date() }) {
  requireId(itemId);
  if (!CHAIN.includes(to)) fail('INVALID_INPUT', 'to must be one of pending|preparing|ready|served', 400);
  if (reason !== undefined && (typeof reason !== 'string' || !reason.trim() || reason.length > 200)) fail('INVALID_INPUT', 'Reason must be at most 200 characters', 400);
  if (ref !== undefined && (typeof ref !== 'string' || !ref.trim() || ref.length > 200)) fail('INVALID_INPUT', 'Ref must be at most 200 characters', 400);
  const item = await PreparationItem.findOne({ _id: itemId, tenant: tenantId }).lean();
  if (!item) fail('NOT_FOUND', 'Preparation item not found', 404);
  if (locationId !== undefined && id(item.location) !== locationId) fail('NOT_FOUND', 'Preparation item not found at this location', 404);
  const context = await loadVenueContext({ tenantId, locationId: id(item.location), actor, action: 'preparation.advance' });
  return runVenueOperation({ tenantId, locationId: id(item.location), actor: context.actor, operation: 'preparation.advance', key: idempotencyKey,
    payload: { itemId, to, ...(reason !== undefined ? { reason } : {}), ...(ref !== undefined ? { ref } : {}) }, execute: async ({ mongoSession }) => {
      const live = await PreparationItem.findOne({ _id: itemId, tenant: tenantId }).session(mongoSession);
      if (!live) fail('NOT_FOUND', 'Preparation item not found', 404);
      await authorizeAdvance({ tenantId, item: live, actor: context.actor, mongoSession });
      const expected = CHAIN[CHAIN.indexOf(live.state) + 1];
      if (!expected) fail('INVALID_INPUT', 'Served items are terminal', 400);
      if (to !== expected) fail('INVALID_INPUT', `Next preparation state is ${expected}`, 400);
      const from = live.state;
      live.state = to;
      live.stateHistory.push({ from, to, actor: context.actor.userId, ...(reason !== undefined ? { reason } : {}), ...(ref !== undefined ? { ref } : {}), at: now });
      await live.save({ session: mongoSession });
      // S4 amendment hook (minimal): an actor correction linked to a `ref`
      // (waste/remake) ALSO emits an `amendment` job to the owning station,
      // referencing the item and superseding the round's unacknowledged print
      // job. Rides the SAME operation transaction — a failed operation appends
      // no history and creates no job. No extra endpoints.
      if (ref !== undefined) await require('./print-jobs').emitAmendment({ tenantId, item: live, reason, ref, to, mongoSession });
      return itemDTO(live);
    } });
}

// Kitchen read projection (Task 5): the itemDTO plus the timer fields the board
// renders. Staleness is strict — a threshold boundary moment is not yet stale —
// and an unrouted item never guesses a threshold.
function readDTO(item, thresholdMins, now) {
  const waitingMs = Math.max(0, now.getTime() - new Date(item.firedAt).getTime());
  return { ...itemDTO(item), unrouted: !item.stationId, thresholdMins, waitingMs,
    stale: thresholdMins != null && waitingMs > thresholdMins * 60000 };
}

// The session's preparation board: every item ever fired on the visit (including
// unrouted ones), joined with the station alertThresholdMins. `now` is injectable
// so timers are testable and a whole board renders against one consistent instant.
async function listSessionPreparation({ tenantId, sessionId, actor, stationId, now = new Date() }) {
  requireId(sessionId);
  if (stationId !== undefined) requireId(stationId);
  const { visit } = await require('./lines').visitContext({ tenantId, sessionId, actor, action: 'preparation.read' });
  const [items, stations] = await Promise.all([
    PreparationItem.find({ tenant: tenantId, session: visit._id, ...(stationId !== undefined ? { stationId } : {}) }).sort({ firedAt: 1, _id: 1 }).lean(),
    Station.find({ tenant: tenantId, location: visit.location }).select('alertThresholdMins').lean(),
  ]);
  const thresholds = new Map(stations.map(station => [String(station._id), station.alertThresholdMins]));
  return { sessionId: id(visit), locationId: id(visit.location), now: now.toISOString(),
    items: items.map(item => readDTO(item, item.stationId ? thresholds.get(String(item.stationId)) ?? null : null, now)) };
}

// Safe post-commit broadcast payload for one fired round (item creation): the
// itemDTO identity fields only — the caller already holds the round DTO returned
// by fireSessionRound, so no extra query and no guest PII beyond what lines
// already carry (names/quantities/choices; no guest identity anywhere).
function roundChangedPayload(sessionId, round) {
  return { sessionId: id(sessionId), roundId: id(round.roundId), firedAt: round.firedAt,
    items: (round.items || []).map(item => ({ lineId: item.lineId, revision: item.revision, name: item.name, quantity: item.quantity, ...(item.stationId ? { stationId: id(item.stationId) } : {}) })) };
}

module.exports = { routeFiredItems, advance, listSessionPreparation, roundChangedPayload, itemDTO, resolveStation };
