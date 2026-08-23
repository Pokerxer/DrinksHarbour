// models/StockTransfer.js
const mongoose = require("mongoose");
const { Schema } = mongoose;
const { ObjectId } = Schema;

const StockTransferItemSchema = new Schema(
  {
    subProductId: { type: ObjectId, ref: "SubProduct", required: true },
    subProductName: { type: String, required: true, trim: true },
    sku: { type: String, default: "", trim: true },
    sizeId: { type: ObjectId, ref: "Size" },
    sizeName: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    transferredQty: { type: Number, default: 0, min: 0 },
    costPrice: { type: Number, default: 0, min: 0 },
    // Destination purchase terms (see services/stockTransfer.money.js):
    // what the destination pays the source for this line.
    discountRate: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    receivedQty: { type: Number, default: 0, min: 0 },
    // Units per pack snapshot (Size.unitsPerPack at pick time) so printed
    // documents can show "5 packs & 1 bottle" without re-querying Size.
    packSize: { type: Number, default: 1, min: 1 },
    // Units never received when a transfer is closed with shortage
    // (quantity − receivedQty at close time).
    shortfallQty: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const StockTransferSchema = new Schema(
  {
    tenant: { type: ObjectId, ref: "Tenant", required: true, index: true },
    transferNumber: { type: String, required: true, trim: true },
    sourceWarehouse: { type: ObjectId, ref: "Warehouse", required: true },
    destinationWarehouse: { type: ObjectId, ref: "Warehouse", required: true },
    status: {
      type: String,
      enum: [
        "draft", "pending_approval", "confirmed",
        "in_transit", "partially_received",
        "completed", "cancelled", "rejected",
      ],
      default: "draft",
    },
    items: [StockTransferItemSchema],
    notes: { type: String, maxlength: 2000, trim: true },
    scheduledDate: { type: Date },
    completedDate: { type: Date },
    completedBy: { type: ObjectId, ref: "User" },
    confirmedBy: { type: ObjectId, ref: "User" },
    confirmedAt: { type: Date },
    cancelledBy: { type: ObjectId, ref: "User" },
    cancelledAt: { type: Date },
    // Approval workflow (gated by tenant warehouseSettings.requireTransferApproval
    // + transferApprovalThreshold). totalValue is the snapshot used to decide
    // whether this transfer needed approval at confirmation time.
    totalValue: { type: Number, default: 0, min: 0 },
    // ── Transfer-as-purchase money snapshot (authoritative: total) ──────────
    // Recomputed server-side on every write; totalValue mirrors total so the
    // approval gate keeps one comparison.
    deliveryCharge: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },

    // Source-side dispatch freeze.
    dispatchedBy: { type: ObjectId, ref: "User" },
    dispatchedAt: { type: Date },

    // Destination-side goods receipts (partial receiving). Each entry posts
    // stock + revaluation at write time; quantities land on items[].receivedQty.
    receipts: [
      {
        receivedBy: { type: ObjectId, ref: "User" },
        receivedAt: { type: Date, default: Date.now },
        lines: [
          {
            itemIndex: { type: Number, required: true, min: 0 },
            quantity: { type: Number, required: true, min: 1 },
            note: { type: String, maxlength: 300, trim: true },
          },
        ],
        shortagesClosed: { type: Boolean, default: false },
      },
    ],
    closedWithShortage: { type: Boolean, default: false },
    approvedBy: { type: ObjectId, ref: "User" },
    approvedAt: { type: Date },
    rejectedBy: { type: ObjectId, ref: "User" },
    rejectedAt: { type: Date },
    rejectionReason: { type: String, maxlength: 500, trim: true },
    createdBy: { type: ObjectId, ref: "User" },
    currency: {
      type: String,
      default: "NGN",
      enum: ["NGN", "USD", "EUR", "GBP"],
    },
  },
  { timestamps: true }
);

StockTransferSchema.index(
  { tenant: 1, transferNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model("StockTransfer", StockTransferSchema);
