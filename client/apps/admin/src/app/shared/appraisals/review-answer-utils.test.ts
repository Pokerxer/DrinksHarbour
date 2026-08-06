import { describe, expect, it } from 'vitest';
import {
  formatAnswer,
  isAnswered,
  outstandingRequired,
  progressOf,
  scaleMaxOf,
  seedAnswers,
  serializeAnswers,
  toggleChoice,
} from './review-answer-utils';
import type {
  AppraisalQuestion,
  AppraisalSection,
  QuestionType,
} from '@/services/appraisal.service';

const q = (
  type: QuestionType,
  over: Partial<AppraisalQuestion> = {}
): AppraisalQuestion => ({
  _id: 'q1',
  type,
  label: 'A question',
  required: true,
  askOf: ['self', 'manager', 'peer'],
  ...over,
});

describe('isAnswered', () => {
  // The two traps this module exists to prevent. Both are silent under a
  // truthiness check: the reviewer sees a full progress bar and submits a gap.
  it('treats yes_no "no" (rating 0) as ANSWERED', () => {
    expect(isAnswered(q('yes_no'), { questionId: 'q1', rating: 0 })).toBe(true);
  });

  it('treats a rating of 0 as ANSWERED', () => {
    expect(isAnswered(q('rating'), { questionId: 'q1', rating: 0 })).toBe(true);
  });

  it('treats whitespace-only text as UNANSWERED', () => {
    expect(isAnswered(q('text'), { questionId: 'q1', text: '   \n ' })).toBe(
      false
    );
  });

  it('treats an emptied choice group as UNANSWERED', () => {
    expect(isAnswered(q('choice'), { questionId: 'q1', selected: [] })).toBe(
      false
    );
  });

  it('reads the field belonging to the QUESTION type, not whichever is set', () => {
    // A stale text field left over from an earlier template version must not
    // make a rating question look answered.
    expect(isAnswered(q('rating'), { questionId: 'q1', text: 'hello' })).toBe(
      false
    );
    expect(isAnswered(q('text'), { questionId: 'q1', rating: 4 })).toBe(false);
  });

  it('rejects NaN, which a parsed empty input produces', () => {
    expect(isAnswered(q('scale'), { questionId: 'q1', rating: NaN })).toBe(
      false
    );
  });

  it('is false for a missing answer', () => {
    expect(isAnswered(q('likert'), undefined)).toBe(false);
  });
});

describe('scaleMaxOf', () => {
  it('defaults to 5 when the template omits or corrupts scaleMax', () => {
    expect(scaleMaxOf(q('likert'))).toBe(5);
    expect(scaleMaxOf(q('likert', { scaleMax: 1 }))).toBe(5);
    expect(scaleMaxOf(q('likert', { scaleMax: NaN }))).toBe(5);
  });

  it('honours a real scaleMax', () => {
    expect(scaleMaxOf(q('rating', { scaleMax: 10 }))).toBe(10);
  });
});

describe('toggleChoice', () => {
  const single = q('choice', { options: ['A', 'B', 'C'], multiple: false });
  const multi = q('choice', { options: ['A', 'B', 'C'], multiple: true });

  it('single-select replaces the previous choice', () => {
    expect(toggleChoice(single, ['A'], 'B')).toEqual(['B']);
  });

  it('single-select is idempotent — re-choosing is NOT a deselect', () => {
    // A radio fires no `change` when the already-checked option is clicked, so
    // a toggle-off here would be unreachable code. Clearing is an explicit
    // control in the card instead.
    expect(toggleChoice(single, ['A'], 'A')).toEqual(['A']);
  });

  it('multi-select adds and removes', () => {
    expect(toggleChoice(multi, ['A'], 'B')).toEqual(['A', 'B']);
    expect(toggleChoice(multi, ['A', 'B'], 'A')).toEqual(['B']);
  });

  it('multi-select stores template order, not click order', () => {
    // Two reviewers picking the same options must produce identical arrays.
    expect(toggleChoice(multi, ['C'], 'A')).toEqual(['A', 'C']);
  });

  it('tolerates a missing current selection', () => {
    expect(toggleChoice(multi, undefined, 'B')).toEqual(['B']);
  });
});

