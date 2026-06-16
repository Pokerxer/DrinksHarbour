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
      enum: ["draft", "confirmed", "completed", "cancelled"],
      default: "draft",
    },
    items: [StockTransferItemSchema],
    notes: { type: String, maxlength: 2000, trim: true },
    scheduledDate: { type: Date },
    completedDate: { type: Date },
    completedBy: { type: ObjectId, ref: "User" },
    createdBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true }
);

StockTransferSchema.index(
  { tenant: 1, transferNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model("StockTransfer", StockTransferSchema);
