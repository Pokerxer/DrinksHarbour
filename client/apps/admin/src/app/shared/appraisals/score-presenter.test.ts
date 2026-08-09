import { describe, expect, test } from 'vitest';
import { scoreCard } from './score-presenter';
import type { AppraisalScore } from '@/services/appraisal.service';
import type { AppraisalAccess } from '@/services/appraisal.service';

const score = (over: Partial<AppraisalScore> = {}): AppraisalScore => ({
  earned: 82,
  possible: 100,
  pct: 82,
  counted: 20,
  skipped: 0,
  ...over,
});

const access = (relation: AppraisalAccess['relation']) =>
  ({ relation }) as AppraisalAccess;

describe('scoreCard', () => {
  test('shows the mark out of what was actually scorable', () => {
    const card = scoreCard(score(), access('manager'));
    expect(card).toMatchObject({
      kind: 'scored',
      pctLabel: '82%',
      pointsLabel: '82 of 100',
    });
  });

  test('keeps the tenth of a percent the server computed', () => {
    expect(scoreCard(score({ pct: 82.5 }), access('manager'))).toMatchObject({
      pctLabel: '82.5%',
    });
  });

  test('a real zero is a verdict somebody reached and is shown as one', () => {
    expect(
      scoreCard(score({ earned: 0, pct: 0 }), access('manager'))
    ).toMatchObject({ kind: 'scored', pctLabel: '0%' });
  });

  test('nothing scored yet is pending, never 0%', () => {
    expect(
      scoreCard(
        score({ earned: 0, possible: 0, pct: null, counted: 0, skipped: 20 }),
        access('manager')
      )
    ).toEqual({ kind: 'pending' });
  });

  test('a form with no scorable questions renders nothing at all, not 0 of 0', () => {
    expect(
      scoreCard(
        score({ earned: 0, possible: 0, pct: null, counted: 0, skipped: 0 }),
        access('manager')
      )
    ).toEqual({ kind: 'hidden' });
  });

  test('an absent score (an older API, a failed field) renders nothing', () => {
    expect(scoreCard(undefined, access('manager'))).toEqual({ kind: 'hidden' });
  });

  test('the employee sees their own mark — they only reach this page once released', () => {
    expect(scoreCard(score(), access('subject'))).toMatchObject({
      kind: 'scored',
    });
  });

  test('HR sees it', () => {
    expect(scoreCard(score(), access('hr'))).toMatchObject({ kind: 'scored' });
  });

  test('a reviewer never gets a score card, whatever the payload holds', () => {
    expect(scoreCard(score(), access('reviewer'))).toEqual({ kind: 'hidden' });
    expect(scoreCard(score(), access('none'))).toEqual({ kind: 'hidden' });
  });
});

describe('scoreCard coverage', () => {
  test('a complete assessment says nothing about coverage', () => {
    expect(scoreCard(score(), access('manager'))).toMatchObject({
      coverage: null,
    });
  });

  test('a partial assessment says how much of the form the mark rests on', () => {
    expect(
      scoreCard(
        score({ earned: 74, possible: 90, pct: 82.2, counted: 18, skipped: 2 }),
        access('manager')
      )
    ).toMatchObject({
      coverage: '18 of 20 criteria scored',
      pointsLabel: '74 of 90',
    });
  });

  test('the wording follows the total, not the number scored', () => {
    expect(
      scoreCard(
        score({ earned: 4, possible: 5, pct: 80, counted: 1, skipped: 1 }),
        access('manager')
      )
    ).toMatchObject({ coverage: '1 of 2 criteria scored' });
  });
});
