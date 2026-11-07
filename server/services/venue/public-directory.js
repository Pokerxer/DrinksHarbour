'use strict';
const Tenant = require('../../models/Tenant');
const { resolveVenueEligibility } = require('./eligibility');
const POLICY_FIELDS = '_id name slug logo description city status subscriptionStatus plan customCapabilities businessCapabilities businessType posSettings.isBarRestaurant venueSettings trialEndsAt isActive';
function publicVenue(row) { return Object.fromEntries(['_id', 'name', 'slug', 'logo', 'description', 'city'].filter(key => row[key] !== undefined).map(key => [key, row[key]])); }
async function listPublicVenues({ now = new Date() } = {}) {
  const result = []; let cursor;
  while (result.length < 100) {
    const rows = await Tenant.find({ status: 'approved', subscriptionStatus: 'active', ...(cursor ? { _id: { $gt: cursor } } : {}) }).select(POLICY_FIELDS).sort({ _id: 1 }).limit(100).lean();
    for (const row of rows) {
      if (resolveVenueEligibility({ tenant: row, action: 'public.discover', now }).allowed) result.push(publicVenue(row));
      if (result.length === 100) break;
    }
    if (rows.length < 100) break;
    const next = rows[rows.length - 1]._id;
    if (String(next) === String(cursor)) break;
    cursor = next;
  }
  return result;
}
async function publicBookingTarget(slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const row = await Tenant.findOne({ slug, status: 'approved', subscriptionStatus: 'active' }).select(POLICY_FIELDS).lean();
  return row && resolveVenueEligibility({ tenant: row, action: 'public.request' }).allowed ? row : null;
}
module.exports = { listPublicVenues, publicBookingTarget, publicVenue };
