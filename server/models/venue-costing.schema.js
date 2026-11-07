'use strict';
const { Schema } = require('mongoose');
const integer = {
  validator: Number.isSafeInteger,
  message: 'Expected a safe integer',
};
const quantity = new Schema(
  {
    amountScaled: { type: Number, min: 0, required: true, validate: integer },
    scale: { type: Number, enum: [1, 100], required: true },
    unit: { type: String, enum: ['count', 'g', 'ml'], required: true },
  },
  { _id: false },
);
const stockMapping = new Schema(
  {
    sourceSubProductId: { type: Schema.Types.ObjectId, required: true },
    sourceSizeId: { type: Schema.Types.ObjectId, required: true },
    sourceLocationId: { type: Schema.Types.ObjectId, required: true },
    contentQuantity: { type: quantity, required: true },
    reviewedBy: { type: Schema.Types.ObjectId, required: true },
    reviewedAt: { type: Date, required: true },
  },
  { _id: false },
);
const accounts = new Schema(
  {
    rawInventory: String,
    preparedInventory: String,
    issuedService: String,
    cogs: String,
    waste: String,
  },
  { _id: false },
);
const policy = new Schema(
  {
    productionLossTreatment: { type: String, enum: ['normal_absorbed'] },
    allowZeroOutputWaste: { type: Boolean, default: false },
    version: { type: Number, min: 1, validate: integer },
    state: { type: String, enum: ['draft', 'approved'] },
    approvedBy: Schema.Types.ObjectId,
    approvedAt: Date,
    recognitionTiming: { type: String, enum: ['canonical_sale'] },
    currency: { type: String, enum: ['NGN'] },
    accounts,
  },
  { _id: false },
);
const catalogCosting = new Schema(
  {
    servingsV2Enabled: { type: Boolean, default: false },
    actualCostingEnabled: { type: Boolean, default: false },
    policy,
  },
  { _id: false },
);
module.exports = { integer, quantity, stockMapping, catalogCosting };
