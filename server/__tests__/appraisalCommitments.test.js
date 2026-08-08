// server/__tests__/appraisalCommitments.test.js
//
// Ending on a commitment rather than an acknowledgement.
//
// An appraisal that closes with a rating and a signature changes nothing: the
// document is filed and the next cycle starts from scratch. So releasing now
// requires at least one agreed action for the next period, and the next
// cycle's self/manager forms open with whatever was agreed last time. The two
// halves are the point — a commitment nobody is shown again is just a longer
// summary.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const appraisals = require('../controllers/appraisal.controller');
const feedback = require('../controllers/appraisalFeedback.controller');
const {
  normaliseCommitments,
  MAX_COMMITMENTS,
} = require('../services/appraisal.helpers');

const oid = () => new mongoose.Types.ObjectId();
const tenantId = oid();
const subjectId = oid();
const managerId = oid();

// ── normaliseCommitments ────────────────────────────────────────────────────

test('an absent key is distinguished from an empty list', () => {
  // saveSummary autosaves partial work. A payload that omits the key must not
  // wipe commitments already stored; only an explicit [] clears them.
  assert.strictEqual(normaliseCommitments(undefined).commitments, null);
  assert.strictEqual(normaliseCommitments(null).commitments, null);
  assert.deepStrictEqual(normaliseCommitments([]).commitments, []);
});

test('blank and whitespace-only entries are dropped, not rejected', () => {
  const { commitments, errors } = normaliseCommitments([
    { text: 'Lead two tastings' },
    { text: '   ' },
    { text: '' },
  ]);
  assert.deepStrictEqual(commitments, [{ text: 'Lead two tastings' }]);
  assert.deepStrictEqual(errors, [], 'an empty row in the editor is ordinary, not an error');
});

test('plain strings and {text} objects are both accepted, and trimmed', () => {
  const { commitments } = normaliseCommitments(['  Close POs in 48h  ', { text: ' Run stock counts ' }]);
  assert.deepStrictEqual(commitments, [{ text: 'Close POs in 48h' }, { text: 'Run stock counts' }]);
});

test('more than the cap is refused', () => {
  const many = Array.from({ length: MAX_COMMITMENTS + 1 }, (_, i) => ({ text: `Action ${i}` }));
  const { errors } = normaliseCommitments(many);
  assert.strictEqual(errors.length, 1);
});

test('a non-list is refused rather than coerced', () => {
  const { errors } = normaliseCommitments('Lead two tastings');
  assert.strictEqual(errors.length, 1);
});

// ── releaseAppraisal ────────────────────────────────────────────────────────

function makeQuery(resolveFn) {
  const q = {
    populate() { return q; },
    select() { return q; },
    sort() { return q; },
    lean: async () => resolveFn(),
    then(resolve, reject) { Promise.resolve(resolveFn()).then(resolve, reject); },
  };
  return q;
}

async function release({ stored = [], body = {} } = {}) {
  const appraisalId = oid();
  let saved = null;
  const doc = {
    _id: appraisalId, tenant: tenantId, employee: subjectId, manager: managerId,
    state: 'summarising', summary: 'A considered summary.', peerNominations: [],
    commitments: stored,
    save: async function () { saved = { state: this.state, commitments: this.commitments }; return this; },
  };

  const findOne = Appraisal.findOne;
  const count = AppraisalFeedback.countDocuments;
  Appraisal.findOne = () => makeQuery(() => doc);
  AppraisalFeedback.countDocuments = async () => 0;

  let statusCode = 200; let jsonBody;
  const res = { status(c) { statusCode = c; return res; }, json(p) { jsonBody = p; return res; } };
  try {
    await appraisals.releaseAppraisal(
      { tenant: { _id: tenantId }, user: { _id: managerId, tenant: tenantId, role: 'tenant_staff' },
        params: { id: String(appraisalId) }, body },
      res, (err) => { throw err; }
    );
  } finally {
    Appraisal.findOne = findOne;
    AppraisalFeedback.countDocuments = count;
  }
  return { status: statusCode, body: jsonBody, saved };
}

