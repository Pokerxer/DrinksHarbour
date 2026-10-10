const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const POSSession = require('../models/POSSession');
const linkedReturns = require('../services/linkedReturns.service');
const { getPOSDashboard } = require('../controllers/pos.controller');

const tenantId = new mongoose.Types.ObjectId();

function query(rows) {
  let fields;
  const q = {
    select(value) { fields = value.split(' '); return q; },
    sort() { return q; },
    limit() { return q; },
    populate() { return q; },
    async lean() {
      return fields ? rows.map(row => Object.fromEntries(
        Object.entries(row).filter(([key]) => key === '_id' || fields.includes(key))
      )) : rows;
    },
    then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); },
  };
  return q;
}

async function dashboard(t, receipts) {
  t.mock.method(Order, 'find', filter => {
    if (filter.$or) assert.deepEqual(filter.$or, [{ tenant: tenantId }, { 'items.tenant': tenantId }]);
    else assert.equal(String(filter['items.tenant']), String(tenantId));
    assert.equal(filter.shopId, 'retail');
    return query(receipts);
  });
  t.mock.method(POSSession, 'findOne', filter => {
    assert.equal(String(filter.tenant), String(tenantId));
    assert.equal(filter.shopId, 'retail');
    return query(null);
  });
  t.mock.method(linkedReturns, 'projectPOSReturns', async (rows, tenant) => {
    assert.equal(String(tenant), String(tenantId));
    return rows;
  });
  let body;
  let failure;
  await getPOSDashboard(
    { tenant: { _id: tenantId }, query: { shopId: 'retail' }, method: 'GET' },
    { json(value) { body = value; } },
    error => { failure = error; }
  );
  if (failure) throw failure;
  return body;
}

const receipt = overrides => ({
  _id: 'receipt-1', orderNumber: 'POS-001', totalAmount: 1000,
  paymentMethod: 'cash', paymentStatus: 'partially_refunded',
  placedAt: new Date(), createdAt: new Date(),
  items: [{ tenant: tenantId, quantity: 10, itemSubtotal: 1000 }],
  refunds: [{ totalRefunded: 200, items: [{ orderItemIndex: 0, quantity: 2, amount: 200 }] }],
  ...overrides,
});

test('POS overview returns populated recent orders with net return totals', async t => {
  const result = await dashboard(t, [receipt()]);
  assert.equal(result.success, true);
  assert.equal(result.data.recentOrders[0].total, 800);
  assert.equal(result.data.recentOrders[0].returnDeduction, 200);
  assert.equal(result.data.recentOrders[0].returnStatus, 'partially_returned');
  assert.equal(result.data.chartData.length, 7);
});

test('POS overview recent-order sales exclude tips and rounding after projection', async t => {
  const result = await dashboard(t, [receipt({ totalAmount: 1025, tipAmount: 20, roundingAmount: 5 })]);
  assert.equal(result.data.recentOrders[0].originalTotal, 1025);
  assert.equal(result.data.recentOrders[0].total, 800);
  assert.equal(result.data.today.totalSales, 800);
});

test('POS overview handles no recent orders', async t => {
  const result = await dashboard(t, []);
  assert.deepEqual(result.data.recentOrders, []);
  assert.equal(result.data.today.totalSales, 0);
  assert.equal(result.data.currentSession, null);
});
