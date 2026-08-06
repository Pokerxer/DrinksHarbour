# Appraisal Module Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give HR a versioned appraisal-form builder, turn the cycle progress payload into an actionable roster with nudges and rating reporting, and ship the self-vs-manager-vs-peer comparison the `askOf` field has existed for since Phase 1.

**Architecture:** Templates become copy-on-write versioned documents (`family` + `version` + `isLatest`), with each cycle pinning its concrete version once, at launch — so editing a form never rewrites history an employee already signed off on. Nudges live in their own collection rather than as a subdocument on `Appraisal`, which is what keeps a peer's id structurally out of the subject's payload. The comparison is computed by a pure helper from the **already-projected** feedback array, so a subject viewer's peer breakdown cannot populate even if its access gate were wrong.

**Tech Stack:** Node + Express + Mongoose (server, CommonJS), `node:test` for server tests, Next.js App Router + TypeScript + rizzui + Tailwind (admin), Vitest for admin tests.

**Spec:** `docs/superpowers/specs/2026-08-05-appraisal-module-phase-3-design.md`
**Ledger:** `.superpowers/sdd/progress.md` — append each task's outcome as you go, not at the end.

## Global Constraints

- **DO NOT COMMIT and do not `git add`.** Standing user rule since 2026-07-30. All appraisal work across all three phases is deliberately uncommitted. This overrides any skill that says to commit.
- **NEVER run `git checkout .`, `git stash`, `git reset --hard`, or `git clean`.** The working tree holds ~190 uncommitted files across three unshipped projects and is the only copy of all of it. `git clean -fdx` would also destroy the progress ledger.
- **Server test command is `cd server && node --test '__tests__/*.test.js'`.** `npm test` is broken — do not use it.
- **Server baseline: 1078 passing / 1081.** The 3 failures are pre-existing and are not yours. Confirm them BY NAME, never by count alone:
  - `get-one pricelist is tenant-scoped: cross-tenant _id returns 404`
  - `generateSalesOrderNumber produces an SO-prefixed daily-sequenced string, and advances after a doc is created`
  - `createSalesOrderDoc persists a tenant-scoped order with snapshot totals`
- **Admin type-check is `cd client/apps/admin && node_modules/.bin/tsc --noEmit` → 461 errors.** `npx tsc` reports 0 and is LYING. Always use the local binary. Add none.
- **Admin tests: `cd client/apps/admin && npx vitest run` → 99 passing.** Add none failing.
- **Tenant scoping in controllers is `req.tenant._id`.** `req.tenantId` does not exist in this codebase.
- **Never open or print `server/_insp.js`** (plaintext production Atlas credential). Never echo `.env` values.
- **Backend runs on :5001.** A stale process makes a fresh `npm run dev` print "✅ running" while `listen()` silently hit EADDRINUSE — run `lsof -ti:5001` before trusting the banner.
- **No field-level `unique: true` on any model.** Every unique index is declared at schema level and keyed on `tenant`. Field-level unique is what made `poNumber_1` enforce global uniqueness across tenants.
- **`withTransaction` re-runs its WHOLE callback on a transient error.** Re-read every document inside the callback; never mutate one loaded outside it. This hazard has cost this module two bugs already.
- **Every projection must call `.toObject()` before spreading a possibly-hydrated document.** Spreading a hydrated Mongoose doc yields `{$__, _doc}`, not schema paths, so the projection silently strips nothing. This has been a real bug here twice.
- **The anonymity policy does not change.** The manager and HR see peer reviewer names; only the employee does not. It is disclosed to peers before they write, by the banner in `reviewer-form.tsx`. If you change the policy you must change the banner in the same edit.

### Snapshot protocol (replaces "Commit")

Because nothing is committed, per-task diffs cannot come from git. Before starting each task:

```bash
export SNAP="${CLAUDE_SCRATCHPAD:-/tmp/dh-appraisal-p3}/task-NN"
mkdir -p "$SNAP"
cp -R server/models server/controllers server/services server/routes server/__tests__ server/scripts "$SNAP/before-server"
cp -R client/apps/admin/src/app/shared/appraisals client/apps/admin/src/services "$SNAP/before-admin"
```

After finishing, repeat into `after-server` / `after-admin` and produce the reviewable diff:

```bash
diff -ruN "$SNAP/before-server" "$SNAP/after-server" > "$SNAP/server.diff"
diff -ruN "$SNAP/before-admin"  "$SNAP/after-admin"  > "$SNAP/admin.diff"
```

### Subagent dispatch rule

Every dispatch must name its in-scope directories explicitly and state that **anything outside them must be reported, not edited**. In Phase 2 a UI-scoped task silently widened a projection on the anonymity boundary. It proved safe; the next one might not.

### Plan text is a proposal, not ground truth

Across Phase 2 this plan's predecessor contained a real bug in roughly half its tasks — a permission gate contradicting its own test, a variable that did not exist in the target function, a routes file described as wired that was not. Every one was caught by the per-task review, not by the implementer. **Keep the review gate.** If a step's code contradicts the file you are looking at, the file wins — report it.

---

# Part A — Template versioning (server)

### Task 1: `AppraisalTemplate` version fields and indexes

**Files:**
- Modify: `server/models/AppraisalTemplate.js`
- Modify: `server/__tests__/appraisal.model.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `AppraisalTemplate` schema paths `family: ObjectId`, `version: Number`, `isLatest: Boolean`, `isDefault: Boolean`; three schema-level indexes.

- [ ] **Step 1: Write the failing tests**

Append to `server/__tests__/appraisal.model.test.js`:

```js
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
  // `isDefault` is in the KEY as well as the filter so the key pattern does not
  // duplicate the tenant field's own `index: true`, which made Mongoose print
  // "Duplicate schema index on {tenant:1}" on every boot.
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && node --test __tests__/appraisal.model.test.js`
Expected: FAIL — `family path must exist`.

- [ ] **Step 3: Add the fields and indexes**

In `server/models/AppraisalTemplate.js`, add to `appraisalTemplateSchema`'s field block (after `tenant`):

```js
    // Copy-on-write versioning. A template is edited in place until a cycle
    // has launched against it; the first edit after that forks a new version
    // and the launched cycle keeps pointing at the version it launched with.
    // Editing a form must never rewrite an appraisal an employee has already
    // signed off on.
    family: { type: Schema.Types.ObjectId, required: true, index: true },
    version: { type: Number, required: true, default: 1 },
    isLatest: { type: Boolean, default: true },
    // The tenant's seeded family — what ensureDefaultTemplate resolves and
    // what createCycle falls back to when HR names no template.
    isDefault: { type: Boolean, default: false },
```

And after the schema definition, before `module.exports`:

```js
appraisalTemplateSchema.index({ tenant: 1, family: 1, version: 1 }, { unique: true });

// At most one latest version per family. Enforced for every family, not just
// the default — a family with two isLatest rows resolves non-deterministically
// at cycle create, and the fork transaction relies on this rejecting a
// half-applied write.
appraisalTemplateSchema.index(
  { tenant: 1, family: 1 },
  { unique: true, partialFilterExpression: { isLatest: true } }
);

// At most one default family per tenant. This is what makes
// ensureDefaultTemplate's upsert safe against two concurrent first-ever
// createCycle calls, which previously raced through findOne-then-create and
// could seed two default templates.
//
// `isDefault` is in the KEY as well as the partial filter. Keyed on the bare
// {tenant: 1} it duplicates the tenant field's own `index: true` — Mongoose
// compares key patterns and ignores options, so it warned on every boot. At
// most one row per tenant satisfies the filter either way, so the guarantee is
// identical. Do NOT drop `index: true` from the tenant field instead: a test
// asserts it, and the plain index serves ordinary tenant-scoped queries.
appraisalTemplateSchema.index(
  { tenant: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true, isLatest: true } }
);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && node --test __tests__/appraisal.model.test.js`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Run the full server suite**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -8`
Expected: `# pass 1081` / `# fail 3` (baseline 1078 + 3 new). Confirm the 3 failures by name.

> `family` is `required: true` with no default. Every existing template document in Atlas lacks it, so **reads still work** (Mongoose only validates on write) but any `.save()` of an old document will now fail validation. Task 7's backfill script closes that. Do not add a default to paper over it — a silently-defaulted `family` would give two unrelated templates the same family.

- [ ] **Step 6: Snapshot and record**

Produce the diff per the snapshot protocol. Append the outcome to `.superpowers/sdd/progress.md` under a new `## PHASE 3` heading.

---

### Task 2: Atomic `ensureDefaultTemplate`

**Files:**
- Modify: `server/services/appraisal.helpers.js` (`buildDefaultTemplate`)
- Modify: `server/controllers/appraisalCycle.controller.js:10-15` (`ensureDefaultTemplate`)
- Modify: `server/__tests__/helpers/appraisalHarness.js`
- Create: `server/__tests__/appraisalTemplateDefault.test.js`

**Interfaces:**
- Consumes: Task 1's schema fields.
- Produces: `buildDefaultTemplate(tenantId, createdBy)` now returns `{..., family, version: 1, isLatest: true, isDefault: true}`. `ensureDefaultTemplate(tenant, userId)` is exported from the cycle controller for testing.

- [ ] **Step 1: Extend the harness for the new fields and statics**

The harness stages writes through a fixed field list. A field missing from it is not written through, so template writes would silently vanish.

In `server/__tests__/helpers/appraisalHarness.js`, replace the `templates` entry of `FIELD_LISTS`:

```js
  templates: [
    'tenant', 'name', 'description', 'isArchived', 'createdBy', 'sections',
    'family', 'version', 'isLatest', 'isDefault', 'createdAt', 'updatedAt',
  ],
```

Add `templateFamily` to the `cycles` field list and to `REF_MAP.cycles`:

```js
  cycles: [
    'tenant', 'name', 'template', 'templateFamily', 'status',
    'nominationDeadline', 'feedbackDeadline', 'peerReviewEnabled',
    'createdBy', 'launchedAt', 'closedAt', 'createdAt', 'updatedAt',
  ],
```

```js
  cycles: { template: 'templates', templateFamily: 'templates', createdBy: 'users' },
```

The harness currently stubs only `findOne` and `create` on `AppraisalTemplate`. Part A needs more. In `installModelStubs`, extend the `AppraisalTemplate` stub set to match the pattern already used for `AppraisalFeedback`, adding: `find`, `findOneAndUpdate`, `updateOne`, `updateMany`, `exists`, `countDocuments`. `AppraisalCycle` needs `exists` and `updateMany` added the same way.

`findOneAndUpdate` must support `{upsert: true, new: true}` with `$setOnInsert`, and must **throw `{code: 11000}`** when the insert would violate the `{tenant}` partial unique index — i.e. when a row already matches `{tenant, isDefault: true, isLatest: true}`. Without that the concurrency test in Step 2 cannot fail for the right reason.

> Read the controllers under `server/__tests__/` before touching this file; the header comment lists exactly which query-chain methods are currently covered.

- [ ] **Step 2: Write the failing tests**

Create `server/__tests__/appraisalTemplateDefault.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness } = require('./helpers/appraisalHarness');

const oid = () => new mongoose.Types.ObjectId();

const cycles = require('../controllers/appraisalCycle.controller');
const AppraisalTemplate = require('../models/AppraisalTemplate');

test('ensureDefaultTemplate seeds exactly one default template', async (t) => {
  const tenant = oid();
  const user = { _id: oid(), tenant, role: 'tenant_admin' };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);

  const first = await cycles.ensureDefaultTemplate(tenant, user._id);
  assert.ok(first, 'must return a template');
  assert.strictEqual(first.isDefault, true);
  assert.strictEqual(first.isLatest, true);
  assert.strictEqual(first.version, 1);
  assert.ok(first.family, 'must carry a family id');
  assert.strictEqual(h.db.templates.length, 1);
});

test('ensureDefaultTemplate is idempotent — a second call reuses the first', async (t) => {
  const tenant = oid();
  const user = { _id: oid(), tenant, role: 'tenant_admin' };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);

  const first = await cycles.ensureDefaultTemplate(tenant, user._id);
  const second = await cycles.ensureDefaultTemplate(tenant, user._id);

  assert.strictEqual(String(first._id), String(second._id));
  assert.strictEqual(h.db.templates.length, 1);
});

test('concurrent first-ever calls still yield one default template', async (t) => {
  const tenant = oid();
  const user = { _id: oid(), tenant, role: 'tenant_admin' };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);

  // The exact race the Phase 1 ledger left open: two createCycle calls for a
  // tenant that has never had a template. findOne-then-create produced two.
  const [a, b] = await Promise.all([
    cycles.ensureDefaultTemplate(tenant, user._id),
    cycles.ensureDefaultTemplate(tenant, user._id),
  ]);

  assert.strictEqual(h.db.templates.length, 1, 'must not seed two defaults');
  assert.strictEqual(String(a._id), String(b._id));
});

test('a duplicate-key race re-reads the winner rather than throwing', async (t) => {
  const tenant = oid();
  const user = { _id: oid(), tenant, role: 'tenant_admin' };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);

  const winner = await cycles.ensureDefaultTemplate(tenant, user._id);

  // Force the upsert path to lose exactly once, as the loser of a real race
  // does, and assert the controller recovers by reading instead of 500ing.
  const realUpdate = AppraisalTemplate.findOneAndUpdate;
  let thrown = false;
  AppraisalTemplate.findOneAndUpdate = async (...args) => {
    if (!thrown) {
      thrown = true;
      const err = new Error('E11000 duplicate key error');
      err.code = 11000;
      throw err;
    }
    return realUpdate.apply(AppraisalTemplate, args);
  };
  t.after(() => { AppraisalTemplate.findOneAndUpdate = realUpdate; });

  const loser = await cycles.ensureDefaultTemplate(tenant, user._id);
  assert.strictEqual(String(loser._id), String(winner._id));
});

test('buildDefaultTemplate stamps the version fields', () => {
  const { buildDefaultTemplate } = require('../services/appraisal.helpers');
  const tenant = oid();
  const doc = buildDefaultTemplate(tenant, oid());

  assert.ok(doc.family, 'must generate a family id');
  assert.strictEqual(doc.version, 1);
  assert.strictEqual(doc.isLatest, true);
  assert.strictEqual(doc.isDefault, true);
});

test('two buildDefaultTemplate calls generate DIFFERENT family ids', () => {
  const { buildDefaultTemplate } = require('../services/appraisal.helpers');
  const a = buildDefaultTemplate(oid(), oid());
  const b = buildDefaultTemplate(oid(), oid());
  // A shared family id would make two unrelated tenants' defaults look like
  // versions of one another.
  assert.notStrictEqual(String(a.family), String(b.family));
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd server && node --test __tests__/appraisalTemplateDefault.test.js`
Expected: FAIL — `cycles.ensureDefaultTemplate is not a function`.

- [ ] **Step 4: Stamp the version fields in `buildDefaultTemplate`**

In `server/services/appraisal.helpers.js`, `buildDefaultTemplate` returns an object literal. Add at the top of the function body and to the returned object:

```js
function buildDefaultTemplate(tenantId, createdBy) {
  const all = ['self', 'manager', 'peer'];
  return {
    tenant: tenantId,
    // Generated per call, never shared: a fixed family id would make two
    // unrelated tenants' default templates look like versions of each other.
    family: new mongoose.Types.ObjectId(),
    version: 1,
    isLatest: true,
    isDefault: true,
    name: 'General Performance Review',
    // …rest unchanged…
```

`appraisal.helpers.js` does not currently require mongoose. Add `const mongoose = require('mongoose');` at the top of the file. This is the only non-pure line in the module and it is deliberate — the alternative is threading an id generator through every caller.

- [ ] **Step 5: Make `ensureDefaultTemplate` atomic**

Replace `server/controllers/appraisalCycle.controller.js:10-15` with:

```js
/**
 * Resolve the tenant's default template, seeding it on first use.
 *
 * Atomic upsert, not findOne-then-create. The old form was check-then-act:
 * two concurrent first-ever createCycle calls for one tenant both saw no
 * template and both created one. The `{tenant}` partial unique index (filtered
 * to isDefault+isLatest) makes that impossible to write; the upsert makes the
 * winner returnable and the 11000 catch makes the loser recover by reading
 * rather than 500ing.
 *
 * Exported for testing: the concurrency behaviour is the whole point and is
 * not reachable through createCycle alone.
 */
async function ensureDefaultTemplate(tenant, userId) {
  const filter = { tenant, isDefault: true, isLatest: true };
  try {
    // An upsert seeds the inserted document from its query's equality
    // predicates, so naming tenant/isDefault/isLatest in $setOnInsert too
    // raises a path conflict instead of inserting. Destructured out here.
    const { tenant: _t, isDefault: _d, isLatest: _l, ...seed } =
      buildDefaultTemplate(tenant, userId);
    return await AppraisalTemplate.findOneAndUpdate(
      filter,
      { $setOnInsert: seed },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    if (err?.code === 11000) return AppraisalTemplate.findOne(filter);
    throw err;
  }
}

exports.ensureDefaultTemplate = ensureDefaultTemplate;
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd server && node --test __tests__/appraisalTemplateDefault.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 7: Run the full suite**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -8`
Expected: `# pass 1087` / `# fail 3`.

- [ ] **Step 8: Snapshot and record**

---

### Task 3: `createCycle` takes a template family; `launchCycle` pins the version

**Files:**
- Modify: `server/models/AppraisalCycle.js`
- Modify: `server/controllers/appraisalCycle.controller.js` (`createCycle`, `launchCycle`)
- Create: `server/__tests__/appraisalTemplatePinning.test.js`

**Interfaces:**
- Consumes: Task 2's `ensureDefaultTemplate`.
- Produces: `AppraisalCycle.templateFamily`. `POST /api/appraisal-cycles` accepts `{templateFamily}`. `launchCycle` re-resolves `cycle.template` from `templateFamily` exactly once.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/appraisalTemplatePinning.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const oid = () => new mongoose.Types.ObjectId();
const cycles = require('../controllers/appraisalCycle.controller');

function hrUser(tenant) {
  return { _id: oid(), tenant, role: 'tenant_admin' };
}

test('createCycle stores both the family and the current latest version', async (t) => {
  const tenant = oid();
  const hr = hrUser(tenant);
  const family = oid();
  const v1 = { _id: oid(), tenant, family, version: 1, isLatest: true, name: 'Eng 360' };
  const h = makeHarness({ users: [hr], template: v1 });
  t.after(h.restore);

  const res = capture();
  await cycles.createCycle(
    asUser(hr, { body: { name: '2026 H2', templateFamily: String(family) } }),
    res,
    (e) => { throw e; }
  );

  assert.strictEqual(res.status, 201);
  assert.strictEqual(String(res.body.data.templateFamily), String(family));
  assert.strictEqual(String(res.body.data.template), String(v1._id));
});

test('createCycle rejects a template family from another tenant', async (t) => {
  const tenant = oid();
  const hr = hrUser(tenant);
  const foreign = { _id: oid(), tenant: oid(), family: oid(), version: 1, isLatest: true };
  const h = makeHarness({ users: [hr], template: foreign });
  t.after(h.restore);

  const res = capture();
  await cycles.createCycle(
    asUser(hr, { body: { name: 'X', templateFamily: String(foreign.family) } }),
    res,
    (e) => { throw e; }
  );

  // 400, not 404: the family id is caller-supplied input to a create, not a
  // resource being addressed. It must never resolve across the tenant line.
  assert.strictEqual(res.status, 400);
  assert.strictEqual(h.db.cycles.length, 0);
});

