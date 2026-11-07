'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');

test('isolated backup restore preserves failed-delivery return identity and exact receipt replay without another goods effect', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'restore');
  const sourceName = mongoose.connection.name;
  assert.match(sourceName, new RegExp(`^drinks_venue_test_\\w+_restore_${process.pid}$`));
  const targetName = `drinks_venue_test_restored_${process.pid}`;
  const makeUri = name => `mongodb://127.0.0.1:29127/${name}?replicaSet=venuePhase0`;
  const sourceUri = makeUri(sourceName), targetUri = makeUri(targetName);
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'phase-d-restore-'));
  const archive = path.join(folder, 'synthetic.archive');
  const { child, actor, booking } = await require('./helpers/merchantRecoveryFixture').fixture(t);
  const engine = require('../services/delivery.service');
  const service = require('../services/deliveryProviders/localDispatch');
  const Booking = require('../models/MerchantDispatchBooking');
  const Receipt = require('../models/MerchantDeliveryReturn');
  const Stock = require('../models/WarehouseStock');
  const Allocation = require('../models/MerchantShipmentAllocation');
  let row = await engine.dispatchManagedDelivery(booking._id, { expectedVersion: booking.version, idempotencyKey: 'restore-ship' }, actor);
  row = await engine.resolveManagedDelivery(booking._id, { expectedVersion: row.version, idempotencyKey: 'restore-fail', status: 'failed', failureReason: 'Synthetic unavailable recipient' }, actor);
  row = await service.recoverManagedDelivery(booking._id, { action: 'return', expectedVersion: row.version, idempotencyKey: 'restore-return', reason: 'Synthetic goods return to origin' }, actor);
  const receiptInput = { action: 'receive_return', expectedVersion: row.version, idempotencyKey: 'restore-receive', reason: 'Synthetic original goods received in quarantine' };
  row = await service.recoverManagedDelivery(booking._id, receiptInput, actor);
  async function evidence() {
    return {
      booking: await Booking.findById(booking._id).lean(),
      receipts: await Receipt.find({ merchantOrder: child._id }).sort({ _id: 1 }).lean(),
      stock: await Stock.find({ tenant: child.tenant }).sort({ _id: 1 }).lean(),
      allocations: await Allocation.find({ merchantOrder: child._id }).sort({ _id: 1 }).lean(),
      budgets: await require('../models/MerchantDispatchBudget').find({ order: child.order }).sort({ _id: 1 }).lean(),
      journals: await require('../models/JournalEntry').find({ tenant: child.tenant }).sort({ _id: 1 }).lean(),
      batches: await require('../models/WarehouseBatch').find({ tenant: child.tenant }).sort({ _id: 1 }).lean(),
      movements: await require('../models/InventoryMovement').find({ tenant: child.tenant }).sort({ _id: 1 }).lean(),
    };
  }
  const before = JSON.parse(JSON.stringify(await evidence()));
  assert.equal(before.receipts.length, 1);
  assert.equal(before.allocations.length, 1);
  assert.equal(before.stock[0].currentQuantity, 9);
  assert.equal(before.receipts[0].disposition, 'quarantined');
  try {
    const target = await mongoose.createConnection(targetUri, { autoIndex: false }).asPromise();
    try { assert.equal((await target.db.listCollections().toArray()).length, 0, 'restore target must be empty task namespace'); }
    finally { await target.close(); }
    await execFile('/usr/local/bin/mongodump', ['--uri', sourceUri, '--archive=' + archive, '--quiet'], { timeout: 60000 });
    await execFile('/usr/local/bin/mongorestore', ['--uri', 'mongodb://127.0.0.1:29127/?replicaSet=venuePhase0', '--archive=' + archive, '--nsInclude', sourceName + '.*', '--nsFrom', sourceName + '.*', '--nsTo', targetName + '.*', '--quiet'], { timeout: 60000 });
    await mongoose.disconnect();
    await mongoose.connect(targetUri, { autoIndex: false, serverSelectionTimeoutMS: 5000 });
    assert.deepEqual(JSON.parse(JSON.stringify(await evidence())), before, 'backup preserves exact original responsibilities and stock/money evidence');
    const replay = await service.recoverManagedDelivery(booking._id, receiptInput, actor);
    assert.equal(replay.state, 'returned');
    assert.equal(replay.version, row.version);
    const after = JSON.parse(JSON.stringify(await evidence()));
    assert.deepEqual(after, before, 'exact replay after restore cannot make another receipt, stock or monetary effect');
    await assert.rejects(service.recoverManagedDelivery(booking._id, { ...receiptInput, reason: 'Changed receipt evidence' }, actor), { statusCode: 409 });
  } finally {
    await mongoose.disconnect();
    const target = await mongoose.createConnection(targetUri, { autoIndex: false }).asPromise();
    try { await target.dropDatabase(); } finally { await target.close(); }
    await mongoose.connect(sourceUri, { autoIndex: false, serverSelectionTimeoutMS: 5000 });
    await fs.rm(folder, { recursive: true, force: true });
  }
});
