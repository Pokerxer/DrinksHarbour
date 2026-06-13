// models/Vendor.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const vendorSchema = new Schema(
  {
    tenant: {
      type: ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    vendorType: {
      type: String,
      enum: ['individual', 'company'],
      default: 'company',
    },
    slug: {
      type: String,
      trim: true,
      index: true,
      default: null,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String, default: 'Nigeria' },
      zipCode: { type: String },
    },
    contactPerson: {
      name: { type: String },
      email: { type: String },
      phone: { type: String },
    },
    bankDetails: {
      accountName: { type: String },
      accountNumber: { type: String },
      bankName: { type: String },
    },
    paymentTerms: {
      type: String,
      enum: ['prepaid', 'net_7', 'net_14', 'net_30', 'net_60'],
      default: 'net_30',
    },
    notes: {
      type: String,
      maxlength: 1000,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    taxId: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    photo: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual populate
vendorSchema.virtual('stockItems', {
  ref: 'SubProduct',
  localField: '_id',
  foreignField: 'vendor',
  justOne: false,
});

// Compound unique index
vendorSchema.index({ tenant: 1, name: 1 }, { unique: true });
vendorSchema.index({ tenant: 1, slug: 1 }, { unique: true, sparse: true });

// index
vendorSchema.index({ tenant: 1, name: 'text', email: 'text' });

function generateSlug(name) {
  return name.trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Must be registered before model compilation so it executes on Vendor.create()
vendorSchema.pre('save', async function() {
  if (this.isModified('name') && this.name) {
    this.slug = generateSlug(this.name);
  }
});

const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', vendorSchema);

Vendor.generateSlug = generateSlug;

module.exports = Vendor;
