const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../services/arAp.service');
const controller = require('../controllers/arAp.controller');

function connectionError() {
  return Object.assign(new Error('connection <monitor> to database:27017 closed'), {
    name: 'MongoServerSelectionError',
  });
}

async function invoke(handler, query = {}) {
  let body;
  let error;
  await handler(
    { tenant: { _id: 'trusted-tenant' }, query: { page: '2', search: 'wine', ...query } },
    { json: (value) => { body = value; } },
    (value) => { error = value; },
  );
  return { body, error };
}

test('allocation scope requests open saved Sales invoices in the trusted tenant', async (t) => {
  const legacy = t.mock.method(service, 'listOpenDocs', async () => { throw new Error('legacy browsing scope'); });
  t.mock.method(service, 'listInvoices', async (tenant, options) => {
    assert.equal(tenant, 'trusted-tenant');
    assert.equal(options.scope, 'open');
    return { data: [], total: 0, page: 2, pages: 1 };
  });
  const result = await invoke(controller.listInvoices, { scope: 'open' });
  assert.equal(result.error, undefined);
  assert.equal(legacy.mock.callCount(), 0);
});

for (const [handler, method, side] of [
  ['receivablesSummary', 'summary', 'ar'],
  ['payablesSummary', 'summary', 'ap'],
  ['listInvoices', 'listInvoices', 'ar'],
  ['listBills', 'listOpenDocs', 'ap'],
]) {
  test(`${handler} recovers from a closed monitor and keeps trusted tenant scope`, async (t) => {
    let attempts = 0;
    const data = method === 'summary'
      ? { count: 1, totalOutstanding: 75, buckets: { current: 75 } }
      : { data: [{ outstanding: 75 }], total: 1, page: 2, pages: 2 };
    t.mock.method(service, method, async (tenant, requestedSide, options) => {
      assert.equal(tenant, 'trusted-tenant');
      if (method === 'listInvoices') options = requestedSide;
      else assert.equal(requestedSide, side);
      if (options) {
        assert.equal(options.page, 2);
        assert.equal(options.search, 'wine');
      }
      if (++attempts === 1) throw connectionError();
      return data;
    });
    const result = await invoke(controller[handler]);
    assert.equal(result.error, undefined);
    assert.equal(result.body.success, true);
    assert.deepEqual(result.body.data, method === 'summary' ? data : data.data);
    assert.equal(attempts, 2);
  });
}

test('a continuing outage ends after one summary retry', async (t) => {
  const failure = connectionError();
  let attempts = 0;
  t.mock.method(service, 'summary', async () => { attempts++; throw failure; });
  const result = await invoke(controller.receivablesSummary);
  assert.equal(result.body, undefined);
  assert.equal(result.error, failure);
  assert.equal(attempts, 2);
});

test('a query error is passed through without replaying the accounting read', async (t) => {
  const failure = Object.assign(new Error('The $sum accumulator is a unary operator'), {
    name: 'MongoServerError', code: 40237,
  });
  let attempts = 0;
  t.mock.method(service, 'summary', async () => { attempts++; throw failure; });
  const result = await invoke(controller.receivablesSummary);
  assert.equal(result.body, undefined);
  assert.equal(result.error, failure);
  assert.equal(attempts, 1);
});
