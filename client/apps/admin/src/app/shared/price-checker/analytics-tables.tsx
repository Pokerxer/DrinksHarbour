import { AnalyticsHours } from './analytics-hours';
import { UnknownBarcodes } from './analytics-unknown';
import type { InterestRow, KioskAnalytics } from './types';
function money(row: InterestRow) {
  if (
    row.currentPrice === null ||
    !Number.isFinite(row.currentPrice) ||
    !row.currency
  )
    return 'Unavailable';
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: row.currency,
    }).format(row.currentPrice);
  } catch {
    return 'Unavailable';
  }
}
function InterestTable({
  title,
  rows,
  page,
  stock = false,
}: {
  title: string;
  rows: InterestRow[];
  page: number;
  stock?: boolean;
}) {
  return (
    <section className="pc-card pc-report-table-section">
      <div className="pc-report-section-heading">
        <div>
          <h2>{title}</h2>
          <p className="pc-help">
            {stock
              ? 'Scanned products currently at or below their stock threshold at the scanned location.'
              : 'Customer interest ranked by scans. Prices shown are current retail prices, not prices at the time of scanning.'}
          </p>
        </div>
        <span className="pc-report-row-count">{rows.length} on this page</span>
      </div>
      {!rows.length ? (
        <p className="pc-report-table-empty">
          {page > 1
            ? 'No rows on this page. Check previous pages for more results.'
            : stock
              ? 'No scanned products currently match the low-stock threshold.'
              : 'No matching product scans in this period.'}
        </p>
      ) : (
        <div
          className="pc-table-wrap"
          role="region"
          aria-label={`${title} results`}
          tabIndex={0}
        >
          <table className="pc-report-table">
            <caption className="pc-report-sr-only">
              {title} · page {page}
            </caption>
            <thead>
              <tr>
                <th scope="col">Product / kiosk</th>
                <th scope="col">Barcode</th>
                <th scope="col">Scans</th>
                <th scope="col">
                  {stock ? 'Units available now' : 'Current price'}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.kiosk}-${row.barcode}-${index}`}>
                  <td
                    data-label="Product / kiosk"
                    className="pc-report-product"
                  >
                    <strong>{row.productName || 'Product unavailable'}</strong>
                    <small>{row.kioskName}</small>
                  </td>
                  <td data-label="Barcode" className="pc-report-barcode">
                    {row.barcode}
                  </td>
                  <td data-label="Scans" className="pc-report-number">
                    {row.scans.toLocaleString('en-NG')}
                  </td>
                  <td
                    data-label={stock ? 'Units available now' : 'Current price'}
                    className="pc-report-number"
                  >
                    {stock
                      ? row.quantity !== undefined &&
                        Number.isFinite(row.quantity)
                        ? row.quantity.toLocaleString('en-NG')
                        : 'Unavailable'
                      : money(row)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
export function AnalyticsTables({ data }: { data: KioskAnalytics }) {
  return (
    <>
      <AnalyticsHours hours={data.hours} />
      <InterestTable
        title="Most scanned products"
        rows={data.popular}
        page={data.range.page}
      />
      <UnknownBarcodes rows={data.unknown} page={data.range.page} />
      <InterestTable
        title="Low stock interest"
        rows={data.lowStock}
        page={data.range.page}
        stock
      />
    </>
  );
}
