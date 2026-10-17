'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  PiBarcode,
  PiMagnifyingGlass,
  PiArrowClockwise,
  PiMonitor,
  PiMapPin,
} from 'react-icons/pi';
import { useDashboard } from './use-dashboard';
import { PriceCheckerHeader } from './header';
import { filterKiosks, type KioskFilter } from './dashboard-utils';
import { KioskCard } from './kiosk-card';
import './dashboard-cards.css';
import './dashboard.css';
import './dashboard-responsive.css';
export default function PriceCheckerDashboard() {
  const { data: session, status } = useSession();
  const token = (session?.user as { token?: string })?.token || '';
  return <DashboardContent key={token} token={token} status={status} />;
}
function DashboardContent({
  token,
  status,
}: {
  token: string;
  status: string;
}) {
  const {
    items,
    options,
    loading,
    loaded,
    loadError,
    actionError,
    notice,
    busyId,
    load,
    change,
    copy,
  } = useDashboard(token);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<KioskFilter>('all');
  const busy = busyId !== null;
  const visible = filterKiosks(items, query, filter, options);
  const enabled = items.filter((row) => row.enabled).length;
  return (
    <div className="pc-admin pc-dashboard">
      <PriceCheckerHeader
        title="Price Checker"
        subtitle="Your store’s prices. One simple scan."
      />
      <section className="pc-command">
        <div>
          <span className="pc-command-label">IN-STORE EXPERIENCE</span>
          <h2>Give every counter a price checker.</h2>
          <p>
            Choose a store and its prices. Open the customer screen and connect
            your barcode scanner.
          </p>
          <Link href="/retail-tools/price-checker/create" className="pc-button">
            Set up a price checker <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className="pc-terminal" aria-hidden="true">
          <div>
            <PiBarcode />
            <span>SCAN. CHECK. DISCOVER.</span>
            <strong>Know your price.</strong>
            <small>Powered by DrinksHarbour</small>
          </div>
          <i />
        </div>
      </section>
      <div className="pc-summary" aria-label="Kiosk summary">
        {[
          { label: 'Total kiosks', value: items.length, icon: PiMonitor },
          { label: 'Enabled', value: enabled, icon: PiBarcode },
          {
            label: 'Locations',
            value: new Set(items.map((row) => row.location).filter(Boolean))
              .size,
            icon: PiMapPin,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label}>
            <Icon aria-hidden="true" />
            <span>
              {label}
              <strong>{loaded ? value : '—'}</strong>
            </span>
          </div>
        ))}
      </div>
      <div className="pc-fleet-heading">
        <div>
          <h2>Your price checkers</h2>
          <p>Manage customer screens, store assignments and retail prices.</p>
        </div>
        <button
          className="pc-refresh"
          onClick={load}
          disabled={!token || loading || busy}
          aria-label="Refresh kiosks"
        >
          <PiArrowClockwise />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div className="pc-toolbar">
        <div className="pc-search">
          <PiMagnifyingGlass aria-hidden="true" />
          <input
            aria-label="Search kiosks"
            placeholder="Search kiosk, store or location…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <div className="pc-segments" aria-label="Filter kiosk status">
          {(['all', 'enabled', 'disabled'] as const).map((value) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === 'all'
                ? 'All kiosks'
                : value === 'enabled'
                  ? 'Enabled'
                  : 'Disabled'}
            </button>
          ))}
        </div>
      </div>
      {loadError && (
        <p className="pc-error" role="alert">
          {loaded ? 'Showing the last loaded kiosks. ' : ''}
          {loadError}{' '}
          <button onClick={load} disabled={loading || busy}>
            Retry loading
          </button>
        </p>
      )}
      {actionError && (
        <p className="pc-error" role="alert">
          {actionError}
        </p>
      )}
      {notice && (
        <p className="pc-feedback" role="status">
          {notice}
        </p>
      )}
      {status !== 'loading' && !token ? (
        <p role="alert">
          Sign in with a tenant administrator account to manage price checkers.
        </p>
      ) : status === 'loading' || (loading && !loaded) ? (
        <div
          className="pc-kiosk-grid"
          role="status"
          aria-label="Loading kiosks"
        >
          {[1, 2, 3].map((i) => (
            <div key={i} className="pc-skeleton">
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      ) : !loaded && loadError ? null : !items.length ? (
        <section className="pc-empty">
          <PiBarcode aria-hidden="true" />
          <h2>Make your first counter scan-ready</h2>
          <p>
            Choose a store, connect its prices, then open the kiosk on your
            display.
          </p>
          <Link className="pc-button" href="/retail-tools/price-checker/create">
            Create your first kiosk
          </Link>
        </section>
      ) : !visible.length ? (
        <section className="pc-empty">
          <PiMagnifyingGlass aria-hidden="true" />
          <h2>No matching kiosks</h2>
          <p>Try a different name, store or status.</p>
          <button
            className="pc-button"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
          >
            Clear filters
          </button>
        </section>
      ) : (
        <>
          <p className="pc-results" role="status">
            Showing {visible.length} of {items.length} kiosks
          </p>
          <div className="pc-kiosk-grid" aria-busy={loading || busy}>
            {visible.map((kiosk) => (
              <KioskCard
                key={kiosk._id}
                kiosk={kiosk}
                options={options}
                busy={busy}
                saving={busyId === kiosk._id}
                onChange={change}
                onCopy={copy}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
