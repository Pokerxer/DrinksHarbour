// shared/appraisals/team-appraisals-utils.ts — the DECISIONS behind the
// manager's team list: what each state asks of THIS manager, what order the
// rows belong in, what the counters say, and what a search matches.
//
// Same split as review-answer-utils / review-form-utils: this app's vitest
// runs `environment: 'node'` with no jsdom, so the rules that can actually be
// wrong live here as pure functions and team-appraisals.tsx stays a renderer.
import type {
  Appraisal,
  AppraisalState,
  PersonRef,
} from '@/services/appraisal.service';
import { isOverdue, personName } from './my-appraisals-utils';

export interface ManagerAction {
  /** What the row's action column says. */
  label: string;
  /** True when the ball is in THIS manager's court right now. */
  needsAction: boolean;
}

/**
 * What each state asks of the manager looking at this list.
 *
 * `needsAction` is deliberately narrower than "not finished": a manager whose
 * whole team shows as needing attention learns to ignore the signal. Only the
 * two states that are blocked ON THEM qualify — writing the summary, and
 * approving the peers an employee nominated. Everything else is someone else's
 * turn and reads as status, not as a task.
 */
const MANAGER_ACTIONS: Record<AppraisalState, ManagerAction> = {
  summarising: { label: 'Write summary', needsAction: true },
  pending_peer_approval: { label: 'Approve peers', needsAction: true },
  collecting: { label: 'Collecting feedback', needsAction: false },
  nominating: { label: 'Awaiting nominations', needsAction: false },
  draft: { label: 'Not started', needsAction: false },
  released: { label: 'Awaiting acknowledgement', needsAction: false },
  acknowledged: { label: 'Complete', needsAction: false },
  cancelled: { label: 'Cancelled', needsAction: false },
};

const UNKNOWN_ACTION: ManagerAction = { label: 'Open', needsAction: false };

export function managerActionFor(state: AppraisalState): ManagerAction {
  return MANAGER_ACTIONS[state] ?? UNKNOWN_ACTION;
}

/**
 * States where a passed deadline is still meaningful. A released or
 * acknowledged appraisal finished — flagging it "overdue" because its cycle
 * deadline is in the past would mark completed work as a problem forever.
 */
const TERMINAL_STATES = new Set<AppraisalState>([
  'released',
  'acknowledged',
  'cancelled',
]);

export function isRowOverdue(row: Appraisal, now = Date.now()): boolean {
  if (TERMINAL_STATES.has(row.state)) return false;
  return isOverdue(row.cycle?.feedbackDeadline, now);
}

/**
 * Outstanding-first. An appraisal only needs this manager while it is being
 * summarised, waiting on their peer approval, or collecting feedback; once
 * released the ball is in the employee's court, and acknowledged/cancelled
 * rows are done.
 *
 * `pending_peer_approval` sits above `collecting` because it is BLOCKED on the
 * manager, where collecting is merely in flight.
 */
const STATE_PRIORITY: Record<AppraisalState, number> = {
  summarising: 0,
  pending_peer_approval: 1,
  collecting: 2,
  nominating: 3,
  draft: 4,
  released: 5,
  acknowledged: 6,
  cancelled: 7,
};

/** Unknown states sort after every known one instead of producing a NaN
 *  comparison, which leaves Array.sort free to return any order at all. */
function priorityOf(state: AppraisalState): number {
  const p = STATE_PRIORITY[state];
  return typeof p === 'number' ? p : Number.MAX_SAFE_INTEGER;
}

