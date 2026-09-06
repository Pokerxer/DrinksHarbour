// What a refused tenant is actually TOLD, and whether the client can tell why.
//
// Two defects this file pins, both of which made the read-only state
// (server/config/README-plan-entitlements.md §4) unexplainable to the person in
// it:
//
//   1. THE COPY EXISTED THREE TIMES AND HAD DRIFTED. assertWritesAllowed
//      (tenant.middleware.js) said "Your account is read-only until billing is
//      resolved"; requireCapability (plan.middleware.js) said "Access is
//      read-only until billing is resolved"; the billing page composed a third
//      set of sentences of its own. Same tenant, same state, three answers
//      depending on which gate caught them. There is now one function,
//      readOnlyMessage, and this file fails if a second copy reappears.
//
//   2. `err.code` WAS NEVER SERIALISED. Both gates have always set
//      SUBSCRIPTION_READ_ONLY / PLAN_UPGRADE_REQUIRED, and server.js's error
//      handler sent `message` and `details` but not `code` — so every one of
//      them reached the browser as an anonymous 403 and no client branch was
//      possible. The handler must send `code` for errors this codebase raised
//      deliberately, and must NOT send the `code` Node and the Mongo driver put
//      on theirs ('ECONNREFUSED', 11000).

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  resolveEntitlements,
  readOnlyMessage,
  READ_ONLY_MESSAGES,
  READ_ONLY_FALLBACK,
} = require('../services/entitlements.service');
const { assertWritesAllowed } = require('../middleware/tenant.middleware');
const { requireCapability } = require('../middleware/plan.middleware');

const DAY = 24 * 60 * 60 * 1000;

/** Every tenant shape that resolves to writesAllowed: false, and its reason. */
const READ_ONLY_TENANTS = [
  {
    label: 'elapsed trial',
    tenant: {
      status: 'approved',
      plan: 'growth',
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date(Date.now() - DAY),
    },
    reason: 'trial_expired',
  },
  {
    label: 'past_due',
    tenant: { status: 'approved', plan: 'pro', subscriptionStatus: 'past_due' },
    reason: 'subscription_past_due',
  },
  {
    label: 'canceled',
    tenant: { status: 'approved', plan: 'pro', subscriptionStatus: 'canceled' },
    reason: 'subscription_canceled',
  },
  {
    label: 'incomplete',
    tenant: { status: 'approved', plan: 'pro', subscriptionStatus: 'incomplete' },
    reason: 'subscription_incomplete',
  },
  {
    label: 'incomplete_expired',
    tenant: { status: 'approved', plan: 'pro', subscriptionStatus: 'incomplete_expired' },
    reason: 'subscription_incomplete_expired',
  },
  {
    label: 'suspended tenant',
    tenant: { status: 'suspended', plan: 'pro', subscriptionStatus: 'active' },
    reason: 'tenant_suspended',
  },
  {
    label: 'archived tenant',
    tenant: { status: 'archived', plan: 'pro', subscriptionStatus: 'active' },
    reason: 'tenant_archived',
  },
];

/** Capture whatever assertWritesAllowed throws for a write request. */
function writeRefusal(tenant) {
  try {
    assertWritesAllowed({ method: 'POST', tenant });
    return null;
  } catch (err) {
    return err;
  }
}

/** Drive requireCapability and return the error it passed to next(). */
function capabilityRefusal(req, ...capabilities) {
  let captured = null;
  requireCapability(...capabilities)(req, {}, (err) => {
    captured = err || null;
  });
  return captured;
}

test('every read-only reason has its own sentence, not the fallback', () => {
  for (const { label, tenant, reason } of READ_ONLY_TENANTS) {
    const resolved = resolveEntitlements(tenant);
    assert.strictEqual(resolved.writesAllowed, false, `${label} should be read-only`);
    assert.strictEqual(resolved.reason, reason, `${label} reason`);
    assert.ok(
      Object.prototype.hasOwnProperty.call(READ_ONLY_MESSAGES, reason),
      `${label}: reason "${reason}" falls through to the generic fallback — add a sentence for it`
    );
    assert.notStrictEqual(readOnlyMessage(reason), READ_ONLY_FALLBACK);
  }
});