test('releasing with no agreed action is refused', async () => {
  const { status, body, saved } = await release();
  assert.strictEqual(status, 400);
  assert.strictEqual(body.code, 'NO_COMMITMENTS_AGREED');
  assert.strictEqual(saved, null, 'a refused release must not transition the appraisal');
});

test('releasing with a list of only blanks is refused', async () => {
  const { status, body } = await release({ body: { commitments: [{ text: '  ' }, { text: '' }] } });
  assert.strictEqual(status, 400);
  assert.strictEqual(body.code, 'NO_COMMITMENTS_AGREED');
});

test('releasing with one agreed action succeeds and persists it trimmed', async () => {
  const { status, saved } = await release({
    body: { commitments: [{ text: '  Lead two tastings this quarter  ' }] },
  });
  assert.strictEqual(status, 200);
  assert.strictEqual(saved.state, 'released');
  assert.deepStrictEqual(saved.commitments, [{ text: 'Lead two tastings this quarter' }]);
});

test('commitments drafted earlier via saveSummary carry the release', async () => {
  // The manager wrote them alongside the summary; the release call does not
  // resend them and must not therefore be blocked.
  const { status, saved } = await release({ stored: [{ text: 'Close POs within 48h' }], body: {} });
  assert.strictEqual(status, 200);
  assert.deepStrictEqual(saved.commitments, [{ text: 'Close POs within 48h' }]);
});

test('an explicit empty list at release overrides stored commitments and blocks', async () => {
  const { status, body } = await release({
    stored: [{ text: 'Close POs within 48h' }],
    body: { commitments: [] },
  });
  assert.strictEqual(status, 400);
  assert.strictEqual(body.code, 'NO_COMMITMENTS_AGREED');
});

test('the missing-commitments refusal precedes the confirmable peer warning', async () => {
  // Both would refuse this release. The manager must be told the blocking
  // problem — their own unfinished work — rather than being invited to
  // confirm past a warning and then be refused anyway.
  const findOne = Appraisal.findOne;
  const count = AppraisalFeedback.countDocuments;
  const appraisalId = oid();
  const doc = {
    _id: appraisalId, tenant: tenantId, employee: subjectId, manager: managerId,
    state: 'summarising', summary: 'A considered summary.',
    peerNominations: [{ user: oid(), proposedBy: subjectId, status: 'approved' }],
    commitments: [],
    save: async function () { return this; },
  };
  Appraisal.findOne = () => makeQuery(() => doc);
  AppraisalFeedback.countDocuments = async () => 0; // zero submitted → peer gate would also block

  let statusCode = 200; let jsonBody;
  const res = { status(c) { statusCode = c; return res; }, json(p) { jsonBody = p; return res; } };
  try {
    await appraisals.releaseAppraisal(
      { tenant: { _id: tenantId }, user: { _id: managerId, tenant: tenantId, role: 'tenant_staff' },
        params: { id: String(appraisalId) }, body: {} },
      res, (err) => { throw err; }
    );
  } finally {
    Appraisal.findOne = findOne;
    AppraisalFeedback.countDocuments = count;
  }
  assert.strictEqual(statusCode, 400);
  assert.strictEqual(jsonBody.code, 'NO_COMMITMENTS_AGREED');
});

// ── the other half: last cycle's commitments open the next one ──────────────

