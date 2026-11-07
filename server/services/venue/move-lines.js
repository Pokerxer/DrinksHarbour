'use strict';
// services/venue/move-lines.js — S6 Task 3: move selected lines between visits
// (design §2 "Move selected lines"). Split out of transfers.js at the plan's
// 300-line file limit; transfers.js re-exports moveLines so the route surface and
// `require('./transfers').moveLines` are unchanged.
//
// N units of an UNFIRED, UNALLOCATED accepted line move to another visit (same
// tenant+location): source row quantity −N (a fully-moved row is removed; schema
// min 1); destination line appended/extended with choices/choiceKey/note/courseId/
// frozenRecipeVersion verbatim + firing-history semantics. Retained-row ordering
// (lines.js): fired units are retained first and never reducible, so ANY
// firedQuantity > 0 on the source row blocks (FIRED_LINES_LOCKED) — moved units are
// always a fully unfired row's unfired tail. LINE_ALLOCATED predicate (derived from
// the payer/allocation structures): VenuePaymentAllocation anchors money postings to
// {billOrder, receipt} with NO line identity, so the ONLY structure referencing a
// bill LINE is VenuePayerPortion.acceptedLines ({lineId, revision} entries from
// money-rules.itemPortions; payers.js matches them lineId+revision for
// LINE_ALREADY_RESERVED). Blocking predicate = an ACTIVE-OR-APPLIED VenuePayerPortion
// on the source visit whose acceptedLines reference the moved lineId — {pending} ∪
// {applied} ∪ {reserved, expiresAt > now} (payer-balances active states plus applied
// money; 'expired'/'failed' portions promise nothing — releasePortion expires them
// to FREE the reservation); deliberately lineId-only (revision-blind): a re-stamped
// revision must never evade the block. Destination context differs (presetRef
// identity/version, serviceMode, posShopId — the shop drives pricelist pick, i.e.
// price derivation) OR the destination-derived price differs from the source's
// frozen unit price → explicit `repricingConsent` (REPRICING_CONSENT_REQUIRED); with
// consent (or identical context+price) destination units ride the priceVenueLines
// ADDITIONS path with the DESTINATION visit's context. Destination rows merge under
// the consolidate discipline (parties.js): same S1 identity + agreeing derived price
// + note extends an UNFIRED destination row (revision stands; moved courseId applied
// per the lines.js submittedCourse rule); otherwise a distinct appended row — fresh
// monotonic revision, `<lineId>-m<revision>` re-stamp on collision; fired destination
// rows never absorb units (rounds/preparation key on frozen lineId+revision
// snapshots). ZERO consumption events / preparation items / stock effects / receipts
// are created or changed by any move. ZERO-QUANTITY DECISION: zero-quantity is a
// client bug, not a retryable intent → INVALID_INPUT (400), never a silent no-op; a
// same-source move IS the idempotent no-op (such entries are dropped; a batch of
// only those touches nothing). BOTH visit versions are checked: source via
// expectedVersion, destination via the optional per-entry `toExpectedVersion` (absent
// = fresh read inside the transaction — the parties.js target precedent). Both sides
// mutate in ONE runVenueOperation transaction: a failure persists neither.
const Session = require('../../models/VenueServiceSession'); const Order = require('../../models/Order');
const Portion = require('../../models/VenuePayerPortion');
const { visitContext, linesDTO } = require('./lines');
const { priceVenueLines } = require('./pricing');
const { runVenueOperation } = require('./operations'); const { requireId, fail } = require('./errors');
const { id } = require('./eligibility');
const menuAcceptance = require('./menu-acceptance');

// The S1 accepted-line merge identity (lines.js key()).
const identityKeyOf = line => `${id(line.subproduct)}:${id(line.size)}:${menuAcceptance.acceptedChoiceKey(line)}`;
// Destination context comparison — immutable per-visit service snapshot (preset
// identity+version, service mode) plus the POS shop binding (drives pricelist pick).
const sameContext = (a, b) => id(a.presetRef?.presetId) === id(b.presetRef?.presetId)
  && (a.presetRef?.version || 0) === (b.presetRef?.version || 0)
  && (a.serviceMode || undefined) === (b.serviceMode || undefined)
  && (a.posShopId || null) === (b.posShopId || null);
