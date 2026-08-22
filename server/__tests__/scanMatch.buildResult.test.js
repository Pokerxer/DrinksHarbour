// server/__tests__/scanMatch.buildResult.test.js
//
// buildResult() shapes the payload every Scan & Match consumer reads. It has
// always read Size.unitsPerPack internally (to resolve carton quantities) but
// never returned it — fine for sales, which only needs prices, and wrong for
// purchases, where a PO line's packSize IS units-per-pack. These tests pin the
// projection so the field can't be dropped again.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { buildResult } = require('../services/scanMatch.service');

const extracted = {
  name: 'Hennessy VS 70cl',
  brand: 'Hennessy',
  type: 'cognac',
  sizeText: '70cl',
  packUnit: null,
  qty: 2,
};

const matchedProduct = { _id: 'p-1', name: 'Hennessy VS' };

function subProduct(sizes) {
  return {
    _id: 'sp-1',
    sku: 'HEN-VS',
    baseSellingPrice: 90000,
    costPrice: 58000,
    taxRate: 7.5,
    sellWithoutSizeVariants: false,
    bundleDeals: [],
    sizes,
  };
}

describe('buildResult size projection', () => {
  test('carries unitsPerPack through to the result', () => {
    const res = buildResult(
      extracted,
      matchedProduct,
      [
        subProduct([
          {
            _id: 's-70',
            displayName: '70cl',
            sku: 'HEN-VS-70',
            sellingPrice: 95000,
            costPrice: 61000,
            unitsPerPack: 12,
            stock: 40,
            isDefault: true,
          },
        ]),
      ],
      'exact',
      null
    );

    assert.equal(res.matchedSubProducts[0].sizes[0].unitsPerPack, 12);
  });

  test('defaults unitsPerPack to 1 when the size row predates the field', () => {
    const res = buildResult(
      extracted,
      matchedProduct,
      [
        subProduct([
          { _id: 's-70', displayName: '70cl', sellingPrice: 95000, costPrice: 61000 },
        ]),
      ],
      'exact',
      null
    );

    // 0 or undefined would divide-by-zero the purchases pack totals.
    assert.equal(res.matchedSubProducts[0].sizes[0].unitsPerPack, 1);
  });

  test('still returns the prices sales reads', () => {
    const res = buildResult(
      extracted,
      matchedProduct,
      [
        subProduct([
          {
            _id: 's-70',
            displayName: '70cl',
            sellingPrice: 95000,
            costPrice: 61000,
            unitsPerPack: 6,
          },
        ]),
      ],
      'exact',
      null
    );

    const size = res.matchedSubProducts[0].sizes[0];
    assert.equal(size.sellingPrice, 95000);
    assert.equal(size.costPrice, 61000);
  });
});
