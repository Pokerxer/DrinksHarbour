const mongoose = require('mongoose');
const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  cycle: { type: Schema.Types.ObjectId, ref: 'AppraisalCycle', required: true },
  reviewer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
}, { timestamps: true });
schema.index({ tenant: 1, cycle: 1, reviewer: 1, subject: 1 }, { unique: true });
module.exports = mongoose.model('PeerAppraisalRating', schema);