test('createCycle with no templateFamily falls back to the tenant default', async (t) => {
  const tenant = oid();
  const hr = hrUser(tenant);
  const h = makeHarness({ users: [hr] });
  t.after(h.restore);

  const res = capture();
  await cycles.createCycle(asUser(hr, { body: { name: 'Fallback' } }), res, (e) => { throw e; });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(h.db.templates.length, 1);
  assert.strictEqual(h.db.templates[0].isDefault, true);
  assert.strictEqual(String(res.body.data.template), String(h.db.templates[0]._id));
});

test('launchCycle re-resolves the template to the family latest', async (t) => {
  const tenant = oid();
  const hr = hrUser(tenant);
  const family = oid();
  const v1 = { _id: oid(), tenant, family, version: 1, isLatest: false, name: 'T' };
  const employee = { _id: oid(), tenant, role: 'tenant_staff', status: 'active' };
  const manager = { _id: oid(), tenant, role: 'tenant_staff', status: 'active' };
  employee.employeeProfile = { work: { manager: manager._id } };

  const cycleId = oid();
  const h = makeHarness({
    users: [hr, employee, manager],
    template: v1,
    cycle: { _id: cycleId, tenant, name: 'C', templateFamily: family, template: v1._id, status: 'draft' },
  });
  t.after(h.restore);

  // A v2 was forked after the cycle was created but before it launched.
  const v2 = { _id: oid(), tenant, family, version: 2, isLatest: true, name: 'T', sections: [] };
  h.db.templates.push(v2);

  const res = capture();
  await cycles.launchCycle(
    asUser(hr, { params: { id: String(cycleId) }, body: { employeeIds: [String(employee._id)] } }),
    res,
    (e) => { throw e; }
  );

  assert.strictEqual(res.status, 200);
  const stored = h.db.cycles.find((c) => String(c._id) === String(cycleId));
  assert.strictEqual(String(stored.template), String(v2._id),
    'an edit made while the cycle was still draft must be picked up at launch');
});

test('launchCycle does NOT re-pin a cycle that has already launched', async (t) => {
  const tenant = oid();
  const hr = hrUser(tenant);
  const family = oid();
  const v1 = { _id: oid(), tenant, family, version: 1, isLatest: false };
  const cycleId = oid();
  const h = makeHarness({
    users: [hr],
    template: v1,
    cycle: {
      _id: cycleId, tenant, name: 'C', templateFamily: family, template: v1._id,
      status: 'collecting', launchedAt: new Date('2026-01-01'),
    },
  });
  t.after(h.restore);

  const v2 = { _id: oid(), tenant, family, version: 2, isLatest: true };
  h.db.templates.push(v2);

  const res = capture();
  await cycles.launchCycle(
    asUser(hr, { params: { id: String(cycleId) }, body: { employeeIds: [] } }),
    res,
    (e) => { throw e; }
  );

  const stored = h.db.cycles.find((c) => String(c._id) === String(cycleId));
  assert.strictEqual(String(stored.template), String(v1._id),
    're-launching an already-launched cycle must not move it onto a newer form');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd server && node --test __tests__/appraisalTemplatePinning.test.js`
Expected: FAIL — `templateFamily` is undefined on the created cycle.

- [ ] **Step 3: Add `templateFamily` to the cycle model**

In `server/models/AppraisalCycle.js`, after the `template` field:

```js
    // The template FAMILY HR chose. `template` above is the concrete pinned
    // version, re-resolved from this family exactly once at launch and frozen
    // thereafter — so a form edited mid-cycle cannot rewrite an appraisal in
    // flight, while an edit made while the cycle is still draft is picked up.
    templateFamily: { type: Schema.Types.ObjectId, ref: 'AppraisalTemplate', index: true },
```

- [ ] **Step 4: Resolve the family in `createCycle`**

In `server/controllers/appraisalCycle.controller.js`, inside `createCycle`, replace the `const template = await ensureDefaultTemplate(...)` line with:

```js
    // A caller-supplied family is resolved through a tenant-scoped query and
    // never trusted from the body. Rejected as a 400 rather than silently
    // falling back to the default: an HR user who picked a form and got a
    // different one has been misled about what they launched.
    let template;
    if (req.body.templateFamily) {
      template = await AppraisalTemplate.findOne({
        tenant: req.tenant._id,
        family: req.body.templateFamily,
        isLatest: true,
        isArchived: false,
      });
      if (!template) {
        return res.status(400).json({
          success: false,
          message: 'That appraisal form could not be found, or has been archived.',
        });
      }
    } else {
      template = await ensureDefaultTemplate(req.tenant._id, req.user._id);
    }
```

And add `templateFamily: template.family,` to the `AppraisalCycle.create({...})` object, alongside `template: template._id`.

- [ ] **Step 5: Pin the version in `launchCycle`**

In `launchCycle`, immediately after the existing `if (cycle.status === 'closed' || …)` guard, insert:

```js
    // Pin the concrete template version, once. A cycle still in draft picks up
    // any edit made since it was created; a cycle that has already launched
    // keeps the exact version its in-flight appraisals were written against.
    // `launchedAt` is the marker, not `status`: re-launching to pick up newly
    // added employees is an idempotent, supported action and must not move the
    // existing appraisals onto a newer form.
    if (!cycle.launchedAt && cycle.templateFamily) {
      const latest = await AppraisalTemplate.findOne({
        tenant: req.tenant._id,
        family: cycle.templateFamily,
        isLatest: true,
      }).select('_id');
      if (latest) cycle.template = latest._id;
    }
```

This sits before the `cycle.save()` at the end of the handler, which already persists it.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd server && node --test __tests__/appraisalTemplatePinning.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 7: Run the full suite**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -8`
Expected: `# pass 1092` / `# fail 3`.

- [ ] **Step 8: Snapshot and record**

---

### Task 4: Template read endpoints and router wiring

**Files:**
- Create: `server/controllers/appraisalTemplate.controller.js`
- Modify: `server/routes/appraisal.routes.js`
- Modify: `server/server.js:244-247`
- Create: `server/__tests__/appraisalTemplateRead.test.js`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: `listTemplates`, `getTemplate`, `listVersions`, `createTemplate` on the new controller; `templateRouter` exported from `appraisal.routes.js`; `/api/appraisal-templates` mounted.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/appraisalTemplateRead.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const oid = () => new mongoose.Types.ObjectId();
const templates = require('../controllers/appraisalTemplate.controller');

const hr = (tenant) => ({ _id: oid(), tenant, role: 'tenant_admin' });

test('listTemplates returns only the latest version of each family', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const famA = oid();
  const famB = oid();
  const h = makeHarness({ users: [user] });
  t.after(h.restore);

  h.db.templates.push(
    { _id: oid(), tenant, family: famA, version: 1, isLatest: false, name: 'A', isArchived: false },
    { _id: oid(), tenant, family: famA, version: 2, isLatest: true, name: 'A', isArchived: false },
    { _id: oid(), tenant, family: famB, version: 1, isLatest: true, name: 'B', isArchived: false }
  );

  const res = capture();
  await templates.listTemplates(asUser(user), res, (e) => { throw e; });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.length, 2);
  assert.deepStrictEqual(res.body.data.map((x) => x.version).sort(), [1, 2]);
});

test('listTemplates never returns another tenant\'s templates', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const h = makeHarness({ users: [user] });
  t.after(h.restore);

  h.db.templates.push(
    { _id: oid(), tenant, family: oid(), version: 1, isLatest: true, name: 'Mine', isArchived: false },
    { _id: oid(), tenant: oid(), family: oid(), version: 1, isLatest: true, name: 'Theirs', isArchived: false }
  );

  const res = capture();
  await templates.listTemplates(asUser(user), res, (e) => { throw e; });

  assert.strictEqual(res.body.data.length, 1);
  assert.strictEqual(res.body.data[0].name, 'Mine');
});

test('getTemplate 404s for a foreign-tenant id', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const foreign = { _id: oid(), tenant: oid(), family: oid(), version: 1, isLatest: true };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);
  h.db.templates.push(foreign);

  const res = capture();
  await templates.getTemplate(
    asUser(user, { params: { id: String(foreign._id) } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 404);
});

test('listVersions returns the family newest-first, scoped to the tenant', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const family = oid();
  const v1 = { _id: oid(), tenant, family, version: 1, isLatest: false, name: 'T' };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);
  h.db.templates.push(v1, { _id: oid(), tenant, family, version: 2, isLatest: true, name: 'T' });

  const res = capture();
  await templates.listVersions(
    asUser(user, { params: { id: String(v1._id) } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body.data.map((x) => x.version), [2, 1]);
});

test('createTemplate starts a new family at v1, never default', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const h = makeHarness({ users: [user] });
  t.after(h.restore);

  const res = capture();
  await templates.createTemplate(
    asUser(user, {
      body: {
        name: 'Engineering 360',
        sections: [{ title: 'Delivery', questions: [
          { type: 'rating', label: 'Ships reliably', scaleMax: 5, askOf: ['self', 'manager', 'peer'] },
        ] }],
      },
    }),
    res,
    (e) => { throw e; }
  );

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.version, 1);
  assert.strictEqual(res.body.data.isLatest, true);
  // Only ensureDefaultTemplate may mint the default; an HR-authored template
  // claiming isDefault would collide on the partial unique index and, worse,
  // silently change which form every future cycle falls back to.
  assert.strictEqual(res.body.data.isDefault, false);
  assert.ok(res.body.data.family);
});

test('createTemplate rejects a body with no sections', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const h = makeHarness({ users: [user] });
  t.after(h.restore);

  const res = capture();
  await templates.createTemplate(
    asUser(user, { body: { name: 'Empty', sections: [] } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 400);
  assert.strictEqual(h.db.templates.length, 0);
});

test('createTemplate rejects a section with no questions', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const h = makeHarness({ users: [user] });
  t.after(h.restore);

  const res = capture();
  await templates.createTemplate(
    asUser(user, { body: { name: 'Hollow', sections: [{ title: 'Empty', questions: [] }] } }),
    res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 400);
});

test('createTemplate ignores a caller-supplied family, version and isDefault', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const h = makeHarness({ users: [user] });
  t.after(h.restore);
  const injected = oid();

  const res = capture();
  await templates.createTemplate(
    asUser(user, {
      body: {
        name: 'Injected', family: String(injected), version: 99, isDefault: true, isLatest: true,
        sections: [{ title: 'S', questions: [{ type: 'text', label: 'Q', askOf: ['self'] }] }],
      },
    }),
    res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 201);
  assert.notStrictEqual(String(res.body.data.family), String(injected));
  assert.strictEqual(res.body.data.version, 1);
  assert.strictEqual(res.body.data.isDefault, false);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd server && node --test __tests__/appraisalTemplateRead.test.js`
Expected: FAIL — `Cannot find module '../controllers/appraisalTemplate.controller'`.

- [ ] **Step 3: Write the controller**

Create `server/controllers/appraisalTemplate.controller.js`:

```js
// server/controllers/appraisalTemplate.controller.js — HR-facing form builder
//
// Templates are copy-on-write versioned: `family` is stable, `version`
// increments, and exactly one row per family carries `isLatest`. A cycle pins
// a concrete version at launch, so editing a form never rewrites an appraisal
// an employee has already signed off on.
const mongoose = require('mongoose');
const AppraisalTemplate = require('../models/AppraisalTemplate');

/**
 * Structural rules a Mongoose schema cannot express. Everything else —
 * required labels, the askOf enum, scaleMax bounds — is left to schema
 * validation, which the global handler in server.js turns into a 400 carrying
 * `fields: [...]` for the form to highlight.
 */
function validateTemplateShape(sections) {
  const errors = [];
  if (!Array.isArray(sections) || sections.length === 0) {
    errors.push('A form needs at least one section.');
    return errors;
  }
  sections.forEach((s, i) => {
    if (!Array.isArray(s?.questions) || s.questions.length === 0) {
      errors.push(`Section ${i + 1} ("${s?.title || 'untitled'}") needs at least one question.`);
    }
  });
  return errors;
}

/**
 * The subset of a request body a caller may set. `family`, `version`,
 * `isLatest` and `isDefault` are deliberately absent: they are the versioning
 * machinery's own state. A caller-supplied `isDefault` would collide on the
 * partial unique index and silently change which form every future cycle
 * falls back to.
 */
function pickWritableFields(body) {
  return {
    name: body?.name,
    description: body?.description,
    sections: body?.sections,
  };
}

exports.listTemplates = async (req, res, next) => {
  try {
    const rows = await AppraisalTemplate.find({
      tenant: req.tenant._id,
      isLatest: true,
      isArchived: false,
    })
      .sort({ isDefault: -1, name: 1 })
      .lean();
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getTemplate = async (req, res, next) => {
  try {
    const row = await AppraisalTemplate.findOne({
      _id: req.params.id,
      tenant: req.tenant._id,
    }).lean();
    if (!row) return res.status(404).json({ success: false, message: 'Form not found' });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

exports.listVersions = async (req, res, next) => {
  try {
    const row = await AppraisalTemplate.findOne({
      _id: req.params.id,
      tenant: req.tenant._id,
    }).select('family').lean();
    if (!row) return res.status(404).json({ success: false, message: 'Form not found' });

    const versions = await AppraisalTemplate.find({
      tenant: req.tenant._id,
      family: row.family,
    })
      .select('_id version isLatest isArchived name createdBy createdAt')
      .sort({ version: -1 })
      .lean();
    res.json({ success: true, data: versions });
  } catch (err) { next(err); }
};

exports.createTemplate = async (req, res, next) => {
  try {
    const fields = pickWritableFields(req.body);
    const errors = validateTemplateShape(fields.sections);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(' '), fields: ['sections'] });
    }

    const created = await AppraisalTemplate.create({
      ...fields,
      tenant: req.tenant._id,
      family: new mongoose.Types.ObjectId(),
      version: 1,
      isLatest: true,
      isDefault: false,
      isArchived: false,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) { next(err); }
};

exports.validateTemplateShape = validateTemplateShape;
exports.pickWritableFields = pickWritableFields;
```

- [ ] **Step 4: Wire the router**

In `server/routes/appraisal.routes.js`, add after the `feedback` require:

```js
const templates = require('../controllers/appraisalTemplate.controller');
```

Add `const templateRouter = express.Router();` beside the other three, add `templateRouter` to the `for (const r of [...])` middleware loop, and add the route block after the cycles block:

```js
// ── HR: form builder ────────────────────────────────────────────────────────
templateRouter.use(tenantAdminOrSuperAdmin);
templateRouter.route('/').get(templates.listTemplates).post(templates.createTemplate);
templateRouter.route('/:id').get(templates.getTemplate);
templateRouter.get('/:id/versions', templates.listVersions);
```

Export it: `module.exports = { cycleRouter, appraisalRouter, feedbackRouter, templateRouter };`

- [ ] **Step 5: Mount it**

In `server/server.js`, after line 247:

```js
app.use('/api/appraisal-templates', appraisalRouters.templateRouter);
```

> The continuation brief claims this router is already wired. It is not — `server.js:245-247` mounts exactly three appraisal routers. Verify before assuming.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd server && node --test __tests__/appraisalTemplateRead.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 7: Run the full suite**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -8`
Expected: `# pass 1100` / `# fail 3`.

- [ ] **Step 8: Snapshot and record**

---

### Task 5: Edit — in place or fork

**Files:**
- Modify: `server/controllers/appraisalTemplate.controller.js`
- Modify: `server/routes/appraisal.routes.js`
- Create: `server/__tests__/appraisalTemplateFork.test.js`

**Interfaces:**
- Consumes: Task 4's controller and router.
- Produces: `updateTemplate` and `archiveTemplate` on the controller; `PUT /:id` and `POST /:id/archive` routed.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/appraisalTemplateFork.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const oid = () => new mongoose.Types.ObjectId();
const templates = require('../controllers/appraisalTemplate.controller');

const hr = (tenant) => ({ _id: oid(), tenant, role: 'tenant_admin' });
const sections = (label) => [{ title: 'S', questions: [{ type: 'text', label, askOf: ['self'] }] }];

test('editing a template with no launched cycle saves IN PLACE', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const family = oid();
  const v1 = {
    _id: oid(), tenant, family, version: 1, isLatest: true,
    name: 'Draft form', sections: sections('Old'), isArchived: false,
  };
  const h = makeHarness({ users: [user], template: v1 });
  t.after(h.restore);

  const res = capture();
  await templates.updateTemplate(
    asUser(user, { params: { id: String(v1._id) }, body: { name: 'Renamed', sections: sections('New') } }),
    res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.version, 1);
  assert.strictEqual(res.body.data.forked, undefined);
  assert.strictEqual(h.db.templates.length, 1, 'must not create a second version');
  assert.strictEqual(h.db.templates[0].name, 'Renamed');
});

test('editing a template with a LAUNCHED cycle forks a new version', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const family = oid();
  const v1 = {
    _id: oid(), tenant, family, version: 1, isLatest: true,
    name: 'Live form', sections: sections('Old'), isArchived: false,
  };
  const h = makeHarness({
    users: [user],
    template: v1,
    cycle: {
      _id: oid(), tenant, name: 'Running', templateFamily: family, template: v1._id,
      status: 'collecting', launchedAt: new Date('2026-02-01'),
    },
  });
  t.after(h.restore);

  const res = capture();
  await templates.updateTemplate(
    asUser(user, { params: { id: String(v1._id) }, body: { name: 'Live form', sections: sections('New') } }),
    res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.version, 2);
  assert.strictEqual(res.body.data.forked, true);
  assert.strictEqual(h.db.templates.length, 2);

  const stored = h.db.templates;
  const old = stored.find((x) => x.version === 1);
  const next = stored.find((x) => x.version === 2);
  assert.strictEqual(old.isLatest, false, 'exactly one isLatest per family');
  assert.strictEqual(next.isLatest, true);
  assert.strictEqual(old.sections[0].questions[0].label, 'Old',
    'the launched cycle\'s version must be untouched');
  assert.strictEqual(String(old.family), String(next.family));
});

test('a fork carries the same family and increments from the CURRENT max version', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const family = oid();
  const v2 = {
    _id: oid(), tenant, family, version: 2, isLatest: true,
    name: 'F', sections: sections('Old'), isArchived: false,
  };
  const h = makeHarness({
    users: [user],
    template: v2,
    cycle: {
      _id: oid(), tenant, name: 'R', templateFamily: family, template: v2._id,
      status: 'collecting', launchedAt: new Date(),
    },
  });
  t.after(h.restore);
  h.db.templates.push({ _id: oid(), tenant, family, version: 1, isLatest: false, name: 'F' });

  const res = capture();
  await templates.updateTemplate(
    asUser(user, { params: { id: String(v2._id) }, body: { name: 'F', sections: sections('New') } }),
    res, (e) => { throw e; }
  );

  assert.strictEqual(res.body.data.version, 3);
});

test('the fork survives a transaction replay — exactly one v2, one isLatest', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const family = oid();
  const v1 = {
    _id: oid(), tenant, family, version: 1, isLatest: true,
    name: 'F', sections: sections('Old'), isArchived: false,
  };
  const h = makeHarness({
    users: [user],
    template: v1,
    cycle: {
      _id: oid(), tenant, name: 'R', templateFamily: family, template: v1._id,
      status: 'collecting', launchedAt: new Date(),
    },
  });
  t.after(h.restore);

  // withTransaction re-runs its WHOLE callback on a transient error. If the
  // fork reuses a document loaded outside the callback, the replay writes
  // twice — the exact hazard that cost this module a double-count in Phase 1
  // and a silent feedback-row loss in Phase 2.
  h.failNextTransaction();

  const res = capture();
  await templates.updateTemplate(
    asUser(user, { params: { id: String(v1._id) }, body: { name: 'F', sections: sections('New') } }),
    res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 200);
  const family2 = h.db.templates.filter((x) => String(x.family) === String(family));
  assert.strictEqual(family2.length, 2, 'a replay must not leave three rows');
  assert.strictEqual(family2.filter((x) => x.isLatest).length, 1);
  assert.strictEqual(family2.filter((x) => x.version === 2).length, 1);
});

