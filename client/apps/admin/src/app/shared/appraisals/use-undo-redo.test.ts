import { describe, expect, it } from 'vitest';
import { reducer, type History } from './use-undo-redo';

const start = (present: string): History<string> => ({
  past: [],
  present,
  future: [],
});

const set = (max = 50) =>
  ({ type: 'set', next: 'x', maxHistory: max }) as const;

describe('undo/redo reducer', () => {
  it('records the previous value and clears the redo branch on set', () => {
    const s = reducer(start('a'), {
      type: 'set',
      next: 'b',
      maxHistory: 50,
    });
    expect(s).toEqual({ past: ['a'], present: 'b', future: [] });
  });

  it('accepts an updater function, resolved against the present', () => {
    const s = reducer(start('a'), {
      type: 'set',
      next: (prev: string) => `${prev}b`,
      maxHistory: 50,
    });
    expect(s.present).toBe('ab');
    expect(s.past).toEqual(['a']);
  });

  /**
   * The bug this hook shipped with: history was pushed from inside a
   * `setState` updater, so React's development double-invoke recorded one
   * edit twice and the first Cmd+Z did nothing visible. Applying the same
   * action to the same state twice is exactly that scenario, and a pure
   * transition makes it a no-op the second time.
   */
  it('is idempotent — replaying one action does not double-record', () => {
    const once = reducer(start('a'), {
      type: 'set',
      next: 'b',
      maxHistory: 50,
    });
    const twice = reducer(start('a'), {
      type: 'set',
      next: 'b',
      maxHistory: 50,
    });
    expect(twice).toEqual(once);
    expect(twice.past).toHaveLength(1);
  });

  it('ignores a set that resolves to the identical reference', () => {
    const base = start('a');
    const s = reducer(base, { type: 'set', next: 'a', maxHistory: 50 });
    expect(s).toBe(base);
    expect(s.past).toHaveLength(0);
  });

  it('undo moves the present back and makes it redoable', () => {
    let s = reducer(start('a'), { type: 'set', next: 'b', maxHistory: 50 });
    s = reducer(s, { type: 'undo' });
    expect(s).toEqual({ past: [], present: 'a', future: ['b'] });
    s = reducer(s, { type: 'redo' });
    expect(s).toEqual({ past: ['a'], present: 'b', future: [] });
  });

  it('undo and redo are no-ops at the ends of the history', () => {
    const base = start('a');
    expect(reducer(base, { type: 'undo' })).toBe(base);
    expect(reducer(base, { type: 'redo' })).toBe(base);
  });

  it('preserves order across a multi-step undo walk', () => {
    let s: History<string> = start('a');
    for (const next of ['b', 'c', 'd']) {
      s = reducer(s, { type: 'set', next, maxHistory: 50 });
    }
    expect(s.past).toEqual(['a', 'b', 'c']);
    s = reducer(s, { type: 'undo' });
    s = reducer(s, { type: 'undo' });
    expect(s.present).toBe('b');
    expect(s.future).toEqual(['c', 'd']);
  });

  it('a new edit after an undo discards the redo branch', () => {
    let s = reducer(start('a'), { type: 'set', next: 'b', maxHistory: 50 });
    s = reducer(s, { type: 'undo' });
    expect(s.future).toEqual(['b']);
    s = reducer(s, { type: 'set', next: 'c', maxHistory: 50 });
    expect(s.future).toEqual([]);
    expect(s.present).toBe('c');
  });

  it('caps history at maxHistory, dropping the oldest entries', () => {
    let s: History<number> = { past: [], present: 0, future: [] };
    for (let i = 1; i <= 10; i += 1) {
      s = reducer(s, { type: 'set', next: i, maxHistory: 3 });
    }
    expect(s.past).toHaveLength(3);
    expect(s.past).toEqual([7, 8, 9]);
    expect(s.present).toBe(10);
  });

  /**
   * Loading a saved template into an editor that is already showing a blank
   * draft. Through `set` the blank draft becomes an undoable state, so the
   * first Cmd+Z on a freshly-opened form replaced it with an empty one.
   */
  it('reset seeds a new baseline and discards the history', () => {
    let s = reducer(start('blank'), {
      type: 'set',
      next: 'edited',
      maxHistory: 50,
    });
    s = reducer(s, { type: 'reset', next: 'loaded-from-server' });
    expect(s).toEqual({
      past: [],
      present: 'loaded-from-server',
      future: [],
    });
    expect(reducer(s, { type: 'undo' })).toBe(s);
  });

  it('never mutates the state it is given', () => {
    const base: History<string> = { past: ['a'], present: 'b', future: ['c'] };
    const snapshot = structuredClone(base);
    reducer(base, set());
    reducer(base, { type: 'undo' });
    reducer(base, { type: 'redo' });
    reducer(base, { type: 'reset', next: 'z' });
    expect(base).toEqual(snapshot);
  });
});
