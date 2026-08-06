// server/__tests__/appraisalNominate.test.js
//
// Phase 2 Task 5: the three peer-nomination endpoints.
//
// The central guarantee under test: GET /:id/nomination NEVER returns the
// appraisal document, only the hand-built allow-list from
// nominationViewForSubject — so the subject can run their own nomination
// screen without the pre-release read-block (resolveAppraisalAccess.canRead)
// ever being touched. Past 'nominating' that payload collapses to
// {state, approvedCount}, which is what stops the subject inferring which of
// their nominations the manager rejected.
//
// Idiom follows adminReviewCrossTenantListing.test.js / appraisalCycle.launch.test.js:
// stub the model statics with hand-written fakes and call the controller
// directly against a fake req/res. No supertest, no in-memory Mongo.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const Appraisal = require('../models/Appraisal');
const AppraisalCycle = require('../models/AppraisalCycle');
const User = require('../models/User');
const appraisals = require('../controllers/appraisal.controller');

const oid = () => new mongoose.Types.ObjectId();

const tenantId = oid();
const subjectId = oid();
const managerId = oid();
const eligibleA = oid();
const eligibleB = oid();

/** A chainable stub for `.populate().select().sort().lean()` that is also
 * directly awaitable (mongoose Query objects are thenable), since
 * nominatePeers awaits Appraisal.findOne() without chaining .lean() — it
 * needs the real mutable "document" back so it can assign fields and call
 * .save() on it. */
function makeQuery(resolveFn) {
  const q = {
    populate() { return q; },
    select() { return q; },
    sort() { return q; },
    lean: async () => resolveFn(),
    then(resolve, reject) {
      Promise.resolve(resolveFn()).then(resolve, reject);
    },
  };
  return q;
}

function fakeReqRes({ user, appraisalId, body = {} }) {
  let jsonBody;
  let statusCode = 200;
  const res = {
    status(code) { statusCode = code; return res; },
    json(payload) { jsonBody = payload; return res; },
  };
  const req = {
    tenant: { _id: tenantId },
    user,
    params: { id: String(appraisalId) },
    body,
  };
  return { req, res, getStatus: () => statusCode, getBody: () => jsonBody };
}

/**
 * Drives GET /:id/nomination. `peerNominations` seeds the appraisal's
 * denormalised array (used to compute approvedCount past 'nominating').
 */
async function getNomination({ state, asSubject, asStranger, peerNominations = [] }) {
  const appraisalId = oid();
  const cycleId = oid();
  const appraisalDoc = {
    _id: appraisalId,
    tenant: tenantId,
    cycle: cycleId,
    employee: subjectId,
    manager: managerId,
    state,
    reviewerIds: [subjectId, managerId],
    peerNominations,
  };
  const cycleDoc = {
    _id: cycleId,
    tenant: tenantId,
    peerCountMin: 2,
    peerCountMax: 5,
    nominationDeadline: new Date('2026-09-01'),
  };

  const originalAppraisalFindOne = Appraisal.findOne;
  const originalCycleFindOne = AppraisalCycle.findOne;
  const originalUserFind = User.find;

  Appraisal.findOne = () => makeQuery(() => ({ ...appraisalDoc }));
  AppraisalCycle.findOne = () => makeQuery(() => ({ ...cycleDoc }));
  User.find = () => makeQuery(() => [{ _id: eligibleA }, { _id: eligibleB }]);

  const user = asStranger
    ? { _id: oid(), tenant: tenantId, role: 'tenant_staff' }
    : asSubject
      ? { _id: subjectId, tenant: tenantId, role: 'tenant_staff' }
      : { _id: managerId, tenant: tenantId, role: 'tenant_staff' };

  const { req, res, getStatus, getBody } = fakeReqRes({ user, appraisalId });
  try {
    await appraisals.getNomination(req, res, (err) => { throw err; });
  } finally {
    Appraisal.findOne = originalAppraisalFindOne;
    AppraisalCycle.findOne = originalCycleFindOne;
    User.find = originalUserFind;
  }
  return { status: getStatus(), data: getBody() && getBody().data };
}

/**
 * Drives POST /:id/nominate as the subject. The stubbed eligible-peer list
 * always includes eligibleA/eligibleB plus any real ObjectId the test itself
 * is trying to nominate (existingProposed / body.userIds) — so a scenario
 * that nominates arbitrary fresh ids (not eligibleA/B) still exercises a
 * *valid* nomination, while a non-ObjectId sentinel like 'not-eligible'
 * never becomes eligible, keeping the invalid-nomination test meaningful.
 *
 * On success the return value IS the persisted snapshot (state,
 * peerNominations) with `status`/`saved` also attached, so callers can use
 * either `const saved = await postNominate(...)` or destructure
 * `{ status, saved }` depending on what they need to assert.
 */
