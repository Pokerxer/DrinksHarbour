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

  // The get-one handler builds a query chain: findOne/findById → .populate()
  // (now chained twice since bundleTargetSubProduct population landed) → .lean().
  // Mongoose queries are thenable, so the mock must survive repeated .populate()
  // and resolve on await.
  const chainable = (result) => {
    const c = {
      populate: () => c,
      lean: async () => result,
    };
    const p = Promise.resolve(result);
    c.then = p.then.bind(p);
    c.catch = p.catch.bind(p);
    return c;
  };
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
  // Sequence is server-derived (pricelistPriority.service re-ranks on every
  // mutation), so the client's 999 cannot survive. The only rule on this
  // pricelist ranks first; the stored 2 was a gap the re-rank closes.
  assert.notStrictEqual(rule.sequence, 999, 'client-sent sequence must be ignored');
  assert.strictEqual(rule.sequence, 0, 'the only rule ranks first');
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

// ── Cross-field validation (Commit 2) ────────────────────────────────────────
// The server must reject rules whose required field for their priceType is
// missing/zero, with a structured 400 + field-keyed errors object — not trust
// the client and persist a no-op rule.

function setupAddRuleMock(t, tenantA, plA) {
  const Pricelist = require('../models/Pricelist');
  t.mock.method(Pricelist, 'findOne', async (filter) => {
    if (filter.tenant && String(filter.tenant) !== String(tenantA)) return null;
    return plA;
  });
}

test('add-rule 400s when fixed priceType has no fixedPrice', async (t) => {
  bypassAuth(t);
  const tenantA = oid();
  const plA = makePricelistDoc({ _id: oid(), tenant: tenantA, rules: [] });
  setupAddRuleMock(t, tenantA, plA);

  const res = await dispatch(getRouter(), {
    method: 'POST',
    url: `/${String(plA._id)}/rules`,
    params: { id: String(plA._id) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
    body: { priceType: 'fixed', fixedPrice: 0 },
  });

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body?.success, false);
  assert.ok(res.body?.errors?.fixedPrice, 'must name the missing field');
  assert.strictEqual(plA.rules.length, 0, 'no rule pushed');
});

