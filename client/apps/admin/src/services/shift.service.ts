// services/shift.service.ts — shift templates and the roster they generate.
//
// Follows orgStructure.service.ts, including its generic `handle<T>` envelope:
// `res.json()` is `unknown` under this tsconfig, so an untyped await produces
// TS18046 at every field read.
//
// The roster's two unusual shapes are deliberate and both come from the API:
//   * `Shift.employee` is NULLABLE — null is an open shift, not missing data.
//   * A 409 is a real answer, not a failure. It carries a machine-readable
//     `code` (overlap / role_mismatch / time_off / …) and the conflicting
//     shifts, so the UI can name the clash. `ShiftConflictError` preserves them
//     where a plain Error would flatten it to a string.
import type { Ref, PersonRef } from './orgStructure.service';
import type { FillSkip } from '../app/shared/employees/shift-roster-utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export const SHIFT_STATUSES = ['draft', 'published', 'cancelled'] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

/** 0 = Sunday .. 6 = Saturday, matching the server and Date#getUTCDay. */
export const DAY_LABELS = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;

/**
 * How a template repeats. 'weekly' reads daysOfWeek; 'cycle' reads
 * cycleLength/cycleDays/anchorDate and ignores the weekdays entirely — a
 * rotation like one-on/one-off changes weekday every week, so no set of weekday
 * flags can express it. Mirrors RECURRENCE_TYPES on the server.
 */
export const SHIFT_RECURRENCES = ['weekly', 'cycle'] as const;
export type ShiftRecurrence = (typeof SHIFT_RECURRENCES)[number];

export interface RoleRef {
  _id: string;
  name: string;
  color?: string;
}

/**
 * One slot in a template's crew: `count` open shifts, each accepting any of
 * `roles`. Mirrors the `positions` subdocument on the server's ShiftTemplate
 * model — `_id` is load-bearing there (the generation idempotency handle) so
 * it is never optional here either.
 */
export interface ShiftTemplatePosition {
  _id: string;
  roles: Ref<RoleRef>[];
  count: number;
}

/** A seat on a fill: who, and in which template position. */
export interface FillSeat {
  employee: string;
  position: string | null;
}

