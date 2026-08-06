const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { buildComparison, PEER_RELEASE_MIN } = require('../services/appraisal.helpers');

// Plain string ids, matching appraisal.helpers.test.js's idiom.
const sections = [
  {
    title: 'Performance',
    questions: [
      { _id: 'q1', type: 'rating', label: 'Quality of work', scaleMax: 5, askOf: ['self', 'manager', 'peer'] },
      { _id: 'q2', type: 'rating', label: 'Communication', scaleMax: 5, askOf: ['self', 'manager', 'peer'] },
      { _id: 'q3', type: 'text', label: 'What went well?', askOf: ['self', 'manager', 'peer'] },
    ],
  },
];

const row = (kind, answers, extra = {}) => ({
  kind, status: 'submitted', answers, ...extra,
});

const HR = { canSeeReviewerNames: true };
const SUBJECT = { canSeeReviewerNames: false };

test('buildComparison pairs self, manager and peer on the SAME questionId', () => {
  const feedback = [
    row('self', [{ questionId: 'q1', rating: 5 }]),
    row('manager', [{ questionId: 'q1', rating: 3 }]),
    row('peer', [{ questionId: 'q1', rating: 4 }]),
    row('peer', [{ questionId: 'q1', rating: 3 }]),
  ];
  const [q1] = buildComparison(sections, feedback, SUBJECT);

  assert.strictEqual(q1.sectionTitle, 'Performance');
  assert.strictEqual(q1.label, 'Quality of work');
  assert.strictEqual(q1.scaleMax, 5);
  assert.strictEqual(q1.self, 5);
  assert.strictEqual(q1.manager, 3);
  assert.deepStrictEqual(q1.peer, { mean: 3.5, n: 2, suppressed: false });
});

test('buildComparison SUPPRESSES the peer mean below PEER_RELEASE_MIN', () => {
  const feedback = [
    row('self', [{ questionId: 'q1', rating: 4 }]),
    row('peer', [{ questionId: 'q1', rating: 2 }]),
  ];
  const [q1] = buildComparison(sections, feedback, SUBJECT);

  // A lone response dressed up as an average is the one case where the
  // statistic is purely misleading — and it is also the case where the number
  // IS one identifiable person's score.
  assert.deepStrictEqual(q1.peer, { mean: null, n: 1, suppressed: true });
  assert.strictEqual(PEER_RELEASE_MIN, 2, 'the threshold is shared, not a second constant');
  // The suppressed rating must not survive anywhere else in the row.
  assert.ok(!JSON.stringify(q1).includes(':2'), 'no back door to the lone rating');
});

test('the peer mean IS released at exactly PEER_RELEASE_MIN', () => {
  const answers = [{ questionId: 'q1', rating: 2 }];
  const atThreshold = Array.from({ length: PEER_RELEASE_MIN }, () => row('peer', answers));
  const [q1] = buildComparison(sections, atThreshold, SUBJECT);

  assert.strictEqual(q1.peer.suppressed, false);
  assert.strictEqual(q1.peer.n, PEER_RELEASE_MIN);
  assert.strictEqual(q1.peer.mean, 2);
});

test('suppression is PER QUESTION, not per appraisal', () => {
  const feedback = [
    row('peer', [{ questionId: 'q1', rating: 4 }, { questionId: 'q2', rating: 3 }]),
    // This peer answered q1 but skipped q2.
    row('peer', [{ questionId: 'q1', rating: 2 }]),
  ];
  const [q1, q2] = buildComparison(sections, feedback, SUBJECT);

  assert.deepStrictEqual(q1.peer, { mean: 3, n: 2, suppressed: false });
  assert.deepStrictEqual(q2.peer, { mean: null, n: 1, suppressed: true });
});

test('a SKIPPED answer is absent from n, never counted as zero', () => {
  const feedback = [
    row('peer', [{ questionId: 'q1', rating: 4 }, { questionId: 'q2', rating: 4 }]),
    row('peer', [{ questionId: 'q1', rating: 4 }, { questionId: 'q2', rating: 4 }]),
    // Answered q1, skipped q2 entirely.
    row('peer', [{ questionId: 'q1', rating: 4 }]),
    // Present but with no numeric rating — a skipped optional question.
    row('peer', [{ questionId: 'q1', rating: 4 }, { questionId: 'q2', rating: null }]),
    row('peer', [{ questionId: 'q1', rating: 4 }, { questionId: 'q2' }]),
  ];
  const [q1, q2] = buildComparison(sections, feedback, HR);

  assert.deepStrictEqual(q1.peer, { mean: 4, n: 5, suppressed: false });
  // If skips were scored 0 this would be n:5 and mean 1.6.
  assert.deepStrictEqual(q2.peer, { mean: 4, n: 2, suppressed: false });
  // The self/manager buckets follow the same rule.
  const [s1] = buildComparison(sections, [row('self', [{ questionId: 'q1', rating: null }])], HR);
  assert.strictEqual(s1.self, null);
});

