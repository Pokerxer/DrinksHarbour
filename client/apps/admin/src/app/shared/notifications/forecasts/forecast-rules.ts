import type { InsightLine } from '@/services/notificationInsights.service';
import { matchesSearch, salesUnits } from '../insights/list-rules';
export type ForecastFilter =
  | 'all'
  | 'attention'
  | 'history'
  | 'validated'
  | 'weak'
  | 'trained'
  | 'baseline';
export type ForecastSort =
  | 'demand'
  | 'shortfall'
  | 'quality'
  | 'sales'
  | 'name';
const known = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);
export function reviewForecast(line: InsightLine, days: number, asOf?: string) {
  const f = line.forecast,
    supported =
      f?.method !== 'insufficient_history' &&
      !!f?.daily &&
      f.daily.length >= days &&
      f.daily.slice(0, days).every((n) => known(n) && n >= 0);
  const demand = supported
    ? f!.daily.slice(0, days).reduce((a, b) => a + b, 0)
    : null;
  const start = Date.parse(f?.startDate || ''),
    end = start + days * 86400000;
  const arrivals = (line.incoming || []).filter(
    (r) =>
      known(r.quantity) &&
      r.quantity > 0 &&
      Date.parse(r.arrival || '') >=
        Math.max(start, Date.parse(asOf || '') || start) &&
      Date.parse(r.arrival || '') < end
  );
  const incoming = arrivals.reduce((n, r) => n + r.quantity, 0);
  const stockKnown = !line.summary && known(line.available),
    effective = stockKnown
      ? line.available! - (line.committedOutboundUnits || 0)
      : null;
  const balance =
    effective !== null && demand !== null
      ? effective + incoming - demand
      : null;
  let minimum = effective,
    projected = effective,
    stockoutDay: number | null = null;
  if (projected !== null && demand !== null) {
    if (projected <= 0 && demand > 0) stockoutDay = 0;
    for (let i = 0; i < days; i++) {
      projected += arrivals
        .filter(
          (r) => Math.floor((Date.parse(r.arrival!) - start) / 86400000) === i
        )
        .reduce((n, r) => n + r.quantity, 0);
      projected -= f!.daily[i];
      minimum = Math.min(minimum!, projected);
      if (stockoutDay === null && projected <= 1e-8 && demand > 0)
        stockoutDay = i + 1;
    }
  }
  const shortfall =
    balance !== null ? Math.max(0, Math.ceil(-minimum! - 1e-8)) : null;
  const fit =
    f?.validation?.status || (supported ? 'unvalidated' : 'unavailable');
  return {
    demand,
    incoming,
    effective,
    balance,
    shortfall,
    stockoutDay,
    fit,
    attention: shortfall !== null && shortfall > 0,
    supported,
  };
}
export function matchesForecast(
  line: InsightLine,
  filter: ForecastFilter,
  days: number,
  asOf?: string
) {
  const r = reviewForecast(line, days, asOf);
  if (filter === 'attention') return r.attention;
  if (filter === 'history') return !r.supported;
  if (filter === 'validated') return r.fit === 'good';
  if (filter === 'weak')
    return ['mixed', 'weak', 'unvalidated'].includes(r.fit);
  if (filter === 'trained') return line.forecast?.method === 'trained_forecast';
  if (filter === 'baseline')
    return line.forecast?.method === 'historical_baseline';
  return true;
}
export function selectForecasts(
  lines: InsightLine[],
  query: string,
  filter: ForecastFilter,
  sort: ForecastSort,
  days: number,
  asOf?: string
) {
  const quality = {
    good: 0,
    mixed: 1,
    weak: 2,
    unvalidated: 3,
    unavailable: 4,
  };
  const metric = (line: InsightLine) =>
    sort === 'sales'
      ? salesUnits(line)
      : sort === 'shortfall'
        ? reviewForecast(line, days, asOf).shortfall
        : reviewForecast(line, days, asOf).demand;
  return lines
    .filter(
      (l) => matchesSearch(l, query) && matchesForecast(l, filter, days, asOf)
    )
    .sort((a, b) => {
      let difference = 0;
      if (sort === 'quality')
        difference =
          quality[reviewForecast(a, days, asOf).fit] -
          quality[reviewForecast(b, days, asOf).fit];
      else if (sort !== 'name') {
        const x = metric(a),
          y = metric(b);
        if (known(x) !== known(y)) return known(x) ? -1 : 1;
        if (known(x) && known(y)) difference = y - x;
      }
      return (
        difference ||
        a.productName.localeCompare(b.productName) ||
        a.key.localeCompare(b.key)
      );
    });
}
