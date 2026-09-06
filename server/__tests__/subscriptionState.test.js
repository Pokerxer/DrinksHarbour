// Subscription state: the data the plan-entitlement gates read.
//
// The gates themselves are pinned by planCapabilities.test.js. This file pins
// the four things that WRITE the state they read, each of which was either
// missing or wrong:
//
//   1. Tenant.addOns[] — sold on the pricing page, enforced by
//      checkWarehouseLimit/checkShopLimit, and written by NOTHING. Every tenant
//      was capped at one shop and one warehouse however much they paid.
//   2. Tenant.trialEndsAt — set only by the public vendor-registration form, so
//      a tenant created any other way was on a trial that never ended.
//   3. The Paystack webhook branching — one add-on's failed invoice must not
//      put the whole tenant into dunning, and one add-on's disable must not
//      cancel the tenant.
//   4. The webhook signature — hashed a RE-SERIALISED body, not the bytes
//      Paystack signed.
//
// Rules: server/config/README-plan-entitlements.md.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// erm-plans.js reads the plan codes at module load, so these must be set before
// anything requires it.
process.env.PAYSTACK_PLAN_EXTRA_SHOP = 'PLN_addon_shop';
process.env.PAYSTACK_PLAN_EXTRA_WAREHOUSE = 'PLN_addon_warehouse';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_subscription_state';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const {
  addOnQuantity,
  addOnAllowance,
  applyTrialWindow,
  getAddOnConfig,
  ADD_ON_TYPES,
  TRIAL_DAYS,
} = require('../config/erm-plans');
const { checkWarehouseLimit, checkShopLimit, checkStaffLimit } = require('../middleware/plan.middleware');

const DAY = 24 * 60 * 60 * 1000;

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

const tenantUser = { role: 'tenant_owner' };

// ─── Add-on arithmetic ───────────────────────────────────────────────────────

test('addOnQuantity sums the rows of one type and ignores the others', () => {
  const tenant = {
    plan: 'pro',
    addOns: [
      { type: 'extra_warehouse', quantity: 1 },
      { type: 'extra_warehouse', quantity: 2 },
      { type: 'extra_shop', quantity: 1 },
    ],
  };
  assert.strictEqual(addOnQuantity(tenant, 'extra_warehouse'), 3);
  assert.strictEqual(addOnQuantity(tenant, 'extra_shop'), 1);
});

test('a row with no quantity counts as one, not as zero', () => {
  // The Tenant schema defaults quantity to 1, but a row written by a webhook
  // that omitted it would otherwise be a purchase that grants nothing.
  const tenant = { plan: 'pro', addOns: [{ type: 'extra_shop' }] };
  assert.strictEqual(addOnQuantity(tenant, 'extra_shop'), 1);
});

test('a missing or non-array addOns reads as zero rather than throwing', () => {
  assert.strictEqual(addOnQuantity({ plan: 'pro' }, 'extra_shop'), 0);
  assert.strictEqual(addOnQuantity({ plan: 'pro', addOns: null }, 'extra_shop'), 0);
  assert.strictEqual(addOnQuantity(undefined, 'extra_shop'), 0);
});

test('allowance is one free unit plus what was bought', () => {
  const tenant = { plan: 'pro', addOns: [{ type: 'extra_warehouse', quantity: 2 }] };
  assert.strictEqual(addOnAllowance(tenant, 'extra_warehouse'), 3);
  assert.strictEqual(addOnAllowance(tenant, 'extra_shop'), 1);
});

test('plans that cannot buy add-ons get the free unit and nothing more', () => {
  // Even with rows on the document — a tenant who downgrades keeps the rows
  // until the subscriptions actually lapse, and must not keep the slots.
  for (const plan of ['free_trial', 'starter', 'growth']) {
    const tenant = { plan, addOns: [{ type: 'extra_warehouse', quantity: 5 }] };
    assert.strictEqual(addOnAllowance(tenant, 'extra_warehouse'), 1, plan);
  }
  for (const plan of ['pro', 'enterprise', 'venue', 'custom']) {
    const tenant = { plan, addOns: [{ type: 'extra_warehouse', quantity: 5 }] };
    assert.strictEqual(addOnAllowance(tenant, 'extra_warehouse'), 6, plan);
  }
});

