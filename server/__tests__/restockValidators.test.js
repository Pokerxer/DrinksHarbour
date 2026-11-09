// server/__tests__/restockValidators.test.js
// Recommendation validators must ignore presentation lines ('section'/'note')
// that the create forms can now interleave: a buyer who adds a heading or a
// note to a recommended order must not break the plan-reference match.
const test = require('node:test');
const assert = require('node:assert/strict');

const { validateTransferPreparation } = require('../services/restock/transfer-purchase');
const { validateRestockPurchase } = require('../services/restock/purchase');

const ids = {
  source: '507f1f77bcf86cd799439014',
  destination: '507f1f77bcf86cd799439015',
  product: '507f1f77bcf86cd799439011',
  size: '507f1f77bcf86cd799439016',
  warehouse: '507f1f77bcf86cd799439017',
};

const planLine = {
  key: 'plan-key-1',
  offerId: 'offer-1',
  warehouseId: ids.destination,
  subProductId: ids.product,
  sizeId: ids.size,
  transferPlan: {
    sources: [{ sourceWarehouseId: ids.source, recommendedUnits: 100 }],
  },
};
const purchasePlanLine = {
  key: 'plan-key-1',
  offerId: 'offer-1',
  warehouseId: ids.warehouse,
  subProductId: ids.product,
  sizeId: ids.size,
  alternatives: [
    {
      offerId: 'offer-1',
      unitPrice: 900,
      packagingQty: 1,
      vendorId: ids.source,
      currency: 'NGN',
    },
  ],
};
const stubService = async () => ({ lines: [planLine] });
const purchaseStubService = async () => ({ lines: [purchasePlanLine] });

test('transfer recommendation tolerates interleaved section/note lines', async () => {
  await validateTransferPreparation('tenant', {
    warehouseRecommendation: { key: 'plan-key-1', coverDays: 14 },
    sourceWarehouse: ids.source,
    destinationWarehouse: ids.destination,
    items: [
      { lineType: 'section', name: 'Heading', quantity: 0, subProductId: '' },
      {
        subProductId: ids.product,
        sizeId: ids.size,
        quantity: 10,
      },
    ],
  }, stubService);
});

test('transfer recommendation still rejects a mismatched product item', async () => {
  await assert.rejects(
    () =>
      validateTransferPreparation('tenant', {
        warehouseRecommendation: { key: 'plan-key-1', coverDays: 14 },
        sourceWarehouse: ids.source,
        destinationWarehouse: ids.destination,
        items: [
          {
            subProductId: '507f1f77bcf86cd799439099',
            sizeId: ids.size,
            quantity: 10,
          },
        ],
      }, stubService),
    /Transfer allocation changed/,
  );
});

const refLines = () => ({
  coverDays: 14,
  lines: [
    {
      key: 'plan-key-1',
      offerId: 'offer-1',
      warehouseId: ids.warehouse,
      subProductId: ids.product,
      sizeId: ids.size,
      alternatives: [
        {
          offerId: 'offer-1',
          unitPrice: 900,
          packagingQty: 1,
          vendorId: ids.source,
          currency: 'NGN',
        },
      ],
    },
  ],
});

test('restock purchase tolerates interleaved presentation lines', async () => {
  await validateRestockPurchase('tenant', {
    restockPlan: refLines(),    items: [
      { lineType: 'note', description: 'Deliver soon', quantity: 0, subProductId: '' },
      {
        subProductId: ids.product,
        sizeId: ids.size,
        quantity: 5,
        unitCost: 900,
        packagingQty: 1,
      },
    ],
    vendor: ids.source,
    currency: 'NGN',
    warehouse: ids.warehouse,
  }, purchaseStubService);
});
