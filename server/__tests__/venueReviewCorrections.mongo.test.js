'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');
async function setup(t, suffix) {
  await connectVenueMongo(t, suffix);
  await require('../services/venue/service-sessions').ensureIndexes(); await require('../services/venue/billing').ensureIndexes(); await require('../services/venue/collections').ensureIndexes();
  await require('../models/JournalEntry').createIndexes();
}
async function openCashVisit() {
  const args = await fixture(); const item = { ...await beverage(args), quantity: 1 };
  const drawer = new mongoose.Types.ObjectId();
  await require('../models/POSSession').collection.insertOne({ _id: drawer, tenant: new mongoose.Types.ObjectId(args.tenantId), warehouse: new mongoose.Types.ObjectId(args.locationId), status: 'open', shopId: 'retail' });
  args.posSessionId = String(drawer); await require('../services/chartOfAccounts.service').ensureDefaultCOA(args.tenantId);
  const visit = await require('../services/venue/service-sessions').ensureServiceSession({ ...args, idempotencyKey: 'open' });
  return { args: { ...args, sessionId: visit.id }, item, visit };
}
test('served_lines_survive_new_sale_ineligibility_but_hidden_additions_are_refused', { skip: !uri, timeout: 90000 }, async t => {
  await setup(t, 'served_review');
  for (const patch of [{ visibleInPOS: false }, { status: 'hidden' }, { status: 'discontinued' }, { status: 'archived' }]) {
    const { args, item, visit } = await openCashVisit(); const lines = require('../services/venue/lines');
    const first = await lines.setSessionLines({ ...args, expectedVersion: visit.version, lines: [item], idempotencyKey: 'accept' });
    const fired = await lines.fireSessionRound({ ...args, expectedVersion: first.version, idempotencyKey: 'fire' });
    await require('../models/SubProduct').updateOne({ _id: item.subProductId, tenant: args.tenantId }, { $set: patch });
    let retained = await lines.setSessionLines({ ...args, expectedVersion: fired.version, lines: [item], idempotencyKey: 'checkout-save' });
    assert.deepEqual(retained.lines.map(line => [line.lineId, line.unitPriceMinor, line.firedQuantity]), first.lines.map(line => [line.lineId, line.unitPriceMinor, 1]));
    retained = await lines.setSessionLines({ ...args, expectedVersion: retained.version, lines: [{ ...item, subProductId: item.subProductId.toUpperCase(), sizeId: item.sizeId.toUpperCase() }], idempotencyKey: 'uppercase-retained' });
    assert.equal(retained.lines[0].lineId, first.lines[0].lineId);
    await assert.rejects(lines.setSessionLines({ ...args, expectedVersion: retained.version, lines: [{ ...item, quantity: 2 }], idempotencyKey: 'hidden-addition' }), /not found/i);
    const bill = await require('../services/venue/billing').ensureBillOrder({ ...args, expectedVersion: retained.version, lineVersion: retained.lineVersion, ageVerified: true, idempotencyKey: 'freeze' });
    const paid = await require('../services/venue/collections').collectBill({ ...args, expectedVersion: bill.version, quoteId: bill.quoteId, method: 'cash', amountTenderedMinor: bill.totalMinor, idempotencyKey: 'cash' });
    assert.equal(paid.bill.state, 'settled'); assert.equal(paid.bill.totalMinor, 100000);
  }
});
test('priced_revisions_keep_their_own_batch_evidence_after_settlement_and_retry', { skip: !uri, timeout: 45000 }, async t => {
  await setup(t, 'revision_batches'); const { args, item, visit } = await openCashVisit();
  const sub = await require('../models/SubProduct').findOne({ _id: item.subProductId, tenant: args.tenantId }).lean();
  await require('../models/Product').updateOne({ _id: sub.product }, { $set: { tracksBatch: true } });
  const Batch = require('../models/WarehouseBatch');
  const batches = await Batch.create([{ tenant: args.tenantId, warehouse: args.locationId, subProduct: item.subProductId, size: item.sizeId, batchNumber: 'first', quantity: 1, expiryDate: new Date('2035-01-01') }, { tenant: args.tenantId, warehouse: args.locationId, subProduct: item.subProductId, size: item.sizeId, batchNumber: 'second', quantity: 1, expiryDate: new Date('2036-01-01') }]);
  const lines = require('../services/venue/lines');
  const first = await lines.setSessionLines({ ...args, expectedVersion: visit.version, lines: [item], idempotencyKey: 'first' });
  await require('../models/Size').updateOne({ _id: item.sizeId, tenant: args.tenantId }, { $set: { sellingPrice: 2000 } });
  const second = await lines.setSessionLines({ ...args, expectedVersion: first.version, lines: [{ ...item, quantity: 2 }], idempotencyKey: 'second' });
  const bill = await require('../services/venue/billing').ensureBillOrder({ ...args, expectedVersion: second.version, lineVersion: second.lineVersion, ageVerified: true, idempotencyKey: 'freeze' });
  const command = { ...args, expectedVersion: bill.version, quoteId: bill.quoteId, method: 'cash', amountTenderedMinor: bill.totalMinor, idempotencyKey: 'cash' };
  const payments = require('../services/venue/collections'); assert.equal((await payments.collectBill(command)).bill.state, 'settled');
  const Order = require('../models/Order'); const order = await Order.findOne({ _id: bill.orderId, tenant: args.tenantId }).lean();
  assert.deepEqual(order.items.map(line => line.batchAllocations.reduce((sum, allocation) => sum + allocation.quantity, 0)), [1, 1]);
  order.items.forEach((line, index) => {
    assert.equal(line.venueLineId, second.lines[index].lineId); assert.equal(line.venueLineRevision, second.lines[index].revision);
    assert.equal(String(line.batchAllocations[0].batch), String(batches[index]._id));
  });
  await payments.collectBill(command);
  const replay = await Order.findOne({ _id: bill.orderId, tenant: args.tenantId }).lean(); assert.deepEqual(replay.items, order.items);
  assert.equal(await require('../models/WarehouseMovement').countDocuments({ tenant: args.tenantId }), 2);
});
