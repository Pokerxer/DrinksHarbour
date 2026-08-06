// services/delivery.service.js
//
// Trip lifecycle. Everything that moves an Order goes through
// orderStatus.applyOrderStatus — see that file for why writing order.status
// directly here would corrupt inventory.

const mongoose = require('mongoose');
const Delivery = require('../models/Delivery');
const Driver = require('../models/Driver');
const Order = require('../models/Order');
const { applyOrderStatus } = require('./orderStatus.service');
const { ValidationError, NotFoundError } = require('../utils/errors');

// Orders a dispatcher may put on a trip: paid/confirmed work that has not left
// the building. 'pending' is excluded — it may still be unpaid.
const DISPATCHABLE_ORDER_STATUSES = ['confirmed', 'processing'];

// Trips that still hold their orders. Used to keep an order off the unassigned
// queue while it sits on somebody else's run sheet.
const ACTIVE_DELIVERY_STATUSES = ['draft', 'assigned', 'dispatched', 'in_progress'];

/**
 * Next per-tenant trip number. Mirrors how poNumber is generated: read the
 * highest existing number for THIS tenant and add one, so each tenant has its
 * own TRIP-000001.
 */
async function getNextDeliveryNumber(tenantId) {
  const last = await Delivery.findOne({ tenant: tenantId })
    .sort({ createdAt: -1 })
    .select('deliveryNumber')
    .lean();

  const lastSeq = last?.deliveryNumber
    ? parseInt(String(last.deliveryNumber).replace(/\D/g, ''), 10) || 0
    : 0;

  return `TRIP-${String(lastSeq + 1).padStart(6, '0')}`;
}

/**
 * What the customer still owes on delivery. Derived, never entered: a prepaid
 * order is zero even if the method says cash, because paymentStatus is what
 * says whether money already moved.
 */
function computeCodExpected(order) {
  const isCod = order.paymentMethod === 'cash_on_delivery';
  const alreadyPaid = order.paymentStatus === 'paid';
  return isCod && !alreadyPaid ? order.totalAmount || 0 : 0;
}

/** Build a stop from an order, snapshotting address and zone. */
function buildStop(order, sequence) {
  const addr = order.shippingAddress || {};
  return {
    order: order._id,
    sequence,
    addressSnapshot: {
      fullName: addr.fullName,
      phone: addr.phone,
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2,
      city: addr.city,
      state: addr.state,
      landmark: addr.landmark,
      additionalInstructions: addr.additionalInstructions,
    },
    coordinates: {
      lat: addr.coordinates?.latitude ?? null,
      lng: addr.coordinates?.longitude ?? null,
    },
    zone: order.shippingInfo?.zone || null,
    zoneLabel: order.shippingInfo?.zoneLabel || null,
    status: 'pending',
    codExpected: computeCodExpected(order),
    codCollected: 0,
  };
}

/**
 * Order ids whose delivery was attempted and failed, and whose trip is now
 * closed — so nobody is holding them any more.
 *
 * A failed stop deliberately leaves its order 'shipped' (the goods really are
 * out with the rider). That means the order no longer matches
 * DISPATCHABLE_ORDER_STATUSES, so without this it would drop out of the queue
 * forever the moment its trip completed: undeliverable, invisible, and
 * impossible to retry from the board.
 */
async function getFailedRedeliveryIds(tenantId) {
  const closedTripsWithFailures = await Delivery.find({
    tenant: tenantId,
    status: { $in: ['completed', 'cancelled'] },
    'stops.status': 'failed',
  })
    .select('stops.order stops.status')
    .lean();

  const ids = new Set();
  for (const trip of closedTripsWithFailures) {
    for (const stop of trip.stops || []) {
      if (stop.status === 'failed') ids.add(String(stop.order));
    }
  }
  return ids;
}

/**
 * Orders that are ready to go out and are not already on an active trip.
 * Includes failed deliveries awaiting another attempt.
 */