// The LINE_ALLOCATED predicate — see the module header for the derivation.
async function allocatedLineIds(visit, tenantId, lineIds, mongoSession) {
  const portions = await Portion.find({ tenant: tenantId, session: visit._id,
    $or: [{ state: 'pending' }, { state: 'applied' }, { state: 'reserved', expiresAt: { $gt: new Date() } }],
    'acceptedLines.lineId': { $in: lineIds } }).select('acceptedLines').session(mongoSession).lean();
  return new Set(portions.flatMap(portion => (portion.acceptedLines || []).map(ref => ref.lineId)));
}
// Held-tab rebuild — the lines.js set-time mapping verbatim (items + cartItems from
// the visit's accepted lines); both sides of a move re-target their tab.
async function rebuildHold(visit, tenantId, mongoSession) {
  const hold = await Order.findOne({ _id: visit.heldOrder, tenant: tenantId, status: 'hold', venueServiceSession: visit._id }).session(mongoSession);
  if (!hold) fail('STATE_CHANGED', 'Held tab changed');
  const lines = visit.acceptedLines.map(l => l.toObject ? l.toObject() : l);
  hold.items = lines.map(l => ({ product: l.product, subproduct: l.subproduct, size: l.size, tenant: tenantId, quantity: l.quantity, priceAtPurchase: 0, itemSubtotal: 0 }));
  hold.holdMetadata = { ...hold.holdMetadata, serviceSessionId: id(visit), cartItems: lines.map(l => ({
    ...(l.choices?.length ? { choices: l.choices.map(c => ({ groupId: c.groupId, optionId: c.optionId, ...(c.quantity !== undefined ? { quantity: c.quantity } : {}) })) } : {}),
    ...(l.note !== undefined ? { note: l.note } : {}), ...(l.choiceKey ? { choiceKey: l.choiceKey } : {}),
    productId: id(l.product), subProductId: id(l.subproduct), sizeId: id(l.size), name: l.name, price: l.unitPriceMinor / 100, quantity: l.quantity, lineId: l.lineId, revision: l.revision })) };
  hold.markModified('holdMetadata'); hold.$locals.deferAccounting = true; await hold.save({ session: mongoSession });
}

