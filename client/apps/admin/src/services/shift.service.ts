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

export interface ShiftTemplate {
  _id: string;
  name: string;
  role: Ref<RoleRef>;
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
}

/**
 * A 409 from the roster. `code` is the helper's own verdict code, so callers
 * can branch on it — notably `role_mismatch`, the only one `force` overrides.
 */
export class ShiftConflictError extends Error {
  code: string;
  conflicts: Shift[];

  constructor(message: string, code: string, conflicts: Shift[]) {
    super(message);
    this.name = 'ShiftConflictError';
    this.code = code;
    this.conflicts = conflicts;
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
    };
    if (res.status === 409 && err.code) {
      throw new ShiftConflictError(
        err.message || fallback,
        err.code,
        err.conflicts ?? []
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

  async create(
    input: ShiftInput,
    token: string
  ): Promise<{ item: Shift; warnings: AssignmentWarning[] }> {
    const json = await handle<{ item: Shift; warnings: AssignmentWarning[] }>(
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
  ): Promise<{ item: Shift; warnings: AssignmentWarning[] }> {
    const json = await handle<{ item: Shift; warnings: AssignmentWarning[] }>(
      await fetch(`${SHIFTS}/${id}`, {
        method: 'PATCH',
        headers: jsonAuth(token),
        body: JSON.stringify(input),
      }),
      'Failed to update the shift'
    );
    return json.data;
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

  async publish(
    input: { from: string; to: string },
    token: string
  ): Promise<{ published: number }> {
    const json = await handle<{ published: number }>(
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
