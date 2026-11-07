'use strict';
// Task 5 (S2) — consumption at fire: recipe ledger events, open-bottle pours,
// sealed no-ops, effectKey idempotency, frozen recipe version + choice/note/choiceKey
// riding the round snapshot. Suffix: fire_consumption.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

const codeOf = error => error && error.code;
const assertFails = (promise, code) => assert.rejects(promise, error => codeOf(error) === code);

test('validateMenu accepts pourMl conditionally and legacy payloads stay unchanged', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'fire_menu_validation');
  const { validateMenu } = require('../services/venue/experience');
  const subId = 'd' + 'a'.repeat(23);
  const item = size => ({ subProductId: subId, sizeId: size, published: false });
  // Legacy shape: no pourMl key lands at all (absent key = sealed service)
  const legacy = validateMenu({ sections: [{ id: 's', name: 'S', items: [item('d' + 'a'.repeat(23))] }] });
  assert.equal('pourMl' in legacy.sections[0].items[0], false, 'legacy items must not grow a pourMl key');
  for (const bad of [0, 2001, 1.5, '50', true]) {
    await assertFails((async () => validateMenu({ sections: [{ id: 's', name: 'S', items: [{ ...item('d' + 'a'.repeat(23)), pourMl: bad }] }] }))(), 'INVALID_INPUT');
  }
  const good = validateMenu({ sections: [{ id: 's', name: 'S', items: [
    { ...item('d' + 'a'.repeat(23)), pourMl: 1 }, { ...item('d' + 'b'.repeat(23)), pourMl: 2000 },
  ] }] });
  assert.deepEqual(good.sections[0].items.map(i => i.pourMl), [1, 2000]);
});

