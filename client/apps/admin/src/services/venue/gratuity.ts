import { venueRequest } from './api';

/**
 * S5 gratuity + financial-policy additive contracts
 * (server/services/venue/gratuity.js + models/VenueFinancialPolicy.js +
 * routes/venue-ops.routes.js) — DTOs mirror the server serializers exactly;
 * nothing is inferred or renamed client-side. Lives in its own service file
 * (the `recipes.ts` precedent) to keep `ops.ts` under the 300-line discipline.
 *
 * Allocation RECORDS ONLY: recording a row never mutates the receipt,
 * `Order.tipAmount` or any completed Paystack charge — the rows record who a
 * tip is FOR; the existing post-payment tip collection stays the only
 * authorised money movement.
 */

/** Additive S5 subdoc on the reviewed financial policy — recorded hints, never executed. */
export type GratuityAllocationPolicy = {
  mode: 'none' | 'staff' | 'shift';
  defaultStaffIds?: string[];
  shiftPolicyRef?: string;
};

/**
 * Additive S5 subdoc on the reviewed financial policy. Approval-gated
 * server-side (`SERVICE_CHARGE_POLICY_REVIEW_REQUIRED`): enablement without an
 * approved, decision-owned policy with an account mapping + receipt label
 * fails review; a zero-tax charge requires a named tax decision.
 */
export type ServiceChargePolicy = {
  enabled: boolean;
  /** Integer basis points of the eligible net (1–5000). Authored as % below. */
  rateBps?: number;
  appliesTo?: 'merchandise_net' | 'food_only';
  /** false = zero-tax line; requires a named `taxDecision`. */
  taxable?: boolean;
  taxDecision?: string;
  /** Default false — a service charge never falsely meets the minimum. */
  countsTowardMinimum?: boolean;
  /** Account.code strings from the tenant chart (validated server-side). */
  accounts?: { revenue: string; tax?: string };
  /** Receipt label, ≤80 characters. */
  displayLabel?: string;
};

export type GratuityShareInput = { staffId?: string; shiftId?: string; shareBps: number };

/** POST /service-sessions/:id/gratuity-allocations — shares must total exactly 10000 bps. */
export type RecordGratuityAllocationInput = {
  receiptId: string;
  sourceKind: 'pos' | 'payer';
  amountMinor: number;
  policyVersion: number;
  shares: GratuityShareInput[];
  /** Optional narrowing scope echoed by the staff route. */
  locationId?: string;
};

/** allocationDTO mirror (services/venue/gratuity.js) — `defaults` is echoed only when the approved policy carries the subdoc. */
export type GratuityAllocationDTO = {
  id: string;
  sessionId: string;
  receiptId: string;
  sourceKind: 'pos' | 'payer';
  amountMinor: number;
  policyVersion: number;
  allocations: { staffId?: string; shiftId?: string; shareBps: number; amountMinor: number }[];
  defaults?: { mode: 'none' | 'staff' | 'shift'; defaultStaffIds?: string[] };
  createdAt: string | null;
};

/** GET response — newest first (server sorts `createdAt: -1, _id: -1`). */
export type GratuityAllocationsListDTO = { allocations: GratuityAllocationDTO[] };

/** POST returns 201 (server contract); the shared venueRequest attaches the Idempotency-Key idiom. */
export const recordGratuityAllocation = (token: string, sessionId: string, body: RecordGratuityAllocationInput) =>
  venueRequest<GratuityAllocationDTO>(token, `/service-sessions/${sessionId}/gratuity-allocations`, 'POST', body);

/** GET the session's allocation records; the optional locationId narrows the staff read. */
export const listGratuityAllocations = (token: string, sessionId: string, locationId?: string) =>
  venueRequest<GratuityAllocationsListDTO>(
    token,
    `/service-sessions/${sessionId}/gratuity-allocations${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ''}`,
    'GET',
  );
