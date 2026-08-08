import { describe, it, expect } from 'vitest';
import {
  activeFilterParam,
  headcountStatus,
  sortOrgRows,
  isDuplicateName,
  buildLabelMap,
  labelFor,
} from './org-config-utils';

const row = (over: Partial<Parameters<typeof sortOrgRows>[0][number]> = {}) => ({
  name: 'A',
  employeeCount: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('activeFilterParam', () => {
  it('omits the param for "all" so the API returns both', () => {
    expect(activeFilterParam('all')).toBeUndefined();
    expect(activeFilterParam('active')).toBe(true);
    expect(activeFilterParam('inactive')).toBe(false);
  });
});

describe('headcountStatus', () => {
  it('treats a zero target as "no target set", not as over-staffed', () => {
    // expectedHeadcount defaults to 0 on every position; reading that as a real
    // target would flag every un-configured position as over-staffed.
    expect(headcountStatus(3, 0).tone).toBe('unset');
    expect(headcountStatus(3, 0).label).toBe('3 people');
  });

  it('singularises a headcount of one', () => {
    expect(headcountStatus(1, 0).label).toBe('1 person');
  });

  it('reports the gap when under target', () => {
    const r = headcountStatus(2, 5);
    expect(r.tone).toBe('under');
    expect(r.label).toContain('3 to hire');
  });

  it('reports the excess when over target', () => {
    const r = headcountStatus(7, 5);
    expect(r.tone).toBe('over');
    expect(r.label).toContain('2 over');
  });

  it('reports met exactly on target', () => {
    expect(headcountStatus(5, 5).tone).toBe('met');
  });
});

describe('sortOrgRows', () => {
  it('does not mutate the input array', () => {
    const rows = [row({ name: 'B' }), row({ name: 'A' })];
    const before = [...rows];
    sortOrgRows(rows, 'name');
    expect(rows).toEqual(before);
  });

  it('sorts by name by default', () => {
    const out = sortOrgRows([row({ name: 'Sales' }), row({ name: 'Admin' })], 'name');
    expect(out.map((r) => r.name)).toEqual(['Admin', 'Sales']);
  });

  it('sorts by headcount descending, breaking ties by name', () => {
    const out = sortOrgRows(
      [
        row({ name: 'B', employeeCount: 2 }),
        row({ name: 'A', employeeCount: 2 }),
        row({ name: 'C', employeeCount: 9 }),
      ],
      'employees'
    );
    expect(out.map((r) => r.name)).toEqual(['C', 'A', 'B']);
  });

  it('sorts by newest first and tolerates a missing createdAt', () => {
    const out = sortOrgRows(
      [
        row({ name: 'old', createdAt: '2020-01-01T00:00:00.000Z' }),
        row({ name: 'new', createdAt: '2026-06-01T00:00:00.000Z' }),
        row({ name: 'none', createdAt: undefined }),
      ],
      'recent'
    );
    expect(out.map((r) => r.name)).toEqual(['new', 'old', 'none']);
  });
});

describe('isDuplicateName', () => {
  const rows = [
    { _id: '1', name: 'Sales' },
    { _id: '2', name: 'Front  Desk' },
  ];

  it('matches ignoring case and collapsed whitespace', () => {
    expect(isDuplicateName('  sales ', rows)).toBe(true);
    expect(isDuplicateName('Front Desk', rows)).toBe(true);
  });

  it('does not flag a row against itself while editing', () => {
    expect(isDuplicateName('Sales', rows, '1')).toBe(false);
  });

  it('treats an empty name as not a duplicate (required-field handles it)', () => {
    expect(isDuplicateName('   ', rows)).toBe(false);
  });
});

describe('buildLabelMap / labelFor', () => {
  it('resolves an id to its name', () => {
    const map = buildLabelMap([{ _id: 'a1', name: 'Sales' }]);
    expect(labelFor('a1', map)).toBe('Sales');
  });

  it('renders an em dash for an unset ref and "Unknown" for a missing one', () => {
    const map = buildLabelMap([]);
    expect(labelFor(null, map)).toBe('—');
    expect(labelFor('', map)).toBe('—');
    expect(labelFor('gone', map)).toBe('Unknown');
  });
});
