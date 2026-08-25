// services/timeOff.service.ts — time-off requests and shift swaps.
//
// Follows attendance.service.ts, including its generic `handle<T>` envelope:
// `res.json()` is `unknown` under this tsconfig, so an untyped await produces
// TS18046 at every field read.
//
// THREE SHAPES FROM THE SERVER THAT ARE LOAD-BEARING
// ---------------------------------------------------
//  * `startDate` / `endDate` are a HALF-OPEN window in absolute UTC —
//    `endDate` is the instant the last day FINISHES, not an instant inside it.
//    Never render it directly; `requestDayRange` in time-off-utils.ts turns the
//    pair back into the inclusive local days a human typed.
//  * `halfDay` is genuinely half a day. 'am' ends at local midday, 'pm' starts
//    there, and `days` reports 0.5 for either.
//  * `targetEmployee` on a swap is NULLABLE — null means it is open to anyone
//    holding the role, exactly like `Shift.employee`. Accepting an open swap is
//    what claims it, and the server writes the accepter into that field then.
import type { Ref, PersonRef } from './orgStructure.service';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export const TIME_OFF_TYPES = [
  'annual',
  'sick',
  'unpaid',
  'parental',
  'other',
] as const;
export type TimeOffType = (typeof TIME_OFF_TYPES)[number];

export const TIME_OFF_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
] as const;
export type TimeOffStatus = (typeof TIME_OFF_STATUSES)[number];

/** Two gates: `accepted` is the target, `approved` is the manager. */
export const SWAP_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
  'approved',
] as const;
export type SwapStatus = (typeof SWAP_STATUSES)[number];

export const HALF_DAY_PARTS = ['none', 'am', 'pm'] as const;
export type HalfDayPart = (typeof HALF_DAY_PARTS)[number];

export interface TimeOffRequest {
  _id: string;
  employee: Ref<PersonRef>;
  type: TimeOffType;
  /** Inclusive start, absolute UTC. */
  startDate: string;
  /** EXCLUSIVE end — see the note at the top of this file. */
  endDate: string;
  halfDay: HalfDayPart;
  /** Derived on the server, to the nearest half day. */
  days: number;
  reason?: string;
  status: TimeOffStatus;
  approver?: Ref<PersonRef>;
  decidedBy?: Ref<PersonRef>;
  decidedAt?: string | null;
  decisionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SwapShiftRef {
  _id: string;
  start: string;
  end: string;
  status: string;
  role?: Ref<{ _id: string; name: string; color?: string }>;
  department?: Ref<{ _id: string; name: string; color?: string }>;
  employee?: Ref<PersonRef>;
}

export interface ShiftSwapRequest {
  _id: string;
  shift: Ref<SwapShiftRef>;
  requestedBy: Ref<PersonRef>;
  /** null = open to anyone holding the role. */
  targetEmployee: Ref<PersonRef>;
  status: SwapStatus;
  approver?: Ref<PersonRef>;
  decidedBy?: Ref<PersonRef>;
  note?: string;
  respondedAt?: string | null;
  decidedAt?: string | null;
  decisionNote?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A shift the decision clashed with. Carried by a 409's `conflicts`, and by the
 * `rostered` warning on an approval that went through anyway.
 */
export interface ConflictShift {
  _id: string;
  start: string;
  end: string;
  status?: string;
  role?: Ref<{ _id: string; name: string; color?: string }>;
}

/**
 * Something the server did anyway and wants named.
 *
 * Approving leave over shifts the employee is already rostered on does NOT
 * refuse — the leave is the answer to a human question and the roster is what
 * has to change — but it comes back as one of these so nothing is silent.
 */
export interface DecisionWarning {
  code: string;
  message: string;
  conflicts?: ConflictShift[];
}

export interface TimeOffListResponse {
  items: TimeOffRequest[];
  /** Whether this caller may approve or reject other people's requests. */
  canDecide: boolean;
}

export interface SwapListResponse {
  items: ShiftSwapRequest[];
  canDecide: boolean;
}

export interface TimeOffInput {
  /** Omitted by staff — the server files it as theirs. Admins may send an id. */
  employee?: string;
  type: TimeOffType;
  /** Local 'YYYY-MM-DD'. The server converts to the stored window. */
  from: string;
  /** Defaults to `from` on the server, so a single day needs only `from`. */
  to?: string;
  halfDay?: HalfDayPart;
  reason?: string;
}

export interface SwapInput {
  shift: string;
  /** Omit or null to offer it to anyone holding the role. */
  targetEmployee?: string | null;
  note?: string;
}

/**
 * A 409. `code` distinguishes the refusals that need different words:
 * `overlapping_request`, `already_requested`, `bad_transition`, `no_target`,
 * `shift_cancelled`, `already_taken` (somebody else claimed an open swap
 * first — claims are settled by whoever's write lands first), and the
 * assignment guard's own `overlap` / `time_off` / `role_mismatch` when
 * approving a swap re-checks eligibility.
 */
export class TimeOffConflictError extends Error {
  code: string;

  conflicts: ConflictShift[];

