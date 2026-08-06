// server/__tests__/appraisal.model.test.js
const test = require('node:test');
const assert = require('node:assert');

const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');

// Guard against the failure mode that bit purchase documents: a field-level
// `unique: true` enforces GLOBAL uniqueness, so tenant B collides with tenant A.
function assertNoFieldLevelUnique(model) {
  // Recursively check all schemas, including nested subdocuments.
  function checkSchema(schema, parentPath = '') {
    schema.eachPath((pathName, type) => {
      const fullPath = parentPath ? `${parentPath}.${pathName}` : pathName;
      assert.notStrictEqual(
        type.options?.unique,
        true,
        `${model.modelName}.${fullPath} declares field-level unique:true — use a compound index on tenant instead`
      );
    });

    // Descend into nested schemas (subdocuments). The child's own path is
    // carried down as the parent prefix so a violation reports as
    // `Appraisal.peerNominations.user` rather than a bare `Appraisal.user`,
    // which names no field that exists on the parent schema and sends whoever
    // reads the failure looking in the wrong place.
    if (schema.childSchemas) {
      schema.childSchemas.forEach(({ schema: childSchema, path }) => {
        checkSchema(childSchema, parentPath ? `${parentPath}.${path}` : path);
      });
    }
  }

  checkSchema(model.schema);
}

test('no appraisal model declares a field-level unique index', () => {
  [Appraisal, AppraisalFeedback, AppraisalCycle, AppraisalTemplate].forEach(
    assertNoFieldLevelUnique
  );
});

test('Appraisal is unique per (tenant, cycle, employee)', () => {
  const unique = Appraisal.schema.indexes().filter(([, opts]) => opts.unique);
  assert.strictEqual(unique.length, 1);
  assert.deepStrictEqual(unique[0][0], { tenant: 1, cycle: 1, employee: 1 });
});

test('AppraisalFeedback is unique per (appraisal, reviewer)', () => {
  const unique = AppraisalFeedback.schema.indexes().filter(([, opts]) => opts.unique);
  assert.strictEqual(unique.length, 1);
  assert.deepStrictEqual(unique[0][0], { appraisal: 1, reviewer: 1 });
});

test('every appraisal model is tenant-scoped and indexed', () => {
  [Appraisal, AppraisalFeedback, AppraisalCycle, AppraisalTemplate].forEach((m) => {
    const tenantPath = m.schema.path('tenant');
    assert.ok(tenantPath, `${m.modelName} must have a tenant path`);
    assert.strictEqual(tenantPath.options.required, true);
    assert.strictEqual(tenantPath.options.index, true);
  });
});

test('Appraisal state enum matches the documented state machine', () => {
  const states = Appraisal.schema.path('state').options.enum;
  assert.deepStrictEqual(states, [
    'draft',
    'nominating',
    'pending_peer_approval',
    'collecting',
    'summarising',
    'released',
    'acknowledged',
    'cancelled',
  ]);
  assert.strictEqual(Appraisal.schema.path('state').options.default, 'draft');
});

test('AppraisalFeedback supports all three reviewer kinds', () => {
  assert.deepStrictEqual(AppraisalFeedback.schema.path('kind').options.enum, [
    'self',
    'manager',
    'peer',
  ]);
});

const { TRANSITIONS } = require('../services/appraisal.helpers');

test('peerNominations records who proposed and who decided', () => {
  const path = Appraisal.schema.path('peerNominations');
  assert.ok(path, 'peerNominations exists');
  const sub = path.schema;
  for (const f of ['user', 'proposedBy', 'status', 'decidedBy', 'decidedAt']) {
    assert.ok(sub.path(f), `peerNominations.${f} exists`);
  }
  assert.deepStrictEqual(
    sub.path('status').enumValues,
    ['proposed', 'approved', 'rejected']
  );
});

test('the Phase 1 bare peer arrays are gone', () => {
  assert.strictEqual(Appraisal.schema.path('nominatedPeers'), undefined);
  assert.strictEqual(Appraisal.schema.path('approvedPeers'), undefined);
});

test('a peer can decline, distinctly from expiring', () => {
  assert.deepStrictEqual(
    AppraisalFeedback.schema.path('status').enumValues,
    ['pending', 'submitted', 'expired', 'declined']
  );
  assert.ok(AppraisalFeedback.schema.path('declinedAt'));
  assert.ok(AppraisalFeedback.schema.path('declineReason'));
});

