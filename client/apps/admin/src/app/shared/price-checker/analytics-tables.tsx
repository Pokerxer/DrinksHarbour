import type { InterestRow, KioskAnalytics } from './types';
const money = (row: InterestRow) =>
  row.currentPrice === null || !row.currency
    ? 'Unavailable'
    : new Intl.NumberFormat('en-NG', { style: 'currency', currency: row.currency }).format(
        row.currentPrice
      );
function InterestTable({
  title,
  rows,
  stock = false,
}: {
  title: string;
  rows: InterestRow[];
  stock?: boolean;
}) {
  return (
    <section className="pc-card">
      <h2>{title}</h2>
      <div className="pc-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product / kiosk</th>
              <th>Barcode</th>
              <th>Scans</th>
              <th>{stock ? 'Units available now' : 'Current price'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.kiosk}-${row.barcode}-${index}`}>
                <td>
                  <strong>{row.productName}</strong>
                  <small>{row.kioskName}</small>
                </td>
                <td>{row.barcode}</td>
                <td>{row.scans}</td>
                <td>{stock ? row.quantity : money(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="pc-help">No matching scans in this period.</p>}
    </section>
  );
}
export function AnalyticsTables({ data }: { data: KioskAnalytics }) {
  const max = Math.max(1, ...data.hours.map((row) => row.scans));
  return (
    <>
      <section className="pc-card">
        <h2>Peak hours</h2>
        <p className="pc-help">Scan activity in Africa/Lagos time.</p>
        <div
          className="pc-hours"
          role="img"
          aria-label={data.hours.map((row) => `${row.hour}:00, ${row.scans} scans`).join('; ')}
        >
          {data.hours.map((row) => (
            <div key={row.hour} title={`${row.hour}:00 — ${row.scans} scans`}>
              <span style={{ height: `${(row.scans / max) * 100}%` }} />
              <small>{row.hour}</small>
            </div>
          ))}
        </div>
      </section>
      <InterestTable title="Most scanned products" rows={data.popular} />
      <section className="pc-card">
        <h2>Unknown barcodes</h2>
        <p className="pc-help">
          Products scanned here that do not match a barcode in your catalogue.
        </p>
        <div className="pc-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Barcode</th>
                <th>Scans</th>
                <th>First seen</th>
                <th>Last seen</th>
                <th>Kiosk</th>
              </tr>
            </thead>
            <tbody>
              {data.unknown.map((row) => (
                <tr key={`${row.kiosk}-${row.barcode}`}>
                  <td>{row.barcode}</td>
                  <td>{row.count}</td>
                  <td>
                    {new Date(row.firstSeen).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}
                  </td>
                  <td>
                    {new Date(row.lastSeen).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}
                  </td>
                  <td>{row.kioskName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.unknown.length && <p>No unknown barcodes in this period.</p>}
      </section>
      <InterestTable title="Low stock interest" rows={data.lowStock} stock />
    </>
  );
}
