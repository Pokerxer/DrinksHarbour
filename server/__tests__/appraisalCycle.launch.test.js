// server/__tests__/appraisalCycle.launch.test.js
//
// Phase 2 Task 4: cycle launch must honour AppraisalCycle.peerReviewEnabled
// (nominating vs collecting) and the response's skipped[] must carry
// resolvable employee names, not bare ObjectIds an HR user cannot act on.
//
// Idiom follows adminReviewCrossTenantListing.test.js: stub the model
// statics with hand-written fakes and call the controller directly against
// a fake req/res. No supertest, no in-memory Mongo.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const AppraisalCycle = require('../models/AppraisalCycle');
const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const User = require('../models/User');
const Department = require('../models/Department');
const cycles = require('../controllers/appraisalCycle.controller');

const oid = () => new mongoose.Types.ObjectId();

/** A chainable stub for `.select(...).lean()` / `.lean()` query builders. */
function chainable(resolve) {
  const chain = {
    select() { return chain; },
    lean: async () => resolve(),
  };
  return chain;
}

function stubSession() {
  return {
    withTransaction: async (fn) => { await fn(); },
    endSession() {},
  };
}

function fakeReqRes({ tenantId, cycleId }) {
  let jsonBody;
  const res = {
    status() { return res; },
    json(body) { jsonBody = body; return res; },
  };
  const req = {
    tenant: { _id: tenantId },
    user: { _id: oid() },
    params: { id: String(cycleId) },
    body: {},
  };
  return { req, res, getBody: () => jsonBody };
}

/**
 * Launches a cycle with a single employee who HAS a manager, so it lands in
 * plan.toCreate. Returns the documents passed to Appraisal.create so the
 * test can assert on state/reviewerIds without touching a database.
 */
async function captureLaunch({ peerReviewEnabled }) {
  const tenantId = oid();
  const cycleId = oid();
  const employeeId = oid();
  const managerId = oid();

  const cycleDoc = {
    _id: cycleId,
    tenant: tenantId,
    status: 'draft',
    peerReviewEnabled,
    launchedAt: null,
    save: async function save() { return this; },
  };

  const originalCycleFindOne = AppraisalCycle.findOne;
  const originalUserFind = User.find;
  const originalUserFindOne = User.findOne;
  const originalDepartmentFind = Department.find;
  const originalAppraisalFind = Appraisal.find;
  const originalAppraisalCreate = Appraisal.create;
  const originalFeedbackInsertMany = AppraisalFeedback.insertMany;
  const originalStartSession = mongoose.startSession;

  // Phase 5 reviewer routing reads the department roster and the tenant owner
  // before planning the launch. Neither exists in this fixture, so routing
  // falls all the way through to work.manager — which is exactly the
  // pre-Phase-5 behaviour these tests were written to pin down.
  Department.find = () => chainable(() => []);
  User.findOne = () => chainable(() => null);

  const created = [];

  AppraisalCycle.findOne = () => Promise.resolve(cycleDoc);
  User.find = (filter) => chainable(() => {
    // The employees query filters on role; the skipped-name lookup filters
    // on _id.$in instead. This path only ever exercises the former.
    if (filter && filter.role) {
      return [{ _id: employeeId, employeeProfile: { work: { manager: managerId } } }];
    }
    return [];
  });
  Appraisal.find = () => chainable(() => []);
  Appraisal.create = async (docs) => {
    const doc = { ...docs[0], _id: oid() };
    created.push(doc);
    return [doc];
  };
  AppraisalFeedback.insertMany = async () => [];
  mongoose.startSession = async () => stubSession();

  const { req, res } = fakeReqRes({ tenantId, cycleId });
  try {
    await cycles.launchCycle(req, res, (err) => { throw err; });
  } finally {
    AppraisalCycle.findOne = originalCycleFindOne;
    User.find = originalUserFind;
    User.findOne = originalUserFindOne;
    Department.find = originalDepartmentFind;
    Appraisal.find = originalAppraisalFind;
    Appraisal.create = originalAppraisalCreate;
    AppraisalFeedback.insertMany = originalFeedbackInsertMany;
    mongoose.startSession = originalStartSession;
  }

  return created;
}