test('updateTemplate 404s for a foreign-tenant id', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const foreign = { _id: oid(), tenant: oid(), family: oid(), version: 1, isLatest: true, sections: sections('X') };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);
  h.db.templates.push(foreign);

  const res = capture();
  await templates.updateTemplate(
    asUser(user, { params: { id: String(foreign._id) }, body: { name: 'Hijack', sections: sections('Y') } }),
    res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 404);
  assert.strictEqual(h.db.templates[0].name, undefined);
});

test('updateTemplate refuses to edit a non-latest version', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const family = oid();
  const v1 = { _id: oid(), tenant, family, version: 1, isLatest: false, name: 'F', sections: sections('Old') };
  const h = makeHarness({ users: [user], template: v1 });
  t.after(h.restore);
  h.db.templates.push({ _id: oid(), tenant, family, version: 2, isLatest: true, name: 'F' });

  const res = capture();
  await templates.updateTemplate(
    asUser(user, { params: { id: String(v1._id) }, body: { name: 'F', sections: sections('New') } }),
    res, (e) => { throw e; }
  );

  // Editing a superseded version would fork from stale content and produce a
  // v3 that silently discards v2's changes.
  assert.strictEqual(res.status, 400);
});

test('archiveTemplate archives EVERY version of the family', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const family = oid();
  const v2 = { _id: oid(), tenant, family, version: 2, isLatest: true, name: 'F', isArchived: false };
  const h = makeHarness({ users: [user], template: v2 });
  t.after(h.restore);
  h.db.templates.push({ _id: oid(), tenant, family, version: 1, isLatest: false, name: 'F', isArchived: false });

  const res = capture();
  await templates.archiveTemplate(
    asUser(user, { params: { id: String(v2._id) } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 200);
  assert.ok(h.db.templates.every((x) => x.isArchived === true),
    'a historical cycle still resolves its pinned version by _id, so archiving all versions is safe and keeps the family out of new cycles');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd server && node --test __tests__/appraisalTemplateFork.test.js`
Expected: FAIL — `templates.updateTemplate is not a function`.

- [ ] **Step 3: Implement update and archive**

Append to `server/controllers/appraisalTemplate.controller.js` (and add `const AppraisalCycle = require('../models/AppraisalCycle');` to its requires):

```js
/**
 * Edit a form — in place, or by forking a new version.
 *
 * The branch is one question: has any cycle pinned to this version actually
 * launched? Not launched → edit in place. Launched → fork, because appraisals
 * exist and reviewers may have the form open, so an edit is already capable of
 * changing a question under someone mid-answer even before anything is
 * submitted.
 */
exports.updateTemplate = async (req, res, next) => {
  try {
    const current = await AppraisalTemplate.findOne({
      _id: req.params.id,
      tenant: req.tenant._id,
    }).lean();
    if (!current) return res.status(404).json({ success: false, message: 'Form not found' });

    // Editing a superseded version would fork from stale content and produce a
    // version that silently discards whatever the newer one changed.
    if (!current.isLatest) {
      return res.status(400).json({
        success: false,
        message: 'This is an older version of the form. Open the current version to edit it.',
      });
    }

    const fields = pickWritableFields(req.body);
    const errors = validateTemplateShape(fields.sections);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(' '), fields: ['sections'] });
    }

    const launched = await AppraisalCycle.exists({
      tenant: req.tenant._id,
      template: current._id,
      launchedAt: { $ne: null },
    });

    if (!launched) {
      const saved = await AppraisalTemplate.findOneAndUpdate(
        { _id: current._id, tenant: req.tenant._id },
        { $set: { ...fields, updatedBy: req.user._id } },
        { new: true, runValidators: true }
      );
      return res.json({ success: true, data: saved });
    }

    // Two-document write: clear the old isLatest, then insert the new version.
    // The {tenant, family} partial unique index makes two isLatest rows
    // impossible to write, so a non-atomic fork does not corrupt data — it
    // fails halfway, and a crash between the two leaves the family with NO
    // latest version, which is what createCycle resolves against.
    const session = await mongoose.startSession();
    let forked = null;
    try {
      await session.withTransaction(async () => {
        // Re-read INSIDE the callback. withTransaction re-runs the whole
        // callback on a transient error; a document loaded outside it would
        // be reused across attempts and write twice.
        const fresh = await AppraisalTemplate.findOne({
          _id: current._id, tenant: req.tenant._id,
        }).session(session);
        if (!fresh) throw Object.assign(new Error('Form not found'), { status: 404 });

        const maxVersion = await AppraisalTemplate.find({
          tenant: req.tenant._id, family: fresh.family,
        }).select('version').sort({ version: -1 }).limit(1).session(session);
        const nextVersion = (maxVersion[0]?.version || fresh.version) + 1;

        // Order matters: clear before inserting, or the unique index rejects.
        await AppraisalTemplate.updateOne(
          { _id: fresh._id }, { $set: { isLatest: false } }, { session }
        );
        const [next] = await AppraisalTemplate.create([{
          tenant: req.tenant._id,
          family: fresh.family,
          version: nextVersion,
          isLatest: true,
          isDefault: fresh.isDefault,
          isArchived: false,
          createdBy: req.user._id,
          ...fields,
        }], { session });
        forked = next;
      });
    } finally {
      session.endSession();
    }

    // Assigned inside the callback but read only after it commits — never
    // accumulated across attempts.
    const data = forked.toObject ? forked.toObject() : { ...forked };
    res.json({ success: true, data: { ...data, forked: true } });
  } catch (err) { next(err); }
};

/**
 * Archive every version of the family. Archiving means "do not offer for new
 * cycles"; it does not affect reads, so a historical cycle still resolves its
 * pinned version by _id and renders exactly as before.
 */
exports.archiveTemplate = async (req, res, next) => {
  try {
    const row = await AppraisalTemplate.findOne({
      _id: req.params.id, tenant: req.tenant._id,
    }).select('family isDefault').lean();
    if (!row) return res.status(404).json({ success: false, message: 'Form not found' });

    // The default is what createCycle falls back to when HR names no form.
    // Archiving it would make ensureDefaultTemplate seed a second one and
    // quietly change which questions every future cycle asks.
    if (row.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'The default form cannot be archived. Make another form the default first.',
      });
    }

    await AppraisalTemplate.updateMany(
      { tenant: req.tenant._id, family: row.family },
      { $set: { isArchived: true } }
    );
    res.json({ success: true, data: { family: row.family, archived: true } });
  } catch (err) { next(err); }
};
```

> `isDefault` is copied onto the fork so the default family stays the default across versions. The `{tenant}` partial unique index tolerates this precisely because the old row's `isLatest` is cleared in the same transaction.

- [ ] **Step 4: Route them**

In `server/routes/appraisal.routes.js`, extend the template block:

```js
templateRouter.route('/:id').get(templates.getTemplate).put(templates.updateTemplate);
templateRouter.post('/:id/archive', templates.archiveTemplate);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd server && node --test __tests__/appraisalTemplateFork.test.js`
Expected: PASS, 7 tests.

> The archive test asserts `isDefault: false` is not set on the fixture. If the "default cannot be archived" branch fires, the fixture needs `isDefault: false` explicitly — check which before changing the implementation.

- [ ] **Step 6: Run the full suite**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -8`
Expected: `# pass 1107` / `# fail 3`.

- [ ] **Step 7: Snapshot and record**

---

### Task 6: Backfill migration script

**Files:**
- Create: `server/scripts/backfill-appraisal-template-versions.js`
- Create: `server/__tests__/appraisalTemplateBackfill.test.js`

**Interfaces:**
- Consumes: Task 1's schema.
- Produces: `planTemplateBackfill(templates)` — a pure function the script and its test share.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/appraisalTemplateBackfill.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { planTemplateBackfill } = require('../scripts/backfill-appraisal-template-versions');

const oid = () => new mongoose.Types.ObjectId();

test('a template with no family becomes v1, latest, family = its own _id', () => {
  const t1 = { _id: oid(), tenant: oid(), isArchived: false, createdAt: new Date('2026-01-01') };
  const plan = planTemplateBackfill([t1]);

  assert.strictEqual(plan.length, 1);
  assert.strictEqual(String(plan[0]._id), String(t1._id));
  assert.strictEqual(String(plan[0].set.family), String(t1._id));
  assert.strictEqual(plan[0].set.version, 1);
  assert.strictEqual(plan[0].set.isLatest, true);
});

test('the oldest non-archived template per tenant becomes the default', () => {
  const tenant = oid();
  const older = { _id: oid(), tenant, isArchived: false, createdAt: new Date('2026-01-01') };
  const newer = { _id: oid(), tenant, isArchived: false, createdAt: new Date('2026-03-01') };

  // Fed newest-first on purpose: the script must not depend on input order.
  const plan = planTemplateBackfill([newer, older]);
  const byId = new Map(plan.map((p) => [String(p._id), p.set]));

  assert.strictEqual(byId.get(String(older._id)).isDefault, true,
    'the oldest is the one the old findOne-based ensureDefaultTemplate would have returned');
  assert.strictEqual(byId.get(String(newer._id)).isDefault, false);
});

test('an archived template is never made the default', () => {
  const tenant = oid();
  const archived = { _id: oid(), tenant, isArchived: true, createdAt: new Date('2026-01-01') };
  const live = { _id: oid(), tenant, isArchived: false, createdAt: new Date('2026-02-01') };

  const plan = planTemplateBackfill([archived, live]);
  const byId = new Map(plan.map((p) => [String(p._id), p.set]));

  assert.strictEqual(byId.get(String(archived._id)).isDefault, false);
  assert.strictEqual(byId.get(String(live._id)).isDefault, true);
});

test('each tenant gets its own default', () => {
  const a = oid();
  const b = oid();
  const ta = { _id: oid(), tenant: a, isArchived: false, createdAt: new Date('2026-01-01') };
  const tb = { _id: oid(), tenant: b, isArchived: false, createdAt: new Date('2026-01-02') };

  const plan = planTemplateBackfill([ta, tb]);
  assert.strictEqual(plan.filter((p) => p.set.isDefault).length, 2);
});

test('a template that already has a family is left alone — the script is idempotent', () => {
  const done = {
    _id: oid(), tenant: oid(), family: oid(), version: 2, isLatest: true,
    isDefault: false, isArchived: false, createdAt: new Date(),
  };
  assert.deepStrictEqual(planTemplateBackfill([done]), []);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd server && node --test __tests__/appraisalTemplateBackfill.test.js`
Expected: FAIL — `Cannot find module '../scripts/backfill-appraisal-template-versions'`.

- [ ] **Step 3: Write the script**

Create `server/scripts/backfill-appraisal-template-versions.js`:

```js
// server/scripts/backfill-appraisal-template-versions.js
//
// Phase 3 makes AppraisalTemplate copy-on-write versioned. Existing documents
// predate `family`/`version`/`isLatest`/`isDefault`, and `family` is
// `required: true` — so reads still work but any .save() of an old document
// now fails validation.
//
// Idempotent: a template that already has a family is skipped.
//
//   node scripts/backfill-appraisal-template-versions.js --dry-run
//   node scripts/backfill-appraisal-template-versions.js
require('dotenv').config();
const mongoose = require('mongoose');
const AppraisalTemplate = require('../models/AppraisalTemplate');

/**
 * Pure planner, shared with the test. Returns [{_id, set}] for every template
 * needing backfill.
 *
 * The default is the OLDEST non-archived template per tenant — the one the
 * previous `findOne({tenant, isArchived: false})` would have returned, so the
 * migration preserves which form existing cycles fall back to rather than
 * silently switching it.
 */
function planTemplateBackfill(templates) {
  const needing = (templates || []).filter((t) => !t.family);
  if (!needing.length) return [];

  const oldestLiveByTenant = new Map();
  for (const t of needing) {
    if (t.isArchived) continue;
    const key = String(t.tenant);
    const held = oldestLiveByTenant.get(key);
    const at = new Date(t.createdAt || 0).getTime();
    if (!held || at < held.at) oldestLiveByTenant.set(key, { id: String(t._id), at });
  }

  return needing.map((t) => ({
    _id: t._id,
    set: {
      family: t._id, // its own id — unique, stable, and obviously not shared
      version: 1,
      isLatest: true,
      isDefault: oldestLiveByTenant.get(String(t.tenant))?.id === String(t._id),
    },
  }));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(process.env.MONGO_URI);

  const templates = await AppraisalTemplate.find({}).select('_id tenant isArchived createdAt family').lean();
  const plan = planTemplateBackfill(templates);

  console.log(`${templates.length} templates, ${plan.length} need backfill`);
  for (const p of plan) {
    console.log(`  ${p._id} → v${p.set.version}${p.set.isDefault ? ' (default)' : ''}`);
  }

  if (dryRun) {
    console.log('Dry run — nothing written.');
  } else {
    for (const p of plan) {
      await AppraisalTemplate.updateOne({ _id: p._id }, { $set: p.set });
    }
    // Mongoose does NOT add indexes to an existing collection on its own, and
    // the partial unique index is what closes the ensureDefaultTemplate race.
    // Creating it is the point of running this script, not a side effect.
    await AppraisalTemplate.syncIndexes();
    console.log('Backfilled and indexes synced.');
  }

  await mongoose.disconnect();
}

module.exports = { planTemplateBackfill };

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd server && node --test __tests__/appraisalTemplateBackfill.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Dry-run it against Atlas**

Run: `cd server && node scripts/backfill-appraisal-template-versions.js --dry-run`
Expected: a count and a per-template line. Atlas is reachable from this machine but the link is flaky — retry once on a connection error before investigating.

**Do not run it for real yet.** Task 20's E2E does that, after the whole server side is in place.

- [ ] **Step 6: Run the full suite**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -8`
Expected: `# pass 1112` / `# fail 3`.

- [ ] **Step 7: Snapshot and record**

---

# Part B — Roster, nudges and reporting (server)

> From here on, "Expected" counts are written as *baseline + new*. The baseline
> is 1078 passing / 1081. Always confirm the 3 failures by name.

### Task 7: `outstandingActionsFor` — who is holding this up

**Files:**
- Modify: `server/services/appraisal.helpers.js`
- Modify: `server/__tests__/appraisal.helpers.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `outstandingActionsFor(appraisal, feedbackRows) → [{target, reason}]` where `reason ∈ 'nominate' | 'approve_peers' | 'feedback' | 'summarise' | 'acknowledge'`, and `NUDGE_REASONS` (the enum array), both exported from `appraisal.helpers.js`.

- [ ] **Step 1: Write the failing tests**

Append to `server/__tests__/appraisal.helpers.test.js`. Note this file uses **plain string ids** like `'u-emp'`, not ObjectIds — match that idiom.

```js
const { outstandingActionsFor, NUDGE_REASONS } = require('../services/appraisal.helpers');

const appraisalAt = (state) => ({
  _id: 'a-1', employee: 'u-emp', manager: 'u-mgr', state,
});

test('outstandingActionsFor: nominating waits on the employee', () => {
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('nominating'), []), [
    { target: 'u-emp', reason: 'nominate' },
  ]);
});

test('outstandingActionsFor: pending_peer_approval waits on the manager', () => {
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('pending_peer_approval'), []), [
    { target: 'u-mgr', reason: 'approve_peers' },
  ]);
});

test('outstandingActionsFor: collecting lists every PENDING reviewer', () => {
  const rows = [
    { reviewer: 'u-emp', kind: 'self', status: 'pending' },
    { reviewer: 'u-mgr', kind: 'manager', status: 'submitted' },
    { reviewer: 'u-p1', kind: 'peer', status: 'pending' },
    { reviewer: 'u-p2', kind: 'peer', status: 'declined' },
    { reviewer: 'u-p3', kind: 'peer', status: 'expired' },
  ];
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('collecting'), rows), [
    { target: 'u-emp', reason: 'feedback' },
    { target: 'u-p1', reason: 'feedback' },
  ]);
});

test('outstandingActionsFor: a declined or expired row is NOT outstanding', () => {
  // Nudging someone who explicitly declined is harassment, and nudging an
  // expired row asks for something the cycle no longer accepts.
  const rows = [
    { reviewer: 'u-p1', kind: 'peer', status: 'declined' },
    { reviewer: 'u-p2', kind: 'peer', status: 'expired' },
  ];
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('collecting'), rows), [
    { target: 'u-mgr', reason: 'summarise' },
  ]);
});

test('outstandingActionsFor: collecting with nothing pending waits on the manager', () => {
  const rows = [
    { reviewer: 'u-emp', kind: 'self', status: 'submitted' },
    { reviewer: 'u-mgr', kind: 'manager', status: 'submitted' },
  ];
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('collecting'), rows), [
    { target: 'u-mgr', reason: 'summarise' },
  ]);
});

test('outstandingActionsFor: summarising waits on the manager', () => {
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('summarising'), []), [
    { target: 'u-mgr', reason: 'summarise' },
  ]);
});

test('outstandingActionsFor: released waits on the employee to acknowledge', () => {
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('released'), []), [
    { target: 'u-emp', reason: 'acknowledge' },
  ]);
});

test('outstandingActionsFor: terminal states wait on nobody', () => {
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('acknowledged'), []), []);
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('cancelled'), []), []);
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('draft'), []), []);
});

test('outstandingActionsFor: tolerates null input', () => {
  assert.deepStrictEqual(outstandingActionsFor(null, null), []);
  assert.deepStrictEqual(outstandingActionsFor(appraisalAt('collecting'), null), [
    { target: 'u-mgr', reason: 'summarise' },
  ]);
});

test('outstandingActionsFor resolves populated ref objects to ids', () => {
  const a = { _id: 'a-1', employee: { _id: 'u-emp' }, manager: { _id: 'u-mgr' }, state: 'nominating' };
  assert.deepStrictEqual(outstandingActionsFor(a, []), [{ target: 'u-emp', reason: 'nominate' }]);
});

