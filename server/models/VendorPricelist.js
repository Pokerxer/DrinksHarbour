// models/VendorPricelist.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const vendorPricelistSchema = new Schema(
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
    },
    vendor: {
      type: ObjectId,
      ref: 'Vendor',
      required: true,
    },
    vendorName: {
      type: String,
      required: true,
      trim: true,
    },
    currency: {
      type: String,
      default: 'NGN',
      enum: ['NGN', 'USD', 'EUR', 'GBP'],
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    notes: {
      type: String,
      maxlength: 1000,
    },
    items: [
      {
        subProductId: {
          type: ObjectId,
          ref: 'SubProduct',
          required: true,
        },
        subProductName: {
          type: String,
          required: true,
        },
        sku: String,
        productName: String,
        sizeId: {
          type: ObjectId,
          ref: 'Size',
        },
        sizeName: String,
        vendorProductCode: String,
        vendorProductName: String,
        basePrice: {
          type: Number,
          min: 0,
        },
        unitPrice: {
          type: Number,
          min: 0,
          required: true,
        },
        discountPercent: {
          type: Number,
          default: 0,
          min: 0,
          max: 100,
        },
        minQuantity: {
          type: Number,
          default: 1,
          min: 1,
        },
        maxQuantity: {
          type: Number,
        },
        leadTimeDays: {
          type: Number,
          default: 7,
          min: 0,
        },
        packaging: String,
        packagingQty: {
          type: Number,
          default: 1,
        },
        isPreferred: {
          type: Boolean,
          default: false,
        },
        lastPriceUpdate: {
          type: Date,
          default: Date.now,
        },
        notes: String,
      },
    ],
    createdBy: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

vendorPricelistSchema.index({ tenant: 1, vendor: 1 });
vendorPricelistSchema.index({ tenant: 1, isActive: 1 });
vendorPricelistSchema.index({ 'items.subProductId': 1 });
vendorPricelistSchema.index({ tenant: 1, vendor: 1, 'items.subProductId': 1 }, { unique: true, sparse: true });

vendorPricelistSchema.virtual('itemCount').get(function() {
  return this.items ? this.items.length : 0;
});

vendorPricelistSchema.methods.getPriceForProduct = function(subProductId, sizeId = null, quantity = 1) {
  const item = this.items.find(i => {
    const match = i.subProductId.toString() === subProductId.toString();
    const sizeMatch = sizeId ? i.sizeId && i.sizeId.toString() === sizeId.toString() : true;
    const qtyMatch = quantity >= (i.minQuantity || 1) && (!i.maxQuantity || quantity <= i.maxQuantity);
    return match && sizeMatch && qtyMatch;
  });
  return item ? item.unitPrice : null;
};

const VendorPricelist = mongoose.models.VendorPricelist || mongoose.model('VendorPricelist', vendorPricelistSchema);

module.exports = VendorPricelist;