/**
 * Launches a cycle with a single employee who has NO manager, so it lands in
 * plan.skipped with reason 'no_manager'. Returns the response body's `data`
 * so the test can assert the skipped entry carries a resolvable name.
 */
async function captureLaunchSkips() {
  const tenantId = oid();
  const cycleId = oid();
  const employeeId = oid();

  const cycleDoc = {
    _id: cycleId,
    tenant: tenantId,
    status: 'draft',
    peerReviewEnabled: true,
    launchedAt: null,
    save: async function save() { return this; },
  };

  const originalCycleFindOne = AppraisalCycle.findOne;
  const originalUserFind = User.find;
  const originalUserFindOne = User.findOne;
  const originalDepartmentFind = Department.find;
  const originalAppraisalFind = Appraisal.find;
  const originalAppraisalCreate = Appraisal.create;
  const originalFeedbackInsertMany = AppraisalFeedback.insertMany;
  const originalStartSession = mongoose.startSession;

  // Phase 5 reviewer routing reads the department roster and the tenant owner
  // before planning the launch. Neither exists in this fixture, so routing
  // falls all the way through to work.manager — which is exactly the
  // pre-Phase-5 behaviour these tests were written to pin down.
  Department.find = () => chainable(() => []);
  User.findOne = () => chainable(() => null);

  User.find = (filter) => chainable(() => {
    if (filter && filter.role) {
      // No manager on file → planCycleLaunch will skip this employee.
      return [{ _id: employeeId, employeeProfile: { work: {} } }];
    }
    if (filter && filter._id && filter._id.$in) {
      // Skipped-employee name resolution: assert tenant scoping to catch cross-tenant leaks.
      assert.strictEqual(String(filter.tenant), String(tenantId), 'name-resolution query must be tenant-scoped');
      return [{ _id: employeeId, firstName: 'Ada', lastName: 'Obi', email: 'ada@example.test' }];
    }
    return [];
  });
  AppraisalCycle.findOne = () => Promise.resolve(cycleDoc);
  Appraisal.find = () => chainable(() => []);
  Appraisal.create = async () => {
    throw new Error('Appraisal.create should not run for a skipped, manager-less employee');
  };
  AppraisalFeedback.insertMany = async () => {
    throw new Error('AppraisalFeedback.insertMany should not run for a skipped employee');
  };
  mongoose.startSession = async () => stubSession();

  const { req, res, getBody } = fakeReqRes({ tenantId, cycleId });
  try {
    await cycles.launchCycle(req, res, (err) => { throw err; });
  } finally {
    AppraisalCycle.findOne = originalCycleFindOne;
    User.find = originalUserFind;
    User.findOne = originalUserFindOne;
    Department.find = originalDepartmentFind;
    Appraisal.find = originalAppraisalFind;
    Appraisal.create = originalAppraisalCreate;
    AppraisalFeedback.insertMany = originalFeedbackInsertMany;
    mongoose.startSession = originalStartSession;
  }

  return getBody().data;
}

test('a peer-review cycle launches into nominating, a plain one into collecting', async () => {
  for (const [peerReviewEnabled, expected] of [[true, 'nominating'], [false, 'collecting']]) {
    const docs = await captureLaunch({ peerReviewEnabled });
    assert.strictEqual(docs[0].state, expected);
    assert.deepStrictEqual(
      docs[0].reviewerIds.map(String).length, 2,
      'reviewerIds still starts as [employee, manager] — a peer joins only on approval'
    );
  }
});

test('skipped employees come back with names an HR user can act on', async () => {
  const { skipped } = await captureLaunchSkips();
  assert.strictEqual(skipped.length, 1);
  assert.strictEqual(skipped[0].reason, 'no_manager');
  assert.ok(skipped[0].employee.firstName, 'a bare ObjectId is unactionable in the HR UI');
});

/**
 * Test peerReviewEnabled casting in createCycle.
 * Verifies that the controller passes the raw value to AppraisalCycle.create,
 * relying on Mongoose's Boolean cast to handle string "false" from HTML forms.
 */
