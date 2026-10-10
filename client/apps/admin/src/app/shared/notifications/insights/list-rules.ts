import type { InsightLine } from '@/services/notificationInsights.service';
export const salesUnits = (line: InsightLine) =>
  line.periodUnits !== undefined ? line.periodUnits : line.units30;
export const movementUnits = (line: InsightLine) =>
  line.periodDemandUnits !== undefined
    ? line.periodDemandUnits
    : line.demandUnits30 !== undefined
      ? line.demandUnits30
      : line.units30;
export const normalizeSearch = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function matchesSearch(line: InsightLine, query: string) {
  const text = normalizeSearch(
    [
      line.productName,
      line.sku,
      line.sizeName,
      line.warehouseName,
      line.selected?.vendorName,
      ...(line.alternatives || []).map((a) => a.vendorName),
    ].join(' ')
  );
  return normalizeSearch(query)
    .trim()
    .split(/\s+/)
    .every((token) => text.includes(token));
}
export type InsightStatus =
  | 'all'
  | 'urgent'
  | 'history'
  | 'trained'
  | 'baseline'
  | 'supplier'
  | 'missingSupplier'
  | 'out'
  | 'minimum';
export type InsightSort =
  | 'priority'
  | 'sales'
  | 'least'
  | 'stock'
  | 'forecast'
  | 'name';
export function matchesStatus(line: InsightLine, status: InsightStatus) {
  if (status === 'out')
    return (
      typeof line.available === 'number' &&
      Number.isFinite(line.available) &&
      line.available <= 0
    );
  if (status === 'minimum')
    return (
      typeof line.available === 'number' &&
      Number.isFinite(line.available) &&
      line.available > 0 &&
      line.available <= (line.threshold ?? 0)
    );
  if (status === 'urgent')
    return ['urgent', 'high'].includes(line.urgency || '');
  if (status === 'history')
    return !line.forecast || line.forecast.method === 'insufficient_history';
  if (status === 'trained') return line.forecast?.method === 'trained_forecast';
  if (status === 'baseline')
    return line.forecast?.method === 'historical_baseline';
  if (status === 'supplier')
    return !!line.selected || !!line.alternatives?.length;
  if (status === 'missingSupplier')
    return !line.selected && !line.alternatives?.length;
  return true;
}
export function selectInsightLines(
  lines: InsightLine[],
  query: string,
  status: InsightStatus,
  sort: InsightSort
) {
  const known = (n: number | null | undefined) =>
    typeof n === 'number' && Number.isFinite(n);
  const metric = (line: InsightLine) =>
    sort === 'stock'
      ? line.available
      : sort === 'forecast'
        ? line.forecast?.method !== 'insufficient_history'
          ? line.forecast?.demand30
          : null
        : salesUnits(line);
  const rank = (line: InsightLine) =>
    ({ urgent: 0, high: 1, medium: 2, low: 3 })[line.urgency || ''] ?? 4;
  return lines
    .filter((line) => matchesSearch(line, query) && matchesStatus(line, status))
    .sort((a, b) => {
      let difference = 0;
      if (sort === 'priority') {
        difference = rank(a) - rank(b);
        if (!difference) {
          const coverA = known(a.daysOfCover)
            ? Number(a.daysOfCover)
            : Infinity;
          const coverB = known(b.daysOfCover)
            ? Number(b.daysOfCover)
            : Infinity;
          difference = coverA === coverB ? 0 : coverA - coverB;
        }
        if (!difference)
          difference =
            (known(salesUnits(b)) ? Number(salesUnits(b)) : -1) -
            (known(salesUnits(a)) ? Number(salesUnits(a)) : -1);
      } else if (sort !== 'name') {
        const x = metric(a),
          y = metric(b);
        if (known(x) !== known(y)) return known(x) ? -1 : 1;
        if (known(x) && known(y))
          difference =
            (Number(x) - Number(y)) *
            (sort === 'stock' || sort === 'least' ? 1 : -1);
      }
      return (
        difference ||
        a.productName.localeCompare(b.productName) ||
        a.key.localeCompare(b.key)
      );
    });
}
