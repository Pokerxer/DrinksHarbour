// server/__tests__/appraisalNotObserved.test.js
//
// "I haven't seen enough to judge this."
//
// The problem being solved: every question in a template is `required: true`
// by default, and a peer who genuinely did not observe something still has to
// put SOMETHING in the box. What they put is the middle of the scale, because
// that feels least like an accusation. That inflates every mean toward 3 and
// makes a thin signal look like a measured one.
//
// So a peer may mark a question not-observed, and a not-observed answer is
// excluded from the denominator rather than scored. Two rules make it safe:
//
//   1. Peers only. Self and manager have the context; letting a manager skip
//      a question they are accountable for answering is a different feature
//      and not a good one.
//   2. A not-observed answer carries no rating. The server strips it rather
//      than trusting the client, so a stale draft rating left behind by the
//      UI can never be counted.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const AppraisalFeedback = require('../models/AppraisalFeedback');
const Appraisal = require('../models/Appraisal');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const feedback = require('../controllers/appraisalFeedback.controller');
const { buildComparison } = require('../services/appraisal.helpers');

const oid = () => new mongoose.Types.ObjectId();
const tenantId = oid();
const reviewerId = oid();

// ── buildComparison: not-observed leaves the denominator ────────────────────

test('a not-observed peer answer is excluded from the peer mean and from n', () => {
  const qid = oid();
  const sections = [
    { title: 'S', questions: [{ _id: qid, type: 'rating', label: 'Collaboration', scaleMax: 5, askOf: ['self', 'manager', 'peer'] }] },
  ];
  const rows = [
    { kind: 'peer', status: 'submitted', answers: [{ questionId: qid, rating: 4 }] },
    { kind: 'peer', status: 'submitted', answers: [{ questionId: qid, rating: 2 }] },
    // The whole point: this reviewer said "I can't judge this". Were it scored
    // as a 3 — the thing a forced answer produces — the mean would read 3.0.
    { kind: 'peer', status: 'submitted', answers: [{ questionId: qid, notObserved: true }] },
  ];

  const [row] = buildComparison(sections, rows, { canSeeReviewerNames: false });
  assert.strictEqual(row.peer.n, 2, 'not-observed must not count as a response');
  assert.strictEqual(row.peer.mean, 3, '(4+2)/2, NOT (4+2+3)/3');
});

test('a not-observed answer that still carries a rating is not scored', () => {
  const qid = oid();
  const sections = [
    { title: 'S', questions: [{ _id: qid, type: 'rating', label: 'Q', scaleMax: 5, askOf: ['peer'] }] },
  ];
  // Defence in depth against a UI that leaves a previously-picked rating on the
  // answer when the reviewer switches to not-observed.
  const rows = [
    { kind: 'peer', status: 'submitted', answers: [{ questionId: qid, rating: 5, notObserved: true }] },
    { kind: 'peer', status: 'submitted', answers: [{ questionId: qid, rating: 1 }] },
  ];

  const [row] = buildComparison(sections, rows, { canSeeReviewerNames: false });
  assert.strictEqual(row.peer.n, 1);
});

test('a question every peer marked not-observed reports n=0, not a mean of zero', () => {
  const qid = oid();
  const sections = [
    { title: 'S', questions: [{ _id: qid, type: 'rating', label: 'Q', scaleMax: 5, askOf: ['peer'] }] },
  ];
  const rows = [
    { kind: 'peer', status: 'submitted', answers: [{ questionId: qid, notObserved: true }] },
    { kind: 'peer', status: 'submitted', answers: [{ questionId: qid, notObserved: true }] },
  ];

  const [row] = buildComparison(sections, rows, { canSeeReviewerNames: false });
  assert.strictEqual(row.peer.n, 0);
  assert.strictEqual(row.peer.mean, null, 'nobody scored it, so there is no mean');
});

// ── submitFeedback: who may mark not-observed, and what gets stored ─────────

const REQUIRED_Q = oid();
const OPTIONAL_Q = oid();

