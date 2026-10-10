import type { TenantNotice } from '@/services/notification.service';
import { fullNoticeTimestamp } from './inbox-filters';
const appearances: Record<string, { label: string; tile: string }> = {
  low_stock_alert: { label: 'Stock alert', tile: 'bg-amber-50 text-amber-700' },
  product_performance: {
    label: 'Selling well',
    tile: 'bg-emerald-50 text-emerald-700',
  },
  product_suggestion: {
    label: 'Suggestion',
    tile: 'bg-indigo-50 text-indigo-700',
  },
  batch_expiry_alert: {
    label: 'Expiry warning',
    tile: 'bg-orange-50 text-orange-700',
  },
  product_approved: {
    label: 'Product approved',
    tile: 'bg-emerald-50 text-emerald-700',
  },
  product_rejected: {
    label: 'Product needs changes',
    tile: 'bg-red-50 text-red-700',
  },
};
export function noticeAppearance(type: string) {
  return (
    appearances[type] || {
      label: 'General update',
      tile: 'bg-gray-100 text-gray-600',
    }
  );
}
const labels: Record<string, string> = {
  productName: 'Product',
  available: 'Available stock',
  currentUnits: 'Units sold (current period)',
  threshold: 'Low stock threshold',
  previousUnits: 'Previous period',
  units30: 'Units sold (30 days)',
  suggestedUnits: 'Suggested quantity',
  quantity: 'Affected quantity',
  warehouseName: 'Location',
  sizeName: 'Size',
  rejectionReason: 'Reason for review',
  daysOfCover: 'Days of stock cover',
  model: 'Forecast model',
  method: 'Forecast method',
};
const unitKeys = new Set([
  'available',
  'currentUnits',
  'threshold',
  'previousUnits',
  'units30',
  'suggestedUnits',
  'quantity',
]);
// Display only approved evidence. Internal rule identifiers are not customer copy.
export function noticeFacts(metadata: TenantNotice['metadata']) {
  const facts = Object.entries(labels).flatMap(([key, label]) => {
    const value = metadata[key];
    if (typeof value === 'number' && Number.isFinite(value))
      return [
        {
          label,
          value: unitKeys.has(key)
            ? `${value.toLocaleString('en-NG')} ${value === 1 ? 'unit' : 'units'}`
            : String(value),
        },
      ];
    return typeof value === 'string' && value.trim()
      ? [{ label, value: value.trim() }]
      : [];
  });
  const {
    periodStart,
    periodEnd,
    expiryDate,
    stockoutDate,
    forecastGeneratedAt,
  } = metadata;
  if (
    typeof periodStart === 'string' &&
    typeof periodEnd === 'string' &&
    Number.isFinite(Date.parse(periodStart)) &&
    Number.isFinite(Date.parse(periodEnd)) &&
    Date.parse(periodEnd) > Date.parse(periodStart)
  ) {
    facts.push({
      label: 'Sales period',
      value: `${fullNoticeTimestamp(periodStart)} – ${fullNoticeTimestamp(new Date(Date.parse(periodEnd) - 1).toISOString())}`,
    });
  }
  if (typeof expiryDate === 'string' && Number.isFinite(Date.parse(expiryDate)))
    facts.push({ label: 'Expiry', value: fullNoticeTimestamp(expiryDate) });
  if (
    typeof stockoutDate === 'string' &&
    Number.isFinite(Date.parse(stockoutDate))
  )
    facts.push({
      label: 'Predicted stockout',
      value: fullNoticeTimestamp(stockoutDate),
    });
  if (
    typeof forecastGeneratedAt === 'string' &&
    Number.isFinite(Date.parse(forecastGeneratedAt))
  )
    facts.push({
      label: 'Forecast updated',
      value: fullNoticeTimestamp(forecastGeneratedAt),
    });
  return facts;
}
