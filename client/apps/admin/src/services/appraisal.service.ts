// services/appraisal.service.ts — performance appraisals
import { getSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export type AppraisalState =
  | 'draft'
  | 'nominating'
  | 'pending_peer_approval'
  | 'collecting'
  | 'summarising'
  | 'released'
  | 'acknowledged'
  | 'cancelled';

export type FeedbackKind = 'self' | 'manager' | 'peer';
export type FeedbackStatus = 'pending' | 'submitted' | 'expired' | 'declined';

/**
 * The five reasons HR can chase someone for (server
 * `appraisal.helpers.js#NUDGE_REASONS`). `GET /api/appraisals/my` and
 * `GET /api/appraisals/my/reviews` attach a `nudge` object to a row when a
 * reminder was sent to the CALLER and it is still outstanding for the row's
 * current state — see `NUDGE_STILL_OUTSTANDING` in the controller. The field
 * is absent (not null) when there is no active nudge, so the UI keys off
 * `appraisal.nudge !== undefined`.
 */
export type NudgeReason =
  | 'nominate'
  | 'approve_peers'
  | 'feedback'
  | 'summarise'
  | 'acknowledge';

export interface AppraisalNudge {
  sentAt: string;
  reason: NudgeReason;
}
export type AppraisalRelation =
  | 'hr'
  | 'subject'
  | 'manager'
  | 'reviewer'
  | 'none';

export interface AppraisalAccess {
  relation: AppraisalRelation;
  canRead: boolean;
  canSeeReviewerNames: boolean;
  /**
   * Whether this viewer receives peer feedback rows AT ALL. False for the
   * subject: the server filters peer rows out of `feedback` (and therefore out
   * of `comparison`) before the payload is built, so for them the peer cards
   * are not hidden by the UI — they are simply not in the response. Peer input
   * reaches the employee through the manager's written summary instead.
   */
  canSeePeerFeedback: boolean;
  canSummarise: boolean;
  canRelease: boolean;
  canAcknowledge: boolean;
  canManageCycle: boolean;
  canNominate: boolean;
  canApprovePeers: boolean;
  canBackfillPeers: boolean;
}

/** Status of a single proposed peer reviewer, as returned in `myProposals`. */
export type PeerNominationStatus = 'proposed' | 'approved' | 'rejected';

/**
 * One entry of `Appraisal.peerNominations`, as returned RAW (not populated)
 * on `appraisal` by `GET /api/appraisals/:id` for a viewer with
 * `canSeeReviewerNames: true` (manager/hr) — see
 * appraisal.controller.js#projectAppraisalForViewer, which only strips this
 * field for a viewer who may not see reviewer identities. `user` is a bare
 * id string here, not a `PersonRef`: the manager approval screen resolves it
 * against `getEligiblePeers` (every candidate is drawn from that same list —
 * see `validateNominations`/`approvePeers`'s eligibility check) rather than
 * the server populating a second, redundant person lookup for this endpoint.
 */
export interface PeerNomination {
  user: string;
  status: PeerNominationStatus;
  proposedBy?: string;
  decidedBy?: string;
  decidedAt?: string;
}

/**
 * `GET /api/appraisals/:id/nomination` returns two genuinely different
 * shapes depending on `state` (see appraisal.controller.js#getNomination):
 * while `state === 'nominating'` the caller gets the live nomination window
 * (`min`/`max`/`deadline`) plus their own proposals; in every later state
 * the server deliberately returns ONLY `{ state, approvedCount }` — nobody
 * gets to read who was rejected after the fact. Modeling this as one type
 * with all-optional fields would let a UI author read `myProposals` in the
 * `'released'` branch and silently get `undefined` instead of a compile
 * error, defeating that server-side privacy decision. The discriminated
 * union makes `state === 'nominating'` the only way in.
 */
export interface NominationOpenView {
  state: 'nominating';
  min: number;
  max: number;
  deadline: string | null;
  myProposals: { user: PersonRef }[];
}
export interface NominationSummaryView {
  state: Exclude<AppraisalState, 'nominating'>;
  approvedCount: number;
}
export type NominationView = NominationOpenView | NominationSummaryView;

export interface PersonRef {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  /**
   * Populated only by `GET /api/appraisals/team` and `GET /api/appraisals/:id`
   * (both select `employeeProfile.work.jobTitle` on the `employee` populate —
   * see appraisal.controller.js#teamAppraisals / #getAppraisal). Other
   * endpoints that return a `PersonRef` (e.g. `/api/appraisals/my/reviews`)
   * do not select it, so it comes back `undefined` there — optional rather
   * than a second type, matching how the rest of this file already handles
   * per-endpoint population differences (see `ReviewRequest`).
   */
  employeeProfile?: { work?: { jobTitle?: string } };
}

/**
 * One answer, covering all six question types — see the `answerSchema` comment
 * in server/models/AppraisalFeedback.js for the authoritative mapping:
 *
 *   rating | likert | scale -> `rating`   (ordinal, 1..scaleMax)
 *   yes_no                  -> `rating`   (1 = yes, 0 = no)
 *   choice                  -> `selected` (always an array, even single-select)
 *   text                    -> `text`
 *
 * Every field is optional because the type carried by an answer is a property
 * of its QUESTION, not of the answer. Read these through the helpers in
 * shared/appraisals/review-answer-utils rather than poking at the fields:
 * "is this answered" is genuinely per-type and is wrong in a subtle way when
 * open-coded (`!answer.rating` treats a real 0 = "no" as unanswered).
 */
export interface AppraisalAnswer {
  questionId: string;
  rating?: number;
  text?: string;
  /** Chosen option LABELS for `choice` questions. Labels, not indices. */
  selected?: string[];
  /**
   * "I haven't seen enough to judge this." Peers only — the server rejects it
   * on a self or manager row — and mutually exclusive with a value: the server
   * rebuilds such an answer as `{ questionId, notObserved: true }`, dropping
   * any rating the UI left behind. It satisfies a required question and is
   * then excluded from every peer average.
   */
  notObserved?: boolean;
}

export interface AppraisalFeedback {
  _id: string;
  kind: FeedbackKind;
  status: FeedbackStatus;
  /** Absent for peer feedback when the viewer may not see identities. */
  reviewer?: PersonRef;
  answers: AppraisalAnswer[];
  submittedAt?: string;
}

/**
 * A feedback row as returned by `/api/appraisals/my/reviews`, where the server
 * populates the parent appraisal (and its subject) plus the cycle. The bare
 * `AppraisalFeedback` returned by the feedback endpoints has neither, so the
 * two are deliberately separate types rather than one with optional fields —
 * the review list always has them, and the feedback form never does.
 */
export interface ReviewRequest extends AppraisalFeedback {
  appraisal: {
    _id: string;
    state: AppraisalState;
    employee: PersonRef;
  } | null;
  cycle: { _id: string; name: string; feedbackDeadline?: string } | null;
  /**
   * Present only on `GET /api/appraisals/my/reviews` rows when HR sent the
   * CALLER (the reviewer) a reminder that is still outstanding — the
   * controller suppresses the field when `reason === 'feedback'` but the
   * row's own status is no longer `pending`. Absent (not null) otherwise.
   */
  nudge?: AppraisalNudge;
}

export interface Appraisal {
  _id: string;
  state: AppraisalState;
  employee: PersonRef;
  manager: PersonRef;
  cycle: {
    _id: string;
    name: string;
    feedbackDeadline?: string;
    status: string;
  };
  summary?: string;
  finalRating?: number;
  /**
   * What was agreed for the next period. At least one is required to release.
   * The next cycle's self and manager forms open with these.
   */
  commitments?: AppraisalCommitment[];
  releasedAt?: string;
  acknowledgedAt?: string;
  employeeResponse?: string;
  /**
   * Present only for manager/hr (`canSeeReviewerNames: true` — see
   * PeerNomination above); absent entirely for the subject, whom
   * projectAppraisalForViewer strips this field for on the server.
   */
  peerNominations?: PeerNomination[];
  /**
   * Present only on `GET /api/appraisals/my` rows when HR has sent the
   * SUBJECT a reminder that is still outstanding for the row's state (see
   * AppraisalNudge). Absent (not null) when there is no active nudge.
   */
  nudge?: AppraisalNudge;
}

export type QuestionType =
  | 'rating'
  | 'text'
  | 'likert'
  | 'choice'
  | 'yes_no'
  | 'scale';

export interface AppraisalQuestion {
  _id: string;
  type: QuestionType;
  label: string;
  helpText?: string;
  required: boolean;
  scaleMax?: number;
  /** Options for choice / multi-select questions. */
  options?: string[];
  /** When true the choice question allows multiple selections. */
  multiple?: boolean;
  /** Custom low/high labels for likert / scale questions. */
  scaleLabels?: { low?: string; high?: string };
  askOf: FeedbackKind[];
}

export interface AppraisalSection {
  title: string;
  questions: AppraisalQuestion[];
}

/** A single agreed action for the next period. */
export interface AppraisalCommitment {
  text: string;
}

/** What the employee agreed to last cycle, replayed at the top of this one. */
export interface PriorCommitments {
  cycleName: string | null;
  releasedAt: string | null;
  commitments: AppraisalCommitment[];
}

export interface ReviewerForm {
  feedback: AppraisalFeedback;
  kind: FeedbackKind;
  subject: PersonRef | null;
  cycleName: string;
  deadline: string | null;
  sections: AppraisalSection[];
  /**
   * Null on peer forms (a colleague's agreed actions are not peer business)
   * and on anyone's first-ever appraisal.
   */
  priorCommitments: PriorCommitments | null;
  /**
   * `withheldFrom` is a stronger claim than `anonymousTo` and is what peer
   * forms now carry: the subject never receives the row, rather than receiving
   * it with the name stripped.
   */
  visibility: { namedTo: string[]; anonymousTo: string[]; withheldFrom: string[] };
}

export interface AppraisalCycle {
  _id: string;
  name: string;
  status: 'draft' | 'collecting' | 'closed' | 'cancelled';
  feedbackDeadline?: string;
  launchedAt?: string;
  closedAt?: string;
  peerReviewEnabled: boolean;
  /**
   * Appraisal counts for THIS cycle, keyed by state — the same vocabulary
   * `CycleProgress.byState` uses, aggregated into the list response so the
   * cycles page can show per-row progress without a request per row.
   *
   * Optional because `GET /api/appraisal-cycles/:id` (fetchCycle) does not
   * carry it — only the list does. An empty object means a real cycle with no
   * appraisals; `undefined` means this payload never had counts.
   */
  byState?: Record<string, number>;
}

/** One appraisal that has sat in the same peer-review state too long. */
export interface StalledAppraisal {
  _id: string;
  state: AppraisalState;
  since: string;
  employee: PersonRef;
  manager: PersonRef;
}

export interface CycleProgress {
  byState: Record<string, number>;
  feedbackTotal: number;
  feedbackSubmitted: number;
  stalled: StalledAppraisal[];
}

/**
 * Thrown by `request()` for any non-ok response. Extends `Error` (not a
 * bespoke shape) so every existing `catch (e) { ... e.message }` call site
 * keeps working unchanged — this is additive, not a second HTTP idiom.
 * Failure bodies that carry a machine-readable `code` (currently only
 * `POST /api/appraisals/:id/release` → `LOW_PEER_RESPONSE_COUNT`) survive
 * onto the instance instead of being flattened into the message string, so
 * a caller that needs to branch on the reason can do
 * `err instanceof ApiError && err.code === 'LOW_PEER_RESPONSE_COUNT'` and
 * then read `approvedPeerCount` / `submittedPeerCount` / `threshold`
 * straight off the error. Endpoints that don't send a `code` simply leave
 * these fields `undefined`, so this costs nothing for the common case.
 */
export class ApiError extends Error {
  status: number;
  code?: string;
  approvedPeerCount?: number;
  submittedPeerCount?: number;
  threshold?: number;
  /**
   * Names of the inputs the server rejected, so a form can highlight them
   * rather than dumping a sentence at the top. Sent by the template endpoints
   * (`fields: ['sections']`) and by the global Mongoose ValidationError
   * handler, which sends `Object.keys(err.errors)`. Deliberately carried on
   * the error rather than parsed out of `message`: the global handler never
   * echoes the raw Mongoose message, precisely because it contains the
   * rejected value.
   */
  fields?: string[];
  /**
   * ISO instant at which a throttled action becomes allowed again. Currently
   * only `POST /api/appraisals/:id/nudge` → 429 `NUDGE_TOO_SOON`, whose UI
   * has to say *when* rather than just "too soon" — and offer `force: true`.
   */
  retryAfter?: string;

  constructor(body: any, status: number) {
    super(body?.message || `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code;
    this.approvedPeerCount = body?.approvedPeerCount;
    this.submittedPeerCount = body?.submittedPeerCount;
    this.threshold = body?.threshold;
    this.fields = body?.fields;
    this.retryAfter = body?.retryAfter;
  }
}

/**
 * Module-level auth token. The shell component sets it via
 * `setAuthToken(session.user.token)`; `request()` additionally falls back to
 * the NextAuth session itself when it is missing, so a page loaded directly
 * (deep link, refresh) still sends the `Authorization: Bearer` header that
 * the server's `protect()` middleware requires. Kept here rather than
 * threaded through every fetch function's signature to avoid changing 20+
 * call sites — the token changes only on login/logout, not per-request.
 */
let _authToken: string | null = null;
export function setAuthToken(token: string | null) {
  _authToken = token;
}

/** Decode the JWT payload without verification (browser-side only, for reading our own cookies). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1])) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Read the backend access token from the NextAuth session cookie. Synchronous
 * — no network call — so it works even when `getSession()` is failing (HMR,
 * server restart, CLIENT_FETCH_ERROR). The cookie stores the full NextAuth JWT;
 * our `session` callback stamps `accessToken` into the payload.
 */
function readTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null; // SSR guard
  const match = document.cookie.match(
    /(?:^|;\s*)next-auth\.session-token=([^;]+)/
  );
  if (!match) return null;
  const payload = decodeJwtPayload(decodeURIComponent(match[1]));
  return (payload?.accessToken as string) || null;
}

/**
 * Resolve the access token for a request. Three-tier fallback:
 *   1. Module-level cache (set by shell component or previous call)
 *   2. NextAuth session cookie (synchronous, instant)
 *   3. NextAuth `getSession()` (async — hits `/api/auth/session`)
 *
 * Returns null when signed out, in which case the server correctly answers 401.
 */
async function resolveAuthToken(): Promise<string | null> {
  if (_authToken) return _authToken;

  // Fast path: read directly from the session cookie (no network)
  const cookieToken = readTokenFromCookie();
  if (cookieToken) {
    _authToken = cookieToken;
    return cookieToken;
  }

  // Slow path: ask the SessionProvider (async, may fail during HMR)
  try {
    const session = await getSession();
    const token =
      (session?.user as { token?: string } | undefined)?.token ?? null;
    if (token) _authToken = token;
    return token;
  } catch {
    return null;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await resolveAuthToken();
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || body?.success === false) {
    throw new ApiError(body, res.status);
  }
  return body.data as T;
}

export const fetchMyAppraisals = () =>
  request<Appraisal[]>('/api/appraisals/my');
export const fetchMyReviews = () =>
  request<ReviewRequest[]>('/api/appraisals/my/reviews');
export const fetchTeamAppraisals = () =>
  request<Appraisal[]>('/api/appraisals/team');

export const fetchAppraisal = (id: string) =>
  request<{
    appraisal: Appraisal;
    feedback: AppraisalFeedback[];
    /**
     * The full template behind the appraisal's cycle (every `askOf` kind,
     * unfiltered — see appraisal.controller.js#getAppraisal), so a viewer can
     * resolve each feedback row's `answers[].questionId` to its `label`,
     * `type` and `scaleMax`. Not present on any other endpoint's response.
     */
    sections: AppraisalSection[];
    access: AppraisalAccess;
    /** Peers whose nomination has been approved (not yet necessarily responded). */
    approvedPeerCount: number;
    /** Approved peers who have actually submitted feedback. */
    peerResponseCount: number;
    /**
     * Per-rating-question self/manager/peer comparison, computed server-side
     * from the ALREADY-PROJECTED feedback — see appraisal.helpers.js
     * #buildComparison. One row per `type: 'rating'` question in template
     * order; text questions are absent, since a prose answer has no mean and
     * reads better in the feedback cards.
     *
     * `peerBreakdown` is `null` for the subject, and not merely gated off:
     * the server strips each peer row's `reviewer` before this is built, so
     * there is nothing to populate it from. Do not try to reconstruct it
     * client-side from `feedback` — for the subject that array has no
     * reviewer either, by design.
     */
    comparison: ComparisonRow[];
  }>(`/api/appraisals/${id}`);

export const fetchReviewerForm = (id: string) =>
  request<ReviewerForm>(`/api/appraisal-feedback/${id}`);

export const saveFeedbackDraft = (id: string, answers: AppraisalAnswer[]) =>
  request<AppraisalFeedback>(`/api/appraisal-feedback/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ answers }),
  });