function stubTemplate(t) {
  const sections = [
    {
      title: 'S',
      questions: [
        { _id: REQUIRED_Q, type: 'rating', label: 'Required one', scaleMax: 5, required: true, askOf: ['self', 'manager', 'peer'] },
        { _id: OPTIONAL_Q, type: 'text', label: 'Optional one', required: false, askOf: ['self', 'manager', 'peer'] },
      ],
    },
  ];
  const cycleFindOne = AppraisalCycle.findOne;
  const templateFindOne = AppraisalTemplate.findOne;
  // Since Phase 5 the sections are also filtered by the appraisal's snapshot
  // department, so the write paths read the appraisal too. No department here:
  // these questions are company-wide, which is what an empty `departments`
  // means and what every pre-Phase-5 template has.
  const appraisalFindOne = Appraisal.findOne;
  AppraisalCycle.findOne = () => ({ lean: async () => ({ _id: oid(), template: oid() }) });
  AppraisalTemplate.findOne = () => ({ lean: async () => ({ _id: oid(), sections }) });
  Appraisal.findOne = () => ({ select: () => ({ lean: async () => ({ _id: oid(), department: null }) }) });
  t.after(() => {
    AppraisalCycle.findOne = cycleFindOne;
    AppraisalTemplate.findOne = templateFindOne;
    Appraisal.findOne = appraisalFindOne;
  });
}

async function submit(t, { kind, answers }) {
  const fbId = oid();
  let saved = null;
  const fbDoc = {
    _id: fbId, tenant: tenantId, reviewer: reviewerId, cycle: oid(), appraisal: oid(),
    kind, status: 'pending',
    save: async function () { saved = { answers: this.answers, status: this.status }; return this; },
  };
  const findOne = AppraisalFeedback.findOne;
  AppraisalFeedback.findOne = async () => fbDoc;
  t.after(() => { AppraisalFeedback.findOne = findOne; });

  let statusCode = 200; let body;
  const res = { status(c) { statusCode = c; return res; }, json(p) { body = p; return res; } };
  await feedback.submitFeedback(
    { tenant: { _id: tenantId }, user: { _id: reviewerId }, params: { id: String(fbId) }, body: { answers } },
    res,
    (err) => { throw err; }
  );
  return { statusCode, body, saved };
}

test('a peer may mark a required question not-observed and submit', async (t) => {
  stubTemplate(t);
  const { statusCode, saved } = await submit(t, {
    kind: 'peer',
    answers: [{ questionId: REQUIRED_Q, notObserved: true }],
  });
  assert.strictEqual(statusCode, 200);
  assert.strictEqual(saved.status, 'submitted');
  assert.strictEqual(saved.answers[0].notObserved, true);
});

test('a not-observed answer is stored with its rating stripped', async (t) => {
  stubTemplate(t);
  const { saved } = await submit(t, {
    kind: 'peer',
    answers: [{ questionId: REQUIRED_Q, rating: 5, notObserved: true }],
  });
  // Trusting the client here would let a stale draft rating survive into the
  // stored row, where buildComparison's own guard is the only thing standing
  // between it and the mean.
  assert.strictEqual(saved.answers[0].rating, undefined);
  assert.strictEqual(saved.answers[0].notObserved, true);
});

test('self and manager may NOT mark a question not-observed', async (t) => {
  for (const kind of ['self', 'manager']) {
    stubTemplate(t);
    const { statusCode, saved } = await submit(t, {
      kind,
      answers: [{ questionId: REQUIRED_Q, notObserved: true }],
    });
    assert.strictEqual(statusCode, 400, kind);
    assert.strictEqual(saved, null, `${kind} must not persist`);
  }
});

test('a required question left blank is rejected', async (t) => {
  stubTemplate(t);
  const { statusCode, saved } = await submit(t, {
    kind: 'self',
    answers: [{ questionId: OPTIONAL_Q, text: 'only answered the optional one' }],
  });
  assert.strictEqual(statusCode, 400);
  assert.strictEqual(saved, null);
});

test('an optional question left blank is fine', async (t) => {
  stubTemplate(t);
  const { statusCode } = await submit(t, {
    kind: 'self',
    answers: [{ questionId: REQUIRED_Q, rating: 4 }],
  });
  assert.strictEqual(statusCode, 200);
});

test('a rating of 0 counts as answered — it is a real score, not a blank', async (t) => {
  stubTemplate(t);
  const { statusCode } = await submit(t, {
    kind: 'manager',
    answers: [{ questionId: REQUIRED_Q, rating: 0 }],
  });
  assert.strictEqual(statusCode, 200);
});

test('whitespace-only text does not satisfy a required question', async (t) => {
  stubTemplate(t);
  const { statusCode } = await submit(t, {
    kind: 'self',
    answers: [{ questionId: REQUIRED_Q, text: '   ' }],
  });
  assert.strictEqual(statusCode, 400);
});