async function postNominate({ existingProposed = [], body, expectFail = false }) {
  const appraisalId = oid();
  const cycleId = oid();

  const extraEligible = [...existingProposed, ...(Array.isArray(body && body.userIds) ? body.userIds : [])]
    .filter((v) => v instanceof mongoose.Types.ObjectId);
  const eligibleIds = [...new Set([eligibleA, eligibleB, ...extraEligible].map(String))].map(
    (s) => new mongoose.Types.ObjectId(s)
  );

  let savedSnapshot = null;
  const appraisalDoc = {
    _id: appraisalId,
    tenant: tenantId,
    cycle: cycleId,
    employee: subjectId,
    manager: managerId,
    state: 'nominating',
    reviewerIds: [subjectId, managerId],
    peerNominations: existingProposed.map((u) => ({ user: u, proposedBy: subjectId, status: 'proposed' })),
    save: async function save() {
      savedSnapshot = { state: this.state, peerNominations: this.peerNominations };
      return this;
    },
  };
  const cycleDoc = { _id: cycleId, tenant: tenantId, peerCountMin: 1, peerCountMax: 5, nominationDeadline: null };

  const originalAppraisalFindOne = Appraisal.findOne;
  const originalCycleFindOne = AppraisalCycle.findOne;
  const originalUserFind = User.find;

  // nominatePeers awaits Appraisal.findOne(...) directly (no .lean()), so it
  // must get back the SAME mutable object every time, not a fresh copy —
  // otherwise the field assignments the handler makes would not be visible
  // to the .save() call captured above.
  Appraisal.findOne = () => makeQuery(() => appraisalDoc);
  AppraisalCycle.findOne = () => makeQuery(() => ({ ...cycleDoc }));
  User.find = () => makeQuery(() => eligibleIds.map((_id) => ({ _id })));

  const user = { _id: subjectId, tenant: tenantId, role: 'tenant_staff' };
  const { req, res, getStatus } = fakeReqRes({ user, appraisalId, body });

  try {
    await appraisals.nominatePeers(req, res, (err) => { throw err; });
  } finally {
    Appraisal.findOne = originalAppraisalFindOne;
    AppraisalCycle.findOne = originalCycleFindOne;
    User.find = originalUserFind;
  }

  const status = getStatus();
  if (expectFail) assert.strictEqual(savedSnapshot, null, 'a rejected request must not call .save()');
  return savedSnapshot
    ? { status, saved: savedSnapshot, ...savedSnapshot }
    : { status, saved: null };
}

/** Exercises loadEligiblePeers directly and captures the User.find filter. */
async function getEligiblePeers() {
  const originalUserFind = User.find;
  let capturedFilter;
  User.find = (filter) => {
    capturedFilter = filter;
    return makeQuery(() => []);
  };
  try {
    const req = { tenant: { _id: tenantId } };
    const appraisal = { employee: subjectId, manager: managerId };
    await appraisals._internal.loadEligiblePeers(req, appraisal);
  } finally {
    User.find = originalUserFind;
  }
  return { filter: capturedFilter };
}

test('the subject reading their nomination screen never receives the appraisal document', async () => {
  const body = await getNomination({ state: 'nominating', asSubject: true });
  assert.deepStrictEqual(
    Object.keys(body.data).sort(),
    ['deadline', 'max', 'min', 'myProposals', 'state']
  );
  assert.strictEqual(body.data.summary, undefined);
  assert.strictEqual(body.data.reviewerIds, undefined);
  assert.strictEqual(body.data.peerNominations, undefined);
});

test('past nominating the subject gets a count and cannot infer rejections', async () => {
  const body = await getNomination({
    state: 'collecting',
    asSubject: true,
    peerNominations: [{ user: oid(), status: 'approved' }, { user: oid(), status: 'rejected' }],
  });
  assert.deepStrictEqual(Object.keys(body.data).sort(), ['approvedCount', 'state']);
  assert.strictEqual(body.data.approvedCount, 1);
});

test('a stranger gets 403 on the nomination screen', async () => {
  const { status } = await getNomination({ state: 'nominating', asStranger: true });
  assert.strictEqual(status, 403);
});

test('nominating replaces every proposed entry rather than appending', async () => {
  const first = oid();
  const second = oid();
  const saved = await postNominate({ existingProposed: [first], body: { userIds: [second] } });
  assert.strictEqual(saved.peerNominations.length, 1);
  assert.strictEqual(String(saved.peerNominations[0].user), String(second));
});

test('an invalid nomination is rejected whole, not partially applied', async () => {
  const { status, saved } = await postNominate({ body: { userIds: ['not-eligible'] }, expectFail: true });
  assert.strictEqual(status, 400);
  assert.strictEqual(saved, null, 'nothing was written');
});

test('submitting a valid nomination advances to pending_peer_approval', async () => {
  const saved = await postNominate({ body: { userIds: [eligibleA, eligibleB] } });
  assert.strictEqual(saved.state, 'pending_peer_approval');
  assert.strictEqual(saved.peerNominations.length, 2);
  for (const n of saved.peerNominations) {
    assert.strictEqual(n.status, 'proposed');
    assert.ok(n.proposedBy, 'proposedBy records who actually chose — subject or HR on their behalf');
  }
});

test('eligible peers exclude the subject and the manager', async () => {
  const { filter } = await getEligiblePeers();
  assert.deepStrictEqual(Object.keys(filter).sort(), ['_id', 'role', 'status', 'tenant']);
  assert.ok(filter._id.$nin, 'subject and manager are excluded by $nin');
  assert.strictEqual(filter.status, 'active');
});
