import { describe, expect, test } from 'vitest';
import {
  isScoredOptions,
  scoredOptionLabel,
  answerForScoredOption,
} from './review-answer-utils';
import { formatAnswer } from './review-answer-utils';
import type { AppraisalQuestion } from '@/services/appraisal.service';

// A scored-anchor question: five behavioural descriptions, each carrying a
// hidden score. The rater sees only the words.
const punctuality = {
  _id: 'q1',
  type: 'likert',
  label: 'Punctuality',
  required: true,
  scaleMax: 5,
  askOf: ['self', 'manager'],
  options: [
    'Ready to start at the scheduled time on effectively every shift',
    'On time for almost all shifts',
    'Generally on time, but late often enough to be noticed',
    'Late regularly, or on time but not ready to start work',
    'Frequently late without notice',
  ],
  optionScores: [5, 4, 3, 2, 1],
} as unknown as AppraisalQuestion;

const plainRating = {
  _id: 'q2',
  type: 'rating',
  label: 'Quality',
  required: true,
  scaleMax: 5,
  askOf: ['manager'],
} as unknown as AppraisalQuestion;

describe('isScoredOptions', () => {
  test('recognises an ordinal question whose options carry scores', () => {
    expect(isScoredOptions(punctuality)).toBe(true);
  });

  test('rejects an ordinary rating question with no options', () => {
    expect(isScoredOptions(plainRating)).toBe(false);
  });

  test('rejects a question whose scores do not pair with its options', () => {
    // The server refuses to save this, but a stale client or a hand-edited
    // document could still present it. Falling back to the plain numeric
    // scale is safe; rendering buttons that map to `undefined` is not.
    const broken = {
      ...punctuality,
      optionScores: [5, 4],
    } as unknown as AppraisalQuestion;
    expect(isScoredOptions(broken)).toBe(false);
  });

  test('rejects a `choice` question, which stores text and carries no score', () => {
    const choice = {
      ...punctuality,
      type: 'choice',
    } as unknown as AppraisalQuestion;
    expect(isScoredOptions(choice)).toBe(false);
  });
});

describe('answerForScoredOption', () => {
  test('stores the score of the chosen option, not its index', () => {
    expect(answerForScoredOption(punctuality, 1)).toEqual({
      questionId: 'q1',
      rating: 4,
    });
  });

  test('scores the bottom anchor as its real value rather than zero', () => {
    expect(answerForScoredOption(punctuality, 4)).toEqual({
      questionId: 'q1',
      rating: 1,
    });
  });
});

describe('scoredOptionLabel', () => {
  test('reads a stored rating back as the wording the rater actually chose', () => {
    expect(scoredOptionLabel(punctuality, 2)).toBe(
      'Late regularly, or on time but not ready to start work'
    );
    expect(scoredOptionLabel(punctuality, 3)).toBe(
      'Generally on time, but late often enough to be noticed'
    );
  });

  test('returns null for a rating matching no option', () => {
    expect(scoredOptionLabel(punctuality, 99)).toBeNull();
  });
});

describe('formatAnswer on a scored-anchor question', () => {
  test('shows the chosen wording, never the hidden score', () => {
    const shown = formatAnswer(punctuality, { questionId: 'q1', rating: 4 });

    expect(shown).toBe('On time for almost all shifts');
    // The leak this exists to prevent: the generic numeric branch renders
    // "4 of 5", which is exactly the number the rater was never shown.
    expect(shown).not.toMatch(/\d\s*of\s*\d/);
  });

  test('still shows the plain numeric form for an ordinary rating question', () => {
    expect(formatAnswer(plainRating, { questionId: 'q2', rating: 4 })).toBe(
      '4 of 5'
    );
  });

  test('reports an abstention as such, not as a score', () => {
    expect(
      formatAnswer(punctuality, { questionId: 'q1', notObserved: true })
    ).toBe('Not observed');
  });
});
