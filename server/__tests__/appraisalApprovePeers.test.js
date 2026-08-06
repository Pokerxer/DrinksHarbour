// server/__tests__/appraisalApprovePeers.test.js
//
// Phase 2 Task 6: the manager/HR side of peer nomination — approve/reject,
// HR's skip-peers escape hatch, and backfilling a replacement after a peer
// declines.
//
// The central guarantee under test: a peer joins appraisal.reviewerIds ONLY
// once approved (never at nomination time, never on rejection), and
// planPeerRowCreation's "already in reviewerIds" skip is what keeps a
// double-submitted approval or a backfill of an already-approved peer from
// colliding on the unique(appraisal, reviewer) index.
//
// Idiom follows appraisalNominate.test.js / appraisalCycle.launch.test.js:
// stub the model statics with hand-written fakes and call the controller
// directly against a fake req/res. No supertest, no in-memory Mongo.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const User = require('../models/User');
const appraisals = require('../controllers/appraisal.controller');

const oid = () => new mongoose.Types.ObjectId();

const tenantId = oid();
const subjectId = oid();
const managerId = oid();
const peerA = oid();
const peerB = oid();
const peerC = oid();
const peerD = oid();
const peerWhoDeclined = oid();

/** A chainable stub for `.populate().select().sort().lean()` that is also
 * directly awaitable (mongoose Query objects are thenable), since the
 * handlers under test await Appraisal.findOne() without chaining .lean() —
 * they need the real mutable "document" back so they can assign fields and
 * call .save() on it. Copied from appraisalNominate.test.js. */
function makeQuery(resolveFn) {
  const q = {
    populate() { return q; },
    select() { return q; },
    sort() { return q; },
    // applyPeerDecisions re-reads the appraisal enrolled in the transaction's
    // session (`Appraisal.findOne(...).session(session)`) — chain it like the
    // real mongoose Query does, ignoring the argument here since these fakes
    // don't model a real session-scoped read.
    session() { return q; },
    lean: async () => resolveFn(),
    then(resolve, reject) {
      Promise.resolve(resolveFn()).then(resolve, reject);
    },
  };
  return q;
}

/** Copied from appraisalCycle.launch.test.js: a session stub whose
 * withTransaction just awaits the callback and whose endSession is a no-op —
 * enough to exercise the real control flow without a real Mongo deployment. */
