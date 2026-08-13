import { describe, it, expect } from 'vitest';
import {
  templatePositions,
  positionLabel,
  remainingForPosition,
  seatOptions,
  seatOptionToPosition,
  clampPositionCount,
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

describe('clampPositionCount', () => {
  it('keeps a count the server will accept', () => {
    expect(clampPositionCount(3)).toBe(3);
    expect(clampPositionCount('7')).toBe(7);
  });

  it('holds the ends of the range', () => {
    expect(clampPositionCount(1)).toBe(1);
    expect(clampPositionCount(20)).toBe(20);
  });

  it('pulls a count above the cap back to it', () => {
    // The editor's max attribute never fires — Save is an onClick, not a form
    // submit — so without this the admin gets a bare rejection toast instead.
    expect(clampPositionCount(50)).toBe(20);
  });

  it('floors a count below one, including a negative', () => {
    expect(clampPositionCount(0)).toBe(1);
    expect(clampPositionCount(-3)).toBe(1);
  });

  it('rounds a fraction rather than storing one', () => {
    expect(clampPositionCount(1.5)).toBe(2);
    expect(clampPositionCount(2.4)).toBe(2);
  });

  it('falls back to one for a cleared or nonsense field', () => {
    expect(clampPositionCount('')).toBe(1);
    expect(clampPositionCount('abc')).toBe(1);
    expect(clampPositionCount(undefined)).toBe(1);
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
