const test = require('node:test');
const assert = require('node:assert/strict');
const { parseShoppingLocation, distanceKm } = require('../utils/shoppingLocation');
const { resolveProximityProducts, rankOffers } = require('../services/marketplaceProximity');
const origin = { lat: 0, lon: 0 };
const offer = (id, lon, price, stock = 1, extra = {}) => ({
  _id: id, tenant: { _id: id, name: id }, _sellerLocation: { lat: 0, lon },
  sizes: [{ _id: id + '-size', size: '750ml', stock, pricing: { websitePrice: price, currency: 'NGN' } }],
  ...extra,
});
test('coordinate header accepts zero and rejects malformed or incomplete locations', () => {
  assert.deepEqual(parseShoppingLocation('{"lat":0,"lon":0}'), origin);
  assert.equal(parseShoppingLocation(undefined), null);
  for (const raw of ['null', '{}', '[]', '{"lat":91,"lon":0}', '{"lat":"0","lon":0}', 'bad']) {
    assert.throws(() => parseShoppingLocation(raw), /shopping location/i);
  }
  assert.equal(distanceKm(origin, origin), 0);
  assert.ok(Math.abs(distanceKm(origin, { lat: 0, lon: 1 }) - 111.195) < .01);
  assert.equal(distanceKm(origin, { lat: null, lon: 1 }), null);
});
test('available known offers lead unknown and sold-out offers without exposing coordinates', () => {
  const rows = rankOffers([offer('sold', .01, 1, 0), offer('unknown', null, 3), offer('far', 2, 4), offer('near', 1, 9)], origin);
  assert.deepEqual(rows.map(row => row._id), ['near', 'far', 'unknown', 'sold']);
  assert.equal('_sellerLocation' in rows[0], false);
});
test('ranking is catalogue-wide, stable, and paginated after price filters', () => {
  const rows = [{ _id: 'far', availableAt: [offer('f', 3, 10)] },
    { _id: 'near', availableAt: [offer('n', .1, 100), offer('n2', 1, 20)] }];
  const filtered = resolveProximityProducts(rows, { shoppingLocation: origin, minPrice: 15, maxPrice: 25, page: 1, limit: 1 });
  assert.equal(filtered.totalResults, 1);
  assert.equal(filtered.products[0].shoppingOffer.subProductId, 'n2');
  assert.equal(filtered.products[0].shoppingOffer.price, 20);
  const first = resolveProximityProducts(rows, { shoppingLocation: origin, page: 1, limit: 1 });
  const second = resolveProximityProducts(rows, { shoppingLocation: origin, page: 2, limit: 1 });
  assert.equal(first.products[0]._id, 'near');
  assert.equal(second.products[0]._id, 'far');
  assert.equal(first.totalResults, 2);
});
test('explicit price sorting uses nearest representative price and sale sections use qualifying offers', () => {
  const rows = [{ _id: 'a', availableAt: [offer('near', .1, 100), offer('cheap', 2, 1)] },
    { _id: 'b', availableAt: [offer('b', 1, 20)] }];
  assert.deepEqual(resolveProximityProducts(rows, { shoppingLocation: origin, sortBy: 'price_low' }).products.map(p => p._id), ['b', 'a']);
  const sale = resolveProximityProducts([{ _id: 'sale', availableAt: [
    offer('non-sale', .1, 50), offer('sale', 1, 80, 1, { isOnSale: true, saleType: 'flash_sale' }),
  ] }], { shoppingLocation: origin, saleType: 'flash_sale' });
  assert.equal(sale.products[0].shoppingOffer.subProductId, 'sale');
});
test('a sold-out price-filter match never quick-adds an in-stock nonmatching variant', () => {
  const p = { _id: 'filtered', availableAt: [offer('expensive', .1, 1000), offer('sold', 1, 20, 0)] };
  const row = resolveProximityProducts([p], { shoppingLocation: origin, minPrice: 15, maxPrice: 25 }).products[0];
  assert.equal(row.shoppingOffer, null);
  assert.ok(row.availableAt.every(at => at.sizes.every(size => size.stock === 0)));
  assert.equal(row.priceRange.min, 20);
});
