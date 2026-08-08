import { describe, expect, it } from 'vitest';
import { askedQuestionIds, cycleStats } from './cycle-detail-utils';
import type {
  AppraisalFeedback,
  AppraisalSection,
  CycleProgress,
} from '@/services/appraisal.service';

const progress = (over: Partial<CycleProgress> = {}): CycleProgress => ({
  byState: {},
  feedbackTotal: 0,
  feedbackSubmitted: 0,
  stalled: [],
  ...over,
});

// ---------------------------------------------------------------------------
// cycleStats
// ---------------------------------------------------------------------------
describe('cycleStats', () => {
  it('counts every state toward the total', () => {
    const s = cycleStats(
      progress({ byState: { collecting: 4, summarising: 2, released: 3 } })
    );
    expect(s.total).toBe(9);
    expect(s.done).toBe(3);
    expect(s.inFlight).toBe(6);
  });

  it('treats released AND acknowledged as done', () => {
    // Releasing is when the work of the cycle is finished. Whether the
    // employee has clicked acknowledge is separate chasing, and a cycle that
    // reads 60% complete because six people have not clicked a button sends
    // HR after the wrong thing.
    const s = cycleStats(
      progress({ byState: { released: 2, acknowledged: 3 } })
    );
    expect(s.done).toBe(5);
    expect(s.completionPct).toBe(100);
  });

  it('excludes cancelled appraisals from the denominator', () => {
    // 2 of 4 live are done. Counting the cancelled pair as outstanding would
    // cap this cycle at 50% forever.
    const s = cycleStats(
      progress({ byState: { released: 2, collecting: 2, cancelled: 2 } })
    );
    expect(s.total).toBe(6);
    expect(s.cancelled).toBe(2);
    expect(s.inFlight).toBe(2);
    expect(s.completionPct).toBe(50);
  });

  it('reports null rather than 0% when there is nothing to be a percentage of', () => {
    // A cycle nobody has launched has not started; it is not 0% complete. A
    // 0% bar is a claim about progress that has not begun.
    expect(cycleStats(progress()).completionPct).toBeNull();
    expect(cycleStats(null).completionPct).toBeNull();
    expect(
      cycleStats(progress({ byState: { cancelled: 3 } })).completionPct
    ).toBeNull();
  });

  it('survives a null progress payload entirely', () => {
    const s = cycleStats(null);
    expect(s.total).toBe(0);
    expect(s.stalledCount).toBe(0);
    expect(s.feedbackPct).toBeNull();
  });

  it('ignores a non-numeric or negative count rather than poisoning the totals', () => {
    // One bad aggregate value must not turn every tile into NaN.
    const s = cycleStats(
      progress({
        byState: {
          collecting: 3,
          released: 'two' as unknown as number,
          draft: -5,
        },
      })
    );
    expect(s.total).toBe(3);
    expect(s.done).toBe(0);
    expect(Number.isNaN(s.completionPct)).toBe(false);
  });

  it('computes the feedback percentage separately from the appraisal one', () => {
    const s = cycleStats(
      progress({
        byState: { collecting: 4 },
        feedbackTotal: 12,
        feedbackSubmitted: 9,
      })
    );
    expect(s.feedbackPct).toBe(75);
    expect(s.completionPct).toBe(0);
  });

  it('rounds the percentages', () => {
    const s = cycleStats(
      progress({
        byState: { released: 1, collecting: 2 },
        feedbackTotal: 3,
        feedbackSubmitted: 1,
      })
    );
    expect(s.completionPct).toBe(33);
    expect(s.feedbackPct).toBe(33);
  });
});

// `deadlineTone` moved to my-appraisals-utils.ts (one rule for the module,
// 7-day window) — its tests moved with it to my-appraisals-utils.test.ts.

// ---------------------------------------------------------------------------
// askedQuestionIds
// ---------------------------------------------------------------------------
const section = (id: string, questionIds: string[]): AppraisalSection =>
  ({
    _id: id,
    title: id,
    questions: questionIds.map((q) => ({ _id: q, label: q, type: 'text' })),
  }) as unknown as AppraisalSection;

const feedback = (questionIds: string[]): AppraisalFeedback =>
  ({
    _id: 'f',
    kind: 'self',
    status: 'submitted',
    answers: questionIds.map((q) => ({ questionId: q, text: 'x' })),
  }) as unknown as AppraisalFeedback;

describe('askedQuestionIds', () => {
  it('returns ids in TEMPLATE order, not id order', () => {
    // The whole point. Sorting by ObjectId scrambles a form HR sequenced
    // deliberately — "What went well?" landing after "What should improve?"
    // loses the thread the form was written to follow.
    const sections = [section('s1', ['zeta', 'alpha']), section('s2', ['mid'])];
    expect(
      askedQuestionIds(feedback(['mid', 'alpha', 'zeta']), undefined, sections)
    ).toEqual(['zeta', 'alpha', 'mid']);
  });

  it('unions self and manager without duplicating a shared question', () => {
    const sections = [section('s1', ['q1', 'q2', 'q3'])];
    const ids = askedQuestionIds(
      feedback(['q1', 'q2']),
      feedback(['q2', 'q3']),
      sections
    );
    expect(ids).toEqual(['q1', 'q2', 'q3']);
  });

  it('keeps an answer whose question was edited out of the template', () => {
    // Dropping it would silently hide something a person actually wrote.
    const sections = [section('s1', ['q1'])];
    const ids = askedQuestionIds(
      feedback(['q1', 'gone-b', 'gone-a']),
      undefined,
      sections
    );
    expect(ids[0]).toBe('q1');
    // Orphans come last and are sorted among themselves, so the order is at
    // least stable between renders.
    expect(ids.slice(1)).toEqual(['gone-a', 'gone-b']);
  });

  it('omits a template question nobody answered', () => {
    const sections = [section('s1', ['q1', 'q2'])];
    expect(askedQuestionIds(feedback(['q2']), undefined, sections)).toEqual([
      'q2',
    ]);
  });

  it('falls back to sorted ids when no sections are supplied', () => {
    expect(askedQuestionIds(feedback(['b', 'a']), undefined)).toEqual([
      'a',
      'b',
    ]);
  });

  it('returns an empty list when neither side has answered', () => {
    expect(
      askedQuestionIds(undefined, undefined, [section('s1', ['q1'])])
    ).toEqual([]);
  });
});