test('add-rule 400s when formula priceType has no markupPercentage', async (t) => {
  bypassAuth(t);
  const tenantA = oid();
  const plA = makePricelistDoc({ _id: oid(), tenant: tenantA, rules: [] });
  setupAddRuleMock(t, tenantA, plA);

  const res = await dispatch(getRouter(), {
    method: 'POST',
    url: `/${String(plA._id)}/rules`,
    params: { id: String(plA._id) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
    body: { priceType: 'formula', markupPercentage: 0 },
  });

  assert.strictEqual(res.statusCode, 400);
  assert.ok(res.body?.errors?.markupPercentage);
});

test('add-rule 400s when discount priceType (percentage) has no discountPercentage', async (t) => {
  bypassAuth(t);
  const tenantA = oid();
  const plA = makePricelistDoc({ _id: oid(), tenant: tenantA, rules: [] });
  setupAddRuleMock(t, tenantA, plA);

  const res = await dispatch(getRouter(), {
    method: 'POST',
    url: `/${String(plA._id)}/rules`,
    params: { id: String(plA._id) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
    body: { priceType: 'discount', discountType: 'percentage', discountPercentage: 0 },
  });

  assert.strictEqual(res.statusCode, 400);
  assert.ok(res.body?.errors?.discountPercentage);
});

test('add-rule 400s when flash_sale priceType has no flashSalePercentage', async (t) => {
  bypassAuth(t);
  const tenantA = oid();
  const plA = makePricelistDoc({ _id: oid(), tenant: tenantA, rules: [] });
  setupAddRuleMock(t, tenantA, plA);

  const res = await dispatch(getRouter(), {
    method: 'POST',
    url: `/${String(plA._id)}/rules`,
    params: { id: String(plA._id) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
    body: { priceType: 'flash_sale', flashSalePercentage: 0 },
  });

  assert.strictEqual(res.statusCode, 400);
  assert.ok(res.body?.errors?.flashSalePercentage);
});

test('add-rule 400s when bundle priceType has bundleDiscount but bundleDiscountType is no_discount', async (t) => {
  bypassAuth(t);
  const tenantA = oid();
  const plA = makePricelistDoc({ _id: oid(), tenant: tenantA, rules: [] });
  setupAddRuleMock(t, tenantA, plA);

  // no_discount with a nonzero bundleDiscount is contradictory — server must
  // zero it, not persist the contradiction.
  const res = await dispatch(getRouter(), {
    method: 'POST',
    url: `/${String(plA._id)}/rules`,
    params: { id: String(plA._id) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
    body: { priceType: 'bundle', bundleQuantity: 2, bundleDiscount: 50, bundleDiscountType: 'no_discount' },
  });

  // no_discount is valid — the rule is accepted but bundleDiscount is zeroed
  assert.strictEqual(res.statusCode, 201);
  const added = plA.rules[plA.rules.length - 1];
  assert.strictEqual(added.bundleDiscount, 0, 'no_discount must zero bundleDiscount');
});

test('add-rule 400s when endDate is before startDate', async (t) => {
  bypassAuth(t);
  const tenantA = oid();
  const plA = makePricelistDoc({ _id: oid(), tenant: tenantA, rules: [] });
  setupAddRuleMock(t, tenantA, plA);

  const res = await dispatch(getRouter(), {
    method: 'POST',
    url: `/${String(plA._id)}/rules`,
    params: { id: String(plA._id) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
    body: {
      priceType: 'discount', discountType: 'percentage', discountPercentage: 10,
      startDate: '2026-07-10', endDate: '2026-07-01',
    },
  });

  assert.strictEqual(res.statusCode, 400);
  assert.ok(res.body?.errors?.endDate);
});

test('add-rule 400s on garbage numeric input (not silently zeroed)', async (t) => {
  bypassAuth(t);
  const tenantA = oid();
  const plA = makePricelistDoc({ _id: oid(), tenant: tenantA, rules: [] });
  setupAddRuleMock(t, tenantA, plA);

  const res = await dispatch(getRouter(), {
    method: 'POST',
    url: `/${String(plA._id)}/rules`,
    params: { id: String(plA._id) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
    body: { priceType: 'fixed', fixedPrice: '500abc' },
  });

  assert.strictEqual(res.statusCode, 400, 'garbage numeric must 400, not silently become 0');
  assert.ok(res.body?.success === false);
});

test('GET list computes ruleCount and strips the full rules payload', async (t) => {
  bypassAuth(t);
  const Pricelist = require('../models/Pricelist');
  const tenantA = oid();
  const row = {
    _id: oid(),
    name: 'Trade Q3',
    tenant: tenantA,
    currency: 'NGN',
    createdAt: new Date(Date.now() - 1000),
  };

  let pipelineSeen = null;
  t.mock.method(Pricelist, 'aggregate', (pipeline) => {
    pipelineSeen = pipeline;
    const p = Promise.resolve([row]);
    return { then: p.then.bind(p), catch: p.catch.bind(p) };
  });
  t.mock.method(Pricelist, 'countDocuments', async () => 1);

  const res = await dispatch(getRouter(), {
    method: 'GET',
    url: '/',
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
  });

  assert.strictEqual(res.statusCode, 200);
  const list = res.body?.data?.pricelists;
  assert.ok(Array.isArray(list), 'list must be an array');
  assert.strictEqual(list.length, 1);

  // The list must expose a lightweight ruleCount (so pickers can show "3 rules")
  // without shipping the full rules payload that the print modal then has to
  // apply. Assert the pipeline the route builds, not MongoDB's own transform.
  assert.ok(
    pipelineSeen.some((s) => s.$addFields && Object.prototype.hasOwnProperty.call(s.$addFields, 'ruleCount')),
    'pipeline must add a computed ruleCount'
  );
  assert.ok(
    pipelineSeen.some((s) => s.$project && s.$project.rules === 0),
    'pipeline must strip the full rules payload'
  );
});
// ── Rule priority: sequence is the order, the stored array is not ────────────
// Both pricing engines (findMatchingPriceRules here, findMatchingPricelistRules
// on the client) stack rules by ascending `sequence`. Two gaps let the stored
// array order drift away from it, and the panel rendered the stored order:
//   - add-rule assigned `sequence = rules.length`, which duplicates a live
//     sequence on any pricelist that has ever had a rule deleted;
//   - the reorder endpoint rewrites `sequence` without touching the array, so
//     GET /:id replayed the pre-move order and the move looked like a no-op.

test('add-rule sequences above every existing rule, not at rules.length', async (t) => {
  bypassAuth(t);
  const Pricelist = require('../models/Pricelist');
  const tenantA = oid();
  // Exactly the shape left behind by deleting the sequence-0 rule of a
  // three-rule pricelist: two rules remain, holding sequences 1 and 2.
  const plA = makePricelistDoc({
    _id: oid(),
    tenant: tenantA,
    rules: [
      { _id: oid(), priceType: 'fixed', fixedPrice: 100, sequence: 1 },
      { _id: oid(), priceType: 'discount', discountPercentage: 5, sequence: 2 },
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
    body: { priceType: 'flash_sale', flashSalePercentage: 20 },
  });

  assert.strictEqual(res.statusCode, 201);
  // Priority is now derived (pricelistPriority.service), so the exact number a
  // new rule lands on is the ranking's business. What must never regress is the
  // invariant the old `sequence = rules.length` broke: after a delete had left
  // survivors holding 1 and 2, the next add also got 2 and tied with a live rule.
  const seqs = plA.rules.map((r) => r.sequence).sort((a, b) => a - b);
  assert.strictEqual(new Set(seqs).size, seqs.length, 'sequences must stay unique');
  assert.deepStrictEqual(seqs, [0, 1, 2], 'and stay contiguous from 0');
});

test('add-rule on an empty pricelist starts at sequence 0', async (t) => {
  bypassAuth(t);
  const Pricelist = require('../models/Pricelist');
  const tenantA = oid();
  const plA = makePricelistDoc({ _id: oid(), tenant: tenantA, rules: [] });

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
    body: { priceType: 'fixed', fixedPrice: 500 },
  });

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(plA.rules[0].sequence, 0, 'first rule must be sequence 0');
});

test('get-one returns rules in ascending sequence order, not stored order', async (t) => {
  bypassAuth(t);
  const Pricelist = require('../models/Pricelist');
  const tenantA = oid();
  const [idA, idB, idC] = [oid(), oid(), oid()];
  // What the reorder endpoint leaves behind: sequences rewritten in place,
  // array order untouched.
  const stored = {
    _id: oid(),
    tenant: tenantA,
    name: 'Trade Q3',
    rules: [
      { _id: idA, priceType: 'fixed', sequence: 2 },
      { _id: idB, priceType: 'discount', sequence: 0 },
      { _id: idC, priceType: 'flash_sale', sequence: 1 },
    ],
  };

  const chainable = (result) => {
    const c = { populate: () => c, lean: async () => result };
    const p = Promise.resolve(result);
    c.then = p.then.bind(p);
    c.catch = p.catch.bind(p);
    return c;
  };
  t.mock.method(Pricelist, 'findOne', () => chainable(stored));

  const res = await dispatch(getRouter(), {
    method: 'GET',
    url: `/${String(stored._id)}`,
    params: { id: String(stored._id) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
  });

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(
    res.body.data.rules.map((r) => String(r._id)),
    [String(idB), String(idC), String(idA)],
    'rules must arrive in the order they are actually applied'
  );
});

test('reorder assigns sequences from orderedIds and leaves unlisted rules alone', async (t) => {
  bypassAuth(t);
  const Pricelist = require('../models/Pricelist');
  const tenantA = oid();
  const [idA, idB, idC] = [oid(), oid(), oid()];
  const plA = makePricelistDoc({
    _id: oid(),
    tenant: tenantA,
    rules: [
      { _id: idA, priceType: 'fixed', sequence: 0 },
      { _id: idB, priceType: 'discount', sequence: 1 },
      { _id: idC, priceType: 'flash_sale', sequence: 2 },
    ],
  });

  t.mock.method(Pricelist, 'findOne', async (filter) => {
    if (filter.tenant && String(filter.tenant) !== String(tenantA)) return null;
    return plA;
  });

  const res = await dispatch(getRouter(), {
    method: 'PATCH',
    url: `/${String(plA._id)}/rules/reorder`,
    params: { id: String(plA._id) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
    body: { orderedIds: [String(idC), String(idA), String(idB)] },
  });

  assert.strictEqual(res.statusCode, 200);
  const byId = (id) => plA.rules.find((r) => String(r._id) === String(id));
  assert.strictEqual(byId(idC).sequence, 0);
  assert.strictEqual(byId(idA).sequence, 1);
  assert.strictEqual(byId(idB).sequence, 2);
  assert.strictEqual(plA.saveCount, 1, 'one atomic save, not one per rule');
});

// ── Automatic priority: every rule mutation re-ranks the list ────────────────
// `sequence` is derived, not dragged (see pricelistPriority.service). It must be
// reassigned on add, update and delete: a rule's priceType/minQuantity/
// subProduct decide where it belongs, and deleting one leaves a gap.

test('add-rule re-ranks: a base-setter added last still sequences first', async (t) => {
  bypassAuth(t);
  const Pricelist = require('../models/Pricelist');
  const tenantA = oid();
  const discountId = oid();
  const plA = makePricelistDoc({
    _id: oid(),
    tenant: tenantA,
    rules: [{ _id: discountId, priceType: 'discount', discountPercentage: 10, sequence: 0 }],
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
    body: { priceType: 'fixed', fixedPrice: 4500 },
  });

  assert.strictEqual(res.statusCode, 201);
  const byId = (id) => plA.rules.find((r) => String(r._id) === String(id));
  const fixed = plA.rules.find((r) => r.priceType === 'fixed');
  assert.strictEqual(
    fixed.sequence, 0,
    'a fixed rule assigns result= and would discard the discount if it ran second'
  );
  assert.strictEqual(byId(discountId).sequence, 1);
});

test('update-rule re-ranks when priceType changes discount → fixed', async (t) => {
  bypassAuth(t);
  const Pricelist = require('../models/Pricelist');
  const tenantA = oid();
  const [aId, bId] = [oid(), oid()];
  const plA = makePricelistDoc({
    _id: oid(),
    tenant: tenantA,
    rules: [
      { _id: aId, priceType: 'discount', discountPercentage: 5, sequence: 0 },
      { _id: bId, priceType: 'discount', discountPercentage: 10, sequence: 1 },
    ],
  });

  t.mock.method(Pricelist, 'findOne', async (filter) => {
    if (filter.tenant && String(filter.tenant) !== String(tenantA)) return null;
    return plA;
  });

  const res = await dispatch(getRouter(), {
    method: 'PATCH',
    url: `/${String(plA._id)}/rules/${String(bId)}`,
    params: { id: String(plA._id), ruleId: String(bId) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
    body: { priceType: 'fixed', fixedPrice: 9000 },
  });

  assert.strictEqual(res.statusCode, 200);
  const byId = (id) => plA.rules.find((r) => String(r._id) === String(id));
  assert.strictEqual(byId(bId).sequence, 0, 'now a base-setter, so it must run first');
  assert.strictEqual(byId(aId).sequence, 1);
});

test('delete-rule re-ranks, leaving no gap in the sequence', async (t) => {
  bypassAuth(t);
  const Pricelist = require('../models/Pricelist');
  const SubProductModel = require('../models/SubProduct');
  const tenantA = oid();
  const [aId, bId, cId] = [oid(), oid(), oid()];
  const plA = makePricelistDoc({
    _id: oid(),
    tenant: tenantA,
    rules: [
      { _id: aId, priceType: 'formula', markupPercentage: 50, sequence: 0 },
      { _id: bId, priceType: 'discount', discountPercentage: 5, sequence: 1 },
      { _id: cId, priceType: 'bundle', bundleQuantity: 6, sequence: 2 },
    ],
  });

  t.mock.method(Pricelist, 'findOne', async (filter) => {
    if (filter.tenant && String(filter.tenant) !== String(tenantA)) return null;
    return plA;
  });
  t.mock.method(SubProductModel, 'updateMany', async () => ({ modifiedCount: 0 }));

  const res = await dispatch(getRouter(), {
    method: 'DELETE',
    url: `/${String(plA._id)}/rules/${String(aId)}`,
    params: { id: String(plA._id), ruleId: String(aId) },
    tenant: { _id: tenantA },
    user: { role: 'tenant_admin', tenant: tenantA },
  });

  assert.strictEqual(res.statusCode, 200);
  const seqs = plA.rules.map((r) => r.sequence).sort((x, y) => x - y);
  assert.deepStrictEqual(seqs, [0, 1], 'survivors must renumber contiguously');
});
