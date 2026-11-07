// server/__tests__/subproductCatalogueLink.test.js
//
// Tenant catalogue-creation guards (docs/audits/general-saas-evolution F1/F4):
//
// 1. Link-by-name must never adopt another tenant's catalogue identity. The
//    candidate query may only match (a) canonical approved supply,
//    (b) this tenant's own tenant-private identities, (c) the tenant's own
//    submissions. Any other pending row — even with the exact same name — must
//    be ignored, so the caller regains their own private identity instead of
//    silently pointing at a competitor's unreviewed record.
// 2. Link-by-ID keeps the legacy "approved only" rule for tenants and gains a
//    new permitted case: linking to one's OWN tenant-private product.
// 3. Under GENERAL_CATALOG_SCOPE_ENABLED=true, a tenant-created central Product
//    is tenant-private (with owningTenant provenance); flag off keeps the
//    legacy behavior.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const Brand = require('../models/Brand');
const service = require('../services/subproduct.service');

const oid = () => new mongoose.Types.ObjectId().toString();
const tenantId = oid();
const tenantRoles = { role: 'tenant_owner', _id: oid() };

const SENTINEL = new Error('halt-catalogue-test');

// Flag hygiene: capture the pre-test environment value rather than deleting —
// the file must leave whatever it found exactly as it found it (B13 finding).
const priorFlagValue = process.env.GENERAL_CATALOG_SCOPE_ENABLED;

function baseNewProductArgs() {
  return {
    createNewProduct: true,
    newProductData: { name: 'Adaeze Palm Wine', type: 'wine' },
    sizes: [],
    sellWithoutSizeVariants: true,
  };
}

// Runs createSubProductCore with Product/Brand mocked; Product.create throws
// SENTINEL so no deeper flow (SKU generation, stock rollups) is exercised.
// Query mocks preserve the real chain shape (.select().lean(), .lean()).
async function captureCreate(t, { flag = false } = {}) {
  if (flag) process.env.GENERAL_CATALOG_SCOPE_ENABLED = 'true';
  const captured = { findOneQueries: [], createPayloads: [], thrown: null };
  const queryChain = reject => ({
    select: () => ({ lean: async () => reject || null }),
    lean: async () => reject || null,
  });
  try {
    t.mock.method(Brand, 'findOne', () => queryChain(null));
    t.mock.method(Brand, 'create', async () => { throw SENTINEL; });
    t.mock.method(Product, 'findOne', query => {
      captured.findOneQueries.push(JSON.parse(JSON.stringify(query)));
      return queryChain(null);
    });
    t.mock.method(Product, 'create', payload => {
      captured.createPayloads.push(JSON.parse(JSON.stringify(payload)));
      return Promise.reject(SENTINEL);
    });
    try {
      await service.createSubProductCore(baseNewProductArgs(), tenantId, tenantRoles);
    } catch (error) {
      captured.thrown = error;
    }
  } finally {
    if (priorFlagValue === undefined) delete process.env.GENERAL_CATALOG_SCOPE_ENABLED;
    else process.env.GENERAL_CATALOG_SCOPE_ENABLED = priorFlagValue;
  }
  return captured;
}

test('link-by-name never matches another tenant pending or tenant-private rows', async t => {
  const captured = await captureCreate(t);
  assert.equal(captured.findOneQueries.length, 1, 'exactly one candidate lookup');
  assert.equal(captured.thrown, SENTINEL);
  const query = captured.findOneQueries[0];
  assert.ok(query.name, 'candidate lookup filters by name');
  assert.deepStrictEqual(
    JSON.stringify(query.$or),
    JSON.stringify([
      { status: 'approved', publicationScope: { $ne: 'tenant_private' } },
      { owningTenant: tenantId },
      { submittingTenant: tenantId },
    ]),
    JSON.stringify(query.$or)
  );
  assert.ok(!('status' in query), 'status cannot exclude own-pending candidates');
});

test('link-by-name submits new products as tenant-private when the scope flag is on', async t => {
  const captured = await captureCreate(t, { flag: true });
  assert.equal(captured.thrown, SENTINEL);
  const payload = captured.createPayloads[0];
  assert.equal(payload.publicationScope, 'tenant_private');
  assert.equal(String(payload.owningTenant), tenantId, 'owning tenant provenance is required');
  assert.equal(payload.status, 'pending');
});

test('link-by-name keeps the legacy behavior when the scope flag is off', async t => {
  const captured = await captureCreate(t);
  assert.equal(captured.thrown, SENTINEL);
  const payload = captured.createPayloads[0];
  assert.strictEqual(payload.publicationScope, undefined);
  assert.strictEqual(payload.status, 'pending');
  assert.equal(String(payload.submittingTenant || ''), tenantId, 'own-submission provenance is recorded');
});

test('tenant link-by-ID accepts approved canonical or OWN tenant-private product under the flag', async t => {
  process.env.GENERAL_CATALOG_SCOPE_ENABLED = 'true';
  let thrown = null;
  try {
    t.mock.method(Product, 'findOne', query => {
      const filter = JSON.parse(JSON.stringify(query));
      // Criteria must be TOP-LEVEL: $or cannot live under a status field
      // position (`{ status: { $or: ... } }` is rejected by mongod — this was
      // a real P0 caught by review 2026-11-02, so the test now pins the flat
      // shape and forbids the nesting).
      const clauses = Array.isArray(filter.$or) ? filter.$or : filter.status?.$or;
      assert.ok(
        Array.isArray(clauses) && clauses.some(
          clause => clause.publicationScope === 'tenant_private' && clause.owningTenant === tenantId
        ),
        JSON.stringify(filter)
      );
      assert.strictEqual(filter.status, undefined, 'no status key may wrap the tenant $or');
      return { lean: async () => { throw SENTINEL; } };
    });
    await service.createSubProductCore(
      { product: oid(), costPrice: 100, sizes: [], sellWithoutSizeVariants: true },
      tenantId,
      tenantRoles
    );
  } catch (error) {
    thrown = error;
  } finally {
    if (priorFlagValue === undefined) delete process.env.GENERAL_CATALOG_SCOPE_ENABLED;
    else process.env.GENERAL_CATALOG_SCOPE_ENABLED = priorFlagValue;
  }
  assert.equal(thrown, SENTINEL);
});

test('tenant link-by-ID still rejects anything beyond approved when the flag is off', async t => {
  let thrown = null;
  try {
    t.mock.method(Product, 'findOne', query => {
      assert.equal(query.status, 'approved');
      assert.strictEqual(query.$or, undefined);
      return { lean: async () => { throw SENTINEL; } };
    });
    await service.createSubProductCore(
      { product: oid(), costPrice: 100, sizes: [], sellWithoutSizeVariants: true },
      tenantId,
      tenantRoles
    );
  } catch (error) {
    thrown = error;
  }
  assert.equal(thrown, SENTINEL);
});
