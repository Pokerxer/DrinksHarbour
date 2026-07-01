// server/__tests__/salesUpdatePrices.test.js
// updatePricesForOrder clears line overrides and re-snapshots totals from the
// order's current pricelist. Pure/DB-free (no live connection => pricing engine
// is skipped), mirroring the repo's mocked-model convention.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const svc = require('../services/salesOrder.service');

const oid = () => new mongoose.Types.ObjectId();

/**
 * Create an object that behaves like a Mongoose subdocument:
 *   - Schema fields are defined as enumerable GETTERS on the prototype
 *     (NOT own properties), so `{ ...obj }` loses them
 *   - `_doc` holds the raw storage (own property)
 *   - `toObject()` returns a plain copy of `_doc`
 * This lets tests prove that a `.toObject()` call is necessary
 * before spreading subdocument items in the pricing pipeline.
 */
function mockSubdoc(data) {
  const proto = {};
  for (const k of Object.keys(data)) {
    Object.defineProperty(proto, k, {
      get() { return this._doc ? this._doc[k] : undefined; },
      enumerable: true,
      configurable: true,
    });
  }
  const obj = Object.create(proto);
  obj._doc = { ...data };
  obj.toObject = function () { return { ...this._doc }; };
  return obj;
}

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

test('recomputeOrderPricing preserves subproduct/name/quantity when items are Mongoose subdocs (clearOverrides:true)', async () => {
  const tenantId = oid();
  const subId = oid();
  const prodId = oid();
  const sizeId = oid();

  const so = {
    tenant: tenantId,
    pricelist: null,
    items: [
      mockSubdoc({
        lineType: 'product',
        product: prodId, subproduct: subId, size: sizeId,
        sku: 'SKU-X', name: 'Test Beverage',
        quantity: 6, unitPrice: 1500, discount: 0,
        discountType: 'fixed', taxRate: 0,
        priceOverridden: false,
      }),
    ],
    subtotal: 0, discountTotal: 0, promotionTotal: 0, taxTotal: 0, total: 0,
  };

  await svc.recomputeOrderPricing(so, { tenantId, clearOverrides: true });

  // Without the .toObject() fix, these would be lost/zero.
  assert.ok(so.items[0].subproduct, 'subproduct must survive');
  assert.strictEqual(so.items[0].subproduct.toString(), subId.toString());
  assert.strictEqual(so.items[0].product.toString(), prodId.toString());
  assert.strictEqual(so.items[0].size.toString(), sizeId.toString());
  assert.strictEqual(so.items[0].name, 'Test Beverage');
  assert.strictEqual(so.items[0].quantity, 6);
  assert.strictEqual(so.items[0].sku, 'SKU-X');
  assert.strictEqual(so.items[0].unitPrice, 1500);
  assert.strictEqual(so.items[0].priceOverridden, false);
  assert.strictEqual(so.items[0].lineTotal, 9000); // 1500 * 6
});
