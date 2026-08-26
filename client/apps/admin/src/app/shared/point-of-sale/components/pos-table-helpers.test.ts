import { describe, expect, it } from 'vitest';
import {
  groupTablesBySection,
  tabElapsedLabel,
  tableStatusClasses,
} from './pos-table-helpers';
import type { POSTableSummary } from '../types';

function table(over: Partial<POSTableSummary> = {}): POSTableSummary {
  return {
    _id: over._id ?? Math.random().toString(36).slice(2),
    name: 'T1',
    section: 'Main',
    seats: 4,
    sortOrder: 0,
    status: 'available',
    currentTabId: null,
    tab: null,
    ...over,
  };
}

describe('groupTablesBySection', () => {
  it('sorts by sortOrder then name inside each section', () => {
    const tables = [
      table({ _id: 'b', name: 'T2', sortOrder: 1 }),
      table({ _id: 'a', name: 'T10', sortOrder: 1 }),
      table({ _id: 'c', name: 'T3', sortOrder: 2 }),
      table({ _id: 'd', name: 'T0', sortOrder: 0 }),
    ];

    const groups = groupTablesBySection(tables);

    expect(groups).toHaveLength(1);
    expect(groups[0].section).toBe('Main');
    expect(groups[0].tables.map((t) => t.name)).toEqual([
      'T0',
      'T10',
      'T2',
      'T3',
    ]);
  });

  it('buckets empty and missing sections under "Main"', () => {
    const groups = groupTablesBySection([
      table({ name: 'A', section: '' }),
      table({ name: 'B' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].section).toBe('Main');
    expect(groups[0].tables.map((t) => t.name)).toEqual(['A', 'B']);
  });

  it('orders sections by first appearance of the globally sorted list', () => {
    const groups = groupTablesBySection([
      // Global sort puts Patio's T9 (sortOrder 5) after Main's pair, so Patio
      // must appear second even though "Patio" sorts before "Bar" alphabetically.
      table({ name: 'T9', section: 'Patio', sortOrder: 5 }),
      table({ name: 'B1', section: 'Bar', sortOrder: 2 }),
      table({ name: 'M1', section: 'Main', sortOrder: 1 }),
      table({ name: 'M2', section: 'Main', sortOrder: 6 }),
      table({ name: 'B2', section: 'Bar', sortOrder: 7 }),
    ]);

    expect(groups.map((g) => g.section)).toEqual(['Main', 'Bar', 'Patio']);
    expect(groups[1].tables.map((t) => t.name)).toEqual(['B1', 'B2']);
  });

  it('does not mutate the array it is given', () => {
    const tables = [table({ name: 'B', sortOrder: 2 }), table({ name: 'A', sortOrder: 1 })];
    groupTablesBySection(tables);
    expect(tables.map((t) => t.name)).toEqual(['B', 'A']);
  });
});

describe('tabElapsedLabel', () => {
  const now = new Date('2026-08-26T18:00:00Z');

  it('returns empty for a tab with no open time', () => {
    expect(tabElapsedLabel(undefined, now)).toBe('');
    expect(tabElapsedLabel('', now)).toBe('');
  });

  it('shows whole minutes under an hour', () => {
    expect(tabElapsedLabel('2026-08-26T17:48:00Z', now)).toBe('12m');
  });

  it('pads the minute part once hours are showing', () => {
    expect(tabElapsedLabel('2026-08-26T16:55:00Z', now)).toBe('1h 05m');
  });

  it('floors partial minutes', () => {
    expect(tabElapsedLabel('2026-08-26T17:59:30Z', now)).toBe('0m');
  });

  it('clamps a future open time to zero rather than going negative', () => {
    expect(tabElapsedLabel('2026-08-26T18:05:00Z', now)).toBe('0m');
  });
});

describe('tableStatusClasses', () => {
  it('paints occupied tables red', () => {
    expect(tableStatusClasses('occupied')).toBe(
      'border-red-300 bg-red-50 text-red-700'
    );
  });

  it('paints reserved tables amber', () => {
    expect(tableStatusClasses('reserved')).toBe(
      'border-amber-300 bg-amber-50 text-amber-700'
    );
  });

  it('greys inactive tables out', () => {
    expect(tableStatusClasses('inactive')).toBe(
      'border-gray-200 bg-gray-100 text-gray-400 opacity-60'
    );
  });

  it('leaves available tables white with the brand hover', () => {
    expect(tableStatusClasses('available')).toBe(
      'border-gray-200 bg-white text-gray-700 hover:border-[#b20202] hover:text-[#b20202]'
    );
  });
});
