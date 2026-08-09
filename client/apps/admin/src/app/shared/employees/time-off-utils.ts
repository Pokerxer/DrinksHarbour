// Pure logic behind `/employees/time-off` and `/employees/swaps`.
//
// The admin Vitest environment is `node` — no jsdom, no testing-library — so
// components cannot be rendered. Everything worth being sure about therefore
// lives here and is tested directly, the same split as shift-roster-utils.ts
// and attendance-utils.ts.
//
// THE ONE THING TO READ BEFORE TOUCHING ANY DATE HERE
// ----------------------------------------------------
// A stored request is a HALF-OPEN window: `endDate` is the instant the last day
// FINISHES, not an instant inside it. Rendering it straight would tell somebody
// their one-day holiday runs to the 11th — a day they are at work.
// `requestDayRange` is the only place that conversion happens.
//
// Time-zone helpers are imported from shift-roster-utils.ts rather than
// restated: the roster, the attendance log and these screens have to agree
// about what day it is for the business, and three copies of an offset is how
// they stop agreeing.
import {
  LAGOS_OFFSET_MINUTES,
  toLocalDateKey,
  toLocalTimeLabel,
  employeeName,
} from './shift-roster-utils';
import type {
  TimeOffRequest,
  TimeOffStatus,
  TimeOffType,
  ShiftSwapRequest,
  SwapStatus,
  SwapShiftRef,
} from '@/services/timeOff.service';
import type { Ref } from '@/services/orgStructure.service';

const MS_PER_MINUTE = 60_000;

// ── Transitions ──────────────────────────────────────────────────────────────
//
// These MIRROR services/timeOff.helpers.js. The server is authoritative — it
// re-checks every move — and these exist only so the UI never draws a button
// whose action the server will refuse. A button that always fails is a promise
// the screen cannot keep, which is worse than no button.

export const TIME_OFF_TRANSITIONS: Record<TimeOffStatus, TimeOffStatus[]> = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['cancelled'],
  rejected: [],
  cancelled: [],
};

export const SWAP_TRANSITIONS: Record<SwapStatus, SwapStatus[]> = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['approved', 'rejected', 'cancelled'],
  approved: [],
  rejected: [],
  cancelled: [],
};