test('peer review is a per-cycle setting, on by default', () => {
  const path = AppraisalCycle.schema.path('peerReviewEnabled');
  assert.ok(path);
  assert.strictEqual(path.defaultValue, true);
});

test('HR can skip nomination straight to collecting', () => {
  // skip-peers must be legal from BOTH nomination states.
  assert.ok(TRANSITIONS.nominating.includes('collecting'));
  assert.ok(TRANSITIONS.pending_peer_approval.includes('collecting'));
});

test('AppraisalTemplate carries copy-on-write version fields', () => {
  const s = AppraisalTemplate.schema;
  assert.ok(s.path('family'), 'family path must exist');
  assert.strictEqual(s.path('family').options.required, true);
  assert.strictEqual(s.path('version').options.default, 1);
  assert.strictEqual(s.path('isLatest').options.default, true);
  assert.strictEqual(s.path('isDefault').options.default, false);
});

test('AppraisalTemplate declares exactly three tenant-keyed unique indexes', () => {
  const unique = AppraisalTemplate.schema.indexes().filter(([, o]) => o.unique);
  assert.strictEqual(unique.length, 3);

  const byKey = new Map(unique.map(([keys, opts]) => [JSON.stringify(keys), opts]));

  // One row per (tenant, family, version).
  assert.ok(byKey.has(JSON.stringify({ tenant: 1, family: 1, version: 1 })));

  // At most one latest version per family — for EVERY family, not just the
  // default. Without this a family with two isLatest rows resolves
  // non-deterministically at cycle create.
  const latest = byKey.get(JSON.stringify({ tenant: 1, family: 1 }));
  assert.ok(latest, 'must declare a {tenant, family} index');
  assert.deepStrictEqual(latest.partialFilterExpression, { isLatest: true });

  // At most one default family per tenant — the ensureDefaultTemplate race fix.
  const dflt = byKey.get(JSON.stringify({ tenant: 1, isDefault: 1 }));
  assert.ok(dflt, 'must declare a {tenant, isDefault} index');
  assert.deepStrictEqual(dflt.partialFilterExpression, {
    isDefault: true,
    isLatest: true,
  });
});

test('every AppraisalTemplate unique index is keyed on tenant', () => {
  AppraisalTemplate.schema.indexes()
    .filter(([, o]) => o.unique)
    .forEach(([keys]) => {
      assert.strictEqual(
        Object.keys(keys)[0],
        'tenant',
        `unique index ${JSON.stringify(keys)} must lead with tenant`
      );
    });
});

// ─── AppraisalNudge (Phase 3 Task 9) ────────────────────────────────────────
const AppraisalNudge = require('../models/AppraisalNudge');

test('AppraisalNudge is tenant-scoped and declares no unique index', () => {
  const tenantPath = AppraisalNudge.schema.path('tenant');
  assert.ok(tenantPath);
  assert.strictEqual(tenantPath.options.required, true);
  // Repeat nudges are legitimate history, not a duplicate to be rejected.
  assert.strictEqual(
    AppraisalNudge.schema.indexes().filter(([, o]) => o.unique).length,
    0
  );
});

test('AppraisalNudge reason enum matches NUDGE_REASONS', () => {
  const { NUDGE_REASONS } = require('../services/appraisal.helpers');
  assert.deepStrictEqual(
    AppraisalNudge.schema.path('reason').options.enum,
    NUDGE_REASONS
  );
});

test('AppraisalNudge declares no field-level unique index', () => {
  assertNoFieldLevelUnique(AppraisalNudge);
});

test('every AppraisalNudge index leads with tenant', () => {
  AppraisalNudge.schema.indexes().forEach(([keys]) => {
    assert.strictEqual(
      Object.keys(keys)[0],
      'tenant',
      `index ${JSON.stringify(keys)} must lead with tenant`
    );
  });
});

// The architectural guarantee this whole model exists for: a nudge names the
// person holding the appraisal up, so as a subdocument array it would put a
// peer reviewer's id on the very document projected to the subject — and
// REVIEWER_IDENTITY_FIELDS is a DENY-list, so it would be exposed by default
// until someone remembered to add it.
test('Appraisal carries no nudge path — nudges live in their own collection', () => {
  const paths = Object.keys(Appraisal.schema.paths);
  const offenders = paths.filter((p) => /nudge/i.test(p));
  assert.deepStrictEqual(offenders, []);
});
