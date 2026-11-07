'use strict';
const { resolveEntitlements } = require('../entitlements.service');
const id = value => value?._id ? String(value._id) : value == null ? '' : String(value);
const within = (record, at) => {
  const from = new Date(record?.effectiveFrom).getTime(), until = new Date(record?.effectiveUntil).getTime();
  return Number.isFinite(from) && Number.isFinite(until) && from <= at && at < until;
};
function decideMarketAccess({ tenant, market = 'NG', category = 'beverage', channel = 'marketplace', at = new Date(), country, policy, enrollment }) {
  const result = { allowed: false, reason: '', countryVersion: country?.version ?? null, policyVersion: null, enrollmentVersion: null };
  const answer = reason => ({ ...result, allowed: reason === 'APPROVED' || reason === 'ERM_ENTITLED', reason });
  if (!country || country.code !== market) return answer('COUNTRY_UNKNOWN');
  if (!country.active) return answer('COUNTRY_INACTIVE');
  if (!['marketplace', 'storefront', 'erm'].includes(channel)) return answer('CHANNEL_INVALID');
  if (country.capabilities?.[channel] !== true) return answer('COUNTRY_CAPABILITY_DISABLED');
  if (!id(tenant)) return answer('TENANT_REQUIRED');
  const time = new Date(at).getTime();
  if (!Number.isFinite(time)) return answer('DATE_INVALID');
  if (channel === 'erm') return answer(['active', 'trialing'].includes(tenant.subscriptionStatus) && resolveEntitlements(tenant, new Date(time)).writesAllowed ? 'ERM_ENTITLED' : 'ERM_NOT_ENTITLED');
  if (!policy || policy.market !== market || policy.category !== category || policy.channel !== channel) return answer('POLICY_MISSING');
  result.policyVersion = policy.version;
  if (!within(policy, time)) return answer('POLICY_OUTSIDE_TERM');
  if (policy.mode === 'closed') return answer('CATEGORY_CLOSED');
  if (!['open', 'exclusive'].includes(policy.mode)) return answer('POLICY_INVALID');
  if (policy.mode === 'exclusive' && id(policy.exclusiveTenant) !== id(tenant) && !(policy.exceptions || []).some(value => id(value) === id(tenant))) return answer('CATEGORY_RESTRICTED');
  if (!enrollment || id(enrollment.tenant) !== id(tenant) || enrollment.market !== market || enrollment.category !== category || enrollment.channel !== channel) return answer('ENROLLMENT_MISSING');
  result.enrollmentVersion = enrollment.version;
  if (enrollment.status !== 'approved') return answer('ENROLLMENT_NOT_APPROVED');
  if (!within(enrollment, time)) return answer('ENROLLMENT_OUTSIDE_TERM');
  return answer('APPROVED');
}
module.exports = { decideMarketAccess };
