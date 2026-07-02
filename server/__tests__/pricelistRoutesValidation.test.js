// server/__tests__/pricelistRoutesValidation.test.js
//
// Pricelist route hardening: tenant isolation (Workstream B) + updateRule
// field whitelist. The rule handlers used bare Pricelist.findById, letting a
// tenant_admin of tenant A read/mutate tenant B's pricelists by guessing an
// _id. And updateRule did Object.assign(rule, req.body), letting clients
// overwrite server-owned sequence/ruleCategory. These tests pin both gaps
// closed via the same mocking style as salesPriceLines.test.js.
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

// ── Helpers to build a Mongoose-like Pricelist document with a rules
// subdocument array that mimics .id() / .pull() / .save().
function makeRuleDoc(over = {}) {
  return {
    _id: over._id || oid(),
    subProduct: over.subProduct || undefined,
    appliedOn: over.appliedOn || '',
    priceType: over.priceType || 'discount',
    fixedPrice: over.fixedPrice ?? 0,
    markupPercentage: over.markupPercentage ?? 0,
    discountType: over.discountType || 'percentage',
    discountPercentage: over.discountPercentage ?? 0,
    discountAmount: over.discountAmount ?? 0,
    flashSalePercentage: over.flashSalePercentage ?? 0,
    flashSaleQty: over.flashSaleQty ?? 0,
    bundleName: over.bundleName || '',
    bundleQuantity: over.bundleQuantity ?? 2,
    bundleDiscount: over.bundleDiscount ?? 0,
    bundleDiscountType: over.bundleDiscountType || 'percentage',
    minQuantity: over.minQuantity ?? 0,
    startDate: over.startDate || undefined,
    endDate: over.endDate || undefined,
    sequence: over.sequence ?? 0,
    ruleCategory: over.ruleCategory ||
      (['fixed', 'formula'].includes(over.priceType || 'discount') ? 'permanent' : 'dynamic'),
  };
}

function makePricelistDoc(over = {}) {
  const rules = (over.rules || []).map(makeRuleDoc);
  const doc = {
    _id: over._id || oid(),
    name: over.name || 'Test Pricelist',
    tenant: over.tenant || undefined,
    rules,
    saveCount: 0,
    save: async function () { this.saveCount++; return this; },
  };
  doc.rules.id = function (id) {
    return rules.find((r) => String(r._id) === String(id)) || null;
  };
  doc.rules.pull = function (q) {
    const id = q._id || q;
    const i = rules.findIndex((r) => String(r._id) === String(id));
    if (i >= 0) rules.splice(i, 1);
  };
  const origPush = rules.push.bind(rules);
  rules.push = function (r) { origPush(r); return rules; };
  return doc;
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
        attachTenant: (r, s, n) => n(),
        tenantAdminOrSuperAdmin: (r, s, n) => n(),
        resolveTenantContext: (r, s, n) => n(),
        requireTenant: (r, s, n) => n(),
        superAdminOnly: (r, s, n) => n(),
        tenantAdminOnly: (r, s, n) => n(),
        tenantUserOnly: (r, s, n) => n(),
      };
    }
    return origLoad.apply(this, arguments);
  };
  t.after(() => { Module._load = origLoad; });
  // Clear cached router + auth so they re-require with our interception.
  delete require.cache[require.resolve('../routes/pricelist.routes')];
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

let router;
function getRouter() {
  if (!router) router = require('../routes/pricelist.routes');
  return router;
}

// ── Tenant isolation ────────────────────────────────────────────────────────

