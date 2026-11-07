'use strict';
// services/venue/parties.js — S6 party grouping & bill consolidation (design §2
// "Join parties" / "Consolidate bills").
//
// JOIN: operational grouping only. The caller gains an additive `partyGroup
// {groupId, joinedAt}`; when the target visit is ungrouped it gains the SAME new
// opaque group id (its own joinedAt), otherwise the caller joins the target's
// existing group. Bills, deposits and payer privacy stay SEPARATE (10 §3) — no
// money or stock state is read or written. A visit already in a group refuses
// (STATE_CHANGED): leaving is the explicit `leaveParty` command, which removes
// only the caller's link (idempotent when ungrouped). The caller is
// expectedVersion-checked; the target is read fresh inside the transaction
// (the §3 route contract carries one expectedVersion) and stamped only when
// ungrouped, so a concurrent change to the target can never be overwritten.
//
// CONSOLIDATE (explicit manager action only — tenant_owner/tenant_admin, the S3
// location-manager fallback): folds the URL visit ("source") into `intoSessionId`
// (the survivor) BEFORE any collection. REFUSAL predicate — consolidation is
// refused with BILL_ALREADY_COLLECTED when EITHER visit shows any collected or
// finalised financial effect: a frozen bill (billOrder set — it carries a
// venueSettlementState), any VenuePaymentReceipt (purpose venue_bill OR the
// arrival-linked venue_deposit receipts of advance-credit.linkAtArrival — a
// deposit stranded on a closed visit could never apply at the survivor's freeze,
// so deposits count as collected money per the §4 non-goal "no automated
// consolidation of deposits/advances"), or any VenueStockEffect in state
// 'consumed' (finalised settlement stock). The coordinated-payment surface for
// such visits is the EXISTING separate bills — a paid sale is never rewritten.
// Fired lines refuse with FIRED_LINES_LOCKED — fired work cannot move: its
// consumption events (`fire:<visit>:<lineId>:<revision>`) and preparation ledger
// key on the source visit id, and a move must never create or duplicate events.
// Consumption events on the SURVIVOR would equally mean fired work on that side,
// so the receipt/consumed-effect refusal above covers the "either visit" stance.
//
// The merge itself follows the S1 line-identity rules (`sub:size:choiceKey`):
// a source line whose identity AND frozen unitPriceMinor/taxRate match a survivor
// line with an agreeing note merges its quantity into that row (revision kept —
// the S1 retained-row semantics); everything else lands as a distinct appended
// line with frozen choices/choiceKey/note/courseId/frozenRecipeVersion verbatim,
// re-stamped with a fresh monotonic revision on the survivor (never repriced).
// A collided client-chosen lineId is re-stamped deterministically
// (`<lineId>-m<revision>`) to keep line ids unique per visit. Unknown courseIds
// auto-register on the survivor's course registry (the setSessionLines rule).
// Held orders: the survivor keeps its ONE held Order (items + cartItems rebuilt
// from the merged lines, the lines.js mapping verbatim); the source's held tab is
// cancelled (the settlement idiom) and the source's tables are freed with the
// capacity-style guards; an arrived capacity claim of the source ends like a
// release (a closed visit must not hold capacity). The source visit closes
// emptied (state 'closed', acceptedLines/courses []). One transaction; replays
// are runVenueOperation no-ops; a same-source consolidate is a no-op.
const crypto = require('node:crypto');
const Session = require('../../models/VenueServiceSession'); const Order = require('../../models/Order');
const Receipt = require('../../models/VenuePaymentReceipt'); const Effect = require('../../models/VenueStockEffect');
const { visitContext, linesDTO } = require('./lines');
const { runVenueOperation } = require('./operations'); const { requireId, fail } = require('./errors');
const { id } = require('./eligibility'); const { freeTable } = require('./transfers');
const menuAcceptance = require('./menu-acceptance');

// The S1 accepted-line merge identity (lines.js key()).
const identityKey = line => `${id(line.subproduct)}:${id(line.size)}:${menuAcceptance.acceptedChoiceKey(line)}`;
const lineTotals = line => ({ netMinor: line.unitPriceMinor * line.quantity, taxMinor: Math.round(line.unitPriceMinor * line.quantity * line.taxRate / 100) });