export interface ShiftTemplate {
  _id: string;
  name: string;
  role: Ref<RoleRef>;
  /** The crew this shift needs. Empty means the legacy single-role shape —
   * see shift-position-utils.templatePositions for the normalisation. */
  positions?: ShiftTemplatePosition[];
  department?: Ref<{ _id: string; name: string; color?: string }>;
  /** Local wall clock 'HH:MM'. An endTime <= startTime crosses midnight. */
  startTime: string;
  endTime: string;
  /** Calendar days after start the shift ends on. 0 = same day (default). */
  endDayOffset: number;
  breakMinutes: number;
  recurrence: ShiftRecurrence;
  /** 'weekly' only. 0 = Sunday .. 6 = Saturday. */
  daysOfWeek: number[];
  /** 'cycle' only. Days in one turn of the rotation: 2 = one on, one off. */
  cycleLength: number | null;
  /** 'cycle' only. Which 0-based offsets of the cycle are worked. */
  cycleDays: number[];
  /** 'cycle' only. The local date the cycle's day 0 falls on; it fixes the phase. */
  anchorDate: string | null;
  color?: string;
  note?: string;
  isActive: boolean;
  /** Upcoming non-cancelled shifts generated from this template. */
  shiftCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftTemplateInput {
  name: string;
  role: string;
  /**
   * The crew this shift needs. `_id` is optional and load-bearing: it is the
   * generation idempotency handle — the server matches an updated template's
   * positions BY IDENTITY, keeping an `_id` it recognises and minting a fresh
   * one otherwise. Omit it for a position the admin has just added; send back
   * every `_id` the server gave you for the rest, or every already-generated
   * day for that position is orphaned and the next generate duplicates it.
   */
  positions?: { _id?: string; roles: string[]; count: number }[];
  department?: string | null;
  startTime: string;
  endTime: string;
  endDayOffset?: number;
  breakMinutes?: number;
  recurrence?: ShiftRecurrence;
  daysOfWeek?: number[];
  cycleLength?: number | null;
  cycleDays?: number[];
  anchorDate?: string | null;
  color?: string;
  note?: string;
  isActive?: boolean;
}

export interface Shift {
  _id: string;
  template?: Ref<{ _id: string; name: string; color?: string }>;
  /** null = an open shift nobody has been assigned to yet. */
  employee: Ref<PersonRef>;
  role: Ref<RoleRef>;
  /** Other roles this shift accepts beyond `role`. Empty = single-role. */
  altRoles?: Ref<RoleRef>[];
  /** Which template position this row fills. Null for a hand-made shift. */
  templatePosition?: string | null;
  department?: Ref<{ _id: string; name: string; color?: string }>;
  start: string;
  end: string;
  breakMinutes: number;
  status: ShiftStatus;
  publishedAt?: string | null;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftInput {
  employee?: string | null;
  role?: string;
  department?: string | null;
  template?: string | null;
  start?: string;
  end?: string;
  breakMinutes?: number;
  note?: string;
  status?: ShiftStatus;
  /** Overrides a role_mismatch. It never overrides an overlap. */
  force?: boolean;
  /**
   * The multi-select fan-out: N ticked people become N shift rows, one each.
   * Absent means the original single-or-open behaviour. An OPEN shift is
   * `employee: null` with no `employees` — a null never rides inside this list.
   */
  employees?: string[];
  /** Create only the people who passed, and report the rest in `skipped`. */
  skipBlocked?: boolean;
}

export interface RosterSummary {
  total: number;
  open: number;
  assigned: number;
  draft: number;
  published: number;
  scheduledHours: number;
}

export interface RosterResponse {
  items: Shift[];
  summary: RosterSummary;
  range: { from: string; to: string };
}

/** Why the planner did not create a shift. The useful half of a generate run. */
export interface GenerationSkip {
  template: string;
  date?: string;
  reason: string;
}

export interface GenerateResponse {
  created: number;
  items: Shift[];
  skipped: GenerationSkip[];
}

export interface AssignmentWarning {
  code: string;
  message: string;
  /** Set on a fan-out save: a forced assignment must say WHO it was forced for. */
  employee?: PersonRef | null;
}

/** One person the server refused to schedule, and whether `force` can override it. */
export interface BlockedAssignment {
  employee: PersonRef | null;
  code: string;
  message: string;
  conflicts: Shift[];
  /**
   * Decided by the SERVER, from its own FORCEABLE_CODES. The browser used to
   * keep a second copy of this list; one judge means the badges in the picker
   * and the refusal on save cannot drift apart.
   */
  forceable: boolean;
  /**
   * Set only on an edit's fan-out 409, and only for the person going onto the
   * row being edited. `skipBlocked` never skips that person — that IS the edit
   * that was asked for — so a "skip these" retry would be refused again, byte
   * for byte. `summariseAssignmentResult` reads this to withhold the button
   * rather than offer one that cannot work.
   */
  pinned?: boolean;
}

/** One person the server would schedule, with any warning a `force` produced. */
export interface AllowedAssignment {
  employee: PersonRef | null;
  warnings: AssignmentWarning[];
}

/** A pre-flight verdict for one employee against a candidate slot. */
export interface AvailabilityVerdict {
  employee: PersonRef | null;
  ok: boolean;
  code: string | null;
  message: string | null;
  forceable: boolean;
}

/**
 * A 409 from the roster.
 *
 * Two shapes arrive here. A single-employee save answers with the helper's own
 * `code` (overlap / role_mismatch / …) and `conflicts`. A multi-select save
 * answers `code: 'assignment_conflicts'` and fills `blocked` / `allowed`
 * instead, so the drawer can name every person that stood in the way rather
 * than reporting the first one.
 */
export class ShiftConflictError extends Error {
  code: string;
  conflicts: Shift[];
  blocked: BlockedAssignment[];
  allowed: AllowedAssignment[];

