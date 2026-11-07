'use strict';
// models/OpenedBottle.js — usable volume tracked after opening one sealed unit (S2 pour stock).
// contentsMl snapshots the source Size volumeMl at open; remainingMl <= contentsMl; pours and
// approved waste are the only ways remainingMl moves down. state: open -> exhausted.
// autoIndex: false; indexes ensured via services/venue/audit-indexes.js.
const mongoose = require('mongoose'); const { Schema } = mongoose;
const schema = new Schema({
  tenant: { type: Schema.Types.ObjectId, required: true }, location: { type: Schema.Types.ObjectId, required: true },
  source: {
    subProduct: { type: Schema.Types.ObjectId, ref: 'SubProduct', required: true }, size: { type: Schema.Types.ObjectId, ref: 'Size', required: true },
  },
  batchAllocation: Schema.Types.Mixed, contentsMl: { type: Number, required: true, min: 0 },
  remainingMl: { type: Number, required: true, min: 0 },
  state: { type: String, enum: ['open', 'exhausted'], default: 'open' },
  openedAt: { type: Date, default: Date.now }, openedBy: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true, autoIndex: false });
schema.pre('validate', function () {
  if (this.remainingMl != null && this.contentsMl != null && this.remainingMl > this.contentsMl) this.invalidate('remainingMl', 'remaining ml cannot exceed bottle contents');
});
schema.index({ tenant: 1, location: 1, 'source.subProduct': 1, 'source.size': 1, state: 1 });
module.exports = mongoose.models.OpenedBottle || mongoose.model('OpenedBottle', schema);