const sections: AppraisalSection[] = [
  {
    title: 'Delivery',
    questions: [
      q('rating', { _id: 'r1' }),
      q('yes_no', { _id: 'y1' }),
      q('text', { _id: 't1', required: false }),
    ],
  },
  {
    title: 'Growth',
    questions: [
      q('choice', { _id: 'c1', options: ['A', 'B'], multiple: true }),
    ],
  },
];

describe('progressOf', () => {
  it('counts a "no" and a 0 rating as progress', () => {
    const p = progressOf(sections, {
      r1: { questionId: 'r1', rating: 0 },
      y1: { questionId: 'y1', rating: 0 },
    });
    expect(p).toEqual({ answered: 2, total: 4, pct: 50 });
  });

  it('does not divide by zero on an empty form', () => {
    expect(progressOf([], {})).toEqual({ answered: 0, total: 0, pct: 0 });
    expect(progressOf(undefined, {})).toEqual({
      answered: 0,
      total: 0,
      pct: 0,
    });
  });
});

describe('outstandingRequired', () => {
  it('returns required-and-unanswered in render order', () => {
    const missing = outstandingRequired(sections, {
      r1: { questionId: 'r1', rating: 3 },
    });
    expect(missing.map((m) => m._id)).toEqual(['y1', 'c1']);
  });

  it('ignores optional questions', () => {
    const missing = outstandingRequired(sections, {
      r1: { questionId: 'r1', rating: 3 },
      y1: { questionId: 'y1', rating: 1 },
      c1: { questionId: 'c1', selected: ['A'] },
    });
    // t1 is unanswered but optional.
    expect(missing).toEqual([]);
  });
});

describe('serializeAnswers', () => {
  it('narrows each answer to the one field its type uses', () => {
    const out = serializeAnswers(sections, {
      r1: { questionId: 'r1', rating: 4, text: 'stale' },
      y1: { questionId: 'y1', rating: 0 },
      t1: { questionId: 't1', text: '  trimmed  ' },
      c1: { questionId: 'c1', selected: ['A', 'B'] },
    });
    expect(out).toEqual([
      { questionId: 'r1', rating: 4 },
      { questionId: 'y1', rating: 0 },
      { questionId: 't1', text: 'trimmed' },
      { questionId: 'c1', selected: ['A', 'B'] },
    ]);
  });

  it('drops answers for questions not in this form', () => {
    // The server 400s the WHOLE request on an unknown question id, so one
    // stale entry would block every later save.
    const out = serializeAnswers(sections, {
      r1: { questionId: 'r1', rating: 4 },
      ghost: { questionId: 'ghost', rating: 5 },
    });
    expect(out).toEqual([{ questionId: 'r1', rating: 4 }]);
  });

  it('drops answers the reviewer cleared', () => {
    const out = serializeAnswers(sections, {
      t1: { questionId: 't1', text: '   ' },
      c1: { questionId: 'c1', selected: [] },
    });
    expect(out).toEqual([]);
  });

  it('does not alias the selected array it was given', () => {
    const selected = ['A'];
    const out = serializeAnswers(sections, {
      c1: { questionId: 'c1', selected },
    });
    selected.push('B');
    expect(out[0].selected).toEqual(['A']);
  });
});

describe('seedAnswers', () => {
  it('keys saved answers by question id', () => {
    expect(seedAnswers([{ questionId: 'r1', rating: 2 }])).toEqual({
      r1: { questionId: 'r1', rating: 2 },
    });
  });

  it('tolerates a missing or malformed answers array', () => {
    expect(seedAnswers(undefined)).toEqual({});
    expect(seedAnswers([{ rating: 2 } as never])).toEqual({});
  });
});

describe('formatAnswer', () => {
  it('renders yes_no as words, not as 1/0', () => {
    expect(formatAnswer(q('yes_no'), { questionId: 'q1', rating: 0 })).toBe(
      'No'
    );
    expect(formatAnswer(q('yes_no'), { questionId: 'q1', rating: 1 })).toBe(
      'Yes'
    );
  });

  it('renders a rating against its own scale', () => {
    expect(
      formatAnswer(q('rating', { scaleMax: 10 }), {
        questionId: 'q1',
        rating: 7,
      })
    ).toBe('7 of 10');
  });

  it('joins multi-select labels', () => {
    expect(
      formatAnswer(q('choice'), { questionId: 'q1', selected: ['A', 'B'] })
    ).toBe('A, B');
  });

  it('returns null (not "") when unanswered', () => {
    expect(formatAnswer(q('text'), undefined)).toBeNull();
  });
});
