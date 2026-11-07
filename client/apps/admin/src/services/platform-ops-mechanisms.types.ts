// Platform-ops mechanism/registry types + display constants (workstream
// UI-W). Separate focused module so the pre-existing platform-ops service
// transport file stays small; no imports needed (structural types only).
// Display-only label/empty-word texts follow the operations-lead queue-display
// precedent: the recorded reasons always come from the server verbatim.
import type { OperationsAuditEntry } from './platform-ops.service';

// Fee-treatment projection (workstream Fb): pure-record operator view with
// explicit not-recorded flow states and NO fee figures anywhere.
export type FeeTreatmentFlow = {
  flow: string;
  state: string;
  bearer: string | null;
  policyId?: string | null;
  policyVersion: number | null;
  decisionReference?: string | null;
  futureJournalTreatment?: string | null;
  historical?: {
    rule: string | null;
    state: string;
    reason: string;
    figures: string;
  };
  reason: string;
};
export type FeeTreatmentProjection = {
  projectionVersion: number;
  readOnly: boolean;
  note: string;
  statementFeed?: unknown;
  accounting: { feeAccountExists: boolean; note: string };
  flows: FeeTreatmentFlow[];
};

// Mechanisms queue (workstreams K + P): read-only kora/payout reservation
// states. Deliberately no reconcile controls — the commands are service-level.
export type MechanismQueueKind = 'kora_refund' | 'payout_transfer';
export type MechanismQueueEntry = {
  _id: string;
  order: string;
  child?: string;
  tenant: string | null;
  currency: string;
  amountMinor: number;
  statementVersion?: number;
  state: string;
  issue?: string;
  reason: string;
  createdAt?: string | null;
  ageDays: number | null;
};
export type MechanismQueueList = {
  mechanismQueueVersion: number;
  kind: MechanismQueueKind;
  entries: MechanismQueueEntry[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};
export type KoraReservationDetail = MechanismQueueEntry & {
  claim: string;
  providerReference: string;
  receiptTransactionId: string | null;
  fallbackAccepted: boolean;
  providerRefundId: string | null;
  policyVersion: number;
  remainderMinorAfter: number;
  reconcile: { supported: false; reason: string };
  audit: OperationsAuditEntry[];
};
export type PayoutTransferDetail = MechanismQueueEntry & {
  submittedTransferId: string | null;
  lastError: string | null;
  reviewedAt: string | null;
  balanceClaimedMinor: number;
  reconcile: { supported: false; reason: string };
  audit: OperationsAuditEntry[];
};
export type MechanismExceptionDetail =
  | KoraReservationDetail
  | PayoutTransferDetail;

// Policy registry (workstream UI-W): super-admin-only projection of each
// mechanism's policy recording state. Version rows carry whitelisted
// metadata only — never the recorded contract content or hashes.
export type RegistryVersionRow = {
  version: number;
  state: string | null;
  decisionReference: string | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
};
export type RegistryMechanism = {
  mechanism: string;
  readOnly: true;
  flag: { name: string | null; enabled: boolean };
  flagNote?: string;
  policy: {
    state: 'none_recorded' | 'recorded';
    recordedVersions: number;
    versions: RegistryVersionRow[];
    activeVersion: number | null;
  };
  feeFlows?: FeeTreatmentFlow[];
  reason: string;
  failureState: 'none_recorded_all_surfaces_fail_closed' | null;
  resolutionNote?: string;
};
export type PolicyRegistry = {
  registryVersion: number;
  notice: string;
  readOnly: true;
  mechanisms: RegistryMechanism[];
};

export const MECHANISM_KINDS: MechanismQueueKind[] = [
  'kora_refund',
  'payout_transfer',
];
export const MECHANISM_KIND_LABEL: Record<MechanismQueueKind, string> = {
  kora_refund: 'Kora refund reservations',
  payout_transfer: 'Payout transfers',
};
export const MECHANISM_EMPTY_STATE: Record<MechanismQueueKind, string> = {
  kora_refund: 'No Kora refund reservations await platform review.',
  payout_transfer: 'No payout transfers await platform reconciliation review.',
};
