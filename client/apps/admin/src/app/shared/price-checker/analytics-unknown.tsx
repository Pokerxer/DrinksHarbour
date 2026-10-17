import type { KioskAnalytics } from './types';
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString('en-NG', {
        timeZone: 'Africa/Lagos',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unavailable';
}
export function UnknownBarcodes({
  rows,
  page,
}: {
  rows: KioskAnalytics['unknown'];
  page: number;
}) {
  return (
    <section className="pc-card pc-report-table-section">
      <div className="pc-report-section-heading">
        <div>
          <h2>Unknown barcodes</h2>
          <p className="pc-help">
            Scanned barcodes with no catalogue match. Check the barcode
            assignment in your inventory.
          </p>
        </div>
        <span className="pc-report-row-count">{rows.length} on this page</span>
      </div>
      {!rows.length ? (
        <p className="pc-report-table-empty">
          {page > 1
            ? 'No rows on this page. Check previous pages for more results.'
            : 'No unknown barcodes in this period.'}
        </p>
      ) : (
        <div
          className="pc-table-wrap"
          role="region"
          aria-label="Unknown barcode results"
          tabIndex={0}
        >
          <table className="pc-report-table">
            <caption className="pc-report-sr-only">
              Unknown barcodes · page {page} · dates in Lagos time
            </caption>
            <thead>
              <tr>
                <th scope="col">Barcode</th>
                <th scope="col">Scans</th>
                <th scope="col">First seen</th>
                <th scope="col">Last seen</th>
                <th scope="col">Kiosk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.kiosk}-${row.barcode}`}>
                  <td
                    data-label="Barcode"
                    className="pc-report-product pc-report-barcode"
                  >
                    {row.barcode}
                  </td>
                  <td data-label="Scans" className="pc-report-number">
                    {row.count.toLocaleString('en-NG')}
                  </td>
                  <td data-label="First seen">
                    <time dateTime={row.firstSeen}>
                      {dateLabel(row.firstSeen)}
                    </time>
                  </td>
                  <td data-label="Last seen">
                    <time dateTime={row.lastSeen}>
                      {dateLabel(row.lastSeen)}
                    </time>
                  </td>
                  <td data-label="Kiosk">{row.kioskName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
