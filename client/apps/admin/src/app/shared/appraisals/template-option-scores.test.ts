import { describe, expect, test } from 'vitest';
import {
  supportsOptionScores,
  hasOptionScores,
  enableOptionScores,
  addScoredRow,
  setScoredLabel,
  setScoredScore,
  removeScoredRow,
  syncScoredKeys,
  parseScore,
  scoreInputValue,
  optionScoreProblem,
  firstOptionScoreProblem,
  type ScoredRows,
} from './template-option-scores';

const rows = (
  options: string[],
  optionScores: number[],
  keys?: number[]
): ScoredRows => ({
  options,
  optionScores,
  keys: keys ?? options.map((_, i) => i),
});

describe('supportsOptionScores', () => {
  test('accepts the ordinal types whose answer is a stored number', () => {
    expect(supportsOptionScores('rating')).toBe(true);
    expect(supportsOptionScores('likert')).toBe(true);
    expect(supportsOptionScores('scale')).toBe(true);
  });

  test('rejects choice, which stores option TEXT and is never scored', () => {
    expect(supportsOptionScores('choice')).toBe(false);
  });

  test('rejects yes_no, whose real ceiling is 1 while scaleMax says 5', () => {
    expect(supportsOptionScores('yes_no')).toBe(false);
  });

  test('rejects text', () => {
    expect(supportsOptionScores('text')).toBe(false);
  });
});

describe('hasOptionScores', () => {
  test('a question carrying paired options and scores has scoring on', () => {
    expect(
      hasOptionScores({
        type: 'likert',
        options: ['a', 'b'],
        optionScores: [2, 1],
      })
    ).toBe(true);
  });

  test('an ordinary rating question does not', () => {
    expect(hasOptionScores({ type: 'rating', scaleMax: 5 })).toBe(false);
  });

  test('scores present but unpaired still counts as ON, so the editor can show the problem instead of silently dropping them', () => {
    expect(
      hasOptionScores({
        type: 'likert',
        options: ['a', 'b', 'c'],
        optionScores: [2, 1],
      })
    ).toBe(true);
  });

  test('a choice question is never scored, whatever it carries', () => {
    expect(
      hasOptionScores({
        type: 'choice',
        options: ['a', 'b'],
        optionScores: [2, 1],
      })
    ).toBe(false);
  });
});

describe('enableOptionScores', () => {
  test('scores existing options best-first, down from scaleMax', () => {
    expect(
      enableOptionScores({
        type: 'likert',
        scaleMax: 5,
        options: ['a', 'b', 'c'],
      })
    ).toEqual({ options: ['a', 'b', 'c'], optionScores: [5, 4, 3] });
  });

  test('a question with no options gets two blank rows to fill in', () => {
    expect(enableOptionScores({ type: 'likert', scaleMax: 5 })).toEqual({
      options: ['', ''],
      optionScores: [5, 4],
    });
  });

  test('defaults scaleMax to 5, matching the schema', () => {
    expect(enableOptionScores({ type: 'rating', options: ['a', 'b'] })).toEqual(
      {
        options: ['a', 'b'],
        optionScores: [5, 4],
      }
    );
  });

  test('more options than the scale can distinctly cover leaves the extras blank rather than repeating a score', () => {
    const out = enableOptionScores({
      type: 'likert',
      scaleMax: 2,
      options: ['a', 'b', 'c', 'd', 'e'],
    });
    expect(out.optionScores.slice(0, 3)).toEqual([2, 1, 0]);
    expect(out.optionScores.slice(3).every(Number.isNaN)).toBe(true);
  });
});

describe('addScoredRow', () => {
  test('adds an option, a fresh key and the highest score still unused', () => {
    const next = addScoredRow(rows(['a', 'b'], [5, 4]), 5);
    expect(next.options).toEqual(['a', 'b', '']);
    expect(next.optionScores).toEqual([5, 4, 3]);
    expect(next.keys).toHaveLength(3);
    expect(new Set(next.keys).size).toBe(3);
  });

  test('fills a hole left by an earlier edit rather than always going lower', () => {
    expect(addScoredRow(rows(['a', 'b'], [5, 3]), 5).optionScores).toEqual([
      5, 3, 4,
    ]);
  });

  test('leaves the new score blank when the scale has nothing distinct left', () => {
    const next = addScoredRow(rows(['a', 'b', 'c'], [2, 1, 0]), 2);
    expect(next.options).toHaveLength(4);
    expect(Number.isNaN(next.optionScores[3])).toBe(true);
  });
});

describe('removeScoredRow', () => {
  test('removes the same index from all three arrays', () => {
    const next = removeScoredRow(
      rows(['a', 'b', 'c'], [5, 4, 3], [7, 8, 9]),
      1
    );
    expect(next.options).toEqual(['a', 'c']);
    expect(next.optionScores).toEqual([5, 3]);
    expect(next.keys).toEqual([7, 9]);
  });
});

describe('setScoredLabel', () => {
  test('changes only the wording; the score stays paired to it', () => {
    const next = setScoredLabel(rows(['a', 'b'], [5, 4], [7, 8]), 1, 'bee');
    expect(next.options).toEqual(['a', 'bee']);
    expect(next.optionScores).toEqual([5, 4]);
    expect(next.keys).toEqual([7, 8]);
  });
});

