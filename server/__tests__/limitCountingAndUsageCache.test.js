// Two rules that only exist because the same number is read in two places.
//
//   1. THE COUNTING RULE (README §5). Every row counts against a sold limit —
//      archived SKUs, inactive warehouses, deactivated shops — EXCEPT staff:
//      a tenant whose staff member was DELETED (status 'deleted') gets the
//      seat back (README §5, "staff seats", the 2026-09-06 decision). The four
//      gates used to disagree: `checkShopLimit` filtered on `active !== false`
//      and the other three did not, so the same tenant could free a shop slot
//      by toggling a flag but not a warehouse slot. The way to free any other
//      slot is to DELETE the row.
//
//   2. THE USAGE CACHE (README §5b). `GET /api/erm/status` is fetched by the
//      admin's root layout on EVERY page render, and its three countDocuments
//      were measured at ~125 ms per render against Atlas. They are cached — but
//      the LIMIT GATES MUST NOT READ THAT CACHE. Enforcing a quota against a
//      count that may be seconds old is how a tenant gets one more SKU than
//      they bought.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.PAYSTACK_PLAN_EXTRA_SHOP = 'PLN_addon_shop';
process.env.PAYSTACK_PLAN_EXTRA_WAREHOUSE = 'PLN_addon_warehouse';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const { countedShops, addOnAllowance } = require('../config/erm-plans');
const { checkShopLimit, checkSkuLimit, checkStaffLimit } = require('../middleware/plan.middleware');
const {
  getUsage,
  countUsage,
  invalidateUsage,
  clearUsageCache,
  usageCacheSize,
  USAGE_TTL_MS,
} = require('../services/ermUsage.service');

const SubProduct = require('../models/SubProduct');
const User = require('../models/User');
const Warehouse = require('../models/Warehouse');

const TENANT_ID = new mongoose.Types.ObjectId();

/** Run an async middleware and report whether it called next() or threw. */
async function run(mw, req) {
  let passed = false;
  let error = null;
  await mw(req, {}, (err) => {
    if (err) error = err;
    else passed = true;
  });
  return { passed, error };
}

/** Stub the three counted collections; restore afterwards. */
async function withCounts({ skus = 0, staff = 0, warehouses = 0 }, fn) {
  const originals = [
    [SubProduct, SubProduct.countDocuments],
    [User, User.countDocuments],
    [Warehouse, Warehouse.countDocuments],
  ];
  SubProduct.countDocuments = async () => skus;
  User.countDocuments = async () => staff;
  Warehouse.countDocuments = async () => warehouses;
  try {
    return await fn();
  } finally {
    for (const [model, original] of originals) model.countDocuments = original;
  }
}

// ─── 1. The counting rule ───────────────────────────────────────────────────

test('countedShops counts deactivated shops', () => {
  const tenant = {
    plan: 'pro',
    posSettings: {
      shops: [
        { name: 'Main', active: true },
        { name: 'Closed for refit', active: false },
      ],
    },
  };
  assert.strictEqual(countedShops(tenant), 3);
});

test('unused included capacity never counts as a created POS', () => {
  assert.strictEqual(countedShops({}), 1);
  assert.strictEqual(countedShops({ plan: 'growth' }), 1);
  assert.strictEqual(countedShops({ plan: 'pro' }), 1);
  assert.strictEqual(countedShops({ plan: 'enterprise' }), 1);
  assert.strictEqual(countedShops({ plan: 'venue' }), 1);
  assert.strictEqual(countedShops(undefined), 1);
});

test('unrelated root-level shops are not POS terminals', () => {
  assert.strictEqual(countedShops({ shops: [{ name: 'A' }, { name: 'B' }] }), 1);
});

test('deactivating a shop does not free the slot', async () => {
  // free_trial has addOnsAllowed: false, so the allowance is its included unit.
  // Under the OLD filter this tenant counted zero shops and the gate passed —
  // a plan limit that a boolean toggle could defeat.
  const tenant = {
    _id: TENANT_ID,
    plan: 'free_trial',
    posSettings: { shops: [{ name: 'Main', active: true }, { name: 'Retired', active: false }] },
  };
  assert.strictEqual(addOnAllowance(tenant, 'extra_shop'), 1);

  const { passed, error } = await run(checkShopLimit, { tenant, user: { role: 'tenant_admin' } });
  assert.strictEqual(passed, false);
  assert.strictEqual(error.code, 'ADD_ON_LIMIT_REACHED');
  assert.strictEqual(error.details.used, 3, 'the inactive shop still occupies the slot');
});

