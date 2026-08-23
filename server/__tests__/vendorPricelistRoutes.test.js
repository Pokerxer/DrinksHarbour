// server/__tests__/vendorPricelistRoutes.test.js
//
// VendorPricelist controller hardening: tenant-scoped get-one (Workstream B),
// update field allowlist, and embedded-item validation. Same mocking approach
// as pricelistRoutesValidation.test.js.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const oid = () => new mongoose.Types.ObjectId();

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return res;
}

// The route file captures authenticate/attachTenant/tenantAdminOrSuperAdmin
// at require time via router.use() + route-level guards. t.mock.method on
// the module exports is too late — the router already bound the originals.
// We intercept Module._load so the router sees pass-through middlewares,
// and clear the require cache so the router re-requires with our mocks.
let routerCacheKey;
function bypassAuth(t) {
  const Module = require('module');
  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === './middleware/auth.middleware' ||
        request === '../middleware/auth.middleware') {
      return {
        authenticate: (r, s, n) => n(),
        // vendorPricelist.routes guards with protect (pricelist.routes uses
        // authenticate); both names are aliased to the same pass-through.
        protect: (r, s, n) => n(),
        attachTenant: (r, s, n) => n(),
        tenantAdminOrSuperAdmin: (r, s, n) => n(),
        resolveTenantContext: (r, s, n) => n(),
        requireTenant: (r, s, n) => n(),
        // The router chains this on tenant-owned modules; a missing stub makes
        // router.use(undefined) throw before any test body runs. Its own
        // behaviour is covered in tenantIsolation.test.js.
        requireOwnTenant: (r, s, n) => n(),
        superAdminOnly: (r, s, n) => n(),
        tenantAdminOnly: (r, s, n) => n(),
        tenantUserOnly: (r, s, n) => n(),
      };
    }
    return origLoad.apply(this, arguments);
  };
  t.after(() => { Module._load = origLoad; });
  // Clear cached router + auth so they re-require with our interception.
  delete require.cache[require.resolve('../routes/vendorPricelist.routes')];
  router = null;
}

// Dispatch a request through the router. Express router.handle needs
// req.method + req.url; params are extracted by the router from the url path.
// The response is sent via res.json — resolve on that, not on the router's
// final callback (Express doesn't call it after the response is sent).
function dispatch(router, { method, url, params, body, tenant, user }) {
  const req = {
    method,
    url,
    params: params || {},
    body: body || {},
    tenant,
    user,
    headers: {},
    query: {},
  };
  return new Promise((resolve) => {
    const res = mockRes();
    res.json = function (payload) {
      this.body = payload;
      resolve(this);
      return this;
    };
    res.status = function (code) {
      this.statusCode = code;
      return this;
    };
    router.handle(req, res, (err) => {
      if (err) throw err;
      // If the handler didn't call res.json (e.g. a middleware sent nothing),
      // resolve with whatever res state we have.
      resolve(res);
    });
  });
}

// Chainable query mock supporting await + repeated .populate()
const chainDoc = (result) => {
  const p = Promise.resolve(result);
  const c = {
    populate: () => c,
    lean: async () => result,
    then: p.then.bind(p),
    catch: p.catch.bind(p),
  };
  return c;
};

let router;
function getRouter() {
  if (!router) router = require('../routes/vendorPricelist.routes');
  return router;
}

// ── Tenant isolation on get-one ──────────────────────────────────────────────

