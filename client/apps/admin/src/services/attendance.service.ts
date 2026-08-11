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

/** How the shift ended — the mirror of `Punctuality` for the other end. */
export type DepartureCode =
  | 'no_shift'
  | 'open'
  | 'early'
  | 'on_time'
  | 'overtime';

export interface Departure {
  code: DepartureCode;
  /** Always non-negative — `code` carries the direction. */
  minutes: number;
}

export const RATING_BANDS = [
  'excellent',
  'good',
  'fair',
  'needs_attention',
  'unrated',
] as const;
export type RatingBand = (typeof RATING_BANDS)[number];

/**
 * One input to the score. `rate` is NULL, never 0, when there was nothing to
 * measure: an employee nobody rostered has not scored zero on punctuality,
 * they have no punctuality. The overall score renormalises over whichever
 * components applied.
 */
export interface RatingComponent {
  rate: number | null;
  of: number;
  count: number;
}

export interface AttendanceRating {
  /** null = unrated. Nothing countable in the window. */
  score: number | null;
  band: RatingBand;
  components: {
    attendance: RatingComponent;
    punctuality: RatingComponent;
    completeness: RatingComponent;
    duration: RatingComponent;
  };
  counts: {
    rostered: number;
    expected: number;
    excused: number;
    attended: number;
    absent: number;
    onTime: number;
    late: number;
    closed: number;
    open: number;
    earlyLeave: number;
    /** Reported, never scored — staying late is not a fault, nor a credit. */
    overtimeMinutes: number;
    unrostered: number;
    minutesWorked: number;
  };
}

export interface TimelineShift {
  _id: string;
  start: string;
  end: string;
  status: string;
  breakMinutes?: number;
  role?: Ref<{ _id: string; name: string; color?: string }>;
}

/**
 * One rostered shift and what answered it. Shift-led, not punch-led: an
 * absence has no record, and a row still has to exist for it.
 */
export interface AttendanceTimelineEntry {
  shift: TimelineShift;
  /** null = nobody punched for this shift. */
  record: AttendanceRecord | null;
  /** Covered by approved leave, so it is out of the reckoning entirely. */
  excused: boolean;
  punctuality: Punctuality | null;
  departure: Departure;
}

export interface AttendanceHistoryResponse {
  employee: PersonRef;
  range: { from: string; to: string };
  rating: AttendanceRating;
  timeline: AttendanceTimelineEntry[];
  /** Punches that matched no shift. Reported, never rated. */
  unrostered: AttendanceRecord[];
  summary: AttendanceSummary;
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
export type EarlyLeaveCode = 'no_shift' | 'early' | 'on_time';

/** How much of the shift was left at clock-out. `no_shift` is not `on_time`. */
export interface EarlyLeave {
  code: EarlyLeaveCode;
  minutes: number;
}

export interface ClockResponse {
  action: 'in' | 'out';
  employee: PersonRef;
  item: AttendanceRecord;
  punctuality: Punctuality;
  /** Clock-outs only. Absent on a clock-in, which cannot be an early leave. */
  earlyLeave?: EarlyLeave;
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

  /**
   * The server's `data` for this conflict, when it sent one.
   *
   * Carried rather than dropped because `leaving_early` is a QUESTION, not a
   * failure: the kiosk has to say which shift and how much of it is left, and
   * an error with only a message cannot. Every other conflict code sends
   * nothing and this stays undefined.
   */
  details?: EarlyLeaveDetails;

