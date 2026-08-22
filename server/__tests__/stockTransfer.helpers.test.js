// server/__tests__/stockTransfer.helpers.test.js
//
// The default price on a warehouse-to-warehouse transfer line: wholesale first,
// cost second. `wholesalePrice` lives on Size, never on SubProduct — a
// sub-product sold without size variants is priced through its `defaultSize`,
// which is why the resolver takes a size and a sub-product rather than one doc.
const test = require('node:test');
const assert = require('node:assert');
const {
  resolveTransferUnitCost,
  hasExplicitUnitCost,
} = require('../services/stockTransfer.helpers');

test('a size with a wholesale price wins over every cost price', () => {
  const price = resolveTransferUnitCost({
    size: { wholesalePrice: 4500, costPrice: 3000 },
    subProduct: { costPrice: 2800 },
  });
  assert.strictEqual(price, 4500);
});

test('no wholesale price falls back to the size cost price', () => {
  const price = resolveTransferUnitCost({
    size: { costPrice: 3000 },
    subProduct: { costPrice: 2800 },
  });
  assert.strictEqual(price, 3000);
});

test('a null wholesale price is not a price — new sizes store null', () => {
  // subproduct.service.js seeds `wholesalePrice: sizeData.wholesalePrice ?? null`,
  // so null is the common shape, not an edge case.
  const price = resolveTransferUnitCost({
    size: { wholesalePrice: null, costPrice: 3000 },
    subProduct: { costPrice: 2800 },
  });
  assert.strictEqual(price, 3000);
});

test('a zero wholesale price falls through rather than pricing the line at nothing', () => {
  const price = resolveTransferUnitCost({
    size: { wholesalePrice: 0, costPrice: 3000 },
    subProduct: { costPrice: 2800 },
  });
  assert.strictEqual(price, 3000);
});

test('a size with neither price falls back to the sub-product cost price', () => {
  const price = resolveTransferUnitCost({
    size: { displayName: '75cl' },
    subProduct: { costPrice: 2800 },
  });
  assert.strictEqual(price, 2800);
});

test('a sizeless line still resolves through the sub-product cost price', () => {
  const price = resolveTransferUnitCost({ size: null, subProduct: { costPrice: 2800 } });
  assert.strictEqual(price, 2800);
});

test('nothing priced anywhere resolves to 0, never NaN or undefined', () => {
  assert.strictEqual(resolveTransferUnitCost({}), 0);
  assert.strictEqual(resolveTransferUnitCost(), 0);
  assert.strictEqual(
    resolveTransferUnitCost({ size: { costPrice: 0 }, subProduct: { costPrice: 0 } }),
    0
  );
});

test('a negative price is rejected, not carried through', () => {
  const price = resolveTransferUnitCost({
    size: { wholesalePrice: -10 },
    subProduct: { costPrice: 2800 },
  });
  assert.strictEqual(price, 2800);
});

// ── hasExplicitUnitCost ───────────────────────────────────────────────────────
// Decides whether enrichItems() overwrites what the client sent. The create form
// seeds every blank line at 0, so 0 must read as "not chosen".

test('a typed positive price counts as explicit', () => {
  assert.strictEqual(hasExplicitUnitCost(1250), true);
  assert.strictEqual(hasExplicitUnitCost('1250'), true); // JSON bodies arrive as strings
});

test('0, null, undefined and junk all count as not supplied', () => {
  assert.strictEqual(hasExplicitUnitCost(0), false);
  assert.strictEqual(hasExplicitUnitCost(null), false);
  assert.strictEqual(hasExplicitUnitCost(undefined), false);
  assert.strictEqual(hasExplicitUnitCost(''), false);
  assert.strictEqual(hasExplicitUnitCost('abc'), false);
  assert.strictEqual(hasExplicitUnitCost(-5), false);
});