function stubSession() {
  return {
    withTransaction: async (fn) => { await fn(); },
    endSession() {},
  };
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
 * Drives POST /:id/approve-peers as the manager (or the subject, to prove
 * they are refused). `approve`/`reject` seed matching 'proposed' nominations
 * on the appraisal so the decision has something to act on.
 */
async function approve({ approve = [], reject = [], asSubject = false, throwOnSave = false } = {}) {
  const appraisalId = oid();
  const cycleId = oid();
  const nomineeIds = [...approve, ...reject];

  let savedSnapshot = null;
  let saveSession;
  const appraisalDoc = {
    _id: appraisalId,
    tenant: tenantId,
    cycle: cycleId,
    employee: subjectId,
    manager: managerId,
    state: 'pending_peer_approval',
    reviewerIds: [subjectId, managerId],
    peerNominations: nomineeIds.map((user) => ({ user, proposedBy: subjectId, status: 'proposed' })),
    save: async function save(opts) {
      saveSession = opts && opts.session;
      if (throwOnSave) throw new Error('simulated save failure');
      savedSnapshot = { state: this.state, reviewerIds: [...this.reviewerIds], peerNominations: this.peerNominations };
      return this;
    },
  };

  const insertedRows = [];
  let insertManySession;
  const originalFindOne = Appraisal.findOne;
  const originalInsertMany = AppraisalFeedback.insertMany;
  const originalStartSession = mongoose.startSession;
  Appraisal.findOne = () => makeQuery(() => appraisalDoc);
  AppraisalFeedback.insertMany = async (docs, opts) => {
    insertedRows.push(...docs);
    insertManySession = opts && opts.session;
    return docs;
  };
  mongoose.startSession = async () => stubSession();

  const user = asSubject
    ? { _id: subjectId, tenant: tenantId, role: 'tenant_staff' }
    : { _id: managerId, tenant: tenantId, role: 'tenant_staff' };

  const { req, res, getStatus } = fakeReqRes({ user, appraisalId, body: { approve, reject } });
  let thrown = null;
  try {
    await appraisals.approvePeers(req, res, (err) => { throw err; });
  } catch (err) {
    thrown = err;
  } finally {
    Appraisal.findOne = originalFindOne;
    AppraisalFeedback.insertMany = originalInsertMany;
    mongoose.startSession = originalStartSession;
  }
  return {
    status: getStatus(),
    saved: savedSnapshot,
    insertedRows,
    thrown,
    insertManySession,
    saveSession,
  };
}

/**
 * Simulates a double-submitted approve-peers request (the classic
 * double-click, or a client retry after a timed-out-but-succeeded request):
 * the SAME appraisal object is approved twice in a row. Between the two
 * calls the state is forced back to 'pending_peer_approval' so the second
 * call clears the access/transition gate exactly as a genuinely concurrent
 * duplicate request would (both reads happening before either write lands) —
 * but the peerNominations/reviewerIds it acts on already carry the first
 * call's writes, which is what should make planPeerRowCreation a no-op the
 * second time.
 */
async function approveTwice({ approve = [] } = {}) {
  const appraisalId = oid();
  const cycleId = oid();

  const appraisalDoc = {
    _id: appraisalId,
    tenant: tenantId,
    cycle: cycleId,
    employee: subjectId,
    manager: managerId,
    state: 'pending_peer_approval',
    reviewerIds: [subjectId, managerId],
    peerNominations: approve.map((user) => ({ user, proposedBy: subjectId, status: 'proposed' })),
    save: async function save() { return this; },
  };

  const insertedRows = [];
  const originalFindOne = Appraisal.findOne;
  const originalInsertMany = AppraisalFeedback.insertMany;
  const originalStartSession = mongoose.startSession;
  Appraisal.findOne = () => makeQuery(() => appraisalDoc);
  AppraisalFeedback.insertMany = async (docs) => { insertedRows.push(...docs); return docs; };
  mongoose.startSession = async () => stubSession();

  const user = { _id: managerId, tenant: tenantId, role: 'tenant_staff' };
  try {
    const first = fakeReqRes({ user, appraisalId, body: { approve } });
    await appraisals.approvePeers(first.req, first.res, (err) => { throw err; });

    appraisalDoc.state = 'pending_peer_approval'; // see docstring above

    const second = fakeReqRes({ user, appraisalId, body: { approve } });
    await appraisals.approvePeers(second.req, second.res, (err) => { throw err; });
  } finally {
    Appraisal.findOne = originalFindOne;
    AppraisalFeedback.insertMany = originalInsertMany;
    mongoose.startSession = originalStartSession;
  }
  return { insertedRows };
}

/**
 * Drives POST /:id/approve-peers exactly ONCE from the caller's point of
 * view, but the session stub's `withTransaction` internally invokes its
 * callback TWICE — modelling what the real MongoDB driver does on a
 * TransientTransactionError: it silently re-runs the whole callback. The
 * first invocation's writes (insertMany + save) are discarded exactly as an
 * aborted transaction discards them; only the second invocation's writes
 * land in `persisted` / `durableFeedback`. Unlike `approve()` /
 * `approveTwice()` above, `Appraisal.findOne` here hands back a FRESH
 * document hydrated from `persisted` on every call (as a real Mongoose
 * findOne would), instead of one shared object every caller mutates in
 * place — so this is the one place a re-read-per-attempt fix and a
 * closure-mutation bug actually produce different, observable outcomes.
 */
async function approveWithTransactionRetry({ approve = [] } = {}) {
  const appraisalId = oid();
  const cycleId = oid();

  // Stands in for the database. Only ever updated by whichever attempt the
  // fake withTransaction decides to commit (the second one, below).
  const persisted = {
    state: 'pending_peer_approval',
    reviewerIds: [subjectId, managerId],
    peerNominations: approve.map((user) => ({ user, proposedBy: subjectId, status: 'proposed' })),
  };
  const durableFeedback = [];

  const originalFindOne = Appraisal.findOne;
  const originalInsertMany = AppraisalFeedback.insertMany;
  const originalStartSession = mongoose.startSession;

  let pendingWrite = null;
  let pendingFeedback = [];

  Appraisal.findOne = () => makeQuery(() => ({
    _id: appraisalId,
    tenant: tenantId,
    cycle: cycleId,
    employee: subjectId,
    manager: managerId,
    state: persisted.state,
    reviewerIds: [...persisted.reviewerIds],
    peerNominations: persisted.peerNominations.map((n) => ({ ...n })),
    save: async function save() {
      pendingWrite = {
        state: this.state,
        reviewerIds: [...this.reviewerIds],
        peerNominations: this.peerNominations,
      };
      return this;
    },
  }));
  AppraisalFeedback.insertMany = async (docs) => { pendingFeedback.push(...docs); return docs; };
  mongoose.startSession = async () => ({
    withTransaction: async (fn) => {
      // Attempt 1: runs to completion, then gets thrown away — as if the
      // driver hit a TransientTransactionError and aborted the transaction.
      pendingWrite = null;
      pendingFeedback = [];
      await fn();
      pendingWrite = null;
      pendingFeedback = [];

      // Attempt 2: the retry that actually commits.
      await fn();
      if (pendingWrite) Object.assign(persisted, pendingWrite);
      durableFeedback.push(...pendingFeedback);
    },
    endSession() {},
  });

  const user = { _id: managerId, tenant: tenantId, role: 'tenant_staff' };
  const { req, res, getBody } = fakeReqRes({ user, appraisalId, body: { approve } });
  try {
    await appraisals.approvePeers(req, res, (err) => { throw err; });
  } finally {
    Appraisal.findOne = originalFindOne;
    AppraisalFeedback.insertMany = originalInsertMany;
    mongoose.startSession = originalStartSession;
  }
  return { persisted, durableFeedback, body: getBody() };
}

/** Drives POST /:id/skip-peers as HR. */
async function skipPeers({ state }) {
  const appraisalId = oid();
  const cycleId = oid();

  let savedSnapshot = null;
  const appraisalDoc = {
    _id: appraisalId,
    tenant: tenantId,
    cycle: cycleId,
    employee: subjectId,
    manager: managerId,
    state,
    reviewerIds: [subjectId, managerId],
    peerNominations: [],
    save: async function save() { savedSnapshot = { state: this.state }; return this; },
  };

  const originalFindOne = Appraisal.findOne;
  Appraisal.findOne = () => makeQuery(() => appraisalDoc);

  const user = { _id: oid(), tenant: tenantId, role: 'tenant_admin' }; // HR
  const { req, res } = fakeReqRes({ user, appraisalId, body: {} });
  try {
    await appraisals.skipPeers(req, res, (err) => { throw err; });
  } finally {
    Appraisal.findOne = originalFindOne;
  }
  return savedSnapshot;
}

/**
 * Drives POST /:id/peers (backfill) as the manager, always at 'collecting'.
 * `alreadyReviewer: true` seeds `add` into reviewerIds up front, modelling a
 * peer who already declined (declining touches only their AppraisalFeedback
 * row's status, never appraisal.reviewerIds — they stay a reviewer of
 * record) and is now being re-added by mistake or by a stale client.
 */
async function backfill({ add = [], alreadyReviewer = false } = {}) {
  const appraisalId = oid();
  const cycleId = oid();

  let savedSnapshot = null;
  const appraisalDoc = {
    _id: appraisalId,
    tenant: tenantId,
    cycle: cycleId,
    employee: subjectId,
    manager: managerId,
    state: 'collecting',
    reviewerIds: [subjectId, managerId, ...(alreadyReviewer ? add : [])],
    peerNominations: [],
    save: async function save() {
      savedSnapshot = { state: this.state, reviewerIds: [...this.reviewerIds] };
      return this;
    },
  };

  const insertedRows = [];
  const originalFindOne = Appraisal.findOne;
  const originalInsertMany = AppraisalFeedback.insertMany;
  const originalUserFind = User.find;
  const originalStartSession = mongoose.startSession;
  Appraisal.findOne = () => makeQuery(() => appraisalDoc);
  AppraisalFeedback.insertMany = async (docs) => { insertedRows.push(...docs); return docs; };
  // Whoever is being backfilled must still show up as eligible.
  User.find = () => makeQuery(() => add.map((_id) => ({ _id })));
  mongoose.startSession = async () => stubSession();

  const user = { _id: managerId, tenant: tenantId, role: 'tenant_staff' };
  const { req, res, getStatus } = fakeReqRes({ user, appraisalId, body: { add: add.map(String) } });
  try {
    await appraisals.backfillPeers(req, res, (err) => { throw err; });
  } finally {
    Appraisal.findOne = originalFindOne;
    AppraisalFeedback.insertMany = originalInsertMany;
    User.find = originalUserFind;
    mongoose.startSession = originalStartSession;
  }
  return { status: getStatus(), saved: savedSnapshot, insertedRows };
}

test('approving creates one pending peer row per newly approved peer and advances to collecting', async () => {
  const { saved, insertedRows } = await approve({ approve: [peerA, peerB], reject: [peerC] });
  assert.strictEqual(saved.state, 'collecting');
  assert.strictEqual(insertedRows.length, 2);
  for (const row of insertedRows) {
    assert.strictEqual(row.kind, 'peer');
    assert.strictEqual(row.status, undefined, 'status defaults to pending in the schema');
    assert.ok(row.tenant && row.appraisal && row.cycle, 'every row is tenant- and cycle-scoped');
  }
  assert.strictEqual(saved.reviewerIds.length, 4, 'employee + manager + 2 approved peers');
});

test('a rejected nominee never enters reviewerIds', async () => {
  const { saved } = await approve({ approve: [peerA], reject: [peerC] });
  assert.ok(!saved.reviewerIds.map(String).includes(String(peerC)));
});

test('approving twice does not duplicate feedback rows', async () => {
  const { insertedRows } = await approveTwice({ approve: [peerA] });
  assert.strictEqual(insertedRows.length, 1, 'planPeerRowCreation skips anyone already in reviewerIds');
});

test('rejecting everyone is legal and lands in collecting with no peers', async () => {
  const { saved, insertedRows } = await approve({ approve: [], reject: [peerA, peerB] });
  assert.strictEqual(saved.state, 'collecting');
  assert.strictEqual(insertedRows.length, 0);
});

test('HR can skip peers from either nomination state', async () => {
  for (const from of ['nominating', 'pending_peer_approval']) {
    const saved = await skipPeers({ state: from });
    assert.strictEqual(saved.state, 'collecting', from);
  }
});

test('the subject cannot approve their own peers', async () => {
  const { status } = await approve({ asSubject: true });
  assert.strictEqual(status, 403);
});

test('re-adding a peer who declined creates no second row', async () => {
  // A declined peer is still in reviewerIds, so planPeerRowCreation skips them
  // and unique(appraisal, reviewer) is never challenged.
  const { insertedRows } = await backfill({ add: [peerWhoDeclined], alreadyReviewer: true });
  assert.strictEqual(insertedRows.length, 0);
});

test('backfill works at collecting and adds exactly one reviewer', async () => {
  const { saved, insertedRows } = await backfill({ add: [peerD] });
  assert.strictEqual(insertedRows.length, 1);
  assert.ok(saved.reviewerIds.map(String).includes(String(peerD)));
  assert.strictEqual(saved.state, 'collecting', 'backfill does not change state');
});

// Structural, not behavioural: our stub `withTransaction` is just
// `await fn()` — it has no real Mongo storage engine underneath it to roll
// back, so it cannot demonstrate that a failed save actually undoes a
// committed insertMany the way a real replica-set transaction would. What it
// CAN prove is the wiring that makes atomicity possible in the first place:
// (1) a save() failure must still surface as an error to the caller rather
// than being swallowed, and (2) insertMany and save must be enrolled in the
// exact same session object — if they weren't, no transaction (real or
// stubbed) could ever cover both writes.
test('a failing save enrolls insertMany and save in the same transaction session, and the error surfaces', async () => {
  const { thrown, saved, insertManySession, saveSession } = await approve({
    approve: [peerA, peerB],
    throwOnSave: true,
  });

  assert.ok(thrown, 'appraisal.save() failing must propagate as an error, not be swallowed');
  assert.strictEqual(saved, null, 'save() threw before ever producing a persisted snapshot');
  assert.ok(insertManySession, 'insertMany must run inside a session');
  assert.ok(saveSession, 'save must run inside a session');
  assert.strictEqual(
    insertManySession, saveSession,
    'insertMany and save must be enrolled in the same session for either both or neither to commit'
  );
});

// This is the regression test for the closure-mutation bug: session.
// withTransaction doesn't just retry the commit, it RE-RUNS the whole
// callback on a TransientTransactionError, and a JS closure survives that
// retry even though the aborted attempt's writes do not. If
// applyPeerDecisions mutates a document loaded once before the transaction
// (instead of re-reading fresh on every attempt), the retry sees the first
// attempt's leftover in-memory mutation, wrongly concludes the peer is
// already reflected, and skips insertMany on the attempt that actually
// commits — silently landing reviewerIds with a peer who has no
// AppraisalFeedback row to submit against.
test('a mid-transaction retry still creates exactly one feedback row per approved peer', async () => {
  const { persisted, durableFeedback, body } = await approveWithTransactionRetry({ approve: [peerA, peerB] });

  assert.strictEqual(
    durableFeedback.length, 2,
    'both approved peers must durably get an AppraisalFeedback row, not just the aborted first attempt'
  );
  const reviewerIds = persisted.reviewerIds.map(String);
  assert.ok(reviewerIds.includes(String(peerA)) && reviewerIds.includes(String(peerB)));
  assert.strictEqual(persisted.state, 'collecting');
  assert.strictEqual(body.data.peersAdded, 2, 'the response must reflect the attempt that actually committed');
  assert.strictEqual(body.data.state, 'collecting');
});