test('get-one vendor pricelist is tenant-scoped: cross-tenant _id returns 404', async (t) => {
  bypassAuth(t);
  const VendorPricelist = require('../models/VendorPricelist');
  const tenantA = oid();
  const tenantB = oid();
  const plB = { _id: oid(), tenant: tenantB, name: 'B Secret', items: [] };

  t.mock.method(VendorPricelist, 'findOne', (filter) => {
    if (String(filter.tenant) !== String(tenantB)) return chainDoc(null);
    return chainDoc(plB);
  });
  // A real unscoped findById WOULD find tenant B's doc by _id alone — that is
  // exactly the leak under test — so the mock mirrors that, not a null.
  t.mock.method(VendorPricelist, 'findById', () => chainDoc(plB));

  const res = await dispatch(getRouter(), {
    method: 'GET',
    url: `/${String(plB._id)}`,
    params: { id: String(plB._id) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
  });

  assert.strictEqual(res.statusCode, 404, 'cross-tenant access must 404');
  assert.strictEqual(res.body?.success, false);
});

test('own-tenant get-one returns the document', async (t) => {
  bypassAuth(t);
  const VendorPricelist = require('../models/VendorPricelist');
  const tenantA = oid();
  const plA = { _id: oid(), tenant: tenantA, name: 'Mine', items: [] };

  t.mock.method(VendorPricelist, 'findOne', (filter) =>
    String(filter.tenant) === String(tenantA) ? chainDoc(plA) : chainDoc(null)
  );

  const res = await dispatch(getRouter(), {
    method: 'GET',
    url: `/${String(plA._id)}`,
    params: { id: String(plA._id) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
  });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.data.name, 'Mine');
});

// ── Update allowlist ─────────────────────────────────────────────────────────

test('update ignores client-sent tenant, createdBy and lastSyncedAt', async (t) => {
  bypassAuth(t);
  const VendorPricelist = require('../models/VendorPricelist');
  const tenantA = oid();
  const ownerId = oid();
  const plA = {
    _id: oid(),
    tenant: tenantA,
    createdBy: ownerId,
    name: 'Old',
    vendorName: 'V',
    currency: 'NGN',
    isActive: true,
    discountPercent: 0,
    items: [],
    lastSyncedAt: undefined,
    saveCount: 0,
    save: async function () { this.saveCount++; return this; },
  };

  t.mock.method(VendorPricelist, 'findOne', (filter) =>
    String(filter.tenant) === String(tenantA) ? plA : null
  );

  const res = await dispatch(getRouter(), {
    method: 'PATCH',
    url: `/${String(plA._id)}`,
    params: { id: String(plA._id) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA, _id: oid() },
    body: {
      name: 'New',
      tenant: String(oid()),
      createdBy: String(oid()),
      lastSyncedAt: '2020-01-01T00:00:00Z',
    },
  });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(plA.name, 'New', 'whitelisted field applied');
  assert.strictEqual(String(plA.tenant), String(tenantA), 'tenant immutable');
  assert.strictEqual(String(plA.createdBy), String(ownerId), 'createdBy immutable');
  assert.strictEqual(plA.lastSyncedAt, undefined, 'server-owned sync fields rejected');
});

// ── Item validation ──────────────────────────────────────────────────────────

test('create rejects items without subProductId with a 400', async (t) => {
  bypassAuth(t);
  const VendorPricelist = require('../models/VendorPricelist');
  t.mock.method(VendorPricelist, 'create', async () => { throw new Error('must not be reached'); });

  const res = await dispatch(getRouter(), {
    method: 'POST',
    url: '/',
    tenant: { _id: oid() },
    user: { role: 'tenant_admin', tenant: oid(), _id: oid() },
    body: { name: 'L', vendorName: 'V', items: [{ subProductId: '', unitPrice: 10 }] },
  });

  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body.message, /linked product/i);
});

test('create rejects items with unitPrice <= 0 with a 400', async (t) => {
  bypassAuth(t);
  const VendorPricelist = require('../models/VendorPricelist');
  const subId = oid();
  t.mock.method(VendorPricelist, 'create', async () => { throw new Error('must not be reached'); });

  const res = await dispatch(getRouter(), {
    method: 'POST',
    url: '/',
    tenant: { _id: oid() },
    user: { role: 'tenant_admin', tenant: oid(), _id: oid() },
    body: { name: 'L', vendorName: 'V', items: [{ subProductId: String(subId), unitPrice: 0 }] },
  });

  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body.message, /unit price/i);
});

test('create happy path sets tenant + createdBy and returns 201', async (t) => {
  bypassAuth(t);
  const VendorPricelist = require('../models/VendorPricelist');
  const tenantId = oid();
  const userId = oid();
  let captured = null;
  t.mock.method(VendorPricelist, 'create', async (doc) => {
    captured = doc;
    return { _id: oid(), ...doc };
  });

  const res = await dispatch(getRouter(), {
    method: 'POST',
    url: '/',
    tenant: { _id: tenantId },
    user: { role: 'tenant_admin', tenant: tenantId, _id: userId },
    body: {
      name: 'Q3',
      vendorName: 'Spirits Ltd',
      vendor: String(oid()),
      items: [{ subProductId: String(oid()), unitPrice: 500 }],
    },
  });

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(String(captured.tenant), String(tenantId));
  assert.strictEqual(String(captured.createdBy), String(userId));
});

test('update rejects invalid items with a 400', async (t) => {
  bypassAuth(t);
  const VendorPricelist = require('../models/VendorPricelist');
  const tenantA = oid();
  const plA = {
    _id: oid(), tenant: tenantA, name: 'Old', items: [],
    save: async function () { return this; },
  };
  t.mock.method(VendorPricelist, 'findOne', (filter) =>
    String(filter.tenant) === String(tenantA) ? plA : null
  );

  const res = await dispatch(getRouter(), {
    method: 'PATCH',
    url: `/${String(plA._id)}`,
    params: { id: String(plA._id) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA, _id: oid() },
    body: { items: [{ subProductId: String(oid()), unitPrice: -5 }] },
  });

  assert.strictEqual(res.statusCode, 400);
});

// ── Matrix uses the corrected window filter ──────────────────────────────────

test('matrix query embeds $and date-window (start-only lists are not excluded)', async (t) => {
  bypassAuth(t);
  const VendorPricelist = require('../models/VendorPricelist');
  const tenantA = oid();
  let seenFilter = null;
  t.mock.method(VendorPricelist, 'find', (filter) => {
    seenFilter = filter;
    return chainDoc([]);
  });

  await dispatch(getRouter(), {
    method: 'GET',
    url: '/matrix',
    params: {},
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
  });

  assert.ok(seenFilter, 'find was called');
  assert.strictEqual(String(seenFilter.tenant), String(tenantA));
  assert.ok(Array.isArray(seenFilter.$and), 'window expressed as $and (from activeWindowFilter)');
});
