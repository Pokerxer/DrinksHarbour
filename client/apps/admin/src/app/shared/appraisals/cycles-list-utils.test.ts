import { describe, expect, it } from 'vitest';
import {
  CYCLE_STATUS_FILTERS,
  cycleCompletion,
  cyclesSummary,
  filterCycles,
  sortCycles,
} from './cycles-list-utils';
import type { AppraisalCycle } from '@/services/appraisal.service';

const cycle = (
  id: string,
  status: AppraisalCycle['status'],
  over: Partial<AppraisalCycle> = {}
): AppraisalCycle => ({
  _id: id,
  name: over.name ?? `Cycle ${id}`,
  status,
  peerReviewEnabled: true,
  ...over,
});

// ---------------------------------------------------------------------------
// cycleCompletion
// ---------------------------------------------------------------------------
describe('cycleCompletion', () => {
  it('counts released and acknowledged as done', () => {
    // `released` counts: the work of the cycle is finished at that point, and
    // whether the employee has clicked acknowledge is separate, much smaller
    // chasing. Same rule as cycleStats on the detail page.
    const c = cycleCompletion({ released: 2, acknowledged: 1, collecting: 1 });
    expect(c.done).toBe(3);
    expect(c.total).toBe(4);
    expect(c.inFlight).toBe(1);
  });

  it('takes cancelled out of the denominator instead of counting it either way', () => {
    // Counting cancellations as outstanding makes a cycle permanently
    // incompletable; counting them as done reports work that never happened.
    const c = cycleCompletion({ released: 1, cancelled: 1 });
    expect(c.cancelled).toBe(1);
    expect(c.pct).toBe(100);
    expect(c.inFlight).toBe(0);
  });

  it('is null percent when there is nothing to be a percentage of', () => {
    // A 0%-wide bar claims work started and went nowhere. A cycle nobody has
    // launched has not started at all, which is a different thing.
    expect(cycleCompletion({}).pct).toBeNull();
    expect(cycleCompletion(undefined).pct).toBeNull();
    expect(cycleCompletion({ cancelled: 3 }).pct).toBeNull();
  });

  it('reports zero percent once there IS live work, none of it done', () => {
    expect(cycleCompletion({ collecting: 4 }).pct).toBe(0);
  });

  it('ignores counts that are not positive numbers', () => {
    // A count arriving as a string or a negative would poison every total and
    // put NaN% on a progress bar, which is worse than no bar.
    const c = cycleCompletion({
      released: 2,
      collecting: -1,
      draft: 'three' as unknown as number,
      summarising: Number.NaN,
    });
    expect(c.total).toBe(2);
    expect(c.pct).toBe(100);
  });

  it('rounds rather than trailing decimals across a row of bars', () => {
    expect(cycleCompletion({ released: 1, collecting: 2 }).pct).toBe(33);
  });
});

