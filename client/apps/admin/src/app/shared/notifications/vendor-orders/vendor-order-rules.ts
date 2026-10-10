import type { OrderGroup } from './order-draft';
export type OrderSort = 'priority' | 'supplier' | 'units' | 'cost';
const urgencyRank: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  monitor: 3,
  unknown: 4,
};
const priority = (g: OrderGroup) =>
  Math.min(...g.lines.map((l) => urgencyRank[l.selected.urgency] ?? 4));
export function selectOrderGroups(
  groups: OrderGroup[],
  query: string,
  currency: string,
  sort: OrderSort
) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return groups
    .filter(
      (g) =>
        (currency === 'all' || g.currency === currency) &&
        terms.every((t) =>
          [
            g.vendorName,
            g.warehouseName,
            g.currency,
            ...g.lines.flatMap((l) => [l.productName, l.sizeName, l.sku]),
          ]
            .join(' ')
            .toLocaleLowerCase()
            .includes(t)
        )
    )
    .sort(
      (a, b) =>
        (sort === 'priority'
          ? priority(a) - priority(b)
          : sort === 'units'
            ? b.lines.reduce((n, l) => n + l.selected.quantity, 0) -
              a.lines.reduce((n, l) => n + l.selected.quantity, 0)
            : sort === 'cost'
              ? a.currency.localeCompare(b.currency) ||
                b.estimatedCost - a.estimatedCost
              : 0) ||
        a.vendorName.localeCompare(b.vendorName) ||
        a.warehouseName.localeCompare(b.warehouseName) ||
        a.key.localeCompare(b.key)
    );
}
export function currencyTotals(groups: OrderGroup[]) {
  const totals = new Map<string, number>();
  for (const g of groups)
    totals.set(
      g.currency,
      Math.round(((totals.get(g.currency) || 0) + g.estimatedCost) * 100) / 100
    );
  return Array.from(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, total]) => ({ currency, total }));
}
