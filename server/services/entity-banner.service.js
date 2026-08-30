'use strict';

const mongoose = require('mongoose');
const EntityBannerStat = require('../models/EntityBannerStat');
const BannerDailyStat = require('../models/BannerDailyStat');

const VALID_TYPES = ['brand', 'category', 'subcategory'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateKey(date) {
  const d = new Date(date || Date.now());
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ── Tracking ─────────────────────────────────────────────────────────────────

async function bumpEntityDailyStat(entityType, entityId, field) {
  const date = toDateKey();
  await BannerDailyStat.updateOne(
    { entityType, entityId, date },
    { $inc: { [field]: 1 } },
    { upsert: true }
  ).catch(() => {});
}

async function getOrCreateEntityStat(entityType, entityId) {
  let doc = await EntityBannerStat.findOne({ entityType, entity: entityId });
  if (!doc) {
    doc = await EntityBannerStat.create({ entityType, entity: entityId });
  }
  return doc;
}

async function trackEntityImpression(entityType, entityId) {
  if (!VALID_TYPES.includes(entityType)) throw Object.assign(new Error('Invalid entity type'), { statusCode: 400 });
  if (!mongoose.Types.ObjectId.isValid(entityId)) throw Object.assign(new Error('Invalid entity ID'), { statusCode: 400 });

  const stat = await getOrCreateEntityStat(entityType, entityId);
  await stat.incrementImpressions();
  bumpEntityDailyStat(entityType, entityId, 'impressions');
}

async function trackEntityClick(entityType, entityId) {
  if (!VALID_TYPES.includes(entityType)) throw Object.assign(new Error('Invalid entity type'), { statusCode: 400 });
  if (!mongoose.Types.ObjectId.isValid(entityId)) throw Object.assign(new Error('Invalid entity ID'), { statusCode: 400 });

  const stat = await getOrCreateEntityStat(entityType, entityId);
  await stat.incrementClicks();
  bumpEntityDailyStat(entityType, entityId, 'clicks');
}

// ── Analytics ────────────────────────────────────────────────────────────────

async function getEntityAnalytics(entityType, entityId) {
  if (!VALID_TYPES.includes(entityType)) throw Object.assign(new Error('Invalid entity type'), { statusCode: 400 });
  if (!mongoose.Types.ObjectId.isValid(entityId)) throw Object.assign(new Error('Invalid entity ID'), { statusCode: 400 });

  const stat = await EntityBannerStat.findOne({ entityType, entity: entityId }).lean();
  return stat || { impressions: 0, clicks: 0, clickThroughRate: 0, conversionCount: 0, conversionRate: 0 };
}

async function getAllEntityAnalytics() {
  const [byType, trends] = await Promise.all([
    EntityBannerStat.aggregate([
      { $group: {
        _id: '$entityType',
        count: { $sum: 1 },
        impressions: { $sum: '$impressions' },
        clicks: { $sum: '$clicks' },
        avgCTR: { $avg: '$clickThroughRate' },
      }},
      { $project: {
        _id: 0,
        entityType: '$_id',
        count: 1,
        impressions: 1,
        clicks: 1,
        avgCTR: { $round: ['$avgCTR', 2] },
      }},
      { $sort: { impressions: -1 } },
    ]),

    // Entity banner daily trends (last 30 days)
    (async () => {
      const since = toDateKey();
      since.setUTCDate(since.getUTCDate() - 29);
      return BannerDailyStat.aggregate([
        { $match: { entityType: { $in: VALID_TYPES }, date: { $gte: since } } },
        { $group: {
          _id: { date: '$date', entityType: '$entityType' },
          impressions: { $sum: '$impressions' },
          clicks: { $sum: '$clicks' },
          conversions: { $sum: '$conversions' },
        }},
        { $project: {
          _id: 0,
          date: { $dateToString: { format: '%Y-%m-%d', date: '$_id.date' } },
          entityType: '$_id.entityType',
          impressions: 1,
          clicks: 1,
          conversions: 1,
        }},
        { $sort: { date: 1 } },
      ]);
    })(),
  ]);

  // Top entities by clicks
  const topPerformers = await EntityBannerStat.find()
    .sort({ clicks: -1 })
    .limit(10)
    .populate({ path: 'entity', select: 'name slug', model: mongoose.model('Brand') })
    .lean()
    .catch(() => []);

  // Also populate top category/subcategory performers
  const topCat = await EntityBannerStat.find({ entityType: 'category' })
    .sort({ clicks: -1 }).limit(5)
    .populate({ path: 'entity', select: 'name slug', model: mongoose.model('Category') })
    .lean().catch(() => []);

  const topSub = await EntityBannerStat.find({ entityType: 'subcategory' })
    .sort({ clicks: -1 }).limit(5)
    .populate({ path: 'entity', select: 'name slug', model: mongoose.model('SubCategory') })
    .lean().catch(() => []);

  // Merge and sort by clicks
  const allTop = [...topPerformers, ...topCat, ...topSub]
    .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
    .slice(0, 10);

  return {
    byType,
    trends,
    topPerformers: allTop,
  };
}

module.exports = {
  trackEntityImpression,
  trackEntityClick,
  getEntityAnalytics,
  getAllEntityAnalytics,
};