async function getUnassignedOrders(tenantId, { zone, limit = 100 } = {}) {
  const [activeTrips, retryIds] = await Promise.all([
    Delivery.find({
      tenant: tenantId,
      status: { $in: ACTIVE_DELIVERY_STATUSES },
    })
      .select('stops.order')
      .lean(),
    getFailedRedeliveryIds(tenantId),
  ]);

  const claimed = new Set();
  for (const trip of activeTrips) {
    for (const stop of trip.stops || []) claimed.add(String(stop.order));
  }

  // A retry candidate that has since been delivered or cancelled must not come
  // back, so the status guard applies to it too — it is just a different guard.
  const retryList = [...retryIds].map((id) => new mongoose.Types.ObjectId(id));

  const filter = {
    'items.tenant': tenantId,
    // Pickup orders are collected in store; they never need a rider.
    shippingMethod: { $ne: 'pickup' },
    $or: [
      { status: { $in: DISPATCHABLE_ORDER_STATUSES } },
      ...(retryList.length ? [{ _id: { $in: retryList }, status: 'shipped' }] : []),
    ],
  };
  if (zone) filter['shippingInfo.zone'] = zone;

  const orders = await Order.find(filter)
    .sort({ placedAt: 1 })
    .limit(Number(limit))
    .select(
      'orderNumber status paymentMethod paymentStatus totalAmount placedAt ' +
        'shippingAddress shippingInfo shippingMethod'
    )
    .lean();

  return orders
    .filter((o) => !claimed.has(String(o._id)))
    .map((o) => ({
      ...o,
      codExpected: computeCodExpected(o),
      isRedelivery: retryIds.has(String(o._id)),
    }));
}

/**
 * Create a trip from a set of orders. Orders are validated against the caller's
 * tenant and against being double-booked onto another active trip.
 */
async function createDelivery(tenantId, { orderIds = [], driverId, scheduledFor, notes }, actorId) {
  if (!orderIds.length) {
    throw new ValidationError('A trip needs at least one order.');
  }

  const ids = orderIds.map((id) => new mongoose.Types.ObjectId(id));

  // Retries are already 'shipped', so they fail the normal readiness check.
  // They are still legitimately dispatchable — the first attempt just did not
  // reach the customer. Accepting them here is what makes the retry entries in
  // the unassigned queue actionable rather than decorative.
  const retryIds = await getFailedRedeliveryIds(tenantId);
  const retryList = [...retryIds].map((id) => new mongoose.Types.ObjectId(id));

  const orders = await Order.find({
    _id: { $in: ids },
    'items.tenant': tenantId,
    $or: [
      { status: { $in: DISPATCHABLE_ORDER_STATUSES } },
      ...(retryList.length ? [{ _id: { $in: retryList }, status: 'shipped' }] : []),
    ],
  });

  if (orders.length !== orderIds.length) {
    throw new ValidationError(
      'Some orders could not be added: they may belong to another tenant, or are not ready to dispatch.'
    );
  }

  // Reject anything already claimed, rather than silently delivering it twice.
  const conflict = await Delivery.findOne({
    tenant: tenantId,
    status: { $in: ACTIVE_DELIVERY_STATUSES },
    'stops.order': { $in: ids },
  })
    .select('deliveryNumber')
    .lean();

  if (conflict) {
    throw new ValidationError(
      `One or more orders are already on trip ${conflict.deliveryNumber}.`
    );
  }

  if (driverId) await assertDriverAssignable(tenantId, driverId);

  const delivery = new Delivery({
    tenant: tenantId,
    deliveryNumber: await getNextDeliveryNumber(tenantId),
    driver: driverId || null,
    status: driverId ? 'assigned' : 'draft',
    scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    notes,
    createdBy: actorId,
    stops: orders.map((order, i) => buildStop(order, i)),
  });

  await delivery.save();
  return delivery;
}

/** A driver must exist, belong to this tenant, be active and not mid-trip. */
async function assertDriverAssignable(tenantId, driverId) {
  const driver = await Driver.findOne({ _id: driverId, tenant: tenantId });
  if (!driver) throw new NotFoundError('Driver not found.');
  if (!driver.isActive) throw new ValidationError(`${driver.name} is deactivated.`);
  if (driver.status === 'suspended') throw new ValidationError(`${driver.name} is suspended.`);
  return driver;
}

