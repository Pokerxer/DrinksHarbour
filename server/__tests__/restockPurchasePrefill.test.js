const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRestockPurchase } = require('../services/restock/purchase');
const line = {
  key: 'p:s:w',
  subProductId: 'p',
  sizeId: 's',
  warehouseId: 'w',
  alternatives: [
    {
      offerId: 'offer',
      vendorId: 'v',
      currency: 'NGN',
      unitPrice: 2000,
      packagingQty: 12,
      minQuantity: 1,
      maxQuantity: 60,
    },
  ],
};
const body = {
  vendor: 'v',
  currency: 'NGN',
  warehouse: 'w',
  restockPlan: { coverDays: 14, lines: [{ key: line.key, offerId: 'offer' }] },
  items: [
    {
      subProductId: 'p',
      sizeId: 's',
      quantity: 36,
      unitCost: 2000,
      packagingQty: 12,
    },
  ],
};
const service = async () => ({ lines: [line] });
test('prefilled purchase verifies current price, variant, supplier and packs before saving', async () => {
  await validateRestockPurchase('t', body, service);
  for (const patch of [
    { warehouse: 'other' },
    { vendor: 'other' },
    { currency: 'USD' },
    { items: [{ ...body.items[0], unitCost: 1 }] },
    { items: [{ ...body.items[0], quantity: 35 }] },
    { items: [{ ...body.items[0], sizeId: 'other' }] },
  ])
    await assert.rejects(
      validateRestockPurchase('t', { ...body, ...patch }, service),
      /changed|Invalid|match/i,
    );
});
test('ordinary purchases keep their existing workflow', async () => {
  let calls = 0;
  await validateRestockPurchase('t', { items: [] }, async () => {
    calls++;
  });
  assert.equal(calls, 0);
});
