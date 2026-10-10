const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeStock } = require('../services/tenantProductInsights.stock');
test('ledger wins over aggregates; reservations and zero threshold preserved', () => {
  const s = normalizeStock(
    { availableStock: 100, lowStockThreshold: 0 },
    [{ currentQuantity: 12, reservedQuantity: 2 }],
    [{ stock: 100 }],
  );
  assert.equal(s.totalAvailable, 10);
  assert.equal(s.stock[0].threshold, 0);
});
test('unknown ledger stock is not replaced with fallback zero', () => {
  const s = normalizeStock(
    { availableStock: 0 },
    [{ currentQuantity: null, reservedQuantity: 0 }],
    [],
  );
  assert.equal(s.totalAvailable, null);
  assert.equal(s.stock[0].available, null);
});
test('size stock used before aggregate, never multiplied by pack size', () => {
  const s = normalizeStock(
    { availableStock: 100 },
    [],
    [
      {
        _id: 's',
        stock: 8,
        reservedStock: 2,
        unitsPerPack: 12,
        lowStockThreshold: 3,
      },
    ],
  );
  assert.equal(s.totalAvailable, 6);
  assert.equal(s.stock[0].sizeId, 's');
});
test('missing data is not a zero-stock placeholder', () =>
  assert.equal(normalizeStock({}, [], []).totalAvailable, null));
test('adapter scopes both sources and suppresses broken location/size references', async () => {
  const {
    getStockSnapshots,
  } = require('../services/tenantProductInsights.stock');
  const W = require('../models/WarehouseStock'),
    S = require('../models/Size');
  const wf = W.find,
    sf = S.find;
  const row = {
    subProduct: 'p',
    warehouse: null,
    size: null,
    currentQuantity: 8,
    reservedQuantity: 0,
  };
  W.find = (q) => {
    assert.equal(q.tenant, 'a');
    const chain = {
      select: () => chain,
      populate: () => chain,
      lean: async () => [row],
    };
    return chain;
  };
  S.find = (q) => {
    assert.equal(q.tenant, 'a');
    return { select: () => ({ lean: async () => [] }) };
  };
  try {
    const data = await getStockSnapshots('a', [
      { _id: 'p', availableStock: 100 },
    ]);
    assert.equal(data.get('p').totalAvailable, null);
  } finally {
    W.find = wf;
    S.find = sf;
  }
});
