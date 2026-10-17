import {
  PiBarcode,
  PiCheckCircle,
  PiQuestion,
  PiWine,
  PiChartBar,
} from 'react-icons/pi';
import type { KioskAnalytics } from './types';
export function AnalyticsSummary({
  data,
  kioskName,
}: {
  data: KioskAnalytics;
  kioskName: string;
}) {
  const { overview } = data;
  const successRate = overview.total
    ? Math.round((overview.successful / overview.total) * 100)
    : null;
  return (
    <>
      <section className="pc-report-summary" aria-label="Applied report scope">
        <div>
          <span className="pc-report-eyebrow">SCAN ACTIVITY · LAGOS TIME</span>
          <h2>{kioskName}</h2>
          <p>
            {data.range.from} <span aria-hidden="true">→</span> {data.range.to}
          </p>
        </div>
        <div className="pc-report-leader">
          <PiChartBar aria-hidden="true" />
          <div>
            <span>Most active kiosk</span>
            <strong>{overview.mostActiveKiosk || 'No scans yet'}</strong>
          </div>
        </div>
      </section>
      <div
        className="pc-stats pc-report-stats"
        aria-label="Selected-period totals"
      >
        {[
          {
            label: 'Total scans',
            value: overview.total,
            hint: 'In the selected period',
            icon: PiBarcode,
          },
          {
            label: 'Successful scans',
            value: overview.successful,
            hint:
              successRate === null
                ? 'No scans to measure'
                : `${successRate}% of all scans`,
            icon: PiCheckCircle,
          },
          {
            label: 'Unknown barcodes',
            value: overview.unknown,
            hint: 'No catalogue match',
            icon: PiQuestion,
          },
          {
            label: 'Unique products',
            value: overview.uniqueProducts,
            hint: 'Distinct catalogue products',
            icon: PiWine,
          },
        ].map(({ label, value, hint, icon: Icon }) => (
          <div className="pc-card" key={label}>
            <div className="pc-report-stat-label">
              <span>{label}</span>
              <Icon aria-hidden="true" />
            </div>
            <strong>{value.toLocaleString('en-NG')}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </div>
      <section
        className="pc-calendar-totals pc-report-calendar"
        aria-label="Current calendar totals"
      >
        <div>
          <h2>Current calendar totals</h2>
          <p>{kioskName} · Lagos time · independent of selected dates</p>
        </div>
        <dl>
          {(
            [
              ['Today', overview.today],
              ['This week', overview.week],
              ['This month', overview.month],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value.toLocaleString('en-NG')}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
