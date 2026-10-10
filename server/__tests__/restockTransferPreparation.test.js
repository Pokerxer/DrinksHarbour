const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateTransferPreparation,
} = require('../services/restock/transfer-purchase');
const plan = {
  lines: [
    {
      key: 'p:s:dest',
      subProductId: 'p',
      sizeId: 's',
      warehouseId: 'dest',
      transferPlan: {
        sources: [{ sourceWarehouseId: 'source', recommendedUnits: 10 }],
      },
    },
  ],
};
const body = {
  sourceWarehouse: 'source',
  destinationWarehouse: 'dest',
  items: [{ subProductId: 'p', sizeId: 's', quantity: 8 }],
  warehouseRecommendation: { key: 'p:s:dest', coverDays: 14 },
};
test('reviewed transfer preparation is checked against fresh exact source/variant allocation', async () => {
  let options;
  await validateTransferPreparation('t', body, async (tenant, input) => {
    assert.equal(tenant, 't');
    options = input;
    return plan;
  });
  assert.equal(options.refresh, true);
  for (const patch of [
    { sourceWarehouse: 'other' },
    { items: [{ subProductId: 'p', sizeId: 'wrong', quantity: 8 }] },
    { items: [{ subProductId: 'p', sizeId: 's', quantity: 11 }] },
  ])
    await assert.rejects(
      validateTransferPreparation('t', { ...body, ...patch }, async () => plan),
      /changed|Refresh/,
    );
});
test('ordinary transfer creation does not invoke recommendation reads', async () => {
  await validateTransferPreparation('t', {}, () => {
    throw new Error('must not read');
  });
});
