const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreAppraisal } = require('../services/appraisal.helpers');

// Plain string ids, matching appraisalComparison.test.js's idiom.
const sections = [
  {
    title: 'Cleaning',
    questions: [
      { _id: 'q1', type: 'likert', label: 'Punctuality', scaleMax: 5, askOf: ['self', 'manager'] },
      { _id: 'q2', type: 'likert', label: 'Quality', scaleMax: 5, askOf: ['self', 'manager'] },
      { _id: 'q3', type: 'text', label: 'Anything else?', askOf: ['self', 'manager'] },
    ],
  },
];

const row = (kind, answers, extra = {}) => ({ kind, status: 'submitted', answers, ...extra });

test('scoreAppraisal totals the requested reviewer kind into earned/possible/pct', () => {
  const feedback = [row('manager', [{ questionId: 'q1', rating: 4 }, { questionId: 'q2', rating: 5 }])];

  const score = scoreAppraisal(sections, feedback, { kind: 'manager' });

  assert.equal(score.earned, 9);
  assert.equal(score.possible, 10);
  assert.equal(score.pct, 90);
  assert.equal(score.counted, 2);
});

test('scoreAppraisal scores only the requested kind, ignoring the other rows', () => {
  const feedback = [
    row('self', [{ questionId: 'q1', rating: 5 }, { questionId: 'q2', rating: 5 }]),
    row('manager', [{ questionId: 'q1', rating: 2 }, { questionId: 'q2', rating: 3 }]),
  ];

  assert.equal(scoreAppraisal(sections, feedback, { kind: 'manager' }).earned, 5);
  assert.equal(scoreAppraisal(sections, feedback, { kind: 'self' }).earned, 10);
});

test('scoreAppraisal ignores a row that has not been submitted', () => {
  const feedback = [row('manager', [{ questionId: 'q1', rating: 5 }], { status: 'pending' })];

  const score = scoreAppraisal(sections, feedback, { kind: 'manager' });

  assert.equal(score.counted, 0);
  assert.equal(score.possible, 0);
  assert.equal(score.pct, null);
});

test('scoreAppraisal keeps a notObserved answer out of BOTH earned and possible', () => {
  // The whole point of the abstention: it must not read as a zero, and it must
  // not drag the denominator either, or abstaining would silently cost marks.
  const feedback = [
    row('manager', [{ questionId: 'q1', rating: 4 }, { questionId: 'q2', notObserved: true }]),
  ];

  const score = scoreAppraisal(sections, feedback, { kind: 'manager' });

  assert.equal(score.earned, 4);
  assert.equal(score.possible, 5);
  assert.equal(score.counted, 1);
  assert.equal(score.skipped, 1);
});

test('scoreAppraisal keeps an unanswered question out of BOTH earned and possible', () => {
  const feedback = [row('manager', [{ questionId: 'q1', rating: 3 }])];

  const score = scoreAppraisal(sections, feedback, { kind: 'manager' });

  assert.equal(score.earned, 3);
  assert.equal(score.possible, 5);
  assert.equal(score.skipped, 1);
});

test('scoreAppraisal counts a rating of 0 as answered and worth nothing', () => {
  // The classic falsy bug: `!answer.rating` would drop this and inflate the
  // percentage by shrinking the denominator instead of scoring the zero.
  const feedback = [
    row('manager', [{ questionId: 'q1', rating: 0 }, { questionId: 'q2', rating: 5 }]),
  ];

  const score = scoreAppraisal(sections, feedback, { kind: 'manager' });

  assert.equal(score.earned, 5);
  assert.equal(score.possible, 10);
  assert.equal(score.counted, 2);
  assert.equal(score.pct, 50);
});

test('scoreAppraisal excludes non-ordinal question types from the denominator', () => {
  // q3 is text. A yes_no would be worse still: it stores 1/0 but carries the
  // schema's default scaleMax of 5, so counting it would add 5 to `possible`
  // for a question whose best possible answer is 1.
  const sectionsWithYesNo = [
    {
      title: 'Mixed',
      questions: [
        ...sections[0].questions,
        { _id: 'q4', type: 'yes_no', label: 'Signed off?', scaleMax: 5, askOf: ['manager'] },
      ],
    },
  ];
  const feedback = [
    row('manager', [
      { questionId: 'q1', rating: 5 },
      { questionId: 'q2', rating: 5 },
      { questionId: 'q3', text: 'All good' },
      { questionId: 'q4', rating: 1 },
    ]),
  ];

  const score = scoreAppraisal(sectionsWithYesNo, feedback, { kind: 'manager' });

  assert.equal(score.possible, 10);
  assert.equal(score.earned, 10);
  assert.equal(score.pct, 100);
});

test('scoreAppraisal sums differing scaleMax values rather than averaging them', () => {
  // Summing earned over summed possible is well defined across mixed scales,
  // which is why this pools where buildComparison deliberately refuses to.
  const mixed = [
    {
      title: 'Mixed scales',
      questions: [
        { _id: 'a', type: 'likert', scaleMax: 5, askOf: ['manager'] },
        { _id: 'b', type: 'scale', scaleMax: 10, askOf: ['manager'] },
      ],
    },
  ];
  const feedback = [row('manager', [{ questionId: 'a', rating: 5 }, { questionId: 'b', rating: 5 }])];

  const score = scoreAppraisal(mixed, feedback, { kind: 'manager' });

  assert.equal(score.earned, 10);
  assert.equal(score.possible, 15);
});

test('scoreAppraisal reports pct null rather than dividing by zero', () => {
  const score = scoreAppraisal(sections, [], { kind: 'manager' });

  assert.equal(score.earned, 0);
  assert.equal(score.possible, 0);
  assert.equal(score.pct, null);
});