// ─── The quota gates ─────────────────────────────────────────────────────────

const warehouseGate = (tenant, count) => {
  const Warehouse = require('../models/Warehouse');
  const original = Warehouse.countDocuments;
  Warehouse.countDocuments = async () => count;
  return run(checkWarehouseLimit, { user: tenantUser, tenant, method: 'POST' })
    .finally(() => { Warehouse.countDocuments = original; });
};

test('the free warehouse is allowed and the second is refused', async () => {
  const tenant = { _id: new mongoose.Types.ObjectId(), plan: 'pro', addOns: [] };

  const first = await warehouseGate(tenant, 0);
  assert.strictEqual(first.passed, true);

  const second = await warehouseGate(tenant, 1);
  assert.strictEqual(second.passed, false);
  assert.strictEqual(second.error.code, 'ADD_ON_LIMIT_REACHED');
  assert.strictEqual(second.error.details.allowance, 1);
});

test('buying an add-on actually raises the warehouse cap', async () => {
  // The whole point of the feature: before addOns[] was ever written, this
  // tenant was refused at one warehouse no matter what they had paid for.
  const tenant = {
    _id: new mongoose.Types.ObjectId(),
    plan: 'pro',
    addOns: [{ type: 'extra_warehouse', quantity: 1 }],
  };

  const second = await warehouseGate(tenant, 1);
  assert.strictEqual(second.passed, true, 'the paid-for second warehouse must be allowed');

  const third = await warehouseGate(tenant, 2);
  assert.strictEqual(third.passed, false);
  assert.strictEqual(third.error.details.allowance, 2);
});

test('an add-on of the wrong type does not raise the cap', async () => {
  const tenant = {
    _id: new mongoose.Types.ObjectId(),
    plan: 'pro',
    addOns: [{ type: 'extra_shop', quantity: 3 }],
  };
  const second = await warehouseGate(tenant, 1);
  assert.strictEqual(second.passed, false);
  assert.strictEqual(second.error.details.allowance, 1);
});

test('a starter tenant is told to upgrade, not to buy an add-on', async () => {
  const tenant = { _id: new mongoose.Types.ObjectId(), plan: 'starter', addOns: [] };
  const { error } = await warehouseGate(tenant, 1);
  assert.match(error.message, /upgrade to pro/i);
});

test('shops count only the active ones, and the add-on raises that cap too', async () => {
  const shops = (n, extra = []) => ({
    _id: new mongoose.Types.ObjectId(),
    plan: 'pro',
    addOns: extra,
    posSettings: { shops: Array.from({ length: n }, () => ({ active: true })) },
  });

  const one = await run(checkShopLimit, { user: tenantUser, tenant: shops(1), method: 'POST' });
  assert.strictEqual(one.passed, false, 'a second shop needs the add-on');

  const paid = await run(checkShopLimit, {
    user: tenantUser,
    tenant: shops(1, [{ type: 'extra_shop', quantity: 1 }]),
    method: 'POST',
  });
  assert.strictEqual(paid.passed, true);

  // A deactivated shop is not occupying a slot.
  const withClosed = shops(1);
  withClosed.posSettings.shops.push({ active: false });
  const closed = await run(checkShopLimit, { user: tenantUser, tenant: withClosed, method: 'POST' });
  assert.strictEqual(closed.passed, false, 'still one active shop, still at the cap');
});

test('platform staff are exempt from the add-on quotas', async () => {
  const { passed } = await run(checkShopLimit, {
    user: { role: 'super_admin' },
    tenant: { _id: new mongoose.Types.ObjectId(), plan: 'starter', posSettings: { shops: [{ active: true }] } },
    method: 'POST',
  });
  assert.strictEqual(passed, true);
});

// ─── Staff limit ─────────────────────────────────────────────────────────────

const staffGate = (tenant, count) => {
  const User = require('../models/User');
  const original = User.countDocuments;
  User.countDocuments = async () => count;
  return run(checkStaffLimit, { user: tenantUser, tenant, method: 'POST' })
    .finally(() => { User.countDocuments = original; });
};

