export type PlanningEndpoint = 'warehouse-risk' | 'demand' | 'order-plan';
export type ForecastMethod =
  | 'trained_forecast'
  | 'historical_baseline'
  | 'insufficient_history';
export interface DemandForecast {
  baseline?: 'weekly_seasonal' | 'trailing_mean';
  validation?: {
    status: 'good' | 'mixed' | 'weak' | 'unvalidated' | 'unavailable';
    reason: string;
  };
  method: ForecastMethod;
  model: string | null;
  daily: number[];
  historyDays: number;
  startDate: string;
  demand7: number | null;
  demand14: number | null;
  demand30: number | null;
  errors: {
    mae: number;
    baselineMae: number;
    wape: number | null;
    bias: number;
    holdoutDays: number;
  } | null;
  limitations: string[];
}
export interface SupplierReplenishment {
  forecastAfterDeliveryUnits?: number | null;
  horizonDays: number;
  deliveryDate: string | null;
  availableAfterCommitments: number | null;
  forecastUnits: number | null;
  safetyUnits: number | null;
  minimumTargetUnits: number | null;
  incomingUnits: number;
  excludedIncomingUnits: number;
  balanceAtDelivery: number | null;
  projectedEndingUnits: number | null;
  shortfallBeforeDelivery: number | null;
  manualReviewReason?: string;
}
export interface SupplierOffer {
  replenishment?: SupplierReplenishment;
  needsManualReview?: boolean;
  manualReviewReason?: string;
  purchaseAlternativeQuantity?: number;
  offerId: string;
  pricelistId: string;
  vendorId: string;
  vendorName: string;
  currency: string;
  unitPrice: number;
  packagingQty: number;
  packaging: string;
  minQuantity: number;
  maxQuantity: number | null;
  leadTimeDays: number;
  leadTimeSource: string;
  isPreferred: boolean;
  source: string;
  quantity: number;
  packs: number;
  estimatedCost: number;
  urgency: string;
  daysOfCover: number | null;
  stockoutDate: string | null;
  suggestedUnits: number | null;
  incomingUnits: number;
}
export interface TransferRoute {
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  deliveries: number;
  netUnits: number;
  lastReceivedAt: string | null;
  typicalTransitDays: number | null;
}
export interface TransferSource extends TransferRoute {
  usualSource: boolean;
  safeSurplus: number;
  recommendedUnits: number;
  protectedUnits: number;
  outboundUnits: number;
  needsManualReview: boolean;
}
export interface TransferFollowUp {
  transferId: string;
  reference: string;
  status: string;
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  quantity: number;
  arrival: string | null;
  dispatchedAt?: string | null;
  scheduledDate?: string | null;
  followUpReason?: string;
  sourceShortfallUnits?: number | null;

  destinationWarehouseId?: string;
  destinationWarehouseName?: string;
}
export interface WarehouseTransferPlan {
  basis: 'forecast' | 'configured_minimum';
  nextStep:
    | 'verify_stock'
    | 'monitor'
    | 'approval_review'
    | 'follow_up'
    | 'transfer_review'
    | 'purchase_review';
  needUnits: number;
  pendingUnits: number;
  additionalUnits: number;
  uncoveredUnits: number;
  outboundUnits: number;
  protectedUnits: number;
  availableAfterCommitments: number | null;
  transfersDisabled?: boolean;
  usualSources: TransferRoute[];
  sources: TransferSource[];
  pending: TransferFollowUp[];
  outgoing?: TransferFollowUp[];
}
export interface StockMinimumPolicy {
  demandBasis?: 'sales' | 'transfers' | 'sales_and_transfers';
  confidence?: 'early' | 'established';
  status: 'active' | 'learning' | 'incomplete';
  units: number;
  safetyUnits?: number;
  leadDays?: number;
  leadSource?: 'transfer_history' | 'purchase_history' | 'planning_default';
  historyDays?: number;
  calculatedAt?: string;
  validUntil?: string;
  leadUnits?: number;
  dailySales?: number;
  salesStdDev?: number;
  method?: ForecastMethod | 'short_history_baseline';
  model?: string | null;
}
export interface InsightLine {
  periodUnits?: number | null;
  periodPreviousUnits?: number | null;
  periodDemandUnits?: number | null;
  demandBasis?: 'sales' | 'transfers' | 'sales_and_transfers';
  transferUnits30?: number;
  demandUnits30?: number | null;
  transferDataStatus?: 'complete' | 'incomplete';
  minimumPolicy?: StockMinimumPolicy;
  committedOutboundUnits?: number;
  transferPlan?: WarehouseTransferPlan;
  summary?: boolean;
  key: string;
  subProductId: string;
  sizeId: string;
  warehouseId: string;
  productName: string;
  productImage?: string | null;
  sku: string;
  sizeName: string;
  warehouseName: string;
  available?: number | null;
  threshold?: number;
  buffer?: number;
  bufferSource?: string;
  units30?: number | null;
  recordedUnits30?: number | null;
  salesDataStatus?:
    | 'recorded'
    | 'none'
    | 'incomplete_location'
    | 'incomplete_history';
  units7?: number | null;
  previousUnits7?: number | null;
  dailySales?: number | null;
  urgency?: string;
  daysOfCover?: number | null;
  stockoutDate?: string | null;
  suggestedUnits?: number | null;
  incomingUnits?: number;
  forecast?: DemandForecast;
  historyStart?: string | null;
  assignmentCoverage?: number | null;
  limitations?: string[];
  incoming?: Array<{
    quantity: number;
    arrival: string | null;
    source: string;
    reference: string;
  }>;
  selected?: SupplierOffer | null;
  alternatives?: SupplierOffer[];
}
export interface InsightPlan {
  period?: { startDate: string; endDate: string; days: number };
  canManageTransfers?: boolean;
  canReviewRestock?: boolean;
  generatedAt: string;
  historyEnd?: string;
  coverDays: number;
  warehouses: Array<{ _id: string; name: string }>;
  lines: InsightLine[];
  summaries?: InsightLine[];
  warnings: string[];
  canSeeStock?: boolean;
  canSeeDemand?: boolean;
  canPurchase?: boolean;
  groups?: Array<{
    key: string;
    vendorId: string;
    vendorName: string;
    currency: string;
    warehouseId: string;
    warehouseName: string;
    estimatedCost: number;
    lineKeys: string[];
  }>;
}
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
export async function planningRequest(
  token: string,
  endpoint: PlanningEndpoint,
  query: string,
  signal: AbortSignal,
  refresh = false
): Promise<InsightPlan> {
  if (!token) throw new Error('Sign in to view notifications.');
  const params = new URLSearchParams(query);
  if (refresh) params.set('refresh', 'true');
  const response = await fetch(`${API}/api/reorder/${endpoint}?${params}`, {
    signal,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object')
    throw new Error('Invalid planning response.');
  const result = body as {
    success?: boolean;
    message?: string;
    data?: InsightPlan;
  };
  if (!response.ok || result.success !== true)
    throw new Error(result.message || 'Unable to load recommendations.');
  const data = result.data;
  if (
    !data ||
    typeof data.generatedAt !== 'string' ||
    !Array.isArray(data.lines) ||
    !Array.isArray(data.warehouses) ||
    !Array.isArray(data.warnings) ||
    !data.lines.every(
      (l) =>
        l &&
        typeof l.key === 'string' &&
        typeof l.productName === 'string' &&
        typeof l.warehouseId === 'string'
    )
  )
    throw new Error('Invalid planning response.');
  return data;
}
