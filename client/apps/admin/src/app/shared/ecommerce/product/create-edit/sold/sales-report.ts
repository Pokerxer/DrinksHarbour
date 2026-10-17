export interface SaleRow {
  key: string;
  reference: string;
  source: string;
  buyer: string;
  buyerId: string;
  tenant: string;
  size: string;
  gross: number;
  returned: number;
  net: number;
  soldAt: string | null;
  dateBasis: string;
  status: string;
  transaction: string;
}
export interface SalesReport {
  rows: SaleRow[];
  totals: { gross: number; returned: number; net: number; transactions: number };
  complete: boolean;
}
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;
const quantity = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0;
const equal = (a: number, b: number) => Math.abs(a - b) < 0.000001;
export function salesReportFromResponse(response: unknown): SalesReport {
  if (!object(response) || !object(response.data) || !object(response.data.report))
    throw new Error('Invalid sales response');
  const report = response.data.report;
  if (
    !Array.isArray(report.rows) ||
    !object(report.totals) ||
    typeof report.complete !== 'boolean'
  )
    throw new Error('Invalid sales report');
  const rows: SaleRow[] = report.rows.map((row: unknown) => {
    if (
      !object(row) ||
      ![
        'key',
        'reference',
        'source',
        'buyer',
        'buyerId',
        'tenant',
        'size',
        'dateBasis',
        'status',
        'transaction',
      ].every((k) => typeof row[k] === 'string') ||
      !quantity(row.gross) ||
      !quantity(row.returned) ||
      !quantity(row.net) ||
      !equal(row.gross - row.returned, row.net) ||
      !(
        row.soldAt === null ||
        (typeof row.soldAt === 'string' && Number.isFinite(Date.parse(row.soldAt)))
      )
    )
      throw new Error('Invalid sale record');
    return row as unknown as SaleRow;
  });
  const totals = report.totals;
  if (
    !quantity(totals.gross) ||
    !quantity(totals.returned) ||
    !quantity(totals.net) ||
    !quantity(totals.transactions) ||
    new Set(rows.map((r) => r.key)).size !== rows.length
  )
    throw new Error('Invalid sales totals');
  for (const key of ['gross', 'returned', 'net'] as const) {
    if (
      !equal(
        rows.reduce((sum, r) => sum + r[key], 0),
        totals[key] as number
      )
    )
      throw new Error('Inconsistent sales totals');
  }
  if (new Set(rows.map((r) => r.transaction)).size !== totals.transactions)
    throw new Error('Inconsistent transaction count');
  return {
    rows,
    totals: {
      gross: totals.gross,
      returned: totals.returned,
      net: totals.net,
      transactions: totals.transactions,
    },
    complete: report.complete,
  };
}
const civilDate = (at: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(at));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
export function filterSalesRows(
  rows: SaleRow[],
  query: string,
  from: string,
  to: string
) {
  const search = query.trim().toLocaleLowerCase();
  return rows.filter((r) => {
    if (
      search &&
      ![r.reference, r.buyer, r.buyerId, r.tenant, r.size, r.source]
        .join(' ')
        .toLocaleLowerCase()
        .includes(search)
    )
      return false;
    if (!from && !to) return true;
    if (!r.soldAt) return false;
    const day = civilDate(r.soldAt);
    return (!from || day >= from) && (!to || day <= to);
  });
}
