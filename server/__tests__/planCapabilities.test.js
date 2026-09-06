// Pins the plan-capability table across all three places it appears.
//
// The table is sold on the pricing page, enforced by the server, and mirrored
// by the admin client. Those three drift silently: nothing throws when a plan
// gains a feature in marketing and not in code, and the symptom is a tenant who
// bought something they cannot reach (or reaches something they did not buy).
//
//   client/apps/platform/.../vendors/register/data.ts   FEATURE_COMPARISON  (sold)
//   server/config/erm-plans.js                          ERM_PLANS[*].features (canonical)
//   client/apps/admin/src/config/plan-capabilities.ts   PLAN_CAPABILITIES   (mirror)
//
// Same technique as rolePermissionMap.test.js: read the literals out of the
// TypeScript sources rather than importing them, since node:test cannot load TS.
//
// See server/config/README-plan-entitlements.md for the rules being pinned.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  ERM_PLANS,
  PLAN_ORDER,
  COMPARISON_ROW_CAPABILITY,
  EXTRA_CAPABILITIES,
  isPlanAtLeast,
  cheapestPlanWith,
} = require('../config/erm-plans');
const {
  resolveEntitlements,
  hasAnyCapability,
} = require('../services/entitlements.service');

const CLIENT_ROOT = path.join(__dirname, '..', '..', 'client');
const PRICING_SOURCE = path.join(
  CLIENT_ROOT, 'apps', 'platform', 'src', 'app', 'vendors', 'register', 'data.ts'
);
const MIRROR_SOURCE = path.join(
  CLIENT_ROOT, 'apps', 'admin', 'src', 'config', 'plan-capabilities.ts'
);

/** The six SOLD plans. `custom` is not on the pricing page by design. */
const SOLD_PLANS = PLAN_ORDER;

// ─── Reading the TypeScript sources ──────────────────────────────────────────

/**
 * Slice the balanced literal assigned by `marker`.
 *
 * Anchored on the `=`, not on the marker: `FEATURE_COMPARISON:
 * FeatureComparison[] = [...]` puts a `[]` in the TYPE ANNOTATION, and scanning
 * from the marker finds that empty pair first — which parses cleanly as `[]`
 * and silently pins the table against nothing at all.
 */
