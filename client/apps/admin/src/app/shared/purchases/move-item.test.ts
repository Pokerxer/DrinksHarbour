import { describe, it, expect } from 'vitest';
import { moveItem } from './line-dnd';

describe('moveItem', () => {
  const lines = ['a', 'b', 'c', 'd'];

  it('moves an item forward', () => {
    expect(moveItem(lines, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item backward', () => {
    expect(moveItem(lines, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('returns the same order for a no-op drag', () => {
    expect(moveItem(lines, 2, 2)).toEqual(lines);
  });

  it('ignores out-of-bounds indexes instead of corrupting the list', () => {
    expect(moveItem(lines, -1, 2)).toEqual(lines);
    expect(moveItem(lines, 1, 9)).toEqual(lines);
    expect(moveItem(lines, 9, 0)).toEqual(lines);
  });

  it('does not mutate the source array', () => {
    const copy = [...lines];
    moveItem(lines, 0, 3);
    expect(lines).toEqual(copy);
  });
});
