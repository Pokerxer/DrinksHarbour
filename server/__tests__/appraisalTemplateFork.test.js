// server/__tests__/appraisalTemplateFork.test.js — Phase 3 Task 5
//
// Editing a form is copy-on-write: in place while nothing has launched
// against the version, a fork of the family once something has. The fork is a
// two-document write (clear the old `isLatest`, insert v(n+1)) and therefore
// runs in a transaction — which is why the replay test below is not optional.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { makeHarness, asUser, capture } = require('./helpers/appraisalHarness');

const templates = require('../controllers/appraisalTemplate.controller');

const oid = () => new mongoose.Types.ObjectId();
const hr = (tenant) => ({ _id: oid(), tenant, role: 'tenant_admin' });
const sections = (label) => [
  { title: 'S', questions: [{ type: 'text', label, askOf: ['self'] }] },
];
const boom = (e) => { throw e; };

test('editing a template with no launched cycle saves IN PLACE', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const family = oid();
  const v1 = {
    _id: oid(), tenant, family, version: 1, isLatest: true, isDefault: false,
    name: 'Draft form', sections: sections('Old'), isArchived: false,
  };
  const h = makeHarness({ users: [user], template: v1 });
  t.after(h.restore);

  const res = capture();
  await templates.updateTemplate(
    asUser(user, { params: { id: String(v1._id) }, body: { name: 'Renamed', sections: sections('New') } }),
    res, boom
  );

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.version, 1);
  assert.strictEqual(res.body.data.forked, undefined);
  assert.strictEqual(h.db.templates.length, 1, 'must not create a second version');
  assert.strictEqual(h.db.templates[0].name, 'Renamed');
  assert.strictEqual(h.db.templates[0].sections[0].questions[0].label, 'New');
});

test('a DRAFT cycle pinned to the version still edits in place — launchedAt is the marker, not the pin', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const family = oid();
  const v1 = {
    _id: oid(), tenant, family, version: 1, isLatest: true, isDefault: false,
    name: 'F', sections: sections('Old'), isArchived: false,
  };
  const h = makeHarness({
    users: [user],
    template: v1,
    // createCycle pins `template` the moment the cycle is created, so the mere
    // existence of a pinned cycle cannot be the fork trigger; launchCycle
    // re-resolves the pin to the family's latest anyway.
    cycle: {
      _id: oid(), tenant, name: 'Not launched yet', templateFamily: family,
      template: v1._id, status: 'draft',
    },
  });
  t.after(h.restore);

  const res = capture();
  await templates.updateTemplate(
    asUser(user, { params: { id: String(v1._id) }, body: { name: 'F', sections: sections('New') } }),
    res, boom
  );

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.version, 1);
  assert.strictEqual(h.db.templates.length, 1);
});

test('editing a template with a LAUNCHED cycle forks a new version', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const family = oid();
  const v1 = {
    _id: oid(), tenant, family, version: 1, isLatest: true, isDefault: false,
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
    res, boom
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
  assert.strictEqual(next.sections[0].questions[0].label, 'New');
  assert.strictEqual(String(old.family), String(next.family));
  assert.strictEqual(String(next.createdBy), String(user._id));
});

test('a launched cycle pinned to a DIFFERENT version of the family does not force a fork', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const family = oid();
  const v1id = oid();
  const v2 = {
    _id: oid(), tenant, family, version: 2, isLatest: true, isDefault: false,
    name: 'F', sections: sections('Old'), isArchived: false,
  };
  const h = makeHarness({
    users: [user],
    template: v2,
    // Launched against v1. v2 has never been used by anything, so editing it
    // rewrites nobody's in-flight form. Matching the "is it in use" query on
    // `templateFamily` instead of `template` would fork here for no reason and
    // grow a new version on every save forever.
    cycle: {
      _id: oid(), tenant, name: 'Running on v1', templateFamily: family,
      template: v1id, status: 'collecting', launchedAt: new Date('2026-02-01'),
    },
  });
  t.after(h.restore);
  h.db.templates.push({
    _id: v1id, tenant, family, version: 1, isLatest: false, isDefault: false,
    name: 'F', sections: sections('V1'), isArchived: false,
  });

  const res = capture();
  await templates.updateTemplate(
    asUser(user, { params: { id: String(v2._id) }, body: { name: 'F', sections: sections('New') } }),
    res, boom
  );

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.version, 2);
  assert.strictEqual(h.db.templates.length, 2, 'no third row');
});

test('a fork carries the same family and increments from the CURRENT max version', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const family = oid();
  const v2 = {
    _id: oid(), tenant, family, version: 2, isLatest: true, isDefault: false,
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
  h.db.templates.push({
    _id: oid(), tenant, family, version: 1, isLatest: false, isDefault: false,
    name: 'F', isArchived: false,
  });

  const res = capture();
  await templates.updateTemplate(
    asUser(user, { params: { id: String(v2._id) }, body: { name: 'F', sections: sections('New') } }),
    res, boom
  );

  assert.strictEqual(res.body.data.version, 3);
});

