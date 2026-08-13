import { describe, it, expect } from 'vitest';
import {
  templatePositions,
  positionLabel,
  remainingForPosition,
  seatOptions,
  seatOptionToPosition,
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
    expect(templatePositions(crew)).toEqual([
      { _id: 'p1', roles: ['r1', 'r2'], count: 1 },
      { _id: 'p2', roles: ['r3'], count: 2 },
    ]);
  });

  it('is empty for a template with neither positions nor a role', () => {
    expect(templatePositions({ positions: [] } as never)).toEqual([]);
  });

  it('drops a position that no longer accepts any role', () => {
    // A role deleted out from under a position leaves it unfillable. The
    // server's templatePositions filters it the same way.
    expect(
      templatePositions({
        role: 'r1',
        positions: [
          { _id: 'p1', roles: [], count: 2 },
          { _id: 'p2', roles: ['r3'], count: 1 },
        ],
      } as never)
    ).toEqual([{ _id: 'p2', roles: ['r3'], count: 1 }]);
  });

  it('clamps a missing or nonsense count up to 1', () => {
    expect(
      templatePositions({
        positions: [
          { _id: 'p1', roles: ['r1'], count: 0 },
          { _id: 'p2', roles: ['r2'], count: undefined },
        ],
      } as never)
    ).toEqual([
      { _id: 'p1', roles: ['r1'], count: 1 },
      { _id: 'p2', roles: ['r2'], count: 1 },
    ]);
  });

  it('reads a role that arrived populated rather than as a bare id', () => {
    expect(
      templatePositions({
        positions: [{ _id: 'p1', roles: [{ _id: 'r1', name: 'Bartender' }], count: 1 }],
      } as never)
    ).toEqual([{ _id: 'p1', roles: ['r1'], count: 1 }]);
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

describe('a seat built from a seatOptions value', () => {
  // The seam that bites: a legacy template's position id is genuinely null,
  // but a <select> value is always a string, so it arrives as ''. Compared
  // with === against a null _id it never matches, and the drawer would report
  // the position open no matter how many people were on it.
  const legacy = { role: 'r1', positions: [] } as never;

  it('maps the legacy position back to null, not the empty string', () => {
    const [option] = seatOptions(legacy, [], roleNames);
    expect(option.value).toBe('');
    expect(seatOptionToPosition(option.value)).toBeNull();
  });

  it('leaves a real position id alone', () => {
    expect(seatOptionToPosition('p2')).toBe('p2');
  });

  it('counts against the legacy position once mapped back', () => {
    const [option] = seatOptions(legacy, [], roleNames);
    const seats = [{ employee: 'a', position: seatOptionToPosition(option.value) }];
    expect(seatOptions(legacy, seats, roleNames)[0]).toEqual({
      value: '',
      label: 'Bartender (full)',
      remaining: 0,
      full: true,
    });
  });

  it('would NOT count if the empty string were stored raw', () => {
    // Guards the contract itself: if someone drops seatOptionToPosition, this
    // is the behaviour they get back.
    const seats = [{ employee: 'a', position: '' }];
    expect(seatOptions(legacy, seats, roleNames)[0].remaining).toBe(1);
  });
});
