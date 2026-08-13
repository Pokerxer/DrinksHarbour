import { describe, it, expect } from 'vitest';
import {
  templatePositions,
  positionLabel,
  remainingForPosition,
  seatOptions,
} from './shift-position-utils';

const roleNames = new Map([
  ['r1', 'Bartender'],
  ['r2', 'Barback'],
  ['r3', 'Server'],
]);

const crew = {
  role: 'r1',
  positions: [
    { _id: 'p1', roles: ['r1', 'r2'], count: 1 },
    { _id: 'p2', roles: ['r3'], count: 2 },
  ],
} as never;

describe('templatePositions', () => {
  it('normalises a legacy single-role template', () => {
    expect(templatePositions({ role: 'r1', positions: [] } as never)).toEqual([
      { _id: null, roles: ['r1'], count: 1 },
    ]);
  });

  it('passes real positions through', () => {
    expect(templatePositions(crew)).toHaveLength(2);
  });
});

describe('positionLabel', () => {
  it('names a single role with its count', () => {
    expect(positionLabel({ _id: 'p2', roles: ['r3'], count: 2 }, roleNames)).toBe('Server ×2');
  });

  it('joins alternatives with "or" and omits a count of one', () => {
    expect(positionLabel({ _id: 'p1', roles: ['r1', 'r2'], count: 1 }, roleNames)).toBe(
      'Bartender or Barback'
    );
  });

  it('falls back for a role that has been deleted', () => {
    expect(positionLabel({ _id: 'p9', roles: ['gone'], count: 1 }, roleNames)).toBe('Role removed');
  });
});

describe('remainingForPosition', () => {
  const positions = templatePositions(crew);

  it('is the full count when nobody is seated', () => {
    expect(remainingForPosition(positions[1], [])).toBe(2);
  });

  it('drops by one per seat already taken', () => {
    expect(remainingForPosition(positions[1], [{ employee: 'a', position: 'p2' }])).toBe(1);
  });

  it('never goes below zero', () => {
    const seats = [
      { employee: 'a', position: 'p1' },
      { employee: 'b', position: 'p1' },
    ];
    expect(remainingForPosition(positions[0], seats)).toBe(0);
  });
});

describe('seatOptions', () => {
  it('shows what is left against each position', () => {
    const out = seatOptions(crew, [{ employee: 'a', position: 'p2' }], roleNames);
    expect(out).toEqual([
      { value: 'p1', label: 'Bartender or Barback', remaining: 1, full: false },
      { value: 'p2', label: 'Server ×2 (1 left)', remaining: 1, full: false },
    ]);
  });

  it('marks a position full rather than hiding it', () => {
    const out = seatOptions(crew, [{ employee: 'a', position: 'p1' }], roleNames);
    expect(out[0]).toEqual({
      value: 'p1',
      label: 'Bartender or Barback (full)',
      remaining: 0,
      full: true,
    });
  });
});
