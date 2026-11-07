'use strict';
// models/IngredientProfile.js — tenant ingredient config layered over a central SubProduct (S2).
// Uniqueness: one profile per SubProduct per tenant. autoIndex: false; indexes ensured
// via services/venue/audit-indexes.js (recipe model readiness) like other venue collections.
const mongoose = require('mongoose'); const { Schema } = mongoose;
const ALLERGEN_SOURCE = [
  'gluten', 'wheat', 'barley', 'rye', 'milk', 'lactose', 'eggs', 'fish',
  'shellfish', 'tree_nuts', 'peanuts', 'soy', 'sulfites', 'sulfur_dioxide',
];
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true }, subProduct: { type: Schema.Types.ObjectId, ref: 'SubProduct', required: true },
  dimension: { type: String, enum: ['count', 'volume', 'mass'], required: true },
  gramsPerMl: { type: Number, min: 0 },
  packageContent: new Schema({ packSize: Number, packsPerCarton: Number }, { _id: false }),
  allergenSource: [{ type: String, enum: ALLERGEN_SOURCE }], perishable: Boolean,
  createdBy: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true, autoIndex: false });
schema.index({ tenant: 1, subProduct: 1 }, { unique: true });
module.exports = mongoose.models.IngredientProfile || mongoose.model('IngredientProfile', schema);

module.exports.ALLERGEN_CODES = Object.freeze(ALLERGEN_SOURCE);
