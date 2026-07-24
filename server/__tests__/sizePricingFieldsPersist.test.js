const { test } = require('node:test');
const assert = require('node:assert');

const mongoose = require('mongoose');
const Size = require('../models/Size');

// The size form on /sub-products/[slug]/edit posts these per-size pricing inputs.
// Mongoose runs in strict mode, so any path missing from the schema is silently
// stripped on create/update — the admin's value looks saved but never lands.
const sizeInput = () => ({
  subproduct: new mongoose.Types.ObjectId(),
  tenant: new mongoose.Types.ObjectId(),
  size: '75cl',
  costPrice: 8000,
  sellingPrice: 10100,
  markupPercentage: 25.07,
  roundUp: 'none',
  saleDiscountPercentage: 12.5,
  salePrice: 8837.5,
  reorderPoint: 7,
});

test('Size keeps the per-size markup inputs the edit form posts', () => {
  const doc = new Size(sizeInput());

  assert.strictEqual(doc.markupPercentage, 25.07);
  assert.strictEqual(doc.roundUp, 'none');
  assert.strictEqual(doc.saleDiscountPercentage, 12.5);
  assert.strictEqual(doc.salePrice, 8837.5);
});

test('Size keeps a fractional markup exactly, without rounding to an integer', () => {
  const doc = new Size({ ...sizeInput(), markupPercentage: 33.33 });
  assert.strictEqual(doc.markupPercentage, 33.33);
});

test('Size accepts reorderPoint as an alias of reorderLevel', () => {
  const doc = new Size(sizeInput());
  assert.strictEqual(doc.reorderLevel, 7);
});

// updateSubProduct saves sizes with findByIdAndUpdate(id, plainObject). Mongoose
// casts that payload in strict mode and silently drops any path the schema does
// not declare — and, unlike document construction, the cast does NOT resolve
// aliases. This asserts the paths the service writes actually survive.
test('the size update payload survives mongoose strict casting', () => {
  const castUpdate = require('mongoose/lib/helpers/query/castUpdate');

  const payload = {
    sellingPrice: 10100,
    costPrice: 8000,
    markupPercentage: 25.07,
    roundUp: 'none',
    saleDiscountPercentage: 12.5,
    salePrice: 8837.5,
    lowStockThreshold: 4,
    reorderLevel: 7,
    reorderQuantity: 50,
  };

  const cast = castUpdate(Size.schema, { $set: payload }, { strict: true }, null, {});

  for (const key of Object.keys(payload)) {
    assert.ok(
      key in cast.$set,
      `"${key}" was stripped by strict casting — add it to the Size schema`
    );
  }
  assert.strictEqual(cast.$set.markupPercentage, 25.07);
  assert.strictEqual(cast.$set.reorderLevel, 7);
});

test('Size defaults the markup inputs when the form omits them', () => {
  const doc = new Size({
    subproduct: new mongoose.Types.ObjectId(),
    tenant: new mongoose.Types.ObjectId(),
    size: '70cl',
  });

  assert.strictEqual(doc.markupPercentage, 25);
  assert.strictEqual(doc.roundUp, '100');
  assert.strictEqual(doc.saleDiscountPercentage, 0);
  assert.strictEqual(doc.salePrice, null);
});
