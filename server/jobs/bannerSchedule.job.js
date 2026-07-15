// server/jobs/bannerSchedule.job.js
// Enforces banner scheduling: flips scheduled -> active -> expired based on each
// banner's startDate/endDate window, so a banner goes live (and retires) on time
// without anyone editing it. The Banner model already computes this on save; this
// cron applies it in the background for banners nobody has touched.
const cron = require('node-cron');
const Banner = require('../models/Banner');
const { computeScheduledStatus, MANAGED_STATUSES } = require('../services/banner.helpers');

/**
 * Scan schedulable banners and bulk-update any whose status no longer matches
 * their window. Only touches banners in a managed status (scheduled/active/
 * expired) that actually carry a start or end date. Pure status writes — never
 * touches isActive or any manual (draft/paused/archived) banner.
 */
async function scanScheduledBanners(now = new Date()) {
  const banners = await Banner.find({
    status: { $in: MANAGED_STATUSES },
    $or: [{ startDate: { $ne: null } }, { endDate: { $ne: null } }],
  })
    .select('_id status startDate endDate')
    .lean();

  const ops = [];
  for (const b of banners) {
    const target = computeScheduledStatus(b, now);
    if (target && target !== b.status) {
      ops.push({ updateOne: { filter: { _id: b._id }, update: { $set: { status: target } } } });
    }
  }

  if (ops.length) await Banner.bulkWrite(ops);
  return { scanned: banners.length, updated: ops.length };
}

/** Start the schedule cron (guarded by the caller). Runs every 5 minutes. */
function startBannerScheduleCron() {
  cron.schedule('*/5 * * * *', () => {
    scanScheduledBanners().catch((e) => console.error('banner schedule cron error:', e.message));
  });
  console.log('🕑 Banner schedule scan scheduled (every 5 min)');
}

module.exports = { scanScheduledBanners, startBannerScheduleCron };
