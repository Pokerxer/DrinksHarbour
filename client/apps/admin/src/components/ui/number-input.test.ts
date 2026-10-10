import { describe, expect, it } from 'vitest';
import {
  numberInputChange,
  numberInputNormalize,
} from './number-input';

/**
 * Replays a keystroke sequence the way a controlled number field does: each
 * character is appended to whatever the box currently shows, and the number
 * committed on that keystroke is what the box will re-render from.
 *
 * This is the shape of the bug these functions exist to prevent. A field
 * driving its display off the committed number eats the `.`, because
 * `Number("89678.")` is 89678 — so the operator typing 89678.98 ends up
 * holding 8967898 no matter what `step` says.
 */
function typeInto(start: string, keys: string, bounds?: { min?: number; max?: number }) {
  let text = start;
  const committed: number[] = [];
  for (const key of keys) {
    text = text + key;
    const step = numberInputChange(text, bounds);
    text = step.text;
    if (step.commit !== null) {
      committed.push(step.commit);
      // A field whose display is driven by the committed number snaps back to
      // it, which is what loses the trailing dot.
      text = String(step.commit);
    }
  }
  return { text, committed };
}

describe('numberInputChange — the text is kept as typed', () => {
  it('keeps a trailing decimal point instead of snapping to a whole number', () => {
    const { text } = numberInputChange('89678.');
    expect(text).toBe('89678.');
  });

  it('keeps every intermediate step of typing 89678.98', () => {
    for (const [typed, expected] of [
      ['8', '8'],
      ['89', '89'],
      ['896', '896'],
      ['8967', '8967'],
      ['89678', '89678'],
      ['89678.', '89678.'],
      ['89678.9', '89678.9'],
      ['89678.98', '89678.98'],
    ] as const) {
      expect(numberInputChange(typed).text, typed).toBe(expected);
    }
  });

  it('commits the parsed number on every parseable keystroke', () => {
    expect(numberInputChange('89678').commit).toBe(89678);
    expect(numberInputChange('89678.9').commit).toBe(89678.9);
    expect(numberInputChange('89678.98').commit).toBe(89678.98);
  });

  it('commits nothing for an empty or unparseable field, so it can be cleared', () => {
    expect(numberInputChange('')).toEqual({ text: '', commit: null });
    expect(numberInputChange('   ').commit).toBeNull();
    expect(numberInputChange('abc').commit).toBeNull();
  });

  it('handles a leading decimal point and a bare minus sign', () => {
    expect(numberInputChange('0.').text).toBe('0.');
    expect(numberInputChange('-').commit).toBeNull();
    expect(numberInputChange('-5.25').commit).toBe(-5.25);
  });
});

describe('numberInputChange — bounds', () => {
  it('clamps a committed value to min without hiding what was typed', () => {
    const r = numberInputChange('-4', { min: 0 });
    expect(r.commit).toBe(0);
    // The text is still what the operator typed; only the commit is clamped.
    expect(r.text).toBe('-4');
  });

  it('clamps to max', () => {
    expect(numberInputChange('150', { min: 0, max: 100 }).commit).toBe(100);
  });

  it('leaves a decimal inside the bounds alone', () => {
    expect(numberInputChange('7.5', { min: 0, max: 100 }).commit).toBe(7.5);
  });
});

describe('typing 89678.98 through the field', () => {
  it('a value-driven display loses the decimal point and yields 8967898', () => {
    // The regression, pinned so it cannot come back: this is what
    // `value={n} onChange={Number(...)}` does, and it is the reason decimals
    // were impossible regardless of `step`.
    const naive = typeInto('', '89678.98', { min: 0 });
    expect(naive.text).toBe('8967898');
    expect(naive.committed.at(-1)).toBe(8967898);
  });

  it('the component keeps its own text, so every keystroke lands', () => {
    // The fix: text is local and is never replaced by the committed number
    // mid-typing, so the trailing dot survives and 89678.98 is reachable.
    let text = '';
    for (const key of '89678.98') {
      text = numberInputChange(text + key, { min: 0 }).text;
    }
    expect(text).toBe('89678.98');
  });
});

describe('numberInputNormalize — on blur / Enter', () => {
  it('commits the pending decimal and clears the trailing dot', () => {
    const r = numberInputNormalize('89678.', { min: 0 });
    expect(r.commit).toBe(89678);
    expect(r.text).toBe('89678');
  });

  it('commits a fully typed decimal as-is', () => {
    expect(numberInputNormalize('89678.98', { min: 0 })).toEqual({
      text: '89678.98',
      commit: 89678.98,
    });
  });

  it('falls back when the field was emptied', () => {
    expect(numberInputNormalize('', { min: 0 })).toEqual({ text: '0', commit: 0 });
    expect(numberInputNormalize('', { min: 1 })).toEqual({ text: '1', commit: 1 });
    expect(numberInputNormalize('', {}, 7)).toEqual({ text: '7', commit: 7 });
  });

  it('falls back when the field holds unparseable text', () => {
    expect(numberInputNormalize('abc', { min: 2 }).commit).toBe(2);
  });

  it('re-clamps on blur so a value typed before a lower min is corrected', () => {
    expect(numberInputNormalize('-3', { min: 0 })).toEqual({ text: '0', commit: 0 });
  });

  it('rounds no further than the double holds', () => {
    // 0.1 + 0.2 territory: normalize must not introduce drift of its own.
    expect(numberInputNormalize('0.1', { min: 0 }).commit).toBe(0.1);
    expect(numberInputNormalize('1234567.89', { min: 0 }).commit).toBe(1234567.89);
  });
});