test('fire writes consumption ledger events, freezes the active recipe version and drains open bottles FIFO', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'fire_consumption');
  await require('../services/venue/service-sessions').ensureIndexes();
  await require('../models/VenueLocationProfile').createIndexes();
  await require('../models/VenueConsumptionEvent').createIndexes();
  await require('../models/OpenedBottle').createIndexes();

  const args = await fixture();
  const linesService = require('../services/venue/lines');
  const pourStock = require('../services/venue/pour-stock');
  const recipes = require('../services/venue/recipes');
  const experience = require('../services/venue/experience');
  const Session = require('../models/VenueServiceSession');
  const ConsumptionEvent = require('../models/VenueConsumptionEvent');
  const OpenedBottle = require('../models/OpenedBottle');
  const tenant = new mongoose.Types.ObjectId(args.tenantId);

  // Beverages: mixed (recipe output), cocktail (pour), plain (sealed),
  // sp4 (dup-belt pour), sp5 (pour availability), garnish (recipe component), tonic (mixer option).
  const mixed = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const cocktail = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const plain = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const sp4 = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const sp5 = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const garnish = await beverage(args, { currentQuantity: 9, reservedQuantity: 0 });
  const tonic = await beverage(args, { currentQuantity: 9 });
  const oid = () => new mongoose.Types.ObjectId();

  // Recipe component profile lives on the garnish SubProduct
  const profile = await require('../models/IngredientProfile').create({ tenant, subProduct: garnish.subProductId, dimension: 'volume', createdBy: args.actor.userId });
  const recipe = await recipes.createVersion({ tenantId: args.tenantId, locationId: args.locationId, subProductId: mixed.subProductId, sizeId: mixed.sizeId, expectedVersion: 0,
    input: { components: [{ profile: profile.id, quantity: 50, unit: 'ml' }], yieldAssumption: { units: 1 }, costMinorPerUnit: 120 }, actor: args.actor, idempotencyKey: 'recipe-v1' });
  assert.equal(recipe.version, 1);

  // Bar stock: opened bottles of the cocktail pour output (old FIFA—oldest first) and of sp4
  const oldBottle = await OpenedBottle.create({ tenant, location: args.locationId, source: { subProduct: cocktail.subProductId, size: cocktail.sizeId }, contentsMl: 750, remainingMl: 100, openedAt: new Date(Date.now() - 60000), openedBy: args.actor.userId });
  const newBottle = await OpenedBottle.create({ tenant, location: args.locationId, source: { subProduct: cocktail.subProductId, size: cocktail.sizeId }, contentsMl: 750, remainingMl: 500, openedAt: new Date(), openedBy: args.actor.userId });
  const dupBottle = await OpenedBottle.create({ tenant, location: args.locationId, source: { subProduct: sp4.subProductId, size: sp4.sizeId }, contentsMl: 750, remainingMl: 250, openedAt: new Date(), openedBy: args.actor.userId });
  const shortBottle = await OpenedBottle.create({ tenant, location: args.locationId, source: { subProduct: sp5.subProductId, size: sp5.sizeId }, contentsMl: 750, remainingMl: 100, openedAt: new Date(), openedBy: args.actor.userId });

  // Published menu: recipe-parent with modifier choices, pour items, sealed item
  const groups = [{ id: 'mixer', name: 'Mixer', required: true, minSelect: 1, maxSelect: 1, incompatibleWith: [], options: [{ id: 'tonic', label: 'Tonic', subProductId: tonic.subProductId, sizeId: tonic.sizeId }] }];
  const menu = { sections: [{ id: 'drinks', name: 'Drinks', items: [
    { subProductId: mixed.subProductId, sizeId: mixed.sizeId, published: true, modifierGroups: groups },
    { subProductId: cocktail.subProductId, sizeId: cocktail.sizeId, published: true, pourMl: 50 },
    { subProductId: plain.subProductId, sizeId: plain.sizeId, published: true },
    { subProductId: sp4.subProductId, sizeId: sp4.sizeId, published: true, pourMl: 100 },
    { subProductId: sp5.subProductId, sizeId: sp5.sizeId, published: true, pourMl: 50 },
  ] }] };
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, menu: experience.validateMenu(menu) });

  const visit = await require('../services/venue/service-sessions').ensureServiceSession({ ...args, idempotencyKey: 'visit' });
  const accepted = await linesService.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: visit.version, lines: [
    { subProductId: mixed.subProductId, sizeId: mixed.sizeId, quantity: 2, choices: [{ groupId: 'mixer', optionId: 'tonic' }], note: 'no nuts' },
    { subProductId: cocktail.subProductId, sizeId: cocktail.sizeId, quantity: 1 },
    { subProductId: plain.subProductId, sizeId: plain.sizeId, quantity: 2 },
    { subProductId: sp4.subProductId, sizeId: sp4.sizeId, quantity: 1 },
  ], idempotencyKey: 'accept' });
  const mixedLine = accepted.lines.find(l => l.subProductId === mixed.subProductId);
  const cocktailLine = accepted.lines.find(l => l.subProductId === cocktail.subProductId);
  const plainLine = accepted.lines.find(l => l.subProductId === plain.subProductId);
  const sp4Line = accepted.lines.find(l => l.subProductId === sp4.subProductId);
  assert.ok(mixedLine?.lineId && cocktailLine?.lineId && plainLine?.lineId && sp4Line?.lineId);

  // effectKey idempotency belt: the sp4 pour line is ALREADY consumed in the ledger
  // (simulated operation replay) — fire must treat it as consumed: no second event,
  // no open-bottle drain, and firedQuantity still advances (the brace).
  await ConsumptionEvent.create({ tenant, location: args.locationId, session: new mongoose.Types.ObjectId(visit.id), billOrder: new mongoose.Types.ObjectId(accepted.heldOrderId),
    lineId: sp4Line.lineId, revision: sp4Line.revision, effectKey: `fire:${visit.id}:${sp4Line.lineId}:${sp4Line.revision}`, kind: 'poured',
    items: [{ subProduct: sp4.subProductId, size: sp4.sizeId, quantity: 100, unit: 'ml' }], actor: args.actor.userId });
  const eventsBeforeFire = await ConsumptionEvent.countDocuments({ tenant });

  const fired = await linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: accepted.version, idempotencyKey: 'fire' });

  // Recipe line: ONE ledger event, components claimed as stored (ledger-only — garnish stock untouched)
  const recipeEvent = await ConsumptionEvent.findOne({ tenant, kind: 'recipe', lineId: mixedLine.lineId }).lean();
  assert.ok(recipeEvent, 'recipe event exists');
  assert.equal(recipeEvent.effectKey, `fire:${visit.id}:${mixedLine.lineId}:${mixedLine.revision}`);
  assert.equal(String(recipeEvent.recipeVersion), recipe.id);
  assert.equal(recipeEvent.recipeCostMinor, 240, 'costMinorPerUnit × output quantity (120 × 2)');
  assert.equal(String(recipeEvent.billOrder), accepted.heldOrderId);
  assert.equal(String(recipeEvent.session), visit.id);
  assert.deepEqual(recipeEvent.items.map(item => ({ subProduct: String(item.subProduct), profile: String(item.profile), quantity: item.quantity, unit: item.unit })), [
    { subProduct: garnish.subProductId, profile: profile.id, quantity: 50, unit: 'ml' },
  ]);
  const garnishSub = await require('../models/SubProduct').findById(garnish.subProductId).lean();
  assert.equal(String(recipeEvent.items[0].size), String(garnishSub.defaultSize), 'component item size is the profile SubProduct default stock form');
  const garnishStock = await require('../models/WarehouseStock').findOne({ tenant, subProduct: garnish.subProductId }).lean();
  assert.equal(garnishStock.currentQuantity, 9, 'recipe consumption is a ledger claim: component stock never moves at fire');

  // Pour line: ONE event claiming pourMl × quantity ml; FIFO drain of the oldest bottle
  const pourEvent = await ConsumptionEvent.findOne({ tenant, kind: 'poured', lineId: cocktailLine.lineId }).lean();
  assert.ok(pourEvent, 'poured event exists');
  assert.equal(pourEvent.effectKey, `fire:${visit.id}:${cocktailLine.lineId}:${cocktailLine.revision}`);
  assert.equal(String(pourEvent.items[0].subProduct), cocktail.subProductId);
  assert.equal(String(pourEvent.items[0].size), cocktail.sizeId);
  assert.equal(pourEvent.items[0].quantity, 50);
  assert.equal(pourEvent.items[0].unit, 'ml');
  const oldBottleAfter = await OpenedBottle.findById(oldBottle._id).lean();
  const newBottleAfter = await OpenedBottle.findById(newBottle._id).lean();
  assert.equal(oldBottleAfter.remainingMl, 50, 'oldest open bottle drains first');
  assert.equal(oldBottleAfter.state, 'open');
  assert.equal(newBottleAfter.remainingMl, 500, 'newer bottle untouched while the oldest covers the claim');

  // Sealed line: NO event at all
  assert.equal(await ConsumptionEvent.countDocuments({ tenant, lineId: plainLine.lineId }), 0, 'sealed lines stay on the bill-time path');

  // Dup belt: sp4 already consumed — exactly the pre-inserted event, bottle NOT drained
  const sp4Events = await ConsumptionEvent.find({ tenant, lineId: sp4Line.lineId }).lean();
  assert.equal(sp4Events.length, 1);
  assert.equal(await OpenedBottle.findById(dupBottle._id).then(b => b.remainingMl), 250, 'duplicate consumption never drains the bottle again');
  assert.equal((await ConsumptionEvent.countDocuments({ tenant })) - eventsBeforeFire, 2, 'only the recipe + pour events were added');

  // firedQuantity advanced for every pending line, including the expanded option row (the brace committed with the ledger)
  const raw = await Session.findById(visit.id).lean();
  assert.deepEqual(raw.acceptedLines.filter(l => l.firedQuantity > 0).map(l => l.lineId).sort(),
    [mixedLine.lineId, cocktailLine.lineId, plainLine.lineId, sp4Line.lineId,
      accepted.lines.find(l => l.subProductId === tonic.subProductId).lineId].sort());

  // Frozen recipe version on the session line subdoc + read-only in linesDTO
  const frozenRow = raw.acceptedLines.find(l => l.lineId === mixedLine.lineId);
  assert.equal(frozenRow.frozenRecipeVersion.version, 1);
  assert.equal(String(frozenRow.frozenRecipeVersion.recipe), recipe.id);
  assert.equal(raw.acceptedLines.find(l => l.lineId === cocktailLine.lineId).frozenRecipeVersion, undefined, 'pour lines do not freeze a recipe version');
  assert.equal(raw.acceptedLines.find(l => l.lineId === plainLine.lineId).frozenRecipeVersion, undefined);
  assert.deepEqual(fired.lines.find(l => l.lineId === mixedLine.lineId).frozenRecipeVersion, { version: 1, recipe: recipe.id });

  // Round snapshot carries note/choices/choiceKey/frozenRecipeVersion additively
  const roundItem = fired.round.items.find(item => item.lineId === mixedLine.lineId);
  assert.deepEqual(roundItem.choices, [{ groupId: 'mixer', optionId: 'tonic' }]);
  assert.equal(roundItem.choiceKey, 'c:mixer:tonic');
  assert.equal(roundItem.note, 'no nuts');
  assert.deepEqual(roundItem.frozenRecipeVersion, { version: 1, recipe: recipe.id });
  const persisted = await require('../models/Order').findById(accepted.heldOrderId).lean();
  const persistedItem = persisted.holdMetadata.firedRounds[0].items.find(item => item.lineId === mixedLine.lineId);
  assert.deepEqual(persistedItem.choices, [{ groupId: 'mixer', optionId: 'tonic' }]);
  assert.equal(persistedItem.note, 'no nuts');
  assert.deepEqual(persistedItem.frozenRecipeVersion, { version: 1, recipe: recipe.id });

  // Idempotency braces: same key + same payload replays the stored result
  await linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: accepted.version, idempotencyKey: 'fire' });
  assert.equal(await ConsumptionEvent.countDocuments({ tenant }), 3, 'replay adds no second event');
  await assertFails(linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: fired.version, idempotencyKey: 'fire-again' }), 'NO_UNFIRED_LINES');
  assert.equal(await ConsumptionEvent.countDocuments({ tenant }), 3, 'fully fired visit creates nothing new');

  // ===== Pour availability: fire refuses and firedQuantity never advances =====
  const table2 = await require('../models/POSTable').create({ tenant: args.tenantId, location: args.locationId, name: 'Table 2' });
  const visit2 = await require('../services/venue/service-sessions').ensureServiceSession({ ...args, tableIds: [String(table2._id)], expectedTableVersions: [0], idempotencyKey: 'visit2' });
  const accepted2 = await linesService.setSessionLines({ ...args, sessionId: visit2.id, expectedVersion: visit2.version, lines: [
    { subProductId: sp5.subProductId, sizeId: sp5.sizeId, quantity: 3 },
  ], idempotencyKey: 'accept2' });
  const sp5Line = accepted2.lines[0];
  await assertFails(linesService.fireSessionRound({ ...args, sessionId: visit2.id, expectedVersion: accepted2.version, idempotencyKey: 'fire-short' }), 'STOCK_UNAVAILABLE');
  const raw2 = await Session.findById(visit2.id).lean();
  assert.equal(raw2.acceptedLines.find(l => l.lineId === sp5Line.lineId).firedQuantity, 0, 'failed pour availability leaves unfired quantity intact');
  assert.equal(raw2.acceptedLines.find(l => l.lineId === sp5Line.lineId).frozenRecipeVersion, undefined);
  assert.equal(await ConsumptionEvent.countDocuments({ tenant, lineId: sp5Line.lineId }), 0, 'no event on refused fire');
  assert.equal((await OpenedBottle.findById(shortBottle._id).lean()).remainingMl, 100, 'refused fire never drains the bottle');

  // Bar opens a bottle; the retry drains FIFO across BOTH bottles
  const extraBottle = await OpenedBottle.create({ tenant, location: args.locationId, source: { subProduct: sp5.subProductId, size: sp5.sizeId }, contentsMl: 750, remainingMl: 200, openedAt: new Date(Date.now() + 60000), openedBy: args.actor.userId });
  const fired2 = await linesService.fireSessionRound({ ...args, sessionId: visit2.id, expectedVersion: raw2.version, idempotencyKey: 'fire-short-2' });
  assert.equal(fired2.round.items[0].quantity, 3);
  const shortAfter = await OpenedBottle.findById(shortBottle._id).lean();
  const extraAfter = await OpenedBottle.findById(extraBottle._id).lean();
  assert.equal(shortAfter.remainingMl, 0); assert.equal(shortAfter.state, 'exhausted', 'oldest bottle drains to exhaustion');
  assert.equal(extraAfter.remainingMl, 150, 'the remainder spreads to the next open bottle (150 ml claimed)');
  const sp5Event = await ConsumptionEvent.findOne({ tenant, session: new mongoose.Types.ObjectId(visit2.id), lineId: sp5Line.lineId }).lean();
  assert.equal(sp5Event.items[0].quantity, 150, 'the ledger records the full claim (50 × 3)');

  // ===== projectMenu exposes pourMl read-only =====
  await require('../models/Product').collection.updateMany({}, { $set: { status: 'approved', isPublished: true } });
  const projection = await experience.readMenu(args);
  const projectedPour = projection.sections[0].items.find(item => item.subProductId === cocktail.subProductId);
  const projectedSealed = projection.sections[0].items.find(item => item.subProductId === plain.subProductId);
  assert.equal(projectedPour.pourMl, 50);
  assert.equal(projectedSealed.pourMl, undefined, 'sealed menu items expose no pourMl');
});

