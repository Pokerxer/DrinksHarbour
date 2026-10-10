const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
export type HistoryKind = 'purchases' | 'transfers' | 'movements' | 'transfer_movements';
export interface HistoryRow {
  id: string;
  documentId: string;
  documentType: 'purchase' | 'transfer' | 'product';
  reference: string;
  date: string;
  status: string;
  description: string;
  quantity: number;
  returned?: number;
  purchasedQuantity?: number;
  receivedAmount?: number;
  returnedAmount?: number;
  netPurchaseAmount?: number;
  transferInQuantity?: number;
  transferOutQuantity?: number;
  amount?: number;
  currency?: string;
  balanceBefore?: number | null;
  stockChange?: number | null;
  balanceAfter?: number;
  actor?: string;
}
export interface TransferTotalsRow {
  currency: string;
  outgoingQuantity: number;
  incomingQuantity: number;
  returnedInQuantity: number;
  returnedOutQuantity: number;
  outgoingValue: number;
  incomingValue: number;
  returnedInValue: number;
  returnedOutValue: number;
  netIncomingQuantity: number;
  netOutgoingQuantity: number;
  netOutgoingValue: number;
  netIncomingValue: number;
}
export type TransferTotals =
  | {
      kind: 'documents';
      currencies: TransferTotalsRow[];
      pairs: (TransferTotalsRow & { warehouseId: string; warehouseName: string })[];
    }
  | {
      kind: 'movements';
      outgoingQuantity: number;
      incomingQuantity: number;
      returnedInQuantity: number;
      returnedOutQuantity: number;
      netIncomingQuantity: number;
      netOutgoingQuantity: number;
      moneyAvailable: false;
    };
export interface PurchaseTotals {
  currencies: {
    currency: string;
    receivedQuantity: number;
    returnedQuantity: number;
    netReceivedQuantity: number;
    receivedValue: number;
    returnedValue: number;
    netReceivedValue: number;
  }[];
}
export interface MovementTotals {
  incomingQuantity: number;
  outgoingQuantity: number;
  netQuantity: number;
  records: number;
  unknownChanges: number;
}
export interface WarehouseHistory {
  movementTotals?: MovementTotals;
  purchaseTotals?: PurchaseTotals;
  transferTotals?: TransferTotals;
  rows: HistoryRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
export interface HistoryFilters {
  kind: HistoryKind;
  page: number;
  limit?: number;
  product: string;
  start: string;
  end: string;
  status?: string;
  search?: string;
}
export async function getWarehouseHistory(
  id: string,
  token: string,
  filters: HistoryFilters,
): Promise<WarehouseHistory> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== undefined) params.set(key, String(value));
  });
  return readHistoryData<WarehouseHistory>(
    `${API_URL}/api/warehouses/${encodeURIComponent(id)}/history?${params}`,
    token,
  );
}

export async function getWarehouseHistoryProducts(
  id: string,
  token: string,
): Promise<{ id: string; label: string }[]> {
  return readHistoryData<{ id: string; label: string }[]>(
    `${API_URL}/api/warehouses/${encodeURIComponent(id)}/history/products`,
    token,
  );
}
async function readHistoryData<T>(url: string, token: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (error) {
    if (error instanceof TypeError)
      throw new Error('Cannot connect to the server. Check that the API is running, then retry.');
    throw error;
  }
  let body: { success?: boolean; data: T; message?: string; error?: { message?: string } };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    throw new Error('The server returned an unreadable response. Refresh and try again.');
  }
  if (!response.ok || !body.success)
    throw new Error(body.message || body.error?.message || 'Unable to load warehouse history');
  return body.data;
}
