// server/__tests__/cart.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const { buildCartItemId, mergeCartLines } = require('../helpers/cart.helpers');

test('buildCartItemId matches the client generateCartItemId scheme', () => {
  assert.strictEqual(buildCartItemId('p1', '70cl', 'Wyn City', ''), 'p1-70cl-Wyn City-default');
  assert.strictEqual(buildCartItemId('p1', '', '', ''), 'p1-default-default-default');
});

test('buildCartItemId coerces null and undefined the same way as empty string', () => {
  assert.strictEqual(buildCartItemId('p1', null, undefined, null), 'p1-default-default-default');
});

test('mergeCartLines keeps the higher quantity when a line exists on both sides', () => {
  const db =    [{ cartItemId: 'a', quantity: 5, name: 'Hennessy' }];
  const local = [{ cartItemId: 'a', quantity: 2, name: 'Hennessy' }];
  const merged = mergeCartLines(db, local);
  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0].quantity, 5);
});

test('mergeCartLines takes the local quantity when it is higher', () => {
  const db =    [{ cartItemId: 'a', quantity: 1 }];
  const local = [{ cartItemId: 'a', quantity: 4 }];
  assert.strictEqual(mergeCartLines(db, local)[0].quantity, 4);
});

test('mergeCartLines never sums quantities', () => {
  const db =    [{ cartItemId: 'a', quantity: 5 }];
  const local = [{ cartItemId: 'a', quantity: 2 }];
  assert.notStrictEqual(mergeCartLines(db, local)[0].quantity, 7);
});

test('mergeCartLines unions disjoint lines, DB lines first', () => {
  const db =    [{ cartItemId: 'a', quantity: 1 }];
  const local = [{ cartItemId: 'b', quantity: 3 }];
  const merged = mergeCartLines(db, local);
  assert.deepStrictEqual(merged.map((l) => l.cartItemId), ['a', 'b']);
  assert.deepStrictEqual(merged.map((l) => l.quantity), [1, 3]);
});

test('mergeCartLines prefers DB field values over local ones for overlapping lines', () => {
  const db =    [{ cartItemId: 'a', quantity: 1, price: 128500 }];
  const local = [{ cartItemId: 'a', quantity: 1, price: 99 }];
  assert.strictEqual(mergeCartLines(db, local)[0].price, 128500);
});

test('mergeCartLines returns the DB cart unchanged when local is empty', () => {
  const db = [{ cartItemId: 'a', quantity: 2 }];
  assert.deepStrictEqual(mergeCartLines(db, []), db);
});

test('mergeCartLines returns the local cart when the DB cart is empty', () => {
  const local = [{ cartItemId: 'b', quantity: 3 }];
  assert.deepStrictEqual(mergeCartLines([], local), local);
});

test('mergeCartLines tolerates null and undefined inputs', () => {
  assert.deepStrictEqual(mergeCartLines(null, undefined), []);
});

test('mergeCartLines treats a missing quantity as 1', () => {
  const merged = mergeCartLines([{ cartItemId: 'a' }], [{ cartItemId: 'a', quantity: 1 }]);
  assert.strictEqual(merged[0].quantity, 1);
});

// ── buildCartLine ────────────────────────────────────────────────────────────
const { buildCartLine } = require('../helpers/cart.helpers');

const populatedItem = () => ({
  product: {
    _id: 'p1', name: 'Hennessy VSOP', slug: 'hennessy-vsop-cognac',
    images: [{ url: 'https://cdn/h.jpg' }], type: 'spirit', isAlcoholic: true, abv: 40,
  },
  subproduct: { _id: 'sp1', sku: 'HEN-VSOP-70', tenant: { _id: 't1', name: 'Wyn City' } },
  size: { _id: 'sz1', size: '70cl', displayName: '70cl Bottle' },
  quantity: 2,
  addedAt: new Date('2026-07-29T10:00:00Z'),
});

const pricing = () => ({ finalPrice: 128500, packUnitPrice: 122000, packThreshold: 6 });

test('buildCartLine produces a client-shaped line with the platform price', () => {
  const line = buildCartLine(populatedItem(), pricing());
  assert.strictEqual(line.cartItemId, 'p1-70cl-Wyn City-default');
  assert.strictEqual(line.name, 'Hennessy VSOP');
  assert.strictEqual(line.slug, 'hennessy-vsop-cognac');
  assert.strictEqual(line.price, 128500);
  assert.strictEqual(line.quantity, 2);
});

test('buildCartLine carries the selection ids the client sends back on save', () => {
  const line = buildCartLine(populatedItem(), pricing());
  assert.strictEqual(line.selectedProductId, 'p1');
  assert.strictEqual(line.selectedSubProductId, 'sp1');
  assert.strictEqual(line.selectedSizeId, 'sz1');
  assert.strictEqual(line.selectedVendorId, 't1');
  assert.strictEqual(line.selectedVendor, 'Wyn City');
  assert.strictEqual(line.selectedSize, '70cl');
});

test('buildCartLine sets selectedColor to empty string — the schema stores no colour', () => {
  assert.strictEqual(buildCartLine(populatedItem(), pricing()).selectedColor, '');
});

test('buildCartLine passes pack pricing through', () => {
  const line = buildCartLine(populatedItem(), pricing());
  assert.strictEqual(line.packUnitPrice, 122000);
  assert.strictEqual(line.packThreshold, 6);
});

test('buildCartLine emits null pack fields when the size has no pack rate', () => {
  const line = buildCartLine(populatedItem(), { finalPrice: 128500, packUnitPrice: null, packThreshold: null });
  assert.strictEqual(line.packUnitPrice, null);
  assert.strictEqual(line.packThreshold, null);
});

test('buildCartLine never reads size.sellingPrice for the display price', () => {
  const item = populatedItem();
  item.size.sellingPrice = 999;
  assert.strictEqual(buildCartLine(item, pricing()).price, 128500);
});

test('buildCartLine returns null when the product is gone', () => {
  const item = populatedItem();
  item.product = null;
  assert.strictEqual(buildCartLine(item, pricing()), null);
});

test('buildCartLine returns null when the tenant no longer populates', () => {
  const item = populatedItem();
  item.subproduct.tenant = null;
  assert.strictEqual(buildCartLine(item, pricing()), null);
});

test('buildCartLine returns null when the size is gone', () => {
  const item = populatedItem();
  item.size = null;
  assert.strictEqual(buildCartLine(item, pricing()), null);
});

test('buildCartLine falls back to size.displayName when size.size is missing', () => {
  const item = populatedItem();
  item.size = { _id: 'sz1', displayName: '70cl Bottle' };
  assert.strictEqual(buildCartLine(item, pricing()).selectedSize, '70cl Bottle');
});
