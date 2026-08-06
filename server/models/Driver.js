// models/Driver.js
//
// A delivery rider. Deliberately NOT a User: most riders are contractors who
// never sign in, and forcing an account per rider would both widen the auth
// role enum and litter the user table. The optional `user` ref covers the
// riders who do have a login, so a rider-facing view can be added later
// without a migration.

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const VEHICLE_TYPES = ['bike', 'tricycle', 'car', 'van', 'truck'];
const DRIVER_STATUSES = ['available', 'on_trip', 'off_duty', 'suspended'];

const driverSchema = new Schema(
  {
    tenant: {
      type: ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    // Only set for riders who also have a login.
    user: {
      type: ObjectId,
      ref: 'User',
      default: null,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
    },

    vehicle: {
      type: {
        type: String,
        enum: [...VEHICLE_TYPES, ''],
        default: 'bike',
      },
      plateNumber: { type: String, trim: true, maxlength: 20 },
      // Drives how many stops a dispatcher can sensibly batch onto one trip.
      capacityKg: { type: Number, min: 0, default: 0 },
    },

    licenseNumber: { type: String, trim: true, maxlength: 60 },
    licenseExpiry: { type: Date },
    licenseDocUrl: { type: String, trim: true, maxlength: 500 },

    status: {
      type: String,
      enum: DRIVER_STATUSES,
      default: 'available',
      index: true,
    },

    // Last known position. Written by whatever reports rider location; there is
    // no live GPS feed yet, so this stays null in normal operation.
    currentLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    notes: { type: String, maxlength: 1000 },

    createdBy: { type: ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Uniqueness is compound-with-tenant and NOTHING is declared unique at field
// level. A field-level `unique: true` on phone would build a GLOBAL unique
// index, so the moment two tenants hired riders sharing a number — or more
// realistically, the moment a second tenant existed at all — writes would fail
// with a duplicate key error pointing at an index nobody declared. This repo
// has already been bitten by exactly that with poNumber_1, and Mongoose will
// not drop a de-declared index nor re-option an existing one, so undoing it
// needs a migration script.
driverSchema.index({ tenant: 1, phone: 1 }, { unique: true });
driverSchema.index({ tenant: 1, status: 1 });
driverSchema.index({ tenant: 1, isActive: 1 });

driverSchema.virtual('isAvailable').get(function () {
  return this.isActive && this.status === 'available';
});

driverSchema.virtual('vehicleLabel').get(function () {
  const type = this.vehicle?.type;
  const plate = this.vehicle?.plateNumber;
  if (!type && !plate) return '';
  if (!plate) return type;
  return `${type} · ${plate}`;
});

const Driver = mongoose.models.Driver || mongoose.model('Driver', driverSchema);

module.exports = Driver;
module.exports.VEHICLE_TYPES = VEHICLE_TYPES;
module.exports.DRIVER_STATUSES = DRIVER_STATUSES;
