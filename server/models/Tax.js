// models/Tax.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const TaxSchema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    rate: { type: Number, required: true, min: 0, max: 100 },
    // output = charged on sales (collected); input = paid on purchases
    type: { type: String, enum: ["output", "input"], required: true },
    appliesTo: {
      type: [String],
      enum: ["sale", "purchase", "transfer", "return"],
      default: ["sale", "purchase", "transfer", "return"],
    },
    // Fallback tax for its `type` within each context listed in appliesTo.
    // Service unsets previous defaults of the same (type, context) pair.
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

TaxSchema.index({ tenant: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Tax", TaxSchema);
