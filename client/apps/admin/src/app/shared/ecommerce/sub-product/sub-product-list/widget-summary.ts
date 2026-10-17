import {
  computeStats,
  filterSubProducts,
  type SubProductFilterInput,
  type SubProductListItem,
} from './filtering';

export function nextWidgetFilter(current: string, selected: string): string {
  return current === selected ? '' : selected;
}

/** Facet counts exclude only the widget status, so selecting a card matches its count. */
export function summarizeWidgets(
  items: SubProductListItem[],
  filters: SubProductFilterInput,
  now = Date.now()
) {
  const candidates = filterSubProducts(items, { ...filters, statusFilter: '' });
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  const recent = candidates.filter((item) => {
    const created = new Date(item.createdAt).getTime();
    return Number.isFinite(created) && created >= cutoff && created <= now;
  });
  const recentStats = computeStats(recent);
  return {
    stats: computeStats(candidates),
    trends: [
      recentStats.total,
      recentStats.active,
      recentStats.lowStock,
      recentStats.outOfStock,
    ],
  };
}