test('staffLimit is enforced now that a route actually mounts the gate', async () => {
  // checkStaffLimit was exported and imported nowhere, so 1/1/3/10 was sold and
  // never applied.
  const starter = await staffGate({ _id: new mongoose.Types.ObjectId(), plan: 'starter' }, 1);
  assert.strictEqual(starter.passed, false);
  assert.match(starter.error.message, /staff limit reached/i);

  const growthUnder = await staffGate({ _id: new mongoose.Types.ObjectId(), plan: 'growth' }, 2);
  assert.strictEqual(growthUnder.passed, true);

  const growthAt = await staffGate({ _id: new mongoose.Types.ObjectId(), plan: 'growth' }, 3);
  assert.strictEqual(growthAt.passed, false);
});

test('an unlimited plan skips the count entirely', async () => {
  const { passed } = await staffGate({ _id: new mongoose.Types.ObjectId(), plan: 'enterprise' }, 9999);
  assert.strictEqual(passed, true);
});

// ─── Trial window ────────────────────────────────────────────────────────────

test('a new trialing tenant is given a trial end date', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const doc = { isNew: true, subscriptionStatus: 'trialing' };
  applyTrialWindow(doc, now);
  assert.strictEqual(
    doc.trialEndsAt.getTime(),
    now.getTime() + TRIAL_DAYS * DAY
  );
});

test('an explicit trial end date is left alone', () => {
  const chosen = new Date('2026-03-01T00:00:00.000Z');
  const doc = { isNew: true, subscriptionStatus: 'trialing', trialEndsAt: chosen };
  applyTrialWindow(doc, new Date('2026-01-01T00:00:00.000Z'));
  assert.strictEqual(doc.trialEndsAt, chosen);
});

test('a paying tenant and an existing document are not stamped', () => {
  const paying = { isNew: true, subscriptionStatus: 'active' };
  applyTrialWindow(paying, new Date());
  assert.strictEqual(paying.trialEndsAt, undefined);

  // Re-saving an old tenant must not restart its trial.
  const existing = { isNew: false, subscriptionStatus: 'trialing' };
  applyTrialWindow(existing, new Date());
  assert.strictEqual(existing.trialEndsAt, undefined);
});

test('an elapsed trial degrades to the free_trial set and loses writes', () => {
  const { resolveEntitlements } = require('../services/entitlements.service');
  const { getPlanCapabilities } = require('../config/erm-plans');

  const expired = resolveEntitlements({
    status: 'approved',
    plan: 'venue',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() - DAY),
  });
  assert.deepStrictEqual(expired.capabilities, [...getPlanCapabilities('free_trial')]);
  assert.strictEqual(expired.writesAllowed, false);
  assert.strictEqual(expired.reason, 'trial_expired');

  // The state that used to be universal: trialing with no end date at all.
  // It still means "not expired" — which is exactly why something had to
  // populate the field.
  const openEnded = resolveEntitlements({
    status: 'approved',
    plan: 'venue',
    subscriptionStatus: 'trialing',
  });
  assert.strictEqual(openEnded.writesAllowed, true);
});

// ─── Webhook branching ───────────────────────────────────────────────────────

const { addOnTypeForEvent } = require('../services/erm.service');

test('an add-on event is recognised by our metadata', () => {
  assert.strictEqual(
    addOnTypeForEvent({ metadata: { addOn: 'extra_shop' } }),
    'extra_shop'
  );
});

test('an add-on event is recognised by its plan code when metadata is gone', () => {
  // Paystack does not carry transaction metadata onto a renewal or a disable
  // months later; without this fallback those events would be read as the BASE
  // subscription's.
  assert.strictEqual(
    addOnTypeForEvent({ plan: { plan_code: 'PLN_addon_warehouse' } }),
    'extra_warehouse'
  );
});

test('a base-plan event is not mistaken for an add-on', () => {
  assert.strictEqual(addOnTypeForEvent({ plan: { plan_code: 'PLN_pro' } }), null);
  assert.strictEqual(addOnTypeForEvent({}), null);
  assert.strictEqual(addOnTypeForEvent({ metadata: { addOn: 'not_a_real_add_on' } }), null);
});

