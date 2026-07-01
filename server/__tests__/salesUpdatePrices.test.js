// server/__tests__/salesUpdatePrices.test.js
// updatePricesForOrder clears line overrides and re-snapshots totals from the
// order's current pricelist. Pure/DB-free (no live connection => pricing engine
// is skipped), mirroring the repo's mocked-model convention.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const svc = require('../services/salesOrder.service');

const oid = () => new mongoose.Types.ObjectId();

test('updatePricesForOrder clears priceOverridden on product lines and re-snapshots totals', async () => {
  const tenantId = oid();
  const so = {
    tenant: tenantId,
    pricelist: null,
    items: [
      {
        product: oid(), subproduct: oid(), size: oid(), sku: 'A', name: 'A',
        quantity: 4, unitPrice: 1000, discount: 0, discountType: 'fixed', taxRate: 0,
        priceOverridden: true,
      },
    ],
    subtotal: 0, discountTotal: 0, promotionTotal: 0, taxTotal: 0, total: 0,
  };

  const result = await svc.updatePricesForOrder(so, { tenantId });

  assert.strictEqual(result, so);
  assert.strictEqual(so.items[0].priceOverridden, false);
  assert.strictEqual(so.items[0].lineTotal, 4000); // 1000 * 4
  assert.strictEqual(so.subtotal, 4000);
  assert.strictEqual(so.total, 4000);
});
