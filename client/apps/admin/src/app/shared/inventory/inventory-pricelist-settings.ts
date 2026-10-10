import type { PriceColumnMode } from './inventory-pricelist-columns';

export interface ColumnSelection {
  plId: string;
  label: string;
  mode: PriceColumnMode;
}
export interface PricelistSettings {
  columns: ColumnSelection[];
  title: string;
  validUntil: string;
  businessName: string;
  groupByCategory: boolean;
  showSku: boolean;
  showAvailability: boolean;
  showWasPrices: boolean;
  discountPercent: number;
  taxNote: string;
}
export function defaultPricelistSettings(): PricelistSettings {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return {
    columns: [{ plId: '', label: 'Recommended Sales Price', mode: 'unit' }],
    title: 'Wholesale Price List',
    validUntil: date.toISOString().slice(0, 10),
    businessName: '',
    groupByCategory: true,
    showSku: false,
    showAvailability: false,
    showWasPrices: false,
    discountPercent: 0,
    taxNote: '',
  };
}
export function restorePricelistSettings(raw: unknown): PricelistSettings {
  const defaults = defaultPricelistSettings();
  if (!raw || typeof raw !== 'object') return defaults;
  const s = raw as Record<string, unknown>;
  const candidates = Array.isArray(s.columns)
    ? s.columns
    : typeof s.plId === 'string'
      ? [
          { plId: s.plId, label: '', mode: 'auto' },
          ...(Array.isArray(s.additionalColumns) ? s.additionalColumns : []),
        ]
      : defaults.columns;
  const seen = new Set<string>();
  const columns: ColumnSelection[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const c = candidate as Record<string, unknown>;
    if (!c || typeof c.plId !== 'string' || seen.has(c.plId)) continue;
    seen.add(c.plId);
    columns.push({
      plId: c.plId,
      label: typeof c.label === 'string' ? c.label : '',
      mode: c.mode === 'unit' || c.mode === 'bundle' ? c.mode : 'auto',
    });
    if (columns.length === 4) break;
  }
  const settings = { ...defaults, columns };
  for (const key of ['title', 'businessName', 'taxNote'] as const)
    if (typeof s[key] === 'string') settings[key] = s[key];
  if (
    typeof s.validUntil === 'string' &&
    (!s.validUntil || /^\d{4}-\d{2}-\d{2}$/.test(s.validUntil))
  )
    settings.validUntil = s.validUntil;
  for (const key of [
    'groupByCategory',
    'showSku',
    'showAvailability',
    'showWasPrices',
  ] as const)
    if (typeof s[key] === 'boolean') settings[key] = s[key];
  if (
    typeof s.discountPercent === 'number' &&
    Number.isFinite(s.discountPercent) &&
    s.discountPercent >= 0 &&
    s.discountPercent <= 90
  )
    settings.discountPercent = s.discountPercent;
  return settings;
}
export function togglePriceColumn(
  columns: ColumnSelection[],
  column: ColumnSelection
): ColumnSelection[] {
  return columns.some((c) => c.plId === column.plId)
    ? columns.filter((c) => c.plId !== column.plId)
    : columns.length < 4
      ? [...columns, column]
      : columns;
}
export function movePriceColumn(
  columns: ColumnSelection[],
  index: number,
  direction: -1 | 1
): ColumnSelection[] {
  const next = [...columns];
  const target = index + direction;
  if (index >= 0 && index < next.length && target >= 0 && target < next.length)
    [next[index], next[target]] = [next[target], next[index]];
  return next;
}