async function join(args) {
  const { tenantId, sessionId, targetSessionId, actor, expectedVersion, idempotencyKey } = args;
  requireId(sessionId); requireId(targetSessionId);
  const context = await visitContext({ tenantId, sessionId, actor, action: 'parties.write' });
  return runVenueOperation({ tenantId, locationId: id(context.location), actor: context.actor, operation: 'party.join', key: idempotencyKey,
    payload: { sessionId, targetSessionId, expectedVersion }, execute: async ({ mongoSession }) => {
      const { visit } = await visitContext({ tenantId, sessionId, actor, action: 'parties.write', mongoSession });
      if (visit.state === 'closed') fail('STATE_CHANGED', 'Closed visits cannot change parties');
      if (visit.version !== expectedVersion) fail('STATE_CHANGED', 'Visit changed; refresh');
      if (sessionId === targetSessionId) return linesDTO(visit); // same-source no-op
      if (visit.partyGroup) fail('STATE_CHANGED', 'Visit is already in a party group; leave it first');
      const target = await Session.findOne({ _id: targetSessionId, tenant: tenantId }).session(mongoSession);
      if (!target || id(target.location) !== id(visit.location)) fail('NOT_FOUND', 'Visit not found at this location', 404);
      if (target.state !== 'open') fail('STATE_CHANGED', 'Target visit is not open');
      const groupId = target.partyGroup?.groupId || crypto.randomUUID();
      visit.partyGroup = { groupId, joinedAt: new Date() }; visit.version++;
      await visit.save({ session: mongoSession });
      if (!target.partyGroup) { target.partyGroup = { groupId, joinedAt: new Date() }; target.version++; await target.save({ session: mongoSession }); }
      return linesDTO(visit);
    } });
}

async function leaveParty(args) {
  const { tenantId, sessionId, actor, expectedVersion, idempotencyKey } = args;
  requireId(sessionId);
  const context = await visitContext({ tenantId, sessionId, actor, action: 'parties.write' });
  return runVenueOperation({ tenantId, locationId: id(context.location), actor: context.actor, operation: 'party.leave', key: idempotencyKey,
    payload: { sessionId, expectedVersion }, execute: async ({ mongoSession }) => {
      const { visit } = await visitContext({ tenantId, sessionId, actor, action: 'parties.write', mongoSession });
      if (visit.state === 'closed') fail('STATE_CHANGED', 'Closed visits cannot change parties');
      if (visit.version !== expectedVersion) fail('STATE_CHANGED', 'Visit changed; refresh');
      if (!visit.partyGroup) return linesDTO(visit); // idempotent no-op
      visit.set('partyGroup', undefined); visit.markModified('partyGroup'); visit.version++;
      await visit.save({ session: mongoSession });
      return linesDTO(visit);
    } });
}