test('NUDGE_REASONS covers exactly the reasons outstandingActionsFor can emit', () => {
  assert.deepStrictEqual([...NUDGE_REASONS].sort(), [
    'acknowledge', 'approve_peers', 'feedback', 'nominate', 'summarise',
  ]);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd server && node --test __tests__/appraisal.helpers.test.js`
Expected: FAIL — `outstandingActionsFor is not a function`.

- [ ] **Step 3: Implement the helper**

In `server/services/appraisal.helpers.js`, above the `module.exports` block:

```js
// Every reason a nudge can carry. Kept beside outstandingActionsFor because
// the two must agree: a reason the planner can emit but the model's enum
// rejects fails at write time, on the one path HR uses when a cycle is
// already stuck.
const NUDGE_REASONS = ['nominate', 'approve_peers', 'feedback', 'summarise', 'acknowledge'];

/**
 * Who is holding this appraisal up, and for what.
 *
 * One definition, used by the roster (to show it) and the nudge endpoint (to
 * refuse a target who is not actually outstanding — which is also what stops
 * the endpoint being used to probe who is on an appraisal).
 *
 * A 'declined' or 'expired' feedback row is NOT outstanding: nudging someone
 * who explicitly declined is harassment, and nudging an expired row asks for
 * something the cycle no longer accepts.
 */
function outstandingActionsFor(appraisal, feedbackRows) {
  if (!appraisal) return [];
  const employee = idOf(appraisal.employee);
  const manager = idOf(appraisal.manager);

  switch (appraisal.state) {
    case 'nominating':
      return [{ target: employee, reason: 'nominate' }];
    case 'pending_peer_approval':
      return [{ target: manager, reason: 'approve_peers' }];
    case 'collecting': {
      const pending = (feedbackRows || [])
        .filter((f) => f.status === 'pending')
        .map((f) => ({ target: idOf(f.reviewer), reason: 'feedback' }));
      return pending.length ? pending : [{ target: manager, reason: 'summarise' }];
    }
    case 'summarising':
      return [{ target: manager, reason: 'summarise' }];
    case 'released':
      return [{ target: employee, reason: 'acknowledge' }];
    default:
      // draft, acknowledged, cancelled — nobody owes anything.
      return [];
  }
}
```

Add `NUDGE_REASONS` and `outstandingActionsFor` to `module.exports`.

- [ ] **Step 4: Run to verify they pass**

Run: `cd server && node --test __tests__/appraisal.helpers.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite and snapshot**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -8`
Expected: baseline + all new tests so far, `# fail 3`.

---

### Task 8: The roster endpoint

**Files:**
- Modify: `server/controllers/appraisalCycle.controller.js`
- Modify: `server/routes/appraisal.routes.js`
- Create: `server/__tests__/appraisalCycleRoster.test.js`

**Interfaces:**
- Consumes: Task 7's `outstandingActionsFor`; `countApprovedPeers` from `appraisal.helpers.js`.
- Produces: `GET /api/appraisal-cycles/:id/roster` → `{data: {rows, page, limit, total}}`.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/appraisalCycleRoster.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const oid = () => new mongoose.Types.ObjectId();
const cycles = require('../controllers/appraisalCycle.controller');

function scenario() {
  const tenant = oid();
  const hr = { _id: oid(), tenant, role: 'tenant_admin' };
  const emp = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Grace', lastName: 'H' };
  const mgr = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Kofi', lastName: 'A' };
  const peer = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Ada', lastName: 'L' };
  const cycleId = oid();
  const appraisalId = oid();
  return { tenant, hr, emp, mgr, peer, cycleId, appraisalId };
}

test('roster reports per-appraisal completion and who is outstanding', async (t) => {
  const s = scenario();
  const h = makeHarness({
    users: [s.hr, s.emp, s.mgr, s.peer],
    cycle: { _id: s.cycleId, tenant: s.tenant, name: 'H2', status: 'collecting' },
  });
  t.after(h.restore);

  h.db.appraisals.push({
    _id: s.appraisalId, tenant: s.tenant, cycle: s.cycleId,
    employee: s.emp._id, manager: s.mgr._id, state: 'collecting',
    reviewerIds: [s.emp._id, s.mgr._id, s.peer._id],
    peerNominations: [{ user: s.peer._id, proposedBy: s.emp._id, status: 'approved' }],
  });
  h.db.feedback.push(
    { _id: oid(), tenant: s.tenant, appraisal: s.appraisalId, cycle: s.cycleId, reviewer: s.emp._id, kind: 'self', status: 'pending' },
    { _id: oid(), tenant: s.tenant, appraisal: s.appraisalId, cycle: s.cycleId, reviewer: s.mgr._id, kind: 'manager', status: 'submitted' },
    { _id: oid(), tenant: s.tenant, appraisal: s.appraisalId, cycle: s.cycleId, reviewer: s.peer._id, kind: 'peer', status: 'pending' }
  );

  const res = capture();
  await cycles.cycleRoster(
    asUser(s.hr, { params: { id: String(s.cycleId) } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 200);
  const [row] = res.body.data.rows;
  assert.strictEqual(row.state, 'collecting');
  assert.strictEqual(row.employee.firstName, 'Grace');
  assert.strictEqual(row.manager.firstName, 'Kofi');
  assert.strictEqual(row.self.status, 'pending');
  assert.strictEqual(row.mgr.status, 'submitted');
  assert.deepStrictEqual(row.peers, { approved: 1, submitted: 0, declined: 0, pending: 1 });
  assert.deepStrictEqual(
    row.outstanding.map((o) => o.reason).sort(),
    ['feedback', 'feedback']
  );
  assert.strictEqual(row.lastNudge, null);
});

test('roster 404s for an unknown or foreign-tenant cycle', async (t) => {
  const s = scenario();
  const h = makeHarness({ users: [s.hr] });
  t.after(h.restore);

  const res = capture();
  await cycles.cycleRoster(
    asUser(s.hr, { params: { id: String(oid()) } }), res, (e) => { throw e; }
  );
  assert.strictEqual(res.status, 404);
});

test('roster 400s on a malformed cycle id', async (t) => {
  const s = scenario();
  const h = makeHarness({ users: [s.hr] });
  t.after(h.restore);

  const res = capture();
  await cycles.cycleRoster(asUser(s.hr, { params: { id: 'not-an-id' } }), res, (e) => { throw e; });
  assert.strictEqual(res.status, 400);
});

test('roster counts approved peers via countApprovedPeers, not the raw array', async (t) => {
  const s = scenario();
  const h = makeHarness({
    users: [s.hr, s.emp, s.mgr, s.peer],
    cycle: { _id: s.cycleId, tenant: s.tenant, name: 'H2', status: 'collecting' },
  });
  t.after(h.restore);

  h.db.appraisals.push({
    _id: s.appraisalId, tenant: s.tenant, cycle: s.cycleId,
    employee: s.emp._id, manager: s.mgr._id, state: 'collecting',
    reviewerIds: [s.emp._id, s.mgr._id],
    peerNominations: [
      { user: s.peer._id, proposedBy: s.emp._id, status: 'approved' },
      { user: oid(), proposedBy: s.emp._id, status: 'rejected' },
      { user: oid(), proposedBy: s.emp._id, status: 'proposed' },
    ],
  });

  const res = capture();
  await cycles.cycleRoster(asUser(s.hr, { params: { id: String(s.cycleId) } }), res, (e) => { throw e; });

  // A rejected or still-proposed nominee is not an approved peer.
  assert.strictEqual(res.body.data.rows[0].peers.approved, 1);
});

test('roster paginates', async (t) => {
  const s = scenario();
  const h = makeHarness({
    users: [s.hr, s.emp, s.mgr],
    cycle: { _id: s.cycleId, tenant: s.tenant, name: 'H2', status: 'collecting' },
  });
  t.after(h.restore);

  for (let i = 0; i < 5; i += 1) {
    h.db.appraisals.push({
      _id: oid(), tenant: s.tenant, cycle: s.cycleId,
      employee: s.emp._id, manager: s.mgr._id, state: 'collecting',
      reviewerIds: [], peerNominations: [],
    });
  }

  const req = asUser(s.hr, { params: { id: String(s.cycleId) } });
  req.query = { page: '2', limit: '2' };

  const res = capture();
  await cycles.cycleRoster(req, res, (e) => { throw e; });

  assert.strictEqual(res.body.data.rows.length, 2);
  assert.strictEqual(res.body.data.total, 5);
  assert.strictEqual(res.body.data.page, 2);
});
```

> `asUser` builds `{user, tenant, params, body}` and does **not** set `query` — hence the explicit assignment in the pagination test. Do not "fix" this by changing `asUser`; every other appraisal test relies on its current shape.

- [ ] **Step 2: Run to verify they fail**

Run: `cd server && node --test __tests__/appraisalCycleRoster.test.js`
Expected: FAIL — `cycles.cycleRoster is not a function`.

- [ ] **Step 3: Implement the endpoint**

Extend the helper require in `server/controllers/appraisalCycle.controller.js` to:

```js
const {
  planCycleLaunch, buildDefaultTemplate, TENANT_ROLES,
  outstandingActionsFor, countApprovedPeers,
} = require('../services/appraisal.helpers');
```

Then add:

```js
/**
 * The per-employee view of a cycle. Deliberately a separate endpoint from
 * /progress, which stays a cheap counts payload: the roster is the expensive
 * read and only the dashboard's roster tab needs it.
 */
exports.cycleRoster = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid cycle id' });
    }
    const cycleId = new mongoose.Types.ObjectId(req.params.id);
    const tenantId = new mongoose.Types.ObjectId(req.tenant._id);

    const cycle = await AppraisalCycle.findOne({ _id: cycleId, tenant: tenantId }).lean();
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' });

    const page = Math.max(1, Number(req.query?.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 50));

    const [appraisals, total] = await Promise.all([
      Appraisal.find({ tenant: req.tenant._id, cycle: cycle._id })
        .populate('employee', 'firstName lastName email employeeProfile.work.jobTitle')
        .populate('manager', 'firstName lastName email')
        .sort({ state: 1, createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Appraisal.countDocuments({ tenant: req.tenant._id, cycle: cycle._id }),
    ]);

    // One read for every feedback row in the page's appraisals, grouped in
    // memory. Hits the {tenant, cycle, status} index added in the Phase 2
    // cleanup — which is exactly what that index exists for.
    const ids = appraisals.map((a) => a._id);
    const rows = ids.length
      ? await AppraisalFeedback.find({ tenant: req.tenant._id, appraisal: { $in: ids } })
          .select('appraisal reviewer kind status submittedAt')
          .lean()
      : [];
    const byAppraisal = new Map(ids.map((id) => [String(id), []]));
    for (const r of rows) byAppraisal.get(String(r.appraisal))?.push(r);

    const data = appraisals.map((a) => {
      const fb = byAppraisal.get(String(a._id)) || [];
      const peers = fb.filter((f) => f.kind === 'peer');
      const self = fb.find((f) => f.kind === 'self') || null;
      const mgr = fb.find((f) => f.kind === 'manager') || null;

      // Resolve the outstanding targets to people. HR cannot chase an
      // ObjectId — the same reason launchCycle's `skipped` was fixed in
      // Phase 2.
      const people = new Map();
      if (a.employee) people.set(String(a.employee._id), a.employee);
      if (a.manager) people.set(String(a.manager._id), a.manager);
      for (const r of fb) if (r.reviewer) people.set(String(r.reviewer), { _id: r.reviewer });

      return {
        _id: a._id,
        state: a.state,
        employee: a.employee || null,
        manager: a.manager || null,
        self: self ? { status: self.status, submittedAt: self.submittedAt } : null,
        mgr: mgr ? { status: mgr.status, submittedAt: mgr.submittedAt } : null,
        peers: {
          // The single definition of "an approved peer" — never re-filter the
          // array here. Three longhand copies is the bug it was extracted to
          // prevent.
          approved: countApprovedPeers(a),
          submitted: peers.filter((p) => p.status === 'submitted').length,
          declined: peers.filter((p) => p.status === 'declined').length,
          pending: peers.filter((p) => p.status === 'pending').length,
        },
        outstanding: outstandingActionsFor(a, fb).map((o) => ({
          reason: o.reason,
          target: people.get(String(o.target)) || { _id: o.target },
        })),
        lastNudge: null, // wired in Task 9
      };
    });

    res.json({ success: true, data: { rows: data, page, limit, total } });
  } catch (err) { next(err); }
};
```

`AppraisalFeedback.find` is called with `$in` on `appraisal`. The harness already handles `$in` on `_id`; confirm it handles it on an arbitrary field and extend the stub if not.

- [ ] **Step 4: Route it**

In `server/routes/appraisal.routes.js`, after the progress route:

```js
cycleRouter.get('/:id/roster', cycles.cycleRoster);
```

- [ ] **Step 5: Run the tests, then the full suite, then snapshot**

Run: `cd server && node --test __tests__/appraisalCycleRoster.test.js` → PASS, 5 tests.
Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -8` → baseline + new, `# fail 3`.

---

### Task 9: `AppraisalNudge` and the nudge endpoint

**Files:**
- Create: `server/models/AppraisalNudge.js`
- Modify: `server/controllers/appraisal.controller.js`
- Modify: `server/controllers/appraisalCycle.controller.js` (wire `lastNudge`)
- Modify: `server/routes/appraisal.routes.js`
- Modify: `server/services/email.service.js`
- Modify: `server/__tests__/helpers/appraisalHarness.js`
- Modify: `server/__tests__/appraisal.model.test.js`
- Create: `server/__tests__/appraisalNudge.test.js`

**Interfaces:**
- Consumes: Task 7's `outstandingActionsFor` and `NUDGE_REASONS`.
- Produces: `AppraisalNudge` model; `POST /api/appraisals/:id/nudge`; `NUDGE_MIN_INTERVAL_HOURS = 12` exported from `appraisal.helpers.js`; `sendAppraisalNudgeEmail` exported from `email.service.js`.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/appraisalNudge.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const oid = () => new mongoose.Types.ObjectId();
const appraisals = require('../controllers/appraisal.controller');
const emailService = require('../services/email.service');

function scenario({ state = 'collecting' } = {}) {
  const tenant = oid();
  const hr = { _id: oid(), tenant, role: 'tenant_admin', firstName: 'Ada' };
  const emp = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Grace', email: 'grace@wyncity.test' };
  const mgr = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Kofi', email: 'kofi@wyncity.test' };
  const cycleId = oid();
  const appraisalId = oid();

  const h = makeHarness({
    users: [hr, emp, mgr],
    cycle: { _id: cycleId, tenant, name: 'H2', status: 'collecting' },
  });
  h.db.appraisals.push({
    _id: appraisalId, tenant, cycle: cycleId, employee: emp._id, manager: mgr._id,
    state, reviewerIds: [emp._id, mgr._id], peerNominations: [],
  });
  h.db.feedback.push(
    { _id: oid(), tenant, appraisal: appraisalId, cycle: cycleId, reviewer: emp._id, kind: 'self', status: 'pending' },
    { _id: oid(), tenant, appraisal: appraisalId, cycle: cycleId, reviewer: mgr._id, kind: 'manager', status: 'submitted' }
  );
  return { tenant, hr, emp, mgr, cycleId, appraisalId, h };
}

test('an HR nudge writes a nudge row for an outstanding target', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const res = capture();
  await appraisals.nudge(
    asUser(s.hr, {
      params: { id: String(s.appraisalId) },
      body: { target: String(s.emp._id), reason: 'feedback', channel: 'app' },
    }),
    res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 201);
  assert.strictEqual(s.h.db.nudges.length, 1);
  const n = s.h.db.nudges[0];
  assert.strictEqual(String(n.target), String(s.emp._id));
  assert.strictEqual(n.reason, 'feedback');
  assert.strictEqual(n.channel, 'app');
  assert.strictEqual(String(n.sentBy), String(s.hr._id));
});

test('a nudge naming a target who is NOT outstanding is rejected', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  // The manager already submitted; nothing is owed by them at this state.
  const res = capture();
  await appraisals.nudge(
    asUser(s.hr, {
      params: { id: String(s.appraisalId) },
      body: { target: String(s.mgr._id), reason: 'feedback', channel: 'app' },
    }),
    res, (e) => { throw e; }
  );

  // 400, not 404: this is also what stops the endpoint being used to probe
  // who is on an appraisal — an arbitrary user id gets the same answer as a
  // real reviewer who simply owes nothing.
  assert.strictEqual(res.status, 400);
  assert.strictEqual(s.h.db.nudges.length, 0);
});

test('a stranger cannot nudge — only canManageCycle', async (t) => {
  const s = scenario();
  t.after(s.h.restore);
  const outsider = { _id: oid(), tenant: s.tenant, role: 'tenant_staff' };
  s.h.db.users.push(outsider);

  const res = capture();
  await appraisals.nudge(
    asUser(outsider, {
      params: { id: String(s.appraisalId) },
      body: { target: String(s.emp._id), reason: 'feedback', channel: 'app' },
    }),
    res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 403);
  assert.strictEqual(s.h.db.nudges.length, 0);
});

test('the manager cannot nudge in Phase 3 — HR only', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const res = capture();
  await appraisals.nudge(
    asUser(s.mgr, {
      params: { id: String(s.appraisalId) },
      body: { target: String(s.emp._id), reason: 'feedback', channel: 'app' },
    }),
    res, (e) => { throw e; }
  );

  // Deliberate scope decision, not an oversight: the gate is canManageCycle.
  assert.strictEqual(res.status, 403);
});

test('a repeat nudge inside the throttle window is refused with 429', async (t) => {
  const s = scenario();
  t.after(s.h.restore);
  const body = { target: String(s.emp._id), reason: 'feedback', channel: 'app' };

  const first = capture();
  await appraisals.nudge(asUser(s.hr, { params: { id: String(s.appraisalId) }, body }), first, (e) => { throw e; });
  assert.strictEqual(first.status, 201);

  const second = capture();
  await appraisals.nudge(asUser(s.hr, { params: { id: String(s.appraisalId) }, body }), second, (e) => { throw e; });

  assert.strictEqual(second.status, 429);
  assert.strictEqual(second.body.code, 'NUDGE_TOO_SOON');
  assert.ok(second.body.retryAfter, 'must tell the caller when they can retry');
  assert.strictEqual(s.h.db.nudges.length, 1, 'a double-click must not send twice');
});

test('force overrides the throttle', async (t) => {
  const s = scenario();
  t.after(s.h.restore);
  const body = { target: String(s.emp._id), reason: 'feedback', channel: 'app' };

  const first = capture();
  await appraisals.nudge(asUser(s.hr, { params: { id: String(s.appraisalId) }, body }), first, (e) => { throw e; });

  const second = capture();
  await appraisals.nudge(
    asUser(s.hr, { params: { id: String(s.appraisalId) }, body: { ...body, force: true } }),
    second, (e) => { throw e; }
  );

  assert.strictEqual(second.status, 201);
  assert.strictEqual(s.h.db.nudges.length, 2, 'repeat nudges are kept as history');
});

test('a FAILED email is reported as a failure and stored as channel app', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const real = emailService.sendAppraisalNudgeEmail;
  emailService.sendAppraisalNudgeEmail = async () => {
    throw new Error('535 Authentication failed');
  };
  t.after(() => { emailService.sendAppraisalNudgeEmail = real; });

  const res = capture();
  await appraisals.nudge(
    asUser(s.hr, {
      params: { id: String(s.appraisalId) },
      body: { target: String(s.emp._id), reason: 'feedback', channel: 'email' },
    }),
    res, (e) => { throw e; }
  );

  // This repo has already shipped a mailer that silently fell back to dev mode
  // on a 535 and still logged a tick. A nudge that reports success for an email
  // nobody received is worse than no nudge, because HR stops chasing.
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.emailSent, false);
  assert.ok(res.body.data.emailError, 'the failure must reach the caller');
  assert.strictEqual(s.h.db.nudges[0].channel, 'app');
  assert.ok(s.h.db.nudges[0].emailError);
});

test('a successful email is recorded as channel email', async (t) => {
  const s = scenario();
  t.after(s.h.restore);

  const real = emailService.sendAppraisalNudgeEmail;
  let called = null;
  emailService.sendAppraisalNudgeEmail = async (args) => { called = args; return { sent: true }; };
  t.after(() => { emailService.sendAppraisalNudgeEmail = real; });

  const res = capture();
  await appraisals.nudge(
    asUser(s.hr, {
      params: { id: String(s.appraisalId) },
      body: { target: String(s.emp._id), reason: 'feedback', channel: 'email' },
    }),
    res, (e) => { throw e; }
  );

  assert.strictEqual(res.body.data.emailSent, true);
  assert.strictEqual(s.h.db.nudges[0].channel, 'email');
  assert.strictEqual(called.to, 'grace@wyncity.test');
});

