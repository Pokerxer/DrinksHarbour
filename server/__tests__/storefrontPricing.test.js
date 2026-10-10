'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { retailPrice, publicProduct, pagination, normalizeCart, paymentMatches } = require('../services/storefrontPricing');
const sp = { _id: 'sp', tenant: 'tenant', sku: 'SKU', baseSellingPrice: 5000, costPrice: 1,
  availableStock: 10, product: { _id: 'p', name: 'Wine', isAlcoholic: true, abv: 12,
    volumeMl: 750, images: [{ url: 'https://image', uploadedBy: 'private' }], internalNotes: 'private' } };
test('retail pricing uses tenant retail and active discounts without marketplace markup', () => {
  assert.equal(retailPrice(sp, { sellingPrice: 8000, discountType: 'percentage', discountValue: 10 }), 7200);
  assert.equal(retailPrice(sp, { sellingPrice: 8000, discountType: 'fixed', discountValue: 1000, discountEnd: '2020-01-01' }), 8000);
  assert.throws(() => retailPrice({ baseSellingPrice: 0 }), /price/);
});
test('public catalogue serializes only explicit customer fields and variant retail prices', () => {
  const result = publicProduct(sp, [{ _id: 'size', sellingPrice: 6000, availableStock: 3, costPrice: 10 }]);
  assert.equal(result.id, 'sp');
  assert.equal(result.variants[0].sellingPrice, 6000);
  assert.equal(result.alcoholic, true);
  assert.equal(result.ageVerificationRequired, true);
  assert.equal(result.images[0].url, 'https://image');
  assert.doesNotMatch(JSON.stringify(result), /costPrice|internalNotes|uploadedBy|tenantRevenue/);
});
test('pagination rejects operator objects and bounds page size', () => {
  assert.deepEqual(pagination({}), { page: 1, limit: 20, skip: 0 });
  assert.throws(() => pagination({ limit: '101' }), /limit/);
  assert.throws(() => pagination({ page: { $gt: 0 } }), /page/);
});
test('cart merges duplicate variants before limits and rejects supplied monetary fields', () => {
  const id = 'a'.repeat(24), size = 'b'.repeat(24);
  assert.equal(normalizeCart({ items: [{ subProductId: id, sizeId: size, quantity: 2 }, { subProductId: id, sizeId: size, quantity: 3 }] })[0].quantity, 5);
  assert.throws(() => normalizeCart({ items: [{ subProductId: id, quantity: 0 }] }), /quantity/);
  assert.throws(() => normalizeCart({ items: [{ subProductId: id, quantity: 1, price: 1 }] }), /Unsupported/);
  assert.throws(() => normalizeCart({ items: [{ subProductId: id, quantity: 1 }], total: 1 }), /Unsupported/);
});
test('payment settlement requires exact reference, NGN and kobo amount', () => {
  const checkout = { reference: 'ref', amountKobo: 10001 };
  assert.equal(paymentMatches(checkout, { reference: 'ref', currency: 'NGN', amount: 100.01, status: 'success' }), true);
  for (const change of [{ reference: 'other' }, { currency: 'USD' }, { amount: 100 }, { status: 'pending' }]) {
    assert.equal(paymentMatches(checkout, { reference: 'ref', currency: 'NGN', amount: 100.01, status: 'success', ...change }), false);
  }
});
test('unpriced or out-of-stock variants cannot make the catalogue appear purchasable', () => {
  const product = publicProduct(sp, [{ _id: 'size', sellingPrice: 6000, availableStock: 0 }]);
  assert.equal(product.availability, false);
  assert.equal(publicProduct(sp, [{ _id: 'size', sellingPrice: 0 }]).sellingPrice, null);
});
test('optional base selling units retain their retail price when size variants exist', () => {
  const product = publicProduct({ ...sp, sellWithoutSizeVariants: true }, [{ _id: 'size', sellingPrice: 8000, availableStock: 1 }]);
  assert.equal(product.baseSellingPrice, 5000);
  assert.equal(product.sellingPrice, 5000);
});
test('case variants of ObjectIds combine as the same cart line', () => {
  const lower = 'abcdef'.repeat(4);
  const rows = normalizeCart({ items: [{ subProductId: lower, quantity: 1 }, { subProductId: lower.toUpperCase(), quantity: 1 }] });
  assert.equal(rows.length, 1); assert.equal(rows[0].quantity, 2);
});
