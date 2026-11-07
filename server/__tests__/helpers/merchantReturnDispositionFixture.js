'use strict';
// Synthetic quarantined-return harness for disposition tests: real dispatch,
// failure, return request, receipt, then mounted JWT routes and helpers.
async function quarantinedReturn(t) {
  await connectVenueMongo(t, 'return_disposition');
  const { f, child, actor, booking } = await require('./merchantRecoveryFixture').fixture(t);
  const engine = require('../../services/delivery.service');
  const shipped = await engine.dispatchManagedDelivery(
    booking._id,
    { expectedVersion: booking.version, idempotencyKey: 'ship' },
    actor
  );
  const failed = await engine.resolveManagedDelivery(
    booking._id,
    {
      expectedVersion: shipped.version,
      idempotencyKey: 'fail-original',
      status: 'failed',
      failureReason: 'Recipient absent',
    },
    actor
  );
  const express = require('express'),
    jwt = require('jsonwebtoken');
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'synthetic-disposition-only';
  t.after(() =>
    previous === undefined
      ? delete process.env.JWT_SECRET
      : (process.env.JWT_SECRET = previous)
  );
  const app = express();
  app.use(express.json());
  app.use(
    '/api/merchant-local-dispatch',
    require('../../routes/merchantLocalDispatch.routes')
  );
  app.use('/api', require('../../routes/customer-order-operations.routes'));
  app.use((err, req, res, next) =>
    res.status(err.statusCode || 500).json({ message: err.message })
  );
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = (path) => `http://127.0.0.1:${server.address().port}${path}`;
  const call = async (path, input, who = actor, method = 'POST') => {
    const r = await fetch(url(`/api/merchant-local-dispatch${path}`), {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt.sign({ userId: String(who._id) }, process.env.JWT_SECRET)}`,
      },
      ...(method === 'POST' ? { body: JSON.stringify(input) } : {}),
    });
    const text = await r.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
    return { status: r.status, body };
  };
  const customerRead = async () => {
    const r = await fetch(url(`/api/customer-shipments/${f.order._id}`), {
      headers: {
        Authorization: `Bearer ${jwt.sign({ userId: String(f.customer) }, process.env.JWT_SECRET)}`,
      },
    });
    return { status: r.status, text: await r.text() };
  };
  const recover = (input, who) =>
    call(`/bookings/${booking._id}/recover`, input, who);
  const requested = await recover({
    action: 'return',
    expectedVersion: failed.version,
    idempotencyKey: 'return-request',
    reason: 'Return original goods to origin',
  });
  assert.equal(requested.status, 200, JSON.stringify(requested.body));
  const received = await recover({
    action: 'receive_return',
    expectedVersion: requested.body.data.booking.version,
    idempotencyKey: 'return-received',
    reason: 'Original sealed goods physically received',
  });
  assert.equal(received.status, 200, JSON.stringify(received.body));
  assert.equal(received.body.data.booking.state, 'returned');
  const record = await require('../../models/MerchantDeliveryReturn')
    .findOne({ booking: String(booking._id) })
    .lean();
  assert.equal(record.disposition, 'quarantined');
  return { f, child, actor, booking, call, customerRead, record, engine };
}
const assert = require('node:assert/strict');
const { connectVenueMongo } = require('./venueMongo');
module.exports = { quarantinedReturn };
