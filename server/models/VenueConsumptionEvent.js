'use strict';
// models/VenueConsumptionEvent.js — immutable consumption ledger keyed by effectKey (S2).
// effectKey (unique per tenant) is the retry guard: repeated fire / settlement must not
// produce a second event for the same {lineId, revision, billOrder}. kind is exactly
// 'poured' | 'recipe' | 'sealed-issue'. items freeze component quantities at consumption.
// autoIndex: false; indexes ensured via services/venue/audit-indexes.js.
const mongoose = require('mongoose'); const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true }, location: { type: Schema.Types.ObjectId, required: true },
  session: { type: Schema.Types.ObjectId, required: true }, billOrder: { type: Schema.Types.ObjectId, required: true },
  lineId: { type: String, required: true }, revision: { type: Number, required: true },
  effectKey: { type: String, required: true },
  kind: { type: String, enum: { values: ['poured', 'recipe', 'sealed-issue'], message: 'invalid consumption kind' }, required: true },
  fireDelta: Number, physicalCoverage: { type: String, enum: ['complete','legacy_ledger_only'] }, costSnapshotId: Schema.Types.ObjectId, movementIds: [Schema.Types.ObjectId],
  recipeVersion: Schema.Types.ObjectId,
  // S2 Task 5 additive: cost frozen from the active RecipeVersion at fire
  // (costMinorPerUnit × output quantity); null = unknown cost, never guessed.
  recipeCostMinor: { type: Number },
  items: [{
    subProduct: { type: Schema.Types.ObjectId, ref: 'SubProduct', required: true }, size: { type: Schema.Types.ObjectId, ref: 'Size', required: true },
    profile: Schema.Types.ObjectId, quantity: { type: Number, required: true }, unit: { type: String, enum: ['count', 'ml', 'g'], required: true },
    sourceEffect: Schema.Types.ObjectId,
  }],
  actor: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true, autoIndex: false });
schema.index({ tenant: 1, effectKey: 1 }, { unique: true });
module.exports = mongoose.models.VenueConsumptionEvent || mongoose.model('VenueConsumptionEvent', schema);
