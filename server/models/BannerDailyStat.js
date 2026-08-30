'use strict';

const mongoose = require('mongoose');

/**
 * BannerDailyStat — one document per (banner OR entity) per UTC day.
 *
 * Lightweight time-series bucket for the analytics trends dashboard. Each
 * impression/click bumps the matching day bucket via upsert so the trends
 * chart can aggregate by day without scanning every request-level event.
 *
 * Polymorphic: either
 *   - `banner` is set (tracks a Banner document by _id), OR
 *   - `entityType` + `entityId` are set (tracks a brand / category /
 *     subcategory hero — those are model fields, not Banner documents).
 *
 * TTL-indexed: documents older than 12 months are auto-purged by MongoDB
 * so the collection stays bounded.
 */
const bannerDailyStatSchema = new mongoose.Schema(
  {
    // ── Banner-document tracking ─────────────────────────────────────
    banner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Banner',
      default: null,
    },

    // ── Entity hero tracking (brand / category / subcategory) ────────
    // Their bannerImage / bannerLink live on the entity itself — there
    // is no Banner document to reference, so we key by (entityType, entityId).
    entityType: {
      type: String,
      enum: ['brand', 'category', 'subcategory'],
      default: null,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'entityType', // dynamic ref by entityType
      default: null,
    },

    /** UTC calendar day key — always midnight UTC for that date. */
    date: {
      type: Date,
      required: true,
    },

    /** Day-level counters (atomic via $inc). */
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Two disjoint unique indexes — sparse+partial so only the relevant one
// is enforced for each kind of row.
bannerDailyStatSchema.index(
  { banner: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: { banner: { $type: 'objectId' } },
  }
);
bannerDailyStatSchema.index(
  { entityType: 1, entityId: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: { entityId: { $type: 'objectId' } },
  }
);
bannerDailyStatSchema.index({ date: -1 });

// Auto-purge after 12 months to keep the collection bounded.
bannerDailyStatSchema.index(
  { date: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 365 }
);

const BannerDailyStat = mongoose.model(
  'BannerDailyStat',
  bannerDailyStatSchema
);

module.exports = BannerDailyStat;
