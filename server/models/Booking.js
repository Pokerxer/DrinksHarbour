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
      enum: ['pos', 'discovery', 'admin'],
      default: 'pos',
    },
  },
  { timestamps: true }
);

bookingSchema.index({ tenant: 1, bookingAt: 1 });
bookingSchema.index({ tenant: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
module.exports.BOOKING_STATUSES = BOOKING_STATUSES;
module.exports.BOOKING_TRANSITIONS = BOOKING_TRANSITIONS;