test('the shop count is read from countedShops in both places, not re-filtered', () => {
  // The gate enforces this number and GET /api/erm/status reports it. When they
  // were two hand-written expressions they disagreed, and the billing screen
  // offered a slot the middleware refused. This fails if either grows its own
  // copy of the filter back.
  const files = [
    path.join(__dirname, '..', 'middleware', 'plan.middleware.js'),
    path.join(__dirname, '..', 'controllers', 'erm.controller.js'),
  ];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(
      src.includes('countedShops('),
      `${path.basename(file)} must count shops through countedShops`
    );
    assert.ok(
      !/shops\s*\|\|\s*\[\]\)\s*\.filter/.test(src),
      `${path.basename(file)} must not re-filter the shops array itself`
    );
  }
});

// ─── 2. The usage cache ─────────────────────────────────────────────────────

test('a second read inside the TTL does not hit the database again', async () => {
  clearUsageCache();
  let calls = 0;
  await withCounts({ skus: 7, staff: 2, warehouses: 1 }, async () => {
    const countingSub = SubProduct.countDocuments;
    SubProduct.countDocuments = async (...args) => { calls += 1; return countingSub(...args); };

    const first = await getUsage(TENANT_ID);
    const second = await getUsage(TENANT_ID);

    assert.deepStrictEqual(first, { skus: 7, staff: 2, warehouses: 1 });
    assert.deepStrictEqual(second, first);
    assert.strictEqual(calls, 1, 'the second read came from the cache');
  });
  clearUsageCache();
});

test('the entry expires', async () => {
  clearUsageCache();
  await withCounts({ skus: 1, staff: 1, warehouses: 1 }, async () => {
    const t0 = 1_000_000;
    await getUsage(TENANT_ID, t0);
    assert.strictEqual(usageCacheSize(), 1);
  });
  // Same tenant, past the TTL, with different underlying counts.
  await withCounts({ skus: 42, staff: 9, warehouses: 3 }, async () => {
    const fresh = await getUsage(TENANT_ID, 1_000_000 + USAGE_TTL_MS + 1);
    assert.deepStrictEqual(fresh, { skus: 42, staff: 9, warehouses: 3 });
  });
  clearUsageCache();
});

test('invalidateUsage drops just that tenant', async () => {
  clearUsageCache();
  const other = new mongoose.Types.ObjectId();
  await withCounts({ skus: 1, staff: 1, warehouses: 1 }, async () => {
    await getUsage(TENANT_ID);
    await getUsage(other);
    assert.strictEqual(usageCacheSize(), 2);
    invalidateUsage(TENANT_ID);
    assert.strictEqual(usageCacheSize(), 1);
  });
  clearUsageCache();
});

test('THE LIMIT GATE DOES NOT READ THE CACHE', async () => {
  // The whole safety property of §5b. Warm the cache with a low count, then
  // let the collection actually hold more than the plan allows. A gate reading
  // the cache would wave the request through.
  clearUsageCache();

  await withCounts({ skus: 0, staff: 0, warehouses: 0 }, async () => {
    await getUsage(TENANT_ID);
    assert.deepStrictEqual(await getUsage(TENANT_ID), { skus: 0, staff: 0, warehouses: 0 });
  });

  await withCounts({ skus: 100, staff: 0, warehouses: 0 }, async () => {
    // starter: skuLimit 100. At 100 used, one more is over.
    const tenant = { _id: TENANT_ID, plan: 'starter' };
    const { passed, error } = await run(checkSkuLimit, {
      tenant,
      user: { role: 'tenant_admin' },
      body: {},
    });
    assert.strictEqual(passed, false, 'the gate must see the live count, not the cached 0');
    assert.strictEqual(error.code, 'SKU_LIMIT_REACHED');
    assert.strictEqual(error.details.used, 100);
  });

  clearUsageCache();
});

test('running a limit gate invalidates the reported usage', async () => {
  // The gate stands in front of a door that is about to create a row, so the
  // meters are about to be wrong. Invalidating there — rather than from six
  // controllers — is what keeps them honest without a hook that drifts.
  clearUsageCache();
  await withCounts({ skus: 3, staff: 0, warehouses: 0 }, async () => {
    await getUsage(TENANT_ID);
    assert.strictEqual(usageCacheSize(), 1);

    await run(checkSkuLimit, {
      tenant: { _id: TENANT_ID, plan: 'starter' },
      user: { role: 'tenant_admin' },
      body: {},
    });
    assert.strictEqual(usageCacheSize(), 0, 'the gate dropped the stale entry');
  });
  clearUsageCache();
});

