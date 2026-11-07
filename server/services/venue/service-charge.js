'use strict';
// S5: the venue service charge is a typed financial line, derived
// deterministically from the frozen accepted-line net exactly like the
// minimum-spend shortfall (minimum-spend.js). It is approval-gated, consent-
// gated and default-disabled: an absent/enabled:false subdoc produces no line,
// so every existing tenant/policy keeps its previous behavior byte-for-byte.
const { minor, sum } = require('./money-rules'); const { fail } = require('./errors');
const { lineTaxAmount } = require('../posTax.service');
function validateServiceChargePolicy(policy) {
  const charge = policy?.serviceCharge;
  if (!charge?.enabled) return;
  if (policy.state !== 'approved' || !policy.approvedBy || !policy.approvedAt || !policy.decisionOwner)
    fail('SERVICE_CHARGE_POLICY_REVIEW_REQUIRED', 'Service charge requires an approved financial policy');
  if (!Number.isInteger(charge.rateBps) || charge.rateBps < 1 || charge.rateBps > 5000)
    fail('SERVICE_CHARGE_POLICY_REVIEW_REQUIRED', 'Service charge rate must be 1–5000 integer basis points');
  if (charge.appliesTo !== 'merchandise_net' && charge.appliesTo !== 'food_only')
    fail('SERVICE_CHARGE_POLICY_REVIEW_REQUIRED', 'Review the service-charge eligible consumption');
  if (!charge.accounts?.revenue) fail('SERVICE_CHARGE_POLICY_REVIEW_REQUIRED', 'Service charge revenue account mapping required');
  if (typeof charge.displayLabel !== 'string' || !charge.displayLabel.trim() || charge.displayLabel.length > 80)
    fail('SERVICE_CHARGE_POLICY_REVIEW_REQUIRED', 'Service charge receipt label required (≤80 characters)');
  if (charge.taxable === false && (typeof charge.taxDecision !== 'string' || !charge.taxDecision.trim()))
    fail('SERVICE_CHARGE_POLICY_REVIEW_REQUIRED', 'Zero-tax service charge requires a named, approved tax decision');
}
// Task 1 keeps this signature net-amount based: the caller hands in the eligible
// net (already filtered); `eligibleServiceChargeNet` (Task 2, billing.js) does
// the appliesTo/exclusion filtering over the frozen accepted lines.
function serviceChargeLines(eligibleNetMinor, policy, acceptedPolicyVersion = null, taxRateBps = 0) {
  minor(eligibleNetMinor ?? 0);
  const charge = policy?.serviceCharge;
  if (!charge?.enabled || !eligibleNetMinor) return [];
  validateServiceChargePolicy(policy);
  if (acceptedPolicyVersion !== policy.version) fail('FINANCIAL_TERMS_NOT_ACCEPTED', 'Guest must accept this service-charge policy version');
  // Same half-up minor-level idiom as billTotals commission: integer division of
  // (value × bps + 5000) / 10000 is exact round-half-up with no float drift.
  const amountMinor = Number((BigInt(eligibleNetMinor) * BigInt(charge.rateBps) + 5000n) / 10000n);
  const taxMinor = charge.taxable === false ? 0 : lineTaxAmount(amountMinor, taxRateBps / 100);
  if (!Number.isSafeInteger(taxMinor) || taxMinor < 0) fail('INVALID_MONEY', 'Invalid service-charge tax', 400);
  return [{ kind: 'service_charge', description: charge.displayLabel, amountMinor, taxMinor,
    account: charge.accounts.revenue, commercialRateBps: charge.rateBps, policyVersion: policy.version,
    ...(charge.taxable === false ? { taxDecision: charge.taxDecision } : {}) }];
}
// Eligible net for the service charge, from the SAME frozen accepted lines the
// minimum reads: policy exclusions apply, plus the appliesTo category filter.
// 'food_only' is fail-closed until accepted lines carry a food classification
// (venue lines are beverage merchandise today), so it currently yields zero.
function eligibleServiceChargeNet(acceptedLines, policy) {
  const charge = policy?.serviceCharge;
  if (!charge?.enabled) return 0;
  const excluded = new Set((policy?.excludedSubProducts || []).map(String));
  const eligible = (acceptedLines || []).filter(line => !excluded.has(String(line.subproduct))
    && (charge.appliesTo === 'food_only' ? line.category === 'food' : true));
  return sum(...eligible.map(line => minor(line.netMinor)));
}
module.exports = { serviceChargeLines, validateServiceChargePolicy, eligibleServiceChargeNet };