test('a rating of 0 is a real answer and IS counted', () => {
  const feedback = [
    row('peer', [{ questionId: 'q1', rating: 0 }]),
    row('peer', [{ questionId: 'q1', rating: 4 }]),
    row('self', [{ questionId: 'q1', rating: 0 }]),
  ];
  const [q1] = buildComparison(sections, feedback, HR);

  assert.strictEqual(q1.self, 0);
  assert.deepStrictEqual(q1.peer, { mean: 2, n: 2, suppressed: false });
});

test('buildComparison excludes text questions', () => {
  const feedback = [row('self', [{ questionId: 'q3', text: 'prose' }])];
  const rows = buildComparison(sections, feedback, SUBJECT);

  assert.deepStrictEqual(rows.map((r) => r.questionId), ['q1', 'q2']);
});

test('peerBreakdown is NULL for a viewer who may not see reviewer names', () => {
  const feedback = [
    row('peer', [{ questionId: 'q1', rating: 4 }], { reviewer: { _id: 'u-p1', firstName: 'Ada' } }),
    row('peer', [{ questionId: 'q1', rating: 2 }], { reviewer: { _id: 'u-p2', firstName: 'Kofi' } }),
  ];
  const [q1] = buildComparison(sections, feedback, SUBJECT);

  assert.strictEqual(q1.peerBreakdown, null);
  // And no name reaches the payload by any other route.
  assert.ok(!JSON.stringify(q1).includes('Ada'));
  assert.ok(!JSON.stringify(q1).includes('Kofi'));
  assert.ok(!JSON.stringify(q1).includes('u-p1'));
});

test('an absent access argument is treated as the least-privileged viewer', () => {
  const feedback = [
    row('peer', [{ questionId: 'q1', rating: 4 }], { reviewer: { _id: 'u-p1', firstName: 'Ada' } }),
    row('peer', [{ questionId: 'q1', rating: 2 }], { reviewer: { _id: 'u-p2', firstName: 'Kofi' } }),
  ];
  for (const access of [undefined, null, {}, { canSeeReviewerNames: 'yes-please' }]) {
    const [q1] = buildComparison(sections, feedback, access);
    assert.strictEqual(q1.peerBreakdown, null, `access=${JSON.stringify(access)}`);
    assert.ok(!JSON.stringify(q1).includes('Ada'));
  }
});

test('peerBreakdown IS populated for manager/HR', () => {
  const feedback = [
    row('peer', [{ questionId: 'q1', rating: 4 }], { reviewer: { _id: 'u-p1', firstName: 'Ada' } }),
    row('peer', [{ questionId: 'q1', rating: 2 }], { reviewer: { _id: 'u-p2', firstName: 'Kofi' } }),
  ];
  const [q1] = buildComparison(sections, feedback, HR);

  assert.strictEqual(q1.peerBreakdown.length, 2);
  assert.strictEqual(q1.peerBreakdown[0].rating, 4);
  assert.strictEqual(q1.peerBreakdown[0].reviewer.firstName, 'Ada');
});

test('a peer row already stripped of its reviewer cannot produce a breakdown', () => {
  // This is the structural half of the guarantee: buildComparison runs on the
  // ALREADY-PROJECTED feedback array, so for a subject viewer the reviewer
  // field is not merely gated off — it is not in the input.
  const feedback = [
    row('peer', [{ questionId: 'q1', rating: 4 }]), // no `reviewer` key at all
    row('peer', [{ questionId: 'q1', rating: 2 }]),
  ];
  const [q1] = buildComparison(sections, feedback, HR);

  assert.deepStrictEqual(q1.peerBreakdown, []);
  assert.deepStrictEqual(q1.peer, { mean: 3, n: 2, suppressed: false });
});

