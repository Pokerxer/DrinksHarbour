// models/Delivery.js
//
// A delivery TRIP — one rider, one run, several drops. Not one row per order:
// real Abuja runs batch 3–5 orders onto a single bike, and a Delivery-per-Order
// model cannot express that without being rebuilt later.
//
// Each stop points at an Order. The trip never writes Order.status itself;
// delivery.service routes every transition through orderStatus.service so the
// inventory side effects of 'shipped'/'cancelled' fire exactly once.

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const DELIVERY_STATUSES = [
  'draft',        // being assembled by the dispatcher
  'assigned',     // driver picked, not yet handed over
  'dispatched',   // rider has left; orders are 'shipped'
  'in_progress',  // at least one stop resolved, others outstanding
  'completed',
  'cancelled',
];

const STOP_STATUSES = ['pending', 'delivered', 'failed'];

const stopSchema = new Schema(
  {
    order: {
      type: ObjectId,
      ref: 'Order',
      required: true,
    },

    // Drop order along the route. Dispatcher-controlled; no auto-optimisation.
    sequence: {
      type: Number,
      default: 0,
    },

    // Snapshotted at trip creation. The rider's run sheet must not change
    // under them if the customer edits their address mid-trip.
    addressSnapshot: {
      fullName: String,
      phone: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      landmark: String,
      additionalInstructions: String,
    },

    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    // Copied from Order.shippingInfo so the board can group by area without
    // re-populating every order.
    zone: { type: String, default: null },
    zoneLabel: { type: String, default: null },

    status: {
      type: String,
      enum: STOP_STATUSES,
      default: 'pending',
    },

    deliveredAt: { type: Date, default: null },
    failureReason: { type: String, maxlength: 300 },

    proofOfDelivery: {
      recipientName: { type: String, trim: true, maxlength: 120 },
      note: { type: String, maxlength: 500 },
      photoUrl: { type: String, trim: true, maxlength: 500 },
      capturedAt: { type: Date, default: null },
    },

    // Derived at trip creation from the order's payment method — never typed
    // in by a dispatcher, so it cannot disagree with what the customer owes.
    codExpected: { type: Number, min: 0, default: 0 },
    codCollected: { type: Number, min: 0, default: 0 },
  },
  { _id: true }
);

const deliverySchema = new Schema(
  {
    tenant: {
      type: ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    deliveryNumber: {
      type: String,
      required: true,
      trim: true,
    },

    driver: {
      type: ObjectId,
      ref: 'Driver',
      default: null,
    },

    status: {
      type: String,
      enum: DELIVERY_STATUSES,
      default: 'draft',
      index: true,
    },

    scheduledFor: { type: Date, default: null },
    dispatchedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    // Dominant zone across the stops, for board grouping and filtering.
    zone: { type: String, default: null },
    zoneLabel: { type: String, default: null },

    stops: [stopSchema],

    totals: {
      stopCount: { type: Number, default: 0 },
      distanceKm: { type: Number, default: 0 },
      codExpectedTotal: { type: Number, default: 0 },
      codCollectedTotal: { type: Number, default: 0 },
    },

    codSettlement: {
      status: {
        type: String,
        enum: ['pending', 'settled'],
        default: 'pending',
      },
      amount: { type: Number, min: 0, default: 0 },
      settledAt: { type: Date, default: null },
      settledBy: { type: ObjectId, ref: 'User', default: null },
      notes: { type: String, maxlength: 500 },
    },

    notes: { type: String, maxlength: 1000 },
    createdBy: { type: ObjectId, ref: 'User' },
    cancelledReason: { type: String, maxlength: 300 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// deliveryNumber carries NO field-level `unique: true`. Sequence numbers are
// per-tenant ("TRIP-000001" restarts for each tenant), so a global unique index
// would reject the second tenant's very first trip. That is precisely the
// poNumber_1 outage this repo already had to migrate away from — and because
// Mongoose neither drops a de-declared index nor re-options an existing one,
// adding it here would need a migration script to remove.
deliverySchema.index({ tenant: 1, deliveryNumber: 1 }, { unique: true });
deliverySchema.index({ tenant: 1, status: 1 });
deliverySchema.index({ tenant: 1, driver: 1 });
deliverySchema.index({ tenant: 1, scheduledFor: -1 });
// Powers "is this order already on an active trip?" for the unassigned queue.
deliverySchema.index({ tenant: 1, 'stops.order': 1 });

/**
 * Recompute the denormalised rollups. Called before every save rather than
 * maintained incrementally, because stops get added, resequenced and resolved
 * from several endpoints and incremental counters drift.
 */
deliverySchema.methods.recalculateTotals = function () {
  const stops = this.stops || [];
  this.totals.stopCount = stops.length;
  this.totals.codExpectedTotal = stops.reduce((sum, s) => sum + (s.codExpected || 0), 0);
  this.totals.codCollectedTotal = stops.reduce((sum, s) => sum + (s.codCollected || 0), 0);

  // Dominant zone: the area most stops fall in, so the board can label a mixed
  // trip by where it mostly goes.
  const zoneCounts = new Map();
  for (const stop of stops) {
    if (!stop.zone) continue;
    zoneCounts.set(stop.zone, (zoneCounts.get(stop.zone) || 0) + 1);
  }
  if (zoneCounts.size) {
    const [topZone] = [...zoneCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    this.zone = topZone;
    this.zoneLabel = stops.find((s) => s.zone === topZone)?.zoneLabel || topZone;
  } else {
    this.zone = null;
    this.zoneLabel = null;
  }

  return this;
};

// Mongoose 9 dropped the `next` callback in middleware — hooks are promise
// based, so a `function (next)` signature gets an undefined `next`. Matches the
// async style every other model here already uses.
deliverySchema.pre('save', async function () {
  this.recalculateTotals();
});

deliverySchema.virtual('resolvedStopCount').get(function () {
  return (this.stops || []).filter((s) => s.status !== 'pending').length;
});

deliverySchema.virtual('isFullyResolved').get(function () {
  const stops = this.stops || [];
  return stops.length > 0 && stops.every((s) => s.status !== 'pending');
});

deliverySchema.virtual('codOutstanding').get(function () {
  return Math.max(
    0,
    (this.totals?.codExpectedTotal || 0) - (this.totals?.codCollectedTotal || 0)
  );
});

const Delivery = mongoose.models.Delivery || mongoose.model('Delivery', deliverySchema);

module.exports = Delivery;
module.exports.DELIVERY_STATUSES = DELIVERY_STATUSES;
module.exports.STOP_STATUSES = STOP_STATUSES;