test('countUsage excludes deleted staff but counts every other row', async () => {
  // Pins the counting rule at the query, not just at the gate: a filter added
  // here would make the billing screen disagree with the middleware again.
  const filters = [];
  const originals = [
    [SubProduct, SubProduct.countDocuments],
    [User, User.countDocuments],
    [Warehouse, Warehouse.countDocuments],
  ];
  SubProduct.countDocuments = async (f) => { filters.push(f); return 0; };
  User.countDocuments = async (f) => { filters.push(f); return 0; };
  Warehouse.countDocuments = async (f) => { filters.push(f); return 0; };
  try {
    await countUsage(TENANT_ID);
  } finally {
    for (const [model, original] of originals) model.countDocuments = original;
  }

  assert.deepStrictEqual(filters[0], { tenant: TENANT_ID }, 'SKUs: no status filter');
  assert.deepStrictEqual(
    filters[1],
    {
      tenant: TENANT_ID,
      role: { $in: ['tenant_owner', 'tenant_admin', 'tenant_staff'] },
      status: { $ne: 'deleted' },
    },
    'staff: deleted rows no longer hold a seat'
  );
  assert.deepStrictEqual(filters[2], { tenant: TENANT_ID }, 'warehouses: no isActive filter');
});

test('checkStaffLimit lets a starter seat be reused once the incumbent is deleted', async () => {
  // The trap README §5 recorded: deactivate (inactive/suspended) a member and
  // the seat stays, but a DELETED staff member must not hold it forever.
  const run = async (count, given) => {
    const original = User.countDocuments;
    User.countDocuments = async (query) => {
      given(query);
      return count;
    };
    let passed = false;
    let error = null;
    try {
      await checkStaffLimit({ tenant: { _id: 't1', plan: 'starter' } }, {}, (err) => {
        if (err) error = err;
        else passed = true;
      });
    } finally {
      User.countDocuments = original;
    }
    return { passed, error };
  };

  const ok = await run(0, (q) =>
    assert.ok(q.status && q.status.$ne === 'deleted', 'must exclude deleted staff')
  );
  assert.strictEqual(ok.passed, true, 'deleted member must not consume the only seat');

  const full = await run(1, () => {});
  assert.strictEqual(full.passed, false, 'a live member fills the only seat');
  assert.strictEqual(full.error.code, 'STAFF_LIMIT_REACHED');
  assert.deepStrictEqual(full.error.details, { used: 1, limit: 1, currentPlan: 'starter' });
});

for (const [plan, warehouses, terminals] of [['growth', 1, 2], ['pro', 2, 2], ['enterprise', 3, 3], ['venue', 3, 5]]) {
  test(`${plan} allows creation up to its included POS capacity`, async () => {
    const tenant = { _id: TENANT_ID, plan, posSettings: { shops: Array.from({ length: terminals - 2 }, () => ({ active: true })) } };
    assert.equal(addOnAllowance(tenant, 'extra_warehouse'), warehouses);
    assert.equal(addOnAllowance(tenant, 'extra_shop'), terminals);
    assert.equal((await run(checkShopLimit, { tenant, user: { role: 'tenant_admin' } })).passed, true);
    tenant.posSettings.shops.push({ active: true });
    assert.equal((await run(checkShopLimit, { tenant, user: { role: 'tenant_admin' } })).passed, false);
  });
}

test('billing status reports actual Enterprise usage separately from included and paid capacity', async () => {
  clearUsageCache();
  const { getStatus } = require('../controllers/erm.controller');
  let body;
  await withCounts({ warehouses: 2 }, () => getStatus({
    user: { role: 'tenant_owner' }, tenant: {
      _id: TENANT_ID, plan: 'enterprise', subscriptionStatus: 'active',
      posSettings: { shops: [{ active: true }] },
      addOns: [{ type: 'extra_shop', quantity: 1 }],
    },
  }, { json(value) { body = value.data; } }));
  assert.deepEqual(body.usage.shops, { used: 2, limit: 4 });
  const pos = body.addOns.find(row => row.type === 'extra_shop');
  assert.equal(pos.included, 3);
  assert.equal(pos.purchased, 1);
  assert.equal(pos.allowance, 4);
});
