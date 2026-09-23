'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { priceCheckerApi as api } from '@/services/priceChecker.service';
import { PriceCheckerHeader } from './header';
import { datePreset, reportDateError } from './workflow-utils';
import { ReportFilterBar } from './report-filters';
import { AnalyticsTables } from './analytics-tables';
import type { Kiosk, KioskAnalytics } from './types';
export default function PriceCheckerAnalytics() {
  const { data: session, status } = useSession();
  const token = (session?.user as { token?: string })?.token || '';
  const params = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    ...datePreset(30),
    kiosk: params.get('kiosk') || '',
  }));
  const [query, setQuery] = useState<Record<string, string>>({
    ...datePreset(30),
    kiosk: params.get('kiosk') || '',
    page: '1',
  });
  const [data, setData] = useState<KioskAnalytics | null>(null);
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [validation, setValidation] = useState('');
  function apply(next = filters) {
    const problem = reportDateError(next.from, next.to);
    setValidation(problem);
    if (!problem) setQuery({ ...next, page: '1' });
  }
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    api
      .list(token, controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setKiosks(rows);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [token]);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api
      .analytics(
        Object.fromEntries(Object.entries(query).filter(([, v]) => v)),
        token,
        controller.signal
      )
      .then((report) => {
        if (!controller.signal.aborted) setData(report);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Unable to load report.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, token]);
  return (
    <div className="pc-admin">
      <PriceCheckerHeader
        title="Price Checker Analytics"
        subtitle="See what customers are interested in, and spot gaps on the shelf."
      />
      <ReportFilterBar
        filters={filters}
        setFilters={setFilters}
        kiosks={kiosks}
        loading={loading}
        apply={() => apply()}
        preset={(days) => {
          const next = { ...filters, ...datePreset(days) };
          setFilters(next);
          apply(next);
        }}
      />
      {validation && (
        <p className="pc-error" role="alert">
          {validation}
        </p>
      )}
      {error && (
        <p className="pc-error" role="alert">
          {error} <button onClick={() => setQuery({ ...query })}>Retry report</button>
        </p>
      )}
      {status !== 'loading' && !token ? (
        <p>Sign in as a tenant administrator to view analytics.</p>
      ) : loading ? (
        <p role="status">Loading scan activity…</p>
      ) : data && !error ? (
        <>
          <p className="pc-help">
            Selected period: {data.range.from} – {data.range.to} · Most active kiosk:{' '}
            {data.overview.mostActiveKiosk || 'No scans yet'}
          </p>
          <div className="pc-stats">
            {(
              [
                ['Total scans', data.overview.total],
                ['Successful scans', data.overview.successful],
                ['Unknown barcodes', data.overview.unknown],
                ['Unique products', data.overview.uniqueProducts],
              ] as const
            ).map(([label, value]) => (
              <div className="pc-card" key={label}>
                <span>{label}</span>
                <strong>{value.toLocaleString()}</strong>
              </div>
            ))}
          </div>
          <div className="pc-calendar-totals">
            <span>Calendar totals · selected kiosk · Lagos time</span>
            <strong>Today {data.overview.today.toLocaleString()}</strong>
            <strong>This week {data.overview.week.toLocaleString()}</strong>
            <strong>This month {data.overview.month.toLocaleString()}</strong>
          </div>
          {!data.overview.total && (
            <section className="pc-report-empty">
              <h2>No scans in this period</h2>
              <p>
                Try another date range, or open a kiosk and scan a product to start collecting
                activity.
              </p>
            </section>
          )}
          <AnalyticsTables data={data} />
          <div className="pc-pagination">
            <button
              disabled={data.range.page === 1}
              onClick={() => setQuery({ ...query, page: String(data.range.page - 1) })}
            >
              Previous
            </button>
            <span>Page {data.range.page}</span>
            <button
              disabled={!data.hasMore}
              onClick={() => setQuery({ ...query, page: String(data.range.page + 1) })}
            >
              Next
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
