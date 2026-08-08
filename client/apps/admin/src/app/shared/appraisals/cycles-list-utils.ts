// shared/appraisals/cycles-list-utils.ts — the decisions behind the HR cycles
// list: how far through a cycle is, what the counters say, what a search
// matches, and what order the rows belong in.
//
// Same split as team-appraisals-utils / cycle-detail-utils: this app's vitest
// runs `environment: 'node'` with no jsdom, so components cannot be rendered
// and anything that can actually be WRONG has to be a pure function.
import type {
  AppraisalCycle,
  AppraisalState,
} from '@/services/appraisal.service';

/**
 * States in which the appraisal has reached the employee. Kept identical to
 * cycle-detail-utils' DONE_STATES on purpose: the percentage on a list row and
 * the percentage on that cycle's own page must be the same number, or HR sees
 * a cycle "change" by being opened.
 */
const DONE_STATES = new Set<string>(['released', 'acknowledged']);

/** Typed against AppraisalState so a rename of the state server-side fails the
 *  build here rather than silently stopping cancellations being excluded. */
const CANCELLED: AppraisalState = 'cancelled';

export interface CycleCompletion {
  /** Appraisals in the cycle, including cancelled ones. */
  total: number;
  /** Appraisals that have reached the employee. */
  done: number;
  /** In the cycle and not yet finished — what HR is actually working. */
  inFlight: number;
  cancelled: number;
  /**
   * `done / (total - cancelled)`, 0-100 and rounded.
   *
   * NULL, not 0, when there is nothing live to be a percentage OF. A cycle
   * nobody has launched is not 0% complete — it has not started, and a
   * 0%-wide bar claims work began and went nowhere.
   */
  pct: number | null;
}

/**
 * Roll a cycle's `byState` counts up into the numbers a list row shows.
 *
 * `cancelled` is excluded from the denominator rather than counted either way:
 * counting cancellations as outstanding makes a cycle with three of them
 * permanently incompletable, and counting them as done reports work that never
 * happened.
 */
export function cycleCompletion(
  byState: Record<string, number> | undefined
): CycleCompletion {
  let total = 0;
  let done = 0;
  let cancelled = 0;

  for (const [state, raw] of Object.entries(byState ?? {})) {
    // A count arriving as a non-number (or negative) would poison every total
    // downstream, and `NaN%` on a progress bar is worse than no bar at all.
    const count =
      typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 0;
    total += count;
    if (DONE_STATES.has(state)) done += count;
    if (state === CANCELLED) cancelled += count;
  }

  const live = total - cancelled;
  return {
    total,
    done,
    inFlight: live - done,
    cancelled,
    pct: live > 0 ? Math.round((done / live) * 100) : null,
  };
}

export interface CyclesSummary {
  total: number;
  draft: number;
  collecting: number;
  closed: number;
  cancelled: number;
}

/**
 * The headline counts for the summary tiles.
 *
 * Statuses are counted by name rather than by "everything that isn't closed",
 * so a status this bundle has never heard of lands in `total` and nowhere
 * else instead of being silently folded into one of the four.
 */
export function cyclesSummary(cycles: AppraisalCycle[]): CyclesSummary {
  const summary: CyclesSummary = {
    total: cycles.length,
    draft: 0,
    collecting: 0,
    closed: 0,
    cancelled: 0,
  };
  for (const c of cycles) {
    if (c.status === 'draft') summary.draft += 1;
    else if (c.status === 'collecting') summary.collecting += 1;
    else if (c.status === 'closed') summary.closed += 1;
    else if (c.status === 'cancelled') summary.cancelled += 1;
  }
  return summary;
}

export type CycleStatusFilter = 'all' | AppraisalCycle['status'];

/**
 * The status picker's options.
 *
 * All four statuses appear, not just the three with summary tiles: a status
 * with no way to filter to it is a set of rows HR simply cannot reach, and
 * `cancelled` is exactly that — rare enough not to earn a tile, real enough
 * that someone eventually goes looking for one.
 */
export const CYCLE_STATUS_FILTERS: ReadonlyArray<{
  value: CycleStatusFilter;
  label: string;
}> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'collecting', label: 'Collecting' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
];

/**
 * Search + status, applied together.
 *
 * The name is the only text a cycle has, so that is the whole haystack. Search
 * is a whitespace-split AND: typing "sales 2025" means the 2025 Sales cycle,
 * not every cycle containing either word.
 */
export function filterCycles(
  cycles: AppraisalCycle[],
  opts: { query?: string; status?: CycleStatusFilter } = {}
): AppraisalCycle[] {
  const status = opts.status ?? 'all';
  const terms = (opts.query ?? '').toLowerCase().split(/\s+/).filter(Boolean);

  return cycles.filter((c) => {
    if (status !== 'all' && c.status !== status) return false;
    if (terms.length === 0) return true;
    const haystack = (c.name ?? '').toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}

/**
 * Running cycles above finished ones.
 *
 * `collecting` is the only status with work in it right now, so it leads;
 * `draft` is next because it is one click from launching; `closed` and
 * `cancelled` are history and sink. Within a group the incoming order is
 * preserved (Array.sort is stable), which keeps the server's createdAt-desc —
 * HR relies on "the one I made this morning is at the top".
 */
const STATUS_PRIORITY: Record<string, number> = {
  collecting: 0,
  draft: 1,
  closed: 2,
  cancelled: 3,
};

/** Unknown statuses sort after every known one instead of producing a NaN
 *  comparison, which leaves Array.sort free to return any order at all. */
function priorityOf(status: string): number {
  const p = STATUS_PRIORITY[status];
  return typeof p === 'number' ? p : Number.MAX_SAFE_INTEGER;
}

export function sortCycles(cycles: AppraisalCycle[]): AppraisalCycle[] {
  return [...cycles].sort(
    (a, b) => priorityOf(a.status) - priorityOf(b.status)
  );
}
