// server/__tests__/delivery.dispatch.test.js
//
// The logistics dispatch module moves orders. `updateOrderStatus` was never a
// plain field write — status 'shipped' decrements totalStock and releases the
// reservation, and 'cancelled' either restores stock or drops the reservation.
// A dispatch path that set order.status directly would ship goods without ever
// touching inventory, drifting Size.stock away from the warehouse ledger the
// same way the bulk-import double-count did.
//
// These tests pin the shared path (orderStatus.service), the derived COD
// amounts, the trip rollups, and the per-tenant index declarations.

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const inventoryService = require('../services/inventory.service');
const { applyOrderStatus } = require('../services/orderStatus.service');
const deliveryService = require('../services/delivery.service');
const Delivery = require('../models/Delivery');
const Driver = require('../models/Driver');

const oid = () => new mongoose.Types.ObjectId();

/** Minimal stand-in for the Order document applyOrderStatus loads and saves. */
function fakeOrder(overrides = {}) {
  return {
    _id: oid(),
    status: 'confirmed',
    items: [{ subproduct: oid(), tenant: oid(), quantity: 2 }],
    fulfillmentStatus: new Map(),
    paymentMethod: 'card',
    paymentStatus: 'paid',
    totalAmount: 25000,
    save: async function () {
      return this;
    },
    ...overrides,
  };
}

/** Swap the inventory side effects for recorders, restore after. */
function withInventorySpy(fn) {
  const original = {
    commitShipment: inventoryService.commitShipment,
    restoreStock: inventoryService.restoreStock,
    releaseReserve: inventoryService.releaseReserve,
  };
  const calls = { commitShipment: 0, restoreStock: 0, releaseReserve: 0 };

  inventoryService.commitShipment = async () => {
    calls.commitShipment += 1;
  };
  inventoryService.restoreStock = async () => {
    calls.restoreStock += 1;
  };
  inventoryService.releaseReserve = async () => {
    calls.releaseReserve += 1;
  };

  return Promise.resolve(fn(calls)).finally(() => {
    Object.assign(inventoryService, original);
  });
}

/**
 * Stand in for `Delivery.find(...).select(...).lean()` with a fixed result set,
 * so the retry scan can be tested without a database.
 */
function stubDeliveryFind(rows) {
  const original = Delivery.find;
  Delivery.find = () => ({
    select: () => ({
      lean: async () => rows,
    }),
  });
  return () => {
    Delivery.find = original;
  };
}

// ── Inventory side effects ────────────────────────────────────────────────────

test('shipping an order commits the stock movement exactly once', async () => {
  await withInventorySpy(async (calls) => {
    const order = fakeOrder({ status: 'confirmed' });
    await applyOrderStatus(order, 'shipped', { actorId: oid() });

    assert.equal(order.status, 'shipped');
    assert.ok(order.shippedAt, 'shippedAt should be stamped');
    assert.equal(calls.commitShipment, 1);
    assert.equal(calls.restoreStock, 0);
    assert.equal(calls.releaseReserve, 0);
  });
});

test('re-shipping an already-shipped order does not double-commit stock', async () => {
  await withInventorySpy(async (calls) => {
    const order = fakeOrder({ status: 'shipped', shippedAt: new Date('2026-01-01') });
    await applyOrderStatus(order, 'shipped', { actorId: oid() });

    assert.equal(calls.commitShipment, 0, 'no second decrement for the same shipment');
  });
});

test('cancelling before shipment releases the reservation, not physical stock', async () => {
  await withInventorySpy(async (calls) => {
    const order = fakeOrder({ status: 'confirmed' });
    await applyOrderStatus(order, 'cancelled', { cancelReason: 'customer changed mind' });

    assert.equal(calls.releaseReserve, 1);
    assert.equal(calls.restoreStock, 0);
    assert.equal(order.cancelReason, 'customer changed mind');
  });
});

test('cancelling after shipment restores physical stock', async () => {
  await withInventorySpy(async (calls) => {
    const order = fakeOrder({ status: 'shipped' });
    await applyOrderStatus(order, 'cancelled', {});

    assert.equal(calls.restoreStock, 1);
    assert.equal(calls.releaseReserve, 0);
  });
});

test('delivering stamps deliveredAt and touches no inventory', async () => {
  await withInventorySpy(async (calls) => {
    const order = fakeOrder({ status: 'shipped' });
    await applyOrderStatus(order, 'delivered', {});

    assert.ok(order.deliveredAt);
    assert.equal(calls.commitShipment + calls.restoreStock + calls.releaseReserve, 0);
  });
});

test('an existing timestamp is not overwritten on re-entry', async () => {
  await withInventorySpy(async () => {
    const original = new Date('2026-01-01T10:00:00Z');
    const order = fakeOrder({ status: 'processing', shippedAt: original });
    await applyOrderStatus(order, 'shipped', {});

    assert.equal(order.shippedAt.getTime(), original.getTime());
  });
});