test('a subject-projected array yields the same numbers and no identity', () => {
  // Exactly what projectFeedbackForViewer hands a subject viewer: peer rows
  // with `reviewer` deleted and non-submitted rows with `answers` deleted.
  const projected = [
    { kind: 'self', status: 'submitted', answers: [{ questionId: 'q1', rating: 5 }] },
    { kind: 'peer', status: 'submitted', answers: [{ questionId: 'q1', rating: 4 }] },
    { kind: 'peer', status: 'submitted', answers: [{ questionId: 'q1', rating: 3 }] },
    { kind: 'peer', status: 'pending' }, // answers stripped by the projection
  ];
  const [q1] = buildComparison(sections, projected, SUBJECT);

  assert.strictEqual(q1.self, 5);
  assert.deepStrictEqual(q1.peer, { mean: 3.5, n: 2, suppressed: false });
  assert.strictEqual(q1.peerBreakdown, null);
  assert.ok(!JSON.stringify(q1).includes('reviewer'));
});

test('buildComparison ignores rows that are not submitted', () => {
  const feedback = [
    row('self', [{ questionId: 'q1', rating: 5 }]),
    { kind: 'peer', status: 'declined', answers: [{ questionId: 'q1', rating: 1 }] },
    { kind: 'peer', status: 'pending', answers: [{ questionId: 'q1', rating: 1 }] },
    { kind: 'peer', status: 'expired', answers: [{ questionId: 'q1', rating: 1 }] },
  ];
  const [q1] = buildComparison(sections, feedback, HR);

  assert.strictEqual(q1.self, 5);
  assert.deepStrictEqual(q1.peer, { mean: null, n: 0, suppressed: true });
  assert.deepStrictEqual(q1.peerBreakdown, []);
});

test('a non-submitted self or manager row does not supply a score', () => {
  const feedback = [
    { kind: 'self', status: 'pending', answers: [{ questionId: 'q1', rating: 5 }] },
    { kind: 'manager', status: 'declined', answers: [{ questionId: 'q1', rating: 1 }] },
  ];
  const [q1] = buildComparison(sections, feedback, HR);

  assert.strictEqual(q1.self, null);
  assert.strictEqual(q1.manager, null);
});

test('a question nobody answered renders as nulls, not as absent', () => {
  const [q1] = buildComparison(sections, [], SUBJECT);

  assert.strictEqual(q1.self, null);
  assert.strictEqual(q1.manager, null);
  assert.deepStrictEqual(q1.peer, { mean: null, n: 0, suppressed: true });
});

test('an answer whose questionId matches no question is dropped', () => {
  const feedback = [row('self', [{ questionId: 'q-gone', rating: 5 }])];
  const rows = buildComparison(sections, feedback, SUBJECT);

  // Never rendered under a fabricated label. With version pinning this should
  // now be unreachable; the guard stays because "unreachable" is a claim about
  // today's code.
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].self, null);
});

test('buildComparison tolerates null input', () => {
  assert.deepStrictEqual(buildComparison(null, null, null), []);
  assert.deepStrictEqual(buildComparison(sections, null, null).length, 2);
  assert.deepStrictEqual(buildComparison([], [], null), []);
  assert.deepStrictEqual(buildComparison([null, { title: 'x' }], [null, undefined], HR), []);
  // Every numeric field is a number or null — never NaN.
  const [q1] = buildComparison(sections, [row('peer', null)], HR);
  assert.strictEqual(q1.peer.mean, null);
  assert.strictEqual(Number.isNaN(q1.peer.mean), false);
});

test('means round to one decimal place', () => {
  const feedback = [
    row('peer', [{ questionId: 'q1', rating: 5 }]),
    row('peer', [{ questionId: 'q1', rating: 4 }]),
    row('peer', [{ questionId: 'q1', rating: 4 }]),
  ];
  const [q1] = buildComparison(sections, feedback, SUBJECT);
  assert.strictEqual(q1.peer.mean, 4.3);
});

