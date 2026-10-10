import { matchesSearch, movementUnits } from '../insights/list-rules';
import type { InsightLine } from '@/services/notificationInsights.service';
import { formatCover } from '../insights/presentation';
export type StockStatus = 'out' | 'low' | 'risk' | 'unknown' | 'healthy';
export type StockFilter = StockStatus | 'attention' | 'transfers' | 'all';
export type StockSort = 'priority' | 'sales' | 'stock';
export const statusLabels: Record<StockStatus, string> = {
  out: 'Out of stock',
  low: 'Below minimum',
  risk: 'Stockout risk',
  unknown: 'Stock unknown',
  healthy: 'Above minimum',
};
export function hasForecast(line: InsightLine) {
  return !!line.forecast && line.forecast.method !== 'insufficient_history';
}
export function statusOf(line: InsightLine): StockStatus {
  if (typeof line.available !== 'number' || !Number.isFinite(line.available))
    return 'unknown';
  if (line.available <= 0) return 'out';
  if (
    (line.transferPlan?.outboundUnits || 0) > 0 &&
    (line.transferPlan?.availableAfterCommitments ?? Infinity) <=
      (line.threshold ?? 0)
  )
    return 'risk';
  if (hasForecast(line) && ['urgent', 'high'].includes(line.urgency || ''))
    return 'risk';
  if (line.available <= (line.threshold ?? 0)) return 'low';
  return 'healthy';
}
export function hasTransferFollowUp(line: InsightLine) {
  return !!(
    line.transferPlan?.pending.length || line.transferPlan?.outgoing?.length
  );
}
export function needsAttention(line: InsightLine) {
  return (
    ['out', 'low', 'risk'].includes(statusOf(line)) || hasTransferFollowUp(line)
  );
}
export function localCover(line: InsightLine) {
  return !Number.isFinite(line.available) || !hasForecast(line)
    ? 'Unknown'
    : formatCover(line.daysOfCover);
}
export function warehouseSummaries(
  lines: InsightLine[],
  warehouses: Array<{ _id: string; name: string }>
) {
  const summaries = new Map(
    warehouses.map((w) => [
      w._id,
      {
        id: w._id,
        name: w.name,
        total: 0,
        attention: 0,
        out: 0,
        risk: 0,
        unknown: 0,
        transferFollowUps: 0,
      },
    ])
  );
  for (const line of lines) {
    const summary = summaries.get(line.warehouseId) || {
      id: line.warehouseId,
      name: line.warehouseId ? line.warehouseName : 'Unassigned location',
      total: 0,
      attention: 0,
      out: 0,
      risk: 0,
      unknown: 0,
      transferFollowUps: 0,
    };
    const status = statusOf(line);
    summary.total++;
    if (needsAttention(line)) summary.attention++;
    if (status === 'out') summary.out++;
    if (status === 'risk') summary.risk++;
    if (status === 'unknown') summary.unknown++;
    if (hasTransferFollowUp(line)) summary.transferFollowUps++;
    summaries.set(line.warehouseId, summary);
  }
  return Array.from(summaries.values()).sort(
    (a, b) =>
      b.out - a.out || b.attention - a.attention || a.name.localeCompare(b.name)
  );
}
export function selectRows(
  lines: InsightLine[],
  filters: {
    warehouseId: string;
    status: StockFilter;
    search: string;
    sort: StockSort;
  }
) {
  const rank = (line: InsightLine) => {
    const status = statusOf(line);
    return status === 'out'
      ? 0
      : status === 'risk' && line.urgency === 'urgent'
        ? 1
        : status === 'risk'
          ? 2
          : status === 'low'
            ? 3
            : status === 'unknown'
              ? 4
              : 5;
  };
  const cover = (line: InsightLine) =>
    hasForecast(line) ? (line.daysOfCover ?? Infinity) : Infinity;
  return lines
    .filter(
      (line) =>
        (!filters.warehouseId ||
          (filters.warehouseId === 'unassigned'
            ? !line.warehouseId
            : line.warehouseId === filters.warehouseId)) &&
        (filters.status === 'all' ||
          (filters.status === 'attention'
            ? needsAttention(line)
            : filters.status === 'transfers'
              ? hasTransferFollowUp(line)
              : filters.status === 'low'
                ? typeof line.available === 'number' &&
                  line.available > 0 &&
                  line.available <= (line.threshold ?? 0)
                : statusOf(line) === filters.status)) &&
        matchesSearch(line, filters.search)
    )
    .sort(
      (a, b) =>
        (filters.sort === 'sales'
          ? (movementUnits(b) ?? -1) - (movementUnits(a) ?? -1)
          : filters.sort === 'stock'
            ? (a.available ?? Infinity) - (b.available ?? Infinity)
            : rank(a) - rank(b) || cover(a) - cover(b)) ||
        (movementUnits(b) ?? -1) - (movementUnits(a) ?? -1) ||
        a.key.localeCompare(b.key)
    );
}