test('a tenant-scoped dispatch only claims that tenant’s fulfillment slice', async () => {
  await withInventorySpy(async () => {
    const tenantId = oid();
    const otherTenant = oid();
    const order = fakeOrder({ status: 'confirmed' });

    await applyOrderStatus(order, 'shipped', { tenantId });

    assert.equal(order.fulfillmentStatus.get(String(tenantId)), 'shipped');
    assert.equal(order.fulfillmentStatus.get(String(otherTenant)), undefined);
  });
});

test('an unknown status is rejected rather than silently written', async () => {
  const order = fakeOrder();
  await assert.rejects(
    () => applyOrderStatus(order, 'teleported', {}),
    /Invalid order status/
  );
});

// ── Cash on delivery ──────────────────────────────────────────────────────────

test('COD is owed only when the order is cash on delivery and unpaid', () => {
  const owed = deliveryService.computeCodExpected({
    paymentMethod: 'cash_on_delivery',
    paymentStatus: 'pending',
    totalAmount: 18000,
  });
  assert.equal(owed, 18000);
});

test('a prepaid cash-on-delivery order owes nothing at the door', () => {
  const owed = deliveryService.computeCodExpected({
    paymentMethod: 'cash_on_delivery',
    paymentStatus: 'paid',
    totalAmount: 18000,
  });
  assert.equal(owed, 0, 'paymentStatus, not the method label, decides whether money moved');
});

test('a card order owes nothing at the door', () => {
  const owed = deliveryService.computeCodExpected({
    paymentMethod: 'card',
    paymentStatus: 'paid',
    totalAmount: 18000,
  });
  assert.equal(owed, 0);
});

// ── Stop building ─────────────────────────────────────────────────────────────

test('a stop snapshots the address and zone rather than referencing them', () => {
  const order = {
    _id: oid(),
    paymentMethod: 'cash_on_delivery',
    paymentStatus: 'pending',
    totalAmount: 9000,
    shippingAddress: {
      fullName: 'Ada Obi',
      phone: '08030000000',
      addressLine1: '39 Gana St',
      city: 'Abuja',
      state: 'FCT',
      landmark: 'Opposite the park',
      coordinates: { latitude: 9.0782726, longitude: 7.5005914 },
    },
    shippingInfo: { zone: 'maitama', zoneLabel: 'Maitama' },
  };

  const stop = deliveryService.buildStop(order, 3);

  assert.equal(stop.sequence, 3);
  assert.equal(stop.status, 'pending');
  assert.equal(stop.addressSnapshot.addressLine1, '39 Gana St');
  assert.equal(stop.addressSnapshot.landmark, 'Opposite the park');
  assert.equal(stop.coordinates.lat, 9.0782726);
  assert.equal(stop.coordinates.lng, 7.5005914);
  assert.equal(stop.zone, 'maitama');
  assert.equal(stop.codExpected, 9000);
  assert.equal(stop.codCollected, 0);
});

test('a stop survives an order with no address or shipping info', () => {
  const stop = deliveryService.buildStop({ _id: oid(), totalAmount: 0 }, 0);
  assert.equal(stop.coordinates.lat, null);
  assert.equal(stop.zone, null);
  assert.equal(stop.codExpected, 0);
});

// ── Trip rollups ──────────────────────────────────────────────────────────────

test('trip totals sum COD across stops and label the trip by dominant zone', () => {
  const trip = new Delivery({
    tenant: oid(),
    deliveryNumber: 'TRIP-000001',
    stops: [
      { order: oid(), zone: 'maitama', zoneLabel: 'Maitama', codExpected: 5000, codCollected: 5000 },
      { order: oid(), zone: 'maitama', zoneLabel: 'Maitama', codExpected: 3000, codCollected: 0 },
      { order: oid(), zone: 'wuse', zoneLabel: 'Wuse', codExpected: 0, codCollected: 0 },
    ],
  });

  trip.recalculateTotals();

  assert.equal(trip.totals.stopCount, 3);
  assert.equal(trip.totals.codExpectedTotal, 8000);
  assert.equal(trip.totals.codCollectedTotal, 5000);
  assert.equal(trip.zone, 'maitama', 'two of three stops are in Maitama');
  assert.equal(trip.zoneLabel, 'Maitama');
  assert.equal(trip.codOutstanding, 3000);
});

test('a trip with no zoned stops reports no zone rather than a stale one', () => {
  const trip = new Delivery({
    tenant: oid(),
    deliveryNumber: 'TRIP-000002',
    zone: 'maitama',
    stops: [{ order: oid() }],
  });

  trip.recalculateTotals();
  assert.equal(trip.zone, null);
});