test('a nudge for an appraisal in another tenant 404s', async (t) => {
  const s = scenario();
  t.after(s.h.restore);
  const stranger = { _id: oid(), tenant: oid(), role: 'tenant_admin' };

  const res = capture();
  await appraisals.nudge(
    asUser(stranger, {
      params: { id: String(s.appraisalId) },
      body: { target: String(s.emp._id), reason: 'feedback', channel: 'app' },
    }),
    res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 404);
});
```

Append to `server/__tests__/appraisal.model.test.js`:

```js
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
  AppraisalNudge.schema.eachPath((name, type) => {
    assert.notStrictEqual(type.options?.unique, true, `AppraisalNudge.${name}`);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd server && node --test __tests__/appraisalNudge.test.js`
Expected: FAIL — `Cannot find module '../models/AppraisalNudge'`.

- [ ] **Step 3: Create the model**

Create `server/models/AppraisalNudge.js`:

```js
const mongoose = require('mongoose');
const { NUDGE_REASONS } = require('../services/appraisal.helpers');
const { Schema } = mongoose;

/**
 * A reminder HR sent to someone holding up an appraisal.
 *
 * Its OWN collection, deliberately, not a subdocument array on Appraisal. A
 * nudge aimed at an outstanding peer carries that peer's id in `target`, so as
 * a subdocument it would be an identity-bearing field on the very document
 * projected to the subject — it would have to be added to
 * REVIEWER_IDENTITY_FIELDS, which is a DENY-list, so it would be exposed by
 * default until someone remembered. As a separate collection the subject's
 * payload structurally never carries it. Same argument that split
 * AppraisalFeedback out of Appraisal in the parent spec.
 */
const appraisalNudgeSchema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    appraisal: { type: Schema.Types.ObjectId, ref: 'Appraisal', required: true },
    cycle: { type: Schema.Types.ObjectId, ref: 'AppraisalCycle', required: true },
    target: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: NUDGE_REASONS, required: true },
    channel: { type: String, enum: ['app', 'email'], default: 'app' },
    sentBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sentAt: { type: Date, default: Date.now },
    // Set when an email was requested and the send failed. The row is then
    // stored as channel 'app' — the in-app reminder did land.
    emailError: { type: String },
  },
  { timestamps: true }
);

// Repeat nudges are kept as history, so NO unique index here.
appraisalNudgeSchema.index({ tenant: 1, cycle: 1, target: 1 });
appraisalNudgeSchema.index({ tenant: 1, appraisal: 1, target: 1, reason: 1, sentAt: -1 });

module.exports = mongoose.model('AppraisalNudge', appraisalNudgeSchema);
```

- [ ] **Step 4: Extend the harness**

In `server/__tests__/helpers/appraisalHarness.js`:

- add `nudges: []` to the `db` object in `makeHarness`
- add `FIELD_LISTS.nudges = ['tenant','appraisal','cycle','target','reason','channel','sentBy','sentAt','emailError','createdAt','updatedAt']`
- add `REF_MAP.nudges = { target: 'users', appraisal: 'appraisals', cycle: 'cycles' }`
- stub `AppraisalNudge` with `find`, `findOne`, `create`, `countDocuments`, following the `AppraisalFeedback` pattern, and include it in `restore()`

- [ ] **Step 5: Add the email sender**

In `server/services/email.service.js`, add and export `sendAppraisalNudgeEmail({to, name, cycleName, reason, deadline, link})`, following that file's existing template idiom.

Content rule: a peer's reminder names the appraisal's **subject** — which that peer already knows, having been asked to review them — and **no email ever names another reviewer**.

- [ ] **Step 6: Implement the endpoint**

Add `NUDGE_MIN_INTERVAL_HOURS = 12` to `appraisal.helpers.js` and export it. Then add to `server/controllers/appraisal.controller.js`:

```js
/**
 * Remind someone who is holding an appraisal up.
 *
 * Gated on canManageCycle — HR only in Phase 3. The manager is arguably the
 * more natural chaser and this gate is one condition away from admitting them,
 * but that needs its own UI on the team page and is deliberately out of scope.
 */
exports.nudge = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({
      _id: req.params.id, tenant: req.tenant._id,
    }).lean();
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = resolveAppraisalAccess(req.user, appraisal);
    if (!access.canManageCycle) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    const rows = await AppraisalFeedback.find({
      tenant: req.tenant._id, appraisal: appraisal._id,
    }).select('reviewer kind status').lean();

    const { target, reason, channel = 'app', force = false } = req.body || {};

    // The target must actually owe something. This is what stops the endpoint
    // being used to probe who is on an appraisal: an arbitrary user id gets
    // the same 400 as a real reviewer who simply has nothing outstanding.
    const outstanding = outstandingActionsFor(appraisal, rows);
    const match = outstanding.find(
      (o) => String(o.target) === String(target) && o.reason === reason
    );
    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'That person has nothing outstanding on this appraisal.',
      });
    }

    if (!force) {
      const since = new Date(Date.now() - NUDGE_MIN_INTERVAL_HOURS * 3600 * 1000);
      const recent = await AppraisalNudge.findOne({
        tenant: req.tenant._id, appraisal: appraisal._id, target, reason,
        sentAt: { $gte: since },
      }).sort({ sentAt: -1 }).lean();
      if (recent) {
        // Mostly about a double-click sending two emails, and about a stalled
        // appraisal not becoming a week of daily mail for someone on leave.
        return res.status(429).json({
          success: false,
          code: 'NUDGE_TOO_SOON',
          message: `This person was already reminded in the last ${NUDGE_MIN_INTERVAL_HOURS} hours.`,
          retryAfter: new Date(new Date(recent.sentAt).getTime() + NUDGE_MIN_INTERVAL_HOURS * 3600 * 1000),
        });
      }
    }

    let emailSent = false;
    let emailError = null;
    if (channel === 'email') {
      const person = await User.findOne({ _id: target, tenant: req.tenant._id })
        .select('firstName lastName email').lean();
      const cycle = await AppraisalCycle.findOne({ _id: appraisal.cycle, tenant: req.tenant._id })
        .select('name feedbackDeadline').lean();
      try {
        await emailService.sendAppraisalNudgeEmail({
          to: person?.email,
          name: person?.firstName,
          cycleName: cycle?.name,
          reason,
          deadline: cycle?.feedbackDeadline,
          link: `${process.env.ADMIN_URL || ''}/appraisals`,
        });
        emailSent = true;
      } catch (e) {
        // Recorded, never swallowed. This repo shipped a mailer that fell back
        // to dev mode on a 535 and still logged a tick; every order
        // confirmation for that period went silently unsent.
        emailError = e?.message || 'Email could not be sent';
      }
    }

    const created = await AppraisalNudge.create({
      tenant: req.tenant._id,
      appraisal: appraisal._id,
      cycle: appraisal.cycle,
      target,
      reason,
      channel: emailSent ? 'email' : 'app',
      sentBy: req.user._id,
      sentAt: new Date(),
      ...(emailError ? { emailError } : {}),
    });

    res.status(201).json({
      success: true,
      data: {
        _id: created._id, sentAt: created.sentAt, channel: created.channel,
        emailSent, emailError,
      },
    });
  } catch (err) { next(err); }
};
```

Add whatever of `AppraisalNudge`, `AppraisalCycle`, `User`, `emailService`, `outstandingActionsFor`, `NUDGE_MIN_INTERVAL_HOURS` this file does not already require. **Check first — several are already there.**

- [ ] **Step 7: Route it and wire `lastNudge`**

In `server/routes/appraisal.routes.js`: `appraisalRouter.post('/:id/nudge', appraisals.nudge);`

In `cycleRoster`, replace the hard-coded `lastNudge: null`. Add before the `.map`:

```js
    const nudges = ids.length
      ? await AppraisalNudge.find({ tenant: req.tenant._id, appraisal: { $in: ids } })
          .select('appraisal target reason channel sentAt')
          .sort({ sentAt: -1 })
          .lean()
      : [];
    const latestNudge = new Map();
    for (const n of nudges) {
      // Sorted newest-first, so the first seen per appraisal is the latest.
      if (!latestNudge.has(String(n.appraisal))) latestNudge.set(String(n.appraisal), n);
    }
```

and in the row object: `lastNudge: latestNudge.get(String(a._id)) || null,`.

- [ ] **Step 8: Run the tests, the full suite, and snapshot**

Run: `cd server && node --test __tests__/appraisalNudge.test.js` → PASS, 9 tests.
Run: `cd server && node --test __tests__/appraisalCycleRoster.test.js` → still PASS.
Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -8` → baseline + new, `# fail 3`.

---

### Task 10: Surface nudges in-app

**Files:**
- Modify: `server/controllers/appraisal.controller.js` (`myAppraisals`, `myReviewRequests`)
- Create: `server/__tests__/appraisalNudgeInApp.test.js`

**Interfaces:**
- Consumes: Task 9's `AppraisalNudge`.
- Produces: `nudge: {sentAt, reason} | null` on each row of `GET /api/appraisals/my` and `GET /api/appraisals/my/reviews`.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/appraisalNudgeInApp.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const oid = () => new mongoose.Types.ObjectId();
const appraisals = require('../controllers/appraisal.controller');

test('my/reviews carries the nudge for the caller as target', async (t) => {
  const tenant = oid();
  const emp = { _id: oid(), tenant, role: 'tenant_staff', status: 'active' };
  const mgr = { _id: oid(), tenant, role: 'tenant_staff', status: 'active' };
  const cycleId = oid();
  const appraisalId = oid();
  const feedbackId = oid();

  const h = makeHarness({ users: [emp, mgr], cycle: { _id: cycleId, tenant, name: 'H2', status: 'collecting' } });
  t.after(h.restore);

  h.db.appraisals.push({
    _id: appraisalId, tenant, cycle: cycleId, employee: emp._id, manager: mgr._id,
    state: 'collecting', reviewerIds: [emp._id, mgr._id], peerNominations: [],
  });
  h.db.feedback.push({
    _id: feedbackId, tenant, appraisal: appraisalId, cycle: cycleId,
    reviewer: emp._id, kind: 'self', status: 'pending',
  });
  h.db.nudges.push({
    _id: oid(), tenant, appraisal: appraisalId, cycle: cycleId,
    target: emp._id, reason: 'feedback', channel: 'app', sentBy: mgr._id,
    sentAt: new Date('2026-08-04T09:00:00Z'),
  });

  const res = capture();
  await appraisals.myReviewRequests(asUser(emp), res, (e) => { throw e; });

  assert.strictEqual(res.status, 200);
  const row = res.body.data.find((r) => String(r._id) === String(feedbackId));
  assert.ok(row.nudge, 'the reminder must reach the person it was sent to');
  assert.strictEqual(row.nudge.reason, 'feedback');
});

test('a nudge aimed at someone else is never shown', async (t) => {
  const tenant = oid();
  const emp = { _id: oid(), tenant, role: 'tenant_staff', status: 'active' };
  const other = { _id: oid(), tenant, role: 'tenant_staff', status: 'active' };
  const mgr = { _id: oid(), tenant, role: 'tenant_staff', status: 'active' };
  const cycleId = oid();
  const appraisalId = oid();

  const h = makeHarness({ users: [emp, other, mgr], cycle: { _id: cycleId, tenant, name: 'H2', status: 'collecting' } });
  t.after(h.restore);

  h.db.appraisals.push({
    _id: appraisalId, tenant, cycle: cycleId, employee: emp._id, manager: mgr._id,
    state: 'collecting', reviewerIds: [emp._id, mgr._id], peerNominations: [],
  });
  h.db.feedback.push({
    _id: oid(), tenant, appraisal: appraisalId, cycle: cycleId,
    reviewer: emp._id, kind: 'self', status: 'pending',
  });
  h.db.nudges.push({
    _id: oid(), tenant, appraisal: appraisalId, cycle: cycleId,
    target: other._id, reason: 'feedback', channel: 'app', sentBy: mgr._id, sentAt: new Date(),
  });

  const res = capture();
  await appraisals.myReviewRequests(asUser(emp), res, (e) => { throw e; });

  assert.strictEqual(res.body.data[0].nudge, null,
    'a nudge is scoped to its target — showing another person\'s reminder tells you they were chased');
});

test('my appraisals carries the nudge for the subject', async (t) => {
  const tenant = oid();
  const emp = { _id: oid(), tenant, role: 'tenant_staff', status: 'active' };
  const mgr = { _id: oid(), tenant, role: 'tenant_staff', status: 'active' };
  const cycleId = oid();
  const appraisalId = oid();

  const h = makeHarness({ users: [emp, mgr], cycle: { _id: cycleId, tenant, name: 'H2', status: 'collecting' } });
  t.after(h.restore);

  h.db.appraisals.push({
    _id: appraisalId, tenant, cycle: cycleId, employee: emp._id, manager: mgr._id,
    state: 'released', reviewerIds: [emp._id, mgr._id], peerNominations: [],
  });
  h.db.nudges.push({
    _id: oid(), tenant, appraisal: appraisalId, cycle: cycleId,
    target: emp._id, reason: 'acknowledge', channel: 'app', sentBy: mgr._id, sentAt: new Date(),
  });

  const res = capture();
  await appraisals.myAppraisals(asUser(emp), res, (e) => { throw e; });

  assert.strictEqual(res.body.data[0].nudge.reason, 'acknowledge');
});

test('the nudge line adds no reviewer identity to a subject payload', async (t) => {
  const tenant = oid();
  const emp = { _id: oid(), tenant, role: 'tenant_staff', status: 'active' };
  const mgr = { _id: oid(), tenant, role: 'tenant_staff', status: 'active' };
  const cycleId = oid();
  const appraisalId = oid();

  const h = makeHarness({ users: [emp, mgr], cycle: { _id: cycleId, tenant, name: 'H2', status: 'collecting' } });
  t.after(h.restore);
  h.db.appraisals.push({
    _id: appraisalId, tenant, cycle: cycleId, employee: emp._id, manager: mgr._id,
    state: 'released', reviewerIds: [emp._id, mgr._id, oid()],
    peerNominations: [{ user: oid(), proposedBy: emp._id, status: 'approved' }],
  });
  h.db.nudges.push({
    _id: oid(), tenant, appraisal: appraisalId, cycle: cycleId,
    target: emp._id, reason: 'acknowledge', channel: 'app', sentBy: mgr._id, sentAt: new Date(),
  });

  const res = capture();
  await appraisals.myAppraisals(asUser(emp), res, (e) => { throw e; });

  const json = JSON.stringify(res.body);
  assert.ok(!json.includes('peerNominations'), 'sanitizeOwnAppraisalRow still strips it');
  assert.ok(!json.includes('reviewerIds'));
  // The nudge carries only sentAt + reason — never sentBy, never target.
  assert.strictEqual(res.body.data[0].nudge.sentBy, undefined);
  assert.strictEqual(res.body.data[0].nudge.target, undefined);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd server && node --test __tests__/appraisalNudgeInApp.test.js`
Expected: FAIL — `row.nudge` is undefined.

- [ ] **Step 3: Attach the nudge in both handlers**

In `myAppraisals` and `myReviewRequests`, after the rows are loaded and **after** the existing sanitisation:

```js
    // Only nudges aimed at THIS caller. A nudge is scoped to its target:
    // showing someone another person's reminder tells them that person was
    // chased, which is not theirs to know.
    const nudgeRows = await AppraisalNudge.find({
      tenant: req.tenant._id,
      target: req.user._id,
      appraisal: { $in: appraisalIds },
    })
      .select('appraisal reason sentAt')
      .sort({ sentAt: -1 })
      .lean();
    const latest = new Map();
    for (const n of nudgeRows) {
      if (!latest.has(String(n.appraisal))) latest.set(String(n.appraisal), n);
    }
    const nudgeFor = (id) => {
      const n = latest.get(String(id));
      // Two fields only. sentBy is HR's identity and not the point; target is
      // redundant and a field that could be widened later without noticing.
      return n ? { sentAt: n.sentAt, reason: n.reason } : null;
    };
```

then set `nudge: nudgeFor(<the row's appraisal id>)` on each row.

> `myAppraisals` returns appraisals (key on `row._id`); `myReviewRequests` returns feedback rows carrying an `appraisal` ref (key on `row.appraisal?._id || row.appraisal`). Read each handler and build `appraisalIds` correctly rather than copying one into the other.

- [ ] **Step 4: Run the tests, the full suite, and snapshot**

Run: `cd server && node --test __tests__/appraisalNudgeInApp.test.js` → PASS, 4 tests.
Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -8` → baseline + new, `# fail 3`.

---

### Task 11: The cycle report

**Files:**
- Modify: `server/controllers/appraisalCycle.controller.js`
- Modify: `server/routes/appraisal.routes.js`
- Create: `server/__tests__/appraisalCycleReport.test.js`

**Interfaces:**
- Consumes: Task 3's pinned `cycle.template`.
- Produces: `GET /api/appraisal-cycles/:id/report` → `{releasedCount, finalRatingHistogram, questionStats}`.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/appraisalCycleReport.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const oid = () => new mongoose.Types.ObjectId();
const cycles = require('../controllers/appraisalCycle.controller');

const q1 = oid();
const q2 = oid();

function reportScenario() {
  const tenant = oid();
  const hr = { _id: oid(), tenant, role: 'tenant_admin' };
  const cycleId = oid();
  const templateId = oid();
  const h = makeHarness({
    users: [hr],
    template: {
      _id: templateId, tenant, family: oid(), version: 1, isLatest: true, name: 'T',
      sections: [{
        title: 'Performance',
        questions: [
          { _id: q1, type: 'rating', label: 'Quality of work', scaleMax: 5, askOf: ['self', 'manager', 'peer'] },
          { _id: q2, type: 'text', label: 'What went well?', askOf: ['self', 'manager', 'peer'] },
        ],
      }],
    },
    cycle: { _id: cycleId, tenant, name: 'H2', status: 'collecting', template: templateId },
  });
  return { tenant, hr, cycleId, templateId, h };
}

test('report is empty but valid before anything is released', async (t) => {
  const s = reportScenario();
  t.after(s.h.restore);

  const res = capture();
  await cycles.cycleReport(asUser(s.hr, { params: { id: String(s.cycleId) } }), res, (e) => { throw e; });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.releasedCount, 0);
  assert.deepStrictEqual(res.body.data.finalRatingHistogram, []);
  // Questions still listed, so the UI renders a real empty state rather than
  // a blank panel that looks broken.
  assert.strictEqual(res.body.data.questionStats.length, 1);
  assert.strictEqual(res.body.data.questionStats[0].self.n, 0);
});

test('report histograms final ratings across released appraisals', async (t) => {
  const s = reportScenario();
  t.after(s.h.restore);
  const mk = (state, finalRating) => ({
    _id: oid(), tenant: s.tenant, cycle: s.cycleId, employee: oid(), manager: oid(),
    state, finalRating, reviewerIds: [], peerNominations: [],
  });
  s.h.db.appraisals.push(
    mk('released', 5), mk('released', 4), mk('acknowledged', 4),
    mk('collecting', undefined) // not released — must not count
  );

  const res = capture();
  await cycles.cycleReport(asUser(s.hr, { params: { id: String(s.cycleId) } }), res, (e) => { throw e; });

  assert.strictEqual(res.body.data.releasedCount, 3,
    'acknowledged is released-and-signed, still released');
  assert.deepStrictEqual(res.body.data.finalRatingHistogram, [
    { rating: 4, count: 2 },
    { rating: 5, count: 1 },
  ]);
});

test('report means are split per reviewer kind, text questions excluded', async (t) => {
  const s = reportScenario();
  t.after(s.h.restore);
  const appraisalId = oid();
  s.h.db.appraisals.push({
    _id: appraisalId, tenant: s.tenant, cycle: s.cycleId, employee: oid(), manager: oid(),
    state: 'released', finalRating: 4, reviewerIds: [], peerNominations: [],
  });
  const fb = (kind, rating, status = 'submitted') => ({
    _id: oid(), tenant: s.tenant, appraisal: appraisalId, cycle: s.cycleId,
    reviewer: oid(), kind, status,
    answers: [{ questionId: q1, rating }, { questionId: q2, text: 'prose' }],
  });
  s.h.db.feedback.push(
    fb('self', 5), fb('manager', 3), fb('peer', 4), fb('peer', 2),
    fb('peer', 1, 'pending') // not submitted — must not count
  );

  const res = capture();
  await cycles.cycleReport(asUser(s.hr, { params: { id: String(s.cycleId) } }), res, (e) => { throw e; });

  const stat = res.body.data.questionStats.find((x) => String(x.questionId) === String(q1));
  assert.strictEqual(stat.label, 'Quality of work');
  assert.deepStrictEqual(stat.self, { mean: 5, n: 1 });
  assert.deepStrictEqual(stat.manager, { mean: 3, n: 1 });
  assert.deepStrictEqual(stat.peer, { mean: 3, n: 2 });

  // A single blended mean over self, manager and peer has no interpretation —
  // it moves when the peer count changes. Text questions carry no rating.
  assert.strictEqual(
    res.body.data.questionStats.find((x) => String(x.questionId) === String(q2)),
    undefined
  );
});

test('report 404s for a foreign-tenant cycle', async (t) => {
  const s = reportScenario();
  t.after(s.h.restore);
  const stranger = { _id: oid(), tenant: oid(), role: 'tenant_admin' };

  const res = capture();
  await cycles.cycleReport(asUser(stranger, { params: { id: String(s.cycleId) } }), res, (e) => { throw e; });
  assert.strictEqual(res.status, 404);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd server && node --test __tests__/appraisalCycleReport.test.js`
Expected: FAIL — `cycles.cycleReport is not a function`.

- [ ] **Step 3: Implement it**

Add to `server/controllers/appraisalCycle.controller.js`:

```js
/**
 * Cycle-wide reporting: how ratings landed, not who is outstanding.
 *
 * Labels resolve against the cycle's PINNED template version, which is only
 * unambiguous because launchCycle freezes it — an unpinned cycle would label
 * historical answers with whatever the form says today.
 *
 * In a cycle with one released appraisal the "cycle mean" IS that person's
 * score. Not gated: HR can already read every appraisal in its own tenant, so
 * this discloses nothing new. Worth knowing before anyone reads a two-person
 * histogram as a trend.
 */
exports.cycleReport = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid cycle id' });
    }
    const cycleId = new mongoose.Types.ObjectId(req.params.id);
    const tenantId = new mongoose.Types.ObjectId(req.tenant._id);

    const cycle = await AppraisalCycle.findOne({ _id: cycleId, tenant: tenantId }).lean();
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' });

    const template = await AppraisalTemplate.findOne({
      _id: cycle.template, tenant: req.tenant._id,
    }).lean();

    const released = await Appraisal.find({
      tenant: req.tenant._id, cycle: cycle._id,
      state: { $in: ['released', 'acknowledged'] },
    }).select('finalRating').lean();

    const counts = new Map();
    for (const a of released) {
      if (typeof a.finalRating !== 'number') continue;
      counts.set(a.finalRating, (counts.get(a.finalRating) || 0) + 1);
    }
    const finalRatingHistogram = [...counts.entries()]
      .map(([rating, count]) => ({ rating, count }))
      .sort((a, b) => a.rating - b.rating);

    const submitted = await AppraisalFeedback.find({
      tenant: req.tenant._id, cycle: cycle._id, status: 'submitted',
    }).select('kind answers').lean();

    // Accumulate per (questionId, kind). Only rating answers — a text answer
    // has no mean, and the template is the authority on which is which.
    const acc = new Map();
    for (const row of submitted) {
      for (const a of row.answers || []) {
        if (typeof a.rating !== 'number') continue;
        const key = String(a.questionId);
        if (!acc.has(key)) acc.set(key, { self: [], manager: [], peer: [] });
        acc.get(key)[row.kind]?.push(a.rating);
      }
    }
    const mean = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
    const stat = (xs) => ({ mean: mean(xs), n: xs.length });

    const questionStats = [];
    for (const section of template?.sections || []) {
      for (const q of section.questions || []) {
        if (q.type !== 'rating') continue;
        const bucket = acc.get(String(q._id)) || { self: [], manager: [], peer: [] };
        questionStats.push({
          questionId: q._id,
          label: q.label,
          scaleMax: q.scaleMax,
          self: stat(bucket.self),
          manager: stat(bucket.manager),
          peer: stat(bucket.peer),
        });
      }
    }

    res.json({
      success: true,
      data: { releasedCount: released.length, finalRatingHistogram, questionStats },
    });
  } catch (err) { next(err); }
};
```

- [ ] **Step 4: Route it**

`cycleRouter.get('/:id/report', cycles.cycleReport);`

- [ ] **Step 5: Run the tests, the full suite, and snapshot**

Run: `cd server && node --test __tests__/appraisalCycleReport.test.js` → PASS, 4 tests.
Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -8` → baseline + new, `# fail 3`.

---

# Part C — Self vs manager vs peer comparison (server)

### Task 12: `buildComparison`

**Files:**
- Modify: `server/services/appraisal.helpers.js`
- Create: `server/__tests__/appraisalComparison.test.js`

**Interfaces:**
- Consumes: `PEER_RELEASE_MIN` from `appraisal.helpers.js`.
- Produces: `buildComparison(sections, feedback, access) → ComparisonRow[]` where
  `ComparisonRow = {sectionTitle, questionId, label, scaleMax, self, manager, peer: {mean, n, suppressed}, peerBreakdown}`.

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/appraisalComparison.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildComparison, PEER_RELEASE_MIN } = require('../services/appraisal.helpers');