test('a fork of the default family stays the default, and only one row matches the partial index', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const family = oid();
  const v1 = {
    _id: oid(), tenant, family, version: 1, isLatest: true, isDefault: true,
    name: 'Default form', sections: sections('Old'), isArchived: false,
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

  const res = capture();
  await templates.updateTemplate(
    asUser(user, { params: { id: String(v1._id) }, body: { name: 'Default form', sections: sections('New') } }),
    res, boom
  );

  assert.strictEqual(res.status, 200);
  // The {tenant, isDefault} unique index is partial on {isDefault, isLatest},
  // so both rows may carry isDefault as long as only one is isLatest.
  assert.strictEqual(h.db.templates.filter((x) => x.isDefault).length, 2);
  assert.strictEqual(h.db.templates.filter((x) => x.isDefault && x.isLatest).length, 1);
});

test('a fork preserves the question _ids the builder sent back', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const family = oid();
  const questionId = oid();
  const sectionId = oid();
  const v1 = {
    _id: oid(), tenant, family, version: 1, isLatest: true, isDefault: false,
    name: 'F', isArchived: false,
    sections: [{
      _id: sectionId,
      title: 'S',
      questions: [{ _id: questionId, type: 'text', label: 'Old', askOf: ['self'] }],
    }],
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

  const res = capture();
  await templates.updateTemplate(
    asUser(user, {
      params: { id: String(v1._id) },
      body: {
        name: 'F',
        sections: [{
          _id: String(sectionId),
          title: 'S',
          questions: [
            { _id: String(questionId), type: 'text', label: 'Reworded', askOf: ['self'] },
            { type: 'text', label: 'Brand new', askOf: ['self'] },
          ],
        }],
      },
    }),
    res, boom
  );

  assert.strictEqual(res.status, 200);
  const next = h.db.templates.find((x) => x.version === 2);
  // A question's id is its identity across versions — it is what makes
  // self-vs-manager and cycle-over-cycle comparison a direct lookup. Reminting
  // on fork would sever every answer already stored against v1's ids.
  assert.strictEqual(String(next.sections[0].questions[0]._id), String(questionId));
  assert.strictEqual(next.sections[0].questions[0].label, 'Reworded');
  assert.strictEqual(next.sections[0].questions[1]._id, undefined,
    'a genuinely new question arrives without an id and Mongoose mints one');
});

test('the fork survives a transaction replay — exactly one v2, one isLatest', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const family = oid();
  const v1 = {
    _id: oid(), tenant, family, version: 1, isLatest: true, isDefault: false,
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
    res, boom
  );

  assert.strictEqual(res.status, 200);
  const inFamily = h.db.templates.filter((x) => String(x.family) === String(family));
  assert.strictEqual(inFamily.length, 2, 'a replay must not leave three rows');
  assert.strictEqual(inFamily.filter((x) => x.isLatest).length, 1);
  assert.strictEqual(inFamily.filter((x) => x.version === 2).length, 1);
  // The demotion of v1 must survive the replay too: a handler that mutates a
  // document loaded OUTSIDE the callback writes attempt 2 into an orphan the
  // rollback already spliced out of the store, leaving v1 still isLatest.
  assert.strictEqual(inFamily.find((x) => x.version === 1).isLatest, false);
  // And the response must describe the row that actually committed.
  assert.strictEqual(res.body.data.version, 2);
  assert.strictEqual(
    String(res.body.data._id),
    String(inFamily.find((x) => x.version === 2)._id)
  );
});

test('updateTemplate 404s for a foreign-tenant id', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const foreign = {
    _id: oid(), tenant: oid(), family: oid(), version: 1, isLatest: true,
    isDefault: false, isArchived: false, sections: sections('X'),
  };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);
  h.db.templates.push(foreign);

  const res = capture();
  await templates.updateTemplate(
    asUser(user, { params: { id: String(foreign._id) }, body: { name: 'Hijack', sections: sections('Y') } }),
    res, boom
  );

  assert.strictEqual(res.status, 404);
  assert.strictEqual(h.db.templates[0].name, undefined);
});

test('updateTemplate 400s on a malformed id instead of 500ing on a CastError', async (t) => {
  const user = hr(oid());
  const h = makeHarness({ users: [user] });
  t.after(h.restore);

  const res = capture();
  await templates.updateTemplate(
    asUser(user, { params: { id: 'not-an-objectid' }, body: { name: 'X', sections: sections('Y') } }),
    res, boom
  );

  assert.strictEqual(res.status, 400);
});