test('get-one pricelist is tenant-scoped: cross-tenant _id returns 404 (not the doc)', async (t) => {
  bypassAuth(t);
  const Pricelist = require('../models/Pricelist');
  const tenantA = oid();
  const tenantB = oid();
  const plB = makePricelistDoc({ _id: oid(), tenant: tenantB, name: 'B Secret' });

  // The get-one handler builds a query chain: findOne/findById → .populate().lean()
  // Mongoose findOne returns a Query (not a Promise) with .populate()/.lean().
  // For cross-tenant (tenantA), the scoped query resolves to null via lean().
  const chainable = (result) => ({
    populate: () => ({ lean: async () => result }),
    lean: async () => result,
  });
  t.mock.method(Pricelist, 'findOne', (filter) => {
    if (filter.tenant && String(filter.tenant) !== String(tenantB)) return chainable(null);
    return chainable(plB);
  });
  t.mock.method(Pricelist, 'findById', () => chainable(null));

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

test('add-rule is tenant-scoped: cross-tenant _id returns 404, rule not pushed', async (t) => {
  bypassAuth(t);
  const Pricelist = require('../models/Pricelist');
  const tenantA = oid();
  const tenantB = oid();
  const plB = makePricelistDoc({ _id: oid(), tenant: tenantB, rules: [] });

  t.mock.method(Pricelist, 'findOne', async (filter) => {
    if (filter.tenant && String(filter.tenant) !== String(tenantB)) return null;
    return plB;
  });
  t.mock.method(Pricelist, 'findById', async () => null);

  const res = await dispatch(getRouter(), {
    method: 'POST',
    url: `/${String(plB._id)}/rules`,
    params: { id: String(plB._id) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
    body: { priceType: 'fixed', fixedPrice: 500 },
  });

  assert.strictEqual(res.statusCode, 404, 'cross-tenant add-rule must 404');
  assert.strictEqual(plB.rules.length, 0, 'no rule must be pushed to B pricelist');
});

// ── updateRule field whitelist ──────────────────────────────────────────────

test('update-rule ignores client-sent sequence, ruleCategory, _id, __v', async (t) => {
  bypassAuth(t);
  const Pricelist = require('../models/Pricelist');
  const tenantA = oid();
  const ruleId = oid();
  const plA = makePricelistDoc({
    _id: oid(),
    tenant: tenantA,
    rules: [{ _id: ruleId, priceType: 'discount', discountPercentage: 10, sequence: 2, ruleCategory: 'dynamic' }],
  });

  t.mock.method(Pricelist, 'findOne', async (filter) => {
    if (filter.tenant && String(filter.tenant) !== String(tenantA)) return null;
    return plA;
  });

  const res = await dispatch(getRouter(), {
    method: 'PATCH',
    url: `/${String(plA._id)}/rules/${String(ruleId)}`,
    params: { id: String(plA._id), ruleId: String(ruleId) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
    body: {
      priceType: 'discount',
      discountPercentage: 15,
      sequence: 999,
      ruleCategory: 'permanent',
      _id: String(oid()),
      __v: 42,
    },
  });

  assert.strictEqual(res.statusCode, 200);
  const rule = plA.rules.id(ruleId);
  assert.strictEqual(rule.sequence, 2, 'client-sent sequence must be ignored');
  assert.strictEqual(rule.ruleCategory, 'dynamic', 'client-sent ruleCategory must be ignored');
  assert.strictEqual(rule.discountPercentage, 15, 'whitelisted field applied');
});

test('update-rule re-derives ruleCategory when priceType changes discount → fixed', async (t) => {
  bypassAuth(t);
  const Pricelist = require('../models/Pricelist');
  const tenantA = oid();
  const ruleId = oid();
  const plA = makePricelistDoc({
    _id: oid(),
    tenant: tenantA,
    rules: [{ _id: ruleId, priceType: 'discount', discountPercentage: 10, sequence: 1, ruleCategory: 'dynamic' }],
  });

  t.mock.method(Pricelist, 'findOne', async (filter) => {
    if (filter.tenant && String(filter.tenant) !== String(tenantA)) return null;
    return plA;
  });

  const res = await dispatch(getRouter(), {
    method: 'PATCH',
    url: `/${String(plA._id)}/rules/${String(ruleId)}`,
    params: { id: String(plA._id), ruleId: String(ruleId) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
    body: { priceType: 'fixed', fixedPrice: 8000 },
  });

  assert.strictEqual(res.statusCode, 200);
  const rule = plA.rules.id(ruleId);
  assert.strictEqual(rule.priceType, 'fixed');
  assert.strictEqual(rule.ruleCategory, 'permanent', 'ruleCategory re-derived from new priceType');
  assert.strictEqual(rule.fixedPrice, 8000);
});

test('add-rule ignores client-sent sequence (appends to end)', async (t) => {
  bypassAuth(t);
  const Pricelist = require('../models/Pricelist');
  const tenantA = oid();
  const plA = makePricelistDoc({
    _id: oid(),
    tenant: tenantA,
    rules: [
      { _id: oid(), priceType: 'fixed', fixedPrice: 100, sequence: 0 },
      { _id: oid(), priceType: 'discount', discountPercentage: 5, sequence: 1 },
    ],
  });

  t.mock.method(Pricelist, 'findOne', async (filter) => {
    if (filter.tenant && String(filter.tenant) !== String(tenantA)) return null;
    return plA;
  });

  const res = await dispatch(getRouter(), {
    method: 'POST',
    url: `/${String(plA._id)}/rules`,
    params: { id: String(plA._id) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
    body: { priceType: 'flash_sale', flashSalePercentage: 20, sequence: 999 },
  });

  assert.strictEqual(res.statusCode, 201);
  const added = plA.rules[plA.rules.length - 1];
  assert.strictEqual(added.sequence, 2, 'sequence must be rules.length (append), not client-sent 999');
  assert.strictEqual(added.priceType, 'flash_sale');
  assert.strictEqual(added.ruleCategory, 'dynamic');
});