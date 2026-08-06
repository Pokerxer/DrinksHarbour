import { describe, expect, it } from 'vitest';
import {
  answersSignature,
  nextUnanswered,
  saveStatusLabel,
  sectionDomId,
  sectionProgress,
} from './review-form-utils';
import type {
  AppraisalAnswer,
  AppraisalQuestion,
  AppraisalSection,
  QuestionType,
} from '@/services/appraisal.service';

const q = (
  id: string,
  type: QuestionType,
  over: Partial<AppraisalQuestion> = {}
): AppraisalQuestion => ({
  _id: id,
  type,
  label: `Question ${id}`,
  required: true,
  askOf: ['self', 'manager', 'peer'],
  ...over,
});

const sections: AppraisalSection[] = [
  { title: 'Alpha', questions: [q('a1', 'rating'), q('a2', 'text')] },
  {
    title: 'Beta',
    questions: [
      q('b1', 'yes_no'),
      q('b2', 'choice', { options: ['x', 'y'], required: false }),
      q('b3', 'likert'),
    ],
  },
];

const map = (...entries: AppraisalAnswer[]): Record<string, AppraisalAnswer> =>
  Object.fromEntries(entries.map((a) => [a.questionId, a]));

describe('answersSignature', () => {
  it('is stable across two equal answer maps built in different orders', () => {
    const a = map(
      { questionId: 'a1', rating: 3 },
      { questionId: 'b1', rating: 0 }
    );
    const b = map(
      { questionId: 'b1', rating: 0 },
      { questionId: 'a1', rating: 3 }
    );
    expect(answersSignature(sections, a)).toBe(answersSignature(sections, b));
  });

  it('ignores an edit that round-trips back to nothing', () => {
    const pristine: Record<string, AppraisalAnswer> = {};
    const touched = map({ questionId: 'a2', text: '   ' });
    // Typing whitespace into a textarea and leaving it is not a change worth
    // writing — serializeAnswers would drop it either way.
    expect(answersSignature(sections, touched)).toBe(
      answersSignature(sections, pristine)
    );
  });

  it('ignores an emptied multi-select', () => {
    const cleared = map({ questionId: 'b2', selected: [] });
    expect(answersSignature(sections, cleared)).toBe(
      answersSignature(sections, {})
    );
  });

  it('changes when a real answer changes', () => {
    const before = map({ questionId: 'a1', rating: 3 });
    const after = map({ questionId: 'a1', rating: 4 });
    expect(answersSignature(sections, before)).not.toBe(
      answersSignature(sections, after)
    );
  });

  it('treats a yes_no "no" as a real answer, not as pristine', () => {
    // 0 is the exact value a truthiness check would lose.
    const no = map({ questionId: 'b1', rating: 0 });
    expect(answersSignature(sections, no)).not.toBe(
      answersSignature(sections, {})
    );
  });
});

describe('sectionProgress', () => {
  it('counts each section independently and ids them by position', () => {
    const rows = sectionProgress(
      sections,
      map({ questionId: 'a1', rating: 2 }, { questionId: 'b1', rating: 0 })
    );
    expect(rows.map((r) => r.id)).toEqual([sectionDomId(0), sectionDomId(1)]);
    expect(rows[0]).toMatchObject({
      title: 'Alpha',
      answered: 1,
      total: 2,
      pct: 50,
      complete: false,
      firstQuestionId: 'a1',
    });
    expect(rows[1]).toMatchObject({ title: 'Beta', answered: 1, total: 3 });
  });

  it('counts only unanswered REQUIRED questions as blockers', () => {
    // b2 is optional, so a fully unanswered Beta still blocks on 2, not 3.
    const rows = sectionProgress(sections, {});
    expect(rows[1].missingRequired).toBe(2);
  });

  it('names an untitled section by its position', () => {
    const rows = sectionProgress(
      [{ title: '  ', questions: [q('z', 'text')] }],
      {}
    );
    expect(rows[0].title).toBe('Section 1');
  });

  it('reports a complete section once every question is answered', () => {
    const rows = sectionProgress(
      sections,
      map({ questionId: 'a1', rating: 5 }, { questionId: 'a2', text: 'done' })
    );
    expect(rows[0].complete).toBe(true);
    expect(rows[0].pct).toBe(100);
  });

  it('survives undefined sections', () => {
    expect(sectionProgress(undefined, {})).toEqual([]);
  });
});

