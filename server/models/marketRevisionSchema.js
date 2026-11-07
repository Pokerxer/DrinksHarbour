'use strict';
const mongoose = require('mongoose');
module.exports = function marketRevisionSchema(fields, scope) {
  const schema = new mongoose.Schema({
    market: { type: String, required: true },
    category: { type: String, enum: ['beverage', 'gift', 'food'], required: true },
    channel: { type: String, enum: ['marketplace', 'storefront'], required: true },
    version: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, maxlength: 1000 },
    effectiveFrom: Date, effectiveUntil: Date,
    ...fields,
  }, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, strict: 'throw', autoIndex: false });
  schema.index({ ...scope, version: 1 }, { unique: true });
  schema.pre('save', function () { if (!this.isNew) throw new Error('Market revisions are immutable'); });
  for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete']) {
    schema.pre(op, function () { throw new Error('Market revisions are immutable'); });
  }
  schema.pre('deleteOne', { document: true, query: false }, function () { throw new Error('Market revisions are immutable'); });
  schema.pre('bulkWrite', function () { throw new Error('Market revisions are immutable; append through management'); });
  return schema;
};
