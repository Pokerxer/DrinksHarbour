'use strict';
const Banner = require('../models/Banner');
const { metadataEnabled } = require('../config/redis');
const { createMetadataCache } = require('./publicMetadataCache');
const cache = createMetadataCache();
const { ValidationError } = require('../utils/errors');
const { safeLink } = require('./bannerOwnership');
const FIELDS = ['title', 'subtitle', 'description', 'slug', 'type', 'placement', 'displayOrder', 'priority', 'ctaText', 'ctaStyle',
  'linkType', 'imageClickable', 'backgroundColor', 'textColor', 'overlayOpacity', 'textAlignment', 'contentPosition',
  'imageFit', 'gradientIntensity', 'blurIntensity'];
const SELECT = ['_id', ...FIELDS, 'ctaLink', 'image', 'mobileImage', 'deviceTargeting'].join(' ');
function publicImage(image) {
  if (!image?.url) return null;
  try { if (new URL(image.url).protocol !== 'https:') return null; } catch { return null; }
  return { url: image.url, alt: image.alt || '', ...(image.width ? { width: image.width } : {}), ...(image.height ? { height: image.height } : {}) };
}
function publicBanner(banner) {
  const output = { id: String(banner._id) };
  for (const field of FIELDS) if (banner[field] != null) output[field] = banner[field];
  output.image = publicImage(banner.image);
  output.mobileImage = publicImage(banner.mobileImage);
  output.ctaLink = safeLink(banner.ctaLink) ? banner.ctaLink || null : null;
  output.deviceTargeting = Object.fromEntries(['desktop', 'mobile', 'tablet'].map(device => [device, banner.deviceTargeting?.[device] !== false]));
  return output;
}
async function listBanners(tenant, options = {}, now = new Date()) {
  const placements = Banner.schema.path('placement').enumValues;
  if (options.placement != null && (typeof options.placement !== 'string' || !placements.includes(options.placement))) throw new ValidationError('Invalid banner placement');
  if (options.device != null && !['desktop', 'mobile', 'tablet'].includes(options.device)) throw new ValidationError('Invalid banner device');
  const value = options.limit ?? '10';
  if (!['string', 'number'].includes(typeof value) || !/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > 100) throw new ValidationError('Banner limit must be 1–100');
  const query = { tenant: tenant._id, isActive: true, status: { $in: ['active', 'scheduled'] }, visibleTo: { $in: ['all', 'guests'] },
    $and: [{ $or: [{ status: 'active' }, { status: 'scheduled', isScheduled: true, startDate: { $lte: now } }] }, { $or: [{ isScheduled: false }, { isScheduled: { $exists: false } }, { isScheduled: true,
      $and: [{ $or: [{ startDate: null }, { startDate: { $lte: now } }] }, { $or: [{ endDate: null }, { endDate: { $gte: now } }] }] }] }] };
  if (options.placement) query.placement = options.placement;
  if (options.device) query[`deviceTargeting.${options.device}`] = true;
  const load = () => Banner.find(query).select(SELECT).sort({ displayOrder: 1, createdAt: -1, _id: 1 }).limit(Number(value)).lean();
  let rows;
  if (metadataEnabled()) {
    const refs = await Banner.find(query).select('_id updatedAt').sort({ displayOrder: 1, createdAt: -1, _id: 1 }).limit(Number(value)).lean();
    rows = await cache.read(tenant._id, 'banner', refs, missing => Banner.find({
      tenant: tenant._id, _id: { $in: missing.map(row => row._id) },
    }).select(`${SELECT} updatedAt`).lean());
  }
  if (!rows) rows = await load();
  return rows.map(publicBanner).filter(banner => banner.image);
}
module.exports = { listBanners, publicBanner };
