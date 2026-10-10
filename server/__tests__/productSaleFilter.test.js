const test = require('node:test');
const assert = require('node:assert/strict');
const { buildActiveSaleMatch } = require('../services/productSaleFilter');

test('active sale type requires a single offer with matching type, flag and dates', () => {
  const now = new Date('2026-10-10T00:00:00Z');
  assert.deepEqual(buildActiveSaleMatch('flash_sale', now), {
    $match: { subProducts: { $elemMatch: {
      isOnSale: true, saleType: 'flash_sale',
      $and: [
        { $or: [{ saleStartDate: null }, { saleStartDate: { $lte: now } }] },
        { $or: [{ saleEndDate: null }, { saleEndDate: { $gte: now } }] },
      ],
    } } },
  });
});
test('unfiltered searches keep their existing offer set', () => {
  assert.equal(buildActiveSaleMatch(undefined), null);
});
test('sale type query objects cannot become Mongo operators', () => {
  assert.deepEqual(buildActiveSaleMatch({ $ne: 'flash_sale' }), { $match: { _id: { $exists: false } } });
});
