import { describe, expect, test } from 'vitest';
import {
  isScoredOptions,
  scoredOptionLabel,
  answerForScoredOption,
  shuffledScoredOptions,
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

// ── Shuffling the anchors ──────────────────────────────────────────────────
// Authored best-first (5/4/3/2/1) and rendered in that order, "the top one is
// the good one" is learnable in about four questions and the sheet stops
// measuring anything. These assert the four properties that make a shuffle
// safe: it pairs, it covers, it is stable, and it varies.
describe('shuffledScoredOptions', () => {
  const orderOf = (pairs: { label: string; score: number }[]) =>
    pairs.map((p) => p.score);

  test('carries the label and its score together, never the labels alone', () => {
    const pairs = shuffledScoredOptions(punctuality, 'fb1');
    for (const { label, score } of pairs) {
      const authored = punctuality.options!.indexOf(label);
      expect(punctuality.optionScores![authored]).toBe(score);
    }
  });

  test('renders every option exactly once', () => {
    const pairs = shuffledScoredOptions(punctuality, 'fb1');
    expect(pairs).toHaveLength(5);
    expect([...pairs.map((p) => p.label)].sort()).toEqual(
      [...punctuality.options!].sort()
    );
    expect([...orderOf(pairs)].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test('is stable for one rater and question across repeated calls', () => {
    // Re-randomising on re-render moves the option out from under the cursor
    // and changes which anchor a half-made click lands on.
    const first = orderOf(shuffledScoredOptions(punctuality, 'fb1'));
    for (let i = 0; i < 20; i++) {
      expect(orderOf(shuffledScoredOptions(punctuality, 'fb1'))).toEqual(first);
    }
  });

  test('gives different questions different orders', () => {
    const orders = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'].map((id) =>
      orderOf(
        shuffledScoredOptions(
          { ...punctuality, _id: id } as AppraisalQuestion,
          'fb1'
        )
      ).join()
    );
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  test('gives two raters of the same question different orders', () => {
    // Salted per feedback row, so the manager cannot pattern-match positions
    // against the self sheet, and the anchors are not learnable from a
    // colleague's screen.
    const orders = ['fb1', 'fb2', 'fb3', 'fb4', 'fb5', 'fb6'].map((salt) =>
      orderOf(shuffledScoredOptions(punctuality, salt)).join()
    );
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  test('does not shuffle a question whose scores do not pair', () => {
    // Same safe failure as isScoredOptions: fall back to the authored order
    // rather than render buttons mapped to undefined.
    const broken = {
      ...punctuality,
      optionScores: [5, 4],
    } as unknown as AppraisalQuestion;
    expect(shuffledScoredOptions(broken, 'fb1')).toEqual([]);
  });

  test('is unaffected by a missing salt rather than throwing', () => {
    const pairs = shuffledScoredOptions(punctuality, '');
    expect([...orderOf(pairs)].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

// A shuffle that varies is not automatically a shuffle that is unlearnable.
// The first implementation here passed every test above while putting the
// WORST anchor first 49% of the time and reaching only 20 of the 120 possible
// orders — a bias a rater would pick up faster than the best-first order it
// replaced. The cause was hashing a key whose only varying part was its last
// character, which FNV-1a alone does not avalanche. These pin the property
// that actually matters, so no future change to the hash can quietly undo it.
describe('shuffledScoredOptions is not learnable', () => {
  // Deterministic stand-ins for ObjectIds — a fixed seed keeps this test from
  // flaking while still sampling a realistic spread of ids.
  const ids = (n: number, prefix: string) => {
    const out: string[] = [];
    let x = 123456789;
    for (let i = 0; i < n; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      out.push(`${prefix}${x.toString(16).padStart(8, '0')}${i}`);
    }
    return out;
  };

  const SAMPLE = 4000;
  const orders = ids(SAMPLE, 'q').map((id) =>
    shuffledScoredOptions({ ...punctuality, _id: id } as AppraisalQuestion, 'fb1')
  );

  test('spreads across most of the possible orders', () => {
    const distinct = new Set(orders.map((o) => o.map((p) => p.score).join()));
    expect(distinct.size).toBeGreaterThan(100); // of 5! = 120
  });

  test('puts no single anchor in the first slot disproportionately', () => {
    // The top slot is the one that matters: it is the position a rater
    // skimming a long sheet reads first and clicks by habit.
    const counts = new Map<number, number>();
    for (const o of orders) counts.set(o[0].score, (counts.get(o[0].score) ?? 0) + 1);
    for (const n of Array.from(counts.values())) {
      expect(n / SAMPLE).toBeLessThan(0.3); // uniform is 0.2
      expect(n / SAMPLE).toBeGreaterThan(0.1);
    }
  });

  test('puts no single anchor in any fixed slot disproportionately', () => {
    for (let slot = 0; slot < 5; slot++) {
      const counts = new Map<number, number>();
      for (const o of orders)
        counts.set(o[slot].score, (counts.get(o[slot].score) ?? 0) + 1);
      expect(counts.size).toBe(5);
      for (const n of Array.from(counts.values()))
        expect(n / SAMPLE).toBeLessThan(0.3);
    }
  });
});