test('every add-on type has a config with a noun the error copy uses', () => {
  for (const type of ADD_ON_TYPES) {
    const cfg = getAddOnConfig(type);
    assert.ok(cfg, type);
    assert.ok(cfg.noun, `${type} needs a noun`);
    assert.ok(cfg.priceMonthly > 0, `${type} needs a price`);
  }
  assert.strictEqual(getAddOnConfig('nonsense'), null);
});

// ─── Webhook effects ─────────────────────────────────────────────────────────
//
// handleWebhookEvent only touches Mongoose, so the model's statics are stubbed
// rather than standing up a database. What is under test is the branching, and
// the branching is where the damage was.

const Tenant = require('../models/Tenant');
const { handleWebhookEvent } = require('../services/erm.service');
const billingNotifications = require('../services/billingNotifications.service');

/**
 * Stub the model statics AND the billing notices.
 *
 * The notices are stubbed for two reasons. Practically, the real
 * `notifyPaymentFailed` falls back to a `User.findOne` when the tenant has no
 * contactEmail, and with no database that buffers for ten seconds per test.
 * Substantively, what is under test here is the BRANCHING — and one of the
 * branches is "an add-on's failed invoice must not send a dunning email", which
 * can only be asserted by recording the calls.
 *
 * Returns both the writes and the notices so a test can assert on either.
 */
async function withStubbedTenant(doc, fn) {
  const originals = {
    findById: Tenant.findById,
    findOne: Tenant.findOne,
    findByIdAndUpdate: Tenant.findByIdAndUpdate,
  };
  const notifyOriginals = {
    notifyPaymentFailed: billingNotifications.notifyPaymentFailed,
    clearDunningNotices: billingNotifications.clearDunningNotices,
  };
  const updates = [];
  const notices = [];
  Tenant.findById = async () => doc;
  Tenant.findOne = async () => doc;
  Tenant.findByIdAndUpdate = async (_id, update) => { updates.push(update); return doc; };
  billingNotifications.notifyPaymentFailed = async (t) => {
    notices.push({ kind: 'payment_failed', subscriptionStatus: t.subscriptionStatus });
    return { sent: true };
  };
  billingNotifications.clearDunningNotices = async () => {
    notices.push({ kind: 'clear_dunning' });
  };
  try {
    await fn();
  } finally {
    Object.assign(Tenant, originals);
    Object.assign(billingNotifications, notifyOriginals);
  }
  // Non-enumerable: the existing tests deepStrictEqual the returned array
  // against a literal, and an extra enumerable own property would fail them.
  Object.defineProperty(updates, 'notices', { value: notices });
  return updates;
}

const TENANT_ID = new mongoose.Types.ObjectId();
const baseTenant = (addOns = []) => ({
  _id: TENANT_ID,
  plan: 'pro',
  subscriptionStatus: 'active',
  paystackSubscriptionCode: 'SUB_base',
  addOns,
});

test('an add-on subscription.create writes an addOns row, not a plan change', async () => {
  const doc = baseTenant();
  const updates = await withStubbedTenant(doc, () =>
    handleWebhookEvent('subscription.create', {
      metadata: { tenantId: TENANT_ID.toString(), addOn: 'extra_warehouse' },
      subscription_code: 'SUB_wh_1',
      plan: { plan_code: 'PLN_addon_warehouse' },
    })
  );

  assert.strictEqual(updates.length, 1);
  assert.deepStrictEqual(updates[0].$push.addOns, {
    type: 'extra_warehouse',
    quantity: 1,
    paystackSubscriptionCode: 'SUB_wh_1',
  });
  assert.strictEqual(updates[0].plan, undefined, 'must not touch the base plan');
});

test('a replayed add-on webhook does not grant a second slot', async () => {
  // Paystack retries. Without the idempotency check that retry is a free
  // warehouse.
  const doc = baseTenant([
    { type: 'extra_warehouse', quantity: 1, paystackSubscriptionCode: 'SUB_wh_1' },
  ]);
  const updates = await withStubbedTenant(doc, () =>
    handleWebhookEvent('subscription.create', {
      metadata: { tenantId: TENANT_ID.toString(), addOn: 'extra_warehouse' },
      subscription_code: 'SUB_wh_1',
      plan: { plan_code: 'PLN_addon_warehouse' },
    })
  );
  assert.deepStrictEqual(updates, []);
});

