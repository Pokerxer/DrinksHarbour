const test = require('node:test'), assert = require('node:assert/strict');
const service = require('../services/product.service');
const controller = require('../controllers/product.controller');
test('bestseller and featured handlers forward private browsing location to candidate resolution', async t => {
  for (const name of ['getBestsellers', 'getFeaturedProducts']) {
    let args;
    t.mock.method(service, name, async (...values) => { args = values; return { products: [] }; });
    const location = { lat: 0, lon: 0 };
    await controller[name]({ query: { limit: '12' }, shoppingLocation: location },
      { status() { return this; }, json() {} }, error => { throw error; });
    assert.deepEqual(args.at(-1).shoppingLocation, location);
  }
});