function sliceLiteral(src, marker, openChar) {
  const start = src.indexOf(marker);
  assert.notStrictEqual(start, -1, `${marker} not found`);
  const eq = src.indexOf('=', start);
  assert.notStrictEqual(eq, -1, `${marker} has no assignment`);
  const closeChar = openChar === '[' ? ']' : '}';
  const open = src.indexOf(openChar, eq);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === openChar) depth += 1;
    else if (src[i] === closeChar) {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  assert.fail(`unbalanced ${openChar} in the ${marker} literal`);
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * FEATURE_COMPARISON is an array of flat objects: one string `feature` and one
 * boolean per plan. Keys are quoted only where they follow `{` or `,`, so the
 * parenthesised feature names in the VALUES are left alone.
 */
function readFeatureComparison() {
  const literal = stripComments(
    sliceLiteral(fs.readFileSync(PRICING_SOURCE, 'utf8'),
      'export const FEATURE_COMPARISON', '[')
  )
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/'/g, '"')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(literal);
}

/** PLAN_CAPABILITIES is a plain object of string arrays. */
function readMirror() {
  const literal = stripComments(
    sliceLiteral(fs.readFileSync(MIRROR_SOURCE, 'utf8'),
      'export const PLAN_CAPABILITIES', '{')
  )
    .replace(/([A-Za-z_$][\w$]*)\s*:\s*\[/g, '"$1": [')
    .replace(/'/g, '"')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(literal);
}

// ─── The three-way pin ───────────────────────────────────────────────────────

test('FEATURE_COMPARISON parses and covers every sold plan', () => {
  const rows = readFeatureComparison();
  assert.ok(rows.length > 0, 'no rows parsed');
  for (const row of rows) {
    for (const plan of SOLD_PLANS) {
      assert.ok(plan in row, `row "${row.feature}" is missing ${plan}`);
    }
  }
});

test('every FEATURE_COMPARISON row maps to a capability', () => {
  for (const row of readFeatureComparison()) {
    assert.ok(
      COMPARISON_ROW_CAPABILITY[row.feature],
      `pricing row "${row.feature}" has no capability in COMPARISON_ROW_CAPABILITY. ` +
        'A new priced feature must be given a capability, or it is sold and never enforced.'
    );
  }
});

test('server capability sets match the pricing page exactly', () => {
  const rows = readFeatureComparison();
  for (const row of rows) {
    const capability = COMPARISON_ROW_CAPABILITY[row.feature];
    for (const plan of SOLD_PLANS) {
      const sold = row[plan] === true;
      const granted = ERM_PLANS[plan].features.includes(capability);
      assert.strictEqual(
        granted,
        sold,
        `"${row.feature}" (${capability}): pricing says ${sold} for ${plan}, ` +
          `ERM_PLANS says ${granted}`
      );
    }
  }
});

test('the admin client mirror matches the server exactly', () => {
  const mirror = readMirror();
  assert.deepStrictEqual(
    Object.keys(mirror).sort(),
    Object.keys(ERM_PLANS).sort(),
    'mirror and ERM_PLANS disagree about which plans exist'
  );
  for (const plan of Object.keys(ERM_PLANS)) {
    assert.deepStrictEqual(
      [...mirror[plan]].sort(),
      [...ERM_PLANS[plan].features].sort(),
      `plan-capabilities.ts and erm-plans.js disagree for ${plan}`
    );
  }
});

test('no plan carries an unknown capability', () => {
  const known = new Set([
    ...Object.values(COMPARISON_ROW_CAPABILITY),
    ...EXTRA_CAPABILITIES,
  ]);
  for (const [plan, config] of Object.entries(ERM_PLANS)) {
    for (const capability of config.features) {
      assert.ok(
        known.has(capability),
        `${plan} carries unknown capability "${capability}" — typo, or a new ` +
          'capability that needs adding to COMPARISON_ROW_CAPABILITY or EXTRA_CAPABILITIES'
      );
    }
  }
});

// ─── The non-monotonic rows: the traps this whole design exists for ──────────

test('Pro keeps a POS even though its single-outlet row is false', () => {
  const row = readFeatureComparison().find((r) => r.feature === 'POS (single outlet)');
  assert.strictEqual(row.pro, false, 'fixture drift: pro should be false here');

  // Gating on pos_single alone would refuse Pro. The umbrella is what saves it.
  const anyPos = ['pos_single', 'pos_multi', 'pos_realtime'];
  for (const plan of ['pro', 'enterprise', 'venue']) {
    const tenant = { plan, status: 'approved', subscriptionStatus: 'active' };
    assert.ok(
      hasAnyCapability(tenant, ['pos_single']) === false,
      `${plan} should not hold pos_single`
    );
    assert.ok(
      hasAnyCapability(tenant, anyPos),
      `${plan} MUST still reach the POS — a rank gate would lock them out`
    );
  }
});

test('Enterprise and Venue keep CRM even though their Basic CRM row is false', () => {
  const row = readFeatureComparison().find((r) => r.feature === 'Basic CRM');
  assert.strictEqual(row.enterprise, false, 'fixture drift: enterprise should be false here');

  const anyCrm = ['crm_basic', 'crm_advanced'];
  for (const plan of ['enterprise', 'venue']) {
    const tenant = { plan, status: 'approved', subscriptionStatus: 'active' };
    assert.ok(hasAnyCapability(tenant, ['crm_basic']) === false);
    assert.ok(
      hasAnyCapability(tenant, anyCrm),
      `${plan} MUST still reach CRM — it holds the advanced tier`
    );
  }
});

// ─── custom ──────────────────────────────────────────────────────────────────

test('custom is no longer refused by the ordinal helper', () => {
  // Regression: PLAN_ORDER never contained 'custom', so indexOf returned -1 and
  // isPlanAtLeast('custom', anything) was false — every server plan gate
  // refused a custom tenant while the admin menu offered them everything.
  for (const plan of SOLD_PLANS) {
    assert.ok(
      isPlanAtLeast('custom', plan),
      `isPlanAtLeast('custom', '${plan}') must be true`
    );
  }
  assert.strictEqual(isPlanAtLeast('nonsense', 'starter'), false);
});

test('custom defaults to the enterprise capability set', () => {
  assert.deepStrictEqual(
    [...ERM_PLANS.custom.features].sort(),
    [...ERM_PLANS.enterprise.features].sort()
  );
});

test('customCapabilities overrides the default, and only for custom', () => {
  const narrowed = resolveEntitlements({
    plan: 'custom',
    status: 'approved',
    subscriptionStatus: 'active',
    customCapabilities: ['inventory'],
  });
  assert.deepStrictEqual(narrowed.capabilities, ['inventory']);

  // A starter tenant cannot be upgraded by writing to the override array.
  const starter = resolveEntitlements({
    plan: 'starter',
    status: 'approved',
    subscriptionStatus: 'active',
    customCapabilities: ['advanced_reports', 'api_access'],
  });
  assert.ok(!starter.capabilities.includes('advanced_reports'));
  assert.ok(!starter.capabilities.includes('api_access'));
});

// ─── Subscription status and dunning ────────────────────────────────────────

const approved = (over) => ({ plan: 'pro', status: 'approved', ...over });

test('an active tenant gets its plan set and may write', () => {
  const e = resolveEntitlements(approved({ subscriptionStatus: 'active' }));
  assert.ok(e.writesAllowed);
  assert.ok(e.capabilities.includes('advanced_reports'));
  assert.strictEqual(e.degraded, false);
});

test('past_due keeps the plan set but loses writes', () => {
  const e = resolveEntitlements(approved({ subscriptionStatus: 'past_due' }));
  assert.ok(e.capabilities.includes('advanced_reports'), 'should still SEE its features');
  assert.strictEqual(e.writesAllowed, false);
});

for (const status of ['canceled', 'incomplete', 'incomplete_expired']) {
  test(`${status} falls back to the free_trial set`, () => {
    const e = resolveEntitlements(approved({ subscriptionStatus: status }));
    assert.deepStrictEqual(e.capabilities, ERM_PLANS.free_trial.features);
    assert.strictEqual(e.writesAllowed, false);
  });
}

test('an elapsed trial degrades; an unexpired one does not', () => {
  const now = new Date('2026-09-06T00:00:00Z');
  const expired = resolveEntitlements(
    approved({ subscriptionStatus: 'trialing', trialEndsAt: '2026-09-05T00:00:00Z' }),
    now
  );
  assert.strictEqual(expired.reason, 'trial_expired');
  assert.deepStrictEqual(expired.capabilities, ERM_PLANS.free_trial.features);
  assert.strictEqual(expired.writesAllowed, false);

  const live = resolveEntitlements(
    approved({ subscriptionStatus: 'trialing', trialEndsAt: '2026-09-07T00:00:00Z' }),
    now
  );
  assert.strictEqual(live.reason, 'ok');
  assert.ok(live.writesAllowed);

  // No trialEndsAt must never read as "expired" — that would degrade every
  // trialing tenant the moment this shipped.
  const noEnd = resolveEntitlements(approved({ subscriptionStatus: 'trialing' }), now);
  assert.strictEqual(noEnd.reason, 'ok');
});

for (const status of ['suspended', 'archived']) {
  test(`a ${status} tenant holds nothing at all`, () => {
    const e = resolveEntitlements({
      plan: 'venue', status, subscriptionStatus: 'active',
    });
    assert.deepStrictEqual(e.capabilities, []);
    assert.strictEqual(e.writesAllowed, false);
  });
}

test('a missing tenant holds nothing rather than defaulting generously', () => {
  const e = resolveEntitlements(null);
  assert.deepStrictEqual(e.capabilities, []);
  assert.strictEqual(e.writesAllowed, false);
});

// ─── Upgrade copy ────────────────────────────────────────────────────────────

test('cheapestPlanWith names a sold plan, never custom', () => {
  assert.strictEqual(cheapestPlanWith('sales_invoicing'), 'starter');
  assert.strictEqual(cheapestPlanWith('purchase_orders'), 'growth');
  assert.strictEqual(cheapestPlanWith('advanced_reports'), 'pro');
  assert.strictEqual(cheapestPlanWith('table_management'), 'venue');
  assert.strictEqual(cheapestPlanWith('inventory'), 'free_trial');
  assert.strictEqual(cheapestPlanWith('not_a_capability'), null);
});

// ─── The gate itself ─────────────────────────────────────────────────────────

test('an empty requirement is ungated', () => {
  assert.ok(hasAnyCapability({ plan: 'free_trial', status: 'approved', subscriptionStatus: 'active' }, []));
});

test('requireCapability exempts platform roles, who have no tenant', () => {
  const { requireCapability } = require('../middleware/plan.middleware');
  const gate = requireCapability('advanced_reports');

  for (const role of ['super_admin', 'admin']) {
    let passed = false;
    gate({ user: { role }, tenant: null, method: 'GET' }, {}, (err) => {
      assert.ifError(err);
      passed = true;
    });
    assert.ok(passed, `${role} must pass — an undefined plan would rank as free_trial`);
  }
});

test('requireCapability refuses a tenant without the capability', () => {
  const { requireCapability } = require('../middleware/plan.middleware');
  const gate = requireCapability('advanced_reports');
  const req = {
    user: { role: 'tenant_owner' },
    tenant: { plan: 'growth', status: 'approved', subscriptionStatus: 'active' },
    method: 'GET',
  };

  let error = null;
  gate(req, {}, (err) => { error = err; });
  assert.ok(error, 'growth must be refused advanced_reports');
  assert.strictEqual(error.code, 'PLAN_UPGRADE_REQUIRED');
  assert.strictEqual(error.details.upgradeTo, 'pro');
});

test('requireCapability admits a tenant holding any listed tier', () => {
  const { requireCapability } = require('../middleware/plan.middleware');
  const gate = requireCapability('crm_basic', 'crm_advanced');
  const req = {
    user: { role: 'tenant_owner' },
    tenant: { plan: 'enterprise', status: 'approved', subscriptionStatus: 'active' },
    method: 'GET',
  };

  let error = 'unset';
  gate(req, {}, (err) => { error = err; });
  assert.ifError(error);
});