// Plain string ids, matching appraisal.helpers.test.js's idiom.
const sections = [
  {
    title: 'Performance',
    questions: [
      { _id: 'q1', type: 'rating', label: 'Quality of work', scaleMax: 5, askOf: ['self', 'manager', 'peer'] },
      { _id: 'q2', type: 'rating', label: 'Communication', scaleMax: 5, askOf: ['self', 'manager', 'peer'] },
      { _id: 'q3', type: 'text', label: 'What went well?', askOf: ['self', 'manager', 'peer'] },
    ],
  },
];

const row = (kind, answers, extra = {}) => ({
  kind, status: 'submitted', answers, ...extra,
});

const HR = { canSeeReviewerNames: true };
const SUBJECT = { canSeeReviewerNames: false };

test('buildComparison pairs self, manager and peer on the SAME questionId', () => {
  const feedback = [
    row('self', [{ questionId: 'q1', rating: 5 }]),
    row('manager', [{ questionId: 'q1', rating: 3 }]),
    row('peer', [{ questionId: 'q1', rating: 4 }]),
    row('peer', [{ questionId: 'q1', rating: 3 }]),
  ];
  const [q1] = buildComparison(sections, feedback, SUBJECT);

  assert.strictEqual(q1.label, 'Quality of work');
  assert.strictEqual(q1.self, 5);
  assert.strictEqual(q1.manager, 3);
  assert.deepStrictEqual(q1.peer, { mean: 3.5, n: 2, suppressed: false });
});

test('buildComparison SUPPRESSES the peer mean below PEER_RELEASE_MIN', () => {
  const feedback = [
    row('self', [{ questionId: 'q1', rating: 4 }]),
    row('peer', [{ questionId: 'q1', rating: 2 }]),
  ];
  const [q1] = buildComparison(sections, feedback, SUBJECT);

  // A lone response dressed up as an average is the one case where the
  // statistic is purely misleading — and it is also the case where the number
  // IS one identifiable person's score.
  assert.deepStrictEqual(q1.peer, { mean: null, n: 1, suppressed: true });
  assert.strictEqual(PEER_RELEASE_MIN, 2, 'the threshold is shared, not a second constant');
});

test('suppression is PER QUESTION, not per appraisal', () => {
  const feedback = [
    row('peer', [{ questionId: 'q1', rating: 4 }, { questionId: 'q2', rating: 3 }]),
    // This peer answered q1 but skipped q2.
    row('peer', [{ questionId: 'q1', rating: 2 }]),
  ];
  const [q1, q2] = buildComparison(sections, feedback, SUBJECT);

  assert.deepStrictEqual(q1.peer, { mean: 3, n: 2, suppressed: false });
  assert.deepStrictEqual(q2.peer, { mean: null, n: 1, suppressed: true });
});

test('buildComparison excludes text questions', () => {
  const feedback = [row('self', [{ questionId: 'q3', text: 'prose' }])];
  const rows = buildComparison(sections, feedback, SUBJECT);

  assert.deepStrictEqual(rows.map((r) => r.questionId), ['q1', 'q2']);
});

test('peerBreakdown is NULL for a viewer who may not see reviewer names', () => {
  const feedback = [
    row('peer', [{ questionId: 'q1', rating: 4 }], { reviewer: { _id: 'u-p1', firstName: 'Ada' } }),
    row('peer', [{ questionId: 'q1', rating: 2 }], { reviewer: { _id: 'u-p2', firstName: 'Kofi' } }),
  ];
  const [q1] = buildComparison(sections, feedback, SUBJECT);

  assert.strictEqual(q1.peerBreakdown, null);
  // And no name reaches the payload by any other route.
  assert.ok(!JSON.stringify(q1).includes('Ada'));
  assert.ok(!JSON.stringify(q1).includes('Kofi'));
});

test('peerBreakdown IS populated for manager/HR', () => {
  const feedback = [
    row('peer', [{ questionId: 'q1', rating: 4 }], { reviewer: { _id: 'u-p1', firstName: 'Ada' } }),
    row('peer', [{ questionId: 'q1', rating: 2 }], { reviewer: { _id: 'u-p2', firstName: 'Kofi' } }),
  ];
  const [q1] = buildComparison(sections, feedback, HR);

  assert.strictEqual(q1.peerBreakdown.length, 2);
  assert.strictEqual(q1.peerBreakdown[0].rating, 4);
  assert.strictEqual(q1.peerBreakdown[0].reviewer.firstName, 'Ada');
});

test('a peer row already stripped of its reviewer cannot produce a breakdown', () => {
  // This is the structural half of the guarantee: buildComparison runs on the
  // ALREADY-PROJECTED feedback array, so for a subject viewer the reviewer
  // field is not merely gated off — it is not in the input.
  const feedback = [
    row('peer', [{ questionId: 'q1', rating: 4 }]), // no `reviewer` key at all
    row('peer', [{ questionId: 'q1', rating: 2 }]),
  ];
  const [q1] = buildComparison(sections, feedback, HR);

  assert.deepStrictEqual(q1.peerBreakdown, []);
  assert.deepStrictEqual(q1.peer, { mean: 3, n: 2, suppressed: false });
});

test('buildComparison ignores rows that are not submitted', () => {
  const feedback = [
    row('self', [{ questionId: 'q1', rating: 5 }]),
    { kind: 'peer', status: 'declined', answers: [{ questionId: 'q1', rating: 1 }] },
    { kind: 'peer', status: 'pending', answers: [{ questionId: 'q1', rating: 1 }] },
    { kind: 'peer', status: 'expired', answers: [{ questionId: 'q1', rating: 1 }] },
  ];
  const [q1] = buildComparison(sections, feedback, HR);

  assert.strictEqual(q1.self, 5);
  assert.deepStrictEqual(q1.peer, { mean: null, n: 0, suppressed: true });
});

test('a question nobody answered renders as nulls, not as absent', () => {
  const [q1] = buildComparison(sections, [], SUBJECT);

  assert.strictEqual(q1.self, null);
  assert.strictEqual(q1.manager, null);
  assert.deepStrictEqual(q1.peer, { mean: null, n: 0, suppressed: true });
});

test('an answer whose questionId matches no question is dropped', () => {
  const feedback = [row('self', [{ questionId: 'q-gone', rating: 5 }])];
  const rows = buildComparison(sections, feedback, SUBJECT);

  // Never rendered under a fabricated label. With version pinning this should
  // now be unreachable; the guard stays because "unreachable" is a claim about
  // today's code.
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].self, null);
});

test('buildComparison tolerates null input', () => {
  assert.deepStrictEqual(buildComparison(null, null, null), []);
  assert.deepStrictEqual(buildComparison(sections, null, null).length, 2);
});

