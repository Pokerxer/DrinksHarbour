import { venueRequest } from './api';
import { collectCataloguePages } from './catalog-pages';
export type Quantity = {
  amountScaled: number;
  scale: 1 | 100;
  unit: 'count' | 'g' | 'ml';
};
export type ServingMode =
  | 'sealed'
  | 'pour'
  | 'made_to_order'
  | 'prepared_batch';
export type Serving = {
  id: string;
  subProductId: string;
  code: string;
  displayName: string;
  mode: ServingMode;
  saleUnit:
    | 'portion'
    | 'plate'
    | 'bowl'
    | 'tray'
    | 'piece'
    | 'bottle'
    | 'glass';
  version: number;
  sellingPrice?: number;
  costPrice?: number | null;
  weightGrams?: number;
  volumeMl?: number;
  servingsPerUnit?: number;
};
export type ServingInput = Omit<Serving, 'id' | 'subProductId' | 'version'>;
export type CostingReadiness = {
  servingsEnabled: boolean;
  actualCostingEnabled: boolean;
  policyStatus: string;
  grants: string[];
  supportedModes: ServingMode[];
  packageStatus: string;
};
export type MarginRow = {
  sourceId: string;
  lineId: string | null;
  servingSnapshot: { displayName: string } | null;
  netMerchandiseMinor: number;
  recordedCogsMinor: number | null;
  estimatedCostMinor: number | null;
  grossProfitMinor: number | null;
  grossMarginPct: number | null;
  markupPct: number | null;
  contributionMinor: number | null;
  costStatus: string;
  missingReasons: string[];
};
export type MarginReport = {
  rows: MarginRow[];
  nextCursor: string | null;
  totals: {
    netMerchandiseMinor: number;
    grossProfitMinor: number | null;
    contributionMinor: number | null;
  };
  coverage: { costPct: number };
  asOf: string;
  basis: 'estimated' | 'recorded';
};
export type ProductionRow = {
  id: string;
  version: number;
  state: 'draft' | 'reserved' | 'completed' | 'cancelled';
  outputBatchId?: string | null;
  sourceCostMinor?: number | null;
  outputCostMinor?: number | null;
  lossCostMinor?: number | null;
};
export type VarianceReport = {
  rows: {
    subProductId: string;
    sizeId: string;
    actualUsageMinor: number | null;
    theoreticalUsageMinor: number | null;
    varianceMinor: number | null;
    missingReasons: string[];
  }[];
  totals: {
    actualUsageMinor: number | null;
    theoreticalUsageMinor: number | null;
    varianceMinor: number | null;
  };
  coverage: { reconciliationStatus: string; missingReasons: string[] };
  asOf: string;
  currency: 'NGN';
};
const path = (locationId: string) =>
  `/locations/${encodeURIComponent(locationId)}`;
export const getCostingReadiness = (token: string, locationId: string) =>
  venueRequest<CostingReadiness>(token, `${path(locationId)}/catalog-costing`);
export const listServings = (token: string, locationId: string) =>
  collectCataloguePages<Serving>(token, `${path(locationId)}/servings`);
export const saveServing = (
  token: string,
  locationId: string,
  body: { subProductId: string; expectedVersion: number; input: ServingInput },
  sizeId?: string,
) =>
  venueRequest<{ id: string; version: number }>(
    token,
    `${path(locationId)}/servings${sizeId ? `/${encodeURIComponent(sizeId)}` : ''}`,
    sizeId ? 'PATCH' : 'POST',
    body,
  );
export const getMarginReport = (
  token: string,
  locationId: string,
  query: {
    fromDate: string;
    toDate: string;
    basis: 'estimated' | 'recorded';
    cursor?: string;
  },
) =>
  venueRequest<MarginReport>(
    token,
    `${path(locationId)}/reports/margins?${new URLSearchParams(query)}`,
  );
export const listProduction = (token: string, locationId: string) =>
  collectCataloguePages<ProductionRow>(
    token,
    `${path(locationId)}/production`,
  );
export const createProduction = (
  token: string,
  locationId: string,
  input: {
    subProductId: string;
    sizeId: string;
    recipeVersionId: string;
    expectedOutput: Quantity;
  },
) =>
  venueRequest<ProductionRow>(token, `${path(locationId)}/production`, 'POST', {
    input,
    expectedVersion: 0,
  });
export const productionCommand = (
  token: string,
  locationId: string,
  batch: ProductionRow,
  action: 'reserve' | 'complete' | 'cancel',
  body?: {
    actualOutput?: Quantity;
    waste?: { classification: 'normal' | 'abnormal'; reason: string };
    reason?: string;
  },
) =>
  venueRequest<ProductionRow>(
    token,
    `${path(locationId)}/production/${encodeURIComponent(batch.id)}/${action}`,
    'POST',
    { expectedVersion: batch.version, ...body },
  );
export const getUsageVariance = (
  token: string,
  locationId: string,
  openingCountId: string,
  closingCountId: string,
) =>
  venueRequest<VarianceReport>(
    token,
    `${path(locationId)}/reports/usage-variance?${new URLSearchParams({ openingCountId, closingCountId })}`,
  );
export const createCount = (
  token: string,
  locationId: string,
  input: {
    countKey: string;
    items: {
      subProductId: string;
      sizeId: string;
      quantity: Quantity | null;
    }[];
  },
) =>
  venueRequest<{ id: string; version: number; completeness: string }>(
    token,
    `${path(locationId)}/inventory-counts`,
    'POST',
    { input, expectedVersion: 0 },
  );
export const completeCount = (
  token: string,
  locationId: string,
  countId: string,
  expectedVersion: number,
) =>
  venueRequest<{
    id: string;
    version: number;
    completeness: string;
    missingReasons: string[];
  }>(
    token,
    `${path(locationId)}/inventory-counts/${encodeURIComponent(countId)}/complete`,
    'POST',
    { expectedVersion },
  );
