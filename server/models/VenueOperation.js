'use strict';
const mongoose = require('mongoose'); const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true }, location: { type: Schema.Types.ObjectId, required: true },
  actor: { type: Schema.Types.ObjectId, required: true }, operation: { type: String, required: true },
  key: { type: String, required: true, maxlength: 128 }, requestHash: { type: String, required: true }, result: Schema.Types.Mixed,
}, { timestamps: true, autoIndex: false });
schema.index({ tenant: 1, operation: 1, key: 1 }, { unique: true });
module.exports = mongoose.models.VenueOperation || mongoose.model('VenueOperation', schema);