  constructor(
    message: string,
    code: string,
    conflicts: Shift[],
    blocked: BlockedAssignment[] = [],
    allowed: AllowedAssignment[] = []
  ) {
    super(message);
    this.name = 'ShiftConflictError';
    this.code = code;
    this.conflicts = conflicts;
    this.blocked = blocked;
    this.allowed = allowed;
  }
}

/** The API's envelope. `res.json()` is `unknown` under this tsconfig. */
interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

async function handle<T>(
  res: Response,
  fallback: string
): Promise<ApiEnvelope<T>> {
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
      conflicts?: Shift[];
      blocked?: BlockedAssignment[];
      allowed?: AllowedAssignment[];
    };
    if (res.status === 409 && err.code) {
      throw new ShiftConflictError(
        err.message || fallback,
        err.code,
        err.conflicts ?? [],
        err.blocked ?? [],
        err.allowed ?? []
      );
    }
    throw new Error(err.message || fallback);
  }
  return (await res.json()) as ApiEnvelope<T>;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const jsonAuth = (token: string) => ({
  'Content-Type': 'application/json',
  ...auth(token),
});

const TEMPLATES = `${API_URL}/api/shift-templates`;
const SHIFTS = `${API_URL}/api/shifts`;

export interface TemplateListParams {
  isActive?: boolean;
  department?: string;
  role?: string;
}

export const shiftTemplateService = {
  async list(
    token: string,
    params?: TemplateListParams
  ): Promise<ShiftTemplate[]> {
    const qs = new URLSearchParams();
    if (params?.isActive !== undefined)
      qs.set('isActive', String(params.isActive));
    if (params?.department) qs.set('department', params.department);
    if (params?.role) qs.set('role', params.role);
    const json = await handle<{ items: ShiftTemplate[] }>(
      await fetch(`${TEMPLATES}${qs.toString() ? `?${qs}` : ''}`, {
        headers: auth(token),
      }),
      'Failed to load shift templates'
    );
    return json.data.items;
  },

  async create(
    input: ShiftTemplateInput,
    token: string
  ): Promise<ShiftTemplate> {
    const json = await handle<{ item: ShiftTemplate }>(
      await fetch(TEMPLATES, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify(input),
      }),
      'Failed to create shift template'
    );
    return json.data.item;
  },

  async update(
    id: string,
    input: Partial<ShiftTemplateInput>,
    token: string
  ): Promise<ShiftTemplate> {
    const json = await handle<{ item: ShiftTemplate }>(
      await fetch(`${TEMPLATES}/${id}`, {
        method: 'PATCH',
        headers: jsonAuth(token),
        body: JSON.stringify(input),
      }),
      'Failed to update shift template'
    );
    return json.data.item;
  },

  /** Refused with a 409 while upcoming shifts still reference the template. */
  async remove(id: string, token: string): Promise<void> {
    await handle<unknown>(
      await fetch(`${TEMPLATES}/${id}`, {
        method: 'DELETE',
        headers: auth(token),
      }),
      'Failed to delete shift template'
    );
  },
};

export interface RosterParams {
  from: string;
  to: string;
  department?: string;
  role?: string;
  /** An employee id, or 'open' for the unassigned lane. */
  employee?: string;
  status?: ShiftStatus;
}

/**
 * A roster write's answer. `item` is the single/edited row; `items` and
 * `created` are the fan-out's rows. Exactly one of `item` / `items` is present.
 */
export interface ShiftWriteResult {
  item?: Shift;
  items?: Shift[];
  created?: Shift[];
  warnings: AssignmentWarning[];
  skipped?: { employee: PersonRef | null; code: string; message: string }[];
}

