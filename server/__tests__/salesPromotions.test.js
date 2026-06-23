// server/__tests__/salesPromotions.test.js
// Automatic promotions reduce the UNTAXED base before tax (discount-before-tax).
// Pure helpers + a promotion-engine dependency injected for isolation (repo's
// no-DB convention). Mirrors salesOrder.tax.test.js.
const test = require('node:test');
const assert = require('node:assert');

const svc = require('../services/salesOrder.service');

test('lineTaxOf charges tax on the post-promotion base', () => {
  // base = (1000) * 2 = 2000; less 200 promo = 1800; 10% = 180
  assert.strictEqual(
    svc.lineTaxOf({ unitPrice: 1000, discount: 0, quantity: 2, taxRate: 10, promoDiscount: 200 }),
    180
  );
  // no promo → tax on the full untaxed base
  assert.strictEqual(
    svc.lineTaxOf({ unitPrice: 1000, discount: 0, quantity: 2, taxRate: 10, promoDiscount: 0 }),
    200
  );
  // promo larger than the base floors the taxable amount at 0
  assert.strictEqual(
    svc.lineTaxOf({ unitPrice: 1000, discount: 0, quantity: 2, taxRate: 10, promoDiscount: 5000 }),
    0
  );
});

test('computeTotals emits promotionTotal and taxes the reduced base', () => {
  const totals = svc.computeTotals([
    { unitPrice: 1000, discount: 0, quantity: 2, taxRate: 10, promoDiscount: 200 },
    { unitPrice: 500, discount: 50, quantity: 1, taxRate: 0, promoDiscount: 0 },
  ]);
  assert.strictEqual(totals.subtotal, 2500); // gross, pre everything
  assert.strictEqual(totals.discountTotal, 50);
  assert.strictEqual(totals.promotionTotal, 200);
  assert.strictEqual(totals.taxTotal, 180); // 1800*10% + 0
  // Untaxed Amount = subtotal - discountTotal - promotionTotal = 2250
  assert.strictEqual(totals.total, 2430); // 2250 + 180
});

test('resolveLinePromotions attaches the engine discount + promo name per product line', async () => {
  const calls = [];
  const calculateDiscountForItem = async (tenantId, subId, sizeId, base, qty) => {
    calls.push({ tenantId, subId, sizeId, base, qty });
    return { discount: 300, appliedPromotions: [{ name: 'Spirits 10%' }] };
  };
  const out = await svc.resolveLinePromotions(
    [{ subproduct: 'sp1', size: 'sz1', unitPrice: 1000, discount: 0, quantity: 1 }],
    { tenantId: 't1', calculateDiscountForItem }
  );
  assert.strictEqual(out[0].promoDiscount, 300);
  assert.strictEqual(out[0].promoName, 'Spirits 10%');
  assert.deepStrictEqual(calls[0], {
    tenantId: 't1', subId: 'sp1', sizeId: 'sz1', base: 1000, qty: 1,
  });
});

test('resolveLinePromotions skips non-product rows and caps discount at the line base', async () => {
  const calculateDiscountForItem = async () => ({ discount: 99999, appliedPromotions: [] });
  const out = await svc.resolveLinePromotions(
    [
      { name: 'Section header', quantity: 0 }, // no subproduct → untouched
      { subproduct: 'sp1', unitPrice: 1000, discount: 0, quantity: 1 },
    ],
    { tenantId: 't1', calculateDiscountForItem }
  );
  assert.strictEqual(out[0].promoDiscount, 0);
  assert.strictEqual(out[1].promoDiscount, 1000); // capped at base, not 99999
});

test('resolveLinePromotions is best-effort: an engine error yields no discount', async () => {
  const calculateDiscountForItem = async () => {
    throw new Error('promotion service down');
  };
  const out = await svc.resolveLinePromotions(
    [{ subproduct: 'sp1', unitPrice: 1000, discount: 0, quantity: 1 }],
    { tenantId: 't1', calculateDiscountForItem }
  );
  assert.strictEqual(out[0].promoDiscount, 0);
  assert.strictEqual(out[0].promoName, '');
});
