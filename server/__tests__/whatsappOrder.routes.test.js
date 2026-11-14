// server/__tests__/whatsappOrder.routes.test.js
const test = require('node:test');
const assert = require('node:assert');

// Route-level unit tests: the guards and delegation are what matter here; the
// service itself is covered in whatsappOrderInvoice.test.js.
test('invoice route is super_admin-only and delegates to the service', async (t) => {
  const svc = require('../services/whatsappOrderInvoice');
  let called = 0;
  t.mock.method(svc, 'issueInvoice', async (orderId, actor, opts) => {
    called += 1;
    assert.strictEqual(opts.force, true);
    return { invoiceUrl: 'https://x/invoice/1?token=t', authorizationUrl: 'https://checkout', resendOnly: false,
      order: { invoice: { paymentReference: 'dhm-invoice-1' } } };
  });

  const controller = require('../controllers/whatsappOrder.controller');
  const req = { params: { id: '507f191e77bcf86cd799439990' }, body: { force: true },
    user: { _id: '507f1f77bcf86cd799439011', role: 'super_admin' } };
  let payload;
  // successResponse chains res.status(...).json(...) — capture from the inner json.
  const res = { status: () => ({ json: (b) => { payload = b; } }), json(b) { payload = b; } };
  await controller.issueInvoice(req, res, (e) => { throw e; });
  assert.strictEqual(called, 1);
  assert.ok(payload?.data?.invoiceUrl);
});

test('pay-verify requires a token or a gateway reference and returns the paid state', async (t) => {
  const svc = require('../services/whatsappOrderInvoice');
  t.mock.method(svc, 'publicInvoice', async () => ({ paymentStatus: 'pending' })); // token check target
  let attached = 0;
  t.mock.method(svc, 'verifyAndAttach', async () => {
    attached += 1;
    return { orderNumber: 'DH-1001', paymentStatus: 'paid' };
  });
  const controller = require('../controllers/whatsappOrder.controller');
  const req = { params: { id: '507f191e77bcf86cd799439990' },
    body: { token: 'tok', reference: 'dhm-invoice-1' } };
  let payload;
  const res = { status: () => ({ json: (b) => { payload = b; } }), json(b) { payload = b; } };
  await controller.verifyPayment(req, res, (e) => { throw e; });
  assert.strictEqual(attached, 1);
  assert.strictEqual(payload.data.paid, true);

  // Reference-only call (Korapay redirect may drop the token query param).
  await controller.verifyPayment(
    { params: { id: '507f191e77bcf86cd799439990' }, body: { reference: 'dhm-invoice-1' } },
    { status: () => ({ json: () => {} }), json: () => {} },
    (e) => { throw e; },
  );
  assert.strictEqual(attached, 2);

  // Missing BOTH token and reference → rejected.
  await assert.rejects(() => controller.verifyPayment(
    { params: { id: 'x' }, body: {} },
    { status: () => ({ json: () => {} }), json: () => {} },
    (e) => { throw e; }));
});

test('webhook settle routes manual orders to settleFromWebhook', async (t) => {
  const Order = require('../models/Order');
  const manualOrder = { _id: 'manualoid', source: 'manual' };
  const webOrder = { _id: 'weboid', source: 'web' };
  const findMocks = { manualoid: manualOrder, weboid: webOrder };
  t.mock.method(Order, 'findById', async (id) => findMocks[String(id)] || null);

  const Claim = require('../models/MarketplacePaymentClaim');
  const claim = { _id: 'korapay:platform:ref1', state: 'ready', user: 'adminoid', order: 'manualoid' };
  // settle() calls Claim.findById(...).lean() — the mock must be a synchronous
  // query-like object (an async mock would return a Promise with no .lean).
  t.mock.method(Claim, 'findById', () => ({ lean: async () => claim }));

  const trust = require('../services/marketplacePaymentTrust');
  t.mock.method(trust, 'evidence', async () => ({ identity: claim._id, claim, receipt: {} }));
  const svc = require('../services/whatsappOrderInvoice');
  let manualSettled = 0; let webAttached = 0;
  t.mock.method(svc, 'settleFromWebhook', async () => { manualSettled += 1; });
  t.mock.method(trust, 'attach', async () => { webAttached += 1; });

  const { settle } = require('../services/marketplaceWebhook');
  await settle('korapay', 'ref1');
  assert.strictEqual(manualSettled, 1);
  assert.strictEqual(webAttached, 0);
});