test('a base subscription.create sets the plan and clears the trial', async () => {
  const doc = baseTenant();
  const updates = await withStubbedTenant(doc, () =>
    handleWebhookEvent('subscription.create', {
      metadata: { tenantId: TENANT_ID.toString(), targetPlan: 'enterprise' },
      subscription_code: 'SUB_base_2',
      plan: { plan_code: 'PLN_enterprise' },
      created_at: '2026-01-01T00:00:00.000Z',
      next_payment_date: '2026-02-01T00:00:00.000Z',
    })
  );

  assert.strictEqual(updates[0].plan, 'enterprise');
  assert.strictEqual(updates[0].subscriptionStatus, 'active');
  // A paying tenant left with an elapsed trialEndsAt would be degraded by
  // resolveEntitlements the moment the old date passed.
  assert.strictEqual(updates[0].trialEndsAt, null);
});

test("an add-on's failed invoice does not put the tenant into dunning", async () => {
  // past_due is a real read-only state now. Letting a ₦12,000 line item trigger
  // it would take the whole account read-only over the wrong subscription.
  const doc = baseTenant();
  const updates = await withStubbedTenant(doc, () =>
    handleWebhookEvent('invoice.payment_failed', {
      metadata: { tenantId: TENANT_ID.toString() },
      plan: { plan_code: 'PLN_addon_shop' },
    })
  );
  assert.deepStrictEqual(updates, []);
});

test("the base plan's failed invoice does put the tenant into dunning", async () => {
  const doc = baseTenant();
  const updates = await withStubbedTenant(doc, () =>
    handleWebhookEvent('invoice.payment_failed', {
      metadata: { tenantId: TENANT_ID.toString() },
      plan: { plan_code: 'PLN_pro' },
    })
  );
  assert.deepStrictEqual(updates, [{ subscriptionStatus: 'past_due' }]);
});

test("an add-on's failed invoice sends no dunning email either", async () => {
  // The same reason it must not set past_due: telling a paying tenant their
  // account is read-only when it is not is worse than saying nothing. One
  // `break` guards both, and this is the half that is not visible in `updates`.
  const doc = baseTenant();
  const updates = await withStubbedTenant(doc, () =>
    handleWebhookEvent('invoice.payment_failed', {
      metadata: { tenantId: TENANT_ID.toString() },
      plan: { plan_code: 'PLN_addon_shop' },
    })
  );
  assert.deepStrictEqual(updates.notices, []);
});

test("the base plan's failed invoice notifies AFTER the status is written", async () => {
  // notifyReadOnly re-resolves entitlements and refuses to send when writes are
  // allowed — a guard against telling a healthy tenant they are locked. So the
  // tenant handed to it must already carry past_due; passing the document as
  // loaded (still 'active') would silently send nothing at all.
  const doc = baseTenant();
  const updates = await withStubbedTenant(doc, () =>
    handleWebhookEvent('invoice.payment_failed', {
      metadata: { tenantId: TENANT_ID.toString() },
      plan: { plan_code: 'PLN_pro' },
    })
  );
  assert.deepStrictEqual(updates.notices, [
    { kind: 'payment_failed', subscriptionStatus: 'past_due' },
  ]);
});

test('recovering clears the dunning stamps, but only when there are any', async () => {
  // charge.success fires on every renewal of every healthy subscription. An
  // unconditional $unset would be a write per renewal to remove fields that are
  // not set.
  const healthy = baseTenant();
  const quiet = await withStubbedTenant(healthy, () =>
    handleWebhookEvent('charge.success', {
      metadata: { tenantId: TENANT_ID.toString() },
      paid_at: '2026-02-01T00:00:00.000Z',
      next_payment_date: '2026-03-01T00:00:00.000Z',
    })
  );
  assert.deepStrictEqual(quiet.notices, []);

  // A tenant who WAS dunned must be cleared, or the next failure months from
  // now is silenced by a stale pastDueSentAt.
  const recovered = { ...baseTenant(), billingNotices: { pastDueSentAt: new Date() } };
  const loud = await withStubbedTenant(recovered, () =>
    handleWebhookEvent('charge.success', {
      metadata: { tenantId: TENANT_ID.toString() },
      paid_at: '2026-02-01T00:00:00.000Z',
      next_payment_date: '2026-03-01T00:00:00.000Z',
    })
  );
  assert.deepStrictEqual(loud.notices, [{ kind: 'clear_dunning' }]);
});

