// models/PurchaseAgreement.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema;

const purchaseAgreementSchema = new Schema(
  {
    tenant: {
      type: ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    agreementNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    agreementType: {
      type: String,
      enum: ['blanket_order', 'call_for_tender'],
      required: true,
    },
    selectionType: {
      type: String,
      enum: ['exclusive', 'non_exclusive'],
      default: 'exclusive',
    },
    vendor: {
      type: ObjectId,
      ref: 'Vendor',
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
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    totalQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    consumedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    consumedAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'expired', 'exhausted', 'cancelled'],
      default: 'draft',
    },
    termsConditions: {
      type: String,
      maxlength: 2000,
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
        sizeId: {
          type: ObjectId,
          ref: 'Size',
        },
        sizeName: String,
        quantity: {
          type: Number,
          min: 0,
          required: true,
        },
        consumedQuantity: {
          type: Number,
          min: 0,
          default: 0,
        },
        unitPrice: {
          type: Number,
          min: 0,
          required: true,
        },
        totalPrice: {
          type: Number,
          min: 0,
        },
        packaging: String,
        packagingQty: {
          type: Number,
          default: 1,
        },
        leadTimeDays: {
          type: Number,
          min: 0,
          default: 7,
        },
      },
    ],
    // For Call for Tenders - track vendor responses
    tenderResponses: [
      {
        vendorId: {
          type: ObjectId,
          ref: 'Vendor',
        },
        vendorName: String,
        submittedAt: Date,
        totalAmount: Number,
        currency: String,
        items: [
          {
            subProductId: ObjectId,
            subProductName: String,
            unitPrice: Number,
            totalPrice: Number,
            notes: String,
          },
        ],
        notes: String,
        deliveryDate: Date,
        validityDate: Date,
        status: {
          type: String,
          enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
          default: 'pending',
        },
      },
    ],
    // Link to POs created from this agreement
    purchaseOrders: [
      {
        type: ObjectId,
        ref: 'PurchaseOrder',
      },
    ],
    // Link to RFQs created from this agreement (for Call for Tenders)
    rfqs: [
      {
        type: ObjectId,
        ref: 'PurchaseOrder',
      },
    ],
    createdBy: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: ObjectId,
      ref: 'User',
    },
    approvedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

purchaseAgreementSchema.index({ tenant: 1, agreementNumber: 1 });
purchaseAgreementSchema.index({ tenant: 1, vendor: 1 });
purchaseAgreementSchema.index({ tenant: 1, status: 1 });
purchaseAgreementSchema.index({ startDate: 1, endDate: 1 });

purchaseAgreementSchema.virtual('isExpired').get(function() {
  return this.endDate && new Date() > this.endDate;
});

purchaseAgreementSchema.virtual('isExhausted').get(function() {
  return this.totalQuantity > 0 && this.consumedQuantity >= this.totalQuantity;
});

purchaseAgreementSchema.virtual('remainingQuantity').get(function() {
  return Math.max(0, this.totalQuantity - this.consumedQuantity);
});

purchaseAgreementSchema.virtual('remainingAmount').get(function() {
  return Math.max(0, this.totalAmount - this.consumedAmount);
});

purchaseAgreementSchema.pre('save', function(next) {
  if (this.isModified('items')) {
    this.items = this.items.map(item => ({
      ...item,
      totalPrice: item.quantity * item.unitPrice,
    }));
    this.totalQuantity = this.items.reduce((sum, item) => sum + item.quantity, 0);
    this.totalAmount = this.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  }
  next();
});

const PurchaseAgreement = mongoose.models.PurchaseAgreement || mongoose.model('PurchaseAgreement', purchaseAgreementSchema);

module.exports = PurchaseAgreement;
