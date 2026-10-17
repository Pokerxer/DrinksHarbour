'use client';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { PiArrowClockwise, PiBarcode } from 'react-icons/pi';
import { PriceCheckerHeader } from './header';
import { ReportFilterBar } from './report-filters';
import { AnalyticsTables } from './analytics-tables';
import { AnalyticsSummary } from './analytics-summary';
import { useAnalytics } from './use-analytics';
import './analytics.css';
import './analytics-responsive.css';
import './analytics-results.css';

export default function PriceCheckerAnalytics() {
  const { data: session, status } = useSession();
  const token = (session?.user as { token?: string })?.token || '';
  const kiosk = useSearchParams().get('kiosk') || '';
  return (
    <ReportContent
      key={`${token}:${kiosk}`}
      token={token}
      kiosk={kiosk}
      status={status}
    />
  );
}
function ReportContent({
  token,
  kiosk,
  status,
}: {
  token: string;
  kiosk: string;
  status: string;
}) {
  const state = useAnalytics(token, kiosk);
  const {
    report,
    loading,
    error,
    validation,
    kiosks,
    listError,
    listLoading,
    dirty,
  } = state;
  const kioskName = report?.scope.kiosk
    ? kiosks.find((row) => row._id === report.scope.kiosk)?.name ||
      'Selected kiosk (historical or unavailable)'
    : 'All kiosks';
  const signedIn = Boolean(token) && status !== 'loading';
  return (
    <div className="pc-admin pc-analytics">
      <PriceCheckerHeader
        title="Price Checker Analytics"
        subtitle="Understand customer interest and spot gaps on the shelf."
      />
      <ReportFilterBar
        filters={state.filters}
        setFilters={state.edit}
        kiosks={kiosks}
        loading={loading}
        disabled={!signedIn}
        apply={() => state.apply()}
        preset={state.preset}
        dirty={dirty}
      />
      {listError && (
        <p className="pc-error" role="alert">
          {listError} Reports can still be viewed.{' '}
          <button onClick={state.loadKiosks} disabled={listLoading}>
            Retry kiosk list
          </button>
        </p>
      )}
      {validation && (
        <p className="pc-error" role="alert">
          {validation}
        </p>
      )}
      {error && (
        <p className="pc-error" role="alert">
          {error} <button onClick={state.refresh}>Retry report</button>
        </p>
      )}
      {status !== 'loading' && !token ? (
        <p role="alert">Sign in as a tenant administrator to view analytics.</p>
      ) : status === 'loading' || loading ? (
        <div className="pc-report-loading" role="status">
          <PiArrowClockwise aria-hidden="true" /> Loading scan activity…
        </div>
      ) : report && !error ? (
        <>
          <div className="pc-report-title">
            <div>
              <h2>Your scan report</h2>
              <p>Based on the applied filters below.</p>
            </div>
            <button className="pc-report-refresh" onClick={state.refresh}>
              <PiArrowClockwise aria-hidden="true" /> Refresh report
            </button>
          </div>
          <AnalyticsSummary data={report.data} kioskName={kioskName} />
          {!report.data.overview.total ? (
            <section className="pc-report-empty">
              <PiBarcode aria-hidden="true" />
              <h2>No scans in this period</h2>
              <p>
                Try another date range, or open a kiosk and scan a product to
                start collecting activity.
              </p>
              <button className="pc-button" onClick={() => state.preset(30)}>
                View last 30 days
              </button>
            </section>
          ) : (
            <>
              <AnalyticsTables data={report.data} />
              <nav
                className="pc-report-pagination"
                aria-label="Report table pages"
              >
                <p>
                  Pages apply to all three lists. Summary totals and peak hours
                  cover the entire period.
                </p>
                <div>
                  <button
                    disabled={report.data.range.page === 1}
                    onClick={() => state.paginate(report.data.range.page - 1)}
                  >
                    Previous
                  </button>
                  <span role="status">Page {report.data.range.page}</span>
                  <button
                    disabled={
                      !report.data.hasMore || report.data.range.page >= 10000
                    }
                    onClick={() => state.paginate(report.data.range.page + 1)}
                  >
                    Next
                  </button>
                </div>
              </nav>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