test('a trip is only fully resolved once no stop is still pending', () => {
  const trip = new Delivery({
    tenant: oid(),
    deliveryNumber: 'TRIP-000003',
    stops: [
      { order: oid(), status: 'delivered' },
      { order: oid(), status: 'pending' },
    ],
  });
  assert.equal(trip.isFullyResolved, false);
  assert.equal(trip.resolvedStopCount, 1);

  trip.stops[1].status = 'failed';
  assert.equal(trip.isFullyResolved, true, 'a failed stop is resolved, just not delivered');
});

// ── Index declarations ────────────────────────────────────────────────────────
//
// A field-level `unique: true` here would build a GLOBAL unique index, so the
// second tenant's very first TRIP-000001 would fail with a duplicate key error.
// That is the poNumber_1 outage, and Mongoose neither drops a de-declared index
// nor re-options an existing one — so this has to be right the first time.

test('deliveryNumber is unique per tenant, never globally', () => {
  const path = Delivery.schema.path('deliveryNumber');
  assert.notEqual(path.options.unique, true, 'no field-level unique on deliveryNumber');

  const compound = Delivery.schema.indexes().find(
    ([fields, opts]) =>
      opts?.unique && fields.tenant === 1 && fields.deliveryNumber === 1
  );
  assert.ok(compound, 'expected a unique {tenant, deliveryNumber} compound index');
});

test('driver phone is unique per tenant, never globally', () => {
  const path = Driver.schema.path('phone');
  assert.notEqual(path.options.unique, true, 'no field-level unique on phone');

  const compound = Driver.schema
    .indexes()
    .find(([fields, opts]) => opts?.unique && fields.tenant === 1 && fields.phone === 1);
  assert.ok(compound, 'expected a unique {tenant, phone} compound index');
});

// ── Dispatchable set ──────────────────────────────────────────────────────────

test('only confirmed and processing orders are dispatchable', () => {
  assert.deepEqual(deliveryService.DISPATCHABLE_ORDER_STATUSES, ['confirmed', 'processing']);
  assert.ok(
    !deliveryService.DISPATCHABLE_ORDER_STATUSES.includes('pending'),
    'pending orders may be unpaid and must not go out on a bike'
  );
});

// ── Failed deliveries come back ───────────────────────────────────────────────
//
// A failed stop leaves its order 'shipped' on purpose — the goods really did go
// out with the rider. The trap is what happens next: once that trip completes,
// the order is no longer held by an active trip, but it also no longer matches
// the dispatchable statuses. Without an explicit retry path it silently drops
// out of the queue forever: undeliverable and invisible.

test('a failed stop on a closed trip is offered again for redelivery', async () => {
  const tenantId = oid();
  const failedOrderId = oid();
  const deliveredOrderId = oid();

  const restore = stubDeliveryFind([
    {
      status: 'completed',
      stops: [
        { order: failedOrderId, status: 'failed' },
        { order: deliveredOrderId, status: 'delivered' },
      ],
    },
  ]);

  try {
    const ids = await deliveryService.getFailedRedeliveryIds(tenantId);
    assert.ok(ids.has(String(failedOrderId)), 'the failed stop should be retryable');
    assert.ok(
      !ids.has(String(deliveredOrderId)),
      'a delivered stop on the same trip must not come back'
    );
  } finally {
    restore();
  }
});

test('a trip still on the road does not yet offer its failed stop for retry', async () => {
  // Only closed trips are scanned: a rider mid-run may still reattempt the drop
  // themselves, and surfacing it now would let a dispatcher double-book it.
  const restore = stubDeliveryFind([]);
  try {
    const ids = await deliveryService.getFailedRedeliveryIds(oid());
    assert.equal(ids.size, 0);
  } finally {
    restore();
  }
});

test('redelivering an already-shipped order does not decrement stock twice', async () => {
  await withInventorySpy(async (calls) => {
    // The retry path re-dispatches an order that is already 'shipped'. The
    // stock left the building on the first attempt, so a second commit would
    // double-count it.
    const order = fakeOrder({ status: 'shipped' });
    await applyOrderStatus(order, 'shipped', { actorId: oid() });

    assert.equal(calls.commitShipment, 0);
  });
});

test('every pre-completion trip status holds its orders off the unassigned queue', () => {
  for (const status of ['draft', 'assigned', 'dispatched', 'in_progress']) {
    assert.ok(
      deliveryService.ACTIVE_DELIVERY_STATUSES.includes(status),
      `${status} must count as active or its orders get double-booked`
    );
  }
  assert.ok(!deliveryService.ACTIVE_DELIVERY_STATUSES.includes('cancelled'));
  assert.ok(!deliveryService.ACTIVE_DELIVERY_STATUSES.includes('completed'));
});
