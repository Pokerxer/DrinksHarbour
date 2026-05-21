const mongoose = require('mongoose');
const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

// A "choice line" groups products the cashier can pick from.
// e.g. "Choose your spirit (pick 1)" or "Choose mixers (pick up to 2)"
const choiceLineSchema = new Schema({
  label:      { type: String, required: true },
  minSelect:  { type: Number, default: 1, min: 0 },
  maxSelect:  { type: Number, default: 1, min: 1 },
  required:   { type: Boolean, default: true },
  // Each item in the group can optionally restrict to specific size variants.
  // allowedSizes=[] means all sizes are selectable.
  items: [{
    subProduct:   { type: ObjectId, ref: 'SubProduct' },
    allowedSizes: [{ type: ObjectId, ref: 'Size' }],
    // Minimum units the cashier must pick of this specific product when selected
    minQty: { type: Number, default: 1, min: 1 },
    // Maximum units the cashier can pick of this specific product
    maxQty: { type: Number, default: 1, min: 1 },
  }],
  // Backward-compat: old format stored products:[ObjectId]
  products: [{ type: ObjectId, ref: 'SubProduct' }],
}, { _id: true });

const posComboSchema = new Schema({
  tenant:      { type: ObjectId, ref: 'Tenant', required: true, index: true },
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  image:       { type: String, default: '' },

  // ── Pricing ──────────────────────────────────────────────────────────────
  // dynamic            : combo price = Σ selected item selling prices (no change)
  // fixed              : flat price entered by admin
  // markup_on_cost     : Σ cost prices × (1 + markupPercentage/100)
  // discount_off_selling: Σ selling prices × (1 - discountPercentage/100)
  priceMode: {
    type:    String,
    enum:    ['dynamic', 'fixed', 'markup_on_cost', 'discount_off_selling'],
    default: 'dynamic',
  },
  // Used when priceMode = 'fixed'
  price:              { type: Number, default: 0, min: 0 },
  // Used when priceMode = 'markup_on_cost'
  markupPercentage:   { type: Number, default: 0, min: 0 },
  // Used when priceMode = 'discount_off_selling'
  discountPercentage: { type: Number, default: 0, min: 0, max: 100 },

  choiceLines: [choiceLineSchema],
  active:      { type: Boolean, default: true, index: true },
  triggerProducts: [{ type: ObjectId, ref: 'SubProduct' }],
}, { timestamps: true });

posComboSchema.index({ tenant: 1, active: 1 });

module.exports = mongoose.models.POSCombo || mongoose.model('POSCombo', posComboSchema);
