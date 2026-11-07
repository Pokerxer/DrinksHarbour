import { venueRequest } from './api';

/**
 * S3+S4 venue-ops contracts (server/routes/venue-ops.routes.js) — the DTOs mirror the
 * server serializers exactly (services/venue/service-sessions.js sessionDTO, lines.js
 * linesDTO, courses.js, presets.js, stations.js, preparation.js, print-jobs.js /
 * print-delivery.js); nothing is inferred or renamed client-side.
 *
 * Courses: `state` is the server-owned machine planned → hold → fired. Unfired
 * counts are derived client-side from the session lines (quantity − firedQuantity
 * of the lines carrying the courseId) — never from a server-provided badge.
 */

export type ServiceMode = 'dine-in' | 'counter_pickup';

export type ServicePresetDTO = {
  id: string;
  locationId: string;
  name: string;
  allowedModes: ServiceMode[];
  hours: { day: number; opens: string; closes: string; overnight?: boolean }[];
  exceptions: { date: string; closed: boolean; opens?: string; closes?: string; overnight?: boolean }[];
  requiredGuestFields: ('name' | 'phone' | 'partySize')[];
  paymentTiming: 'deferred' | 'per_order';
  priceListRef: string | null;
  taxContextRef: string | null;
  prepSlotPolicy: { maxConcurrent: number; leadMins: number } | null;
  version: number;
  createdAt: string | null;
};

/** Authoring input — the server POST/PATCH contract (services/venue/presets.js). */
export type PresetInput = {
  name: string;
  allowedModes: ServiceMode[];
  hours: { day: number; opens: string; closes: string; overnight?: boolean }[];
  exceptions: { date: string; closed: boolean; opens?: string; closes?: string; overnight?: boolean }[];
  requiredGuestFields: ('name' | 'phone' | 'partySize')[];
  paymentTiming: 'deferred' | 'per_order';
  priceListRef?: string | null;
  taxContextRef?: string | null;
  prepSlotPolicy?: { maxConcurrent: number; leadMins: number } | null;
};

export type StationDTO = {
  id: string;
  locationId: string;
  name: string;
  /** Menu-item category matches — routing maps a fired item's category to the station owning it. */
  categories: string[];
  staffIds: string[];
  deviceIds: string[];
  alertThresholdMins: number;
  isDefault: boolean;
  version: number;
  createdAt: string | null;
};

/** Authoring input — the server POST/PATCH contract (services/venue/stations.js). */
export type StationInput = {
  name: string;
  categories: string[];
  staffIds: string[];
  deviceIds: string[];
  alertThresholdMins: number;
  isDefault: boolean;
};

export type CourseState = 'planned' | 'hold' | 'fired';

export type CourseDTO = { courseId: string; name?: string; order: number; state: CourseState };

/** sessionDTO mirror (services/venue/service-sessions.js) — additive S3 fields present only when set. */
export type SessionSnapshotDTO = {
  id: string;
  tenantId: string;
  locationId: string;
  bookingId?: string;
  heldOrderId: string;
  billOrderId?: string;
  businessDate: string;
  state: string;
  version: number;
  lineVersion: number;
  identityVersion: number;
  serviceMode?: ServiceMode;
  presetId?: string;
  presetVersion?: number;
  courses?: CourseDTO[];
  /** S6 additive party-group echo — present only while the visit is grouped. */
  partyGroup?: { groupId: string; joinedAt: string };
  /** S6 additive table ids echo — always present (empty list = released visit). */
  tableIds: string[];
};

/** linesDTO line mirror — `courseId`/`firedQuantity` drive the course panel's unfired counts. */
export type SessionLineDTO = {
  lineId: string;
  revision: number;
  subProductId: string;
  sizeId: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  netMinor: number;
  taxMinor: number;
  firedQuantity: number;
  choices?: { groupId: string; optionId: string }[];
  note?: string;
  courseId?: string;
  frozenRecipeVersion?: { version: number; recipe: string };
};

/**
 * The open-visit snapshot read (GET bill) — the server's full linesDTO shape
 * (sessionDTO spread + `lines`), so every sessionDTO field is echoed here:
 * `courses` since S3, `partyGroup`/`tableIds` since S6.
 */
