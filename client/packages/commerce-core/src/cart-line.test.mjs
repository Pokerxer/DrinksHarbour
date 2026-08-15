// Run with:  node --experimental-strip-types --test src/lib/cart-line.test.mjs
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { resolveCartLine } from './cart-line.ts';
import { pickDefaultSizeFrom } from './default-variant.ts';

/**
 * Shapes a product the way every /api/products* endpoint returns it:
 * `availableAt[n]._id` is the SubProduct _id, `availableAt[n].sizes[n]._id`
 * is the Size _id, and `availableAt[n].tenant._id` is the Tenant _id.
 */
const size = (id, label, stock, price) => ({
  _id: id,
  size: label,
  stock,
  pricing: { websitePrice: price, currencySymbol: '₦' },
});

const vendor = (subProductId, tenantId, tenantName, sizes) => ({
  _id: subProductId,
  tenant: { _id: tenantId, name: tenantName },
  sizes,
});

const product = (...vendors) => ({ _id: 'prod1', name: 'Test Whisky', availableAt: vendors });

test('resolves both ids off the same vendor', () => {
  const line = resolveCartLine(
    product(vendor('sub1', 'ten1', 'Harbour Stores', [size('sz1', '70cl', 12, 45000)])),
  );
  assert.equal(line.subProductId, 'sub1');
  assert.equal(line.sizeId, 'sz1');
  assert.equal(line.tenantId, 'ten1');
  assert.equal(line.vendorName, 'Harbour Stores');
  assert.equal(line.size, '70cl');
  assert.equal(line.price, 45000);
});

test('honours an explicitly requested size', () => {
  const line = resolveCartLine(
    product(vendor('sub1', 'ten1', 'A', [size('sz1', '70cl', 5, 45000), size('sz2', '1L', 5, 60000)])),
    { size: '1L' },
  );
  assert.equal(line.sizeId, 'sz2');
  assert.equal(line.size, '1L');
  assert.equal(line.price, 60000);
});

test('honours an explicitly requested vendor', () => {
  const line = resolveCartLine(
    product(
      vendor('sub1', 'ten1', 'A', [size('sz1', '70cl', 5, 45000)]),
      vendor('sub2', 'ten2', 'B', [size('sz2', '70cl', 5, 41000)]),
    ),
    { vendorId: 'ten2' },
  );
  assert.equal(line.subProductId, 'sub2');
  assert.equal(line.sizeId, 'sz2');
  assert.equal(line.tenantId, 'ten2');
});

test('falls back to the first vendor carrying the requested size', () => {
  const line = resolveCartLine(
    product(
      vendor('sub1', 'ten1', 'A', [size('sz1', '70cl', 5, 45000)]),
      vendor('sub2', 'ten2', 'B', [size('sz2', '1L', 5, 60000)]),
    ),
    { size: '1L' },
  );
  assert.equal(line.subProductId, 'sub2');
  assert.equal(line.sizeId, 'sz2');
});

test('prefers an in-stock size when none was requested', () => {
  const line = resolveCartLine(
    product(vendor('sub1', 'ten1', 'A', [size('sz1', '70cl', 0, 45000), size('sz2', '1L', 7, 60000)])),
  );
  assert.equal(line.sizeId, 'sz2');
  assert.equal(line.size, '1L');
});

test('returns null when the product carries no vendors', () => {
  assert.equal(resolveCartLine({ _id: 'prod1' }), null);
  assert.equal(resolveCartLine({ _id: 'prod1', availableAt: [] }), null);
  assert.equal(resolveCartLine(null), null);
});

/**
 * The regression this module exists for. POST /api/cart/validate resolves a
 * line with `Size.findOne({ _id: sizeId, subproduct: subProductId })` and
 * reports `unavailable` — rendered as "Out of Stock" — when that misses. A
 * subProductId paired with a blank sizeId therefore made in-stock carousel
 * items read as sold out. Half a line is worse than none: emit neither id.
 */
test('never returns a subProductId without its sizeId', () => {
  const stripped = product(vendor('sub1', 'ten1', 'A', [{ size: '70cl', stock: 12, pricing: {} }]));
  assert.equal(resolveCartLine(stripped), null);
});

test('never returns a sizeId without its subProductId', () => {
  const stripped = {
    _id: 'prod1',
    availableAt: [{ tenant: { _id: 'ten1', name: 'A' }, sizes: [size('sz1', '70cl', 12, 45000)] }],
  };
  assert.equal(resolveCartLine(stripped), null);
});

/**
 * cart-line.ts keeps its own copy of the "first in-stock, else first" rule
 * (see the comment on `firstInStock`). Pin it to the original so the cart and
 * the product page never disagree about which variant is the default.
 */
test('default size matches pickDefaultSizeFrom', () => {
  const cases = [
    [size('sz1', '70cl', 0, 45000), size('sz2', '1L', 7, 60000)],
    [size('sz1', '70cl', 0, 45000), size('sz2', '1L', 0, 60000)],
    [size('sz1', '70cl', 3, 45000)],
  ];
  for (const sizes of cases) {
    const line = resolveCartLine(product(vendor('sub1', 'ten1', 'A', sizes)));
    assert.equal(line.sizeId, pickDefaultSizeFrom(sizes)._id);
  }
});

test('ids always belong to the same vendor', () => {
  const p = product(
    vendor('sub1', 'ten1', 'A', [size('sz1', '70cl', 12, 45000)]),
    vendor('sub2', 'ten2', 'B', [size('sz2', '70cl', 3, 41000)]),
  );
  for (const opts of [{}, { size: '70cl' }, { vendorId: 'ten2' }, { vendorId: 'ten1', size: '70cl' }]) {
    const line = resolveCartLine(p, opts);
    const owner = p.availableAt.find((v) => v._id === line.subProductId);
    assert.ok(owner.sizes.some((s) => s._id === line.sizeId));
  }
});
