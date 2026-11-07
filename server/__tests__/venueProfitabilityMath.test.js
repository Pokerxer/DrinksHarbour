'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { marginAmounts, aggregateMarginRows } = require('../services/venue/profitability-math');

test('margin and markup use distinct denominators and contribution uses explicit fee evidence', () => {
  const row = marginAmounts({ netMerchandiseMinor: 5000, costMinor: 2000, commissionMinor: 450, providerFeeMinor: 50 });
  assert.equal(row.grossProfitMinor, 3000);
  assert.equal(row.grossMarginPct, 60);
  assert.equal(row.markupPct, 150);
  assert.equal(row.contributionMinor, 2500);
  assert.deepEqual(row.missingReasons, []);
});

test('unknown cost does not become free cost while evidenced zero keeps a gross result', () => {
  const unknown = marginAmounts({ netMerchandiseMinor: 5000, costMinor: null, commissionMinor: 0, providerFeeMinor: 0 });
  assert.equal(unknown.grossProfitMinor, null);
  assert.equal(unknown.grossMarginPct, null);
  assert.equal(unknown.markupPct, null);
  assert.equal(unknown.contributionMinor, null);
  assert.ok(unknown.missingReasons.includes('unknown_cost'));
  const zero = marginAmounts({ netMerchandiseMinor: 5000, costMinor: 0, commissionMinor: 0, providerFeeMinor: 0 });
  assert.equal(zero.grossProfitMinor, 5000);
  assert.equal(zero.grossMarginPct, 100);
  assert.equal(zero.markupPct, null);
  assert.ok(zero.missingReasons.includes('nonpositive_cost_denominator'));
});

test('unknown fees invalidate contribution without invalidating independent gross profit', () => {
  const row = marginAmounts({ netMerchandiseMinor: 5000, costMinor: 2000 });
  assert.equal(row.grossProfitMinor, 3000);
  assert.equal(row.contributionMinor, null);
  assert.ok(row.missingReasons.includes('unknown_commission'));
  assert.ok(row.missingReasons.includes('unknown_provider_fee'));
});

test('losses stay negative and nonpositive refund-period denominators are explained', () => {
  const loss = marginAmounts({ netMerchandiseMinor: 1000, costMinor: 2000, commissionMinor: 0, providerFeeMinor: 0 });
  assert.equal(loss.grossProfitMinor, -1000);
  assert.equal(loss.grossMarginPct, -100);
  assert.equal(loss.markupPct, -50);
  for (const netMerchandiseMinor of [0, -1000]) {
    const refund = marginAmounts({ netMerchandiseMinor, costMinor: 2000, commissionMinor: 0, providerFeeMinor: 0 });
    assert.equal(refund.grossProfitMinor, netMerchandiseMinor - 2000);
    assert.equal(refund.grossMarginPct, null);
    assert.ok(refund.missingReasons.includes('nonpositive_revenue_denominator'));
  }
  const returned = marginAmounts({ netMerchandiseMinor: -1000, costMinor: -500, commissionMinor: 0, providerFeeMinor: 0 });
  assert.equal(returned.markupPct, null);
  assert.ok(returned.missingReasons.includes('nonpositive_cost_denominator'));
});

test('ratios round only the final exact result to two decimal places', () => {
  assert.equal(marginAmounts({ netMerchandiseMinor: 3, costMinor: 2 }).grossMarginPct, 33.33);
  assert.equal(marginAmounts({ netMerchandiseMinor: 3, costMinor: 4 }).grossMarginPct, -33.33);
  assert.equal(marginAmounts({ netMerchandiseMinor: 20000, costMinor: 19999 }).grossMarginPct, 0.01);
});

test('100 portions distinguish the estimate from recorded count-reconciled material cost', () => {
  const estimate = marginAmounts({ netMerchandiseMinor: 50000000, costMinor: 20000000, commissionMinor: 0, providerFeeMinor: 0 });
  const recorded = marginAmounts({ netMerchandiseMinor: 50000000, costMinor: 23000000, commissionMinor: 0, providerFeeMinor: 0 });
  assert.equal(estimate.grossProfitMinor, 30000000);
  assert.equal(estimate.grossMarginPct, 60);
  assert.equal(recorded.grossProfitMinor, 27000000);
  assert.equal(recorded.grossMarginPct, 54);
});