test('readOnlyMessage never returns empty, even for a reason it has never seen', () => {
  assert.strictEqual(readOnlyMessage('something_invented'), READ_ONLY_FALLBACK);
  assert.strictEqual(readOnlyMessage(undefined), READ_ONLY_FALLBACK);
  assert.ok(READ_ONLY_FALLBACK.length > 0);
});

test('the write gate and the capability gate give the SAME sentence', () => {
  for (const { label, tenant, reason } of READ_ONLY_TENANTS) {
    const fromWriteGate = writeRefusal(tenant);
    assert.ok(fromWriteGate, `${label}: assertWritesAllowed should refuse a POST`);
    assert.strictEqual(fromWriteGate.message, readOnlyMessage(reason), `${label} write gate`);

    // requireCapability's read-only branch only runs when the capability IS
    // held, so ask for one the degraded set still carries.
    const held = resolveEntitlements(tenant).capabilities[0];
    if (!held) continue; // suspended/archived hold nothing — no read-only branch to reach
    const fromCapabilityGate = capabilityRefusal(
      { method: 'POST', tenant, user: { role: 'tenant_admin' } },
      held
    );
    assert.ok(fromCapabilityGate, `${label}: requireCapability should refuse a POST`);
    assert.strictEqual(
      fromCapabilityGate.message,
      fromWriteGate.message,
      `${label}: the two gates tell the tenant different things`
    );
  }
});

test('a read-only refusal carries the code and details the client branches on', () => {
  const { tenant, reason } = READ_ONLY_TENANTS[0];
  const err = writeRefusal(tenant);

  assert.strictEqual(err.code, 'SUBSCRIPTION_READ_ONLY');
  assert.strictEqual(err.statusCode, 403);
  assert.deepStrictEqual(err.details, { reason, currentPlan: tenant.plan });

  // The exact predicate server.js's error handler applies before serialising
  // `code`. If this stops holding, the code silently stops reaching the client
  // again and the toast goes quiet with no test failing anywhere else.
  assert.strictEqual(err.isOperational, true);
  assert.strictEqual(typeof err.code, 'string');
});

test('an upgrade refusal names the cheapest plan that unlocks the feature', () => {
  const err = capabilityRefusal(
    {
      method: 'GET',
      tenant: { status: 'approved', plan: 'starter', subscriptionStatus: 'active' },
      user: { role: 'tenant_admin' },
    },
    'advanced_reports'
  );

  assert.ok(err);
  assert.strictEqual(err.code, 'PLAN_UPGRADE_REQUIRED');
  assert.strictEqual(err.isOperational, true);
  // `upgradeTo` exists precisely so the client does not parse the prose.
  assert.strictEqual(err.details.upgradeTo, 'pro');
  assert.strictEqual(err.details.currentPlan, 'starter');
});

test('reads are never refused, whatever the subscription state', () => {
  for (const { label, tenant } of READ_ONLY_TENANTS) {
    assert.strictEqual(writeRefusal(tenant), null, `${label}: a GET must still pass`);
  }
  function writeRefusal(t) {
    try {
      assertWritesAllowed({ method: 'GET', tenant: t });
      return null;
    } catch (err) {
      return err;
    }
  }
});

test('the billing router stays writable for a read-only tenant', () => {
  // Without this exemption the read-only state has no exit: /api/erm sits
  // behind requireTenant, so a past_due tenant could not reach the page they
  // have to use in order to pay. README §4.
  const { tenant } = READ_ONLY_TENANTS[1];
  assert.doesNotThrow(() =>
    assertWritesAllowed({ method: 'POST', tenant, billingWriteExempt: true })
  );
});

test('server.js serialises err.code, and only for errors we raised', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

  // Not a style check: without this line the two codes above never reach the
  // browser and the client cannot distinguish a billing 403 from any other.
  assert.match(
    source,
    /err\.isOperational && typeof err\.code === 'string'.*\{ code: err\.code \}/,
    'server.js must serialise `code` for operational errors — see this file’s header'
  );

  // And it must stay gated: a Mongo duplicate-key error carries `code: 11000`
  // and a socket failure carries `code: 'ECONNREFUSED'`. Neither is part of
  // this API's contract and neither should be handed to a public caller.
  assert.doesNotMatch(
    source,
    /\.\.\.\(err\.code \?/,
    'ungated `err.code` would leak driver and Node error codes to callers'
  );
});
