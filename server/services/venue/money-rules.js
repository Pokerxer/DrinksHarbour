'use strict';
const { fail } = require('./errors');
function minor(value) { if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_MONEY', 'Money must be nonnegative safe integer kobo', 400); return value; }
function sum(...values) { values.forEach(minor); return minor(values.reduce((a, b) => a + b, 0)); }
function balance({ merchandiseMinor, eligibleNetMinor, minimumMinor, creditMinor, taxMinor = 0, feeMinor = 0, paymentsMinor = 0 }) {
  [merchandiseMinor, eligibleNetMinor, minimumMinor, creditMinor, taxMinor, feeMinor, paymentsMinor].forEach(minor);
  if (eligibleNetMinor > merchandiseMinor) fail('INVALID_MONEY', 'Eligible net spend exceeds merchandise', 400);
  const shortfallMinor = Math.max(0, minimumMinor - eligibleNetMinor);
  const totalMinor = sum(merchandiseMinor, shortfallMinor, taxMinor, feeMinor);
  if (paymentsMinor > totalMinor) fail('PAYMENT_REVIEW_REQUIRED', 'Prior applied payments exceed bill');
  const appliedCreditMinor = Math.min(creditMinor, totalMinor - paymentsMinor);
  return { shortfallMinor, totalMinor, appliedCreditMinor, unappliedCreditMinor: creditMinor - appliedCreditMinor, dueMinor: totalMinor - paymentsMinor - appliedCreditMinor };
}
function equalSplit(amountMinor, count) {
  minor(amountMinor);
  if (!Number.isSafeInteger(count) || count < 1 || count > 100 || amountMinor < count) fail('INVALID_MONEY', 'Choose 1–100 positive portions', 400);
  const base = Math.floor(amountMinor / count), remainder = amountMinor % count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}
function refundShares(original, amountMinor, previouslyRefundedMinor) {
  [original.amountMinor, original.commissionMinor, amountMinor, previouslyRefundedMinor].forEach(minor);
  if (!original.amountMinor || original.commissionMinor > original.amountMinor || amountMinor + previouslyRefundedMinor > original.amountMinor) fail('REFUND_EXCEEDS_RECEIPT', 'Refund would exceed original refundable amount');
  const portion = value => Number(BigInt(value) * BigInt(original.commissionMinor) / BigInt(original.amountMinor));
  const commissionMinor = portion(amountMinor + previouslyRefundedMinor) - portion(previouslyRefundedMinor);
  return { commissionMinor, tenantMinor: amountMinor - commissionMinor };
}
function itemPortions(snapshot, groups) {
  const seen = new Set();
  if (!Array.isArray(groups) || !groups.length || groups.length > 100) fail('INVALID_LINE', 'Choose line portions', 400);
  return groups.map(group => {
    if (!Array.isArray(group) || !group.length) fail('INVALID_LINE', 'Empty line portion', 400);
    let amountMinor = 0;
    const acceptedLines = group.map(ref => {
      const key = `${ref.lineId}:${ref.revision}`;
      const line = snapshot.acceptedLines.find(l => l.lineId === ref.lineId && l.revision === ref.revision);
      if (!line || seen.has(key)) fail('INVALID_LINE', 'Unknown, changed or duplicate accepted line', 400);
      seen.add(key); amountMinor = sum(amountMinor, line.netMinor, line.taxMinor);
      return { lineId: line.lineId, revision: line.revision };
    });
    return { amountMinor, acceptedLines };
  });
}
module.exports = { itemPortions, minor, sum, balance, equalSplit, refundShares };