  constructor(message: string, code: string, details?: EarlyLeaveDetails) {
    super(message);
    this.name = 'AttendanceConflictError';
    this.code = code;
    this.details = details;
  }
}

/** The conflict code the server uses when a clock-out needs acknowledging. */
export const LEAVING_EARLY = 'leaving_early';

/** What the server sends with a `leaving_early` refusal. */
export interface EarlyLeaveDetails {
  employee: PersonRef;
  /** How much of the rostered shift was still to run. Non-negative. */
  minutesRemaining: number;
  /** ISO — the client formats it, because it knows the shop's time zone. */
  shiftEnd: string;
}

/**
 * What a paired kiosk is allowed to know about itself.
 *
 * Note what is NOT here: any employee, by name or otherwise. The kiosk has
 * refused to show a staff directory since it was written — a pad that names the
 * staff is a list of who works here, mounted where anyone walking past can read
 * it — and `onShift` is a COUNT for exactly that reason.
 */
export interface KioskSession {
  tenant: { name: string; logo: string; primaryColor: string };
  device: { name: string };
  onShift: number;
  /** False on the public kiosk. The pad must not offer a fallback the server refuses. */
  pinAccepted: boolean;
}

/** One paired screen, as the settings list sees it. Never the secret. */
export interface KioskDevice {
  _id: string;
  name: string;
  /** The last few characters of the token, to tell two tablets apart. */
  tokenHint: string;
  createdAt: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
  active: boolean;
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
      data?: EarlyLeaveDetails;
    };
    if (res.status === 409 && err.code) {
      throw new AttendanceConflictError(
        err.message || fallback,
        err.code,
        err.data
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

/**
 * A kiosk paired by device token, which has NO session at all.
 *
 * A separate header rather than a Bearer, deliberately: this is not a user's
 * credential and must never be picked up by anything that expects one. The
 * server chooses a whole middleware chain on the presence of this header (see
 * kiosk.middleware.js), so sending both would be ambiguous — and sending this
 * one alone is what makes the clock refuse a typed PIN.
 */
const kioskAuth = (kioskToken: string) => ({ 'x-kiosk-token': kioskToken });
const kioskJsonAuth = (kioskToken: string) => ({
  'Content-Type': 'application/json',
  ...kioskAuth(kioskToken),
});

const ATTENDANCE = `${API_URL}/api/attendance`;
const KIOSK = `${API_URL}/api/kiosk`;

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
   * One employee's history over a window, and the rating it adds up to.
   *
   * The rating is computed on the SERVER and never here: it needs the roster
   * as its denominator (an absence leaves no record to count) and approved
   * time-off to excuse what it should not mark down. Recomputing any of that
   * client-side would be a second definition of the rule.
   */
  async history(
    employeeId: string,
    params: { from?: string; to?: string },
    token: string
  ): Promise<AttendanceHistoryResponse> {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    const json = await handle<AttendanceHistoryResponse>(
      await fetch(
        `${ATTENDANCE}/employee/${employeeId}${qs.toString() ? `?${qs}` : ''}`,
        { headers: auth(token) }
      ),
      'Failed to load this employee’s attendance'
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

  /**
   * The badge path of the same single toggle: the QR payload printed on the
   * employee's badge card (`attendance.rfidBadge`, or their `_id` when no
   * badge number was set). No PIN needs to exist for a badge to work — the
   * card itself is the credential. The server answers a scan nobody matches
   * with "Badge not recognised".
   */
  async clockWithBadge(
    badge: string,
    token: string,
    opts: { confirmEarlyLeave?: boolean } = {}
  ): Promise<ClockResponse> {
    const json = await handle<ClockResponse>(
      await fetch(`${ATTENDANCE}/clock`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify({ badge, ...opts }),
      }),
      'Could not read that badge'
    );
    return json.data;
  },

  /**
   * The same single toggle, from a screen nobody logged in to.
   *
   * Badge only. The public endpoint does not accept a PIN — four to six digits
   * typed from memory is a guessable secret on something reachable from the
   * internet, where a badge number is a thing somebody has to be holding. The
   * rule is enforced on the server (resolveClockCredential); this function
   * simply has no way to express the other one.
   */
  async clockWithKioskBadge(
    badge: string,
    kioskToken: string,
    opts: { confirmEarlyLeave?: boolean } = {}
  ): Promise<ClockResponse> {
    const json = await handle<ClockResponse>(
      await fetch(`${ATTENDANCE}/clock`, {
        method: 'POST',
        headers: kioskJsonAuth(kioskToken),
        body: JSON.stringify({ badge, ...opts }),
      }),
      'Could not read that badge'
    );
    return json.data;
  },

  /**
   * Who is this screen, and whose shop is it in?
   *
   * The device token is the ONLY thing a logged-out kiosk has that knows which
   * tenant it belongs to, so this one call does both jobs: it proves the screen
   * is still paired, and it brings back the shop's name and colour for the
   * header. A 401 here means the pairing was revoked or the URL is wrong.
   */
  async kioskSession(kioskToken: string): Promise<KioskSession> {
    const json = await handle<KioskSession>(
      await fetch(`${KIOSK}/session`, { headers: kioskAuth(kioskToken) }),
      'This kiosk is not paired'
    );
    return json.data;
  },

  // ── Pairing screens (admin) ────────────────────────────────────────────────

  /** The screens paired to this shop. Never carries a token or its hash. */
  async kioskDevices(token: string): Promise<KioskDevice[]> {
    const json = await handle<{ devices: KioskDevice[] }>(
      await fetch(`${KIOSK}/devices`, { headers: auth(token) }),
      'Failed to load kiosk devices'
    );
    return json.data.devices;
  },

  /**
   * Pair a new screen.
   *
   * The response carries the ONLY plaintext copy of the token that will ever
   * exist — nothing stores it, so it cannot be shown again. A manager who loses
   * it pairs the screen again and revokes the old row, which is the same
   * operation as replacing a lost tablet.
   */
  async pairKioskDevice(
    name: string,
    token: string
  ): Promise<{ device: KioskDevice; token: string }> {
    const json = await handle<{ device: KioskDevice; token: string }>(
      await fetch(`${KIOSK}/devices`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify({ name }),
      }),
      'Failed to pair this screen'
    );
    return json.data;
  },

  /** Cut one screen off. The URL on that tablet stops working immediately. */
  async revokeKioskDevice(deviceId: string, token: string): Promise<void> {
    await handle<unknown>(
      await fetch(`${KIOSK}/devices/${deviceId}`, {
        method: 'DELETE',
        headers: auth(token),
      }),
      'Failed to revoke this screen'
    );
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