  constructor(message: string, code: string, conflicts: ConflictShift[] = []) {
    super(message);
    this.name = 'TimeOffConflictError';
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
      conflicts?: ConflictShift[];
    };
    if (res.status === 409 && err.code) {
      throw new TimeOffConflictError(
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

const TIME_OFF = `${API_URL}/api/time-off`;
const SWAPS = `${API_URL}/api/shift-swaps`;

export interface TimeOffListParams {
  /** 'YYYY-MM-DD'. Omitted entirely, the server answers for every date. */
  from?: string;
  to?: string;
  status?: TimeOffStatus;
  employee?: string;
  /** 'mine' narrows an admin to their own rows. Staff are always narrowed. */
  scope?: 'mine' | 'all';
}

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const timeOffService = {
  async list(
    params: TimeOffListParams,
    token: string
  ): Promise<TimeOffListResponse> {
    const json = await handle<TimeOffListResponse>(
      await fetch(`${TIME_OFF}${qs({ ...params })}`, { headers: auth(token) }),
      'Failed to load time off'
    );
    return json.data;
  },

  async create(input: TimeOffInput, token: string): Promise<TimeOffRequest> {
    const json = await handle<{ item: TimeOffRequest }>(
      await fetch(TIME_OFF, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify(input),
      }),
      'Failed to file the request'
    );
    return json.data.item;
  },

  /**
   * Approve or reject. Admin-only server-side.
   *
   * An approval that clashes with shifts the employee is already on SUCCEEDS
   * and returns them in `warnings` — the roster is what needs changing, not the
   * decision. Show them; do not swallow them.
   */
  async decide(
    id: string,
    action: 'approve' | 'reject',
    token: string,
    note?: string
  ): Promise<{ item: TimeOffRequest; warnings: DecisionWarning[] }> {
    const json = await handle<{
      item: TimeOffRequest;
      warnings: DecisionWarning[];
    }>(
      await fetch(`${TIME_OFF}/${id}/decision`, {
        method: 'PATCH',
        headers: jsonAuth(token),
        body: JSON.stringify({ action, note }),
      }),
      'Failed to record the decision'
    );
    return { item: json.data.item, warnings: json.data.warnings ?? [] };
  },

  /** The requester withdrawing, or an admin releasing approved leave. */
  async cancel(id: string, token: string): Promise<TimeOffRequest> {
    const json = await handle<{ item: TimeOffRequest }>(
      await fetch(`${TIME_OFF}/${id}/cancel`, {
        method: 'PATCH',
        headers: jsonAuth(token),
        body: JSON.stringify({}),
      }),
      'Failed to cancel the request'
    );
    return json.data.item;
  },
};

export interface SwapListParams {
  status?: SwapStatus;
  scope?: 'mine' | 'all';
}

export const swapService = {
  async list(params: SwapListParams, token: string): Promise<SwapListResponse> {
    const json = await handle<SwapListResponse>(
      await fetch(`${SWAPS}${qs({ ...params })}`, { headers: auth(token) }),
      'Failed to load swaps'
    );
    return json.data;
  },

  /**
   * The caller's own published, upcoming shifts — the ones they may offer.
   *
   * A separate endpoint from the roster on purpose: `/api/shifts` is admin-only
   * (a draft roster is not visible to the people on it), and a member of staff
   * cannot offer a shift they are not allowed to see. This returns one person's
   * own rows and nobody else's.
   */
  async myShifts(token: string): Promise<SwapShiftRef[]> {
    const json = await handle<{ items: SwapShiftRef[] }>(
      await fetch(`${SWAPS}/my-shifts`, { headers: auth(token) }),
      'Failed to load your shifts'
    );
    return json.data.items;
  },

  async create(input: SwapInput, token: string): Promise<ShiftSwapRequest> {
    const json = await handle<{ item: ShiftSwapRequest }>(
      await fetch(SWAPS, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify(input),
      }),
      'Failed to offer the shift'
    );
    return json.data.item;
  },

  /** The target answering. Never moves the shift — only `decide` does. */
  async respond(
    id: string,
    action: 'accept' | 'reject',
    token: string
  ): Promise<ShiftSwapRequest> {
    const json = await handle<{ item: ShiftSwapRequest }>(
      await fetch(`${SWAPS}/${id}/respond`, {
        method: 'PATCH',
        headers: jsonAuth(token),
        body: JSON.stringify({ action }),
      }),
      'Failed to answer the request'
    );
    return json.data.item;
  },

  /**
   * Approve or reject. Admin-only, and the only call that writes the shift.
   *
   * Approval re-runs the roster's own eligibility check against the world as it
   * is NOW, so a 409 here (`overlap`, `time_off`, `role_mismatch`) is normal
   * when something changed since the target accepted.
   */
  async decide(
    id: string,
    action: 'approve' | 'reject',
    token: string,
    note?: string
  ): Promise<{ item: ShiftSwapRequest; warnings: DecisionWarning[] }> {
    const json = await handle<{
      item: ShiftSwapRequest;
      warnings: DecisionWarning[];
    }>(
      await fetch(`${SWAPS}/${id}/decision`, {
        method: 'PATCH',
        headers: jsonAuth(token),
        body: JSON.stringify({ action, note }),
      }),
      'Failed to record the decision'
    );
    return { item: json.data.item, warnings: json.data.warnings ?? [] };
  },

  async cancel(id: string, token: string): Promise<ShiftSwapRequest> {
    const json = await handle<{ item: ShiftSwapRequest }>(
      await fetch(`${SWAPS}/${id}/cancel`, {
        method: 'PATCH',
        headers: jsonAuth(token),
        body: JSON.stringify({}),
      }),
      'Failed to withdraw the request'
    );
    return json.data.item;
  },
};
