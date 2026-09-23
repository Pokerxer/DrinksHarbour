'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  PiBarcode,
  PiMagnifyingGlass,
  PiArrowClockwise,
  PiMonitor,
  PiMapPin,
} from 'react-icons/pi';
import { priceCheckerApi as api } from '@/services/priceChecker.service';
import { PriceCheckerHeader } from './header';
import { kioskUrl } from './form-utils';
import { filterKiosks, type KioskFilter } from './dashboard-utils';
import { KioskCard } from './kiosk-card';
import type { Kiosk, KioskOptions } from './types';
import './dashboard-cards.css';
import './dashboard.css';
export default function PriceCheckerDashboard() {
  const { data: session, status } = useSession();
  const token = (session?.user as { token?: string })?.token || '';
  const [items, setItems] = useState<Kiosk[]>([]);
  const [options, setOptions] = useState<KioskOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<KioskFilter>('all');
  const pending = useRef<AbortController | null>(null);
  const writing = useRef(false);
  const load = useCallback(async () => {
    if (!token) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError('');
    try {
      const [rows, choices] = await Promise.all([
        api.list(token, controller.signal),
        api.options(token, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setItems(rows);
      setOptions(choices);
      setLoaded(true);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : 'Unable to load kiosks.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    setItems([]);
    setOptions(null);
    setLoaded(false);
    void load();
    return () => pending.current?.abort();
  }, [load]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function change(kiosk: Kiosk, remove = false) {
    if (writing.current) return;
    if (
      remove &&
      !window.confirm(
        `Delete “${kiosk.name}”? Its screen will stop working. Scan history will be retained.`
      )
    )
      return;
    writing.current = true;
    setBusy(true);
    setError('');
    try {
      if (remove) await api.remove(kiosk._id, token);
      else await api.update(kiosk._id, { enabled: !kiosk.enabled }, token);
      setNotice(
        remove
          ? 'Kiosk deleted. Scan history is retained.'
          : `${kiosk.name} ${kiosk.enabled ? 'disabled' : 'enabled'}.`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update kiosk.');
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }
  async function copy(kiosk: Kiosk) {
    try {
      await navigator.clipboard.writeText(kioskUrl(kiosk.slug));
      setNotice(`Link copied for ${kiosk.name}.`);
    } catch {
      setError('Copy is unavailable. Open the kiosk and copy its address.');
    }
  }
  const visible = filterKiosks(items, query, filter, options);
  const enabled = items.filter((row) => row.enabled).length;
  return (
    <div className="pc-admin">
      <PriceCheckerHeader title="Price Checker" subtitle="Your store’s prices. One simple scan." />
      <section className="pc-command">
        <div>
          <span className="pc-command-label">IN-STORE EXPERIENCE</span>
          <h2>
            A little clarity.
            <br />
            At every counter.
          </h2>
          <p>Connect a scanner and give customers the right price, from the right store.</p>
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
            value: new Set(items.map((row) => row.location)).size,
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
          <p>Enabled indicates configuration, not device connectivity.</p>
        </div>
        <button
          className="pc-refresh"
          onClick={load}
          disabled={loading || busy}
          aria-label="Refresh kiosks"
        >
          <PiArrowClockwise />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div className="pc-toolbar">
        <label className="pc-search">
          <PiMagnifyingGlass aria-hidden="true" />
          <input
            aria-label="Search kiosks"
            placeholder="Search kiosk, store or location…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="pc-segments" aria-label="Filter kiosk status">
          {(['all', 'enabled', 'disabled'] as const).map((value) => (
            <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {value === 'all' ? 'All kiosks' : value === 'enabled' ? 'Enabled' : 'Disabled'}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="pc-error" role="alert">
          {error} <button onClick={load}>Retry</button>
        </p>
      )}
      {notice && (
        <p className="pc-feedback" role="status">
          {notice}
        </p>
      )}
      {status !== 'loading' && !token ? (
        <p role="alert">Sign in with a tenant administrator account to manage price checkers.</p>
      ) : loading && !loaded ? (
        <div className="pc-kiosk-grid" role="status" aria-label="Loading kiosks">
          {[1, 2, 3].map((i) => (
            <div key={i} className="pc-skeleton">
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      ) : !loaded && error ? null : !items.length ? (
        <section className="pc-empty">
          <PiBarcode aria-hidden="true" />
          <h2>Make your first counter scan-ready</h2>
          <p>Choose a store, connect its prices, then open the kiosk on your display.</p>
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
          <div className="pc-kiosk-grid" aria-busy={loading}>
            {visible.map((kiosk) => (
              <KioskCard
                key={kiosk._id}
                kiosk={kiosk}
                options={options}
                busy={busy}
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
