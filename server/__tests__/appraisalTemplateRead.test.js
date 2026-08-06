// server/__tests__/appraisalTemplateRead.test.js — Phase 3 Task 4
//
// Read/create half of the HR form builder. The versioning machinery
// (`family`, `version`, `isLatest`, `isDefault`) is the controller's own
// state, never the caller's: these tests pin both the tenant boundary and the
// fact that a request body cannot reach into it.
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

// Added beyond the plan's eight: the `isArchived: false` clause of the
// listTemplates filter was otherwise unasserted, so deleting it — or writing
// it as a truthiness check — would have left the suite green while retired
// forms reappeared in HR's picker.
test('listTemplates hides archived families', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const h = makeHarness({ users: [user] });
  t.after(h.restore);

  h.db.templates.push(
    { _id: oid(), tenant, family: oid(), version: 1, isLatest: true, name: 'Live', isArchived: false },
    { _id: oid(), tenant, family: oid(), version: 3, isLatest: true, name: 'Retired', isArchived: true }
  );

  const res = capture();
  await templates.listTemplates(asUser(user), res, (e) => { throw e; });

  assert.strictEqual(res.body.data.length, 1);
  assert.strictEqual(res.body.data[0].name, 'Live');
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

// Added beyond the plan's eight. `req.params.id` is caller-controlled, and a
// non-ObjectId string handed straight to a Mongoose filter raises a CastError
// that the global handler in server.js deliberately does NOT translate — it
// would surface as a 500 for what is plainly a bad request. Matches
// cycleProgress, the only other appraisal handler that guards its id.
// The plan tested only getTemplate's refusals. Without this, a handler whose
// whole body was `res.status(404)` would pass every other getTemplate test.
test('getTemplate returns an own-tenant form, sections and all', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const mine = {
    _id: oid(), tenant, family: oid(), version: 2, isLatest: true, name: 'Mine',
    sections: [{ title: 'Delivery', questions: [{ type: 'text', label: 'Q', askOf: ['self'] }] }],
  };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);
  h.db.templates.push(mine);

  const res = capture();
  await templates.getTemplate(
    asUser(user, { params: { id: String(mine._id) } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 200);
  assert.strictEqual(String(res.body.data._id), String(mine._id));
  // The editor UI (Task 15) builds the whole form off this payload, so the
  // full sections tree must survive the read, not just the row's scalars.
  assert.strictEqual(res.body.data.sections.length, 1);
  assert.strictEqual(res.body.data.sections[0].questions.length, 1);
});

test('getTemplate 400s for a malformed id rather than 500ing on a CastError', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const h = makeHarness({ users: [user] });
  t.after(h.restore);

  const res = capture();
  await templates.getTemplate(
    asUser(user, { params: { id: 'not-an-objectid' } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 400);
});

test('listVersions returns the family newest-first, scoped to the tenant', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const family = oid();
  const v1 = { _id: oid(), tenant, family, version: 1, isLatest: false, name: 'T' };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);
  h.db.templates.push(v1, { _id: oid(), tenant, family, version: 2, isLatest: true, name: 'T' });
  // Same family id, another tenant. Without this row the `tenant` clause of the
  // SECOND query is never exercised, and a `find({family})` that forgot to
  // scope would pass this test — listVersions is the only handler here that
  // joins across documents, and Task 5's fork reads the same family list.
  h.db.templates.push({ _id: oid(), tenant: oid(), family, version: 3, isLatest: true, name: 'FOREIGN' });

  const res = capture();
  await templates.listVersions(
    asUser(user, { params: { id: String(v1._id) } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body.data.map((x) => x.version), [2, 1]);
  assert.ok(
    res.body.data.every((x) => x.name !== 'FOREIGN'),
    'the family version list must not cross the tenant line'
  );
});

// A template written before Phase 3 has no `family`. Mongoose strips undefined
// out of a filter, so the unguarded query collapses to `{tenant}` — every form
// the tenant owns, presented as one form's version history.
test('listVersions does not list every template when the row predates `family`', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const h = makeHarness({ users: [user] });
  t.after(h.restore);

  const legacy = { _id: oid(), tenant, version: 1, isLatest: true, name: 'Legacy' };
  h.db.templates.push(
    legacy,
    { _id: oid(), tenant, family: oid(), version: 1, isLatest: true, name: 'Unrelated A' },
    { _id: oid(), tenant, family: oid(), version: 1, isLatest: true, name: 'Unrelated B' }
  );

  const res = capture();
  await templates.listVersions(
    asUser(user, { params: { id: String(legacy._id) } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.length, 1, 'a family-less template is its own only version');
  assert.strictEqual(String(res.body.data[0]._id), String(legacy._id));
});

// Added beyond the plan's eight, for the same CastError reason as getTemplate.
test('listVersions 400s for a malformed id rather than 500ing on a CastError', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const h = makeHarness({ users: [user] });
  t.after(h.restore);

  const res = capture();
  await templates.listVersions(
    asUser(user, { params: { id: '../../etc/passwd' } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 400);
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

  // Assert what was STORED, not just what was echoed back. Dropping either of
  // these from the create call left every other assertion here green: `tenant`
  // is required so production would at least 400 loudly, but `createdBy` is
  // not, so losing it ships silently and every row in the version history that
  // listVersions projects renders with no author.
  const stored = h.db.templates[0];
  assert.strictEqual(String(stored.tenant), String(tenant));
  assert.strictEqual(String(stored.createdBy), String(user._id));
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

// ── Phase 3 Task 15: getTemplate reports hasLaunchedCycle ──────────────────
//
// The editor needs to warn HR that saving will fork a new version BEFORE they
// save. The `forked` flag on the PUT response cannot serve that — it only
// describes a save that already happened. So getTemplate runs the same
// predicate updateTemplate branches on, via the shared hasLaunchedCycleFor.
// These tests pin the two states and the two ways the flag could be wrong.

test('getTemplate reports hasLaunchedCycle false when nothing has launched', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const mine = { _id: oid(), tenant, family: oid(), version: 1, isLatest: true, name: 'Mine' };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);
  h.db.templates.push(mine);

  const res = capture();
  await templates.getTemplate(
    asUser(user, { params: { id: String(mine._id) } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.hasLaunchedCycle, false);
});

test('getTemplate reports hasLaunchedCycle true once a pinned cycle has launched', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const mine = { _id: oid(), tenant, family: oid(), version: 1, isLatest: true, name: 'Mine' };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);
  h.db.templates.push(mine);
  h.db.cycles.push({
    _id: oid(), tenant, name: 'H1', template: mine._id, launchedAt: new Date(),
  });

  const res = capture();
  await templates.getTemplate(
    asUser(user, { params: { id: String(mine._id) } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.body.data.hasLaunchedCycle, true);
});

// The discriminating case. A DRAFT cycle is pinned to the version but has not
// launched, so an edit still saves in place — warning about a fork here would
// be a lie, and it is the mistake a naive `cycles.length > 0` check makes.
test('a pinned but UNLAUNCHED cycle does not set hasLaunchedCycle', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const mine = { _id: oid(), tenant, family: oid(), version: 1, isLatest: true, name: 'Mine' };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);
  h.db.templates.push(mine);
  h.db.cycles.push({
    _id: oid(), tenant, name: 'Draft', template: mine._id, launchedAt: null,
  });

  const res = capture();
  await templates.getTemplate(
    asUser(user, { params: { id: String(mine._id) } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.body.data.hasLaunchedCycle, false);
});

// Tenant scoping on the probe itself: without the `tenant` clause another
// tenant's launched cycle would be visible here, and — because updateTemplate
// branches on the SAME helper — would silently force a fork on every edit of
// this tenant's form.
test('another tenant\'s launched cycle cannot set hasLaunchedCycle', async (t) => {
  const tenant = oid();
  const other = oid();
  const user = hr(tenant);
  const mine = { _id: oid(), tenant, family: oid(), version: 1, isLatest: true, name: 'Mine' };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);
  h.db.templates.push(mine);
  h.db.cycles.push({
    _id: oid(), tenant: other, name: 'Theirs', template: mine._id, launchedAt: new Date(),
  });

  const res = capture();
  await templates.getTemplate(
    asUser(user, { params: { id: String(mine._id) } }), res, (e) => { throw e; }
  );

  assert.strictEqual(res.body.data.hasLaunchedCycle, false);
});