test('a question asked of only one kind still gets a row, carrying its askOf', () => {
  const oneKind = [
    {
      title: 'Manager only',
      questions: [
        { _id: 'm1', type: 'rating', label: 'Readiness for promotion', scaleMax: 5, askOf: ['manager'] },
        { _id: 's1', type: 'rating', label: 'Self-assessed workload', scaleMax: 5, askOf: ['self'] },
      ],
    },
  ];
  const feedback = [row('manager', [{ questionId: 'm1', rating: 4 }])];
  const [m1, s1] = buildComparison(oneKind, feedback, HR);

  // The row is kept rather than omitted: a manager-only question is still part
  // of the appraisal, and the UI needs askOf to render "not asked" instead of
  // an empty bar that reads as "nobody responded".
  assert.deepStrictEqual(m1.askOf, ['manager']);
  assert.strictEqual(m1.manager, 4);
  assert.strictEqual(m1.self, null);
  assert.deepStrictEqual(m1.peer, { mean: null, n: 0, suppressed: true });
  assert.deepStrictEqual(s1.askOf, ['self']);
  assert.strictEqual(s1.self, null);
  // askOf is a copy — mutating the row must not corrupt the template.
  m1.askOf.push('peer');
  assert.deepStrictEqual(oneKind[0].questions[0].askOf, ['manager']);
});

test('questions with different scaleMax are never pooled', () => {
  const mixed = [
    {
      title: 'Mixed scales',
      questions: [
        { _id: 'a', type: 'rating', label: 'Out of five', scaleMax: 5, askOf: ['peer'] },
        { _id: 'b', type: 'rating', label: 'Out of ten', scaleMax: 10, askOf: ['peer'] },
        { _id: 'c', type: 'rating', label: 'Unspecified', askOf: ['peer'] },
      ],
    },
  ];
  const feedback = [
    row('peer', [{ questionId: 'a', rating: 5 }, { questionId: 'b', rating: 10 }, { questionId: 'c', rating: 3 }]),
    row('peer', [{ questionId: 'a', rating: 4 }, { questionId: 'b', rating: 6 }, { questionId: 'c', rating: 4 }]),
  ];
  const [a, b, c] = buildComparison(mixed, feedback, HR);

  assert.strictEqual(a.scaleMax, 5);
  assert.strictEqual(a.peer.mean, 4.5);
  assert.strictEqual(b.scaleMax, 10);
  assert.strictEqual(b.peer.mean, 8);
  // A mean of 6.25 would be the pooled figure across both scales; it appears
  // nowhere, because each question is averaged only against itself.
  assert.ok(![a, b].some((r) => r.peer.mean === 6.25));
  // A missing scaleMax is reported as null, not guessed at.
  assert.strictEqual(c.scaleMax, null);
  assert.strictEqual(c.peer.mean, 3.5);
});

test('rows appear in template order across sections', () => {
  const twoSections = [
    { title: 'A', questions: [{ _id: 'a1', type: 'rating', label: 'A1', scaleMax: 5, askOf: ['self'] }] },
    { title: 'B', questions: [{ _id: 'b1', type: 'rating', label: 'B1', scaleMax: 5, askOf: ['self'] }] },
  ];
  const rows = buildComparison(twoSections, [], HR);
  assert.deepStrictEqual(rows.map((r) => [r.sectionTitle, r.questionId]), [['A', 'a1'], ['B', 'b1']]);
});

test('ObjectId question ids join, and hydrated documents are read via schema paths', () => {
  const AppraisalFeedback = require('../models/AppraisalFeedback');
  const qid = new mongoose.Types.ObjectId();
  const objectIdSections = [
    { title: 'Performance', questions: [{ _id: qid, type: 'rating', label: 'Quality', scaleMax: 5, askOf: ['self', 'peer'] }] },
  ];
  const ids = () => ({
    tenant: new mongoose.Types.ObjectId(),
    appraisal: new mongoose.Types.ObjectId(),
    cycle: new mongoose.Types.ObjectId(),
    reviewer: new mongoose.Types.ObjectId(),
  });
  const feedback = [
    new AppraisalFeedback({ ...ids(), kind: 'self', status: 'submitted', answers: [{ questionId: qid, rating: 5 }] }),
    new AppraisalFeedback({ ...ids(), kind: 'peer', status: 'submitted', answers: [{ questionId: qid, rating: 4 }] }),
    new AppraisalFeedback({ ...ids(), kind: 'peer', status: 'submitted', answers: [{ questionId: qid, rating: 3 }] }),
    new AppraisalFeedback({ ...ids(), kind: 'peer', status: 'pending', answers: [{ questionId: qid, rating: 1 }] }),
  ];
  const [q] = buildComparison(objectIdSections, feedback, SUBJECT);

  // If the helper spread the hydrated doc instead of reading its paths, `kind`
  // and `status` would be undefined and every bucket would come back empty.
  assert.strictEqual(q.self, 5);
  assert.deepStrictEqual(q.peer, { mean: 3.5, n: 2, suppressed: false });
  assert.strictEqual(String(q.questionId), String(qid));
});
