'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { uri } = require('./helpers/venueMongo');
const { decidedReturn } = require('./helpers/merchantReturnEffectsFixture');

test(
  'recorded policy executes once-only restock with exact stock, batch and budget conservation',
  { skip: !uri },
  async (t) => {
    const { base, range, commandVersion, child, actor, booking, call, record } =
      await decidedReturn(t, 'sealed', 'restock');
    process.env.MERCHANT_RETURN_EFFECTS_ENABLED = 'true';
    t.after(() => delete process.env.MERCHANT_RETURN_EFFECTS_ENABLED);
    const Return = require('../models/MerchantDeliveryReturn'),
      Stock = require('../models/WarehouseStock'),
      Batch = require('../models/WarehouseBatch'),
      Budget = require('../models/MerchantDispatchBudget'),
      Movement = require('../models/WarehouseMovement'),
      Journal = require('../models/JournalEntry'),
      Allocation = require('../models/MerchantShipmentAllocation');

    const stockBefore = (await Stock.findOne({ tenant: child.tenant })).toObject();
    const batchesBefore = await Batch.find({ tenant: child.tenant }).sort({ _id: 1 }).lean();
    const budgetBefore = await Budget.findById(child._id).lean();
    const command = { expectedVersion: commandVersion, idempotencyKey: 'effects-restock' };

    // --- concurrent identical commands both 200 with exactly one stored effect ---
    const [first, second] = await Promise.all([
      call(`${base}/effects`, command, actor),
      call(`${base}/effects`, command, actor),
    ]);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(second.status, 200, JSON.stringify(second.body));
    assert.equal(first.body.data.effects.supported, true, JSON.stringify(first.body));
    assert.equal(second.body.data.effects.supported, true, JSON.stringify(second.body));
    const effectsRef = first.body.data.effects.effectsRef;
    assert.equal(first.body.data.effects.policyVersion, 1);

    const stored = await Return.findOne({ booking: String(booking._id) }).lean();
    assert.equal(stored.consumptions.length, 1, 'exactly one consumption record');
    assert.equal(stored.consumptions[0].action, 'restock');
    assert.equal(stored.consumptions[0].policyVersion, 1, 'policy version stamped on the effect');
    assert.equal(stored.consumptions[0].effectsRef, effectsRef);
    assert.equal(stored.operations.filter((op) => op.kind === 'effects').length, 1);

    // --- exact stock conservation: the original consumed unit returns once ---
    const stockAfter = (await Stock.findOne({ tenant: child.tenant })).toObject();
    assert.equal(stockAfter.currentQuantity, stockBefore.currentQuantity + 1);
    assert.equal(stockAfter.reservedQuantity, stockBefore.reservedQuantity);
    const allocation = await Allocation.findById(record.shipmentAllocation).lean();
    // Oracle: unit→batch mapping mirrors the original ship-time assignment
    // (batches consumed in order over the sorted recorded ranges).
    const expectedBatches = (() => {
      const source = allocation.lines[0];
      const queue = [];
      for (const slice of source.batchAllocations || [])
        for (let unit = 0; unit < slice.quantity; unit++) queue.push(String(slice.batch));
      const owned = new Map();
      let cursor = 0;
      for (const saved of [...source.ranges].sort((a, b) => a.start - b.start))
        for (let unit = saved.start; unit < saved.start + saved.quantity; unit++)
          owned.set(unit, queue[cursor++]);
      const counts = new Map();
      for (let unit = range.start; unit < range.start + range.quantity; unit++) {
        const batch = owned.get(unit);
        counts.set(batch, (counts.get(batch) || 0) + 1);
      }
      return [...counts].map(([batch, quantity]) => ({ batch, quantity }));
    })();
    const batchesAfter = await Batch.find({ tenant: child.tenant }).sort({ _id: 1 }).lean();
    const deltas = batchesAfter.map((row, index) => ({
      batch: String(row._id),
      quantity: row.quantity - batchesBefore[index].quantity,
    }));
    assert.deepEqual(
      deltas.filter((row) => row.quantity !== 0),
      expectedBatches,
      'exact original batch evidence restored'
    );

    // --- restock carries a physical movement with the effect identity ---
    const movement = await Movement.findOne({
      tenant: child.tenant,
      type: 'returned',
      reference: effectsRef,
    }).lean();
    assert.ok(movement, 'restock movement recorded');
    assert.equal(movement.quantity, 1);

    // --- once-only: replay and retry make no second effect ---
    const replay = await call(`${base}/effects`, command, actor);
    assert.equal(replay.status, 200);
    const replayed = await Return.findOne({ booking: String(booking._id) }).lean();
    assert.equal(replayed.consumptions.length, 1);
    assert.equal(
      (await Stock.findOne({ tenant: child.tenant })).toObject().currentQuantity,
      stockAfter.currentQuantity,
      'replay cannot restock twice'
    );
    assert.equal(
      await Journal.countDocuments({ source: 'merchant_goods_cancel' }),
      0,
      'restock posts no COGS journal'
    );

    // --- dispatch charge budget conservation through everything ---
    assert.deepEqual(await Budget.findById(child._id).lean(), budgetBefore);
  }
);