test('disabling one add-on removes that row and leaves the tenant subscribed', async () => {
  const rowId = new mongoose.Types.ObjectId();
  const doc = baseTenant([
    { _id: rowId, type: 'extra_shop', quantity: 1, paystackSubscriptionCode: 'SUB_shop_1' },
  ]);
  const updates = await withStubbedTenant(doc, () =>
    handleWebhookEvent('subscription.disable', {
      metadata: { tenantId: TENANT_ID.toString() },
      subscription_code: 'SUB_shop_1',
      plan: { plan_code: 'PLN_addon_shop' },
    })
  );

  assert.deepStrictEqual(updates, [{ $pull: { addOns: { _id: rowId } } }]);
});

test('disabling the base subscription cancels the tenant', async () => {
  const doc = baseTenant([
    { type: 'extra_shop', quantity: 1, paystackSubscriptionCode: 'SUB_shop_1' },
  ]);
  const updates = await withStubbedTenant(doc, () =>
    handleWebhookEvent('subscription.disable', {
      metadata: { tenantId: TENANT_ID.toString() },
      subscription_code: 'SUB_base',
      plan: { plan_code: 'PLN_pro' },
    })
  );
  assert.deepStrictEqual(updates, [{ subscriptionStatus: 'canceled' }]);
});

test('charge.success no longer stamps an already-elapsed period end', async () => {
  // paid_at is when the money arrived, not when the period ends. Writing it to
  // currentPeriodEnd made every successful payment look already expired.
  const doc = baseTenant();
  const updates = await withStubbedTenant(doc, () =>
    handleWebhookEvent('charge.success', {
      metadata: { tenantId: TENANT_ID.toString() },
      paid_at: '2026-01-01T00:00:00.000Z',
      next_payment_date: '2026-02-01T00:00:00.000Z',
    })
  );

  assert.strictEqual(updates[0].subscriptionStatus, 'active');
  assert.strictEqual(
    updates[0].currentPeriodEnd.toISOString(),
    '2026-02-01T00:00:00.000Z'
  );
  assert.strictEqual(
    updates[0].currentPeriodStart.toISOString(),
    '2026-01-01T00:00:00.000Z'
  );
});

test('charge.success without a next payment date leaves the period alone', async () => {
  const doc = baseTenant();
  const updates = await withStubbedTenant(doc, () =>
    handleWebhookEvent('charge.success', {
      metadata: { tenantId: TENANT_ID.toString() },
      paid_at: '2026-01-01T00:00:00.000Z',
    })
  );
  assert.strictEqual(updates[0].currentPeriodEnd, undefined);
});

test('an event for an unknown tenant is ignored rather than throwing', async () => {
  const updates = await withStubbedTenant(null, () =>
    handleWebhookEvent('charge.success', { metadata: { tenantId: TENANT_ID.toString() } })
  );
  assert.deepStrictEqual(updates, []);
});

// ─── Own-tenant read ─────────────────────────────────────────────────────────
//
// GET /api/tenants/:id is what auth-options.ts calls at login and again from
// refreshTenantPlan. It was never routed, so both fetches 404'd and were
// swallowed — which is why a plan change arriving by webhook did not reach the
// admin gates until the user signed out and back in.

const { getOwnTenantById } = require('../controllers/tenant.controller');

function fakeRes() {
  const out = { statusCode: 200, body: null };
  out.status = (code) => { out.statusCode = code; return out; };
  out.json = (payload) => { out.body = payload; return out; };
  return out;
}

async function readOwnTenant(req, doc) {
  const original = Tenant.findById;
  Tenant.findById = () => ({ select: () => ({ lean: async () => doc }) });
  const res = fakeRes();
  try {
    await getOwnTenantById(req, res, (err) => { if (err) throw err; });
  } finally {
    Tenant.findById = original;
  }
  return res;
}

