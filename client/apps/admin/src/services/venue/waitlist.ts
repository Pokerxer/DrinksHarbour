import { venueRequest } from './api';

/**
 * Phase-4 E3 waitlist contracts (server/services/venue/waitlist.js +
 * routes/venue-ops.routes.js / venue-experience.routes.js) — DTOs mirror the
 * server serializers exactly; nothing is inferred or renamed client-side. Own
 * file per the transfers.ts/guestlists.ts per-concern precedent.
 *
 * A waitlist entry is a REQUEST for a table — never a booking, admission or
 * charge. The offer/accept/decline commands address the ENTRY directly (12 §5
 * shape — no locationId in the URL); the location comes from the entry row
 * server-side. Lifecycle: waiting → offered → accepted | declined | expired;
 * waiting|offered → cancelled (patch). An offer is a bounded capacity hold with
 * an acceptance deadline — accepting after the deadline is
 * WAITLIST_OFFER_EXPIRED (nothing confirmed, nothing charged).
 */

export type WaitlistState = 'waiting' | 'offered' | 'accepted' | 'declined' | 'expired' | 'cancelled';

export type VerifiedContactRoute = 'sms' | 'email' | 'in_app';

/** DTO mirror (services/venue/waitlist.js waitlistDTO). */
export type WaitlistEntryDTO = {
  id: string;
  locationId: string;
  occurrenceId: string | null;
  name: string;
  phone: string;
  verifiedContactRoute: VerifiedContactRoute;
  partySize: number;
  window: { earliestAt: string; latestAt: string };
  acceptableZones: string[];
  state: WaitlistState;
  /** The single active offer: the bounded capacity hold + the pending booking it rides. */
  offer: { at: string; expiresAt: string; claimRef: string; bookingRef: string } | null;
  version: number;
  createdBy: string | null;
  createdAt: string | null;
};

export type WaitlistPage = { items: WaitlistEntryDTO[]; next: string | null };

/** Join input (staff create; edit = full replacement). Window instants need explicit UTC offsets. */
export type JoinWaitlistInput = {
  name: string;
  phone: string;
  partySize: number;
  verifiedContactRoute: VerifiedContactRoute;
  window: { earliestAt: string; latestAt: string };
  acceptableZones?: string[];
};

export const listWaitlist = (token: string, locationId: string, query: { occurrenceId?: string; state?: WaitlistState; after?: string } = {}) => {
  const params = new URLSearchParams();
  if (query.occurrenceId) params.set('occurrenceId', query.occurrenceId);
  if (query.state) params.set('state', query.state);
  if (query.after) params.set('after', query.after);
  const suffix = params.toString();
  return venueRequest<WaitlistPage>(token, `/locations/${locationId}/waitlist${suffix ? `?${suffix}` : ''}`);
};

export const joinWaitlist = (token: string, locationId: string, body: { occurrenceId?: string; input: JoinWaitlistInput }) =>
  venueRequest<WaitlistEntryDTO>(token, `/locations/${locationId}/waitlist`, 'POST', body);

/** PATCH = edit (full replacement, waiting entries only) or cancel (waiting|offered). */
export const editWaitlistEntry = (token: string, locationId: string, entryId: string, body: { expectedVersion: number; input: JoinWaitlistInput }) =>
  venueRequest<WaitlistEntryDTO>(token, `/locations/${locationId}/waitlist/${entryId}`, 'PATCH', body);

export const cancelWaitlistEntry = (token: string, locationId: string, entryId: string, body: { expectedVersion: number }) =>
  venueRequest<WaitlistEntryDTO>(token, `/locations/${locationId}/waitlist/${entryId}`, 'PATCH', { cancel: true, expectedVersion: body.expectedVersion });

/** Offer input: bookingAt inside the entry's window; tables auto-picked when omitted. */
export type OfferWaitlistInput = { bookingAt: string; resourceIds?: string[] };

/** POST /api/venue-ops/waitlist/:id/offer — the 12 §5 shape. */
export const offerWaitlist = (token: string, entryId: string, body: { expectedVersion: number; input: OfferWaitlistInput }) =>
  venueRequest<WaitlistEntryDTO>(token, `/waitlist/${entryId}/offer`, 'POST', body);

/** Accept converts the hold through the normal acceptance flow; returns the linked booking summary. */
export type AcceptedWaitlistDTO = WaitlistEntryDTO & { acceptedBooking: { id: string; reference: string; status: string } };

export const acceptWaitlistOffer = (token: string, entryId: string) =>
  venueRequest<AcceptedWaitlistDTO>(token, `/waitlist/${entryId}/accept`, 'POST', {});

export const declineWaitlistOffer = (token: string, entryId: string, body: { expectedVersion: number }) =>
  venueRequest<WaitlistEntryDTO>(token, `/waitlist/${entryId}/decline`, 'POST', body);

/** Domain codes the panel branches on (server attaches them to the error). */
export const WAITLIST_OFFER_EXPIRED = 'WAITLIST_OFFER_EXPIRED';
export const WAITLIST_NOT_OFFERED = 'WAITLIST_NOT_OFFERED';
