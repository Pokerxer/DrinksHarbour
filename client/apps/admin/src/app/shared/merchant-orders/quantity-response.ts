import type { GoodsAllocation } from './quantity-types';
export type ShipmentPage = {
  allocations: GoodsAllocation[];
  pagination: { hasMore: boolean; nextCursor: string | null };
};
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min: number) =>
  Number.isSafeInteger(value) && Number(value) >= min;
export function shipmentPage(value: unknown): ShipmentPage {
  if (
    !object(value) ||
    !Array.isArray(value.allocations) ||
    !object(value.pagination) ||
    typeof value.pagination.hasMore !== 'boolean' ||
    (value.pagination.nextCursor !== null &&
      typeof value.pagination.nextCursor !== 'string')
  )
    throw new Error('Invalid shipment response. Retry shipment history.');
  for (const row of value.allocations) {
    if (
      !object(row) ||
      typeof row._id !== 'string' ||
      !['shipped', 'delivered'].includes(String(row.state)) ||
      !Array.isArray(row.lines) ||
      (row.deliveryManaged !== undefined &&
        typeof row.deliveryManaged !== 'boolean')
    )
      throw new Error('Invalid shipment response. Retry shipment history.');
    for (const line of row.lines) {
      if (
        !object(line) ||
        typeof line.line !== 'string' ||
        !integer(line.quantity, 1) ||
        !Array.isArray(line.ranges) ||
        line.ranges.some(
          (range) =>
            !object(range) ||
            !integer(range.start, 0) ||
            !integer(range.quantity, 1)
        )
      )
        throw new Error('Invalid shipment response. Retry shipment history.');
    }
  }
  return value as ShipmentPage;
}