export const submitFeedback = (id: string, answers: AppraisalAnswer[]) =>
  request<AppraisalFeedback>(`/api/appraisal-feedback/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });

export const declineFeedback = (id: string, reason?: string) =>
  request<{ status: FeedbackStatus; declinedAt: string }>(
    `/api/appraisal-feedback/${id}/decline`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }
  );

export const saveSummary = (
  id: string,
  summary: string,
  finalRating?: number,
  /**
   * Omit to leave stored commitments untouched — the server distinguishes an
   * absent key from an explicit `[]`, which clears them. Autosave must pass
   * `undefined`, never `[]`, or it silently wipes the manager's draft actions.
   */
  commitments?: AppraisalCommitment[]
) =>
  request<Appraisal>(`/api/appraisals/${id}/summary`, {
    method: 'POST',
    body: JSON.stringify({ summary, finalRating, commitments }),
  });

/**
 * `confirmLowPeerCount` re-sends the release after the caller has seen and
 * accepted the `LOW_PEER_RESPONSE_COUNT` warning (see `ApiError` above) —
 * the server otherwise rejects release with HTTP 400 when too few approved
 * peers have submitted.
 */
export const releaseAppraisal = (
  id: string,
  confirmLowPeerCount?: boolean,
  /**
   * At least one is required. Omit only when they were already persisted via
   * saveSummary — the server falls back to what is stored, and refuses with
   * `code: 'NO_COMMITMENTS_AGREED'` when that is empty too.
   */
  commitments?: AppraisalCommitment[]
) =>
  request<Appraisal>(`/api/appraisals/${id}/release`, {
    method: 'POST',
    body: JSON.stringify({ confirmLowPeerCount, commitments }),
  });

export const acknowledgeAppraisal = (id: string, employeeResponse?: string) =>
  request<Appraisal>(`/api/appraisals/${id}/acknowledge`, {
    method: 'POST',
    body: JSON.stringify({ employeeResponse }),
  });

export const getNomination = (id: string) =>
  request<NominationView>(`/api/appraisals/${id}/nomination`);

export const getEligiblePeers = (id: string) =>
  request<PersonRef[]>(`/api/appraisals/${id}/eligible-peers`);

/**
 * Save or submit a peer nomination.
 *
 * `submit: false` stores the list and leaves the appraisal in `nominating`,
 * so the employee can come back and finish it. Submitting is one-way: it
 * advances to `pending_peer_approval`, after which `canNominate` is false and
 * this endpoint 403s. The minimum peer count is enforced only on submit — a
 * draft is allowed to be incomplete — but the maximum applies to both.
 */
export const nominatePeers = (
  id: string,
  userIds: string[],
  { submit = true }: { submit?: boolean } = {}
) =>
  request<{ state: AppraisalState; nominated: number; draft: boolean }>(
    `/api/appraisals/${id}/nominate`,
    {
      method: 'POST',
      body: JSON.stringify({ userIds, submit }),
    }
  );

export const approvePeers = (
  id: string,
  payload: { approve?: string[]; reject?: string[]; add?: string[] }
) =>
  request<{ state: AppraisalState; peersAdded: number }>(
    `/api/appraisals/${id}/approve-peers`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );

/**
 * Adds peer reviewers directly, outside the nominate/approve flow — used by
 * HR/manager to top up a short peer list after the fact (see
 * appraisal.controller.js#backfillPeers).
 */
export const backfillPeers = (id: string, add: string[]) =>
  request<{ state: AppraisalState; peersAdded: number }>(
    `/api/appraisals/${id}/peers`,
    {
      method: 'POST',
      body: JSON.stringify({ add }),
    }
  );

export const skipPeers = (id: string) =>
  request<{ state: AppraisalState }>(`/api/appraisals/${id}/skip-peers`, {
    method: 'POST',
  });

export const fetchCycles = () =>
  request<AppraisalCycle[]>('/api/appraisal-cycles');

/**
 * Single-cycle fetcher for `GET /api/appraisal-cycles/:id` (see
 * appraisalCycle.controller.js#getCycle). This endpoint existed on the
 * server before Task 10 but had no client wrapper — `fetchCycles()` only
 * gets the list, and the cycle detail screen needs one cycle by id without
 * re-fetching (and re-scanning) the whole list.
 */
export const fetchCycle = (id: string) =>
  request<AppraisalCycle>(`/api/appraisal-cycles/${id}`);

/**
 * `peerReviewEnabled` IS honoured — an earlier note here claimed the server
 * silently dropped it, which was wrong and would have sent the next reader
 * off to "fix" a working switch. createCycle destructures it and passes it
 * through raw so Mongoose's Boolean cast handles a non-JSON client, and
 * `undefined` falls back to the schema default of true.
 */
export const createCycle = (payload: {
  name: string;
  /**
   * When employees must have nominated their peers by. Only meaningful with
   * `peerReviewEnabled` — nothing nominates on a self+manager cycle.
   */
  nominationDeadline?: string;
  feedbackDeadline?: string;
  peerReviewEnabled?: boolean;
  /**
   * The template FAMILY id, never a version `_id`. The server resolves the
   * family to its current latest at create and re-resolves it once at launch;
   * sending a specific version's id defeats both and 400s (see
   * appraisalCycle.controller.js#createCycle). Omit to get the tenant default.
   */
  templateFamily?: string;
}) =>
  request<AppraisalCycle>('/api/appraisal-cycles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const launchCycle = (id: string, employeeIds?: string[]) =>
  request<{
    created: number;
    alreadyExisted: number;
    /**
     * As of this Phase 2 server change, `employee` is actually a populated
     * `PersonRef`, not the bare id string this type still claims — left
     * un-widened here because `cycle-detail.tsx` renders `s.employee`
     * directly as the id text (see its own comment) and widening the type
     * without touching that UI file breaks the build. Task 11 is
     * service-layer-only; whichever task next touches cycle-detail.tsx
     * should widen this to `PersonRef` and update the render together.
     */
    // Populated by launchCycle (appraisalCycle.controller.js), which resolves
    // each skipped id to a user so HR has a name to chase. Falls back to
    // `{ _id }` alone when the user record cannot be found, hence the
    // optional name fields on PersonRef.
    skipped: { employee: PersonRef; reason: string }[];
  }>(`/api/appraisal-cycles/${id}/launch`, {
    method: 'POST',
    body: JSON.stringify({ employeeIds }),
  });

export const closeCycle = (id: string) =>
  request<AppraisalCycle>(`/api/appraisal-cycles/${id}/close`, {
    method: 'POST',
  });

export const fetchCycleProgress = (id: string) =>
  request<CycleProgress>(`/api/appraisal-cycles/${id}/progress`);

// ───────────────────────────────────────────────────────────────────────────
// Phase 3 — template versioning, the HR roster, nudges, and reporting.
//
// NOTE: `NudgeReason`, `AppraisalNudge`, `AppraisalQuestion` and
// `AppraisalSection` are NOT redeclared here — all four already exist above,
// and re-declaring an interface in the same module is a TS2300. The Phase 3
// types below reuse them.
// ───────────────────────────────────────────────────────────────────────────

/**
 * A template as the builder edits it. `_id` is absent on a question the user
 * has just added — the server mints it on save, which is what makes a new
 * question's id stable across every reviewer kind that answers it, and what
 * lets `buildComparison` line self up against manager on a single lookup.
 * An existing question's `_id` must be sent back UNCHANGED: the fork path
 * preserves rather than remints them, because stored answers reference them.
 */
export interface DraftQuestion extends Omit<AppraisalQuestion, '_id'> {
  _id?: string;
}

export interface DraftSection {
  _id?: string;
  title: string;
  questions: DraftQuestion[];
}

export interface AppraisalTemplateDoc {
  _id: string;
  tenant: string;
  /** Stable across every version. What a cycle stores and resolves. */
  family: string;
  version: number;
  isLatest: boolean;
  isDefault: boolean;
  isArchived: boolean;
  name: string;
  description?: string;
  sections: DraftSection[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  /**
   * Set by PUT only when the edit FORKED rather than saving in place — the
   * in-place branch omits the key entirely. Absent on every read, so it can
   * never be used to predict whether the next save will fork; it only reports
   * what the save just did.
   */
  forked?: boolean;
}

/** A row of `GET /api/appraisal-templates/:id/versions`, newest version first. */
export interface TemplateVersion {
  _id: string;
  version: number;
  isLatest: boolean;
  isArchived: boolean;
  name: string;
  createdBy?: string;
  createdAt?: string;
}

export interface RosterRow {
  _id: string;
  state: AppraisalState;
  employee: PersonRef | null;
  manager: PersonRef | null;
  /** `submittedAt` is sent as `?? null`, never omitted. */
  self: { status: FeedbackStatus; submittedAt: string | null } | null;
  mgr: { status: FeedbackStatus; submittedAt: string | null } | null;
  peers: {
    approved: number;
    submitted: number;
    declined: number;
    pending: number;
  };
  /**
   * Who is holding this appraisal up, and why. **In `collecting` this names
   * PEER REVIEWERS** — which is exactly why the roster endpoint is HR-only by
   * mount point (it sits on the admin-gated cycle router) and must never be
   * rendered anywhere the subject can reach.
   *
   * `target` degrades to a bare `{ _id }` when the person could not be
   * resolved; `PersonRef`'s name fields are already optional, which covers it.
   */
  outstanding: { reason: NudgeReason; target: PersonRef }[];
  lastNudge: {
    sentAt: string;
    channel: 'app' | 'email';
    reason: NudgeReason;
  } | null;
}

export interface NudgeResult {
  _id: string;
  sentAt: string;
  /**
   * What actually went out. Note this is `'app'` whenever an email was
   * requested but FAILED — the in-app reminder still landed, and calling it
   * 'email' would tell HR to stop chasing.
   */
  channel: 'app' | 'email';
  reason: NudgeReason;
  /**
   * False for a plain in-app nudge as well as for a failed email, so this
   * alone does not mean "something went wrong". Branch on
   * `channel === 'email'` requested && `!emailSent`, or simply on
   * `emailError` being set.
   */
  emailSent: boolean;
  /** Set only when an email was attempted and did not send. */
  emailError: string | null;
}

export interface QuestionStat {
  questionId: string;
  sectionTitle: string;
  label: string;
  /** Genuinely absent (not null) when the question never set one. */
  scaleMax?: number;
  self: { mean: number | null; n: number };
  manager: { mean: number | null; n: number };
  peer: { mean: number | null; n: number };
}

export interface CycleReport {
  releasedCount: number;
  /**
   * Counts do NOT necessarily sum to `releasedCount` — an appraisal released
   * without a final rating is still released, and inventing a `0` bucket for
   * it would fabricate a bad review. Caption it "N released, M scored".
   */
  finalRatingHistogram: { rating: number; count: number }[];
  questionStats: QuestionStat[];
}

export interface ComparisonRow {
  // buildComparison emits these three as EXPLICIT null (`?? null`, and a
  // typeof ternary for scaleMax), never undefined.
  sectionTitle: string | null;
  /** A raw ObjectId server-side; a string by the time it has been through JSON. */
  questionId: string;
  label: string | null;
  /** Never defaulted to 5 — a missing scale means the UI should not draw a bar. */
  scaleMax: number | null;
  /**
   * Which reviewer kinds this question is asked of. Present so the UI can
   * render a bucket nobody was ever asked as "not asked", rather than as an
   * empty bar that reads as "asked, and nobody responded" — a different and
   * much worse claim to make about someone's review.
   */
  askOf: FeedbackKind[];
  self: number | null;
  manager: number | null;
  /**
   * `mean` is null when `suppressed` — fewer than 2 peer responses FOR THIS
   * QUESTION (suppression is per question, not per appraisal, so `n` really
   * does differ row to row). Withheld outright rather than rounded or fuzzed:
   * a perturbed number is still a number to reason backwards from.
   */
  peer: { mean: number | null; n: number; suppressed: boolean };
  /**
   * Null for any viewer who may not see reviewer names. Not an empty array:
   * `[]` reads as "no peers responded", which is a different fact.
   */
  peerBreakdown: { reviewer: PersonRef; rating: number }[] | null;
}

/** Latest, non-archived version of every family the tenant owns. */
export const fetchTemplates = () =>
  request<AppraisalTemplateDoc[]>('/api/appraisal-templates');

/**
 * The single-form read. Unlike the list, this carries `hasLaunchedCycle` —
 * the same predicate `updateTemplate` branches on, so the editor can warn that
 * saving will create version N+1 BEFORE the save rather than after. Do not
 * substitute `forked` for it: that flag is absent on every read and only ever
 * describes a save that already happened.
 */
export const fetchTemplate = (id: string) =>
  request<AppraisalTemplateDoc & { hasLaunchedCycle: boolean }>(
    `/api/appraisal-templates/${id}`
  );

export const fetchTemplateVersions = (id: string) =>
  request<TemplateVersion[]>(`/api/appraisal-templates/${id}/versions`);

export const createTemplate = (body: {
  name: string;
  description?: string;
  sections: DraftSection[];
}) =>
  request<AppraisalTemplateDoc>('/api/appraisal-templates', {
    method: 'POST',
    body: JSON.stringify(body),
  });

/**
 * Saves in place while no launched cycle is pinned to this version, and forks
 * a new version once one is — in which case the response carries
 * `forked: true` and a NEW `_id`, and this id becomes a superseded version the
 * server will refuse to edit. Always route off the response, never off the id
 * you sent.
 */
export const updateTemplate = (
  id: string,
  body: { name: string; description?: string; sections: DraftSection[] }
) =>
  request<AppraisalTemplateDoc>(`/api/appraisal-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

/** Archives the whole family. The server refuses on the tenant's default form. */
export const archiveTemplate = (id: string) =>
  request<{ family: string | null; archived: boolean }>(
    `/api/appraisal-templates/${id}/archive`,
    { method: 'POST' }
  );

// ---------------------------------------------------------------------------
// AI drafting aids
//
// None of these write anything. Each returns a sanitized DRAFT for the editor
// to preview — the server has already dropped out-of-enum types, re-scoped
// scored questions back onto the self form, and clamped every schema bound —
// and HR decides whether it lands in the draft. Saving is still the existing
// createTemplate/updateTemplate path, which owns the version fork.
// ---------------------------------------------------------------------------

/** The short brief HR fills in before generating a whole form. */
export interface TemplateBrief {
  role?: string;
  department?: string;
  purpose?: string;
  notes?: string;
  /** Which reviewer kinds this form is for. Generation is scoped to these. */
  audiences: FeedbackKind[];
  /**
   * Off by default, and deliberately so: scored questions are generated for
   * the employee and their manager only, matching the seeded default form.
   * Peers get open-text questions asking for a specific incident instead —
   * a peer in another team has no basis to score a competency, and a guess
   * averaged into a mean reads as measurement. Tick this to override.
   */
  allowPeerScoring?: boolean;
  sectionCount?: number;
  questionsPerSection?: number;
}

export const aiGenerateTemplate = (body: TemplateBrief) =>
  request<{ name: string; description?: string; sections: DraftSection[] }>(
    '/api/appraisal-templates/ai/template',
    { method: 'POST', body: JSON.stringify(body) }
  );

/**
 * A new section, or more questions for one that exists.
 *
 * Always send `existingSections` — it is what stops the model re-asking
 * questions the form already has. Set `expandSectionTitle` to grow a section
 * rather than add one; the response then carries only the NEW questions.
 */
export const aiGenerateSection = (body: {
  role?: string;
  department?: string;
  notes?: string;
  audiences: FeedbackKind[];
  /** See TemplateBrief.allowPeerScoring. */
  allowPeerScoring?: boolean;
  questionCount?: number;
  expandSectionTitle?: string;
  existingSections: DraftSection[];
}) =>
  request<DraftSection>('/api/appraisal-templates/ai/section', {
    method: 'POST',
    body: JSON.stringify(body),
  });

/**
 * Per-question assist. `mode` decides which keys the model is allowed to
 * change — the server merges its proposal onto the question you sent rather
 * than replacing it, so a label rewrite cannot flip the type or re-scope
 * `askOf`. The response is the COMPLETE question, `_id` included when the one
 * you sent had it.
 */
export const aiAssistQuestion = (body: {
  mode: 'label' | 'options' | 'askOf';
  question: DraftQuestion;
  audiences: FeedbackKind[];
  role?: string;
  sectionTitle?: string;
}) =>
  request<DraftQuestion>('/api/appraisal-templates/ai/question', {
    method: 'POST',
    body: JSON.stringify(body),
  });

/** HR-only — see `RosterRow.outstanding`. */
export const fetchCycleRoster = (id: string, page = 1, limit = 50) =>
  request<{ rows: RosterRow[]; page: number; limit: number; total: number }>(
    `/api/appraisal-cycles/${id}/roster?page=${page}&limit=${limit}`
  );

/** HR-only, by mount point — cycle-wide performance data is not the subject's to read. */
export const fetchCycleReport = (id: string) =>
  request<CycleReport>(`/api/appraisal-cycles/${id}/report`);

/**
 * Throttled to one nudge per (appraisal, target, reason) per 12 hours; a
 * repeat inside the window rejects with 429 and
 * `ApiError.code === 'NUDGE_TOO_SOON'` plus `ApiError.retryAfter`. Pass
 * `force: true` to send anyway.
 */
export const sendNudge = (
  appraisalId: string,
  body: {
    target: string;
    reason: NudgeReason;
    channel: 'app' | 'email';
    force?: boolean;
  }
) =>
  request<NudgeResult>(`/api/appraisals/${appraisalId}/nudge`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
