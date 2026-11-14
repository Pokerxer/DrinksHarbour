// server/models/AdClickDedupe.js
// The dedupe store for CPC clicks: ONE row per (campaign, visitor, day).
// `create` failing with E11000 on the unique index = the visitor already
// clicked this campaign today, so the click is NOT billed again (see
// server/services/adClick.service.js). Bounded by design — one row per
// visitor per day — never an unbounded clicks[] array on AdCampaign.
const mongoose = require('mongoose');

const AdClickDedupeSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdCampaign',
      required: true,
      index: true,
    },
    visitorKey: { type: String, required: true },
    day: { type: String, required: true }, // 'YYYY-MM-DD' (UTC)
  },
  { timestamps: true }
);

AdClickDedupeSchema.index({ campaign: 1, visitorKey: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('AdClickDedupe', AdClickDedupeSchema);
