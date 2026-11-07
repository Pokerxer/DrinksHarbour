import { venueRequest } from './api';
import type { Quantity } from './costing';
export type ReceiptSources = {
  lots: {
    id: string;
    subProductId: string;
    sizeId: string;
    batchNumber: string;
    quantity: number;
    initialQuantity: number;
    linked: boolean;
  }[];
  receipts: {
    id: string;
    subProductId: string;
    sizeId: string;
    batchNumber: string;
    quantity: number;
    amountMinor: number | null;
    performedAt: string;
  }[];
};
export async function getReceiptSources(token: string, locationId: string): Promise<ReceiptSources> {
  const result: ReceiptSources = { lots: [], receipts: [] };
  const seenLots = new Set<string>(), seenReceipts = new Set<string>();
  let lotsCursor: string | undefined, receiptsCursor: string | undefined;
  let lotsDone = false, receiptsDone = false;
  while (!lotsDone || !receiptsDone) {
    const query = new URLSearchParams({ ...(lotsCursor ? { lotsCursor } : {}), ...(receiptsCursor ? { receiptsCursor } : {}) });
    const page = await venueRequest<ReceiptSources & { nextLotsCursor?: string | null; nextReceiptsCursor?: string | null }>(
      token, `/locations/${encodeURIComponent(locationId)}/cost-sources${query.size ? `?${query}` : ''}`,
    );
    if (!lotsDone) {
      result.lots.push(...page.lots);
      lotsDone = !page.nextLotsCursor;
      if (page.nextLotsCursor) {
        if (seenLots.has(page.nextLotsCursor)) throw new Error('Receipt lot cursor repeated. Reload the list.');
        seenLots.add(page.nextLotsCursor); lotsCursor = page.nextLotsCursor;
      }
    }
    if (!receiptsDone) {
      result.receipts.push(...page.receipts);
      receiptsDone = !page.nextReceiptsCursor;
      if (page.nextReceiptsCursor) {
        if (seenReceipts.has(page.nextReceiptsCursor)) throw new Error('Original receipt cursor repeated. Reload the list.');
        seenReceipts.add(page.nextReceiptsCursor); receiptsCursor = page.nextReceiptsCursor;
      }
    }
  }
  return result;
}
export const linkReceiptValue = (
  token: string,
  locationId: string,
  batchId: string,
  input: { receiptId: string; contentQuantity: Quantity; reason: string },
) =>
  venueRequest<{ id: string; version: number; status: string }>(
    token,
    `/locations/${locationId}/cost-sources/${batchId}/link`,
    'POST',
    { input, expectedVersion: 0 },
  );
