'use strict';
const Session = require('../../models/VenueServiceSession'); const Order = require('../../models/Order');
const Config = require('../../models/VenueLocationProfile'); const menuModifiers = require('./menu-modifiers');
const { loadVenueContext } = require('./context'); const { sessionDTO } = require('./service-sessions');
const { runVenueOperation } = require('./operations'); const { priceVenueLines, validateVenueLineInputs } = require('./pricing');
const { requireId, fail } = require('./errors'); const { id } = require('./eligibility');
const consumptions = require('./consumptions');
const menuAcceptance = require('./menu-acceptance');
// Accepted-line merge identity: sub/size + choice signature. Previously accepted
// lines without choiceKey merge as plain lines ('p' fallback), so legacy merges
// are unchanged. Lines WITH choices never collapse into plain lines of the same
// product/size; two identical parents merge by quantity increments.
const key = line => `${id(line.subproduct)}:${id(line.size)}:${menuAcceptance.acceptedChoiceKey(line)}`;
function linesDTO(visit) {
  return { ...sessionDTO(visit), lines: visit.acceptedLines.map(l => ({ lineId: l.lineId, revision: l.revision, subProductId: id(l.subproduct), sizeId: id(l.size), name: l.name, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, netMinor: l.netMinor, taxMinor: l.taxMinor, firedQuantity: l.firedQuantity,
    choices: l.choices?.length ? l.choices.map(c => ({ groupId: c.groupId, optionId: c.optionId, ...(c.quantity !== undefined ? {quantity:c.quantity}: {}) })) : undefined, note: l.note,
    ...menuAcceptance.acceptedMetadata(l),
    ...(l.courseId ? { courseId: l.courseId } : {}),
    frozenRecipeVersion: l.frozenRecipeVersion ? { version: l.frozenRecipeVersion.version, recipe: id(l.frozenRecipeVersion.recipe) } : undefined })) };
}
async function visitContext({ tenantId, sessionId, actor, action, mongoSession = null }) {
  requireId(sessionId);
  const visit = await Session.findOne({ _id: sessionId, tenant: tenantId }).session(mongoSession);
  if (!visit) fail('NOT_FOUND', 'Visit not found', 404);
  const context = await loadVenueContext({ tenantId, locationId: id(visit.location), actor, action, visit, mongoSession });
  return { ...context, actor: { ...context.actor, posShopId: visit.posShopId }, visit };
}
// The location's published menu, indexed by published sub/size — the priceIndex
// for choice validation. Loaded ONCE per operation, inside the mongo session.
async function menuIndexOf({ tenantId, locationId, mongoSession }) {
  const row = await Config.findOne({ tenant: tenantId, location: locationId }).select('menu version').session(mongoSession).lean();
  return new Map((row?.menu?.sections || []).flatMap(section => (section.items || []).filter(item => item.published).map(item => [`${String(item.subProductId).toLowerCase()}:${String(item.sizeId).toLowerCase()}`, {...item,menuConfigVersion:row.version}])));
}
// Menu-aware expansion: parents that add units must satisfy their published
// menu (assertValidSelection throws CHOICE_REQUIRED / CHOICE_NOT_OFFERED /
// CHOICE_INCOMPATIBLE / INVALID_INPUT); each selected priced option expands
// into its OWN ordinary line (own SubProduct/Size, parent quantity). Only
// additions are validated — previously accepted obligations survive catalog
// mutations. Returns incoming units (frozen choices/note/choiceKey) plus the
// expanded option units; same-identity units are coalesced (notes must agree).
async function expandUnits(units, previous, tenantId, visit, mongoSession, context) {
  const unitKeyOf = unit => `${String(unit.subProductId).toLowerCase()}:${String(unit.sizeId).toLowerCase()}:${unit.choiceKey}`;
  const totalOf = unit => previous.filter(line => key(line) === unitKeyOf(unit)).reduce((sum, line) => sum + line.quantity, 0);
  const lower = value => `${String(value)}`.toLowerCase();
  // The published menu is loaded ONCE per operation, inside the mongo session,
  // when any line adds units or carries choices. Menu-aware validation covers
  // additions only: previously accepted obligations survive catalog mutations.
  const menuIndex = units.some(unit => unit.quantity > totalOf(unit) || unit.choices?.length)
    ? await menuIndexOf({ tenantId, locationId: id(visit.location), mongoSession }) : null;
  const expanded = [];
  for (const unit of units) {
    const menuItem=menuIndex?.get(lower(`${unit.subProductId}:${unit.sizeId}`));
    const v2=menuItem?.modifierSchemaVersion===2||previous.some(l=>id(l.subproduct)===lower(unit.subProductId)&&id(l.size)===lower(unit.sizeId)&&l.servingSnapshot);
    if(!v2&&unit.quantity>totalOf(unit)){
      const size=await require('../../models/Size').findOne({_id:unit.sizeId,tenant:tenantId,subproduct:unit.subProductId}).select('servingSchemaVersion').session(mongoSession).lean();
      if(size?.servingSchemaVersion===2)fail('CHOICE_NOT_OFFERED','This portion is not offered by the published menu',400);
    }
    if(v2){
      if(unit.choices!==undefined)unit.choices=menuAcceptance.normalizeQuantities(unit.choices);
      else if(menuItem&&unit.quantity>totalOf(unit))unit.choices=menuModifiers.assertValidSelection(menuItem,undefined);
      unit.choiceKey=unit.choices?.length?`c:${menuModifiers.choiceSignature(unit.choices)}`:'p';
      const old=previous.filter(line=>key(line)===unitKeyOf(unit));
      const total=old.reduce((sum,line)=>sum+line.quantity,0);
      if(unit.quantity>total){
        Object.assign(unit,await menuAcceptance.acceptMenuItem({item:menuItem,unit,context,menuConfigVersion:menuItem?.menuConfigVersion,mongoSession}));
        unit.choiceKey=unit.choices?.length?`c:${menuModifiers.choiceSignature(unit.choices)}`:'p';
      }
      let remaining=unit.quantity;
      for(const line of old){const take=Math.min(remaining,line.quantity);if(take>0)expanded.push(...menuAcceptance.addonUnits(line.choiceSnapshots,take));remaining-=take;}
      if(remaining>0)expanded.push(...menuAcceptance.addonUnits(unit.choiceSnapshots,remaining));
    }else{
      if(unit.quantity>totalOf(unit)){
        const choices=menuModifiers.assertValidSelection(menuItem,unit.choices);
        unit.choices=choices.length?choices:undefined;unit.choiceKey=choices.length?`c:${menuModifiers.choiceSignature(choices)}`:'p';
      }
      const groups=menuModifiers.groupsOf(menuItem);
      for(const choice of unit.choices||[]){const option=groups.find(g=>g.id===choice.groupId)?.options.find(o=>o.id===choice.optionId);if(option)expanded.push({subProductId:option.subProductId,sizeId:option.sizeId,quantity:unit.quantity,choiceKey:'p'});}
    }
    expanded.push(unit);
  }
  // Repeated identical selections of the same extra merge as ordinary lines:
  // collapse units of one identity before pricing so their quantities sum
  // rather than tripping the duplicate-line batch check.
  const coalesced = new Map();
  for (const unit of expanded) {
    const found = coalesced.get(unitKeyOf(unit));
    if (!found) coalesced.set(unitKeyOf(unit), unit);
    else if ((unit.note || undefined) !== (found.note || undefined)) fail('INVALID_LINES', 'Combine duplicate beverage lines', 400);
    else {found.quantity += unit.quantity;Object.assign(found,menuAcceptance.acceptedMetadata(unit));}
  }
  return [...coalesced.values()];
}
async function setSessionLines(args) {
  const { tenantId, sessionId, actor, expectedVersion, lines, idempotencyKey } = args;
  const before = await visitContext({ ...args, action: 'lines.write' });
  return runVenueOperation({ tenantId, locationId: id(before.location), actor: before.actor, operation: 'lines.set', key: idempotencyKey,
    payload: { sessionId, expectedVersion, lines }, execute: async ({ mongoSession }) => {
      const { visit, tenant, location, actor: currentActor } = await visitContext({ tenantId, sessionId, actor, action: 'lines.write', mongoSession });
      if (visit.state !== 'open') fail('STATE_CHANGED', 'Visit is closing; line changes are blocked');
      if (visit.version !== expectedVersion) fail('STATE_CHANGED', 'Visit changed; refresh');
      validateVenueLineInputs(lines);
      const previous = visit.acceptedLines.map(l => l.toObject()); const retained = [];
      // Submitted units carry everything the client sent (quantity/override) plus
      // the frozen choice metadata; the input-side identity mirrors key() above.
      const units = lines.map(input => ({ subProductId:input.subProductId,sizeId:input.sizeId,quantity:input.quantity,override:input.override,note:input.note,choices:input.choices,courseId:input.courseId,servingVersion:input.servingVersion,choiceKey: input.choices?.length ? `c:${menuModifiers.choiceSignature(input.choices)}` : 'p' }));
      const expanded = await expandUnits(units, previous, tenantId, visit, mongoSession, {tenant,location,actor:currentActor});
      const unitKey = unit => `${String(unit.subProductId).toLowerCase()}:${String(unit.sizeId).toLowerCase()}:${unit.choiceKey}`;
      // Pricing runs on additions; chunks keep the per-batch 1–100 input limit.
      const chunk = list => { const parts = []; for (let i = 0; i < list.length; i += 100) parts.push(list.slice(i, i + 100)); return parts; };
      const additions = expanded.filter(unit => unit.quantity > previous.filter(l => key(l) === unitKey(unit)).reduce((sum, l) => sum + l.quantity, 0));
      const priced = additions.length ? (await Promise.all(chunk(additions).map(part => priceVenueLines({ tenant, location, actor: currentActor, lines: part, mongoSession })))).flat() : [];
      const pricedByUnit = new Map(priced.map((line, index) => [unitKey(additions[index]), { ...line, ...menuAcceptance.acceptedMetadata(additions[index]), choices: additions[index].choices, note: additions[index].note, choiceKey: additions[index].choiceKey }]));
      for (const unit of expanded) {
        const old = previous.filter(l => key(l) === unitKey(unit));
        const fresh = pricedByUnit.get(unitKey(unit));
        const total = old.reduce((sum, l) => sum + l.quantity, 0);
        const fired = old.reduce((sum, l) => sum + (l.firedQuantity || 0), 0);
        if (unit.quantity < fired) fail('FIRED_LINES_LOCKED', 'Fired quantity cannot be removed');
        // S3: course membership rides the SAME identity merge — courseId is NOT
        // part of the merge key. Absent = no change; unfired lines reassign
        // freely; a fired line submitted with a DIFFERENT courseId is rejected,
        // never forked: its kitchen identity was frozen under its course.
        const submittedCourse = unit.courseId;
        let remaining = unit.quantity;
        for (const line of old) {
          if (submittedCourse !== undefined && (line.firedQuantity || 0) > 0 && (line.courseId || undefined) !== submittedCourse) fail('FIRED_LINES_LOCKED', 'Fired line course cannot change');
          if (submittedCourse !== undefined) line.courseId = submittedCourse;
          const take = Math.min(remaining, line.quantity);
          if (take < (line.firedQuantity || 0)) fail('FIRED_LINES_LOCKED', 'Fired line cannot be reduced');
          if (take > 0) retained.push({ ...line, quantity: take, netMinor: line.unitPriceMinor * take, taxMinor: Math.round(line.unitPriceMinor * take * line.taxRate / 100) });
          remaining -= take;
        }
        if (remaining > 0) {
          const landed = { ...fresh, quantity: remaining, revision: old.length + 1, netMinor: fresh.unitPriceMinor * remaining, taxMinor: Math.round(fresh.unitPriceMinor * remaining * fresh.taxRate / 100) };
          if (!landed.choices?.length) delete landed.choices;
          if (landed.note === undefined) delete landed.note;
          if (!landed.choiceKey || landed.choiceKey === 'p') delete landed.choiceKey;
          if (submittedCourse !== undefined) landed.courseId = submittedCourse;
          retained.push(landed);
        }
        if (unit.quantity > total && old.some(l => l.firedQuantity > l.quantity)) fail('STATE_CHANGED');
      }
      // S3: unknown courseIds auto-register on the visit in insertion order
      // (order = position); courseless lines register nothing.
      if (!Array.isArray(visit.courses)) visit.courses = [];
      const knownCourses = new Set(visit.courses.map(c => c.courseId));
      for (const unit of expanded) if (unit.courseId !== undefined && !knownCourses.has(unit.courseId)) {
        knownCourses.add(unit.courseId);
        visit.courses.push({ courseId: unit.courseId, order: visit.courses.length, state: 'planned' });
      }
      if (previous.some(l => l.firedQuantity > 0 && !expanded.some(unit => unitKey(unit) === key(l)))) fail('FIRED_LINES_LOCKED', 'Fired beverage cannot be removed');
      visit.acceptedLines = retained; visit.version++; visit.lineVersion++;
      await visit.save({ session: mongoSession });
      const hold = await Order.findOne({ _id: visit.heldOrder, tenant: tenantId, status: 'hold', venueServiceSession: visit._id }).session(mongoSession);
      if (!hold) fail('STATE_CHANGED', 'Held tab changed');
      hold.items = retained.map(l => ({ product: l.product, subproduct: l.subproduct, size: l.size, tenant: tenantId, quantity: l.quantity, priceAtPurchase: 0, itemSubtotal: 0 }));
      hold.holdMetadata = { ...hold.holdMetadata, cartItems: retained.map(l => {
        const cart = { productId: id(l.product), subProductId: id(l.subproduct), sizeId: id(l.size), name: l.name, price: l.unitPriceMinor / 100, quantity: l.quantity, lineId: l.lineId, revision: l.revision };
        if (l.choices?.length) cart.choices = l.choices.map(c => ({ groupId: c.groupId, optionId: c.optionId, ...(c.quantity !== undefined ? {quantity:c.quantity}: {}) }));
        if (l.note !== undefined) cart.note = l.note;
        if (l.choiceKey) cart.choiceKey = l.choiceKey;
        return cart;
      }), serviceSessionId: sessionId };
      hold.markModified('holdMetadata'); hold.$locals.deferAccounting = true; await hold.save({ session: mongoSession });
      return linesDTO(visit);
    } });
}
async function fireSessionRound(args) {
  const { tenantId, sessionId, actor, expectedVersion, idempotencyKey, courseId } = args;
  const context = await visitContext({ ...args, action: 'round.fire' });
  return runVenueOperation({ tenantId, locationId: id(context.location), actor: context.actor, operation: 'round.fire', key: idempotencyKey, payload: { sessionId, expectedVersion, ...(courseId !== undefined ? { courseId } : {}) }, execute: async ({ mongoSession }) => {
    const { visit } = await visitContext({ ...args, action: 'round.fire', mongoSession });
    if (visit.state !== 'open' || visit.version !== expectedVersion) fail('STATE_CHANGED', 'Visit changed or is closing');
    // S3 course fire: the SAME round path with an optional courseId filter —
    // dedup, consumption, stock and freezing below are untouched. A course
    // fires planned→fired or hold→fired; 'fired' is terminal and repeating it
    // is the same domain error as a course with nothing left to send.
    let course = null;
    if (courseId !== undefined) {
      if (!require('./courses').validCourseId(courseId)) fail('INVALID_INPUT', 'Course id must be a short id of at most 50 characters', 400);
      course = (visit.courses || []).find(c => c.courseId === courseId);
      if (!course) fail('NOT_FOUND', 'Course not found', 404);
      if (course.state === 'fired') fail('NO_UNFIRED_LINES', 'Course was already fired');
    }
    const pending = visit.acceptedLines.filter(l => l.quantity > l.firedQuantity && (courseId === undefined || l.courseId === courseId));
    if (!pending.length) fail('NO_UNFIRED_LINES', 'No unfired items');
    const hold = await Order.findOne({ _id: visit.heldOrder, tenant: tenantId, status: 'hold' }).session(mongoSession);
    if (!hold) fail('STATE_CHANGED');
    // Consumption-at-fire (S2): poured/recipe lines claim their serving stock and
    // ledger ONCE here, BEFORE firedQuantity advances. Failures abort the whole
    // operation, so firedQuantity can never advance past missing pour stock.
    const menuIndex = await menuIndexOf({ tenantId, locationId: id(visit.location), mongoSession });
    await consumptions.applyConsumption({ tenantId, locationId: id(visit.location), visit, lines: pending, menuIndex, actor, mongoSession });
    const rounds = hold.holdMetadata?.firedRounds || [];
    // Round items are a frozen snapshot: base fields plus (additively, only when
    // present) the S1 choice/note/choiceKey identity and the S2 frozen recipe
    // version, so the kitchen feed and S3 course handoff see the whole line.
    const round = { roundNo: rounds.length + 1, firedAt: new Date(), firedBy: actor.userId, status: 'pending', items: pending.map(l => ({ key: `${id(l.subproduct)}_${id(l.size)}`, lineId: l.lineId, revision: l.revision, name: l.name, subProductId: id(l.subproduct), quantity: l.quantity - l.firedQuantity, unitPriceMinor: l.unitPriceMinor,
      ...menuAcceptance.acceptedMetadata(l),
      ...(l.note !== undefined ? { note: l.note } : {}),
      ...(l.choices?.length ? { choices: l.choices.map(c => ({ groupId: c.groupId, optionId: c.optionId, ...(c.quantity !== undefined ? {quantity:c.quantity}: {}) })) } : {}),
      ...(l.choiceKey ? { choiceKey: l.choiceKey } : {}),
      ...(l.frozenRecipeVersion ? { frozenRecipeVersion: { version: l.frozenRecipeVersion.version, recipe: id(l.frozenRecipeVersion.recipe) } } : {}) })) };
    // S3 Task 4: station routing + preparation items, strictly AFTER consumption
    // succeeded — a failed consumption aborts the operation before any item
    // exists. Assigns round.roundId and snapshots stationId on the round items.
    await require('./preparation').routeFiredItems({ tenantId, locationId: id(visit.location), visit, round, lines: pending, menuIndex, actor, mongoSession });
    // S4: one `print` job per involved station, part of the SAME fire commit —
    // a failed fire leaves no job; the firedQuantity guards above mean a
    // replayed fire never emits twice. Readable delta: the payload covers this
    // round's items per station only.
    await require('./print-jobs').emitStationJobs({ tenantId, locationId: id(visit.location), visit, round, mongoSession });
    if (course) course.state = 'fired';
    hold.holdMetadata = { ...hold.holdMetadata, firedRounds: [...rounds, round] }; hold.markModified('holdMetadata'); hold.$locals.deferAccounting = true;
    for (const line of pending) line.firedQuantity = line.quantity;
    visit.version++; await visit.save({ session: mongoSession }); await hold.save({ session: mongoSession });
    return { ...linesDTO(visit), round };
  } });
}
module.exports = { setSessionLines, fireSessionRound, visitContext, linesDTO, menuIndexOf };
