const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeOrderUnits,
  normalizeSalesUnits,
  sumSalesWindows,
} = require('../services/tenantProductInsights.sales');
const { reportingWindows } = require('../services/tenantProductInsights.rules');
const w = reportingWindows(new Date('2026-10-08T08:00:00Z'));
const order = {
  _id: 'o',
  tenant: 'a',
  source: 'pos',
  paymentStatus: 'paid',
  status: 'confirmed',
  paidAt: '2026-10-07T09:00:00Z',
  items: [
    { tenant: 'a', subproduct: 'p', size: 's', quantity: 10 },
    { tenant: 'b', subproduct: 'q', quantity: 99 },
  ],
  refunds: [
    { items: [{ orderItemIndex: 0, quantity: 2, salesReturnedQuantity: 1 }] },
  ],
  salesReturns: [{ items: [{ orderItemIndex: 0, quantity: 1 }] }],
};
test('mixed basket and mirrored refunds subtract physical returns once', () =>
  assert.deepEqual(
    normalizeOrderUnits(order, 'a').map((r) => r.units),
    [8],
  ));
test('cancelled/unpaid/hold orders and unfinished marketplace fulfillment excluded', () => {
  for (const status of ['cancelled', 'hold', 'voided'])
    assert.equal(normalizeOrderUnits({ ...order, status }, 'a').length, 0);
  assert.equal(
    normalizeOrderUnits({ ...order, paymentStatus: 'unpaid' }, 'a').length,
    0,
  );
  assert.equal(
    normalizeOrderUnits({ ...order, source: 'marketplace' }, 'a').length,
    0,
  );
});
test('linked receipt substitutes only matching fulfillment and does not erase unlinked partials', () => {
  const so = {
    _id: 'so',
    tenant: 'a',
    docType: 'order',
    orderStatus: 'partially_fulfilled',
    paymentStatus: 'paid',
    items: [
      {
        _id: 'line',
        subproduct: 'p',
        size: 's',
        fulfilledQty: 8,
        returnedQty: 1,
      },
    ],
    fulfillments: [
      { ref: 'receipt', at: '2026-10-06', items: [{ lineId: 'line', qty: 5 }] },
      { at: '2026-10-07', items: [{ lineId: 'line', qty: 3 }] },
    ],
  };
  const receipt = {
    ...order,
    linkedSalesOrder: 'so',
    receiptNumber: 'receipt',
    items: [{ tenant: 'a', subproduct: 'p', size: 's', quantity: 5 }],
    refunds: [],
    salesReturns: [{ items: [{ orderItemIndex: 0, quantity: 1 }] }],
  };
  const rows = normalizeSalesUnits(so, [receipt], 'a');
  assert.equal(
    rows.reduce((n, r) => n + r.units, 0),
    3,
  );
});
test('window sums by completion and guards against invalid dates/units', () => {
  const m = sumSalesWindows(
    [
      { subProductId: 'p', units: 5, at: '2026-10-07' },
      { subProductId: 'p', units: 8, at: '2026-09-29' },
      { subProductId: 'p', units: 100, at: 'invalid' },
    ],
    w,
  );
  assert.deepEqual(m.get('p'), {
    currentUnits: 5,
    previousUnits: 8,
    units30: 13,
  });
});
test('old linked receipts keep historical Sales returns out of the recent receipt', async () => {
  const { getNetSales } = require('../services/tenantProductInsights.sales');
  const Order = require('../models/Order'),
    Sales = require('../models/SalesOrder');
  const of = Order.find,
    sf = Sales.find;
  let oq = 0,
    sq = 0;
  const chain = (rows) => ({
    select: () => ({
      lean: () => ({
        cursor: async function* () {
          yield* rows;
        },
      }),
    }),
  });
  const recent = {
    _id: 'recent',
    tenant: 'a',
    source: 'pos',
    status: 'confirmed',
    paymentStatus: 'paid',
    linkedSalesOrder: 'so',
    receiptNumber: 'new',
    paidAt: '2026-10-07',
    createdAt: '2026-10-07',
    items: [{ subproduct: 'p', size: 's', tenant: 'a', quantity: 5 }],
  };
  const old = {
    ...recent,
    _id: 'old',
    receiptNumber: 'old',
    paidAt: '2026-09-01',
    createdAt: '2026-09-01',
  };
  const so = {
    _id: 'so',
    tenant: 'a',
    docType: 'order',
    paymentStatus: 'paid',
    orderStatus: 'fulfilled',
    items: [
      {
        _id: 'line',
        subproduct: 'p',
        size: 's',
        fulfilledQty: 10,
        returnedQty: 4,
      },
    ],
    fulfillments: [],
  };
  Sales.find = (q) => {
    assert.equal(q.tenant, 'a');
    return chain(sq++ ? [so] : []);
  };
  Order.find = () => chain(oq++ ? [old, recent] : [recent]);
  try {
    const result = await getNetSales('a', ['p'], w);
    assert.equal(result.get('p').currentUnits, 5);
  } finally {
    Order.find = of;
    Sales.find = sf;
  }
});
test('undated legacy fulfillment suppresses advice instead of claiming no sales', async () => {
  const { getNetSales } = require('../services/tenantProductInsights.sales');
  const Order = require('../models/Order'),
    Sales = require('../models/SalesOrder');
  const of = Order.find,
    sf = Sales.find;
  const chain = (rows) => ({
    select: () => ({
      lean: () => ({
        cursor: async function* () {
          yield* rows;
        },
      }),
    }),
  });
  Sales.find = () =>
    chain([
      {
        _id: 'so',
        tenant: 'a',
        docType: 'order',
        orderStatus: 'fulfilled',
        paymentStatus: 'paid',
        items: [{ _id: 'l', subproduct: 'p', fulfilledQty: 10 }],
        fulfillments: [],
      },
    ]);
  Order.find = () => chain([]);
  try {
    const result = await getNetSales('a', ['p'], w);
    assert.equal(result.get('p')?.units30, null);
  } finally {
    Order.find = of;
    Sales.find = sf;
  }
});