test('a tenant user reads their own tenant and gets the gating fields', async () => {
  const id = new mongoose.Types.ObjectId();
  const res = await readOwnTenant(
    { user: { role: 'tenant_owner', tenant: id }, params: { id: id.toString() } },
    { _id: id, slug: 'wyn-city', plan: 'pro', subscriptionStatus: 'active' }
  );

  assert.strictEqual(res.statusCode, 200);
  // The three fields auth-options.ts reads off the response.
  assert.strictEqual(res.body.data.tenant.slug, 'wyn-city');
  assert.strictEqual(res.body.data.tenant.plan, 'pro');
  assert.strictEqual(res.body.data.tenant.subscriptionStatus, 'active');
});

test("another tenant's id is 404, not 403", async () => {
  // A 403 would confirm the id is real and let a caller enumerate tenants.
  const res = await readOwnTenant(
    {
      user: { role: 'tenant_owner', tenant: new mongoose.Types.ObjectId() },
      params: { id: new mongoose.Types.ObjectId().toString() },
    },
    { slug: 'someone-else' }
  );
  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(res.body.success, false);
});

test('a platform admin may read any tenant, and a missing one is 404', async () => {
  const id = new mongoose.Types.ObjectId();
  const ok = await readOwnTenant(
    { user: { role: 'super_admin' }, params: { id: id.toString() } },
    { _id: id, slug: 'wyn-city', plan: 'venue' }
  );
  assert.strictEqual(ok.statusCode, 200);

  const missing = await readOwnTenant(
    { user: { role: 'super_admin' }, params: { id: id.toString() } },
    null
  );
  assert.strictEqual(missing.statusCode, 404);
});

// ─── Webhook signature ───────────────────────────────────────────────────────

const { verifyPaystackSignature } = require('../controllers/erm.controller');

const sign = (raw) =>
  crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(raw).digest('hex');

test('a signature over the raw bytes verifies', () => {
  const raw = Buffer.from('{"event":"charge.success","data":{"id":1}}');
  assert.strictEqual(
    verifyPaystackSignature({
      rawBody: raw,
      body: JSON.parse(raw.toString()),
      headers: { 'x-paystack-signature': sign(raw) },
    }),
    true
  );
});

test('a body that re-serialises differently still verifies', () => {
  // The bug this replaces: the digest was taken over JSON.stringify(req.body),
  // so any payload whose bytes differ from a re-serialisation of its own parse
  // — pretty-printed, escaped, whatever — failed. Every webhook 400s and
  // subscription state silently stops updating.
  const raw = Buffer.from('{\n  "event": "charge.success",\n  "data": { "id": 1 }\n}');
  assert.notStrictEqual(JSON.stringify(JSON.parse(raw.toString())), raw.toString());

  assert.strictEqual(
    verifyPaystackSignature({
      rawBody: raw,
      body: JSON.parse(raw.toString()),
      headers: { 'x-paystack-signature': sign(raw) },
    }),
    true
  );
});

test('a tampered body is refused', () => {
  const raw = Buffer.from('{"event":"charge.success"}');
  const signature = sign(raw);
  assert.strictEqual(
    verifyPaystackSignature({
      rawBody: Buffer.from('{"event":"subscription.disable"}'),
      body: {},
      headers: { 'x-paystack-signature': signature },
    }),
    false
  );
});

test('a missing or malformed signature header is refused', () => {
  const raw = Buffer.from('{"event":"charge.success"}');
  assert.strictEqual(verifyPaystackSignature({ rawBody: raw, headers: {} }), false);
  assert.strictEqual(
    verifyPaystackSignature({ rawBody: raw, headers: { 'x-paystack-signature': 'short' } }),
    false
  );
});

test('a missing secret refuses rather than keying an HMAC on undefined', () => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  delete process.env.PAYSTACK_SECRET_KEY;
  try {
    const raw = Buffer.from('{"event":"charge.success"}');
    assert.strictEqual(
      verifyPaystackSignature({
        rawBody: raw,
        headers: { 'x-paystack-signature': 'a'.repeat(128) },
      }),
      false
    );
  } finally {
    process.env.PAYSTACK_SECRET_KEY = secret;
  }
});
