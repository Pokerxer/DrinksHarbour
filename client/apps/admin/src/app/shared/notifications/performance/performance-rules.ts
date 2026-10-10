import { salesUnits } from '../insights/list-rules';
import type { InsightLine } from '@/services/notificationInsights.service';
export type Segment = 'all' | 'rising' | 'falling' | 'no_sales' | 'incomplete';
export type Sort = 'fastest' | 'slowest' | 'growth' | 'decline';
export type TrendStatus =
  | 'rising'
  | 'falling'
  | 'new'
  | 'steady'
  | 'no_sales'
  | 'incomplete';
const known = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function trend(line: InsightLine): {
  status: TrendStatus;
  label: string;
  percent: number | null;
  delta: number | null;
} {
  const current =
      line.periodUnits !== undefined ? line.periodUnits : line.units7,
    previous =
      line.periodPreviousUnits !== undefined
        ? line.periodPreviousUnits
        : line.previousUnits7;
  if (!known(salesUnits(line)) || !known(current) || !known(previous))
    return {
      status: 'incomplete',
      label: 'Needs history',
      percent: null,
      delta: null,
    };
  const delta = current - previous;
  if (
    salesUnits(line) === 0 &&
    (line.periodUnits === undefined || previous === 0)
  )
    return {
      status: 'no_sales',
      label: 'No recorded sales',
      percent: null,
      delta: 0,
    };
  if (previous === 0 && current > 0)
    return { status: 'new', label: 'New sales', percent: null, delta };
  const percent = previous > 0 ? (delta / previous) * 100 : 0;
  const status = delta > 0 ? 'rising' : delta < 0 ? 'falling' : 'steady';
  return {
    status,
    label:
      status === 'rising'
        ? 'Rising'
        : status === 'falling'
          ? 'Slowing'
          : 'Unchanged',
    percent,
    delta,
  };
}
export function selectProducts(
  lines: InsightLine[],
  search: string,
  segment: Segment,
  sort: Sort
) {
  const normalize = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const tokens = normalize(search).trim().split(/\s+/).filter(Boolean);
  return lines
    .filter((line) => {
      const status = trend(line).status;
      return (
        (segment === 'all' ||
          (segment === 'no_sales' && salesUnits(line) === 0) ||
          status === segment ||
          (segment === 'rising' && status === 'new')) &&
        tokens.every((token) =>
          normalize(
            `${line.productName} ${line.sku} ${line.sizeName} ${line.warehouseName}`
          ).includes(token)
        )
      );
    })
    .sort((a, b) => {
      const at = trend(a),
        bt = trend(b);
      const weekly = sort === 'growth' || sort === 'decline';
      const aKnown = weekly ? at.delta !== null : known(salesUnits(a));
      const bKnown = weekly ? bt.delta !== null : known(salesUnits(b));
      if (!aKnown || !bKnown)
        return (
          Number(!aKnown) - Number(!bKnown) ||
          a.productName.localeCompare(b.productName) ||
          a.key.localeCompare(b.key)
        );
      const difference =
        sort === 'growth'
          ? bt.delta! - at.delta!
          : sort === 'decline'
            ? at.delta! - bt.delta!
            : sort === 'slowest'
              ? Number(salesUnits(a)) - Number(salesUnits(b))
              : Number(salesUnits(b)) - Number(salesUnits(a));
      return (
        difference ||
        a.productName.localeCompare(b.productName) ||
        a.key.localeCompare(b.key)
      );
    });
}
export function performanceTotals(lines: InsightLine[]) {
  const statuses = lines.map((line) => trend(line).status);
  return {
    total: lines.length,
    known: lines.filter((line) => known(salesUnits(line))).length,
    units: lines.reduce(
      (n, line) => n + (known(salesUnits(line)) ? Number(salesUnits(line)) : 0),
      0
    ),
    rising: statuses.filter((status) => status === 'rising' || status === 'new')
      .length,
    falling: statuses.filter((status) => status === 'falling').length,
    noSales: lines.filter((line) => salesUnits(line) === 0).length,
    incomplete: statuses.filter((status) => status === 'incomplete').length,
  };
}
export function performanceLink(path: string, line: InsightLine) {
  const params = new URLSearchParams({ subProductId: line.subProductId });
  if (line.sizeId) params.set('sizeId', line.sizeId);
  if (line.warehouseId) params.set('warehouseId', line.warehouseId);
  return `${path}?${params}`;
}
