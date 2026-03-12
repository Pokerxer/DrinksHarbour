// models/VendorBill.js
const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ObjectId } = Schema;

const VendorBillSchema = new Schema(
  {
    tenant: {
      type: ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    billNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    vendor: {
      type: ObjectId,
      ref: "Vendor",
    },
    vendorName: {
      type: String,
      required: true,
      trim: true,
    },
    purchaseOrder: {
      type: ObjectId,
      ref: "PurchaseOrder",
    },
    currency: {
      type: String,
      default: "NGN",
      enum: ["NGN", "USD", "EUR", "GBP"],
    },
    items: [
      {
        subProductId: {
          type: ObjectId,
          ref: "SubProduct",
        },
        subProductName: {
          type: String,
        },
        sku: String,
        sizeId: ObjectId,
        sizeName: String,
        quantity: {
          type: Number,
          required: true,
          min: 0,
        },
        unitPrice: {
          type: Number,
          default: 0,
        },
        taxRate: {
          type: Number,
          default: 0,
        },
        amount: {
          type: Number,
          default: 0,
        },
      },
    ],
    subtotal: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    billDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["draft", "confirmed", "paid", "partial", "overdue", "cancelled"],
      default: "draft",
    },
    // 3-way matching
    matchingStatus: {
      type: String,
      enum: ["pending", "matched", "mismatch", "overreceived", "underreceived"],
      default: "pending",
    },
    matchingNotes: String,
    // Payments
    payments: [
      {
        amount: Number,
        date: Date,
        method: {
          type: String,
          enum: ["cash", "bank_transfer", "cheque", "card", "other"],
        },
        reference: String,
        notes: String,
        recordedBy: {
          type: ObjectId,
          ref: "User",
        },
      },
    ],
    paidAmount: {
      type: Number,
      default: 0,
    },
    // Notes
    notes: {
      type: String,
      maxlength: 2000,
    },
    terms: {
      type: String,
      maxlength: 1000,
    },
    createdBy: {
      type: ObjectId,
      ref: "User",
      required: true,
    },
    // Enhanced 3-way matching fields
    shouldBePaid: {
      type: String,
      enum: ["yes", "no", "exception", "pending"],
      default: "pending",
    },
    // PO quantities for comparison
    poOrderedQty: {
      type: Number,
      default: 0,
    },
    poReceivedQty: {
      type: Number,
      default: 0,
    },
    billQty: {
      type: Number,
      default: 0,
    },
    // Matching comparison details
    matchingDetails: {
      priceMatch: {
        type: Boolean,
        default: true,
      },
      quantityMatch: {
        type: Boolean,
        default: true,
      },
      receivedMatch: {
        type: Boolean,
        default: true,
      },
      poTotal: Number,
      billTotal: Number,
      receivedTotal: Number,
      variance: Number,
      varianceReason: String,
    },
    // Override reason if matching fails but still paid
    overrideReason: String,
    overrideBy: {
      type: ObjectId,
      ref: "User",
    },
    overrideAt: Date,
    // Validated by
    validatedBy: {
      type: ObjectId,
      ref: "User",
    },
    validatedAt: Date,
    // Bill control policy used
    billControlPolicy: {
      type: String,
      enum: ["ordered", "received"],
      default: "received",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for remaining amount
VendorBillSchema.virtual("remainingAmount").get(function () {
  return this.totalAmount - (this.paidAmount || 0);
});

// Indexes
VendorBillSchema.index({ tenant: 1, billNumber: 1 });
VendorBillSchema.index({ tenant: 1, vendor: 1 });
VendorBillSchema.index({ tenant: 1, purchaseOrder: 1 });
VendorBillSchema.index({ tenant: 1, status: 1 });
VendorBillSchema.index({ tenant: 1, billDate: -1 });
VendorBillSchema.index({ tenant: 1, dueDate: 1 });

const VendorBill =
  mongoose.models.VendorBill ||
  mongoose.model("VendorBill", VendorBillSchema);

module.exports = VendorBill;
