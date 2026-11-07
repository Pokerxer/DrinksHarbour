import { venueRequest } from './api';
import type { SessionLineDTO, SessionSnapshotDTO } from './ops';

/**
 * S6 floor-transfer contracts (server/routes/venue-ops.routes.js + services/venue/
 * transfers.js / parties.js / move-lines.js) — DTOs mirror the server serializers
 * exactly (linesDTO spreads sessionDTO, which echoes `partyGroup` + `tableIds`
 * since S6); nothing is inferred or renamed client-side. Own file per the
 * `recipes.ts`/`gratuity.ts` per-concern precedent — `ops.ts` stays under the
 * 300-line discipline.
 *
 * Every command is visit-version-checked server-side (`expectedVersion` on the
 * URL visit; move-lines additionally accepts a per-entry destination version)
 * and rides `runVenueOperation` idempotency: a replayed command is a no-op, and
 * a same-source move/join/consolidate never cancels a tab.
 */

/** A visit snapshot plus its accepted lines (the server's linesDTO shape). */
export type VisitLinesDTO = SessionSnapshotDTO & { lines: SessionLineDTO[] };

/** POST /service-sessions/:id/move — the SAME visit moves to free tables in its location. */
export type MoveVisitInput = { targetTableIds: string[]; expectedVersion: number };

/** POST /service-sessions/:id/release-table — explicit reset outcome, never a booking cancellation. */
export type ReleaseOutcome = 'cleared' | 'transferred_away';
export type ReleaseTableInput = { outcome: ReleaseOutcome; expectedVersion: number };

/** POST /service-sessions/:id/join — operational grouping only; bills/deposits stay SEPARATE. */
export type JoinPartyInput = { targetSessionId: string; expectedVersion: number };

/** POST /service-sessions/:id/consolidate — manager action, refused once EITHER bill has collections. */
export type ConsolidateInput = { intoSessionId: string; expectedVersion: number };

/** POST /service-sessions/:id/move-lines — N unfired units of a line move to another visit. */
export type MoveLinesEntry = {
  lineId: string;
  /** The source line's known revision — a drift fails STATE_CHANGED server-side. */
  revision: number;
  quantity: number;
  toSessionId: string;
  /** Optional destination version check (absent = fresh read inside the transaction). */
  toExpectedVersion?: number;
};
export type MoveLinesInput = {
  lines: MoveLinesEntry[];
  /** Required when the destination context reprices the moved units (REPRICING_CONSENT_REQUIRED). */
  repricingConsent?: boolean;
  expectedVersion: number;
};

/** Domain code the client must branch on: consolidation is refused once either visit has collected money or consumed stock — the coordinated-payment surface is the existing separate bills. */
export const BILL_ALREADY_COLLECTED = 'BILL_ALREADY_COLLECTED';

/** POST returns the moved visit's linesDTO (same-source moves are idempotent no-ops). */
export const moveVisit = (token: string, sessionId: string, body: MoveVisitInput) =>
  venueRequest<VisitLinesDTO>(token, `/service-sessions/${sessionId}/move`, 'POST', body);

/** POST returns the released visit's sessionDTO (no lines remain). */
export const releaseTable = (token: string, sessionId: string, body: ReleaseTableInput) =>
  venueRequest<SessionSnapshotDTO>(token, `/service-sessions/${sessionId}/release-table`, 'POST', body);

/** POST — the caller joins the target's party group (or opens a new group). */
export const joinParty = (token: string, sessionId: string, body: JoinPartyInput) =>
  venueRequest<VisitLinesDTO>(token, `/service-sessions/${sessionId}/join`, 'POST', body);

/** POST — removes ONLY the caller's group link (idempotent when ungrouped). */
export const leaveParty = (token: string, sessionId: string, body: { expectedVersion: number }) =>
  venueRequest<VisitLinesDTO>(token, `/service-sessions/${sessionId}/leave-party`, 'POST', body);

/** POST — folds the URL visit into `intoSessionId` before any collection; 409 `BILL_ALREADY_COLLECTED` otherwise. */
export const consolidateBills = (token: string, sessionId: string, body: ConsolidateInput) =>
  venueRequest<VisitLinesDTO>(token, `/service-sessions/${sessionId}/consolidate`, 'POST', body);

/** POST — unfired/unallocated units only; fired (FIRED_LINES_LOCKED) or payer-allocated (LINE_ALLOCATED) lines never move. */
export const moveLines = (token: string, sessionId: string, body: MoveLinesInput) =>
  venueRequest<VisitLinesDTO>(token, `/service-sessions/${sessionId}/move-lines`, 'POST', body);