// ---------------------------------------------------------------------------
// cyclesSummary
// ---------------------------------------------------------------------------
describe('cyclesSummary', () => {
  it('counts each status independently of the others', () => {
    const rows = [
      cycle('1', 'collecting'),
      cycle('2', 'collecting'),
      cycle('3', 'draft'),
      cycle('4', 'closed'),
      cycle('5', 'cancelled'),
    ];
    expect(cyclesSummary(rows)).toEqual({
      total: 5,
      draft: 1,
      collecting: 2,
      closed: 1,
      cancelled: 1,
    });
  });

  it('is all zeroes for a tenant with no cycles', () => {
    expect(cyclesSummary([])).toEqual({
      total: 0,
      draft: 0,
      collecting: 0,
      closed: 0,
      cancelled: 0,
    });
  });

  it('does not miscount a status it does not know about', () => {
    const rows = [cycle('1', 'archived' as AppraisalCycle['status'])];
    const s = cyclesSummary(rows);
    expect(s.total).toBe(1);
    expect(s.draft + s.collecting + s.closed + s.cancelled).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// filterCycles
// ---------------------------------------------------------------------------
describe('filterCycles', () => {
  const rows = [
    cycle('1', 'collecting', { name: 'Sales H1 2026' }),
    cycle('2', 'draft', { name: 'Ops H2 2026' }),
    cycle('3', 'closed', { name: 'Sales H2 2025' }),
    cycle('4', 'cancelled', { name: 'Pilot run' }),
  ];

  it('returns everything by default', () => {
    expect(filterCycles(rows)).toHaveLength(4);
    expect(filterCycles(rows, { status: 'all' })).toHaveLength(4);
  });

  it('narrows to one status', () => {
    expect(filterCycles(rows, { status: 'collecting' }).map((c) => c._id)).toEqual(['1']);
    expect(filterCycles(rows, { status: 'cancelled' }).map((c) => c._id)).toEqual(['4']);
  });

  it('matches the cycle name case-insensitively', () => {
    expect(filterCycles(rows, { query: 'SALES' }).map((c) => c._id)).toEqual(['1', '3']);
  });

  it('ANDs the search terms rather than ORing them', () => {
    // "sales 2025" must not match the 2026 Sales cycle just because "sales" hit.
    expect(filterCycles(rows, { query: 'sales 2025' }).map((c) => c._id)).toEqual(['3']);
    expect(filterCycles(rows, { query: 'ops sales' })).toEqual([]);
  });

  it('ignores padding around the query', () => {
    expect(filterCycles(rows, { query: '   pilot  ' }).map((c) => c._id)).toEqual(['4']);
  });

  it('applies status and query together', () => {
    expect(filterCycles(rows, { status: 'closed', query: 'sales' }).map((c) => c._id))
      .toEqual(['3']);
    expect(filterCycles(rows, { status: 'draft', query: 'sales' })).toEqual([]);
  });

  it('does not mutate its input', () => {
    const input = [...rows];
    filterCycles(input, { status: 'draft' });
    expect(input).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// sortCycles
// ---------------------------------------------------------------------------
describe('sortCycles', () => {
  it('puts the cycles that are running above the ones that are finished', () => {
    const rows = [
      cycle('closed', 'closed'),
      cycle('cancelled', 'cancelled'),
      cycle('collecting', 'collecting'),
      cycle('draft', 'draft'),
    ];
    expect(sortCycles(rows).map((c) => c._id)).toEqual([
      'collecting',
      'draft',
      'closed',
      'cancelled',
    ]);
  });

  it('keeps the server order (newest first) inside a status group', () => {
    // The server already sorts createdAt-desc. Re-sorting must not scramble
    // that, or HR loses "the one I made this morning is at the top".
    const rows = [
      cycle('newest', 'collecting'),
      cycle('middle', 'collecting'),
      cycle('oldest', 'collecting'),
    ];
    expect(sortCycles(rows).map((c) => c._id)).toEqual([
      'newest',
      'middle',
      'oldest',
    ]);
  });

  it('sorts an unknown status last instead of scrambling the list', () => {
    // A NaN comparison leaves Array.sort free to return any order at all.
    const rows = [
      cycle('weird', 'archived' as AppraisalCycle['status']),
      cycle('collecting', 'collecting'),
      cycle('closed', 'closed'),
    ];
    expect(sortCycles(rows).map((c) => c._id)).toEqual([
      'collecting',
      'closed',
      'weird',
    ]);
  });

  it('does not mutate its input', () => {
    const rows = [cycle('closed', 'closed'), cycle('live', 'collecting')];
    sortCycles(rows);
    expect(rows.map((c) => c._id)).toEqual(['closed', 'live']);
  });
});

describe('CYCLE_STATUS_FILTERS', () => {
  it('offers every status a cycle can actually be in, plus all', () => {
    // A status with no way to filter to it is a set of rows HR cannot reach —
    // cancelled has no summary tile, so it has to be in this list.
    expect(CYCLE_STATUS_FILTERS.map((o) => o.value)).toEqual([
      'all',
      'draft',
      'collecting',
      'closed',
      'cancelled',
    ]);
  });
});
