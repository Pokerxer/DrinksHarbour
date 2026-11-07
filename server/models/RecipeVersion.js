'use strict';
// models/RecipeVersion.js — immutable versioned bill of materials per output serving (S2).
// Uniqueness: one row per {tenant, output.subProduct, output.size, version}, version 1..n
// monotonic, append-only (supersede sets supersededBy; versions never mutate).
// autoIndex: false; indexes ensured via services/venue/audit-indexes.js.
const mongoose = require('mongoose'); const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true },
  output: {
    subProduct: { type: Schema.Types.ObjectId, ref: 'SubProduct', required: 'recipe version needs an output subProduct' },
    size: { type: Schema.Types.ObjectId, ref: 'Size', required: 'recipe version needs an output size' },
  },
  version: { type: Number, min: [1, 'recipe version must be at least 1'], required: 'recipe version must be at least 1' },
  components: [{
    stockMapping: { type: require('./venue-costing.schema').stockMapping, default: undefined },
    profile: { type: Schema.Types.ObjectId, ref: 'IngredientProfile', required: true },
    quantity: { type: Number, required: true }, unit: { type: String, enum: ['count', 'ml', 'g'], required: true },
  }],
  yieldAssumption: new Schema({ units: Number, lossMl: Number }, { _id: false }),
  method: { type: String, maxlength: 2000 }, costMinorPerUnit: Number,
  supersededBy: Schema.Types.ObjectId, effectiveFrom: Date, createdBy: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true, autoIndex: false });
schema.index({ tenant: 1, 'output.subProduct': 1, 'output.size': 1, version: 1 }, { unique: true });
module.exports = mongoose.models.RecipeVersion || mongoose.model('RecipeVersion', schema);
