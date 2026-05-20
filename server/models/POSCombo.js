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
  products:   [{ type: ObjectId, ref: 'SubProduct' }],
}, { _id: true });

const posComboSchema = new Schema({
  tenant:      { type: ObjectId, ref: 'Tenant', required: true, index: true },
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  image:       { type: String, default: '' },
  // Fixed combo price; 0 = sum of chosen product prices
  price:       { type: Number, default: 0, min: 0 },
  choiceLines: [choiceLineSchema],
  active:      { type: Boolean, default: true, index: true },
  // Which products trigger the combo picker when added to cart
  triggerProducts: [{ type: ObjectId, ref: 'SubProduct' }],
}, { timestamps: true });

posComboSchema.index({ tenant: 1, active: 1 });

module.exports = mongoose.models.POSCombo || mongoose.model('POSCombo', posComboSchema);
