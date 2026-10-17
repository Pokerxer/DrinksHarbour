const test = require('node:test');
const assert = require('node:assert/strict');
const Product = require('../models/Product');
const Order = require('../models/Order');
const SalesOrder = require('../models/SalesOrder');
const { getProductSalesHistory } = require('../services/product-sales.service');
function chain(rows) {
  return {
    select() {
      return this;
    },
    populate() {
      return this;
    },
    limit() {
      return this;
    },
    lean: async () => rows,
  };
}
test('sales queries bind product and tenant on the same item; returned report excludes foreign basket lines', async (t) => {
  t.mock.method(Product, 'exists', async () => ({}));
  let orderQuery, salesQuery;
  t.mock.method(Order, 'find', (q) => {
    orderQuery = q;
    return chain([]);
  });
  t.mock.method(SalesOrder, 'find', (q) => {
    salesQuery = q;
    return chain([]);
  });
  const report = await getProductSalesHistory('p', 'a');
  assert.deepEqual(orderQuery.$or[0].items.$elemMatch, {
    product: 'p',
    tenant: 'a',
  });
  assert.equal(orderQuery.$or[1].tenant, 'a');
  assert.equal(orderQuery.$or[1].source, 'pos');
  assert.equal(salesQuery.tenant, 'a');
  assert.equal(salesQuery['items.product'], 'p');
  assert.equal(report.totals.net, 0);
});
test('unknown product returns 404; oversized history fails explicitly instead of showing partial totals', async (t) => {
  t.mock.method(Product, 'exists', async () => null);
  await assert.rejects(getProductSalesHistory('missing', 'a'), { statusCode: 404 });
  t.mock.method(Product, 'exists', async () => ({}));
  t.mock.method(Order, 'find', () => chain(Array(20001).fill({})));
  t.mock.method(SalesOrder, 'find', () => chain([]));
  await assert.rejects(getProductSalesHistory('p', 'a'), /capacity/);
});