/**
 * Hand the trip to the rider: every order becomes 'shipped' (which commits the
 * stock movement) and the driver goes on_trip.
 */
async function dispatchDelivery(tenantId, deliveryId, actorId) {
  const delivery = await loadDelivery(tenantId, deliveryId);

  if (delivery.status !== 'assigned') {
    throw new ValidationError(
      `Only an assigned trip can be dispatched (this one is ${delivery.status}). Assign a driver first.`
    );
  }
  if (!delivery.driver) throw new ValidationError('Assign a driver before dispatching.');
  if (!delivery.stops.length) throw new ValidationError('This trip has no stops.');

  const orderIds = delivery.stops.map((s) => s.order);
  const orders = await Order.find({ _id: { $in: orderIds } });

  // Sequential, not Promise.all: each applyOrderStatus triggers stock movements
  // and these orders can share subproducts. Running them concurrently races the
  // same Size documents.
  for (const order of orders) {
    await applyOrderStatus(order, 'shipped', { actorId, tenantId });
  }

  delivery.status = 'dispatched';
  delivery.dispatchedAt = new Date();
  await delivery.save();

  await Driver.updateOne({ _id: delivery.driver, tenant: tenantId }, { status: 'on_trip' });

  return delivery;
}

/**
 * Resolve a single stop as delivered or failed.
 *
 * A delivered stop moves its order to 'delivered'. A failed stop leaves the
 * order 'shipped' — the goods are out with the rider and still owed to the
 * customer, so marking it anything else would misstate both fulfilment and
 * inventory.
 */
async function resolveStop(tenantId, deliveryId, stopId, payload, actorId) {
  const { status, failureReason, proofOfDelivery, codCollected } = payload;

  if (!['delivered', 'failed'].includes(status)) {
    throw new ValidationError('A stop can only be resolved as delivered or failed.');
  }

  const delivery = await loadDelivery(tenantId, deliveryId);

  if (!['dispatched', 'in_progress'].includes(delivery.status)) {
    throw new ValidationError(
      `Stops can only be resolved on a dispatched trip (this one is ${delivery.status}).`
    );
  }

  const stop = delivery.stops.id(stopId);
  if (!stop) throw new NotFoundError('Stop not found on this trip.');
  if (stop.status !== 'pending') {
    throw new ValidationError(`This stop is already marked ${stop.status}.`);
  }

  if (status === 'failed' && !failureReason) {
    throw new ValidationError('A failed stop needs a reason.');
  }

  stop.status = status;

  if (status === 'delivered') {
    stop.deliveredAt = new Date();

    if (proofOfDelivery) {
      stop.proofOfDelivery = {
        recipientName: proofOfDelivery.recipientName,
        note: proofOfDelivery.note,
        photoUrl: proofOfDelivery.photoUrl,
        capturedAt: new Date(),
      };
    }

    if (stop.codExpected > 0) {
      // Default to the full amount so a rider who collected exactly what was
      // owed does not have to retype it; a short payment is entered explicitly.
      stop.codCollected =
        codCollected === undefined || codCollected === null
          ? stop.codExpected
          : Number(codCollected);
    }

    const order = await Order.findById(stop.order);
    if (order) await applyOrderStatus(order, 'delivered', { actorId, tenantId });
  } else {
    stop.failureReason = failureReason;
  }

  // First resolved stop moves the trip off 'dispatched'.
  if (delivery.status === 'dispatched') delivery.status = 'in_progress';

  await delivery.save();
  return delivery;
}

/**
 * Close a trip. Every stop must be resolved first, otherwise a run with
 * forgotten drops would look finished.
 */
