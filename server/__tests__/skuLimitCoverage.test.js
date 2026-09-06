// Every door that creates a SubProduct, and whether the SKU limit is behind it.
//
// `checkSkuLimit` was mounted on POST /api/subproducts and nowhere else, while
// three other routes created SubProducts with no gate at all. A limit with one
// guarded door and three unguarded ones is not a limit. Rules and the full
// audit: server/config/README-plan-entitlements.md §5a.
//
// The two subtleties this file exists to keep:
//
//   * A "room for one more?" check is WRONG on a bulk route. POST /bulk takes a
//     productIds[] array, so a tenant one SKU under their cap could create the
//     whole array. checkSkuLimitFor asks how many.
//   * The CSV import cannot be a middleware at all — it knows its row count but
//     not how many rows become NEW SubProducts. It gets a budget and spends it,
//     and reports what it could not create instead of stopping silently.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const { checkSkuLimitFor, checkSkuLimit } = require('../middleware/plan.middleware');
const SubProduct = require('../models/SubProduct');

/** Run a middleware and report whether it passed or what it threw. */
async function run(mw, req) {
  let passed = false;
  let error = null;
  await mw(req, {}, (err) => {
    if (err) error = err;
    else passed = true;
  });
  return { passed, error };
}

/** Swap SubProduct.countDocuments for a fixed count, restoring afterwards. */
async function withSkuCount(count, fn) {
  const original = SubProduct.countDocuments;
  SubProduct.countDocuments = async () => count;
  try {
    return await fn();
  } finally {
    SubProduct.countDocuments = original;
  }
}

const tenantOn = (plan) => ({ _id: new mongoose.Types.ObjectId(), plan });

test('the single-create gate still refuses at exactly the old boundary', async () => {
  // starter.skuLimit === 100. At 99 there is room for one; at 100 there is not.
  await withSkuCount(99, async () => {
    const { passed } = await run(checkSkuLimit, { body: {}, tenant: tenantOn('starter') });
    assert.strictEqual(passed, true);
  });
  await withSkuCount(100, async () => {
    const { passed, error } = await run(checkSkuLimit, { body: {}, tenant: tenantOn('starter') });
    assert.strictEqual(passed, false);
    assert.strictEqual(error.code, 'SKU_LIMIT_REACHED');
    assert.strictEqual(error.statusCode, 403);
  });
});

test('the bulk gate counts the array, not one', async () => {
  const gate = checkSkuLimitFor((req) =>
    Array.isArray(req.body?.productIds) ? req.body.productIds.length : 1
  );

  // 99 used on starter (limit 100): one more is fine, five hundred is not.
  await withSkuCount(99, async () => {
    const ok = await run(gate, { body: { productIds: ['a'] }, tenant: tenantOn('starter') });
    assert.strictEqual(ok.passed, true);

    const tooMany = await run(gate, {
      body: { productIds: Array.from({ length: 500 }, (_, i) => `p${i}`) },
      tenant: tenantOn('starter'),
    });
    assert.strictEqual(tooMany.passed, false, 'a bulk create must not slip through a one-more check');
    assert.strictEqual(tooMany.error.code, 'SKU_LIMIT_REACHED');
    assert.strictEqual(tooMany.error.details.requested, 500);
    assert.strictEqual(tooMany.error.details.used, 99);
    assert.strictEqual(tooMany.error.details.limit, 100);
  });
});

test('a bulk create that exactly fills the plan is allowed', async () => {
  const gate = checkSkuLimitFor((req) => req.body.productIds.length);
  await withSkuCount(90, async () => {
    const { passed } = await run(gate, {
      body: { productIds: Array.from({ length: 10 }, (_, i) => `p${i}`) },
      tenant: tenantOn('starter'),
    });
    assert.strictEqual(passed, true, '90 + 10 === the 100 limit, so it fits');
  });
});

test('unlimited plans and platform requests are never counted', async () => {
  const gate = checkSkuLimitFor(() => 10_000);

  // enterprise.skuLimit === Infinity
  const unlimited = await run(gate, { body: {}, tenant: tenantOn('enterprise') });
  assert.strictEqual(unlimited.passed, true);

  // No tenant at all — platform staff. countDocuments must not even be reached.
  const original = SubProduct.countDocuments;
  SubProduct.countDocuments = async () => {
    throw new Error('countDocuments must not run without a tenant');
  };
  try {
    const platform = await run(gate, { body: {}, tenant: null });
    assert.strictEqual(platform.passed, true);
  } finally {
    SubProduct.countDocuments = original;
  }
});

test('a missing or nonsense count is treated as one, never as zero', async () => {
  const gate = checkSkuLimitFor((req) => req.body.productIds?.length);
  await withSkuCount(100, async () => {
    // Were `undefined` to floor to 0, `100 + 0 > 100` is false and a tenant at
    // their cap would sail through on a malformed body.
    const { passed } = await run(gate, { body: {}, tenant: tenantOn('starter') });
    assert.strictEqual(passed, false);
  });
});

test('the three previously unguarded creation doors are mounted', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'subproduct.routes.js'),
    'utf8'
  );

  assert.match(
    source,
    /router\.post\(\s*'\/bulk',[\s\S]{0,400}?checkSkuLimitFor/,
    'POST /bulk must count its productIds against the SKU limit'
  );
  assert.match(
    source,
    /router\.post\('\/:id\/duplicate',[^)]*checkSkuLimit/,
    'POST /:id/duplicate creates a SubProduct and must be gated'
  );
});

test('the CSV import spends a budget rather than being ungated', () => {
  const controller = fs.readFileSync(
    path.join(__dirname, '..', 'controllers', 'subProductImport.controller.js'),
    'utf8'
  );
  assert.match(controller, /skuBudgetFor\(/, 'commitImport must resolve a SKU budget');
  assert.match(controller, /skuBudget/, 'and pass it to the import service');

  const service = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'subProductImport.service.js'),
    'utf8'
  );
  assert.match(service, /skippedOverLimit/, 'what the budget refused must be reported, not silent');
});

test('the whole purchases module is behind purchase_orders, not two routers of it', () => {
  // Growth and above on the pricing page. Gating purchaseOrder alone left
  // /api/vendors, /api/vendor-bills, /api/vendor-returns,
  // /api/vendor-pricelists and /api/reorder reachable by a Starter tenant.
  const MODULE_ROUTERS = [
    'purchaseOrder',
    'purchaseAgreement',
    'vendor',
    'vendorBill',
    'vendorReturn',
    'vendorPricelist',
    'reorder',
  ];

  for (const name of MODULE_ROUTERS) {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'routes', `${name}.routes.js`),
      'utf8'
    );
    assert.match(
      source,
      /requireCapability\('purchase_orders'\)/,
      `${name}.routes.js is part of the purchases module and must carry the gate`
    );
  }
});