export const shiftService = {
  async roster(params: RosterParams, token: string): Promise<RosterResponse> {
    const qs = new URLSearchParams({ from: params.from, to: params.to });
    if (params.department) qs.set('department', params.department);
    if (params.role) qs.set('role', params.role);
    if (params.employee) qs.set('employee', params.employee);
    if (params.status) qs.set('status', params.status);
    const json = await handle<RosterResponse>(
      await fetch(`${SHIFTS}?${qs}`, { headers: auth(token) }),
      'Failed to load the roster'
    );
    return json.data;
  },

  async create(input: ShiftInput, token: string): Promise<ShiftWriteResult> {
    const json = await handle<ShiftWriteResult>(
      await fetch(SHIFTS, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify(input),
      }),
      'Failed to create the shift'
    );
    return json.data;
  },

  async update(
    id: string,
    input: ShiftInput,
    token: string
  ): Promise<ShiftWriteResult> {
    const json = await handle<ShiftWriteResult>(
      await fetch(`${SHIFTS}/${id}`, {
        method: 'PATCH',
        headers: jsonAuth(token),
        body: JSON.stringify(input),
      }),
      'Failed to update the shift'
    );
    return json.data;
  },

  /**
   * Who can work this slot, before anybody is ticked.
   *
   * A POST because it carries a window and a role, not because it changes
   * anything. The verdicts come from the same `checkAssignment` the save uses.
   */
  async availability(
    input: {
      role: string;
      start: string;
      end: string;
      excludeId?: string | null;
    },
    token: string
  ): Promise<AvailabilityVerdict[]> {
    const json = await handle<{ items: AvailabilityVerdict[] }>(
      await fetch(`${SHIFTS}/availability`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify(input),
      }),
      'Failed to check who is available'
    );
    return json.data.items;
  },

  /** Only a draft may be deleted; a published shift must be cancelled instead. */
  async remove(id: string, token: string): Promise<void> {
    await handle<unknown>(
      await fetch(`${SHIFTS}/${id}`, {
        method: 'DELETE',
        headers: auth(token),
      }),
      'Failed to delete the shift'
    );
  },

  async generate(
    input: { from: string; to: string; templateIds: string[] },
    token: string
  ): Promise<GenerateResponse> {
    const json = await handle<GenerateResponse>(
      await fetch(`${SHIFTS}/generate`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify(input),
      }),
      'Failed to generate shifts'
    );
    return json.data;
  },

  /**
   * Put several people on one repeating pattern across a range.
   *
   * `skipped` is person-days the server REFUSED — approved leave, an overlap, a
   * role the person is not marked for. Unlike the single-shift create, which
   * refuses the whole write, a fill writes everything it can and reports the
   * rest: one clash on day 17 must not refuse a month.
   */
  async fill(
    input: {
      templateId: string;
      /** Seats. Bare ids are still accepted by the server for compatibility. */
      employees: FillSeat[];
      from: string;
      to: string;
      force?: boolean;
    },
    token: string
  ): Promise<{ created: number; items: Shift[]; skipped: FillSkip[] }> {
    const json = await handle<{
      created: number;
      items: Shift[];
      skipped: FillSkip[];
    }>(
      await fetch(`${SHIFTS}/fill`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify(input),
      }),
      'Failed to fill the pattern'
    );
    return json.data;
  },

  /**
   * Make a stretch of the roster visible to staff.
   *
   * `heldBack` is drafts the server REFUSED to publish because they are in the
   * past — a published shift with no punch counts as an absence, so publishing
   * last week would mark staff absent for shifts they were never shown. They
   * stay drafts. It is reported rather than silently dropped, or a publish that
   * moved fewer shifts than the manager selected reads as a broken button.
   */
  async publish(
    input: { from: string; to: string },
    token: string
  ): Promise<{ published: number; heldBack?: number; clamped?: boolean }> {
    const json = await handle<{
      published: number;
      heldBack?: number;
      clamped?: boolean;
    }>(
      await fetch(`${SHIFTS}/publish`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify(input),
      }),
      'Failed to publish the roster'
    );
    return json.data;
  },
};