/** Deadline as a sortable number; missing/unparseable sorts last. */
function deadlineValue(row: Appraisal): number {
  const raw = row.cycle?.feedbackDeadline;
  if (!raw) return Number.POSITIVE_INFINITY;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/**
 * Where each state sits in the LIFECYCLE, as opposed to how urgent it is.
 *
 * This is what the 'status' sort orders by, and it is deliberately not
 * STATE_PRIORITY: that one answers "what needs me first" and puts summarising
 * at the top, where this one answers "where is everyone in the pipeline" and
 * runs an appraisal front to back. Ordering 'status' by urgency would have
 * made it a second name for the default and not worth offering.
 */
const LIFECYCLE_ORDER: Record<AppraisalState, number> = {
  draft: 0,
  nominating: 1,
  pending_peer_approval: 2,
  collecting: 3,
  summarising: 4,
  released: 5,
  acknowledged: 6,
  cancelled: 7,
};

function lifecycleOf(state: AppraisalState): number {
  const p = LIFECYCLE_ORDER[state];
  return typeof p === 'number' ? p : Number.MAX_SAFE_INTEGER;
}

/** Deadline comparison that keeps undated rows last in BOTH directions —
 *  `Infinity - Infinity` is NaN, which leaves Array.sort free to return any
 *  order at all. Returns 0 when neither row has a usable deadline so the
 *  caller can fall through to its next tiebreak. */
function compareDeadline(a: Appraisal, b: Appraisal): number {
  const av = deadlineValue(a);
  const bv = deadlineValue(b);
  if (av === bv) return 0;
  if (av === Number.POSITIVE_INFINITY) return 1;
  if (bv === Number.POSITIVE_INFINITY) return -1;
  return av - bv;
}

const compareName = (a: Appraisal, b: Appraisal) =>
  personName(a.employee).localeCompare(personName(b.employee));

/**
 * The orders a manager can choose between.
 *
 * 'priority' is the default and the one the page opens on — the other three
 * exist because it is the wrong order for two real questions: "who is due
 * this week" (due) and "where is Chidi" (name).
 */
export type TeamSort = 'priority' | 'due' | 'name' | 'status';

export const TEAM_SORTS: ReadonlyArray<{ value: TeamSort; label: string }> = [
  { value: 'priority', label: 'Outstanding first' },
  { value: 'due', label: 'Due date' },
  { value: 'name', label: 'Employee name' },
  { value: 'status', label: 'Status' },
];

const COMPARATORS: Record<TeamSort, (a: Appraisal, b: Appraisal) => number> = {
  // State priority, then soonest deadline, then employee name.
  //
  // The last two tiebreaks are what make the order STABLE across reloads: with
  // priority alone, two employees in the same state came back in whatever
  // order Mongo happened to return, so the list reshuffled itself between
  // visits and a manager could not rely on position to find anyone.
  priority: (a, b) =>
    priorityOf(a.state) - priorityOf(b.state) ||
    compareDeadline(a, b) ||
    compareName(a, b),
  due: (a, b) => compareDeadline(a, b) || compareName(a, b),
  name: compareName,
  status: (a, b) =>
    lifecycleOf(a.state) - lifecycleOf(b.state) || compareName(a, b),
};

/**
 * Sort the team list. `sort` defaults to 'priority', which is the behaviour
 * every call site had before the control existed; an unrecognised key falls
 * back to it rather than returning the list untouched, so a stale saved
 * preference degrades to the sensible order instead of to Mongo's.
 */
export function sortTeamAppraisals(
  rows: Appraisal[],
  sort: TeamSort = 'priority'
): Appraisal[] {
  const compare = COMPARATORS[sort] ?? COMPARATORS.priority;
  return [...rows].sort(compare);
}

/**
 * The distinct cycles present in the team list, for the cycle picker.
 *
 * Built from the rows rather than fetched: a manager can only filter to a
 * cycle their reports are actually in, so a request for the tenant's whole
 * cycle history would offer options that match nothing. Rows whose `cycle`
 * did not come back populated are skipped for the same reason.
 */
export function teamCycleOptions(
  rows: Appraisal[]
): Array<{ value: string; label: string }> {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const id = row.cycle?._id;
    if (!id || seen.has(id)) continue;
    seen.set(id, row.cycle?.name || 'Untitled cycle');
  }
  return Array.from(seen.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export interface TeamSummary {
  total: number;
  needsAction: number;
  overdue: number;
  complete: number;
}

export function teamSummary(rows: Appraisal[], now = Date.now()): TeamSummary {
  return {
    total: rows.length,
    needsAction: rows.filter((r) => managerActionFor(r.state).needsAction)
      .length,
    overdue: rows.filter((r) => isRowOverdue(r, now)).length,
    complete: rows.filter((r) => r.state === 'acknowledged').length,
  };
}

export type TeamScope = 'all' | 'needs-action' | 'overdue' | 'complete';

/** Haystack for the search box: everything visible in the row. */
function searchableText(row: Appraisal): string {
  const person: PersonRef | undefined = row.employee;
  return [
    personName(person),
    person?.email ?? '',
    person?.employeeProfile?.work?.jobTitle ?? '',
    row.cycle?.name ?? '',
  ]
    .join(' ')
    .toLowerCase();
}

/**
 * Search + scope + cycle, applied together.
 *
 * Search is a whitespace-split AND: typing "ada sales" matches the row for Ada
 * on the Sales cycle rather than every row containing either word, which is
 * what a manager scanning a long list actually means.
 *
 * `cycleId` is a separate axis from the search on purpose. Typing the cycle's
 * NAME into the box worked only until an employee, a job title or a second
 * cycle happened to share a word with it — "H1" matches every cycle a company
 * has ever run in a first half.
 */
export function filterTeamAppraisals(
  rows: Appraisal[],
  opts: { query?: string; scope?: TeamScope; cycleId?: string } = {},
  now = Date.now()
): Appraisal[] {
  const scope = opts.scope ?? 'all';
  const cycleId = opts.cycleId ?? 'all';
  const terms = (opts.query ?? '').toLowerCase().split(/\s+/).filter(Boolean);

  return rows.filter((row) => {
    // A row whose cycle never came back populated cannot be shown to belong to
    // the selected one, so it drops out rather than slipping past the filter.
    if (cycleId !== 'all' && row.cycle?._id !== cycleId) return false;
    if (scope === 'needs-action' && !managerActionFor(row.state).needsAction) {
      return false;
    }
    if (scope === 'overdue' && !isRowOverdue(row, now)) return false;
    if (scope === 'complete' && row.state !== 'acknowledged') return false;
    if (terms.length === 0) return true;
    const haystack = searchableText(row);
    return terms.every((t) => haystack.includes(t));
  });
}
