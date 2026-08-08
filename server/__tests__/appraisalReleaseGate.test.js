// server/__tests__/appraisalReleaseGate.test.js
//
// Phase 2 Task 8: the release gate and the disclosure of n.
//
// Two halves, not one: releaseAppraisal refuses to release a summary built on
// too few submitted peer responses unless the manager explicitly confirms
// (peerReleaseGate, Task 3) — the manager is the one who can be warned.
// getAppraisal separately discloses approvedPeerCount/peerResponseCount to
// every viewer including the subject, because the employee being judged by
// the summary is the one party who otherwise cannot tell an appraisal built
// on one peer response from one built on four, and a warning the manager
// clicks through protects nobody but the manager.
//
// Idiom follows appraisalApprovePeers.test.js / appraisalDecline.test.js:
// stub the model statics with hand-written fakes and call the controller
// directly against a fake req/res. No supertest, no in-memory Mongo.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const appraisals = require('../controllers/appraisal.controller');

const oid = () => new mongoose.Types.ObjectId();

const tenantId = oid();
const subjectId = oid();
const managerId = oid();

/** A chainable stub for `.populate().lean()` that is also directly awaitable,
 * since releaseAppraisal awaits Appraisal.findOne() without .lean() — it
 * needs the real mutable "document" back so it can assign fields and call
 * .save() on it. Copied from appraisalApprovePeers.test.js. */
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

function peerNominations(approvedPeers) {
  const out = [];
  for (let i = 0; i < approvedPeers; i += 1) {
    out.push({ user: oid(), proposedBy: subjectId, status: 'approved' });
  }
  return out;
}

/**
 * Drives POST /:id/release as the manager. `approvedPeers` seeds that many
 * 'approved' peerNominations on the appraisal; `submittedPeers` is what
 * AppraisalFeedback.countDocuments is stubbed to report back (releaseAppraisal
 * has no already-loaded feedback array to count from, so it must issue this
 * query itself). `confirm` maps to the request body's confirmLowPeerCount.
 */
async function release({ approvedPeers = 0, submittedPeers = 0, confirm = false } = {}) {
  const appraisalId = oid();

  let savedSnapshot = null;
  const appraisalDoc = {
    _id: appraisalId,
    tenant: tenantId,
    employee: subjectId,
    manager: managerId,
    state: 'summarising',
    summary: 'A fair, considered summary of the period.',
    // Releasing also requires at least one agreed action now. Seeded here so
    // these tests keep exercising the PEER gate rather than tripping over a
    // different refusal on their way to it — the missing-commitments path has
    // its own coverage in appraisalCommitments.test.js.
    commitments: [{ text: 'Lead two tastings next quarter' }],
    peerNominations: peerNominations(approvedPeers),
    save: async function save() {
      savedSnapshot = { state: this.state };
      return this;
    },
  };

  const originalFindOne = Appraisal.findOne;
  const originalCount = AppraisalFeedback.countDocuments;
  let countFilter = null;
  Appraisal.findOne = () => makeQuery(() => appraisalDoc);
  AppraisalFeedback.countDocuments = async (filter) => {
    countFilter = filter;
    return submittedPeers;
  };

  const user = { _id: managerId, tenant: tenantId, role: 'tenant_staff' };
  const { req, res, getStatus, getBody } = fakeReqRes({
    user,
    appraisalId,
    body: { confirmLowPeerCount: confirm },
  });
  try {
    await appraisals.releaseAppraisal(req, res, (err) => { throw err; });
  } finally {
    Appraisal.findOne = originalFindOne;
    AppraisalFeedback.countDocuments = originalCount;
  }
  return { status: getStatus(), body: getBody(), saved: savedSnapshot, countFilter };
}

/**
 * Drives GET /:id as `role` ('subject' or 'manager'). Seeds `approvedPeers`
 * approved peerNominations on the appraisal and `submittedPeers` submitted
 * AppraisalFeedback rows of kind 'peer' (each with a populated reviewer, to
 * prove the anonymity stripping still holds alongside the new counts).
 */
async function getAppraisalAs(role, { approvedPeers = 0, submittedPeers = 0 } = {}) {
  const appraisalId = oid();
  const templateId = oid();

  const appraisalDoc = {
    _id: appraisalId,
    tenant: tenantId,
    employee: subjectId,
    manager: managerId,
    state: 'released',
    summary: 'A fair, considered summary of the period.',
    reviewerIds: [subjectId, managerId],
    peerNominations: peerNominations(approvedPeers),
    cycle: { name: 'H1 2026', feedbackDeadline: new Date(), status: 'active', template: templateId },
  };

  const rawFeedback = [];
  for (let i = 0; i < submittedPeers; i += 1) {
    rawFeedback.push({
      _id: oid(),
      tenant: tenantId,
      appraisal: appraisalId,
      kind: 'peer',
      status: 'submitted',
      reviewer: { _id: oid(), firstName: 'Peer', lastName: String(i), email: `peer${i}@example.com` },
      answers: [],
    });
  }

  const originalAppraisalFindOne = Appraisal.findOne;
  const originalTemplateFindOne = AppraisalTemplate.findOne;
  const originalFeedbackFind = AppraisalFeedback.find;
  Appraisal.findOne = () => makeQuery(() => appraisalDoc);
  AppraisalTemplate.findOne = () => makeQuery(() => ({ _id: templateId, tenant: tenantId, sections: [] }));
  AppraisalFeedback.find = () => makeQuery(() => rawFeedback);

  const user = role === 'subject'
    ? { _id: subjectId, tenant: tenantId, role: 'tenant_staff' }
    : { _id: managerId, tenant: tenantId, role: 'tenant_staff' };

  const { req, res, getBody } = fakeReqRes({ user, appraisalId, body: {} });
  try {
    await appraisals.getAppraisal(req, res, (err) => { throw err; });
  } finally {
    Appraisal.findOne = originalAppraisalFindOne;
    AppraisalTemplate.findOne = originalTemplateFindOne;
    AppraisalFeedback.find = originalFeedbackFind;
  }
  return getBody();
}

test('releasing on one peer response is refused with a machine-readable code', async () => {
  const { status, body } = await release({ approvedPeers: 3, submittedPeers: 1 });
  assert.strictEqual(status, 400);
  assert.strictEqual(body.code, 'LOW_PEER_RESPONSE_COUNT');
  assert.strictEqual(body.submittedPeerCount, 1);
  assert.strictEqual(body.threshold, 2);
});

test('confirming releases it', async () => {
  const { status, saved } = await release({ approvedPeers: 3, submittedPeers: 1, confirm: true });
  assert.strictEqual(status, 200);
  assert.strictEqual(saved.state, 'released');
});

test('a deliberate no-peer appraisal releases without a warning', async () => {
  const { status } = await release({ approvedPeers: 0, submittedPeers: 0 });
  assert.strictEqual(status, 200);
});

test('the released payload states how many peer responses it rests on', async () => {
  const body = await getAppraisalAs('subject', { approvedPeers: 3, submittedPeers: 2 });
  assert.strictEqual(body.data.peerResponseCount, 2);
  assert.strictEqual(body.data.approvedPeerCount, 3);
  // ...and still leaks nothing.
  assert.strictEqual(body.data.appraisal.reviewerIds, undefined);
  assert.strictEqual(body.data.appraisal.peerNominations, undefined);
  for (const fb of body.data.feedback) {
    if (fb.kind === 'peer') assert.strictEqual(fb.reviewer, undefined);
  }
});