test('createCycle: omitted peerReviewEnabled defaults to true', async () => {
  const tenantId = oid();
  const userId = oid();
  let capturedArg;

  const originalCreate = AppraisalCycle.create;
  const originalEnsure = require('../controllers/appraisalCycle.controller').__ensureDefaultTemplate
    || (async () => ({ _id: oid() })); // Fallback in case it's not exported

  // Stub to capture what the controller passes
  AppraisalCycle.create = async (doc) => {
    capturedArg = doc;
    return { _id: oid(), ...doc };
  };

  const res = {
    status() { return res; },
    json(body) { this.body = body; return res; },
  };
  const req = {
    tenant: { _id: tenantId },
    user: { _id: userId },
    body: {
      name: 'Test Cycle',
      // peerReviewEnabled intentionally omitted
    },
  };

  try {
    // Mock ensureDefaultTemplate inline
    const appraisalCycleController = require('../controllers/appraisalCycle.controller');
    const mockEnsure = async () => ({ _id: oid() });

    // We need to inject the mock, but since ensureDefaultTemplate is internal,
    // we test via the actual module. Stub the imported AppraisalTemplate instead.
    const AppraisalTemplate = require('../models/AppraisalTemplate');
    const originalFindOne = AppraisalTemplate.findOne;
    const originalTemplateCreate = AppraisalTemplate.create;
    const originalFindOneAndUpdate = AppraisalTemplate.findOneAndUpdate;

    AppraisalTemplate.findOne = () => Promise.resolve(null); // Simulate no existing template
    AppraisalTemplate.create = async (doc) => ({ _id: oid(), ...doc });
    // ensureDefaultTemplate now upserts via findOneAndUpdate; the real op
    // would insert-and-return a template carrying at least _id and family,
    // both of which createCycle reads off the resolved template.
    AppraisalTemplate.findOneAndUpdate = async (filter) => ({
      _id: oid(),
      family: oid(),
      tenant: filter.tenant,
      isDefault: true,
      isLatest: true,
    });

    await appraisalCycleController.createCycle(req, res, (err) => { throw err; });

    // When undefined is passed, Mongoose's Boolean cast should apply schema default
    // Simulate what Mongoose does:
    const simulated = new AppraisalCycle({ ...capturedArg });
    assert.strictEqual(simulated.peerReviewEnabled, true, 'omitted peerReviewEnabled should default to true');

    AppraisalTemplate.findOne = originalFindOne;
    AppraisalTemplate.create = originalTemplateCreate;
    AppraisalTemplate.findOneAndUpdate = originalFindOneAndUpdate;
  } finally {
    AppraisalCycle.create = originalCreate;
  }
});

test('createCycle: peerReviewEnabled=true persists as true', async () => {
  const tenantId = oid();
  const userId = oid();
  let capturedArg;

  const originalCreate = AppraisalCycle.create;
  AppraisalCycle.create = async (doc) => {
    capturedArg = doc;
    return { _id: oid(), ...doc };
  };

  const res = {
    status() { return res; },
    json(body) { this.body = body; return res; },
  };
  const req = {
    tenant: { _id: tenantId },
    user: { _id: userId },
    body: {
      name: 'Test Cycle',
      peerReviewEnabled: true,
    },
  };

  try {
    const AppraisalTemplate = require('../models/AppraisalTemplate');
    const originalFindOne = AppraisalTemplate.findOne;
    const originalTemplateCreate = AppraisalTemplate.create;
    const originalFindOneAndUpdate = AppraisalTemplate.findOneAndUpdate;

    AppraisalTemplate.findOne = () => Promise.resolve(null);
    AppraisalTemplate.create = async (doc) => ({ _id: oid(), ...doc });
    // ensureDefaultTemplate now upserts via findOneAndUpdate; the real op
    // would insert-and-return a template carrying at least _id and family,
    // both of which createCycle reads off the resolved template.
    AppraisalTemplate.findOneAndUpdate = async (filter) => ({
      _id: oid(),
      family: oid(),
      tenant: filter.tenant,
      isDefault: true,
      isLatest: true,
    });

    const appraisalCycleController = require('../controllers/appraisalCycle.controller');
    await appraisalCycleController.createCycle(req, res, (err) => { throw err; });

    const simulated = new AppraisalCycle({ ...capturedArg });
    assert.strictEqual(simulated.peerReviewEnabled, true, 'peerReviewEnabled=true should persist as true');

    AppraisalTemplate.findOne = originalFindOne;
    AppraisalTemplate.create = originalTemplateCreate;
    AppraisalTemplate.findOneAndUpdate = originalFindOneAndUpdate;
  } finally {
    AppraisalCycle.create = originalCreate;
  }
});

