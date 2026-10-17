import type { KioskAnalytics } from './types';
export function AnalyticsHours({ hours }: { hours: KioskAnalytics['hours'] }) {
  const values = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    scans: hours.find((row) => row.hour === hour)?.scans || 0,
  }));
  const peak = Math.max(0, ...values.map((row) => row.scans));
  const peaks = values.filter((row) => peak > 0 && row.scans === peak);
  const firstPeak = peaks[0];
  return (
    <section className="pc-card pc-report-hours">
      <div className="pc-report-section-heading">
        <div>
          <h2>Peak hours</h2>
          <p className="pc-help">
            All scans in the selected period, grouped by hour in Lagos time.
          </p>
        </div>
        {firstPeak && (
          <span className="pc-report-peak">
            {peaks.length > 1 ? 'Joint peak' : 'Peak'}{' '}
            {String(firstPeak.hour).padStart(2, '0')}:00 ·{' '}
            {peak.toLocaleString('en-NG')} scans
          </span>
        )}
      </div>
      {!peak ? (
        <p className="pc-report-table-empty">
          No hourly activity in this period.
        </p>
      ) : (
        <div
          className="pc-report-chart"
          role="img"
          aria-label={values
            .map((row) => `${row.hour}:00, ${row.scans} scans`)
            .join('; ')}
        >
          <div className="pc-report-axis" aria-hidden="true">
            <span>{peak.toLocaleString('en-NG')}</span>
            <span>0</span>
          </div>
          <div className="pc-report-hour-bars" aria-hidden="true">
            {values.map((row) => (
              <div key={row.hour} title={`${row.hour}:00 — ${row.scans} scans`}>
                <span
                  data-peak={row.scans === peak}
                  style={{ height: `${(row.scans / peak) * 100}%` }}
                />
                {(row.hour % 6 === 0 || row.hour === 23) && (
                  <small>{String(row.hour).padStart(2, '0')}:00</small>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