test(
  'write-off reverses the frozen goods cost basis through a once-only COGS journal',
  { skip: !uri },
  async (t) => {
    const { base, commandVersion, child, actor, booking, call } =
      await decidedReturn(t, 'damaged', 'write_off');
    process.env.MERCHANT_RETURN_EFFECTS_ENABLED = 'true';
    t.after(() => delete process.env.MERCHANT_RETURN_EFFECTS_ENABLED);
    const Order = require('../models/Order'),
      Return = require('../models/MerchantDeliveryReturn'),
      Stock = require('../models/WarehouseStock'),
      Budget = require('../models/MerchantDispatchBudget'),
      Journal = require('../models/JournalEntry'),
      Basis = require('../models/MerchantGoodsCancellation');
    // Synthetic frozen cost basis matching the goodsCostBasis recomputation:
    // tenant-0 items (3 + 2 units) at 2.00 each → original 10.00 COGS posting.
    await Order.collection.updateOne(
      { _id: child.order },
      { $set: { 'items.$[].vendorPriceAtPurchase': 2 } }
    );
    await require('../services/chartOfAccounts.service').ensureDefaultCOA(child.tenant);
    await require('../services/journalEntry.service').postJournalEntry({
      tenantId: child.tenant,
      refDoc: child.order,
      entryType: 'cogs',
      source: 'marketplace',
      lines: [
        { account: '5000', debit: 10 },
        { account: '1200', credit: 10 },
      ],
    });

    const stockBefore = (await Stock.findOne({ tenant: child.tenant })).toObject();
    const budgetBefore = await Budget.findById(child._id).lean();
    const command = { expectedVersion: commandVersion, idempotencyKey: 'effects-write-off' };

    const [first, second] = await Promise.all([
      call(`${base}/effects`, command, actor),
      call(`${base}/effects`, command, actor),
    ]);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(second.status, 200, JSON.stringify(second.body));
    assert.equal(first.body.data.effects.supported, true, JSON.stringify(first.body));
    assert.equal(first.body.data.effects.policyVersion, 1);

    const journals = await Journal.find({ source: 'merchant_goods_cancel' }).lean();
    assert.equal(journals.length, 1, 'exactly one COGS reversal journal under concurrency');
    assert.equal(journals[0].entryType, 'inventory_adjust');
    assert.equal(String(journals[0].refDocType), 'MerchantGoodsCancellation');
    const debit = journals[0].lines.find((l) => l.account === '1200'),
      credit = journals[0].lines.find((l) => l.account === '5000');
    assert.equal(debit.debit, 2, 'exact unit cost of the written-off range');
    assert.equal(credit.credit, 2);

    const basis = await Basis.findOne({ order: child.order }).lean();
    assert.equal(basis.cancellations.length, 1);
    assert.equal(basis.cancellations[0].costMinor, 200);
    assert.equal(
      String(basis.cancellations[0].journalRef),
      String(journals[0].refDoc),
      'journal identity is the effect refDoc, guarded once-only'
    );
    assert.equal(String(journals[0].refDoc), first.body.data.effects.effectsRef.slice(0, 24));

    const stored = await Return.findOne({ booking: String(booking._id) }).lean();
    assert.equal(stored.consumptions.length, 1);
    assert.equal(stored.consumptions[0].action, 'write_off');
    assert.equal(stored.consumptions[0].policyVersion, 1, 'policy version stamped on the effect');

    // --- quarantine goods are not sellable: stock unchanged, budget conserved ---
    assert.equal(
      (await Stock.findOne({ tenant: child.tenant })).toObject().currentQuantity,
      stockBefore.currentQuantity
    );
    assert.deepEqual(await Budget.findById(child._id).lean(), budgetBefore);

    // --- once-only: replay same key and overlapping new key make no second journal ---
    assert.equal((await call(`${base}/effects`, command, actor)).status, 200);
    const overlapping = await call(
      `${base}/effects`,
      {
        expectedVersion: stored.version,
        idempotencyKey: 'effects-write-off-again',
      },
      actor
    );
    assert.equal(overlapping.status, 409, 'decided ranges cannot be consumed twice');
    assert.equal(await Journal.countDocuments({ source: 'merchant_goods_cancel' }), 1);
    assert.equal((await Basis.findOne({ order: child.order })).cancellations.length, 1);
  }
);
