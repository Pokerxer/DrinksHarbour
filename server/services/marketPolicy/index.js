'use strict';
const mongoose = require('mongoose');
const Tenant = require('../../models/Tenant');
const Enrollment = require('../../models/MarketEnrollment');
const Policy = require('../../models/MarketCategoryPolicy');
const { resolveCountry } = require('../country');
const { decideMarketAccess } = require('./decision');
const { error } = require('./validation');
async function evaluateMarketAccess({ tenant, market = 'NG', category = 'beverage', channel = 'marketplace', at = new Date() }) {
  const tenantId = tenant?._id || tenant;
  const record = mongoose.isObjectIdOrHexString(tenantId) ? await Tenant.findOne({ _id: tenantId }).lean() : null;
  let country;
  try { country = await resolveCountry(market, { requireActive: false }); }
  catch (e) { if (e.code !== 'COUNTRY_UNKNOWN') throw e; }
  const scope = { market, category, channel };
  const [policy, enrollment] = channel === 'erm' || !record ? [] : await Promise.all([
    Policy.findOne(scope).sort({ version: -1 }).lean(),
    Enrollment.findOne({ ...scope, tenant: record._id }).sort({ version: -1 }).lean(),
  ]);
  const result = decideMarketAccess({ tenant: record, market, category, channel, at, country, policy, enrollment });
  if (record && (record.isActive === false || record.status !== 'approved')) return { ...result, allowed: false, reason: 'TENANT_INACTIVE' };
  return result;
}
async function assertMarketAccess(args) {
  const result = await evaluateMarketAccess(args);
  if (!result.allowed) throw error(`Market access denied: ${result.reason}`, 403, result.reason);
  return result;
}
async function getEligibleTenantIds({ market = 'NG', category = 'beverage', channel = 'marketplace', at = new Date() } = {}) {
  let country;
  try { country = await resolveCountry(market, { requireActive: false }); }
  catch (e) { if (e.code === 'COUNTRY_UNKNOWN') return []; throw e; }
  if (!country.active || country.capabilities?.[channel] !== true) return [];
  if (channel === 'erm') return (await Tenant.find({ status: 'approved', isActive: { $ne: false }, subscriptionStatus: { $in: ['active', 'trialing'] } }).lean()).filter(tenant => decideMarketAccess({ tenant, market, category, channel, at, country }).allowed).map(row => row._id);
  const scope = { market, category, channel };
  const policy = await Policy.findOne(scope).sort({ version: -1 }).lean();
  if (!policy) return [];
  const enrollments = await Enrollment.aggregate([{ $match: scope }, { $sort: { version: -1 } }, { $group: { _id: '$tenant', row: { $first: '$$ROOT' } } }]);
  const tenants = await Tenant.find({ _id: { $in: enrollments.map(row => row._id) }, status: 'approved', isActive: { $ne: false } }).lean();
  const byId = new Map(tenants.map(row => [String(row._id), row]));
  return enrollments.filter(({ _id, row }) => {
    const tenant = byId.get(String(_id));
    return tenant && decideMarketAccess({ tenant, market, category, channel, at, country, policy, enrollment: row }).allowed;
  }).map(row => row._id);
}
module.exports = { evaluateMarketAccess, assertMarketAccess, getEligibleTenantIds };