async function consolidate(args) {
  const { tenantId, sessionId, intoSessionId, actor, expectedVersion, idempotencyKey } = args;
  requireId(sessionId); requireId(intoSessionId);
  // Manager gate — the S3 location-manager fallback (eligibility.js manager
  // semantics): consolidation is a strong floor action, staff 'parties.write'
  // alone is not enough. context.js re-reads the live user role, so the check
  // below runs against the authoritative role.
  const context = await visitContext({ tenantId, sessionId, actor, action: 'parties.write' });
  if (!['tenant_owner', 'tenant_admin'].includes(context.actor.role)) fail('VENUE_PERMISSION_DENIED', 'Consolidation requires a location manager', 403);
  return runVenueOperation({ tenantId, locationId: id(context.location), actor: context.actor, operation: 'party.consolidate', key: idempotencyKey,
    payload: { sessionId, intoSessionId, expectedVersion }, execute: async ({ mongoSession }) => {
      const { visit: source, actor: currentActor } = await visitContext({ tenantId, sessionId, actor, action: 'parties.write', mongoSession });
      if (!['tenant_owner', 'tenant_admin'].includes(currentActor.role)) fail('VENUE_PERMISSION_DENIED', 'Consolidation requires a location manager', 403);
      if (source.state !== 'open') fail('STATE_CHANGED', `Visit is ${source.state}; consolidation needs an open visit`);
      if (source.version !== expectedVersion) fail('STATE_CHANGED', 'Visit changed; refresh');
      if (sessionId === intoSessionId) return linesDTO(source); // same-source no-op
      if ((source.acceptedLines || []).some(l => (l.firedQuantity || 0) > 0)) fail('FIRED_LINES_LOCKED', 'Fired lines cannot be consolidated');
      const survivor = await Session.findOne({ _id: intoSessionId, tenant: tenantId }).session(mongoSession);
      if (!survivor || id(survivor.location) !== id(source.location)) fail('NOT_FOUND', 'Visit not found at this location', 404);
      // Coordinated-payment refusal — ANY collected/finalised financial effect on
      // EITHER visit (see module header). The existing separate bills are the
      // surface for such visits; money is never rewritten here. Checked before
      // the survivor state gate: a closing/closed survivor HAS a frozen bill.
      if (source.billOrder || survivor.billOrder) fail('BILL_ALREADY_COLLECTED', 'A bill is already frozen; keep the separate bills');
      if (await Receipt.exists({ tenant: tenantId, session: { $in: [source._id, survivor._id] } }).session(mongoSession)) fail('BILL_ALREADY_COLLECTED', 'Money was already collected on one of these visits');
      if (await Effect.exists({ tenant: tenantId, session: { $in: [source._id, survivor._id] }, state: 'consumed' }).session(mongoSession)) fail('BILL_ALREADY_COLLECTED', 'Consumed stock exists on one of these visits');
      if (survivor.state !== 'open') fail('STATE_CHANGED', 'Surviving visit is not open');
      const survivorHold = await Order.findOne({ _id: survivor.heldOrder, tenant: tenantId, venueServiceSession: survivor._id, status: 'hold' }).session(mongoSession);
      if (!survivorHold) fail('STATE_CHANGED', 'Held tab changed');

      // Merge the source's unfired lines into the survivor under the S1 identity.
      let nextRevision = Math.max(survivor.lineVersion || 0, ...survivor.acceptedLines.map(l => l.revision), 0);
      const taken = new Set(survivor.acceptedLines.map(l => l.lineId));
      for (const line of source.acceptedLines) {
        const match = survivor.acceptedLines.find(row => (row.firedQuantity || 0) === 0 && identityKey(row) === identityKey(line) && menuAcceptance.sameAcceptedMetadata(row, line) && row.unitPriceMinor === line.unitPriceMinor && row.taxRate === line.taxRate && (row.note || undefined) === (line.note || undefined));
        if (match) { match.quantity += line.quantity; Object.assign(match, lineTotals(match)); continue; }
        const revision = ++nextRevision;
        const lineId = taken.has(line.lineId) ? `${line.lineId}-m${revision}` : line.lineId;
        taken.add(lineId);
        survivor.acceptedLines.push({ ...line.toObject(), lineId, revision });
      }
      // Unknown courseIds auto-register in insertion order (setSessionLines rule).
      if (!Array.isArray(survivor.courses)) survivor.courses = [];
      const known = new Set(survivor.courses.map(c => c.courseId));
      for (const line of source.acceptedLines) if (line.courseId && !known.has(line.courseId)) {
        known.add(line.courseId);
        survivor.courses.push({ courseId: line.courseId, order: survivor.courses.length, state: 'planned' });
      }
      survivor.lineVersion = nextRevision; survivor.version++;
      await survivor.save({ session: mongoSession });
      // ONE held Order for the survivor: rebuild items/cartItems from the merged
      // lines exactly like the lines.set retarget; cancel the source's tab.
      const merged = survivor.acceptedLines.map(l => l.toObject());
      survivorHold.items = merged.map(l => ({ product: l.product, subproduct: l.subproduct, size: l.size, tenant: tenantId, quantity: l.quantity, priceAtPurchase: 0, itemSubtotal: 0 }));
      survivorHold.holdMetadata = { ...survivorHold.holdMetadata, cartItems: merged.map(l => {
        const cart = { productId: id(l.product), subProductId: id(l.subproduct), sizeId: id(l.size), name: l.name, price: l.unitPriceMinor / 100, quantity: l.quantity, lineId: l.lineId, revision: l.revision };
        if (l.choices?.length) cart.choices = l.choices.map(c => ({ groupId: c.groupId, optionId: c.optionId, ...(c.quantity !== undefined ? { quantity: c.quantity } : {}) }));
        if (l.note !== undefined) cart.note = l.note;
        if (l.choiceKey) cart.choiceKey = l.choiceKey;
        return cart;
      }) };
      survivorHold.markModified('holdMetadata'); survivorHold.$locals.deferAccounting = true; await survivorHold.save({ session: mongoSession });
      const sourceHold = await Order.findOne({ _id: source.heldOrder, tenant: tenantId, venueServiceSession: source._id, status: 'hold' }).session(mongoSession);
      if (sourceHold) { sourceHold.status = 'cancelled'; sourceHold.paymentStatus = 'failed'; sourceHold.cancelReason = `Consolidated into ${id(survivorHold)}`; sourceHold.$locals.deferAccounting = true; await sourceHold.save({ session: mongoSession }); }
      for (const tableId of source.tableIds) await freeTable(source, tableId, mongoSession);
      const sourceClaim = source.booking ? await require('../../models/VenueCapacityClaim').findOne({ tenant: tenantId, booking: source.booking, location: source.location }).session(mongoSession) : null;
      if (sourceClaim && sourceClaim.state === 'arrived') { sourceClaim.state = 'released'; sourceClaim.version++; await sourceClaim.save({ session: mongoSession }); }
      source.acceptedLines = []; source.courses = []; source.state = 'closed'; source.closedAt = source.closedAt || new Date(); source.version++;
      await source.save({ session: mongoSession });
      return linesDTO(survivor);
    } });
}

module.exports = { join, leaveParty, consolidate };
