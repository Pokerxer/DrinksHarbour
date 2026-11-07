import { venueRequest } from './api';

/**
 * Phase-4 E4 packages contracts (server/services/venue/packages.js +
 * package-commitments.js + package-lifecycle.js, routes
 * /locations/:locationId/packages|package-commitments*) — DTOs mirror the
 * server serializers exactly; nothing is inferred or renamed client-side. Own
 * file per the transfers.ts/waitlist.ts per-concern precedent.
 *
 * A package is a versioned DEFINITION (sellable package line + ≤12 tracked
 * components + optional included admissions + optional table plan). A COMMIT
 * is the coordinated all-or-nothing reservation (tables + stock + the one
 * `table_inclusion` entitlement); SERVES are tracked stock hand-outs
 * (COMPONENT_EXHAUSTED beyond the snapshot); UPGRADES are delta-only (same
 * snapshot/entitlement grown, tables join-only); RELEASE returns unreserved
 * stock, releases the claim and freezes unredeemed admissions. Money is NEVER
 * touched here — the canonical venue checkout bills the package line.
 */

export type PackageTablePlan = { tableIds?: string[]; seatCount?: number };

export type PackageComponent = { subProductId: string; sizeId: string; quantity: number };

export type PackageDTO = {
  id: string;
  locationId: string;
  occurrenceId: string | null;
  name: string;
  active: boolean;
  version: number;
  packageLine: { subProductId: string; sizeId: string };
  components: PackageComponent[];
  includedAdmissions: number;
  tablePlan: PackageTablePlan;
  createdAt: string | null;
};

export type PackageQuoteLineDTO = {
  name: string;
  subproductId: string;
  sizeId: string | null;
  quantity: number;
  unitPriceMinor: number;
  netMinor: number;
  taxRate: number;
  taxMinor: number;
};

export type PackageQuoteDTO = {
  packageId: string;
  name: string;
  version: number;
  line: PackageQuoteLineDTO;
  components: PackageComponent[];
  includedAdmissions: number;
  tablePlan: PackageTablePlan;
};

export type CommitmentState = 'committed' | 'compensated' | 'released';

export type CommitmentDTO = {
  id: string;
  locationId: string;
  occurrenceId: string | null;
  packageId: string;
  name: string;
  state: CommitmentState;
  version: number;
  components: PackageComponent[];
  includedAdmissions: number;
  tablePlan: PackageTablePlan;
  tableClaimId: string | null;
  tableResourceIds: string[];
  admissionEntitlementId: string | null;
  stockReservations: Array<{ subProductId: string; sizeId: string; quantity: number; consumed: number; batchCount: number }>;
  businessDate: string;
  releasedAt: string | null;
  createdAt: string | null;
};

export type RedemptionDTO = {
  id: string;
  commitmentId: string;
  componentIndex: number;
  quantity: number;
  sequence: number;
  at: string | null;
  by: string;
};

export const listPackages = (token: string, locationId: string) =>
  venueRequest<{ items: PackageDTO[]; next: string | null }>(token, `/locations/${locationId}/packages`);

export type PackageInput = {
  name?: string;
  packageSubProductId?: string;
  sizeId?: string;
  components?: Array<{ subProductId: string; sizeId: string; quantity: number }>;
  includedAdmissions?: number;
  tablePlan?: PackageTablePlan;
};

export const createPackage = (token: string, locationId: string, body: { input: PackageInput }) =>
  venueRequest<PackageDTO>(token, `/locations/${locationId}/packages`, 'POST', body);

export const updatePackage = (token: string, locationId: string, packageId: string, body: { expectedVersion: number; input: Partial<PackageInput> & { active?: boolean } }) =>
  venueRequest<PackageDTO>(token, `/locations/${locationId}/packages/${packageId}`, 'PATCH', body);

export const quotePackage = (token: string, locationId: string, packageId: string) =>
  venueRequest<PackageQuoteDTO>(token, `/locations/${locationId}/packages/${packageId}/quote`);

export const listCommitments = (token: string, locationId: string, query: { state?: CommitmentState } = {}) => {
  const params = new URLSearchParams();
  if (query.state) params.set('state', query.state);
  const suffix = params.toString();
  return venueRequest<{ items: CommitmentDTO[]; next: string | null }>(token, `/locations/${locationId}/package-commitments${suffix ? `?${suffix}` : ''}`);
};

export type CommitInput = { packageId: string; expectedVersion: number; occurrenceId?: string | null; bookingAt?: string | null; tableIds?: string[] | null };

export const commitPackage = (token: string, locationId: string, body: { input: CommitInput }) =>
  venueRequest<CommitmentDTO>(token, `/locations/${locationId}/package-commitments`, 'POST', body);

export const releaseCommitment = (token: string, locationId: string, commitmentId: string) =>
  venueRequest<CommitmentDTO>(token, `/locations/${locationId}/package-commitments/${commitmentId}/release`, 'POST', {});

export type UpgradeInput = { addedAdmissions?: number; addedComponents?: PackageComponent[]; addedTableIds?: string[] };

export const upgradeCommitment = (token: string, locationId: string, commitmentId: string, body: { expectedVersion: number; input: UpgradeInput }) =>
  venueRequest<CommitmentDTO>(token, `/locations/${locationId}/package-commitments/${commitmentId}/upgrade`, 'POST', body);

export const redeemComponent = (token: string, locationId: string, commitmentId: string, body: { input: { componentIndex: number; quantity: number } }) =>
  venueRequest<RedemptionDTO>(token, `/locations/${locationId}/package-commitments/${commitmentId}/redeem`, 'POST', body);