describe('setScoredScore', () => {
  test('parses a typed number', () => {
    expect(
      setScoredScore(rows(['a', 'b'], [5, 4]), 1, '2').optionScores
    ).toEqual([5, 2]);
  });

  test('a cleared box is blank, not zero — 0 is a real score somebody could mean', () => {
    const next = setScoredScore(rows(['a', 'b'], [5, 4]), 1, '');
    expect(Number.isNaN(next.optionScores[1])).toBe(true);
  });

  test('leaves the options untouched', () => {
    expect(setScoredScore(rows(['a', 'b'], [5, 4]), 0, '3').options).toEqual([
      'a',
      'b',
    ]);
  });
});

describe('parseScore / scoreInputValue', () => {
  test('blank and non-numeric input read as blank', () => {
    expect(Number.isNaN(parseScore(''))).toBe(true);
    expect(Number.isNaN(parseScore('   '))).toBe(true);
    expect(Number.isNaN(parseScore('abc'))).toBe(true);
  });

  test('zero survives the round trip', () => {
    expect(parseScore('0')).toBe(0);
    expect(scoreInputValue(0)).toBe('0');
  });

  test('a blank score renders as an empty box, never as NaN', () => {
    expect(scoreInputValue(Number.NaN)).toBe('');
    expect(scoreInputValue(undefined)).toBe('');
  });
});

describe('optionScoreProblem', () => {
  test('a well-formed sheet has no problem', () => {
    expect(optionScoreProblem(['a', 'b', 'c'], [5, 3, 1], 5)).toBeNull();
  });

  test('every option needs a score', () => {
    expect(optionScoreProblem(['a', 'b'], [5], 5)).toMatch(/one score/i);
  });

  test('a blank score is reported before anything else', () => {
    expect(optionScoreProblem(['a', 'b'], [5, Number.NaN], 5)).toMatch(
      /needs a score/i
    );
  });

  test('a score above scaleMax is rejected, as the server would', () => {
    expect(optionScoreProblem(['a', 'b'], [6, 4], 5)).toMatch(/0.+5/);
  });

  test('a negative score is rejected', () => {
    expect(optionScoreProblem(['a', 'b'], [5, -1], 5)).toMatch(/0.+5/);
  });

  test('two options sharing a score is rejected — the score is what identifies which was picked', () => {
    expect(optionScoreProblem(['a', 'b'], [3, 3], 5)).toMatch(/distinct/i);
  });

  test('an empty option label is not this validator’s business', () => {
    expect(optionScoreProblem(['', 'b'], [5, 4], 5)).toBeNull();
  });

  test('needs at least two options — one anchor is not a rating sheet', () => {
    expect(optionScoreProblem(['a'], [5], 5)).toMatch(/two options/i);
  });
});

describe('firstOptionScoreProblem', () => {
  const scored = (over: Record<string, unknown>) => ({
    type: 'likert',
    label: 'Punctuality',
    scaleMax: 5,
    options: ['a', 'b'],
    optionScores: [5, 4],
    ...over,
  });

  test('a draft with no scored questions is fine', () => {
    expect(
      firstOptionScoreProblem([
        {
          title: 'S1',
          questions: [{ type: 'rating', label: 'Q', scaleMax: 5 }],
        },
      ])
    ).toBeNull();
  });

  test('a valid scored question is fine', () => {
    expect(
      firstOptionScoreProblem([{ title: 'S1', questions: [scored({})] }])
    ).toBeNull();
  });

  test('reports the first broken question and names it', () => {
    const problem = firstOptionScoreProblem([
      { title: 'S1', questions: [scored({})] },
      {
        title: 'S2',
        questions: [scored({ label: 'Grooming', optionScores: [3, 3] })],
      },
    ]);
    expect(problem).toMatch(/Grooming/);
    expect(problem).toMatch(/distinct/i);
  });

  test('an unlabelled question is still identifiable by position', () => {
    const problem = firstOptionScoreProblem([
      { title: 'S1', questions: [scored({ label: '', optionScores: [3, 3] })] },
    ]);
    expect(problem).toMatch(/question 1/i);
  });

  test('scores on a choice question are ignored here — nothing downstream reads them', () => {
    expect(
      firstOptionScoreProblem([
        {
          title: 'S1',
          questions: [scored({ type: 'choice', optionScores: [3, 3] })],
        },
      ])
    ).toBeNull();
  });
});

describe('syncScoredKeys', () => {
  test('grows the key list when options arrived from elsewhere', () => {
    const keys = syncScoredKeys([4, 9], 4);
    expect(keys.slice(0, 2)).toEqual([4, 9]);
    expect(new Set(keys).size).toBe(4);
  });

  test('shrinks to match, keeping the surviving keys', () => {
    expect(syncScoredKeys([4, 9, 11], 2)).toEqual([4, 9]);
  });

  test('an empty list seeds from zero', () => {
    expect(syncScoredKeys([], 2)).toEqual([0, 1]);
  });
});