test('means round to one decimal place', () => {
  const feedback = [
    row('peer', [{ questionId: 'q1', rating: 5 }]),
    row('peer', [{ questionId: 'q1', rating: 4 }]),
    row('peer', [{ questionId: 'q1', rating: 4 }]),
  ];
  const [q1] = buildComparison(sections, feedback, SUBJECT);
  assert.strictEqual(q1.peer.mean, 4.3);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd server && node --test __tests__/appraisalComparison.test.js`
Expected: FAIL — `buildComparison is not a function`.

- [ ] **Step 3: Implement it**

In `server/services/appraisal.helpers.js`, above `module.exports`:

```js
/**
 * Self vs manager vs peer, one row per RATING question.
 *
 * The payoff of `askOf`: every reviewer kind answers the SAME questionId, so
 * "the employee rated themselves 5, peers averaged 2.8" is a direct lookup
 * rather than a mapping exercise.
 *
 * Text answers are excluded deliberately — prose reads better in the feedback
 * cards than as a bar, and a text answer has no mean.
 *
 * IMPORTANT: call this with the ALREADY-PROJECTED feedback array, after
 * projectFeedbackForViewer has run. For a subject viewer that means
 * `peerBreakdown` is not merely gated off by canSeeReviewerNames — the
 * `reviewer` field is not in the input at all, and non-submitted rows have
 * already had `answers` stripped. Two independent reasons it cannot populate,
 * one of them structural.
 */
function buildComparison(sections, feedback, access) {
  const submitted = (feedback || []).filter((f) => f?.status === 'submitted');
  const named = Boolean(access?.canSeeReviewerNames);
  const out = [];

  const ratingIn = (row, qid) => {
    const a = (row?.answers || []).find((x) => String(x.questionId) === qid);
    return typeof a?.rating === 'number' ? a.rating : null;
  };

  for (const section of sections || []) {
    for (const q of section?.questions || []) {
      if (q?.type !== 'rating') continue;
      const qid = String(q._id);

      const peerRatings = [];
      const breakdown = [];
      for (const row of submitted) {
        if (row.kind !== 'peer') continue;
        const rating = ratingIn(row, qid);
        if (rating === null) continue;
        peerRatings.push(rating);
        if (named && row.reviewer) breakdown.push({ reviewer: row.reviewer, rating });
      }

      const n = peerRatings.length;
      // Shared with peerReleaseGate rather than a second threshold: the number
      // means the same thing in both places — below this, the peer signal is
      // too thin to stand on — and two constants that must agree eventually
      // disagree.
      const suppressed = n < PEER_RELEASE_MIN;
      const mean = suppressed
        ? null
        : Math.round((peerRatings.reduce((s, x) => s + x, 0) / n) * 10) / 10;

      out.push({
        sectionTitle: section.title,
        questionId: q._id,
        label: q.label,
        scaleMax: q.scaleMax,
        self: ratingIn(submitted.find((f) => f.kind === 'self'), qid),
        manager: ratingIn(submitted.find((f) => f.kind === 'manager'), qid),
        peer: { mean, n, suppressed },
        // null, not [], for a viewer who may not see names: an empty array
        // reads as "no peers responded", which is a different fact.
        peerBreakdown: named ? breakdown : null,
      });
    }
  }
  return out;
}
```

Add `buildComparison` to `module.exports`.

- [ ] **Step 4: Run the tests, the full suite, and snapshot**

Run: `cd server && node --test __tests__/appraisalComparison.test.js` → PASS, 12 tests.
Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -8` → baseline + new, `# fail 3`.

---

### Task 13: Return the comparison from `getAppraisal`

**Files:**
- Modify: `server/controllers/appraisal.controller.js` (`getAppraisal`)
- Modify: `server/__tests__/appraisalLifecycleLeaks.test.js`
- Create: `server/__tests__/appraisalComparisonPayload.test.js`

**Interfaces:**
- Consumes: Task 12's `buildComparison`.
- Produces: `comparison: ComparisonRow[]` on `GET /api/appraisals/:id`.

> **AUDIT (2026-08-05, session 3).** Sample code below checked line-by-line
> against `appraisal.controller.js#getAppraisal` (line 245), `appraisal.helpers.js#
> buildComparison` (line 614) / `#projectFeedbackForViewer` (line 186), and
> `__tests__/helpers/appraisalHarness.js` (`makeHarness` line 695, `asUser` 726,
> `capture` 739). **The test fixture and every harness call in it are valid** —
> `makeHarness({users, template, cycle})`, `h.db.appraisals`/`h.db.feedback`,
> `t.after(h.restore)` and `capture()`'s status-collapsing all match. The four
> assertions are reachable and correct: `projectFeedbackForViewer` deletes only
> `reviewer` (peer rows, unnamed viewer) and only strips `answers` from
> non-`submitted` rows, so the subject genuinely receives peer *ratings* and the
> expected `{mean:3,n:2,suppressed:false}` from peers rated 4 and 2 holds.
> Corrections are folded into the steps below. Two notes:
>
> - **Not fixed here, deliberately:** `getAppraisal` passes `req.params.id`
>   into the filter unguarded, so a non-ObjectId 500s via the CastError the
>   global handler leaves alone. This is the *pre-existing systemic* exposure
>   Task 4's ledger entry recorded as "worth its own task" — Task 13 does not
>   introduce it and does not widen scope to fix it. Same for the missing
>   `req.tenant?._id` guard on line 247 (harmless only because `_id` keeps the
>   query exact).
> - The value-level `JSON.stringify(payload)` scan in `assertNoIdentityLeak`
>   already covers `comparison` implicitly the moment it joins the payload. The
>   field-level traversal is what must be extended, and it needs one assertion
>   the existing loop cannot express — see Step 1.

- [ ] **Step 1: Extend the leak traversal**

In `server/__tests__/appraisalLifecycleLeaks.test.js`, `assertNoIdentityLeak` currently traverses the top level, `.appraisal`, `.access`, `.sections` and `feedback[].appraisal`. Add `payload.comparison` — every row and every row's `peerBreakdown` entries — to that `docs` array.

**Then add the assertion the `docs`/`SUBJECT_FORBIDDEN` loop cannot make.** That loop only checks for the keys `reviewerIds` and `peerNominations`; a populated `peerBreakdown` carries neither, so it would sail through the field scan. It is the direct analogue of the existing `feedback[].reviewer` check at line ~84:

```js
  // peerBreakdown is the one Phase 3 field that carries a reviewer identity by
  // design. For a subject-facing payload it must be null — not [], which would
  // mean "no peers responded" — and the check has to be explicit, because the
  // SUBJECT_FORBIDDEN key scan above looks only for reviewerIds/peerNominations
  // and a populated breakdown contains neither.
  for (const row of payload?.comparison || []) {
    assert.strictEqual(
      row.peerBreakdown, null,
      `${where}: a comparison row carried a peer breakdown to the subject`
    );
  }
```

- [ ] **Step 2: Write the failing tests**

Create `server/__tests__/appraisalComparisonPayload.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const oid = () => new mongoose.Types.ObjectId();
const appraisals = require('../controllers/appraisal.controller');

const q1 = oid();

function released() {
  const tenant = oid();
  const emp = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Grace' };
  const mgr = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Kofi' };
  const peerA = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Ada' };
  const peerB = { _id: oid(), tenant, role: 'tenant_staff', status: 'active', firstName: 'Sam' };
  const templateId = oid();
  const cycleId = oid();
  const appraisalId = oid();

  const h = makeHarness({
    users: [emp, mgr, peerA, peerB],
    template: {
      _id: templateId, tenant, family: oid(), version: 1, isLatest: true, name: 'T',
      sections: [{
        title: 'Performance',
        questions: [{ _id: q1, type: 'rating', label: 'Quality of work', scaleMax: 5, askOf: ['self', 'manager', 'peer'] }],
      }],
    },
    cycle: { _id: cycleId, tenant, name: 'H2', status: 'collecting', template: templateId },
  });
  h.db.appraisals.push({
    _id: appraisalId, tenant, cycle: cycleId, employee: emp._id, manager: mgr._id,
    state: 'released', summary: 'Good year', finalRating: 4,
    reviewerIds: [emp._id, mgr._id, peerA._id, peerB._id],
    peerNominations: [
      { user: peerA._id, proposedBy: emp._id, status: 'approved' },
      { user: peerB._id, proposedBy: emp._id, status: 'approved' },
    ],
  });
  const fb = (reviewer, kind, rating) => ({
    _id: oid(), tenant, appraisal: appraisalId, cycle: cycleId, reviewer, kind,
    status: 'submitted', answers: [{ questionId: q1, rating }],
  });
  h.db.feedback.push(
    fb(emp._id, 'self', 5), fb(mgr._id, 'manager', 3),
    fb(peerA._id, 'peer', 4), fb(peerB._id, 'peer', 2)
  );
  return { tenant, emp, mgr, peerA, peerB, appraisalId, h };
}

test('the SUBJECT gets an aggregate comparison and NO peer breakdown', async (t) => {
  const s = released();
  t.after(s.h.restore);

  const res = capture();
  await appraisals.getAppraisal(
    asUser(s.emp, { params: { id: String(s.appraisalId) } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 200);
  const [row] = res.body.data.comparison;
  assert.strictEqual(row.self, 5);
  assert.strictEqual(row.manager, 3);
  assert.deepStrictEqual(row.peer, { mean: 3, n: 2, suppressed: false });
  assert.strictEqual(row.peerBreakdown, null);

  // And no peer name reaches the subject through the comparison by any route.
  const json = JSON.stringify(res.body.data.comparison);
  assert.ok(!json.includes('Ada'));
  assert.ok(!json.includes('Sam'));
  assert.ok(!json.includes(String(s.peerA._id)));
  assert.ok(!json.includes(String(s.peerB._id)));
});

test('the MANAGER gets the per-peer breakdown with names', async (t) => {
  const s = released();
  t.after(s.h.restore);

  const res = capture();
  await appraisals.getAppraisal(
    asUser(s.mgr, { params: { id: String(s.appraisalId) } }), res, (e) => { throw e; }
  );

  const [row] = res.body.data.comparison;
  assert.strictEqual(row.peerBreakdown.length, 2);
  const names = row.peerBreakdown.map((b) => b.reviewer.firstName).sort();
  assert.deepStrictEqual(names, ['Ada', 'Sam']);
});

test('a single peer response suppresses the mean for the subject', async (t) => {
  const s = released();
  t.after(s.h.restore);
  // Drop one peer's submission back to pending.
  const peerRow = s.h.db.feedback.find((f) => String(f.reviewer) === String(s.peerB._id));
  peerRow.status = 'pending';

  const res = capture();
  await appraisals.getAppraisal(
    asUser(s.emp, { params: { id: String(s.appraisalId) } }), res, (e) => { throw e; }
  );

  const [row] = res.body.data.comparison;
  assert.deepStrictEqual(row.peer, { mean: null, n: 1, suppressed: true });
});

test('the comparison is absent from every pre-release 403', async (t) => {
  const s = released();
  t.after(s.h.restore);
  const a = s.h.db.appraisals[0];
  a.state = 'collecting';

  const res = capture();
  await appraisals.getAppraisal(
    asUser(s.emp, { params: { id: String(s.appraisalId) } }), res, (e) => { throw e; }
  );

  // canRead for the subject is released|acknowledged ONLY. Nothing in Phase 3
  // relaxes it.
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.body.data, undefined);
});

// ── Added by the session-3 audit ───────────────────────────────────────────
// Task 12 put `askOf` on every row BEYOND the plan's original shape, precisely
// so Task 19 can render "not asked" instead of an empty bar that reads as
// "nobody responded". Nothing else pins that key, so a refactor of
// buildComparison could drop it and only the UI would notice — in production.
test('each row carries askOf, and text questions are excluded', async (t) => {
  const s = released();
  t.after(s.h.restore);
  // A text question alongside the rating one: it has no mean and must not
  // produce a row.
  s.h.db.templates[0].sections[0].questions.push({
    _id: oid(), type: 'text', label: 'Anything else?', askOf: ['manager'],
  });

  const res = capture();
  await appraisals.getAppraisal(
    asUser(s.mgr, { params: { id: String(s.appraisalId) } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.body.data.comparison.length, 1);
  assert.deepStrictEqual(res.body.data.comparison[0].askOf, ['self', 'manager', 'peer']);
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd server && node --test __tests__/appraisalComparisonPayload.test.js`
Expected: FAIL — `res.body.data.comparison` is undefined.

- [ ] **Step 4: Wire it in**

In `getAppraisal` in `server/controllers/appraisal.controller.js`, after `const feedback = rawFeedback.map((fb) => projectFeedbackForViewer(fb, access));`:

```js
    // Built from the PROJECTED feedback, never the raw rows. For a subject
    // viewer projectFeedbackForViewer has already removed each peer row's
    // `reviewer` and stripped `answers` from anything not submitted, so
    // peerBreakdown cannot populate even if its access gate were wrong.
    const comparison = buildComparison(sections, feedback, access);
```

and add `comparison` to the `res.json({...data})` payload.

Add `buildComparison` to this file's existing destructured require from `../services/appraisal.helpers`.

- [ ] **Step 5: Run the tests, the leak suite, the full suite, and snapshot**

Run: `cd server && node --test __tests__/appraisalComparisonPayload.test.js` → PASS, 5 tests (4 from the plan + the audit's `askOf` test).
Run: `cd server && node --test __tests__/appraisalLifecycleLeaks.test.js` → PASS (the extended traversal must still pass).
Run the full suite redirected to a log and grep it — **never `tail` alone**, which discards the failure names:
```
cd server && node --test '__tests__/*.test.js' > /tmp/p3.log 2>&1
grep -E "^not ok" /tmp/p3.log ; grep -E "^# (tests|pass|fail)" /tmp/p3.log
grep "Duplicate schema index" /tmp/p3.log | grep tenant   # must print nothing
```
Expected: **1241/1244**, the 3 known failures confirmed BY NAME.

Prove the new tests can fail: delete the `comparison` key from the payload and confirm the comparison tests go red; separately, force `peerBreakdown` to `breakdown` regardless of `named` in `buildComparison` and confirm the subject test **and** the extended leak traversal both go red. Restore after each.

---

# Part D — Admin UI

> Every task in this part runs `cd client/apps/admin && node_modules/.bin/tsc --noEmit`
> and must report **461** errors — the baseline, unchanged. `npx tsc` reports 0
> and is lying.

### Task 14: Service layer — types and wrappers

**Files:**
- Modify: `client/apps/admin/src/services/appraisal.service.ts`

**Interfaces:**
- Consumes: the endpoints from Tasks 4, 5, 8, 9, 11, 13.
- Produces: types `AppraisalTemplateDoc`, `TemplateVersion`, `RosterRow`, `NudgeResult`, `CycleReport`, `ComparisonRow`; functions `fetchTemplates`, `fetchTemplate`, `fetchTemplateVersions`, `createTemplate`, `updateTemplate`, `archiveTemplate`, `fetchCycleRoster`, `sendNudge`, `fetchCycleReport`. `fetchAppraisal`'s return type gains `comparison`.

> ## AUDIT (2026-08-05, session 3) — READ BEFORE WRITING ANY OF STEP 1
>
> Checked against the real `src/services/appraisal.service.ts` (482 lines) and
> against the actual `res.json` literals in `appraisalTemplate.controller.js`,
> `appraisalCycle.controller.js#cycleRoster`/`#cycleReport` and
> `appraisal.controller.js#nudge`. **Six defects, two of which break the tsc
> baseline outright:**
>
> 1. **`NudgeReason` ALREADY EXISTS** (line 26) with the identical five-member
>    union, and **`AppraisalQuestion` ALREADY EXISTS** (line 190) with the
>    identical shape. Appending the plan's copies is a **duplicate identifier
>    (TS2300) in each case** — it would add errors to the 461 baseline this
>    task must leave unchanged. **Do not re-declare either.** Reuse them;
>    `DraftQuestion` should extend the existing `AppraisalQuestion`.
> 2. **`AppraisalSection` already exists** (line 200). `DraftSection` is a new
>    name and is fine, but do not redefine `AppraisalSection`.
> 3. **Step 4 is already done.** `Appraisal.nudge?: AppraisalNudge` (line ~186)
>    and `ReviewRequest.nudge?: AppraisalNudge` (line ~155) are both present,
>    with the existing `AppraisalNudge` interface at line 33. **Skip Step 4
>    entirely**, and note that the plan's proposed `{...} | null` is *wrong*:
>    Task 10 deliberately **omits the key** rather than sending `nudge: null`,
>    because a permanent guard test asserts a subject payload contains no
>    occurrence of the string `nudge` and `{"nudge":null}` contains it. Typing
>    it `| null` invites a UI refactor that reddens that guard.
> 4. **`ComparisonRow` is missing `askOf`** — Task 12 added it to every row and
>    Task 19 needs it to render "not asked" rather than an empty bar. And three
>    fields are mistyped: `buildComparison` emits `sectionTitle`, `label` and
>    `scaleMax` as **explicit `null`** (`?? null` / the `typeof` ternary), never
>    `undefined`, so `scaleMax?: number` and `label: string` are lies. Corrected
>    block below.
> 5. **`ApiError` captures neither `fields` nor `retryAfter`**, yet Task 15
>    Step 3 requires highlighting a 400's `fields` and Task 17 Step 1 requires a
>    toast naming the 429's `retryAfter`. Both fields are genuinely on the wire
>    (`appraisalTemplate.controller.js:128,196` and `server.js:360` send
>    `fields`; `appraisal.controller.js#nudge` sends `retryAfter` with
>    `code:'NUDGE_TOO_SOON'`). **Neither downstream task can meet its own spec
>    until `ApiError` is widened here** — that makes it Task 14's job.
> 6. **Shape mismatches against the real handlers:** `NudgeResult` omits
>    `reason` (the handler returns it); `RosterRow.self`/`.mgr` send
>    `submittedAt: ... ?? null`, so it is `string | null`, not `?: string`;
>    `QuestionStat` omits `sectionTitle`, which `cycleReport` returns and Task
>    18 can group by. `createCycle`'s payload type also needs `templateFamily?:
>    string` for Task 16 — call that out here rather than leaving Task 16 to
>    discover it.
>
> **Verified correct, do not "fix":** `request<T>` returns `body.data as T`, so
> every wrapper's generic is the `data` shape (not the envelope);
> `fetchCycleRoster`'s `{rows, page, limit, total}` matches `cycleRoster`'s
> literal exactly; `archiveTemplate`'s `{family, archived}` matches; the
> template routes (`GET|POST /`, `GET|PUT /:id`, `GET /:id/versions`,
> `POST /:id/archive`) all exist on `templateRouter` and it is mounted.
> `ComparisonRow.questionId: string` is right — the server emits the raw
> ObjectId but it serialises to a string over JSON.

- [ ] **Step 1: Add the types**

Append to `client/apps/admin/src/services/appraisal.service.ts`. **`NudgeReason`, `AppraisalQuestion`, `AppraisalSection` and `AppraisalNudge` are omitted from this block because they already exist** — see the audit above.

```ts
// NB: `AppraisalQuestion` is NOT redeclared — it already exists at line ~190
// of this file with exactly this shape. Redeclaring it is a TS2300.

/**
 * A template as the builder edits it. `_id` is absent on a question the user
 * has just added — the server mints it on save, which is what makes a new
 * question's id stable across every reviewer kind that answers it.
 */
export interface DraftQuestion extends Omit<AppraisalQuestion, '_id'> {
  _id?: string;
}

export interface DraftSection {
  _id?: string;
  title: string;
  questions: DraftQuestion[];
}

export interface AppraisalTemplateDoc {
  _id: string;
  tenant: string;
  /** Stable across every version. What a cycle stores and resolves. */
  family: string;
  version: number;
  isLatest: boolean;
  isDefault: boolean;
  isArchived: boolean;
  name: string;
  description?: string;
  sections: DraftSection[];
  createdAt?: string;
  /** Set by PUT when the edit forked rather than saving in place. */
  forked?: boolean;
}

export interface TemplateVersion {
  _id: string;
  version: number;
  isLatest: boolean;
  isArchived: boolean;
  name: string;
  createdAt?: string;
}

// NB: `NudgeReason` is NOT redeclared — it already exists at line ~26.

export interface RosterRow {
  _id: string;
  state: AppraisalState;
  employee: PersonRef | null;
  manager: PersonRef | null;
  // `submittedAt` is `?? null` on the wire, never absent — see
  // appraisalCycle.controller.js#cycleRoster.
  self: { status: FeedbackStatus; submittedAt: string | null } | null;
  mgr: { status: FeedbackStatus; submittedAt: string | null } | null;
  peers: { approved: number; submitted: number; declined: number; pending: number };
  /**
   * `target` degrades to a bare `{_id}` when the person could not be resolved
   * — PersonRef's name fields are already optional, which covers it.
   */
  outstanding: { reason: NudgeReason; target: PersonRef }[];
  lastNudge: { sentAt: string; channel: 'app' | 'email'; reason: NudgeReason } | null;
}

export interface NudgeResult {
  _id: string;
  sentAt: string;
  /** 'app' whenever the email failed — the in-app reminder still landed. */
  channel: 'app' | 'email';
  reason: NudgeReason;
  /** False when an email was requested and the send failed. */
  emailSent: boolean;
  emailError: string | null;
}

export interface QuestionStat {
  questionId: string;
  sectionTitle: string;
  label: string;
  /** Genuinely absent (not null) when the question never set one. */
  scaleMax?: number;
  self: { mean: number | null; n: number };
  manager: { mean: number | null; n: number };
  peer: { mean: number | null; n: number };
}

export interface CycleReport {
  releasedCount: number;
  finalRatingHistogram: { rating: number; count: number }[];
  questionStats: QuestionStat[];
}

export interface ComparisonRow {
  // buildComparison emits these three as EXPLICIT null (`?? null` / a typeof
  // ternary), never undefined — see appraisal.helpers.js:657-663.
  sectionTitle: string | null;
  /** Raw ObjectId server-side; a string once it has been through JSON. */
  questionId: string;
  label: string | null;
  scaleMax: number | null;
  /**
   * Which reviewer kinds this question is asked of. Added by Task 12 beyond
   * the original design shape so the UI can render "not asked" for a bucket
   * nobody was ever meant to fill, rather than an empty bar that reads as
   * "nobody responded". Task 19 depends on it.
   */
  askOf: FeedbackKind[];
  self: number | null;
  manager: number | null;
  /** `mean` is null when `suppressed` — below 2 responses, per question. */
  peer: { mean: number | null; n: number; suppressed: boolean };
  /**
   * Null for any viewer who may not see reviewer names. Not an empty array:
   * `[]` reads as "no peers responded", which is a different fact.
   */
  peerBreakdown: { reviewer: PersonRef; rating: number }[] | null;
}
```

- [ ] **Step 2: Add the wrappers**

**First, widen `ApiError` and `createCycle`** — Tasks 15, 16 and 17 cannot meet
their own specs otherwise (audit defects 5 and 6):

```ts
// In the existing ApiError constructor, alongside `this.code = body?.code`:
  /** Inputs the server rejected, for the template form to highlight. */
  fields?: string[];
  /** ISO instant the nudge throttle lifts, on a 429 NUDGE_TOO_SOON. */
  retryAfter?: string;
// ...
    this.fields = body?.fields;
    this.retryAfter = body?.retryAfter;
```

```ts
// And on createCycle's payload type — the FAMILY, never a version _id:
  templateFamily?: string;
```

Then the new wrappers:

```ts
export const fetchTemplates = () =>
  request<AppraisalTemplateDoc[]>('/api/appraisal-templates');

export const fetchTemplate = (id: string) =>
  request<AppraisalTemplateDoc>(`/api/appraisal-templates/${id}`);

export const fetchTemplateVersions = (id: string) =>
  request<TemplateVersion[]>(`/api/appraisal-templates/${id}/versions`);

export const createTemplate = (body: {
  name: string;
  description?: string;
  sections: DraftSection[];
}) =>
  request<AppraisalTemplateDoc>('/api/appraisal-templates', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const updateTemplate = (
  id: string,
  body: { name: string; description?: string; sections: DraftSection[] }
) =>
  request<AppraisalTemplateDoc>(`/api/appraisal-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

export const archiveTemplate = (id: string) =>
  request<{ family: string; archived: boolean }>(
    `/api/appraisal-templates/${id}/archive`,
    { method: 'POST' }
  );

export const fetchCycleRoster = (id: string, page = 1, limit = 50) =>
  request<{ rows: RosterRow[]; page: number; limit: number; total: number }>(
    `/api/appraisal-cycles/${id}/roster?page=${page}&limit=${limit}`
  );

export const fetchCycleReport = (id: string) =>
  request<CycleReport>(`/api/appraisal-cycles/${id}/report`);

export const sendNudge = (
  appraisalId: string,
  body: { target: string; reason: NudgeReason; channel: 'app' | 'email'; force?: boolean }
) =>
  request<NudgeResult>(`/api/appraisals/${appraisalId}/nudge`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
```

- [ ] **Step 3: Extend `fetchAppraisal`'s return type**

Add to the inline return type at `fetchAppraisal`:

```ts
    /**
     * Per-rating-question self/manager/peer comparison, computed server-side
     * from the already-projected feedback — see appraisal.helpers.js
     * #buildComparison. `peerBreakdown` is null for the subject.
     */
    comparison: ComparisonRow[];
```

- [x] **Step 4: Extend `Appraisal` and `ReviewRequest` with `nudge` — ALREADY DONE, SKIP**

Both interfaces already carry `nudge?: AppraisalNudge` (lines ~155 and ~186),
backed by the `AppraisalNudge` interface at line 33. Nothing to do.

**Do not apply the plan's original `{ sentAt; reason } | null` here.** The key is
*omitted* when there is no nudge, never set to `null`, because Task 9's permanent
guard asserts a subject's serialised payload contains no occurrence of the string
`nudge` — and `{"nudge":null}` contains it. The existing optional-and-absent
typing is the correct one and is load-bearing.

- [ ] **Step 5: Type-check and snapshot**

Run: `cd client/apps/admin && node_modules/.bin/tsc --noEmit 2>&1 | tail -3`
Expected: **461** errors, unchanged.

---

### Task 15: The template builder UI

**Files:**
- Create: `client/apps/admin/src/app/(hydrogen)/appraisals/templates/page.tsx`
- Create: `client/apps/admin/src/app/(hydrogen)/appraisals/templates/[id]/page.tsx`
- Create: `client/apps/admin/src/app/shared/appraisals/template-list.tsx`
- Create: `client/apps/admin/src/app/shared/appraisals/template-editor.tsx`

**Interfaces:**
- Consumes: Task 14's service functions and types.
- Produces: the two routes. **No `middleware.ts` change** — `isUnder(path, '/appraisals/templates')` already matches the nested route on whole segments.

> **AUDIT (2026-08-05, session 3).** Two claims verified, one gap flagged.
> **The middleware claim is TRUE** — `src/middleware.ts:202` already reads
> `isUnder(path, '/appraisals/templates')` inside the HR gate, and `:259`
> matches `/appraisals/:path*`. Step 1 is a confirmation, not a fix.
> `cycles-list.tsx` (284 lines) exists and is the right idiom source.
> **Gap in Step 3's banner:** `updateTemplate`'s in-place branch returns no
> `forked` key at all (`appraisalTemplate.controller.js:220`) and the fork
> branch sets `forked: true` (`:298`) — so `forked` is only knowable *after*
> saving, which is exactly when the warning is useless. The plan's fallback
> ("show it unconditionally and say you did") ships a banner that lies to HR
> roughly half the time. **Preferred resolution: add a `hasLaunchedCycle`
> boolean to `getTemplate`'s response** — it is the same
> `AppraisalCycle.find({template, launchedAt})` probe `updateTemplate` already
> runs to choose its branch, so it is a handful of lines in a file this phase
> already owns, and it makes the banner truthful. If you take the unconditional
> fallback instead, say so explicitly in the task report.

- [ ] **Step 1: Verify the middleware claim before writing anything**

Run: `grep -n "appraisals/templates" client/apps/admin/src/middleware.ts`
Expected: one hit inside the HR gate, using `isUnder` — **audited: this is
already the case at line 202.**

- [ ] **Step 2: Write `template-list.tsx`**

A client component listing one row per family: name, `v{version}`, a "Default" chip where `isDefault`, question count, Edit link to `/appraisals/templates/${_id}`, an Archive action (hidden when `isDefault`, since the server refuses it), and a "New form" button routing to `/appraisals/templates/new`.

Follow the existing table and empty-state idiom in `cycles-list.tsx` — read it first and match its rizzui imports, its `useEffect` fetch shape, its `toast.error` handling and its `#b20202` primary colour.

- [ ] **Step 3: Write `template-editor.tsx`**

A client component taking `{ id }` where `id === 'new'` means create. State is a `DraftSection[]`.

Required behaviour:

- Add/remove section; move section up/down (buttons, **no drag-and-drop** — that would add a dependency for a form HR edits a handful of times a year).
- Add/remove question; move question up/down within its section.
- Per question: `label` (text), `helpText` (text), `type` (select `rating | text`), `scaleMax` (number, shown only for `rating`), `required` (switch), `askOf` (three checkboxes: Self, Manager, Peer).
- **Disable Save when any question has an empty `askOf`**, with the inline message "A question nobody is asked will never appear on any form." The server rejects it too — this is the explanation, not the enforcement.
- When the loaded template has a launched cycle behind it, show a banner: **"Saving will create version {version + 1}. Cycles already running keep the version they launched with."** Derive it from the response's `forked` flag after the first save, and from a `hasLaunchedCycle` hint if you add one — otherwise show the banner unconditionally for any template with `version >= 1` **and say in the task report that you did**, because an unconditional banner that sometimes lies is worse than none.
- On save, call `createTemplate` or `updateTemplate`. If the response has `forked: true`, `toast.success('Saved as version N')` and redirect to the new `_id` — the old id is now a superseded version the server will refuse to edit.
- On a 400 carrying `fields`, highlight those inputs. The global handler returns `{message, fields}` and never the raw Mongoose message, which echoes the rejected value.

- [ ] **Step 4: Write the two route files**

Both are thin server components rendering the client component, matching the shape of `appraisals/cycles/page.tsx` — read it and copy its page-header/breadcrumb idiom rather than inventing one.

- [ ] **Step 5: Type-check, then verify in a browser**

Run: `cd client/apps/admin && node_modules/.bin/tsc --noEmit 2>&1 | tail -3` → **461**.

Then start the servers and click through: `lsof -ti:5001` first — a stale listener makes `npm run dev` print "✅ running" after `listen()` silently hit EADDRINUSE.

- [ ] **Step 6: Snapshot and record**

---

### Task 16: Template picker on cycle create

**Files:**
- Modify: `client/apps/admin/src/app/shared/appraisals/cycles-list.tsx` (or wherever the create form lives — grep for `createCycle`)

- [ ] **Step 1: Find the create form**

Run: `grep -rn "createCycle" client/apps/admin/src`

- [ ] **Step 2: Add the picker**

A select over `fetchTemplates()`, defaulting to the row with `isDefault`, submitting `templateFamily: <selected>.family` — **the family, not the `_id`**. The server resolves the family to its current latest at create and re-resolves once at launch; sending a version id would defeat both.

Show `{name} (v{version})` so HR can see which version they are about to launch against.

- [ ] **Step 3: Type-check and snapshot**

Run: `cd client/apps/admin && node_modules/.bin/tsc --noEmit 2>&1 | tail -3` → **461**.

---

### Task 17: `cycle-roster.tsx`

**Files:**
- Create: `client/apps/admin/src/app/shared/appraisals/cycle-roster.tsx`
- Modify: `client/apps/admin/src/app/shared/appraisals/cycle-detail.tsx`

**Interfaces:**
- Consumes: `fetchCycleRoster`, `sendNudge`, `RosterRow`, `NudgeReason` from Task 14.

> **AUDIT (2026-08-05, session 3).** `cycle-detail.tsx` is indeed 545 lines —
> the plan's claim is accurate and Step 2's "do not inline the table" stands.
> **The 429 branch depends on a Task 14 fix:** `retryAfter` is on the wire but
> `ApiError` did not capture it, so `err.retryAfter` was `undefined` and the
> informational toast could not name it. Task 14's audit adds it. Same for
> `err.code === 'NUDGE_TOO_SOON'` — `code` *was* already captured, so only
> `retryAfter` was missing.
> Note the three response cases are distinguished by `emailSent`, which is
> `false` **whenever the channel was 'app' too** — an app-only nudge is not a
> failure. Branch on `channel === 'email' && !emailSent`, not on `!emailSent`
> alone, or every in-app reminder shows a red "the email failed" toast.

- [ ] **Step 1: Write the component**

Columns: Employee, Manager, Self (✓/—), Manager (✓/—), Peers (`{submitted}/{approved}`, with declined shown as a muted count when non-zero), Outstanding, and a nudge control per outstanding target.

The nudge control is a dropdown with two items — **"Remind in app"** and **"Remind in app + email"** — calling `sendNudge` with `channel: 'app'` or `'email'`.

Three response cases, all of which must be handled distinctly:

- `emailSent: true` → `toast.success('Reminder sent')`
- `emailSent: false` with `emailError` → **`toast.error('Reminded in the app, but the email failed: ' + emailError)`**. Not a success toast. This repo has already shipped a mailer that failed silently while logging a tick; a green tick for an unsent email is what stops HR chasing.
- HTTP 429 with `code: 'NUDGE_TOO_SOON'` → an informational toast naming `retryAfter`, plus a **"Send anyway"** action that retries with `force: true`.

Render `lastNudge` as a muted "nudged 2d ago" beside the control.

- [ ] **Step 2: Mount it in `cycle-detail.tsx`**

`cycle-detail.tsx` is already 545 lines. Add a tab or section that renders `<CycleRoster cycleId={id} />` — do **not** inline the table into that file.

- [ ] **Step 3: Type-check and snapshot**

Run: `cd client/apps/admin && node_modules/.bin/tsc --noEmit 2>&1 | tail -3` → **461**.

---

### Task 18: `cycle-report.tsx`

**Files:**
- Create: `client/apps/admin/src/app/shared/appraisals/cycle-report.tsx`
- Modify: `client/apps/admin/src/app/shared/appraisals/cycle-detail.tsx`

- [ ] **Step 1: Write the component**

Two panels, rendered only when `releasedCount > 0` (otherwise an explicit "No appraisals have been released yet" empty state — a blank panel reads as broken):

- **Final ratings** — a horizontal bar per rating value with its count.
- **By question** — one row per rating question, three small bars (self / manager / peer) each labelled with its mean and `n`. A `mean: null` renders as `—` with its `n`, never as `0`.

Add the caveat line under the panels: *"With few released appraisals a cycle mean reflects one or two people, not a trend."*

Use plain CSS bars (a div with a percentage width). Do **not** add a charting dependency for two panels.

- [ ] **Step 2: Mount it beside the roster in `cycle-detail.tsx`**

- [ ] **Step 3: Type-check and snapshot**

Run: `cd client/apps/admin && node_modules/.bin/tsc --noEmit 2>&1 | tail -3` → **461**.

---

### Task 19: The comparison UI

**Files:**
- Create: `client/apps/admin/src/app/shared/appraisals/appraisal-comparison.tsx`
- Create: `client/apps/admin/src/app/shared/appraisals/appraisal-peer-breakdown.tsx`
- Modify: `client/apps/admin/src/app/shared/appraisals/appraisal-detail.tsx`
- Modify: `client/apps/admin/src/app/shared/appraisals/appraisal-subject-view.tsx`
- Modify: `client/apps/admin/src/app/shared/appraisals/appraisal-manager-view.tsx`
- Create: `client/apps/admin/src/app/shared/appraisals/__tests__/appraisal-comparison.test.tsx`

**Interfaces:**
- Consumes: `ComparisonRow` from Task 14 and the `comparison` field from Task 13.

> ## AUDIT (2026-08-05, session 3) — STEP 4 AS WRITTEN CANNOT RUN
>
> **There is no React component test anywhere in this admin app, and no way to
> write one without adding dependencies.** Verified: `vitest.config.ts` sets
> `environment: 'node'` (no jsdom, no happy-dom); `package.json` has no
> `@testing-library/react`, no `jsdom`; and every one of the 12 existing test
> files is a `.test.ts` over plain logic (services, validators, utils) — **zero
> `.test.tsx` exist**, so Step 4's "grep for a sibling `*.test.tsx` and match
> its render helper" finds nothing to match. Rendering a component would need
> jsdom + testing-library + a setup file, i.e. three new dev dependencies in an
> app whose Vercel build has already OOM'd at 6 GB once.
>
> **Resolution — do this instead of a render test.** Extract the four render
> decisions into a pure module, `shared/appraisals/comparison-presenter.ts`,
> and test *that* as a `.test.ts` in the existing node-environment idiom:
>
> ```ts
> // peerCell(row) -> {kind:'none'} | {kind:'single'} | {kind:'mean', mean, n}
> // scoreCell(v)  -> {kind:'dash'} | {kind:'bar', pct}
> ```
>
> The four behaviours the plan wants asserted map one-to-one onto it, and the
> `.tsx` becomes a thin renderer over the presenter. This tests the logic that
> can actually be wrong — a `0` rendering as a bar, an `n===1` leaking a number
> — without a DOM.
>
> **THE USER CHOSE THIS OPTION (2026-08-05, session 3). Do NOT add jsdom or
> @testing-library/react.** Step 4 below is superseded: write
> `shared/appraisals/comparison-presenter.ts` plus
> `comparison-presenter.test.ts`, and keep the four listed behaviours as
> presenter cases. Step 5's grep guarantee is unchanged and still runs.
>
> Everything else in Task 19 is verified: `appraisal-detail.tsx` (190),
> `appraisal-subject-view.tsx` (323) and `appraisal-manager-view.tsx` (557) all
> exist, and `appraisal-subject-view.tsx` currently has no executable
> `reviewer` reference to regress. The grep guarantee in Step 5 stands as
> written and must be run.
> **`askOf` is available on every row** (Task 12) — use it to distinguish "not
> asked" from "nobody responded"; the plan's original rules do not mention it
> and would render both identically.

- [ ] **Step 1: Write `appraisal-comparison.tsx` — aggregate only**

Props: `{ rows: ComparisonRow[] }`. One block per question: the label, then up to three labelled bars — Self, Manager, Peers — each scaled against `scaleMax`.

Rules:

- `self`/`manager` of `null` render as `—`, never as a zero-width bar (a zero bar reads as "rated 0").
- When `peer.suppressed && peer.n === 1`, render **no bar and no number** — the text `Based on 1 response — see peer feedback below`.
- When `peer.suppressed && peer.n === 0`, render `No peer responses`.
- Otherwise the bar plus `{mean}` and a muted `({n} peers)`.

**This file must contain no reference to `reviewer` at all** — not a read, not a type import, not a defensive guard. It is imported by the subject's render path, and structural absence is the guarantee.

Add this at the top of the file:

```tsx
// ── This component must never reference a reviewer ──────────────────────────
//
// It is imported by BOTH appraisal-subject-view and appraisal-manager-view.
// The per-peer breakdown lives in appraisal-peer-breakdown.tsx, which only the
// manager view imports. `grep -n reviewer` on this file must return comments
// only — that absence, not a conditional, is what guarantees the subject's
// render path cannot leak a name.
```

- [ ] **Step 2: Write `appraisal-peer-breakdown.tsx` — named, manager/HR only**

Props: `{ rows: ComparisonRow[] }`. Renders per question a small table of `peerBreakdown` entries with reviewer names and ratings, skipping any row whose `peerBreakdown` is `null`.

- [ ] **Step 3: Wire them in**

- `appraisal-detail.tsx`: thread `comparison` out of `fetchAppraisal`'s result into both views (add it to `DetailData`).
- `appraisal-subject-view.tsx`: render `<AppraisalComparison rows={comparison} />` above the feedback cards. Import **only** the comparison component.
- `appraisal-manager-view.tsx`: render both `<AppraisalComparison />` and `<AppraisalPeerBreakdown />`.

- [ ] **Step 4: Write the vitest**

Create `client/apps/admin/src/app/shared/appraisals/__tests__/appraisal-comparison.test.tsx`, following the existing admin vitest idiom (grep for a sibling `*.test.tsx` and match its render helper):

```tsx
// n === 1 renders the explanatory line and NO number
// n === 0 renders "No peer responses"
// n >= 2 renders the mean and the peer count
// self === null renders an em dash, not a zero bar
```

Write each of those as a real assertion against the rendered output.

- [ ] **Step 5: The grep guarantee**

Run:
```bash
grep -n reviewer client/apps/admin/src/app/shared/appraisals/appraisal-subject-view.tsx
grep -n reviewer client/apps/admin/src/app/shared/appraisals/appraisal-comparison.tsx
```
Expected: **comments only** from both. Any executable hit fails this task.

- [ ] **Step 6: Type-check, test, snapshot**

Run: `cd client/apps/admin && node_modules/.bin/tsc --noEmit 2>&1 | tail -3` → **461**.
Run: `cd client/apps/admin && npx vitest run 2>&1 | tail -5` → 99 + the new tests, none failing.

---

# Part E — Verification

### Task 20: End-to-end over live HTTP

**Files:** none created. This is verification.

- [ ] **Step 1: Confirm the baselines one last time**

Run the suite redirected and grep it — `tail` alone discards the failure names:
```
cd server && node --test '__tests__/*.test.js' > /tmp/p3.log 2>&1
grep -E "^not ok" /tmp/p3.log ; grep -E "^# (tests|pass|fail)" /tmp/p3.log
grep "Duplicate schema index" /tmp/p3.log | grep tenant   # must print nothing
```
→ **1241/1244 as of Task 13** (the Global Constraints' 1078 is the *pre-Phase-3*
figure), `# fail 3` confirmed BY NAME.
Run: `cd client/apps/admin && node_modules/.bin/tsc --noEmit 2>&1 | tail -3` → **461**.
Run: `cd client/apps/admin && npx vitest run 2>&1 | tail -5` → 99 + new.

- [x] **Step 2: Run the backfill against Atlas — DONE 2026-08-05, session 3. SKIP.**

> **ALREADY APPLIED AND VERIFIED.** `--apply` ran against production Atlas with
> the user's explicit approval after review of the dry-run output. Production
> held exactly **one** template; it now carries
> `family=own _id, version=1, isLatest=true, isDefault=true`, a re-run reports
> `0 need backfill`, and all three Phase 3 unique indexes are present while the
> plain `{tenant:1}` index survived `syncIndexes()`. See the ledger. **Do not
> run it again** — it is idempotent, but the `syncIndexes()` call is not
> something to repeat casually.
>
> **AUDIT (2026-08-05, session 3): the two commands below were INVERTED and the
> flag did not exist.** The script takes **`--apply`**, not `--dry-run`
> (`scripts/backfill-appraisal-template-versions.js:38`,
> `const APPLY = process.argv.includes('--apply')`), and **the dry run is the
> default** — `if (!APPLY) return` sits above both the write loop (`:125`) and
> `syncIndexes()` (`:138`). As originally written, line 1 passed an unknown flag
> (harmless, still a dry run) and line 2 was described as the real run but is
> *also* a dry run. It also omitted `-r dotenv/config`, without which
> `MONGODB_URI` is undefined (`:36`, `:105`) and the script throws.

```bash
# Dry run — the DEFAULT. Prints the plan, writes nothing.
cd server && node -r dotenv/config scripts/backfill-appraisal-template-versions.js

# Only after showing the user the plan output and getting explicit approval:
cd server && node -r dotenv/config scripts/backfill-appraisal-template-versions.js --apply
```

**`syncIndexes()` in the write path DROPS indexes the schema no longer declares**
on `appraisaltemplates` — the one genuinely destructive action in this phase.
Supervised runs only, never unattended.

Line ~149 is a bare `console.error(err)` and a driver failure can embed the
cluster host — **redact rather than pasting raw output** if it errors. Atlas is
reachable from this machine; the link is flaky, so retry once on a connection
error before investigating.

- [ ] **Step 3: Start the backend**

Run: `lsof -ti:5001` — **must be empty.** Kill any stale listener first; otherwise `npm run dev` prints "✅ running" while `listen()` silently hit EADDRINUSE and you spend an hour testing against the old build.

- [ ] **Step 4: Walk the whole flow**

Log in as `appraisal-hr@wyncity.test` (password `Appraisal#Test2026`) and:

1. Author a new template with two sections, one rating and one text question, `askOf` set differently per question.
2. Create a cycle against it. **Scope the launch with `employeeIds`** so no real Wyn City staff get an appraisal — `admin@drinksharbour.com` is a real super_admin whose tenant is Wyn City.
3. Launch. Confirm `cycle.template` pinned to v1.
4. Edit the template. Confirm it **forks to v2** and the running cycle still resolves v1 — check that the reviewer form still shows the v1 questions.
5. Open the roster. Confirm the outstanding column names real people.
6. Nudge in-app, then log in as the target and confirm the reminder shows on `/appraisals`.
7. Nudge the same person again immediately — confirm the 429 and the "Send anyway" path.
8. Nudge with email. **Whatever happens, confirm the UI reports the true outcome** — a red toast if the send failed.
9. Complete the cycle through to `released`.
10. Read the appraisal as `appraisal-employee@` — confirm the comparison shows self/manager/peer aggregates and **no peer names anywhere in the page or the network response**.
11. Read the same appraisal as `appraisal-manager@` — confirm the per-peer breakdown IS there, with names.
12. Open the cycle report — confirm the histogram and per-question means.

- [ ] **Step 5: Record the outcome**

Append the full result to `.superpowers/sdd/progress.md`, including anything that did not work. Do **not** commit.

---

# Self-review

Checked against `docs/superpowers/specs/2026-08-05-appraisal-module-phase-3-design.md`:

| Spec requirement | Task |
|---|---|
| `AppraisalTemplate` version fields + 3 indexes | 1 |
| `ensureDefaultTemplate` race fix | 2 |
| `AppraisalCycle.templateFamily`, pin at launch | 3 |
| Template read API + router + `server.js` mount | 4 |
| Fork-vs-in-place, archive, transaction replay test | 5 |
| Backfill migration | 6 |
| `outstandingActionsFor` | 7 |
| Roster endpoint | 8 |
| `AppraisalNudge`, throttle, honest send reporting | 9 |
| In-app nudge delivery | 10 |
| Report endpoint, per-kind means | 11 |
| `buildComparison`, per-question suppression | 12 |
| `comparison` on `getAppraisal`, leak traversal | 13 |
| Service types and wrappers | 14 |
| Template builder UI | 15 |
| Cycle template picker | 16 |
| `cycle-roster.tsx` | 17 |
| `cycle-report.tsx` | 18 |
| Comparison UI + peer breakdown split + grep guard | 19 |
| E2E over live HTTP | 20 |

**`nextAppraisalDate`** appears in no task — correct. The spec's resolution is "kept, and deliberately never written by this module", which is a decision to record, not code to write. Note it in the ledger when Task 20 closes.

**`REVIEWER_IDENTITY_FIELDS`** is not modified by any task — also correct, and load-bearing: it stays `['reviewerIds', 'peerNominations']` *because* nudges went into their own collection (Task 9) and `peerBreakdown` is absent from the subject's input (Tasks 12–13), not because nothing identity-bearing was added. If either of those designs is changed during implementation, the deny-list must gain an entry in the same edit.