test('createCycle: peerReviewEnabled=false persists as false', async () => {
  const tenantId = oid();
  const userId = oid();
  let capturedArg;

  const originalCreate = AppraisalCycle.create;
  AppraisalCycle.create = async (doc) => {
    capturedArg = doc;
    return { _id: oid(), ...doc };
  };

  const res = {
    status() { return res; },
    json(body) { this.body = body; return res; },
  };
  const req = {
    tenant: { _id: tenantId },
    user: { _id: userId },
    body: {
      name: 'Test Cycle',
      peerReviewEnabled: false,
    },
  };

  try {
    const AppraisalTemplate = require('../models/AppraisalTemplate');
    const originalFindOne = AppraisalTemplate.findOne;
    const originalTemplateCreate = AppraisalTemplate.create;
    const originalFindOneAndUpdate = AppraisalTemplate.findOneAndUpdate;

    AppraisalTemplate.findOne = () => Promise.resolve(null);
    AppraisalTemplate.create = async (doc) => ({ _id: oid(), ...doc });
    // ensureDefaultTemplate now upserts via findOneAndUpdate; the real op
    // would insert-and-return a template carrying at least _id and family,
    // both of which createCycle reads off the resolved template.
    AppraisalTemplate.findOneAndUpdate = async (filter) => ({
      _id: oid(),
      family: oid(),
      tenant: filter.tenant,
      isDefault: true,
      isLatest: true,
    });

    const appraisalCycleController = require('../controllers/appraisalCycle.controller');
    await appraisalCycleController.createCycle(req, res, (err) => { throw err; });

    const simulated = new AppraisalCycle({ ...capturedArg });
    assert.strictEqual(simulated.peerReviewEnabled, false, 'peerReviewEnabled=false should persist as false');

    AppraisalTemplate.findOne = originalFindOne;
    AppraisalTemplate.create = originalTemplateCreate;
    AppraisalTemplate.findOneAndUpdate = originalFindOneAndUpdate;
  } finally {
    AppraisalCycle.create = originalCreate;
  }
});

test('createCycle: peerReviewEnabled="false" (string) casts to false', async () => {
  const tenantId = oid();
  const userId = oid();
  let capturedArg;

  const originalCreate = AppraisalCycle.create;
  AppraisalCycle.create = async (doc) => {
    capturedArg = doc;
    return { _id: oid(), ...doc };
  };

  const res = {
    status() { return res; },
    json(body) { this.body = body; return res; },
  };
  const req = {
    tenant: { _id: tenantId },
    user: { _id: userId },
    body: {
      name: 'Test Cycle',
      peerReviewEnabled: 'false', // String, as from HTML form or non-JSON client
    },
  };

  try {
    const AppraisalTemplate = require('../models/AppraisalTemplate');
    const originalFindOne = AppraisalTemplate.findOne;
    const originalTemplateCreate = AppraisalTemplate.create;
    const originalFindOneAndUpdate = AppraisalTemplate.findOneAndUpdate;

    AppraisalTemplate.findOne = () => Promise.resolve(null);
    AppraisalTemplate.create = async (doc) => ({ _id: oid(), ...doc });
    // ensureDefaultTemplate now upserts via findOneAndUpdate; the real op
    // would insert-and-return a template carrying at least _id and family,
    // both of which createCycle reads off the resolved template.
    AppraisalTemplate.findOneAndUpdate = async (filter) => ({
      _id: oid(),
      family: oid(),
      tenant: filter.tenant,
      isDefault: true,
      isLatest: true,
    });

    const appraisalCycleController = require('../controllers/appraisalCycle.controller');
    await appraisalCycleController.createCycle(req, res, (err) => { throw err; });

    // This is the critical test: string "false" must be cast to boolean false by Mongoose
    const simulated = new AppraisalCycle({ ...capturedArg });
    assert.strictEqual(simulated.peerReviewEnabled, false, 'string "false" should be cast to boolean false by Mongoose');

    AppraisalTemplate.findOne = originalFindOne;
    AppraisalTemplate.create = originalTemplateCreate;
    AppraisalTemplate.findOneAndUpdate = originalFindOneAndUpdate;
  } finally {
    AppraisalCycle.create = originalCreate;
  }
});
