// server/__tests__/appraisalCycleProgress.test.js
//
// Phase 2 Task 9: HR stall surface. Nomination adds two new ways an
// appraisal can stall — nobody nominated (`nominating`), or the manager
// never approved (`pending_peer_approval`). cycleProgress must surface
// those rows WITH names (HR cannot chase a bare ObjectId), scoped to the
// caller's tenant, and only once the cycle's nominationDeadline has
// actually passed — a cycle with no deadline set can never be "late".
//
// Idiom follows appraisalCycle.launch.test.js: stub the model statics with
// hand-written fakes and call the controller directly against a fake
// req/res. No supertest, no in-memory Mongo.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const AppraisalCycle = require('../models/AppraisalCycle');
const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const User = require('../models/User');
const cycles = require('../controllers/appraisalCycle.controller');

const oid = () => new mongoose.Types.ObjectId();

/** A chainable stub for `.lean()` query builders (no populate/select needed). */
function leanChain(resolve) {
  return { lean: async () => resolve() };
}

/** A chainable stub for `.populate(...).populate(...).select(...).lean()`. */
function populateChain(resolve) {
  const chain = {
    populate() { return chain; },
    select() { return chain; },
    lean: async () => resolve(),
  };
  return chain;
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
 * Drives cycleProgress with a cycle carrying `nominationDeadline` and a set
 * of appraisals described only by `state` (+ optional `updatedAt`). Returns
 * the response body so tests can assert on `data.stalled`.
 */
async function progress({ nominationDeadline, appraisals }) {
  const tenantId = oid();
  const cycleId = oid();

  const cycleDoc = { _id: cycleId, tenant: tenantId, nominationDeadline };

  const originalCycleFindOne = AppraisalCycle.findOne;
  const originalAppraisalAggregate = Appraisal.aggregate;
  const originalAppraisalFind = Appraisal.find;
  const originalFeedbackCount = AppraisalFeedback.countDocuments;
  const originalUserFind = User.find;

  // cycleProgress excludes appraisals whose employee has been deleted, which
  // costs it one read of the tenant's deleted users. Stubbed to "nobody has
  // been deleted" so these tests keep asserting the stall rules alone —
  // appraisalDeletedEmployees.test.js is what covers the exclusion itself.
  User.find = () => ({ select: () => leanChain(() => []) });

  AppraisalCycle.findOne = (filter) => {
    assert.strictEqual(String(filter.tenant), String(tenantId), 'cycle lookup must be tenant-scoped');
    return leanChain(() => cycleDoc);
  };
  Appraisal.aggregate = async () => {
    const byState = {};
    for (const a of appraisals) byState[a.state] = (byState[a.state] || 0) + 1;
    return Object.entries(byState).map(([_id, count]) => ({ _id, count }));
  };
  AppraisalFeedback.countDocuments = async () => 0;
  Appraisal.find = (filter) => {
    // The whole point of this task: HR cannot leak another tenant's names.
    assert.strictEqual(String(filter.tenant), String(tenantId), 'stalled query must be tenant-scoped');
    const matched = appraisals.filter((a) => filter.state.$in.includes(a.state));
    return populateChain(() => matched.map((a, i) => ({
      _id: oid(),
      state: a.state,
      updatedAt: a.updatedAt,
      employee: { _id: oid(), firstName: `Employee${i}`, lastName: 'Test' },
      manager: { _id: oid(), firstName: `Manager${i}`, lastName: 'Test' },
    })));
  };

  const { req, res, getBody } = fakeReqRes({ tenantId, cycleId });
  try {
    await cycles.cycleProgress(req, res, (err) => { throw err; });
  } finally {
    AppraisalCycle.findOne = originalCycleFindOne;
    Appraisal.aggregate = originalAppraisalAggregate;
    Appraisal.find = originalAppraisalFind;
    AppraisalFeedback.countDocuments = originalFeedbackCount;
    User.find = originalUserFind;
  }

  return getBody();
}

test('stalled nominations come back with names, not ObjectIds', async () => {
  const body = await progress({
    nominationDeadline: new Date('2026-01-01'),
    appraisals: [
      { state: 'nominating', updatedAt: new Date('2025-12-01') },
      { state: 'pending_peer_approval', updatedAt: new Date('2025-12-01') },
      { state: 'collecting', updatedAt: new Date('2025-12-01') },
    ],
  });
  assert.strictEqual(body.data.stalled.length, 2, 'only the two nomination states stall');
  for (const row of body.data.stalled) {
    assert.ok(row.employee.firstName, 'HR cannot chase an ObjectId');
    assert.ok(row.manager.firstName);
    assert.ok(row.since);
  }
});

test('nothing is stalled before the nomination deadline', async () => {
  const body = await progress({
    nominationDeadline: new Date('2099-01-01'),
    appraisals: [{ state: 'nominating', updatedAt: new Date() }],
  });
  assert.deepStrictEqual(body.data.stalled, []);
});

test('a cycle with no nomination deadline reports nothing stalled', async () => {
  const body = await progress({ nominationDeadline: null, appraisals: [{ state: 'nominating' }] });
  assert.deepStrictEqual(body.data.stalled, []);
});
