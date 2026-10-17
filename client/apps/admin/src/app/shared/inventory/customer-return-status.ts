import type { CustomerReturn } from '@/services/customerReturns.service';
export function returnStatus(row: CustomerReturn) {
  if (row.stockEvidence === 'unverified')
    return {
      label: 'Stock evidence missing',
      color: 'bg-amber-50 text-amber-700',
    };
  if (row.notRestocked === row.returned)
    return { label: 'Not restocked', color: 'bg-gray-100 text-gray-600' };
  return { label: 'Restocked', color: 'bg-emerald-50 text-emerald-700' };
}
export const returnQuantity = (quantity: number | null) =>
  quantity === null ? 'Unknown' : quantity.toLocaleString();

export const returnDestination = (row: CustomerReturn) =>
  row.destinations?.map((location) => location.name).join(', ') ||
  row.warehouse?.name ||
  'Unavailable';
