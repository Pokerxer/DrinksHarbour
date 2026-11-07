import { venueRequest } from './api';

/**
 * Phase-4 E2 guest-list contracts (server/services/venue/guestlists.js +
 * routes/venue-ops.routes.js / venue-experience.routes.js) — DTOs mirror the
 * server serializers exactly; nothing is inferred or renamed client-side. Own
 * file per the transfers.ts/gratuity.ts per-concern precedent.
 *
 * Lifecycle: requested → approved | denied; requested|approved → cancelled.
 * Approval gates ENTITLEMENT ISSUANCE only — it is never a guarantee of
 * admission (the door's shared-cap ledger enforces the cap).
 */

export type GuestListState = 'requested' | 'approved' | 'denied' | 'cancelled';

/** DTO mirror (services/venue/guestlists.js guestListDTO). */
export type GuestListDTO = {
  id: string;
  locationId: string;
  occurrenceId: string;
  name: string;
  phone: string;
  partySize: number;
  state: GuestListState;
  allowedCount: number | null;
  cutoffAt: string | null;
  promoterRef: { id: string; name: string } | null;
  assignedStaffId: string | null;
  vip: { flagged: boolean; reason: string | null; by: string | null; at: string | null };
  restrictedNote: string | null;
  version: number;
  createdAt: string | null;
};

export type GuestListsPage = { items: GuestListDTO[]; next: string | null };

/** Approval input: cutoffAt (explicit-offset instant, not in the past) is required. */
export type ApproveGuestListInput = {
  cutoffAt: string;
  allowedCount?: number;
  vip?: { reason: string };
  restrictedNote?: string;
};

export const listGuestLists = (token: string, locationId: string, query: { occurrenceId?: string; state?: GuestListState; after?: string } = {}) => {
  const params = new URLSearchParams();
  if (query.occurrenceId) params.set('occurrenceId', query.occurrenceId);
  if (query.state) params.set('state', query.state);
  if (query.after) params.set('after', query.after);
  const suffix = params.toString();
  return venueRequest<GuestListsPage>(token, `/locations/${locationId}/guest-lists${suffix ? `?${suffix}` : ''}`);
};

export const addGuestList = (token: string, locationId: string, body: { occurrenceId: string; input: { name: string; phone: string; partySize: number; promoterRef?: { id: string; name: string } } }) =>
  venueRequest<GuestListDTO>(token, `/locations/${locationId}/guest-lists`, 'POST', body);

export const approveGuestList = (token: string, locationId: string, guestListId: string, body: { expectedVersion: number; input: ApproveGuestListInput }) =>
  venueRequest<GuestListDTO>(token, `/locations/${locationId}/guest-lists/${guestListId}/approve`, 'POST', body);

export const denyGuestList = (token: string, locationId: string, guestListId: string, body: { expectedVersion: number }) =>
  venueRequest<GuestListDTO>(token, `/locations/${locationId}/guest-lists/${guestListId}/deny`, 'POST', body);

export const cancelGuestList = (token: string, locationId: string, guestListId: string, body: { expectedVersion: number }) =>
  venueRequest<GuestListDTO>(token, `/locations/${locationId}/guest-lists/${guestListId}/cancel`, 'POST', body);

export const flagGuestListVip = (token: string, locationId: string, guestListId: string, body: { expectedVersion: number; flagged: boolean; reason?: string }) =>
  venueRequest<GuestListDTO>(token, `/locations/${locationId}/guest-lists/${guestListId}/flag-vip`, 'POST', body);

export const assignGuestListStaff = (token: string, locationId: string, guestListId: string, body: { expectedVersion: number; staffId: string | null }) =>
  venueRequest<GuestListDTO>(token, `/locations/${locationId}/guest-lists/${guestListId}/assign-staff`, 'POST', body);

/** Opaque attribution ONLY — never ownership or commission (umbrella invariant 4). */
export const assignGuestListPromoter = (token: string, locationId: string, guestListId: string, body: { expectedVersion: number; promoterRef: { id: string; name: string } | null }) =>
  venueRequest<GuestListDTO>(token, `/locations/${locationId}/guest-lists/${guestListId}/assign-promoter`, 'POST', body);

/**
 * Entitlements (server/services/venue/admissions.js): issuance ONLY from an
 * approved guest list; the token is generated server-side and shown once here
 * (staff surface) — the door scans it.
 */
export type EntitlementDTO = {
  id: string;
  locationId: string;
  occurrenceId: string;
  kind: 'guestlist' | 'ticket' | 'table_inclusion' | 'vip';
  sourceRef: string | null;
  label: string | null;
  issuedCount: number;
  usedCount: number;
  tokens: { token: string; partySize: number }[];
  agePolicySnapshot: { version: number; minimumAge?: number; admissionTerms: string } | null;
  expiresAt: string | null;
  createdAt: string | null;
};

export const issueEntitlement = (token: string, locationId: string, occurrenceId: string, body: { guestListId: string }) =>
  venueRequest<EntitlementDTO>(token, `/locations/${locationId}/events/${occurrenceId}/entitlements`, 'POST', body);

/** VIP host alerts (services/venue/host-alerts.js) — permitted info only. */
export type HostAlertDTO = {
  id: string;
  occurrenceId: string;
  kind: 'vip_arrival';
  name: string | null;
  partySize: number | null;
  action: 'admitted' | 're_entered' | null;
  provenance: { flaggedBy: string; reason: string; at: string } | null;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  createdAt: string | null;
};

export const listHostAlerts = (token: string, locationId: string, occurrenceId: string, after?: string) =>
  venueRequest<{ items: HostAlertDTO[]; next: string | null }>(
    token,
    `/locations/${locationId}/events/${occurrenceId}/host-alerts${after ? `?after=${encodeURIComponent(after)}` : ''}`,
  );
