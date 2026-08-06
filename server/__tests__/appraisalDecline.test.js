// server/__tests__/appraisalDecline.test.js
//
// Phase 2 Task 7: a nominated peer declining their feedback request.
//
// The central guarantee under test: only 'peer' kind rows are declinable —
// self and manager assessments are not optional, so declineFeedback 400s them
// regardless of status — and a declined row is distinguishable from an
// 'expired' one via status + declinedAt + declineReason, so a manager can
// tell "refused" from "went quiet" and backfill a replacement in time.
//
// Idiom follows appraisalApprovePeers.test.js / appraisalNominate.test.js:
// stub the model statics with hand-written fakes and call the controller
// directly against a fake req/res. No supertest, no in-memory Mongo.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const AppraisalFeedback = require('../models/AppraisalFeedback');
const feedback = require('../controllers/appraisalFeedback.controller');

const oid = () => new mongoose.Types.ObjectId();

const tenantId = oid();
const reviewerId = oid();

function fakeReqRes({ id, body = {} }) {
  let jsonBody;
  let statusCode = 200;
  const res = {
    status(code) { statusCode = code; return res; },
    json(payload) { jsonBody = payload; return res; },
  };
  const req = {
    tenant: { _id: tenantId },
    user: { _id: reviewerId, tenant: tenantId, role: 'tenant_staff' },
    params: { id: String(id) },
    body,
  };
  return { req, res, getStatus: () => statusCode, getBody: () => jsonBody };
}

/**
 * Drives POST /:id/decline as the reviewer who owns the row (unless
 * `notOwner` is set, which models loadOwnFeedback's ownership filter finding
 * nothing — reviewer/tenant mismatch reads identically to "row doesn't
 * exist", by design).
 *
 * On success the return value IS the persisted snapshot (status, declinedAt,
 * declineReason) with the HTTP `status` code overwritten by that same spread
 * — deliberately, since a successful decline's HTTP status is always 200 and
 * every success-path test in the brief asserts against the row's `status`
 * field ('declined'), never the HTTP code. Failure-path tests destructure
 * `{ status }` for the HTTP code instead, which is exactly what's left when
 * there is no saved snapshot to spread over it.
 */
async function decline({ kind, status, body = {}, notOwner = false, expectFail = false } = {}) {
  const fbId = oid();
  let savedSnapshot = null;
  const fbDoc = notOwner ? null : {
    _id: fbId,
    tenant: tenantId,
    reviewer: reviewerId,
    kind,
    status,
    save: async function save() {
      savedSnapshot = {
        status: this.status,
        declinedAt: this.declinedAt,
        declineReason: this.declineReason,
      };
      return this;
    },
  };

  const originalFindOne = AppraisalFeedback.findOne;
  // loadOwnFeedback awaits AppraisalFeedback.findOne(...) directly (no
  // .lean() chaining), so the stub only needs to be awaitable.
  AppraisalFeedback.findOne = async () => fbDoc;

  const { req, res, getStatus } = fakeReqRes({ id: fbId, body });
  try {
    await feedback.declineFeedback(req, res, (err) => { throw err; });
  } finally {
    AppraisalFeedback.findOne = originalFindOne;
  }

  const httpStatus = getStatus();
  if (expectFail) assert.strictEqual(savedSnapshot, null, 'a rejected request must not call .save()');
  return savedSnapshot
    ? { status: httpStatus, saved: savedSnapshot, ...savedSnapshot }
    : { status: httpStatus, saved: null };
}

test('a peer can decline, and the row is distinguishable from an expired one', async () => {
  const saved = await decline({ kind: 'peer', status: 'pending', body: { reason: 'Barely worked with them' } });
  assert.strictEqual(saved.status, 'declined');
  assert.ok(saved.declinedAt instanceof Date);
  assert.strictEqual(saved.declineReason, 'Barely worked with them');
});

test('declining without a reason is allowed', async () => {
  const saved = await decline({ kind: 'peer', status: 'pending', body: {} });
  assert.strictEqual(saved.status, 'declined');
  assert.strictEqual(saved.declineReason, undefined);
});

test('self and manager assessments cannot be declined', async () => {
  for (const kind of ['self', 'manager']) {
    const { status } = await decline({ kind, status: 'pending', expectFail: true });
    assert.strictEqual(status, 400, kind);
  }
});

test('an already-submitted row cannot be declined', async () => {
  const { status } = await decline({ kind: 'peer', status: 'submitted', expectFail: true });
  assert.strictEqual(status, 400);
});

test('a row belonging to someone else is not found', async () => {
  const { status } = await decline({ notOwner: true, expectFail: true });
  assert.strictEqual(status, 404);
});
