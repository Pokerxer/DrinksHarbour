'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { uri } = require('./helpers/venueMongo');
const { quarantinedReturn } = require('./helpers/merchantReturnDispositionFixture');

test(
  'quarantined return exposes exact-unit inspection, gated decisions and explicit unsupported effects',
  { skip: !uri },
  async (t) => {
    const { f, child, actor, booking, call, customerRead, record } =
      await quarantinedReturn(t);
    const Stock = require('../models/WarehouseStock'),
      Budget = require('../models/MerchantDispatchBudget'),
      Return = require('../models/MerchantDeliveryReturn');
    const base = `/bookings/${booking._id}/return`;
    const stockBefore = (await Stock.findOne({ tenant: child.tenant })).toObject();
    const budgetBefore = await Budget.findById(child._id).lean();

    // --- T1: read path ---
    const read = await call(base, null, actor, 'GET');
    assert.equal(read.status, 200, JSON.stringify(read.body));
    const view = read.body.data.return;
    assert.equal(view.disposition, 'quarantined');
    assert.equal(String(view.booking), String(booking._id));
    assert.equal(view.shipmentAllocation, record.shipmentAllocation);
    assert.equal(view.lines.length, record.lines.length);
    assert.equal(String(view.lines[0].line), String(record.lines[0].line));
    assert.deepEqual(
      view.lines[0].ranges,
      record.lines[0].ranges.map((r) => ({
        start: r.start,
        quantity: r.quantity,
      }))
    );
    assert.deepEqual(view.inspections, []);
    assert.deepEqual(view.decisions, []);
    assert.equal(view.effects.supported, false);
    assert.match(view.effects.reasons.join(' '), /policy is not recorded/);

    // --- T2: scoping and validation ---
    assert.equal((await call(base, null, f.actors[1], 'GET')).status, 404);
    assert.equal(
      (await call(base, null, { _id: f.customer, role: 'customer' }, 'GET'))
        .status,
      403
    );
    const range = record.lines[0].ranges[0];
    const inspect = {
      expectedVersion: view.version,
      idempotencyKey: 'inspect-one',
      note: 'Carton opened for condition check',
      lines: [
        {
          line: String(record.lines[0].line),
          condition: 'damaged',
          ranges: [{ start: range.start, quantity: range.quantity }],
          evidence: [
            { kind: 'batch_reference', reference: 'synthetic-batch-1' },
          ],
        },
      ],
    };
    assert.equal(
      (
        await call(`${base}/inspect`, {
          ...inspect,
          lines: [{ ...inspect.lines[0], condition: 'disintegrated' }],
        })
      ).status,
      400
    );
    assert.equal(
      (
        await call(`${base}/inspect`, {
          ...inspect,
          lines: [
            { ...inspect.lines[0], ranges: [{ start: 99, quantity: 1 }] },
          ],
        })
      ).status,
      409
    );
    assert.equal(
      (
        await call(`${base}/inspect`, {
          ...inspect,
          expectedVersion: 999,
        })
      ).status,
      409
    );
    assert.equal(
      (await call(`${base}/inspect`, inspect, f.actors[1])).status,
      404
    );
    const inspected = await call(`${base}/inspect`, inspect);
    assert.equal(inspected.status, 200, JSON.stringify(inspected.body));
    const inspectedView = inspected.body.data.return;
    assert.equal(inspectedView.inspections.length, 1);
    assert.equal(inspectedView.inspections[0].condition, 'damaged');
    assert.equal(inspectedView.version, view.version + 1);
    assert.equal(
      (await call(`${base}/inspect`, inspect)).status,
      200,
      'duplicate key replays idempotently'
    );
    const replayed = await Return.findOne({
      booking: String(booking._id),
    }).lean();
    assert.equal(replayed.inspections.length, 1);
    assert.equal(replayed.version, view.version + 1);
    assert.equal(
      (
        await call(`${base}/inspect`, {
          ...inspect,
          note: 'Different inspection note under same key',
        })
      ).status,
      409
    );
    assert.equal(
      (
        await call(`${base}/inspect`, {
          ...inspect,
          idempotencyKey: 'inspect-again',
        })
      ).status,
      409,
      'recorded range cannot be inspected twice'
    );

    // --- T3: decision eligibility ---
    const decide = (treatment, key) =>
      call(`${base}/decision`, {
        expectedVersion: replayed.version,
        idempotencyKey: key,
        note: 'Recorded operator treatment decision',
        lines: [
          {
            line: String(record.lines[0].line),
            treatment,
            ranges: [{ start: range.start, quantity: range.quantity }],
          },
        ],
      });
    assert.equal(
      (
        await call(`${base}/decision`, {
          expectedVersion: replayed.version,
          idempotencyKey: 'decide-unknown-line',
          lines: [
            {
              line: 'never-inspected-line',
              treatment: 'retain_quarantine',
              ranges: [{ start: range.start, quantity: range.quantity }],
            },
          ],
        })
      ).status,
      409
    );
    assert.equal(
      (await decide('restock', 'decide-restock')).status,
      409,
      'damaged units are not eligible for restock'
    );
    const decided = await decide('write_off', 'decide-write-off');
    assert.equal(decided.status, 200, JSON.stringify(decided.body));
    assert.equal(decided.body.data.return.decisions.length, 1);
    assert.equal(decided.body.data.return.decisions[0].treatment, 'write_off');
    assert.equal((await decide('write_off', 'decide-write-off')).status, 200);
    const decidedRecord = await Return.findOne({
      booking: String(booking._id),
    }).lean();
    assert.equal(decidedRecord.decisions.length, 1);
    assert.equal(
      (await decide('retain_quarantine', 'decide-again')).status,
      409,
      'decided ranges cannot be re-decided'
    );
    assert.equal(
      (await decide('write_off', 'decide-write-off-different-note')).status,
      409
    );

    // --- T4: policy gate — effects stay explicit-unsupported, nothing moves ---
    const effects = await call(`${base}/effects`, {});
    assert.equal(effects.status, 200, JSON.stringify(effects.body));
    assert.equal(effects.body.data.effects.supported, false);
    assert.match(
      effects.body.data.effects.reasons.join(' '),
      /policy is not recorded/
    );
    const after = await Return.findOne({ booking: String(booking._id) }).lean();
    assert.equal(
      after.version,
      decidedRecord.version,
      'effects request never mutates'
    );
    const stockAfter = (await Stock.findOne({ tenant: child.tenant })).toObject();
    assert.equal(
      stockAfter.currentQuantity,
      stockBefore.currentQuantity,
      'decisions and effects never change sellable stock'
    );
    assert.deepEqual(
      await Budget.findById(child._id).lean(),
      budgetBefore,
      'decisions and effects never change the dispatch charge budget'
    );

    // --- T5: customer-safe progress stays free of private disposition evidence ---
    const customer = await customerRead();
    assert.equal(customer.status, 200);
    assert.match(customer.text, /"returned"/);
    assert.doesNotMatch(
      customer.text,
      /quarantined|sealed|damaged|expired|unverifiable|write_off|restock|retain_quarantine|inspections|decisions|treatment/
    );
    void f;
  }
);
