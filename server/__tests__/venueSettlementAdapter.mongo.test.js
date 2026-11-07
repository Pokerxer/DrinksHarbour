'use strict';
// Task 6 (S2) — settlement adapter: bills whose consumed-at-fire lines already carry
// a VenueConsumptionEvent skip those lines in BOTH reserveBillStock and
// consumeBillStock; sealed lines reserve and consume exactly as before; zero
// negative stock; VenueStockEffect uniqueness untouched. Suffix: settlement_adapter.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

test('freeze_settlement_skips_consumed_at_fire_lines_and_keeps_the_sealed_path_verbatim', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'settlement_adapter');
  await require('../services/venue/service-sessions').ensureIndexes();
  await require('../services/venue/billing').ensureIndexes();
  await require('../services/venue/collections').ensureIndexes();
  await require('../models/JournalEntry').createIndexes();
  await require('../models/VenueConsumptionEvent').createIndexes();
  await require('../models/OpenedBottle').createIndexes();

  const args = await fixture();
  const linesService = require('../services/venue/lines');
  const experience = require('../services/venue/experience');
  const ConsumptionEvent = require('../models/VenueConsumptionEvent');
  const OpenedBottle = require('../models/OpenedBottle');
  const tenant = new mongoose.Types.ObjectId(args.tenantId);

  // Poured output (has its own on-hand stock that must NOT be reserved/consumed)
  // and a plain sealed beverage (bill-time path unchanged).
  const poured = await beverage(args, { currentQuantity: 5, reservedQuantity: 0 });
  const sealed = await beverage(args, { currentQuantity: 10, reservedQuantity: 2 });
  const menu = { sections: [{ id: 'drinks', name: 'Drinks', items: [
    { subProductId: poured.subProductId, sizeId: poured.sizeId, published: true, pourMl: 50 },
    { subProductId: sealed.subProductId, sizeId: sealed.sizeId, published: true },
  ] }] };
  await require('../models/VenueLocationProfile').create({ tenant: args.tenantId, location: args.locationId, menu: experience.validateMenu(menu) });

  // One opened bottle the bar manages; the fire-time pour claims 50 ml (ledger + bottle only)
  const bottle = await OpenedBottle.create({ tenant, location: args.locationId, source: { subProduct: poured.subProductId, size: poured.sizeId }, contentsMl: 750, remainingMl: 750, openedBy: args.actor.userId });

  const drawer = new mongoose.Types.ObjectId();
  await require('../models/POSSession').collection.insertOne({ _id: drawer, tenant, warehouse: new mongoose.Types.ObjectId(args.locationId), status: 'open', shopId: 'retail' });
  args.posSessionId = String(drawer);
  await require('../services/chartOfAccounts.service').ensureDefaultCOA(args.tenantId);

  const visit = await require('../services/venue/service-sessions').ensureServiceSession({ ...args, idempotencyKey: 'open' });
  const accepted = await linesService.setSessionLines({ ...args, sessionId: visit.id, expectedVersion: visit.version, lines: [
    { subProductId: poured.subProductId, sizeId: poured.sizeId, quantity: 1 },
    { subProductId: sealed.subProductId, sizeId: sealed.sizeId, quantity: 2 },
  ], idempotencyKey: 'accept' });
  const pourLine = accepted.lines.find(line => line.subProductId === poured.subProductId);
  const sealedLine = accepted.lines.find(line => line.subProductId === sealed.subProductId);
  const fired = await linesService.fireSessionRound({ ...args, sessionId: visit.id, expectedVersion: accepted.version, idempotencyKey: 'fire' });
  assert.equal((await ConsumptionEvent.find({ tenant, session: new mongoose.Types.ObjectId(visit.id), kind: 'poured' })).length, 1, 'pour line consumed at fire');
  assert.equal(await ConsumptionEvent.countDocuments({ tenant, lineId: sealedLine.lineId }), 0, 'sealed line has no fire-time event');
  assert.equal((await OpenedBottle.findById(bottle._id).lean()).remainingMl, 700);

  // Freeze: reserve touches ONLY the sealed line
  const bill = await require('../services/venue/billing').ensureBillOrder({ ...args, sessionId: visit.id, expectedVersion: fired.version, lineVersion: fired.lineVersion, ageVerified: true, idempotencyKey: 'bill' });
  const Effect = require('../models/VenueStockEffect');
  const effects = await Effect.find({ tenant, billOrder: new mongoose.Types.ObjectId(bill.orderId) }).lean();
  assert.equal(effects.length, 1, 'no VenueStockEffect rows exist for consumed-at-fire lines');
  assert.equal(effects[0].lineId, sealedLine.lineId);
  assert.equal(effects[0].revision, sealedLine.revision);
  assert.equal(effects[0].state, 'reserved');
  const pouredStock = await require('../models/WarehouseStock').findOne({ tenant, subProduct: poured.subProductId }).lean();
  assert.deepEqual({ currentQuantity: pouredStock.currentQuantity, reservedQuantity: pouredStock.reservedQuantity }, { currentQuantity: 5, reservedQuantity: 0 }, 'poured output stock is never reserved');
  const sealedStock = await require('../models/WarehouseStock').findOne({ tenant, subProduct: sealed.subProductId }).lean();
  assert.deepEqual({ currentQuantity: sealedStock.currentQuantity, reservedQuantity: sealedStock.reservedQuantity }, { currentQuantity: 10, reservedQuantity: 4 }, 'sealed line reserves exactly as before');

  // Settlement: consume touches ONLY the sealed line; pour side neither reserves nor consumes
  const command = { ...args, sessionId: visit.id, expectedVersion: bill.version, quoteId: bill.quoteId, method: 'cash', amountTenderedMinor: bill.totalMinor, idempotencyKey: 'cash' };
  const payments = require('../services/venue/collections');
  assert.equal((await payments.collectBill(command)).bill.state, 'settled');
  assert.equal((await OpenedBottle.findById(bottle._id).lean()).remainingMl, 700, 'settlement never re-drains the opened bottle');
  const pouredAfter = await require('../models/WarehouseStock').findOne({ tenant, subProduct: poured.subProductId }).lean();
  assert.deepEqual({ currentQuantity: pouredAfter.currentQuantity, reservedQuantity: pouredAfter.reservedQuantity }, { currentQuantity: 5, reservedQuantity: 0 }, 'no double consumption on the pour side');
  const sealedAfter = await require('../models/WarehouseStock').findOne({ tenant, subProduct: sealed.subProductId }).lean();
  assert.deepEqual({ currentQuantity: sealedAfter.currentQuantity, reservedQuantity: sealedAfter.reservedQuantity }, { currentQuantity: 8, reservedQuantity: 2 }, 'sealed line consumes exactly its reservation');
  const movements = await require('../models/WarehouseMovement').find({ tenant, type: 'shipped' }).lean();
  assert.equal(movements.length, 1, 'one shipped movement — the sealed line only');
  assert.equal(String(movements[0].subProduct), sealed.subProductId);
  assert.equal(await ConsumptionEvent.countDocuments({ tenant }), 1, 'settlement adds no consumption events, pour ledger untouched');
  assert.equal(await Effect.countDocuments({ tenant }), 1, 'VenueStockEffect per-line count stays 1 (uniqueness surface unaffected)');

  // Zero negative stock anywhere for the tenant
  for (const row of await require('../models/WarehouseStock').find({ tenant }).lean()) {
    assert.ok(row.currentQuantity >= 0 && row.reservedQuantity >= 0, `no negative stock on ${row.subProduct}`);
  }
});