// ── Dates ────────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** 'YYYY-MM-DD' → 'Mon 10 Aug'. Built from fixed names, not the host locale. */
function dayLabel(dateISO: string): string {
  const ms = Date.parse(`${dateISO}T00:00:00.000Z`);
  if (Number.isNaN(ms)) return dateISO;
  const d = new Date(ms);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/**
 * A stored window read back as the inclusive local days a human typed.
 *
 * The last day comes from one millisecond before `endDate`, because the end is
 * exclusive. Mirrors `timeOffDayKeys` on the server.
 */
export function requestDayRange(
  request: Pick<TimeOffRequest, 'startDate' | 'endDate'>,
  offsetMinutes = LAGOS_OFFSET_MINUTES
): { from: string; to: string } {
  const start = Date.parse(request.startDate);
  const end = Date.parse(request.endDate);
  if (Number.isNaN(start) || Number.isNaN(end)) return { from: '', to: '' };
  return {
    from: toLocalDateKey(new Date(start).toISOString(), offsetMinutes),
    to: toLocalDateKey(
      new Date(Math.max(start, end - 1)).toISOString(),
      offsetMinutes
    ),
  };
}

/**
 * The dates as a sentence: 'Mon 10 Aug', 'Mon 10 Aug – Wed 12 Aug', or
 * 'Mon 10 Aug, morning'.
 *
 * The half-day suffix is not decoration. A half day that reads identically to a
 * whole one is how somebody loses an afternoon they thought they had.
 */
export function requestDayLabel(
  request: Pick<TimeOffRequest, 'startDate' | 'endDate' | 'halfDay'>,
  offsetMinutes = LAGOS_OFFSET_MINUTES
): string {
  const { from, to } = requestDayRange(request, offsetMinutes);
  if (!from) return '—';

  if (request.halfDay === 'am') return `${dayLabel(from)}, morning`;
  if (request.halfDay === 'pm') return `${dayLabel(from)}, afternoon`;
  if (from === to) return dayLabel(from);
  return `${dayLabel(from)} – ${dayLabel(to)}`;
}

/** '½ day', '1 day', '2½ days'. Zero is an em dash, never '0 days'. */
export function daysLabel(days: number): string {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const whole = Math.floor(n);
  const half = n - whole >= 0.5;
  const text = `${whole || ''}${half ? '½' : ''}`;
  // A lone half day is 'half a day', not 'half days' — the plural reads as more
  // than one, which is the opposite of what it is.
  return `${text} ${n <= 1 ? 'day' : 'days'}`;
}

// ── Words and tones ──────────────────────────────────────────────────────────

const TYPE_LABELS: Record<TimeOffType, string> = {
  annual: 'Annual leave',
  sick: 'Sick leave',
  unpaid: 'Unpaid leave',
  parental: 'Parental leave',
  other: 'Other',
};

export function timeOffTypeLabel(type: TimeOffType): string {
  return TYPE_LABELS[type] ?? 'Other';
}

const TIME_OFF_TONES: Record<TimeOffStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

/** The one place a time-off status becomes a visual treatment. */
export function timeOffStatusTone(status: TimeOffStatus): string {
  return TIME_OFF_TONES[status] ?? TIME_OFF_TONES.cancelled;
}

/**
 * `accepted` and `approved` are deliberately different colours.
 *
 * They are two different gates — the target said yes, and a manager said yes —
 * and only the second has moved the shift. Rendering them alike would tell a
 * manager their queue was empty when it was not.
 */
const SWAP_TONES: Record<SwapStatus, string> = {
  pending: 'bg-sky-50 text-sky-700',
  accepted: 'bg-amber-50 text-amber-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export function swapStatusTone(status: SwapStatus): string {
  return SWAP_TONES[status] ?? SWAP_TONES.cancelled;
}

const SWAP_LABELS: Record<SwapStatus, string> = {
  pending: 'Awaiting a taker',
  accepted: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Withdrawn',
};

export function swapStatusLabel(status: SwapStatus): string {
  return SWAP_LABELS[status] ?? status;
}

/** Who the shift was offered to. Null is a value — say so, don't show a gap. */
export function swapTargetLabel(
  request: Pick<ShiftSwapRequest, 'targetEmployee'>
): string {
  const target = request.targetEmployee;
  if (!target || typeof target === 'string') return 'Open to anyone';
  return employeeName(target);
}

/** 'Mon 10 Aug · 09:00–17:00', or '—' for a ref that did not populate. */
export function shiftWindowLabel(
  shift: Ref<SwapShiftRef>,
  offsetMinutes = LAGOS_OFFSET_MINUTES
): string {
  if (!shift || typeof shift === 'string') return '—';
  const day = toLocalDateKey(shift.start, offsetMinutes);
  if (!day) return '—';
  return `${dayLabel(day)} · ${toLocalTimeLabel(shift.start, offsetMinutes)}–${toLocalTimeLabel(
    shift.end,
    offsetMinutes
  )}`;
}

// ── Which buttons to offer ───────────────────────────────────────────────────

export interface RequestAction {
  /** What to call on the service. */
  action: 'approve' | 'reject' | 'cancel' | 'accept';
  /** The status it produces — checked against the transition table. */
  to: TimeOffStatus | SwapStatus;
  label: string;
  tone: 'primary' | 'danger' | 'quiet';
}

/**
 * The actions a viewer may take on a time-off request.
 *
 * Driven off TIME_OFF_TRANSITIONS rather than a chain of status literals, so
 * the "approved leave can still be cancelled" rule lives in one table instead
 * of being re-derived on every screen that grows a button.
 */
export function timeOffActions(
  request: Pick<TimeOffRequest, 'status'>,
  viewer: { canDecide: boolean; isMine: boolean }
): RequestAction[] {
  const legal = TIME_OFF_TRANSITIONS[request.status] ?? [];
  const out: RequestAction[] = [];

  if (viewer.canDecide && legal.includes('approved')) {
    out.push({
      action: 'approve',
      to: 'approved',
      label: 'Approve',
      tone: 'primary',
    });
  }
  if (viewer.canDecide && legal.includes('rejected')) {
    out.push({
      action: 'reject',
      to: 'rejected',
      label: 'Reject',
      tone: 'danger',
    });
  }
  // Cancelling is the requester's own to do, and an admin's release valve for
  // approved leave — the only thing that frees the roster block.
  if ((viewer.canDecide || viewer.isMine) && legal.includes('cancelled')) {
    out.push({
      action: 'cancel',
      to: 'cancelled',
      label: 'Cancel',
      tone: 'quiet',
    });
  }

  return out;
}

/**
 * The actions a viewer may take on a swap.
 *
 * `isTarget` is "this was offered to me by name". An OPEN swap (no target) is
 * answerable by anybody except the person trying to get rid of it, which is why
 * the accept branch tests `isMine` rather than only `isTarget`.
 */
export function swapActions(
  request: Pick<ShiftSwapRequest, 'status' | 'targetEmployee'>,
  viewer: { canDecide: boolean; isMine: boolean; isTarget: boolean }
): RequestAction[] {
  const legal = SWAP_TRANSITIONS[request.status] ?? [];
  const out: RequestAction[] = [];
  const isOpen = !request.targetEmployee;
  const mayAnswer = request.targetEmployee ? viewer.isTarget : !viewer.isMine;

  if (mayAnswer && legal.includes('accepted')) {
    out.push({
      action: 'accept',
      to: 'accepted',
      label: isOpen ? 'Take this shift' : 'Accept',
      tone: 'primary',
    });
  }
  // `approve` only appears once somebody has accepted: the transition table has
  // no pending → approved edge, because there would be nobody to move it to.
  if (viewer.canDecide && legal.includes('approved')) {
    out.push({
      action: 'approve',
      to: 'approved',
      label: 'Approve',
      tone: 'primary',
    });
  }
  if ((mayAnswer || viewer.canDecide) && legal.includes('rejected')) {
    out.push({
      action: 'reject',
      to: 'rejected',
      label: 'Decline',
      tone: 'danger',
    });
  }
  // Withdrawing is the requester's alone, unlike time off where an admin needs
  // it as the release valve on approved leave. Here an admin already has
  // `reject`, which says the same thing from the right side of the request.
  if (viewer.isMine && legal.includes('cancelled')) {
    out.push({
      action: 'cancel',
      to: 'cancelled',
      label: 'Withdraw',
      tone: 'quiet',
    });
  }

  return out;
}

// ── The list ─────────────────────────────────────────────────────────────────

export interface TimeOffGroup {
  key: 'awaiting' | 'upcoming' | 'past';
  title: string;
  items: TimeOffRequest[];
}

const GROUP_TITLES: Record<TimeOffGroup['key'], string> = {
  awaiting: 'Waiting for a decision',
  upcoming: 'Booked and still to come',
  past: 'Finished',
};

/**
 * Three fixed sections, always in the same order and always present.
 *
 * The question a manager opens this screen with is "what needs answering", so
 * that is the top section; a flat date-sorted list buries it among six months
 * of settled leave. Empty sections are kept rather than dropped so the page
 * does not reflow into a different shape every time somebody approves
 * something.
 *
 * Leave finishing TODAY is upcoming, not history: `endDate` is exclusive, so it
 * is compared against the end of today rather than its start — otherwise
 * somebody's current holiday files itself under "finished" while they are on it.
 */
export function groupTimeOff(
  items: TimeOffRequest[],
  opts: { today: string; offsetMinutes?: number }
): TimeOffGroup[] {
  const offset = opts.offsetMinutes ?? LAGOS_OFFSET_MINUTES;
  const todayStart =
    Date.parse(`${opts.today}T00:00:00.000Z`) - offset * MS_PER_MINUTE;

  const buckets: Record<TimeOffGroup['key'], TimeOffRequest[]> = {
    awaiting: [],
    upcoming: [],
    past: [],
  };

  for (const item of items) {
    if (item.status === 'pending') buckets.awaiting.push(item);
    else if (
      item.status === 'approved' &&
      Date.parse(item.endDate) > todayStart
    ) {
      buckets.upcoming.push(item);
    } else buckets.past.push(item);
  }

  return (['awaiting', 'upcoming', 'past'] as const).map((key) => ({
    key,
    title: GROUP_TITLES[key],
    items: buckets[key].sort(
      (a, b) => Date.parse(a.startDate) - Date.parse(b.startDate)
    ),
  }));
}

export interface TimeOffSummary {
  total: number;
  pending: number;
  approved: number;
  /** Approved days only — rejected and cancelled days are days nobody takes. */
  approvedDays: number;
}

export function summariseTimeOff(items: TimeOffRequest[]): TimeOffSummary {
  let pending = 0;
  let approved = 0;
  let approvedDays = 0;

  for (const item of items) {
    if (item.status === 'pending') pending += 1;
    if (item.status === 'approved') {
      approved += 1;
      approvedDays += Number(item.days) || 0;
    }
  }

  return {
    total: items.length,
    pending,
    approved,
    approvedDays: Math.round(approvedDays * 2) / 2,
  };
}
