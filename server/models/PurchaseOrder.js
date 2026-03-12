// models/PurchaseOrder.js
const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ObjectId } = Schema;

const PurchaseOrderSchema = new Schema(
  {
    tenant: {
      type: ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    poNumber: {
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
    vendorReference: {
      type: String,
      trim: true,
    },
    currency: {
      type: String,
      default: "NGN",
      enum: ["NGN", "USD", "EUR", "GBP"],
    },
    orderDate: {
      type: Date,
      default: Date.now,
    },
    confirmationDate: {
      type: Date,
      default: Date.now,
    },
    expectedArrival: {
      type: Date,
    },
    paymentTerms: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["draft", "confirmed", "received", "validated", "cancelled"],
      default: "draft",
    },
    // RFQ (Request for Quotation) specific fields
    type: {
      type: String,
      enum: ["rfq", "po"],
      default: "po",
    },
    rfqStatus: {
      type: String,
      enum: ["draft", "sent", "quoted", "approved", "rejected", "converted", "expired", "cancelled"],
      default: undefined, // Only set for RFQs
    },
    validUntil: {
      type: Date,
    },
    termsConditions: {
      type: String,
      maxlength: 2000,
    },
    // Vendor responses for RFQ
    vendorResponses: [
      {
        vendorId: {
          type: ObjectId,
          ref: "Vendor",
        },
        vendorName: String,
        quoteDate: Date,
        totalAmount: Number,
        currency: String,
        items: [
          {
            subProductId: ObjectId,
            subProductName: String,
            quantity: Number,
            unitPrice: Number,
            totalPrice: Number,
            notes: String,
          }
        ],
        notes: String,
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected"],
          default: "pending",
        },
        respondedAt: Date,
      }
    ],
    // Selected vendor for conversion
    selectedVendorIndex: {
      type: Number,
      default: -1, // Index in vendorResponses array
    },
    // Original RFQ reference when converted
    originalRFQ: {
      type: ObjectId,
      ref: "PurchaseOrder",
    },
    // Reference to original PO for backorders
    originalPO: {
      type: ObjectId,
      ref: "PurchaseOrder",
    },
    isBackorder: {
      type: Boolean,
      default: false,
    },
    // Approval workflow
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: undefined, // Only set for POs above threshold
    },
    approvedBy: {
      type: ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    approvalNotes: {
      type: String,
    },
    items: [
      {
        subProductId: {
          type: ObjectId,
          ref: "SubProduct",
          required: true,
        },
        subProductName: {
          type: String,
          required: true,
        },
        sku: {
          type: String,
        },
        sizeId: {
          type: ObjectId,
          ref: "Size",
        },
        sizeName: {
          type: String,
        },
        quantity: {
          type: Number,
          required: true,
          min: 0,
        },
        receivedQty: {
          type: Number,
          default: 0,
          min: 0,
        },
        uom: {
          type: String,
          default: "Units",
        },
        packagingQty: {
          type: Number,
          default: 1,
        },
        packaging: {
          type: String,
        },
        packPrice: {
          type: Number,
          default: 0,
        },
        unitCost: {
          type: Number,
          default: 0,
        },
        discount: {
          type: Number,
          default: 0,
        },
        taxRate: {
          type: Number,
          default: 0,
        },
        totalCost: {
          type: Number,
          default: 0,
        },
      },
    ],
    notes: {
      type: String,
      maxlength: 2000,
    },
    createdBy: {
      type: ObjectId,
      ref: "User",
      required: true,
    },
    project: {
      type: String,
      trim: true,
    },
    // Bill control policy for this specific PO
    billControlPolicy: {
      type: String,
      enum: ["ordered", "received"],
      default: "received",
    },
    // Partial receipts tracking
    partialReceipts: [
      {
        receiptNumber: {
          type: String,
          required: true,
        },
        receiptDate: {
          type: Date,
          default: Date.now,
        },
        items: [
          {
            subProductId: {
              type: ObjectId,
              ref: 'SubProduct',
              required: true,
            },
            subProductName: String,
            sizeId: {
              type: ObjectId,
              ref: 'Size',
            },
            sizeName: String,
            quantityOrdered: {
              type: Number,
              required: true,
            },
            quantityReceived: {
              type: Number,
              required: true,
            },
            quantityRejected: {
              type: Number,
              default: 0,
            },
            packaging: String,
            notes: String,
            status: {
              type: String,
              enum: ['pending', 'validated', 'cancelled'],
              default: 'pending',
            },
          },
        ],
        receivedBy: {
          type: ObjectId,
          ref: 'User',
        },
        receivedByName: String,
        notes: String,
        status: {
          type: String,
          enum: ['pending', 'validated', 'cancelled'],
          default: 'pending',
        },
        isValidated: {
          type: Boolean,
          default: false,
        },
        validatedAt: Date,
      },
    ],
    // Track if partially received
    isPartiallyReceived: {
      type: Boolean,
      default: false,
    },
    // Fully received date
    fullyReceivedDate: {
      type: Date,
    },
    // Approved by name (for display)
    approvedByName: String,
    // Lock/Unlock feature - prevent edits after confirmation
    isLocked: {
      type: Boolean,
      default: false,
    },
    lockedAt: {
      type: Date,
    },
    lockedBy: {
      type: ObjectId,
      ref: 'User',
    },
    lockedByName: String,
    lockReason: {
      type: String,
      maxlength: 500,
    },
    // Agreement link (for POs created from agreements)
    purchaseAgreement: {
      type: ObjectId,
      ref: 'PurchaseAgreement',
    },
    agreementType: {
      type: String,
      enum: ['blanket_order', 'call_for_tender', 'none'],
      default: 'none',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
PurchaseOrderSchema.index({ tenant: 1, poNumber: 1 });
PurchaseOrderSchema.index({ tenant: 1, vendor: 1 });
PurchaseOrderSchema.index({ tenant: 1, status: 1 });
PurchaseOrderSchema.index({ confirmationDate: -1 });
PurchaseOrderSchema.index({ expectedArrival: 1 });
// RFQ indexes
PurchaseOrderSchema.index({ tenant: 1, type: 1 });
PurchaseOrderSchema.index({ tenant: 1, rfqStatus: 1 });
PurchaseOrderSchema.index({ tenant: 1, approvalStatus: 1 });

const PurchaseOrder =
  mongoose.models.PurchaseOrder ||
  mongoose.model("PurchaseOrder", PurchaseOrderSchema);

module.exports = PurchaseOrder;
