// models/TaxRecord.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const SOURCE_TYPES = [
  "sales_order",
  "purchase_order",
  "vendor_bill",
  "stock_transfer",
  "vendor_return",
];

const TaxRecordSchema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    // null when the source document had no configured Tax match (legacy rates)
    tax: { type: Schema.Types.ObjectId, ref: "Tax", default: null },
    taxName: { type: String, required: true, trim: true },
    taxRate: { type: Number, required: true, min: 0 },
    sourceType: { type: String, enum: SOURCE_TYPES, required: true, index: true },
    sourceId: { type: Schema.Types.ObjectId, required: true, index: true },
    sourceNumber: { type: String, default: "", trim: true },
    direction: {
      type: String,
      enum: ["collected", "paid", "internal"],
      required: true,
    },
    taxableBase: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "NGN", enum: ["NGN", "USD", "EUR", "GBP"] },
    status: { type: String, enum: ["posted", "reversed"], default: "posted", index: true },
    postedAt: { type: Date, default: Date.now },
    postedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// One live record per source document+rate group; reversals free the slot so a
// re-posted document can capture again.
TaxRecordSchema.index(
  { tenant: 1, sourceType: 1, sourceId: 1, taxName: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "posted" },
  }
);

module.exports = mongoose.model("TaxRecord", TaxRecordSchema);