describe('nextUnanswered', () => {
  it('returns the first gap when given no anchor', () => {
    expect(nextUnanswered(sections, {})?._id).toBe('a1');
  });

  it('skips answered questions', () => {
    const answers = map(
      { questionId: 'a1', rating: 1 },
      { questionId: 'a2', text: 'x' }
    );
    expect(nextUnanswered(sections, answers)?._id).toBe('b1');
  });

  it('moves past the anchor rather than returning it', () => {
    expect(nextUnanswered(sections, {}, { afterId: 'a1' })?._id).toBe('a2');
  });

  it('wraps to the top once the anchor is the last gap', () => {
    // Anchored on the final question, the only remaining gap is above it.
    const answers = map(
      { questionId: 'a2', text: 'x' },
      { questionId: 'b1', rating: 1 },
      { questionId: 'b2', selected: ['x'] },
      { questionId: 'b3', rating: 4 }
    );
    expect(nextUnanswered(sections, answers, { afterId: 'b3' })?._id).toBe(
      'a1'
    );
  });

  it('honours requiredOnly by skipping optional gaps', () => {
    const answers = map(
      { questionId: 'a1', rating: 1 },
      { questionId: 'a2', text: 'x' },
      { questionId: 'b1', rating: 1 }
    );
    // b2 is optional and unanswered; b3 is the next REQUIRED gap.
    expect(nextUnanswered(sections, answers, { requiredOnly: true })?._id).toBe(
      'b3'
    );
  });

  it('returns null when nothing is left', () => {
    const answers = map(
      { questionId: 'a1', rating: 1 },
      { questionId: 'a2', text: 'x' },
      { questionId: 'b1', rating: 0 },
      { questionId: 'b2', selected: ['y'] },
      { questionId: 'b3', rating: 3 }
    );
    expect(nextUnanswered(sections, answers)).toBeNull();
  });

  it('falls back to the first gap when the anchor is not a real question', () => {
    expect(nextUnanswered(sections, {}, { afterId: 'nope' })?._id).toBe('a1');
  });
});

describe('saveStatusLabel', () => {
  const t0 = 1_700_000_000_000;

  it('says nothing on a form that has never been touched', () => {
    expect(saveStatusLabel('idle', null, t0)).toBeNull();
  });

  it('says nothing for "saved" with no timestamp to back it up', () => {
    expect(saveStatusLabel('saved', null, t0)).toBeNull();
  });

  it('reports the in-flight and failed states', () => {
    expect(saveStatusLabel('saving', null, t0)).toBe('Saving…');
    expect(saveStatusLabel('error', t0, t0)).toBe('Not saved — retry');
    expect(saveStatusLabel('dirty', t0, t0)).toBe('Unsaved changes');
  });

  it('ages a successful save from "all changes saved" through hours', () => {
    expect(saveStatusLabel('saved', t0, t0 + 5_000)).toBe('All changes saved');
    expect(saveStatusLabel('saved', t0, t0 + 60_000)).toBe(
      'Saved 1 minute ago'
    );
    expect(saveStatusLabel('saved', t0, t0 + 7 * 60_000)).toBe(
      'Saved 7 minutes ago'
    );
    expect(saveStatusLabel('saved', t0, t0 + 60 * 60_000)).toBe(
      'Saved 1 hour ago'
    );
    expect(saveStatusLabel('saved', t0, t0 + 150 * 60_000)).toBe(
      'Saved 2 hours ago'
    );
  });

  it('never reports a negative age from a clock skew', () => {
    expect(saveStatusLabel('saved', t0, t0 - 10_000)).toBe('All changes saved');
  });
});
