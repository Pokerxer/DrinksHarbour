// models/VendorReturn.js
const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ObjectId } = Schema;

const VendorReturnSchema = new Schema(
  {
    tenant: {
      type: ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    returnNumber: {
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
    // Original Purchase Order
    purchaseOrder: {
      type: ObjectId,
      ref: "PurchaseOrder",
    },
    poNumber: {
      type: String,
      trim: true,
    },
    // Vendor Bill for refund reference
    vendorBill: {
      type: ObjectId,
      ref: "VendorBill",
    },
    billNumber: {
      type: String,
      trim: true,
    },
    currency: {
      type: String,
      default: "NGN",
      enum: ["NGN", "USD", "EUR", "GBP"],
    },
    // Return items
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
        amount: {
          type: Number,
          default: 0,
        },
        reason: String,
        condition: {
          type: String,
          enum: ["damaged", "defective", "expired", "wrong_item", "over_supplied", "other"],
          default: "other",
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
    // Return status
    status: {
      type: String,
      enum: ["draft", "confirmed", "requested", "shipped", "in_transit", "received", "refunded", "rejected", "cancelled"],
      default: "draft",
    },
    // Dates
    returnDate: {
      type: Date,
      default: Date.now,
    },
    requestedDate: Date,
    shippedDate: Date,
    receivedDate: Date,
    refundedDate: Date,
    // Shipping info
    shippingCarrier: String,
    trackingNumber: String,
    returnAddress: String,
    // Refund info
    refundAmount: {
      type: Number,
      default: 0,
    },
    refundStatus: {
      type: String,
      enum: ["none", "pending", "processing", "completed", "rejected"],
      default: "none",
    },
    refundMethod: {
      type: String,
      enum: ["credit_note", "bank_transfer", "cash", "cheque", "other"],
    },
    refundReference: String,
    refundDate: Date,
    // Notes
    reason: {
      type: String,
      maxlength: 1000,
    },
    notes: {
      type: String,
      maxlength: 2000,
    },
    internalNotes: {
      type: String,
      maxlength: 2000,
    },
    // Created by
    createdBy: {
      type: ObjectId,
      ref: "User",
      required: true,
    },
    // Approved/confirmed by
    confirmedBy: {
      type: ObjectId,
      ref: "User",
    },
    confirmedAt: Date,
    // Received by
    receivedBy: {
      type: ObjectId,
      ref: "User",
    },
    receivedByName: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for remaining refund
VendorReturnSchema.virtual("remainingRefund").get(function () {
  return this.totalAmount - (this.refundAmount || 0);
});

// Generate return number
VendorReturnSchema.pre("save", async function (next) {
  if (this.isNew && !this.returnNumber) {
    const count = await this.constructor.countDocuments({ tenant: this.tenant });
    this.returnNumber = `RET-${String(count + 1).padStart(5, "0")}`;
  }
  next();
});

// Indexes
VendorReturnSchema.index({ tenant: 1, returnNumber: 1 });
VendorReturnSchema.index({ tenant: 1, vendor: 1 });
VendorReturnSchema.index({ tenant: 1, purchaseOrder: 1 });
VendorReturnSchema.index({ tenant: 1, status: 1 });
VendorReturnSchema.index({ tenant: 1, returnDate: -1 });

const VendorReturn =
  mongoose.models.VendorReturn ||
  mongoose.model("VendorReturn", VendorReturnSchema);

module.exports = VendorReturn;
