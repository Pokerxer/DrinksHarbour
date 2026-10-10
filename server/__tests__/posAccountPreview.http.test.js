// __tests__/posAccountPreview.http.test.js
//
// The POS screen must NOT re-derive the wallet/tab split or the credit-limit
// check — it only has a cached tab balance, and by the time a cashier taps
// "Charge to account" the real balance may already have moved. So the split is
// previewed server-side against live balances.
//
// The thing being pinned here is that the preview cannot be used to smuggle a
// decision past the limit: it reports `withinLimit: false` and `requiresOverride`
// for a sale that busts the limit, and it refuses to be asked twice by clients
// with no business asking (bad ids, non-positive totals).
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');

const TENANT = new mongoose.Types.ObjectId();
const CUSTOMER = new mongoose.Types.ObjectId();

function loadApp() {
  // Built lazily so each test controls the mocks installed below.
  delete require.cache[require.resolve('../controllers/pos.controller')];
  return require('../controllers/pos.controller');
}

/**
 * Minimal harness: one route, JSON bodies, and a fake `res`.
 * `protectPOS` is bypassed by mounting the handler directly — this file is about
 * the preview's arithmetic and its refusals, not about the POS auth chain (which
 * the route file wires).
 */
function mount(t, handler, { params = {}, posUser = { _id: new mongoose.Types.ObjectId() }, posPermissions = [] } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenant = { _id: TENANT };
    req.posUser = posUser;
    req.posPermissions = posPermissions;
    next();
  });
  app.post('/preview/:id', handler);
  // Surface thrown errors as JSON — the default HTML page hid a real fault.
  app.use((err, _req, res, _n) => res.status(500).json({ success: false, thrown: err.message, at: String(err.stack).split('\n')[1] }));
  const server = app.listen(0);
  const { port } = server.address();
  // Registered against the test context, not closed by hand: a failing assertion
  // throws before any `close()`, and the leaked listener would hang the whole
  // file rather than just failing the one case.
  t.after(() => new Promise(r => server.close(r)));
  return { url: `http://127.0.0.1:${port}/preview/${params.id || CUSTOMER}` };
}

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

// ── The stub the controller reads: a customer with known balances ─────────────
function stubCustomer(t, { walletBalance = 0, creditLimit = 0, tabBalance = 0 } = {}) {
  const POSCustomer = require('../models/POSCustomer');
  const customerAccount = require('../services/customerAccount.service');

  t.mock.method(POSCustomer, 'findOne', () => ({
    select: () => ({ lean: () => Promise.resolve({ _id: CUSTOMER, firstName: 'Ada', walletBalance, creditLimit }) }),
  }));
  t.mock.method(customerAccount, 'balance', () => Promise.resolve(tabBalance));
  return { POSCustomer, customerAccount };
}

test('a total the wallet fully covers previews as a wallet tender with nothing to the tab', async (t) => {
  stubCustomer(t, { walletBalance: 5000, creditLimit: 0, tabBalance: 0 });
  const h = loadApp();
  const ctx = mount(t, h.previewPOSCustomerCharge);

  const res = await post(ctx.url, { amount: 2000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.split.spend, 2000);
  assert.equal(res.body.data.split.shortfall, 0);
  assert.equal(res.body.data.split.charged, false);
  assert.deepEqual(res.body.data.split.tenders, [{ method: 'wallet', amount: 2000 }]);
  // Nothing goes on the tab, so the standing debt is untouched — not zeroed.
  assert.equal(res.body.data.split.requiredLimit, 0);
});

test('a total exceeding the wallet previews the remainder as a tab charge', async (t) => {
  stubCustomer(t, { walletBalance: 500, creditLimit: 10000, tabBalance: 0 });
  const h = loadApp();
  const ctx = mount(t, h.previewPOSCustomerCharge);

  const res = await post(ctx.url, { amount: 2000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.split.spend, 500, 'the balance is spent first');
  assert.equal(res.body.data.split.shortfall, 1500, 'only the uncovered part becomes debt');
  assert.equal(res.body.data.split.charged, true);
  assert.deepEqual(res.body.data.split.tenders, [
    { method: 'wallet', amount: 500 },
    { method: 'account', amount: 1500 },
  ]);
});

test('the standing tab debt counts toward the limit, so a small sale can already bust it', async (t) => {
  // This is the case a client-side preview gets wrong: it sees 6,000 of headroom
  // and says yes, while the limit is on TOTAL owed and the customer already
  // owes 6,000.
  stubCustomer(t, { walletBalance: 0, creditLimit: 10000, tabBalance: 6000 });
  const h = loadApp();
  const ctx = mount(t, h.previewPOSCustomerCharge);

  const res = await post(ctx.url, { amount: 3000 });

  assert.equal(res.body.data.split.requiredLimit, 9000);
  assert.equal(res.body.data.split.withinLimit, true, '9,000 is within a 10,000 limit');
});

test('a sale over the limit reports withinLimit false and says an override is required', async (t) => {
  stubCustomer(t, { walletBalance: 0, creditLimit: 10000, tabBalance: 7500 });
  const h = loadApp();
  const ctx = mount(t, h.previewPOSCustomerCharge);

  const res = await post(ctx.url, { amount: 3000 });

  assert.equal(res.status, 200, 'a preview is informational — it must not be a 4xx');
  assert.equal(res.body.data.split.withinLimit, false);
  assert.equal(res.body.data.split.requiresOverride, true);
  assert.equal(res.body.data.owedAfter, 10500);
  assert.equal(res.body.data.creditLimit, 10000);
  // Whether THIS cashier can grant it is a fact about them, not about the maths.
  assert.equal(res.body.data.canOverride, false);
});

test('staff holding the credit-override permission are told they can clear it', async (t) => {
  stubCustomer(t, { walletBalance: 0, creditLimit: 10000, tabBalance: 7500 });
  const h = loadApp();
  const ctx = mount(t, h.previewPOSCustomerCharge, { posPermissions: ['pos:credit_override'] });

  const res = await post(ctx.url, { amount: 3000 });

  assert.equal(res.body.data.canOverride, true);
  assert.equal(res.body.data.split.withinLimit, false, 'still reported as over the limit — the grant is the staff member\'s to make, not the maths\' to hide');
});

test('an offline preview is refused rather than guessed from a stale balance', async (t) => {
  stubCustomer(t, { walletBalance: 5000, creditLimit: 10000, tabBalance: 0 });
  const h = loadApp();
  const ctx = mount(t, h.previewPOSCustomerCharge);

  const res = await post(ctx.url, { amount: 2000, offline: true });

  // The client asked while offline. Answering from a cached balance is the one
  // thing that must not happen: it would promise a limit decision it cannot keep.
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'preview_unavailable');
});

test('a non-positive total is refused', async (t) => {
  stubCustomer(t, { walletBalance: 5000, creditLimit: 10000, tabBalance: 0 });
  const h = loadApp();
  const ctx = mount(t, h.previewPOSCustomerCharge);

  for (const amount of [0, -100]) {
    const res = await post(ctx.url, { amount });
    assert.equal(res.status, 400, `amount ${amount} must be refused`);
  }
});

test('a customer from another tenant is refused, not previewed', async (t) => {
  // findOne is scoped by tenant, so a foreign id returns no customer at all.
  const POSCustomer = require('../models/POSCustomer');
  t.mock.method(POSCustomer, 'findOne', () => ({
    select: () => ({ lean: () => Promise.resolve(null) }),
  }));
  const h = loadApp();
  const ctx = mount(t, h.previewPOSCustomerCharge);

  const res = await post(ctx.url, { amount: 2000 });

  assert.equal(res.status, 404);
});