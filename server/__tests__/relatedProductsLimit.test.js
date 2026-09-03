// GET /api/products/:id/related ignored ?limit= entirely.
//
// The controller called the service positionally:
//
//   productService.getRelatedProducts(req.params.id, parseInt(limit))
//
// but the service's signature is `(productId, options = {})` and it
// destructures `{ limit = 12 }` off that second argument. A Number has no
// `.limit` property, so the destructuring default won every time: `?limit=3`
// returned 12, and the product page's own widget (`ProductClient.tsx:49`, which
// asks for `?limit=8`) also got 12.
//
// The same positional call existed inside the service itself, in
// getFrequentlyBoughtTogether's no-co-purchase-data fallback.
//
// Passing the number through unwrapped also puts it straight into Mongo —
// getRelatedProducts hands `limit` to `$limit: limit * 3` and `.limit(limit * 3)`
// — so the parse has to be sanitised, not just re-wrapped: `?limit=abc` would
// otherwise reach Mongo as `$limit: NaN`.

const test = require('node:test');
const assert = require('node:assert/strict');

const Order = require('../models/Order');
const Product = require('../models/Product');
const productService = require('../services/product.service');
const productController = require('../controllers/product.controller');

/** Invoke the controller with a query, capturing the options the service got. */
const optionsFor = async (t, query) => {
  let received;
  t.mock.method(productService, 'getRelatedProducts', async (id, options) => {
    received = options;
    return { products: [] };
  });

  const res = { status: () => res, json: () => res };
  await productController.getRelatedProducts(
    { params: { id: '507f1f77bcf86cd799439011' }, query },
    res,
    (err) => { if (err) throw err; },
  );

  return received;
};

test('?limit= reaches the service as an options object, not a bare number', async (t) => {
  const options = await optionsFor(t, { limit: '3' });

  assert.deepEqual(options, { limit: 3 });
});

test("the product page's ?limit=8 is honoured", async (t) => {
  // ProductClient.tsx asks for 8; it was silently served 12.
  const options = await optionsFor(t, { limit: '8' });

  assert.equal(options.limit, 8);
});

test('no ?limit= falls back to the endpoint default', async (t) => {
  const options = await optionsFor(t, {});

  assert.equal(options.limit, 6);
});

test('a non-numeric ?limit= falls back instead of sending NaN to Mongo', async (t) => {
  for (const bad of ['abc', '', '0', '-5']) {
    const options = await optionsFor(t, { limit: bad });
    assert.equal(options.limit, 6, `?limit=${bad} should fall back to the default`);
  }
});

test('an absurd ?limit= is capped', async (t) => {
  // limit feeds `$limit: limit * 3` on a public endpoint.
  const options = await optionsFor(t, { limit: '100000' });

  assert.equal(options.limit, 50);
});

test('getFrequentlyBoughtTogether passes its limit through as options too', async (t) => {
  // Its fallback, when a product has no co-purchase history, called
  // getRelatedProducts(productId, limit) positionally — so a request for 5
  // came back with 12. That call is a local binding inside the service, so it
  // is driven for real here and observed where the limit lands: the mixed
  // strategy's `{ $limit: limit * 3 }`.
  const productId = '507f1f77bcf86cd799439011';
  let limitStage;

  t.mock.method(Order, 'aggregate', async () => []); // no co-purchase history
  t.mock.method(Product, 'findById', () => {
    const chain = { populate: () => chain, lean: async () => ({ _id: productId, status: 'approved', type: 'whisky' }) };
    return chain;
  });
  t.mock.method(Product, 'aggregate', async (pipeline) => {
    limitStage = pipeline.find(s => s.$limit)?.$limit;
    return [];
  });

  await productService.getFrequentlyBoughtTogether(productId, 5);

  assert.equal(limitStage, 15, 'the fallback asked for 5 → the pipeline should take 5 × 3');
  assert.notEqual(limitStage, 36, 'the limit was dropped and the service default of 12 won');
});