test('totals derive ratios from full-scope money rather than average row percentages', () => {
  const result = aggregateMarginRows([
    { currency: 'NGN', netMerchandiseMinor: 100, costMinor: 50, commissionMinor: 0, providerFeeMinor: 0 },
    { currency: 'NGN', netMerchandiseMinor: 900, costMinor: 0, commissionMinor: 0, providerFeeMinor: 0 },
  ]);
  assert.equal(result.netMerchandiseMinor, 1000);
  assert.equal(result.costMinor, 50);
  assert.equal(result.grossProfitMinor, 950);
  assert.equal(result.grossMarginPct, 95);
  assert.equal(result.markupPct, 1900);
  assert.equal(result.contributionMinor, 950);
  assert.equal(result.coverage.costPct, 100);
});

test('incomplete total retains separately labelled known rows without counting unknown sales as profit', () => {
  const result = aggregateMarginRows([
    { currency: 'NGN', netMerchandiseMinor: 5000, costMinor: 2000, commissionMinor: 0, providerFeeMinor: 0 },
    { currency: 'NGN', netMerchandiseMinor: 7000, costMinor: null, commissionMinor: 0, providerFeeMinor: 0 },
  ]);
  assert.equal(result.netMerchandiseMinor, 12000);
  assert.equal(result.costMinor, null);
  assert.equal(result.grossProfitMinor, null);
  assert.equal(result.contributionMinor, null);
  assert.deepEqual(result.knownSubtotals, { costMinor: 2000, grossProfitMinor: 3000, contributionMinor: 3000 });
  assert.equal(result.coverage.costKnownRows, 1);
  assert.equal(result.coverage.costPct, 50);
});

test('unknown fee coverage leaves full gross profit complete', () => {
  const result = aggregateMarginRows([
    { currency: 'NGN', netMerchandiseMinor: 5000, costMinor: 2000, commissionMinor: 0, providerFeeMinor: 0 },
    { currency: 'NGN', netMerchandiseMinor: 5000, costMinor: 2000, commissionMinor: 0, providerFeeMinor: null },
  ]);
  assert.equal(result.grossProfitMinor, 6000);
  assert.equal(result.contributionMinor, null);
  assert.equal(result.providerFeeMinor, null);
  assert.equal(result.coverage.feePct, 50);
});

test('already-net revenue never subtracts refunds or tax for a second time', () => {
  const result = aggregateMarginRows([{ currency: 'NGN', netMerchandiseMinor: 7000, refundsMinor: 3000, taxMinor: 750, costMinor: 2000, commissionMinor: 0, providerFeeMinor: 0 }]);
  assert.equal(result.netMerchandiseMinor, 7000);
  assert.equal(result.grossProfitMinor, 5000);
});

test('foreign currency mixing and unsafe money totals are refused', () => {
  assert.throws(() => aggregateMarginRows([{ currency: 'NGN', netMerchandiseMinor: 1, costMinor: 0 }, { currency: 'USD', netMerchandiseMinor: 1, costMinor: 0 }]), { code: 'INVALID_CURRENCY' });
  assert.throws(() => aggregateMarginRows([{ netMerchandiseMinor: 1, costMinor: 0 }]), { code: 'INVALID_CURRENCY' });
  assert.throws(() => marginAmounts({ netMerchandiseMinor: 1.5, costMinor: 0 }), { code: 'INVALID_MONEY' });
  assert.throws(() => aggregateMarginRows([{ currency: 'NGN', netMerchandiseMinor: Number.MAX_SAFE_INTEGER, costMinor: 1 }, { currency: 'NGN', netMerchandiseMinor: 1, costMinor: 1 }]), { code: 'INVALID_MONEY' });
});
