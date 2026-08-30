'use strict';

const mongoose = require('mongoose');

/**
 * EntityBannerStat — aggregate lifetime counters for a brand/category/
 * subcategory storefront hero banner.
 *
 * Separate from the Banner model because these banners live as fields
 * on their parent entity (bannerImage + bannerLink) — there is no
 * Banner document to bump.
 *
 * One document per (entityType, entity) pair. The daily time-series
 * lives in BannerDailyStat via the polymorphic entityType/entityId keys.
 */
const entityBannerStatSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ['brand', 'category', 'subcategory'],
      required: true,
    },
    entity: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    clickThroughRate: { type: Number, default: 0 },
    conversionCount: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

entityBannerStatSchema.index(
  { entityType: 1, entity: 1 },
  { unique: true }
);

// Increment helpers — called fire-and-forget from the tracking service.
entityBannerStatSchema.methods.incrementImpressions = async function () {
  this.impressions += 1;
  if (this.impressions > 0 && this.clicks > 0) {
    this.clickThroughRate = (this.clicks / this.impressions) * 100;
  }
  await this.save();
};

entityBannerStatSchema.methods.incrementClicks = async function () {
  this.clicks += 1;
  if (this.impressions > 0) {
    this.clickThroughRate = (this.clicks / this.impressions) * 100;
  }
  await this.save();
};

const EntityBannerStat = mongoose.model(
  'EntityBannerStat',
  entityBannerStatSchema
);

module.exports = EntityBannerStat;
