/**
 * Wire types for the merchant settlement statement read model
 * (extracted from settlement-statement-panel.tsx so the panel stays under
 * the 300-line cap and platform-ops can consume the same shapes).
 */
export type SettlementFigure = { state?: string; reason?: string };
export type SettlementAllocation = {
  id: string;
  amountMinor: number;
  commissionMinor: number;
  tenantShareMinor: number;
  state: string;
  source: string;
};
export type SettlementStatement = {
  statementVersion: number;
  readOnly: boolean;
  currency: string;
  scope: { childId: string; orderId: string; tenantId: string };
  totals: Record<string, number>;
  sources: { totals: string };
  refunds: {
    reservedMinor: number;
    settledMinor: number;
    settledCommissionMinor: number;
    settledTenantShareMinor: number;
    allocations: SettlementAllocation[];
  };
  commissionReversal: { settledMinor: number; sourceIds: string[] };
  goodsCost: {
    sourceId: string | null;
    originalCostMinor: number;
    cancelledCostMinor: number;
    netCostMinor: number;
    sourceNote: string;
  };
  carrierCost: {
    sourceId: string | null;
    committedMinor: number;
    reservedMinor: number;
    journalExempt: boolean;
    sourceNote: string;
  };
  netReceivable: { settledMinor: number; reservedMinor: number; projectedMinor: number };
  journals: {
    sales: {
      sourceId: string;
      merchandiseMinor: number;
      tenantShareMinor: number;
      commissionMinor: number;
    } | null;
    refunds: {
      sourceId: string;
      refDoc: string;
      amountMinor: number;
      tenantShareMinor: number;
      commissionMinor: number;
    }[];
    goodsCancellations: { sourceId: string; refDoc: string; costMinor: number }[];
  };
  reconciliation: SettlementFigure & {
    identities?: { name: string; holds: boolean }[];
    items?: { scope: string; state: string; reason: string }[];
    uncertain?: { scope: string; id: string; state: string; reason: string }[];
  };
  payout: SettlementFigure;
  set: { orderId: string; totals: Record<string, number> };
};
