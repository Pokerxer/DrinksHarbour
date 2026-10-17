'use strict';
const { ValidationError } = require('./errors');
const cents = (value) => {
  const result = Math.round(value * 100);
  if (!Number.isSafeInteger(result))
    throw new ValidationError('Merchandise amount exceeds the supported range');
  return result;
};
const money = (value) => Math.round(value * 100) / 100;
function commissionRate(value) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value >= 100
  )
    throw new ValidationError(
      'A valid agreed commission rate from 0% to below 100% is required'
    );
  return value;
}
function splitMerchandise({ amount, quantity = 1, model, rate, payout }) {
  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    !Number.isInteger(quantity) ||
    quantity < 1
  )
    throw new ValidationError('Invalid merchandise amount or quantity');
  if (!['markup', 'commission'].includes(model))
    throw new ValidationError('Unknown revenue agreement');
  const basis = cents(amount);
  let share;
  if (model === 'commission') {
    commissionRate(rate);
    share = basis - Math.round((basis * rate) / 100);
  } else {
    if (!Number.isFinite(payout) || payout < 0)
      throw new ValidationError('A valid agreed tenant payout is required');
    share = cents(payout * quantity);
    if (share > basis)
      throw new ValidationError(
        'Merchandise price after discounts must cover the agreed tenant payout'
      );
  }
  return {
    tenantRevenueShare: share / 100,
    platformCommission: (basis - share) / 100,
    vendorPriceAtPurchase: money(share / 100 / quantity),
    tenantRevenueModel: model,
    revenueRateAtPurchase: rate,
    revenueBasisAmount: basis / 100,
    revenuePolicyVersion: 'merchandise-v2',
    discountFunding: model === 'commission' ? 'shared_by_agreement' : 'platform',
  };
}
function allocateOrderDiscount(items, discount) {
  const amounts = items.map((item) => cents(item.itemSubtotal));
  const total = amounts.reduce((a, b) => a + b, 0),
    reduction = cents(discount);
  if (!Number.isSafeInteger(reduction) || reduction < 0 || reduction > total)
    throw new ValidationError('Invalid merchandise discount');
  const divisor = BigInt(total || 1);
  const allocations = amounts.map((value) =>
    Number((BigInt(reduction) * BigInt(value)) / divisor)
  );
  const order = amounts
    .map((value, index) => ({
      index,
      remainder: (BigInt(reduction) * BigInt(value)) % divisor,
    }))
    .sort((a, b) =>
      a.remainder === b.remainder
        ? a.index - b.index
        : a.remainder > b.remainder
          ? -1
          : 1
    );
  let remaining = reduction - allocations.reduce((a, b) => a + b, 0);
  for (const row of order) {
    if (!remaining) break;
    allocations[row.index]++;
    remaining--;
  }
  return items.map((item, index) => {
    const amount = (amounts[index] - allocations[index]) / 100;
    return {
      ...item,
      discountAmount: allocations[index] / 100,
      ...splitMerchandise({
        amount,
        quantity: item.quantity,
        model: item.tenantRevenueModel,
        rate: item.revenueRateAtPurchase,
        payout: item.tenantRevenueShare / item.quantity,
      }),
    };
  });
}
// Cumulative allocation avoids penny drift across multiple partial refunds.
// Never consult live Tenant terms; legacy snapshots remain usable without rewriting.
function refundRevenue(item, quantity, alreadyRefunded = 0) {
  if (
    !Number.isInteger(quantity) ||
    !Number.isInteger(alreadyRefunded) ||
    quantity < 1 ||
    alreadyRefunded < 0 ||
    quantity + alreadyRefunded > item.quantity
  )
    throw new ValidationError('Invalid refund quantity');
  const part = (value) => {
    if (!Number.isFinite(value))
      throw new ValidationError('Missing historical revenue snapshot');
    const original = cents(value);
    return (
      (Math.round((original * (alreadyRefunded + quantity)) / item.quantity) -
        Math.round((original * alreadyRefunded) / item.quantity)) /
      100
    );
  };
  return {
    tenantRevenueShare: part(item.tenantRevenueShare),
    platformCommission: part(item.platformCommission),
  };
}
function refundSettlement(items, amount, orderTotal) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > orderTotal)
    throw new ValidationError('Invalid refund amount');
  if (cents(amount) !== cents(orderTotal))
    return { status: 'needs_review', lines: [] };
  return {
    status: 'allocated',
    lines: items.map((item, index) => ({
      orderItemIndex: index,
      tenant: item.tenant?._id || item.tenant,
      ...refundRevenue(item, item.quantity),
    })),
  };
}
module.exports = {
  refundSettlement,
  commissionRate,
  splitMerchandise,
  allocateOrderDiscount,
  refundRevenue,
};
