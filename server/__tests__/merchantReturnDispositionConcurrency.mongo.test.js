'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { uri } = require('./helpers/venueMongo');
const { quarantinedReturn } = require('./helpers/merchantReturnDispositionFixture');

test(
  'concurrent identical inspection commands record exactly once',
  { skip: !uri },
  async (t) => {
    const { actor, booking, call, record } = await quarantinedReturn(t);
    const Return = require('../models/MerchantDeliveryReturn');
    const base = `/bookings/${booking._id}/return`;
    const read = await call(base, null, actor, 'GET');
    const range = record.lines[0].ranges[0];
    const inspect = {
      expectedVersion: read.body.data.return.version,
      idempotencyKey: 'concurrent-inspect',
      note: 'Concurrent condition check',
      lines: [
        {
          line: String(record.lines[0].line),
          condition: 'sealed',
          ranges: [{ start: range.start, quantity: range.quantity }],
        },
      ],
    };
    const [first, second] = await Promise.all([
      call(`${base}/inspect`, inspect),
      call(`${base}/inspect`, inspect),
    ]);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(second.status, 200, JSON.stringify(second.body));
    const stored = await Return.findOne({ booking: String(booking._id) }).lean();
    assert.equal(stored.inspections.length, 1);
    assert.equal(stored.operations.length, 1);
  }
);