export type OpenVisitSnapshot = {
  id: string;
  tenantId: string;
  locationId: string;
  bookingId?: string;
  heldOrderId: string;
  billOrderId?: string;
  businessDate: string;
  state: 'open';
  version: number;
  lineVersion: number;
  identityVersion: number;
  serviceMode?: ServiceMode;
  presetId?: string;
  presetVersion?: number;
  courses?: CourseDTO[];
  partyGroup?: { groupId: string; joinedAt: string };
  tableIds: string[];
  lines: SessionLineDTO[];
};

export type PreparationState = 'pending' | 'preparing' | 'ready' | 'served';

/** itemDTO + the Task-5 read projection (unrouted flag, threshold, stale, waitingMs). */
export type PreparationItemDTO = {
  id: string;
  sessionId: string;
  roundId: string;
  lineId: string;
  revision: number;
  locationId: string;
  name?: string;
  quantity?: number;
  stationId?: string;
  state: PreparationState;
  firedAt: string;
  stateHistory: { from: PreparationState | null; to: PreparationState; actor: string; reason?: string; ref?: string; at: string }[];
  unrouted: boolean;
  thresholdMins: number | null;
  waitingMs: number;
  stale: boolean;
};

export type PreparationListDTO = {
  sessionId: string;
  locationId: string;
  now: string;
  items: PreparationItemDTO[];
};

/** Server POST /service-sessions contract — the visit snapshots {presetId, version, serviceMode} once. */
export type CreateSessionInput = {
  locationId: string;
  tableIds: string[];
  expectedTableVersions: number[];
  bookingId?: string;
  posSessionId?: string;
  presetId?: string;
  serviceMode?: ServiceMode;
  guest?: { name?: string; phone?: string; partySize?: number };
};

// ── Service presets (S3 Task 2) ──────────────────────────────────────────────
export const getPresets = (token: string, locationId: string) =>
  venueRequest<{ items: ServicePresetDTO[] }>(token, `/locations/${locationId}/service-presets`, 'GET');
export const createPreset = (token: string, locationId: string, input: PresetInput) =>
  venueRequest<ServicePresetDTO>(token, `/locations/${locationId}/service-presets`, 'POST', { input });
export const updatePreset = (token: string, locationId: string, presetId: string, body: { expectedVersion: number; input: PresetInput }) =>
  venueRequest<ServicePresetDTO>(token, `/locations/${locationId}/service-presets/${presetId}`, 'PATCH', body);

// ── Preparation stations (S3 station config) ────────────────────────────────
export const getStations = (token: string, locationId: string) =>
  venueRequest<{ items: StationDTO[] }>(token, `/locations/${locationId}/stations`, 'GET');
export const createStation = (token: string, locationId: string, input: StationInput) =>
  venueRequest<StationDTO>(token, `/locations/${locationId}/stations`, 'POST', { input });
export const updateStation = (token: string, locationId: string, stationId: string, body: { expectedVersion: number; input: StationInput }) =>
  venueRequest<StationDTO>(token, `/locations/${locationId}/stations/${stationId}`, 'PATCH', body);

// ── Courses (S3 Task 3) — fire reuses the round-fire path server-side ───────
export const fireCourse = (token: string, sessionId: string, courseId: string, expectedVersion: number) =>
  venueRequest<SessionSnapshotDTO & { lines: SessionLineDTO[]; round?: unknown }>(token, `/service-sessions/${sessionId}/courses/${courseId}/fire`, 'POST', { expectedVersion });
export const holdCourse = (token: string, sessionId: string, courseId: string, body: { expectedVersion: number; to: 'hold' | 'planned' }) =>
  venueRequest<SessionSnapshotDTO & { lines: SessionLineDTO[] }>(token, `/service-sessions/${sessionId}/courses/${courseId}/hold`, 'POST', body);
export const setCourses = (token: string, sessionId: string, body: { expectedVersion: number; courses: { courseId: string; name?: string }[] }) =>
  venueRequest<SessionSnapshotDTO & { lines: SessionLineDTO[] }>(token, `/service-sessions/${sessionId}/courses`, 'PUT', body);

