// services/attendance.service.ts — the clock: kiosk punches, the daily log,
// and corrections.
//
// Follows shift.service.ts, including its generic `handle<T>` envelope:
// `res.json()` is `unknown` under this tsconfig, so an untyped await produces
// TS18046 at every field read.
//
// Two shapes come straight from the server and are load-bearing:
//   * `shift` is NULLABLE. Somebody can turn up on a day nothing was rostered
//     for them, so "no shift" is a normal record, not missing data — and
//     punctuality reports `no_shift` rather than pretending they were on time.
//   * `clockOut` is nullable while a record is `open`, and an open record
//     reports 0 minutes. It is not "time so far": a running total would make
//     the same record read differently on every refresh.
import type { Ref, PersonRef } from './orgStructure.service';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export const ATTENDANCE_STATUSES = ['open', 'closed'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** A kiosk punch is what the employee did; an admin row is what someone says. */
export const ATTENDANCE_SOURCES = ['kiosk', 'admin'] as const;
export type AttendanceSource = (typeof ATTENDANCE_SOURCES)[number];

/** `no_shift` is a distinct answer from `on_time`, never rendered as one. */
export type PunctualityCode = 'no_shift' | 'early' | 'on_time' | 'late';

export interface Punctuality {
  code: PunctualityCode;
  /** Always non-negative — `code` carries the direction. */
  minutes: number;
}

export interface AttendanceShiftRef {
  _id: string;
  start: string;
  end: string;
  status: string;
  role?: Ref<{ _id: string; name: string; color?: string }>;
}

export interface AttendanceRecord {
  _id: string;
  employee: Ref<PersonRef>;
  /** null = the punch matched no shift on that day. */
  shift: Ref<AttendanceShiftRef>;
  clockIn: string;
  clockOut: string | null;
  source: AttendanceSource;
  /** Derived on the server. 0 while the record is open. */
  minutesWorked: number;
  status: AttendanceStatus;
  /** Set on every correction — a corrected punch has to name its author. */
  editedBy?: Ref<PersonRef>;
  note?: string;
  /** Attached on read, not stored: it is a function of the punch and shift. */
  punctuality?: Punctuality;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceSummary {
  total: number;
  open: number;
  closed: number;
  late: number;
  minutes: number;
  hours: number;
}

export interface AttendanceLogResponse {
  items: AttendanceRecord[];
  summary: AttendanceSummary;
  range: { from: string; to: string };
}

/** What the pad shows after a press: who, in or out, and against which shift. */
export interface ClockResponse {
  action: 'in' | 'out';
  employee: PersonRef;
  item: AttendanceRecord;
  punctuality: Punctuality;
}

export interface AttendanceInput {
  employee?: string;
  shift?: string | null;
  clockIn?: string;
  /** null re-opens the record — an explicit instruction, not "unchanged". */
  clockOut?: string | null;
  note?: string;
}

/**
 * A 409 from the clock. `code` distinguishes the refusals that need different
 * words: `kiosk_punch` (delete refused), `already_open`, `too_soon`.
 */
export class AttendanceConflictError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'AttendanceConflictError';
    this.code = code;
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
    };
    if (res.status === 409 && err.code) {
      throw new AttendanceConflictError(err.message || fallback, err.code);
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

const ATTENDANCE = `${API_URL}/api/attendance`;

export interface AttendanceLogParams {
  /** 'YYYY-MM-DD'. Omitted, the server answers for today in the tenant's zone. */
  from?: string;
  to?: string;
  employee?: string;
  status?: AttendanceStatus;
}

export const attendanceService = {
  async log(
    params: AttendanceLogParams,
    token: string
  ): Promise<AttendanceLogResponse> {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.employee) qs.set('employee', params.employee);
    if (params.status) qs.set('status', params.status);
    const json = await handle<AttendanceLogResponse>(
      await fetch(`${ATTENDANCE}${qs.toString() ? `?${qs}` : ''}`, {
        headers: auth(token),
      }),
      'Failed to load attendance'
    );
    return json.data;
  },

  /**
   * One toggle, never two endpoints: the server decides from the employee's
   * open record whether this press is an in or an out. A 401 here means only
   * "invalid PIN" — the API deliberately never says whether the code existed.
   */
  async clock(pin: string, token: string): Promise<ClockResponse> {
    const json = await handle<ClockResponse>(
      await fetch(`${ATTENDANCE}/clock`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify({ pin }),
      }),
      'Could not read that PIN'
    );
    return json.data;
  },

  /** A manual entry. The server stamps `source: 'admin'`; it is not settable. */
  async create(
    input: AttendanceInput,
    token: string
  ): Promise<AttendanceRecord> {
    const json = await handle<{ item: AttendanceRecord }>(
      await fetch(ATTENDANCE, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify(input),
      }),
      'Failed to add the attendance record'
    );
    return json.data.item;
  },

  /** A correction. The server stamps `editedBy` on every one of these. */
  async update(
    id: string,
    input: AttendanceInput,
    token: string
  ): Promise<AttendanceRecord> {
    const json = await handle<{ item: AttendanceRecord }>(
      await fetch(`${ATTENDANCE}/${id}`, {
        method: 'PATCH',
        headers: jsonAuth(token),
        body: JSON.stringify(input),
      }),
      'Failed to correct the attendance record'
    );
    return json.data.item;
  },

  /** Refused with a 409 (`kiosk_punch`) for anything the employee punched. */
  async remove(id: string, token: string): Promise<void> {
    await handle<unknown>(
      await fetch(`${ATTENDANCE}/${id}`, {
        method: 'DELETE',
        headers: auth(token),
      }),
      'Failed to delete the attendance record'
    );
  },
};
