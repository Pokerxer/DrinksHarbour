// Guards the two server-side halves of "the reviewer form handles all six
// template question types": where a non-rating answer is STORED, and which
// types are allowed to reach the self-vs-manager-vs-peer comparison.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  buildComparison,
  COMPARABLE_QUESTION_TYPES,
} = require('../services/appraisal.helpers');
const AppraisalFeedback = require('../models/AppraisalFeedback');

const SUBJECT = { canSeeReviewerNames: false };
const row = (kind, answers) => ({ kind, status: 'submitted', answers });

/* ── Storage ─────────────────────────────────────────────────────────────── */

test('answerSchema persists `selected` for choice questions', () => {
  const fb = new AppraisalFeedback({
    tenant: new mongoose.Types.ObjectId(),
    appraisal: new mongoose.Types.ObjectId(),
    cycle: new mongoose.Types.ObjectId(),
    reviewer: new mongoose.Types.ObjectId(),
    kind: 'self',
    answers: [
      { questionId: new mongoose.Types.ObjectId(), selected: ['Mentoring', 'Delivery'] },
    ],
  });

  // Mongoose silently DROPS paths the schema does not declare, so a
  // multi-select answer sent against the old two-field schema would have been
  // accepted with a 200 and stored as nothing at all. That silence is the
  // whole reason this assertion exists.
  assert.deepStrictEqual(fb.answers[0].selected.toObject(), [
    'Mentoring',
    'Delivery',
  ]);
  assert.strictEqual(fb.validateSync(), undefined);
});

test('answerSchema still accepts rating 0, which is how yes_no stores "no"', () => {
  const fb = new AppraisalFeedback({
    tenant: new mongoose.Types.ObjectId(),
    appraisal: new mongoose.Types.ObjectId(),
    cycle: new mongoose.Types.ObjectId(),
    reviewer: new mongoose.Types.ObjectId(),
    kind: 'manager',
    answers: [{ questionId: new mongoose.Types.ObjectId(), rating: 0 }],
  });
  assert.strictEqual(fb.validateSync(), undefined);
  assert.strictEqual(fb.answers[0].rating, 0);
});

/* ── Comparison membership ───────────────────────────────────────────────── */

test('COMPARABLE_QUESTION_TYPES is ordinal types only', () => {
  assert.deepStrictEqual(
    [...COMPARABLE_QUESTION_TYPES].sort(),
    ['likert', 'rating', 'scale']
  );
});

test('buildComparison includes likert and scale alongside rating', () => {
  const sections = [
    {
      title: 'Performance',
      questions: [
        { _id: 'q1', type: 'rating', label: 'Quality', scaleMax: 5, askOf: ['self', 'manager'] },
        { _id: 'q2', type: 'likert', label: 'Communicates well', scaleMax: 5, askOf: ['self', 'manager'] },
        { _id: 'q3', type: 'scale', label: 'Overall', scaleMax: 10, askOf: ['self', 'manager'] },
      ],
    },
  ];
  const feedback = [
    row('self', [
      { questionId: 'q1', rating: 5 },
      { questionId: 'q2', rating: 4 },
      { questionId: 'q3', rating: 9 },
    ]),
    row('manager', [
      { questionId: 'q1', rating: 3 },
      { questionId: 'q2', rating: 2 },
      { questionId: 'q3', rating: 6 },
    ]),
  ];

  const out = buildComparison(sections, feedback, SUBJECT);
  assert.deepStrictEqual(out.map((r) => r.questionId), ['q1', 'q2', 'q3']);
  // Each row keeps its OWN scaleMax: a /5 and a /10 answer are arithmetic on
  // two different units and must never share a denominator.
  assert.deepStrictEqual(out.map((r) => r.scaleMax), [5, 5, 10]);
  assert.deepStrictEqual(out.map((r) => r.self), [5, 4, 9]);
  assert.deepStrictEqual(out.map((r) => r.manager), [3, 2, 6]);
});

test('buildComparison EXCLUDES yes_no and choice, which store numbers or labels but do not average', () => {
  const sections = [
    {
      title: 'Mixed',
      questions: [
        { _id: 'q1', type: 'rating', label: 'Quality', scaleMax: 5, askOf: ['self'] },
        { _id: 'q2', type: 'yes_no', label: 'Met every deadline?', askOf: ['self'] },
        { _id: 'q3', type: 'choice', label: 'Strongest area', options: ['A', 'B'], askOf: ['self'] },
        { _id: 'q4', type: 'text', label: 'Anything else?', askOf: ['self'] },
      ],
    },
  ];
  const feedback = [
    row('self', [
      { questionId: 'q1', rating: 4 },
      // yes_no is stored in `rating`, so a membership test written as "does
      // this answer hold a number" would let it through and draw a 1-of-5 bar
      // for the word "no". The gate is on the QUESTION type, not the payload.
      { questionId: 'q2', rating: 1 },
      { questionId: 'q3', selected: ['A'] },
      { questionId: 'q4', text: 'No' },
    ]),
  ];

  const out = buildComparison(sections, feedback, SUBJECT);
  assert.deepStrictEqual(out.map((r) => r.questionId), ['q1']);
});
