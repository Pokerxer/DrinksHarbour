const mongoose = require('mongoose');

const BOOKING_STATUSES = ['pending', 'confirmed', 'checked_in', 'cancelled', 'completed', 'no_show'];

const BOOKING_TRANSITIONS = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['completed'],
  no_show:    [],
  cancelled:  [],
  completed:  [],
};

const bookingSchema = new mongoose.Schema(
  {
    moneyState: { type: String, enum: ['none', 'deposit_pending', 'deposit_received', 'paid_needs_resolution'], default: 'none' },
    financialTermsVersion: { type: Number, default: null }, financialTermsAcceptedAt: { type: Date, default: null },
    financialPolicy: { type: mongoose.Schema.Types.Mixed, default: null },
    depositDeadline: { type: Date, default: null },
    capacityClaim: { type: mongoose.Schema.Types.ObjectId, ref: 'VenueCapacityClaim', default: null },
    capacitySnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    requestMode: { type: String, enum: ['request_only'], default: undefined },
    requestReference: String,
    requestVersion: { type: Number, default: 0 },
    requestState: { type: String, enum: ['submitted', 'reviewed', 'declined', 'cancelled', 'expired'], default: undefined },
    requestPolicy: { type: mongoose.Schema.Types.Mixed, default: undefined },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    serviceSession: { type: mongoose.Schema.Types.ObjectId, ref: 'VenueServiceSession', default: null },
    venueIdentityVersion: { type: Number, enum: [0, 1], default: 0 },
    acquisitionAuthority: { type: String, enum: ['legacy', 'server'], default: 'legacy' },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    guest: {
      name:  { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, trim: true, default: '' },
    },
    partySize: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    bookingAt: {
      type: Date,
      required: true,
    },
    durationMin: {
      type: Number,
      default: 120,
      min: 15,
      max: 480,
    },
    tableLabel: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: 'pending',
    },
    source: {
      type: String,
      enum: ['pos', 'discovery', 'admin', 'direct'],
      default: 'pos',
    },
    checkoutStartedAt: Date,
  },
  { timestamps: true, optimisticConcurrency: true }
);

bookingSchema.index({ tenant: 1, bookingAt: 1 });
bookingSchema.index({ tenant: 1, location: 1, bookingAt: 1 });
// Staff request-queue listing walks {tenant, location, requestMode} with an
// _id cursor (services/venue/reservations.listRequests); without this index
// every page re-sorted the tenant's full booking history in memory.
bookingSchema.index({ tenant: 1, location: 1, requestMode: 1, _id: 1 });
bookingSchema.index({ tenant: 1, status: 1 });
bookingSchema.index({ requestReference: 1 }, { unique: true, partialFilterExpression: { requestReference: { $type: 'string' } } });
bookingSchema.index({ createdBy: 1, requestMode: 1, bookingAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
module.exports.BOOKING_STATUSES = BOOKING_STATUSES;
module.exports.BOOKING_TRANSITIONS = BOOKING_TRANSITIONS;