test('poured and recipe fire paths route over the OPENED and ledger kinds only (zero negative stock)', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'fire_pour_gate');
  await require('../services/venue/service-sessions').ensureIndexes();
  await require('../models/VenueLocationProfile').createIndexes();
  await require('../models/VenueConsumptionEvent').createIndexes();
  await require('../models/OpenedBottle').createIndexes();
  const args = await fixture();
  const linesService = require('../services/venue/lines');
  const experience = require('../services/venue/experience');
  const ConsumptionEvent = require('../models/VenueConsumptionEvent');
  const tenant = new mongoose.Types.ObjectId(args.tenantId);
  const pour = await beverage(args, { currentQuantity: 3, reservedQuantity: 0 });
  const menu = { sections: [{ id: 'drinks', name: 'Drinks', items: [
    { subProductId: pour.subProductId, sizeId: pour.sizeId, published: true, pourMl: 50 },
  ] }] };
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, menu: experience.validateMenu(menu) });
  const visit = await require('../services/venue/service-sessions').ensureServiceSession({ ...args, idempotencyKey: 'visit' });
  const accepted = await linesService.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: visit.version, lines: [
    { subProductId: pour.subProductId, sizeId: pour.sizeId, quantity: 3 },
  ], idempotencyKey: 'accept' });
  // No open bottle at all — pour claim cannot be covered
  await assertFails(linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: accepted.version, idempotencyKey: 'fire-no-bottle' }), 'STOCK_UNAVAILABLE');
  assert.equal(await ConsumptionEvent.countDocuments({ tenant }), 0, 'nothing fired, nothing claimed');
  await require('../models/OpenedBottle').create({ tenant, location: args.locationId, source: { subProduct: pour.subProductId, size: pour.sizeId }, contentsMl: 750, remainingMl: 200, openedBy: args.actor.userId });
  const fired = await linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: accepted.version, idempotencyKey: 'fire-with-bottle' });
  assert.equal(fired.lines[0].firedQuantity, 3);
  assert.equal((await require('../models/OpenedBottle').findOne({ tenant }).lean()).remainingMl, 50, '150 ml claimed, 50 ml left');
  for (const row of await require('../models/WarehouseStock').find({ tenant }).lean()) assert.ok(row.currentQuantity >= 0 && row.reservedQuantity >= 0);
});
