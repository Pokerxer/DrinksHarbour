import { venueRequest } from './api';

/**
 * Phase-4 E2 door contracts (server/services/venue/door.js + admissions.js +
 * routes/venue-ops.routes.js) — DTOs mirror the server serializers exactly.
 * The server enforces the assignment rule (an actor may only work occurrences
 * where their id is in doorStaffIds) and returns MINIMUM details from a scan:
 * name + partySize + result, nothing else. Codes the panel branches on:
 * TOKEN_ALREADY_USED, PARTY_SIZE_EXCEEDED, ADMISSION_POLICY_REFUSED,
 * EVENT_CLOSED, CAPACITY_UNAVAILABLE, VENUE_PERMISSION_DENIED.
 */

/** Door occurrence picker row (services/venue/door.js doorOccurrenceDTO). */
export type DoorOccurrenceDTO = {
  id: string;
  locationId: string;
  eventSlug: string;
  name: string;
  occurrenceDate: string;
  startAt: string | null;
  endAt: string | null;
  capacity: { maxGuests: number } | null;
  guestsAdmitted: number;
  agePolicy: { minimumAge?: number; admissionTerms: string } | null;
  admissionPolicy: { maxReEntries: number };
};

/** Scan result — the server's minimum-details contract. */
export type DoorScanResult = {
  name: string;
  partySize: number;
  result: 'admitted' | 're_entered';
};

/** Redemption ledger row (services/venue/admissions.js redemptionDTO). */
export type RedemptionDTO = {
  id: string;
  occurrenceId: string;
  entitlementId: string;
  token: string;
  guests: number;
  kind: 'entry' | 're-entry';
  reEntryOf: string | null;
  at: string | null;
  by: string | null;
  deviceId: string | null;
};

export const listDoorOccurrences = (token: string, locationId: string) =>
  venueRequest<{ items: DoorOccurrenceDTO[] }>(token, `/locations/${locationId}/door/occurrences`);

export const redeemToken = (token: string, locationId: string, occurrenceId: string, body: { token: string; guests: number; ageVerified: boolean; deviceId?: string }) =>
  venueRequest<DoorScanResult>(token, `/locations/${locationId}/events/${occurrenceId}/redeem`, 'POST', body);

export const redeemReEntry = (token: string, locationId: string, occurrenceId: string, body: { token: string; guests: number; deviceId?: string }) =>
  venueRequest<DoorScanResult>(token, `/locations/${locationId}/events/${occurrenceId}/redeem-reentry`, 'POST', body);

export const listRedemptions = (token: string, locationId: string, occurrenceId: string, after?: string) =>
  venueRequest<{ items: RedemptionDTO[]; next: string | null }>(
    token,
    `/locations/${locationId}/events/${occurrenceId}/redemptions${after ? `?after=${encodeURIComponent(after)}` : ''}`,
  );

/** Door-staff assignment is occurrence configuration (events.write). */
export const assignDoorStaff = (token: string, locationId: string, occurrenceId: string, body: { staffIds: string[] }) =>
  venueRequest<{ id: string; doorStaffIds: string[]; version: number }>(
    token,
    `/locations/${locationId}/events/${occurrenceId}/door-staff`,
    'POST',
    body,
  );