async function moveLines(args) {
  const { tenantId, sessionId, actor, expectedVersion, lines, repricingConsent, idempotencyKey } = args;
  requireId(sessionId);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) fail('STATE_CHANGED', 'Visit changed; refresh');
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 100) fail('INVALID_LINES', 'Choose 1–100 lines to move', 400);
  const seenLines = new Set();
  for (const entry of lines) {
    if (!entry || typeof entry !== 'object') fail('INVALID_LINES', 'Invalid move entry', 400);
    // lineIds are service-generated UUID strings (priceAcceptedLine), NOT ObjectIds —
    // shape-check them as strings; toSessionId IS an ObjectId (requireId).
    if (typeof entry.lineId !== 'string' || !entry.lineId.trim() || entry.lineId.length > 100) fail('INVALID_INPUT', 'Invalid line id', 400);
    requireId(entry.toSessionId);
    if (!Number.isInteger(entry.revision) || entry.revision < 1) fail('INVALID_INPUT', 'Line revision required', 400);
    if (!Number.isInteger(entry.quantity) || entry.quantity < 1) fail('INVALID_INPUT', 'Move quantity must be a positive integer', 400);
    if (seenLines.has(entry.lineId)) fail('INVALID_INPUT', 'One command cannot move the same line twice', 400);
    seenLines.add(entry.lineId);
    if (entry.toExpectedVersion !== undefined && (!Number.isInteger(entry.toExpectedVersion) || entry.toExpectedVersion < 0)) fail('STATE_CHANGED', 'Destination changed; refresh');
  }
  const before = await visitContext({ tenantId, sessionId, actor, action: 'transfers.write' });
  return runVenueOperation({ tenantId, locationId: id(before.location), actor: before.actor, operation: 'lines.move', key: idempotencyKey,
    payload: { sessionId, expectedVersion, lines, repricingConsent: repricingConsent === true }, execute: async ({ mongoSession }) => {
      const { visit: source, tenant, location, actor: currentActor } = await visitContext({ tenantId, sessionId, actor, action: 'transfers.write', mongoSession });
      if (source.state !== 'open') fail('STATE_CHANGED', 'Visit is closing; line changes are blocked');
      if (source.version !== expectedVersion) fail('STATE_CHANGED', 'Visit changed; refresh');
      const moves = lines.filter(entry => entry.toSessionId !== sessionId); // same-source no-op entries
      if (!moves.length) return linesDTO(source);
      const rowOf = entry => (source.acceptedLines || []).find(l => l.lineId === entry.lineId);
      const unitKeyOf = row => `${identityKeyOf(row)}:${row.note || ''}`;
      // Expanded paid extras have no canonical parent allocation. Moving either
      // side alone could orphan or duplicate the charge, so require that owner first.
      const addonRefs = new Set((source.acceptedLines || []).flatMap(row => row.choiceSnapshots || [])
        .filter(choice => choice.type === 'addon')
        .map(choice => `${id(choice.subProductId)}:${id(choice.sizeId)}`));
      for (const entry of moves) {
        const row = rowOf(entry);
        if (!row) fail('NOT_FOUND', 'Line not found on this visit', 404);
        if ((row.choiceSnapshots || []).some(choice => choice.type === 'addon') ||
            addonRefs.has(`${id(row.subproduct)}:${id(row.size)}`))
          fail('VENUE_UNSUPPORTED_CART', 'Priced extras require a linked parent transfer; keep these items on their original visit');
        if (row.revision !== entry.revision) fail('STATE_CHANGED', 'Line changed; refresh');
        if ((row.firedQuantity || 0) > 0) fail('FIRED_LINES_LOCKED', 'Fired lines cannot move between visits');
        if (entry.quantity > row.quantity) fail('INVALID_INPUT', 'Move quantity exceeds the line quantity', 400);
      }
      const allocated = await allocatedLineIds(source, tenantId, moves.map(entry => entry.lineId), mongoSession);
      if (moves.some(entry => allocated.has(entry.lineId))) fail('LINE_ALLOCATED', 'A payer portion already allocates this line');
      const destinations = new Map();
      for (const entry of moves) {
        if (destinations.has(entry.toSessionId)) continue;
        const dest = await Session.findOne({ _id: entry.toSessionId, tenant: tenantId }).session(mongoSession);
        if (!dest || id(dest.location) !== id(source.location)) fail('NOT_FOUND', 'Destination visit not found at this location', 404);
        if (dest.state !== 'open' || dest.billOrder) fail('STATE_CHANGED', 'Destination visit is not open');
        const expected = moves.find(candidate => candidate.toSessionId === entry.toSessionId).toExpectedVersion;
        if (expected !== undefined && dest.version !== expected) fail('STATE_CHANGED', 'Destination changed; refresh');
        destinations.set(entry.toSessionId, dest);
      }
      // Repricing: destination units ride the priceVenueLines additions path with the
      // DESTINATION visit's context (its posShopId drives the pricelist pick); inputs
      // coalesce per identity+note (the setSessionLines batch rule), consent-gated per unit.
      const priced = new Map();
      const chunk = parts => { const out = []; for (let i = 0; i < parts.length; i += 100) out.push(parts.slice(i, i + 100)); return out; };
      for (const [destId, dest] of destinations) {
        const group = moves.filter(entry => entry.toSessionId === destId);
        const inputs = new Map();
        for (const entry of group) {
          const row = rowOf(entry); const unitKey = unitKeyOf(row);
          if (inputs.has(unitKey)) inputs.get(unitKey).input.quantity += entry.quantity;
          else inputs.set(unitKey, { key: unitKey, input: { subProductId: id(row.subproduct), sizeId: id(row.size), quantity: entry.quantity, note: row.note || undefined, choices: row.choices?.length ? row.choices.map(c => ({ groupId: c.groupId, optionId: c.optionId, ...(c.quantity !== undefined ? { quantity: c.quantity } : {}) })) : undefined } });
        }
        const list = [...inputs.values()];
        const results = (await Promise.all(chunk(list).map(part => priceVenueLines({ tenant, location, actor: { ...currentActor, posShopId: dest.posShopId }, lines: part.map(item => item.input), mongoSession })))).flat();
        const perDest = new Map(list.map((item, index) => [item.key, results[index]]));
        for (const entry of group) {
          const row = rowOf(entry);
          if ((!sameContext(source, dest) || perDest.get(unitKeyOf(row)).unitPriceMinor !== row.unitPriceMinor) && repricingConsent !== true) fail('REPRICING_CONSENT_REQUIRED', 'Destination context reprices this line; explicit consent is required', 409);
        }
        priced.set(destId, perDest);
      }
      // Apply — both sides in THIS one transaction; any failure above persists neither.
      for (const [destId, dest] of destinations) {
        const perDest = priced.get(destId);
        const group = moves.filter(entry => entry.toSessionId === destId);
        let nextRevision = Math.max(dest.lineVersion || 0, ...(dest.acceptedLines || []).map(l => l.revision), 0);
        const taken = new Set((dest.acceptedLines || []).map(l => l.lineId));
        for (const entry of group) {
          const row = rowOf(entry); const unit = perDest.get(unitKeyOf(row));
          // Merge discipline (parties.js): same identity + agreeing derived price + note
          // extends an UNFIRED destination row (revision stands); else a distinct appended
          // row — frozen fields verbatim, fresh monotonic revision, lineId re-stamp.
          const match = (dest.acceptedLines || []).find(candidate => (candidate.firedQuantity || 0) === 0 && identityKeyOf(candidate) === identityKeyOf(row)
            && menuAcceptance.sameAcceptedMetadata(candidate, row)
            && candidate.unitPriceMinor === unit.unitPriceMinor && candidate.taxRate === unit.taxRate && (candidate.note || undefined) === (row.note || undefined));
          if (match) {
            match.quantity += entry.quantity; match.netMinor = match.unitPriceMinor * match.quantity;
            match.taxMinor = Math.round(match.unitPriceMinor * match.quantity * match.taxRate / 100);
            if (row.courseId !== undefined) match.courseId = row.courseId;
            continue;
          }
          const revision = ++nextRevision;
          const lineId = taken.has(row.lineId) ? `${row.lineId}-m${revision}` : row.lineId;
          taken.add(lineId);
          // Build the plain object first, then strip unset array paths BEFORE the
          // Mongoose cast initialises them (lines.js landed-row discipline).
          const landed = { product: row.product, subproduct: row.subproduct, size: row.size, name: row.name, quantity: entry.quantity,
            unitPriceMinor: unit.unitPriceMinor, taxRate: unit.taxRate, netMinor: unit.unitPriceMinor * entry.quantity, taxMinor: Math.round(unit.unitPriceMinor * entry.quantity * unit.taxRate / 100),
            costMinor: unit.costMinor, acceptedAt: new Date(), priceRule: unit.priceRule, firedQuantity: 0, lineId, revision };
          Object.assign(landed, menuAcceptance.acceptedMetadata(row.toObject()));
          if (row.choices?.length) landed.choices = row.choices.map(c => ({ groupId: c.groupId, optionId: c.optionId, ...(c.quantity !== undefined ? { quantity: c.quantity } : {}) }));
          if (row.note !== undefined) landed.note = row.note;
          if (row.choiceKey && row.choiceKey !== 'p') landed.choiceKey = row.choiceKey;
          if (row.courseId !== undefined) landed.courseId = row.courseId;
          if (row.frozenRecipeVersion) landed.frozenRecipeVersion = { version: row.frozenRecipeVersion.version, recipe: row.frozenRecipeVersion.recipe };
          dest.acceptedLines.push(landed);
        }
        // Unknown courseIds auto-register on the destination (setSessionLines rule).
        if (!Array.isArray(dest.courses)) dest.courses = [];
        const known = new Set(dest.courses.map(c => c.courseId));
        for (const entry of group) { const row = rowOf(entry);
          if (row.courseId && !known.has(row.courseId)) { known.add(row.courseId); dest.courses.push({ courseId: row.courseId, order: dest.courses.length, state: 'planned' }); } }
        dest.lineVersion = nextRevision; dest.version++;
        await dest.save({ session: mongoSession });
        await rebuildHold(dest, tenantId, mongoSession);
        for (const entry of group) { // source-side reduction (fired tail is safe — see header)
          const row = rowOf(entry); const remaining = row.quantity - entry.quantity;
          if (remaining <= 0) source.acceptedLines.splice(source.acceptedLines.indexOf(row), 1);
          else { row.quantity = remaining; row.netMinor = row.unitPriceMinor * remaining; row.taxMinor = Math.round(row.unitPriceMinor * remaining * row.taxRate / 100); }
        }
      }
      source.version++;
      await source.save({ session: mongoSession });
      await rebuildHold(source, tenantId, mongoSession);
      return linesDTO(source);
    } });
}

module.exports = { moveLines };