test('updateTemplate refuses to edit a non-latest version', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const family = oid();
  const v1 = {
    _id: oid(), tenant, family, version: 1, isLatest: false, isDefault: false,
    name: 'F', sections: sections('Old'), isArchived: false,
  };
  const h = makeHarness({ users: [user], template: v1 });
  t.after(h.restore);
  h.db.templates.push({
    _id: oid(), tenant, family, version: 2, isLatest: true, isDefault: false,
    name: 'F', isArchived: false,
  });

  const res = capture();
  await templates.updateTemplate(
    asUser(user, { params: { id: String(v1._id) }, body: { name: 'F', sections: sections('New') } }),
    res, boom
  );

  // Editing a superseded version would fork from stale content and produce a
  // v3 that silently discards v2's changes.
  assert.strictEqual(res.status, 400);
  assert.strictEqual(h.db.templates.length, 2);
  assert.strictEqual(h.db.templates[0].sections[0].questions[0].label, 'Old');
});

test('updateTemplate rejects a form with no sections', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const v1 = {
    _id: oid(), tenant, family: oid(), version: 1, isLatest: true, isDefault: false,
    name: 'F', sections: sections('Old'), isArchived: false,
  };
  const h = makeHarness({ users: [user], template: v1 });
  t.after(h.restore);

  const res = capture();
  await templates.updateTemplate(
    asUser(user, { params: { id: String(v1._id) }, body: { name: 'F', sections: [] } }),
    res, boom
  );

  assert.strictEqual(res.status, 400);
  assert.deepStrictEqual(res.body.fields, ['sections']);
  assert.strictEqual(h.db.templates[0].sections[0].questions[0].label, 'Old');
});

test('archiveTemplate archives EVERY version of the family', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const family = oid();
  const v2 = {
    _id: oid(), tenant, family, version: 2, isLatest: true, isDefault: false,
    name: 'F', isArchived: false,
  };
  const h = makeHarness({ users: [user], template: v2 });
  t.after(h.restore);
  h.db.templates.push({
    _id: oid(), tenant, family, version: 1, isLatest: false, isDefault: false,
    name: 'F', isArchived: false,
  });

  const res = capture();
  await templates.archiveTemplate(
    asUser(user, { params: { id: String(v2._id) } }), res, boom
  );

  assert.strictEqual(res.status, 200);
  assert.ok(h.db.templates.every((x) => x.isArchived === true),
    'a historical cycle still resolves its pinned version by _id, so archiving all versions is safe and keeps the family out of new cycles');
});

test('archiveTemplate refuses the default family', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  const v1 = {
    _id: oid(), tenant, family: oid(), version: 1, isLatest: true, isDefault: true,
    name: 'Default form', isArchived: false,
  };
  const h = makeHarness({ users: [user], template: v1 });
  t.after(h.restore);

  const res = capture();
  await templates.archiveTemplate(
    asUser(user, { params: { id: String(v1._id) } }), res, boom
  );

  assert.strictEqual(res.status, 400);
  assert.strictEqual(h.db.templates[0].isArchived, false);
});

test('archiveTemplate on a legacy row with no family archives only that row', async (t) => {
  const tenant = oid();
  const user = hr(tenant);
  // Written before Phase 3, so `family` is absent until Task 6's backfill runs.
  // Mongoose STRIPS undefined out of a filter, so {tenant, family: undefined}
  // collapses to {tenant} and would archive every form the tenant owns.
  const legacy = {
    _id: oid(), tenant, name: 'Legacy', isArchived: false, isDefault: false,
  };
  const other = {
    _id: oid(), tenant, family: oid(), version: 1, isLatest: true,
    isDefault: false, name: 'Unrelated', isArchived: false,
  };
  const h = makeHarness({ users: [user], template: legacy });
  t.after(h.restore);
  h.db.templates.push(other);

  const res = capture();
  await templates.archiveTemplate(
    asUser(user, { params: { id: String(legacy._id) } }), res, boom
  );

  assert.strictEqual(res.status, 200);
  assert.strictEqual(h.db.templates.find((x) => String(x._id) === String(legacy._id)).isArchived, true);
  assert.strictEqual(h.db.templates.find((x) => String(x._id) === String(other._id)).isArchived, false,
    'an undefined family must not collapse the filter to every form in the tenant');
});

test('archiveTemplate 404s for a foreign-tenant id and 400s on a malformed one', async (t) => {
  const user = hr(oid());
  const foreign = {
    _id: oid(), tenant: oid(), family: oid(), version: 1, isLatest: true,
    isDefault: false, name: 'Theirs', isArchived: false,
  };
  const h = makeHarness({ users: [user] });
  t.after(h.restore);
  h.db.templates.push(foreign);

  const res404 = capture();
  await templates.archiveTemplate(
    asUser(user, { params: { id: String(foreign._id) } }), res404, boom
  );
  assert.strictEqual(res404.status, 404);
  assert.strictEqual(h.db.templates[0].isArchived, false);

  const res400 = capture();
  await templates.archiveTemplate(
    asUser(user, { params: { id: 'nope' } }), res400, boom
  );
  assert.strictEqual(res400.status, 400);
});