async function getFeedbackWithPrior({ kind, priorDoc }) {
  const fbId = oid();
  const fbDoc = { _id: fbId, tenant: tenantId, reviewer: subjectId, cycle: oid(), appraisal: oid(), kind, status: 'pending', answers: [] };

  const fbFindOne = AppraisalFeedback.findOne;
  const apFindOne = Appraisal.findOne;
  const cyFindOne = AppraisalCycle.findOne;
  const tpFindOne = AppraisalTemplate.findOne;

  AppraisalFeedback.findOne = async () => fbDoc;
  let priorQueryFilter = null;
  AppraisalFeedback.findOne = async () => fbDoc;
  Appraisal.findOne = (filter) => {
    // First call resolves the current appraisal; the prior-commitments lookup
    // is the one carrying a `state` filter.
    if (filter && filter.state) {
      priorQueryFilter = filter;
      return makeQuery(() => priorDoc);
    }
    return makeQuery(() => ({ _id: oid(), tenant: tenantId, employee: { _id: subjectId, firstName: 'Sam' } }));
  };
  AppraisalCycle.findOne = () => ({ lean: async () => ({ _id: oid(), name: 'H2 2026', template: oid() }) });
  AppraisalTemplate.findOne = () => ({ lean: async () => ({ _id: oid(), sections: [] }) });

  let jsonBody;
  const res = { status() { return res; }, json(p) { jsonBody = p; return res; } };
  try {
    await feedback.getFeedback(
      { tenant: { _id: tenantId }, user: { _id: subjectId }, params: { id: String(fbId) } },
      res, (err) => { throw err; }
    );
  } finally {
    AppraisalFeedback.findOne = fbFindOne;
    Appraisal.findOne = apFindOne;
    AppraisalCycle.findOne = cyFindOne;
    AppraisalTemplate.findOne = tpFindOne;
  }
  return { body: jsonBody, priorQueryFilter };
}

const PRIOR = {
  commitments: [{ text: 'Lead two tastings' }, { text: 'Close POs within 48h' }],
  releasedAt: new Date('2026-01-15'),
  cycle: { name: 'H1 2026' },
};

test('a self form opens with what was agreed last cycle', async () => {
  const { body } = await getFeedbackWithPrior({ kind: 'self', priorDoc: PRIOR });
  assert.deepStrictEqual(body.data.priorCommitments.commitments, PRIOR.commitments);
  assert.strictEqual(body.data.priorCommitments.cycleName, 'H1 2026');
});

test('a manager form sees them too — they assess against what was agreed', async () => {
  const { body } = await getFeedbackWithPrior({ kind: 'manager', priorDoc: PRIOR });
  assert.strictEqual(body.data.priorCommitments.commitments.length, 2);
});

test('a PEER form never sees them', async () => {
  // What a colleague privately agreed with their manager is not peer business.
  const { body } = await getFeedbackWithPrior({ kind: 'peer', priorDoc: PRIOR });
  assert.strictEqual(body.data.priorCommitments, null);
});

test('the prior lookup excludes the cycle being reviewed', async () => {
  const { priorQueryFilter } = await getFeedbackWithPrior({ kind: 'self', priorDoc: PRIOR });
  assert.ok(priorQueryFilter.cycle?.$ne, 'must exclude the current cycle, or it quotes itself back');
  assert.deepStrictEqual(priorQueryFilter.state, { $in: ['released', 'acknowledged'] });
});

test('a first-ever appraisal simply has no prior commitments', async () => {
  const { body } = await getFeedbackWithPrior({ kind: 'self', priorDoc: null });
  assert.strictEqual(body.data.priorCommitments, null);
});

test('a peer reviewer is told their feedback is WITHHELD from the employee, not merely anonymised', async () => {
  // The disclosure banner is what a reviewer calibrates candour against, so
  // it has to describe what actually happens now: the subject never sees the
  // row at all. Understating this as "anonymous" buys vagueness.
  const { body } = await getFeedbackWithPrior({ kind: 'peer', priorDoc: null });
  assert.deepStrictEqual(body.data.visibility.withheldFrom, ['employee']);
  assert.deepStrictEqual(body.data.visibility.anonymousTo, []);
  assert.deepStrictEqual(body.data.visibility.namedTo, ['manager', 'hr']);
});