// ── Session snapshot (existing GET bill route; courses echoed since S3) ─────
export const getOpenVisitSnapshot = (token: string, sessionId: string) =>
  venueRequest<OpenVisitSnapshot>(token, `/service-sessions/${sessionId}/bill`, 'GET');
export const createServiceSession = (token: string, input: CreateSessionInput) =>
  venueRequest<SessionSnapshotDTO>(token, '/service-sessions', 'POST', input);

// ── Preparation read + advancement (S3 Tasks 4/5) ───────────────────────────
export const getSessionPreparation = (token: string, sessionId: string, stationId?: string) =>
  venueRequest<PreparationListDTO>(token, `/service-sessions/${sessionId}/preparation${stationId ? `?stationId=${encodeURIComponent(stationId)}` : ''}`, 'GET');
export const advancePreparationItem = (token: string, itemId: string, body: { to: PreparationState; reason?: string; ref?: string }) =>
  venueRequest<PreparationItemDTO>(token, `/preparation/${itemId}/advance`, 'POST', body);

// ── S4 print jobs + device bridge ───────────────────────────────────────────
/**
 * Mirrors the server serializers EXACTLY (services/venue/print-jobs.js jobDTO /
 * ticketPayload, print-delivery.js, stations.js registerBridge/revokeBridge).
 * Delivery state moves only on the server (bridge pull → ack); the UI renders
 * it read-only. `duplicateOf` points at the original jobId for reprints and
 * amendment supersession — duplicates are visibly labelled, never hidden.
 */
export type PrintJobActionType = 'print' | 'reprint' | 'amendment' | 'cancel';
export type DeliveryState = 'queued' | 'delivered' | 'acknowledged' | 'failed';

/** Frozen safe ticket snapshot — venue-prep room shapes, no guest PII beyond line data. */
export type PrintJobPayload = {
  sessionId?: string;
  roundId?: string;
  roundNo?: number | null;
  firedAt?: string;
  ref?: string | null;
  reason?: string;
  to?: string;
  /** Reprints/recoveries are labelled duplicates of the original job. */
  label?: string;
  reprintOf?: string;
  items?: { lineId: string; revision: number; name: string; quantity: number; stationId?: string }[];
};

export type PrintJobDTO = {
  id: string;
  jobId: string;
  sessionId: string;
  locationId: string;
  stationId: string;
  roundId?: string;
  lineIds: string[];
  actionType: PrintJobActionType;
  duplicateOf?: string;
  deviceId?: string;
  deliveryState: DeliveryState;
  attempts: number;
  ackAt?: string;
  lastDeliveredAt?: string;
  lastError?: string;
  payload: PrintJobPayload;
  createdAt: string | null;
};

/** GET /service-sessions/:id/print-jobs — newest first, ≤100 jobs. */
export type PrintJobsListDTO = {
  sessionId: string;
  locationId: string;
  jobs: PrintJobDTO[];
};

/**
 * POST /locations/:locationId/device-bridge/register — the pull token is
 * minted server-side and returned ONCE in this response (only its sha-256
 * hash is stored). The UI must copy it immediately; it is never retrievable
 * again. Deliberately NOT a runVenueOperation: the raw token must never land
 * in the operation ledger.
 */
export type BridgeRegistrationDTO = { token: string; registeredAt: string };
/** POST /locations/:locationId/device-bridge/revoke — clears the hash. */
export type BridgeRevocationDTO = { registered: false };

export const listPrintJobs = (token: string, sessionId: string) =>
  venueRequest<PrintJobsListDTO>(token, `/service-sessions/${sessionId}/print-jobs`, 'GET');
/** Reprint is a ledger operation — the new job is a labelled duplicate (duplicateOf), zero new consumption events. */
export const reprintPrintJob = (token: string, sessionId: string, jobId: string) =>
  venueRequest<PrintJobDTO>(token, `/service-sessions/${sessionId}/print-jobs/${jobId}/reprint`, 'POST', {});
export const registerDeviceBridge = (token: string, locationId: string) =>
  venueRequest<BridgeRegistrationDTO>(token, `/locations/${locationId}/device-bridge/register`, 'POST', {});
export const revokeDeviceBridge = (token: string, locationId: string) =>
  venueRequest<BridgeRevocationDTO>(token, `/locations/${locationId}/device-bridge/revoke`, 'POST', {});
