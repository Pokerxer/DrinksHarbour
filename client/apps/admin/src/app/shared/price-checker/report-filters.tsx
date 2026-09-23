'use client';
import type { Kiosk } from './types';
export interface ReportFilters {
  from: string;
  to: string;
  kiosk: string;
}
export function ReportFilterBar({
  filters,
  setFilters,
  kiosks,
  loading,
  apply,
  preset,
}: {
  filters: ReportFilters;
  setFilters: (filters: ReportFilters) => void;
  kiosks: Kiosk[];
  loading: boolean;
  apply: () => void;
  preset: (days: number) => void;
}) {
  return (
    <section className="pc-report-controls">
      <div className="pc-report-presets">
        <span>Reporting period</span>
        {[
          [1, 'Today'],
          [7, 'Last 7 days'],
          [30, 'Last 30 days'],
        ].map(([days, label]) => (
          <button type="button" key={days} onClick={() => preset(Number(days))}>
            {label}
          </button>
        ))}
        <small>Africa/Lagos time</small>
      </div>
      <form
        className="pc-filter"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <label>
          From
          <input
            required
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => setFilters({ ...filters, from: event.target.value })}
          />
        </label>
        <label>
          To
          <input
            required
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => setFilters({ ...filters, to: event.target.value })}
          />
        </label>
        <label>
          Kiosk
          <select
            value={filters.kiosk}
            onChange={(event) => setFilters({ ...filters, kiosk: event.target.value })}
          >
            <option value="">All kiosks</option>
            {filters.kiosk && !kiosks.some((kiosk) => kiosk._id === filters.kiosk) && (
              <option value={filters.kiosk}>Selected kiosk (historical)</option>
            )}
            {kiosks.map((kiosk) => (
              <option key={kiosk._id} value={kiosk._id}>
                {kiosk.name}
              </option>
            ))}
          </select>
        </label>
        <button className="pc-button" disabled={loading}>
          {loading ? 'Loading…' : 'Apply filters'}
        </button>
      </form>
    </section>
  );
}
