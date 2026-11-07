// Platform-operations (super-admin/admin) read-only queue, readiness and
// audit-history transport. Separate from the merchant-only action surfaces:
// every call targets the /platform-ops API namespace, whose routes are
// authorize('super_admin','admin') gated server-side.
import { foundationRequest } from './market-foundation.service';
import type { FeeTreatmentProjection } from './platform-ops-mechanisms.types';

export type QueueKind = 'refund' | 'carrier' | 'return';

export type QueueEntry = {
  _id: string;
  merchantOrder?: string;
  booking?: string;
  order?: string;
  tenant: string;
  state?: string;
  dispositionState?: 'pending' | 'decided';
  amountMinor?: number | null;
  displayMinor?: number | null;
  currency?: string | null;
  issue?: string;
  reason: string;
  createdAt?: string | null;
  receivedAt?: string | null;
  ageDays: number | null;
};

export type DiscoveredClaim = {
  id?: string;
  reference?: string;
  transactionId?: string | null;
  amount?: number;
  currency?: string;
  paidAt?: string | null;
};

export type DiscoveredSource = {
  provider: string;
  identity: string;
  refundCapability: string;
  reason: string;
  claim: DiscoveredClaim;
};

export type DiscoveryResult = {
  status: 'resolved' | 'ambiguous' | 'unknown';
  reason?: string;
  sources: DiscoveredSource[];
};

export type FundingResolution = {
  status: string;
  kind?: string;
  target?: string;
  state?: string;
  id?: string;
  provider?: string;
  reference?: string;
  reason?: string;
};

export type OperationsAuditEntry = {
  action: string;
  actionCategory?: string;
  actorRole?: string;
  result?: string;
  errorMessage?: string;
  justification?: string;
  targetType?: string;
  targetId?: string | null;
  timestamp?: string;
};

export type QueueList = {
  queueVersion: number;
  kind: QueueKind;
  entries: QueueEntry[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};

export type ReconcileControl =
  | { supported: true; kind: 'refund'; requirement: string; wording: string }
  | { supported: true; kind: 'carrier'; requirement: string; providerIdKnown: boolean }
  | { supported: false; kind: undefined; reason: string };

export type RefundExceptionDetail = QueueEntry & {
  sources: DiscoveryResult;
  storedValueFunding: FundingResolution | null;
  audit: OperationsAuditEntry[];
  reconcile: {
    supported: true;
    kind: 'refund';
    requirement: string;
    wording: string;
  };
};

export type CarrierExceptionDetail = QueueEntry & {
  audit: OperationsAuditEntry[];
  reconcile: {
    supported: true;
    kind: 'carrier';
    requirement: string;
    providerIdKnown: boolean;
  };
};

export type ReturnExceptionDetail = QueueEntry & {
  lines: { line: string; quantity: number; ranges: { start: number; quantity: number }[] }[];
  effects: { supported: false; reasons: string[] };
  reconcile: { supported: false; reason: string };
  audit: OperationsAuditEntry[];
};

export type ExceptionDetail =
  | RefundExceptionDetail
  | CarrierExceptionDetail
  | ReturnExceptionDetail;

export type Readiness = {
  readinessVersion: number;
  notice: string;
  flags: {
    merchantRefundsEnabled: boolean;
    merchantPaystackRefundsEnabled: boolean;
    merchantExternalCarrierEnabled: boolean;
    merchantKoraRefundsEnabled: boolean;
    merchantPayoutTransfersEnabled: boolean;
  };
  refundSources: { provider: string; state: string; reason: string }[];
  shipping: { state: string; reason: string };
  tax: { state: string; reason: string };
  payout: { state: string; reason: string };
  goods: { state: string; reason: string };
  zeroValueCancellation: { state: string; reason: string };
  carrier: {
    enabled: boolean;
    reviewedContracts: number;
    unresolvedBookings: number;
    reconcileRequirement: string;
  };
  returns: { effectsSupported: false; reason: string; effectsFlagEnabled?: boolean };
  queueCounts: { refund: number; carrier: number; return: number };
  mechanisms?: {
    koraRefund: {
      state: string;
      flag: { name: string; enabled: boolean };
      policy: { state: string; recordedVersions: number; activeVersion: number | null };
      unresolvedReservations: number;
      reason: string;
    };
    payoutTransfer: {
      state: string;
      flag: { name: string; enabled: boolean };
      policy: { state: string; recordedVersions: number; activeVersion: number | null };
      unresolvedTransfers: number;
      reason: string;
    };
    feeTreatment: FeeTreatmentProjection;
  };
};

export async function platformOpsRequest<T>(
  token: string,
  path = '',
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  if (!token)
    throw new Error('Platform operations access requires a signed-in session.');
  return foundationRequest<T>(token, `/platform-ops${path}`, method, body, signal);
}

export const isPlatformRole = (role?: string): boolean =>
  role === 'super_admin' || role === 'admin';

export const QUEUE_KINDS: QueueKind[] = ['refund', 'carrier', 'return'];

export const EMPTY_STATE: Record<QueueKind, string> = {
  refund: 'No uncertain refund allocations require platform review.',
  carrier: 'No unresolved carrier operations require platform review.',
  return: 'No quarantined returns await disposition review.',
};

export const KIND_LABEL: Record<QueueKind, string> = {
  refund: 'Refund exceptions',
  carrier: 'Carrier exceptions',
  return: 'Quarantined returns',
};