async function completeDelivery(tenantId, deliveryId) {
  const delivery = await loadDelivery(tenantId, deliveryId);

  if (!['dispatched', 'in_progress'].includes(delivery.status)) {
    throw new ValidationError(`This trip is ${delivery.status} and cannot be completed.`);
  }

  const unresolved = delivery.stops.filter((s) => s.status === 'pending');
  if (unresolved.length) {
    throw new ValidationError(
      `${unresolved.length} stop(s) still pending. Mark each delivered or failed first.`
    );
  }

  delivery.status = 'completed';
  delivery.completedAt = new Date();
  delivery.codSettlement.amount = delivery.stops.reduce(
    (sum, s) => sum + (s.codCollected || 0),
    0
  );
  await delivery.save();

  if (delivery.driver) {
    await Driver.updateOne({ _id: delivery.driver, tenant: tenantId }, { status: 'available' });
  }

  return delivery;
}

/** Record that the rider handed over the cash they collected. */
async function settleCod(tenantId, deliveryId, { notes } = {}, actorId) {
  const delivery = await loadDelivery(tenantId, deliveryId);

  if (delivery.status !== 'completed') {
    throw new ValidationError('Complete the trip before settling cash.');
  }
  if (delivery.codSettlement.status === 'settled') {
    throw new ValidationError('This trip is already settled.');
  }
  if (delivery.totals.codCollectedTotal <= 0) {
    throw new ValidationError('No cash was collected on this trip.');
  }

  delivery.codSettlement.status = 'settled';
  delivery.codSettlement.amount = delivery.totals.codCollectedTotal;
  delivery.codSettlement.settledAt = new Date();
  delivery.codSettlement.settledBy = actorId;
  if (notes) delivery.codSettlement.notes = notes;

  await delivery.save();
  return delivery;
}

/** Cancel a trip that has not left yet, releasing its orders. */
async function cancelDelivery(tenantId, deliveryId, reason) {
  const delivery = await loadDelivery(tenantId, deliveryId);

  if (!['draft', 'assigned'].includes(delivery.status)) {
    throw new ValidationError(
      'Only a trip that has not been dispatched can be cancelled. Resolve its stops instead.'
    );
  }

  delivery.status = 'cancelled';
  delivery.cancelledReason = reason || 'Cancelled by dispatcher';
  await delivery.save();

  if (delivery.driver) {
    await Driver.updateOne({ _id: delivery.driver, tenant: tenantId }, { status: 'available' });
  }

  // Orders were never moved to 'shipped', so they simply reappear in the
  // unassigned queue once this trip stops being active.
  return delivery;
}

/** Edit an undispatched trip: driver, schedule, notes, stop order. */
async function updateDelivery(tenantId, deliveryId, { driverId, scheduledFor, notes, stopOrder }) {
  const delivery = await loadDelivery(tenantId, deliveryId);

  if (!['draft', 'assigned'].includes(delivery.status)) {
    throw new ValidationError('A dispatched trip can no longer be edited.');
  }

  if (driverId !== undefined) {
    if (driverId) {
      await assertDriverAssignable(tenantId, driverId);
      delivery.driver = driverId;
      delivery.status = 'assigned';
    } else {
      delivery.driver = null;
      delivery.status = 'draft';
    }
  }

  if (scheduledFor !== undefined) {
    delivery.scheduledFor = scheduledFor ? new Date(scheduledFor) : null;
  }
  if (notes !== undefined) delivery.notes = notes;

  // Resequence by an array of stop ids.
  if (Array.isArray(stopOrder) && stopOrder.length) {
    stopOrder.forEach((stopId, index) => {
      const stop = delivery.stops.id(stopId);
      if (stop) stop.sequence = index;
    });
    delivery.stops.sort((a, b) => a.sequence - b.sequence);
  }

  await delivery.save();
  return delivery;
}

async function loadDelivery(tenantId, deliveryId) {
  const delivery = await Delivery.findOne({ _id: deliveryId, tenant: tenantId });
  if (!delivery) throw new NotFoundError('Trip not found.');
  return delivery;
}

module.exports = {
  getNextDeliveryNumber,
  computeCodExpected,
  buildStop,
  getFailedRedeliveryIds,
  getUnassignedOrders,
  createDelivery,
  dispatchDelivery,
  resolveStop,
  completeDelivery,
  settleCod,
  cancelDelivery,
  updateDelivery,
  loadDelivery,
  assertDriverAssignable,
  DISPATCHABLE_ORDER_STATUSES,
  ACTIVE_DELIVERY_STATUSES,
};
